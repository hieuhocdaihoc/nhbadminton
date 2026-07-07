<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\CourtPricing;
use Illuminate\Http\Request;

class CourtPricingController extends Controller
{
    private const DAY_TYPES = ['weekday', 'weekend', 'holiday'];
    private const MIN_BOOKING_MINUTES = 30;

    /** Chức năng: Lấy danh sách bảng giá sân theo sân, loại ngày và khung giờ. */
    public function index()
    {
        $pricings = CourtPricing::with('court:id,name')
            ->orderBy('court_id')
            ->orderBy('start_time')
            ->get();

        return response()->json([
            'message' => 'Danh sách bảng giá theo khung giờ',
            'data'    => $pricings,
        ]);
    }

    /** Chức năng: Tạo mới khung giá sân. */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'court_id'            => ['required', 'exists:courts,id'],
            'day_type'            => ['required', 'in:' . implode(',', self::DAY_TYPES)],
            'start_time'          => ['required', 'date_format:H:i', 'before:end_time'],
            'end_time'            => ['required', 'date_format:H:i'],
            'price'               => ['required', 'numeric', 'min:0'],
            'effective_from'      => ['nullable', 'date'],
            'effective_to'        => ['nullable', 'date', 'after_or_equal:effective_from'],
            'min_booking_minutes' => ['integer', 'min:' . self::MIN_BOOKING_MINUTES],
        ]);

        $pricing = CourtPricing::create($validated);

        return response()->json([
            'message' => 'Thêm khung giờ giá thành công',
            'data'    => $pricing,
        ], 201);
    }

    /** Chức năng: Lấy chi tiết một cấu hình giá sân. */
    public function show($id)
    {
        $pricing = CourtPricing::with('court:id,name')->findOrFail($id);

        return response()->json(['data' => $pricing]);
    }

    /** Chức năng: Cập nhật bảng giá sân. */
    public function update(Request $request, $id)
    {
        $pricing = CourtPricing::findOrFail($id);

        $validated = $request->validate([
            'court_id'            => ['required', 'exists:courts,id'],
            'day_type'            => ['required', 'in:' . implode(',', self::DAY_TYPES)],
            'start_time'          => ['required', 'date_format:H:i', 'before:end_time'],
            'end_time'            => ['required', 'date_format:H:i'],
            'price'               => ['required', 'numeric', 'min:0'],
            'effective_from'      => ['nullable', 'date'],
            'effective_to'        => ['nullable', 'date', 'after_or_equal:effective_from'],
            'min_booking_minutes' => ['integer', 'min:' . self::MIN_BOOKING_MINUTES],
        ]);

        $pricing->update($validated);

        return response()->json([
            'message' => 'Cập nhật bảng giá thành công',
            'data'    => $pricing,
        ]);
    }

    /** Chức năng: Xóa cấu hình giá sân không còn áp dụng. */
    public function destroy($id)
    {
        $pricing = CourtPricing::findOrFail($id);
        $pricing->delete();

        return response()->json(['message' => 'Đã xóa cấu hình giá khỏi hệ thống']);
    }

    /** Chức năng: Tính thử giá thuê sân theo sân, ngày và khung giờ khách chọn. */
    public function calculatePrice(Request $request)
    {
        $validated = $request->validate([
            'court_id'   => ['required', 'exists:courts,id'],
            'date'       => ['required', 'date'],
            'start_time' => ['required', 'date_format:H:i'],
            'end_time'   => ['required', 'date_format:H:i', 'after:start_time'],
        ]);

        $bookingDate = $validated['date'];
        $dayOfWeek   = date('N', strtotime($bookingDate));
        $dayType     = ($dayOfWeek >= 6) ? 'weekend' : 'weekday';

        $pricings = CourtPricing::where('court_id', $validated['court_id'])
            ->where('day_type', $dayType)
            ->where(function ($q) use ($bookingDate) {
                $q->whereNull('effective_from')->orWhere('effective_from', '<=', $bookingDate);
            })
            ->where(function ($q) use ($bookingDate) {
                $q->whereNull('effective_to')->orWhere('effective_to', '>=', $bookingDate);
            })
            ->orderByRaw('effective_from DESC')
            ->get();

        $totalPrice  = 0;
        $details     = [];
        $filledSlots = [];

        foreach ($pricings as $pricing) {
            $dbStart = substr($pricing->start_time, 0, 5);
            $dbEnd   = substr($pricing->end_time, 0, 5);

            $overlapStart = max($validated['start_time'], $dbStart);
            $overlapEnd   = min($validated['end_time'], $dbEnd);

            if ($overlapStart >= $overlapEnd) {
                continue;
            }

            $slotKey = $overlapStart . '-' . $overlapEnd;

            if (isset($filledSlots[$slotKey])) {
                continue;
            }

            $minutes     = (strtotime($overlapEnd) - strtotime($overlapStart)) / 60;
            $amount      = ($minutes / 60) * $pricing->price;
            $totalPrice += $amount;

            $details[]         = [
                'khung_gia'  => "$dbStart - $dbEnd",
                'loai_gia'   => $pricing->effective_from ? 'Giá thời vụ' : 'Giá mặc định',
                'thanh_tien' => round($amount, 2),
            ];
            $filledSlots[$slotKey] = true;
        }

        return response()->json([
            'status'      => 'success',
            'total_price' => round($totalPrice, 2),
            'details'     => $details,
        ]);
    }

    /** Chức năng: Trả bảng giá public của một sân cho frontend khách hàng. */
    public function getPublicPricing($courtId)
    {
        $pricings = CourtPricing::where('court_id', $courtId)
            ->orderBy('day_type')
            ->orderBy('start_time')
            ->get();

        return response()->json(['status' => 'success', 'data' => $pricings]);
    }
}
