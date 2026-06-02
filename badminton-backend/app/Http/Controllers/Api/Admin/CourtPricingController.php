<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\CourtPricing;
use Illuminate\Http\Request;

class CourtPricingController extends Controller
{
    // 1. Lấy toàn bộ danh sách cấu hình giá
    /**
     * Chức năng: Lấy danh sách bảng giá sân theo sân, loại ngày và khung giờ.
     */
    public function index()
    {
        $pricings = CourtPricing::with('court:id,name')
            ->orderBy('court_id')
            ->orderBy('start_time')
            ->get();

        return response()->json([
            'message' => 'Danh sách bảng giá theo khung giờ',
            'data' => $pricings
        ]);
    }

    // 2. Thêm cấu hình giá mới
    /**
     * Chức năng: Tạo mới khung giá sân sau khi validate dữ liệu thời gian và giá.
     */
    public function store(Request $request)
    {
        $request->validate([
            'court_id' => 'required|exists:courts,id',
            'day_type' => 'required|in:weekday,weekend,holiday',
            'start_time' => 'required|date_format:H:i|before:end_time',
            'end_time' => 'required|date_format:H:i',
            'price' => 'required|numeric|min:0',
            'effective_from' => 'nullable|date',
            'effective_to' => 'nullable|date|after_or_equal:effective_from',
            'min_booking_minutes' => 'integer|min:30'
        ]);

        $pricing = CourtPricing::create($request->all());

        return response()->json([
            'message' => 'Thêm khung giờ giá thành công',
            'data' => $pricing
        ], 201);
    }

    // 3. Xem chi tiết 1 cấu hình giá
    /**
     * Chức năng: Lấy chi tiết một cấu hình giá sân.
     */
    public function show($id)
    {
        $pricing = CourtPricing::with('court:id,name')->find($id);

        if (!$pricing) {
            return response()->json(['message' => 'Không tìm thấy cấu hình giá'], 404);
        }

        return response()->json(['data' => $pricing]);
    }

    // 4. Cập nhật giá hoặc khung giờ
    /**
     * Chức năng: Cập nhật bảng giá sân.
     */
    public function update(Request $request, $id)
    {
        $pricing = CourtPricing::find($id);

        if (!$pricing) {
            return response()->json(['message' => 'Không tìm thấy cấu hình giá'], 404);
        }

        $request->validate([
            'court_id' => 'required|exists:courts,id',
            'day_type' => 'required|in:weekday,weekend,holiday',
            'start_time' => 'required|date_format:H:i|before:end_time',
            'end_time' => 'required|date_format:H:i',
            'price' => 'required|numeric|min:0',
            'effective_from' => 'nullable|date',
            'effective_to' => 'nullable|date|after_or_equal:effective_from',
            'min_booking_minutes' => 'integer|min:30'
        ]);

        $pricing->update($request->all());

        return response()->json([
            'message' => 'Cập nhật bảng giá thành công',
            'data' => $pricing
        ]);
    }

    // 5. Xóa cấu hình giá
    /**
     * Chức năng: Xóa cấu hình giá sân không còn áp dụng.
     */
    public function destroy($id)
    {
        $pricing = CourtPricing::find($id);

        if (!$pricing) {
            return response()->json(['message' => 'Không tìm thấy cấu hình giá'], 404);
        }

        $pricing->delete();

        return response()->json(['message' => 'Đã xóa cấu hình giá khỏi hệ thống']);
    }

    // Hàm tính tiền cộng dồn thông minh (Đã xử lý lỗi ghi đè giá)
    /**
     * Chức năng: Tính thử giá thuê sân theo sân, ngày và khung giờ khách chọn.
     */
    public function calculatePrice(Request $request)
    {
        $request->validate([
            'court_id' => 'required|exists:courts,id',
            'date' => 'required|date',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
        ]);

        $bookingDate = $request->date;
        $dayOfWeek = date('N', strtotime($bookingDate));
        $dayType = ($dayOfWeek >= 6) ? 'weekend' : 'weekday';

        $pricings = CourtPricing::where('court_id', $request->court_id)
            ->where('day_type', $dayType)
            ->where(function ($query) use ($bookingDate) {
                $query->whereNull('effective_from')->orWhere('effective_from', '<=', $bookingDate);
            })
            ->where(function ($query) use ($bookingDate) {
                $query->whereNull('effective_to')->orWhere('effective_to', '>=', $bookingDate);
            })
            // ƯU TIÊN: Sắp xếp dòng có effective_from TRƯỚC (giá đặc biệt), NULL sau cùng
            ->orderByRaw('effective_from DESC')
            ->get();

        $totalPrice = 0;
        $details = [];
        $filled_slots = []; // Mảng dùng để đánh dấu giờ nào đã được tính tiền rồi

        foreach ($pricings as $pricing) {
            $dbStart = substr($pricing->start_time, 0, 5);
            $dbEnd = substr($pricing->end_time, 0, 5);

            $overlapStart = max($request->start_time, $dbStart);
            $overlapEnd = min($request->end_time, $dbEnd);

            if ($overlapStart < $overlapEnd) {
                // KIỂM TRA ƯU TIÊN: Nếu đoạn thời gian này chưa được tính tiền bởi giá đặc biệt
                // (Vì chúng ta đã orderBy nên giá đặc biệt sẽ nhảy vào đây trước)
                $slotKey = $overlapStart . '-' . $overlapEnd;

                if (!isset($filled_slots[$slotKey])) {
                    $minutes = (strtotime($overlapEnd) - strtotime($overlapStart)) / 60;
                    $amount = ($minutes / 60) * $pricing->price;

                    $totalPrice += $amount;
                    $details[] = [
                        'khung_gia' => "$dbStart - $dbEnd",
                        'loai_gia' => $pricing->effective_from ? 'Giá thời vụ' : 'Giá mặc định',
                        'thanh_tien' => round($amount, 2)
                    ];

                    $filled_slots[$slotKey] = true; // Đánh dấu đã tính tiền cho đoạn này
                }
            }
        }

        return response()->json([
            'status' => 'success',
            'total_price' => round($totalPrice, 2),
            'details' => $details
        ]);
    }



    // API PUBLIC: Lấy bảng giá chi tiết của 1 sân cụ thể cho Khách hàng xem
    /**
     * Chức năng: Trả bảng giá public của một sân cho frontend khách hàng.
     */
    public function getPublicPricing($courtId)
    {
        $pricings = CourtPricing::where('court_id', $courtId)
            ->orderBy('day_type')
            ->orderBy('start_time')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $pricings
        ]);
    }
}