<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Court;
use App\Models\Booking;
use App\Models\RecurringBooking;
use Illuminate\Http\Request;

class CourtController extends Controller
{
    private const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed', 'playing'];
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
            'name'          => ['required', 'string', 'max:100'],
            'court_code'    => ['required', 'string', 'max:50', 'unique:courts,court_code'],
            'floor_type'    => ['nullable', 'string', 'max:100'],
            'has_lighting'  => ['boolean'],
            'capacity'      => ['nullable', 'integer'],
            'location_note' => ['nullable', 'string', 'max:255'],
            'status'        => ['string', 'in:active,inactive'],
        ]);

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

    /** Chức năng: Cập nhật thông tin cấu hình và trạng thái của sân. */
    public function update(Request $request, $id)
    {
        $court = Court::findOrFail($id);

        $validated = $request->validate([
            'name'           => ['required', 'string', 'max:100'],
            'court_code'     => ['required', 'string', 'max:50', 'unique:courts,court_code,' . $court->id],
            'floor_type'     => ['nullable', 'string', 'max:100'],
            'has_lighting'   => ['boolean'],
            'capacity'       => ['nullable', 'integer'],
            'is_maintenance' => ['boolean'],
            'status'         => ['string', 'in:active,inactive'],
        ]);

        $newStatus      = $request->input('status', $court->status);
        $newMaintenance = $request->boolean('is_maintenance', $court->is_maintenance);

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

    /** Chức năng: Ngưng hoạt động sân bằng cách chuyển trạng thái thay vì xóa dữ liệu. */
    public function destroy($id)
    {
        $court = Court::findOrFail($id);

        $upcomingCount = $this->countUpcomingBookings($court->id);
        if ($upcomingCount > 0) {
            return response()->json([
                'message' => "Không thể xóa sân đang có {$upcomingCount} buổi đặt sắp tới. Vui lòng dời hoặc hủy các buổi đó trước.",
            ], 422);
        }

        $court->status = 'inactive';
        $court->save();

        return response()->json(['message' => 'Đã ngưng hoạt động sân. Lịch sử đặt sân vẫn được lưu giữ.']);
    }

    /** Chức năng: Lấy danh sách sân đang public cho khách xem và đặt lịch. */
    public function getPublicCourts()
    {
        $courts = Court::where('status', 'active')
            ->with(['images' => fn($q) => $q->where('is_primary', true)])
            ->orderBy('name')
            ->get();

        return response()->json([
            'status' => 'success',
            'data'   => $courts,
        ]);
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
            )->whereIn('status', ['pending', 'confirmed'])
        )->count();

        return $singleCount + $recurringCount;
    }
}
