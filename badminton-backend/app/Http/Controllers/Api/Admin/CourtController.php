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

    // lay danh sach san cho khu vuc quan tri
    public function index()
    {
        return response()->json([
            'message' => 'Danh sách sân hiện có',
            'data' => Court::all(),
        ]);
    }

    // tao moi san voi ma san, thong tin mat san, suc chua va trang thai van hanh
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

    // lay chi tiet mot san
    public function show($id)
    {
        return response()->json(['data' => Court::findOrFail($id)]);
    }

    // lay chi tiet san cong khai, ap dung cung quyen truy cap voi danh sach san
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

    // cap nhat thong tin cau hinh va trang thai cua san
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

    // xoa san
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

    // lay danh sach san cho trang dat lich cong khai
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

    // kiem tra khach co the thanh vien con hieu luc khong
    private function hasActiveMembershipCard($user): bool
    {
        return $user && \App\Models\MembershipCard::where('user_id', $user->id)
            ->where('status', 'active')
            ->where('valid_to', '>=', today())
            ->exists();
    }

    // dem tong so booking sap toi (don le va dinh ky) cho mot san
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
