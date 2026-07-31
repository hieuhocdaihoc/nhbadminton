<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Court;
use App\Models\Booking;
use App\Models\RecurringBooking;
use Illuminate\Http\Request;

class CourtController extends Controller
{
    private const ACTIVE_BOOKING_STATUSES = ['confirmed', 'playing'];
    private const COURT_STATUSES = ['active', 'inactive'];

    /** Chức năng: Lấy danh sách sân cho khu vực quản trị. */
    public function index()
    {
        return response()->json([
            'message' => 'Danh sách sân hiện có',
            'data' => Court::all(),
        ]);
    }

    /** Chức năng: Tạo mới sân với mã sân, thông tin mặt sân, sức chứa và trạng thái vận hành. */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'             => ['required', 'string', 'max:100'],
            'court_code'       => ['required', 'string', 'max:50', 'unique:courts,court_code'],
            'floor_type'       => ['nullable', 'string', 'max:100'],
            'has_lighting'     => ['boolean'],
            'capacity'         => ['nullable', 'integer'],
            'location_note'    => ['nullable', 'string', 'max:255'],
            'is_maintenance'   => ['boolean'],
            'is_contract_only' => ['boolean'],
            'status'           => ['string', 'in:active,inactive'],
        ]);

        if (($validated['status'] ?? 'active') === 'inactive') {
            $validated['is_maintenance'] = false;
        }

        $court = Court::create($validated);

        return response()->json([
            'message' => 'Tạo sân thành công',
            'data'    => $court,
        ], 201);
    }

    /** Chức năng: Lấy chi tiết một sân. */
    public function show($id)
    {
        return response()->json(['data' => Court::findOrFail($id)]);
    }

    /** Chức năng: Lấy chi tiết sân công khai, áp dụng cùng quyền truy cập với danh sách sân. */
    public function showPublic(Request $request, $id)
    {
        $court = Court::where('status', 'active')
            ->where('is_maintenance', false)
            ->with(['images' => fn($query) => $query->where('is_primary', true)])
            ->findOrFail($id);

        if ($court->is_contract_only && !$this->hasActiveMembershipCard($request->user('sanctum'))) {
            return response()->json([
                'status' => 'error',
                'message' => 'Sân này chỉ dành cho khách hàng có thẻ thành viên đang hoạt động.',
            ], 403);
        }

        return response()->json(['data' => $court]);
    }

    /** Chức năng: Cập nhật thông tin cấu hình và trạng thái của sân. */
    public function update(Request $request, $id)
    {
        $court = Court::findOrFail($id);

        $validated = $request->validate([
            'name'             => ['required', 'string', 'max:100'],
            'court_code'       => ['required', 'string', 'max:50', 'unique:courts,court_code,' . $court->id],
            'floor_type'       => ['nullable', 'string', 'max:100'],
            'has_lighting'     => ['boolean'],
            'capacity'         => ['nullable', 'integer'],
            'location_note'    => ['nullable', 'string', 'max:255'],
            'is_maintenance'   => ['boolean'],
            'is_contract_only' => ['boolean'],
            'status'           => ['string', 'in:active,inactive'],
        ]);

        $newStatus = $validated['status'] ?? $court->status;
        $newMaintenance = array_key_exists('is_maintenance', $validated)
            ? (bool) $validated['is_maintenance']
            : $court->is_maintenance;

        if ($newStatus === 'inactive') {
            $newMaintenance = false;
            $validated['is_maintenance'] = false;
        }

        if (($newStatus === 'inactive' || $newMaintenance) && $court->status === 'active' && !$court->is_maintenance) {
            $upcomingCount = $this->countUpcomingBookings($court->id);
            if ($upcomingCount > 0) {
                return response()->json([
                    'message' => "Sân này đang có {$upcomingCount} buổi đặt sắp tới chưa hoàn thành. Vui lòng xử lý hoặc dời lịch các buổi đó trước khi ẩn/bảo trì sân.",
                ], 422);
            }
        }

        $court->update($validated);

        return response()->json([
            'message' => 'Cập nhật thành công',
            'data'    => $court,
        ]);
    }

    /**
     * Chức năng: Xóa sân. Nếu sân chưa từng phát sinh đơn đặt nào (kể cả lịch sử) thì
     * xóa hẳn khỏi hệ thống; nếu đã từng có đơn (dù không còn buổi nào sắp tới) thì
     * chỉ chuyển trạng thái ngưng hoạt động để giữ nguyên vẹn lịch sử đặt sân.
     */
    public function destroy($id)
    {
        $court = Court::findOrFail($id);

        $upcomingCount = $this->countUpcomingBookings($court->id);
        if ($upcomingCount > 0) {
            return response()->json([
                'message' => "Không thể xóa sân đang có {$upcomingCount} buổi đặt sắp tới. Vui lòng dời hoặc hủy các buổi đó trước.",
            ], 422);
        }

        $hasHistory = $court->bookingDetails()->exists() || $court->recurringBookings()->exists();

        if (!$hasHistory) {
            $court->images()->delete();
            $court->delete();

            return response()->json(['message' => 'Đã xóa vĩnh viễn sân khỏi hệ thống.']);
        }

        $court->status = 'inactive';
        $court->is_maintenance = false;
        $court->save();

        return response()->json(['message' => 'Sân đã từng có lịch sử đặt sân nên chỉ được chuyển sang ngưng hoạt động (không xóa được) để giữ nguyên dữ liệu cũ.']);
    }

    /**
     * Lấy danh sách sân cho trang đặt lịch công khai.
     * Sân is_contract_only chỉ hiển thị cho khách có thẻ thành viên đang active.
     */
    public function getPublicCourts(Request $request)
    {
        $query = Court::where('status', 'active')
            ->where('is_maintenance', false)
            ->with(['images' => fn($q) => $q->where('is_primary', true)])
            ->orderBy('name');

        // Kiểm tra khách có thẻ thành viên active không
        // Dùng auth('sanctum')->user() vì đây là public route (không có middleware auth)
        $hasActiveCard = $this->hasActiveMembershipCard($request->user('sanctum'));

        if (!$hasActiveCard) {
            $query->where('is_contract_only', false);
        }

        return response()->json([
            'status' => 'success',
            'data'   => $query->get(),
        ]);
    }

    private function hasActiveMembershipCard($user): bool
    {
        return $user && \App\Models\MembershipCard::where('user_id', $user->id)
            ->where('status', 'active')
            ->where('valid_to', '>=', today())
            ->exists();
    }

    /** Chức năng: Đếm tổng số booking sắp tới (đơn lẻ và định kỳ) cho một sân. */
    private function countUpcomingBookings(string $courtId): int
    {
        $singleCount = Booking::whereHas(
            'details',
            fn($q) => $q->where('court_id', $courtId)->where('booking_date', '>=', today())
        )->whereIn('status', self::ACTIVE_BOOKING_STATUSES)->count();

        $recurringCount = RecurringBooking::whereHas(
            'bookings',
            fn($q) => $q->whereHas(
                'details',
                fn($d) => $d->where('court_id', $courtId)->where('booking_date', '>=', today())
            )->whereIn('status', ['confirmed'])
        )->count();

        return $singleCount + $recurringCount;
    }
}
