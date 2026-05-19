<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\RecurringBooking;
use Carbon\Carbon;
use Illuminate\Http\Request;
use App\Models\Product;              // THÊM DÒNG NÀY
use App\Models\AdditionalService;    // THÊM DÒNG NÀY
use App\Models\BookingServiceDetail; // THÊM DÒNG NÀY
use App\Models\InventoryTransaction; // THÊM DÒNG NÀY
use Illuminate\Support\Facades\DB;


class BookingController extends Controller
{
    public function getTodayBookings()
    {
        $today = \Carbon\Carbon::now()->format('Y-m-d');

        $bookings = Booking::whereHas('details', function ($query) use ($today) {
            $query->where('booking_date', $today);
        })
            ->with([
                'details.court',
                'serviceDetails.product',
                'serviceDetails.service'
            ])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'status' => 'success',
            'count' => $bookings->count(),
            'data' => $bookings
        ]);
    }

    public function getSingleBookings(Request $request)
    {
        $query = Booking::whereNull('recurring_booking_id')->with(['details.court']);

        // Bắt thêm biến search từ API
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('customer_name', 'like', "%{$search}%")
                    ->orWhere('customer_phone', 'like', "%{$search}%")
                    ->orWhere('booking_code', 'like', "%{$search}%");
            });
        }

        $bookings = $query->orderBy('created_at', 'desc')->paginate(15);
        return response()->json($bookings);
    }

    public function getRecurringMasters(Request $request)
    {
        // Nạp thêm 'court' và 'user' (người đặt)
        $query = RecurringBooking::with(['court', 'user']);

        if ($request->has('search') && $request->search != '') {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('recurring_code', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($u) use ($search) {
                        $u->where('full_name', 'like', "%{$search}%")
                            ->orWhere('phone', 'like', "%{$search}%");
                    });
            });
        }

        $masters = $query->orderBy('start_date', 'desc')->paginate(15);
        return response()->json($masters);
    }

    public function getRecurringSessions(Request $request, $recurringId)
    {
        // 1. Dùng with(['details.court']) để lấy Tên sân cho từng buổi đá con
        $query = Booking::where('recurring_booking_id', $recurringId)
            ->with(['details.court']);

        // 2. TÌM KIẾM: Lọc theo tên, SĐT hoặc mã ca đá nếu có gõ tìm kiếm
        if ($request->has('search') && $request->search != '') {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('customer_name', 'like', "%{$search}%")
                    ->orWhere('customer_phone', 'like', "%{$search}%")
                    ->orWhere('booking_code', 'like', "%{$search}%");
            });
        }

        // Xếp theo ngày tạo/ngày đá để danh sách hiện ra thứ tự từ trên xuống dưới
        $sessions = $query->orderBy('created_at', 'asc')->get();

        return response()->json([
            'status' => 'success',
            'data' => $sessions
        ]);
    }

    public function updateStatus(Request $request, $bookingId)
    {
        $request->validate(['status' => 'required|in:confirmed,cancelled,completed,paid', 'payment_status' => 'nullable|in:unpaid,partially_paid,paid']);
        $booking = Booking::findOrFail($bookingId);
        $booking->status = $request->status;
        if ($request->has('payment_status')) {
            $booking->payment_status = $request->payment_status;
        }
        $booking->save();
        return response()->json(['status' => 'success', 'message' => 'Cập nhật trạng thái thành công!', 'data' => $booking]);
    }


    // =========================================================================
    // API ADMIN: Đổi lịch (Ngày, Giờ, Sân) cho một ca chơi cụ thể
    // =========================================================================
    public function reschedule(Request $request, $detailId)
    {
        // 1. Validate dữ liệu đầu vào
        $request->validate([
            'court_id' => 'required|exists:courts,id',
            'booking_date' => 'required|date',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
        ]);

        return \Illuminate\Support\Facades\DB::transaction(function () use ($request, $detailId) {

            // Tìm chi tiết ca chơi và Hóa đơn cha
            $detail = \App\Models\BookingDetail::with('booking')->findOrFail($detailId);
            $booking = $detail->booking;

            // Chặn: Không cho phép đổi lịch nếu hóa đơn đã Hủy hoặc Hoàn thành
            if (in_array($booking->status, ['cancelled', 'completed'])) {
                return response()->json(['status' => 'error', 'message' => 'Không thể đổi lịch cho đơn hàng đã Hủy hoặc Hoàn thành!'], 400);
            }

            // 2. Kiểm tra trùng lịch (BẮT BUỘC PHẢI BỎ QUA CHÍNH CA CHƠI HIỆN TẠI)
            $isBusy = \App\Models\BookingDetail::where('court_id', $request->court_id)
                ->where('booking_date', $request->booking_date)
                ->where('id', '!=', $detailId) // <--- Điểm mấu chốt: Bỏ qua ID của chính nó
                ->where(function ($q) use ($request) {
                    $q->where('start_time', '<', $request->end_time . ':00')
                        ->where('end_time', '>', $request->start_time . ':00');
                })
                ->whereHas('booking', function ($q) {
                    $q->where('status', '!=', 'cancelled');
                })->exists();

            if ($isBusy) {
                return response()->json(['status' => 'error', 'message' => 'Lịch mới đã có người đặt, vui lòng chọn giờ/sân khác!'], 400);
            }

            // 3. Tính toán lại giá tiền cho lịch mới
            $newPrice = $this->internalCalculatePrice($request->court_id, $request->booking_date, $request->start_time, $request->end_time);

            // Tính số tiền chênh lệch (Nếu đổi sang giờ rẻ hơn, chênh lệch sẽ là số ÂM)
            $priceDiff = $newPrice - $detail->price;
            $newDuration = (strtotime($request->end_time) - strtotime($request->start_time)) / 60;

            // 4. Cập nhật bảng BookingDetail (Ca chơi con)
            $detail->update([
                'court_id' => $request->court_id,
                'booking_date' => $request->booking_date,
                'start_time' => $request->start_time . ':00',
                'end_time' => $request->end_time . ':00',
                'duration_minutes' => $newDuration,
                'price' => $newPrice,
                'price_per_hour' => ($newDuration > 0) ? ($newPrice / ($newDuration / 60)) : 0,
            ]);

            // 5. Cập nhật bảng Bookings (Hóa đơn cha)
            $booking->subtotal_court += $priceDiff;
            $booking->total_price += $priceDiff;
            $booking->remaining_amount += $priceDiff;
            $booking->save();

            return response()->json([
                'status' => 'success',
                'message' => 'Đổi lịch thành công! Hóa đơn đã được cập nhật giá.',
                'data' => $booking->load('details')
            ]);
        });
    }

    private function internalCalculatePrice($courtId, $date, $start, $end)
    {
        $dayOfWeek = date('N', strtotime($date));
        $dayType = ($dayOfWeek >= 6) ? 'weekend' : 'weekday';

        $pricings = \App\Models\CourtPricing::where('court_id', $courtId)->where('day_type', $dayType)
            ->where(function ($q) use ($date) {
                $q->whereNull('effective_from')->orWhere('effective_from', '<=', $date);
            })
            ->where(function ($q) use ($date) {
                $q->whereNull('effective_to')->orWhere('effective_to', '>=', $date);
            })
            ->orderByRaw('effective_from DESC')->get();

        $price = 0;
        $filled = [];
        foreach ($pricings as $pricing) {
            $dbS = substr($pricing->start_time, 0, 5);
            $dbE = substr($pricing->end_time, 0, 5);
            $overlapS = max($start, $dbS);
            $overlapE = min($end, $dbE);
            if ($overlapS < $overlapE) {
                $key = $overlapS . '-' . $overlapE;
                if (!isset($filled[$key])) {
                    $price += ((strtotime($overlapE) - strtotime($overlapS)) / 3600) * $pricing->price;
                    $filled[$key] = true;
                }
            }
        }
        return $price;
    }
    // =========================================================================
    // API ADMIN: Tìm kiếm và Lọc hóa đơn đa năng
    // =========================================================================
    public function searchBookings(Request $request)
    {
        // Khởi tạo Query Builder nạp sẵn các ca chơi con
        $query = Booking::with(['details'])->orderBy('created_at', 'desc');

        // 1. Tìm kiếm theo Từ khóa (SĐT, Tên khách, hoặc Mã hóa đơn)
        if ($request->has('keyword') && $request->keyword != '') {
            $keyword = $request->keyword;
            $query->where(function ($q) use ($keyword) {
                $q->where('customer_phone', 'like', "%{$keyword}%")
                    ->orWhere('customer_name', 'like', "%{$keyword}%")
                    ->orWhere('booking_code', 'like', "%{$keyword}%");
            });
        }

        // 2. Lọc theo Ngày thi đấu (Tìm sâu vào bảng booking_details)
        if ($request->has('play_date') && $request->play_date != '') {
            $playDate = $request->play_date;
            $query->whereHas('details', function ($q) use ($playDate) {
                $q->where('booking_date', $playDate);
            });
        }

        // 3. Lọc theo Trạng thái đơn hàng (pending, confirmed, cancelled...)
        if ($request->has('status') && $request->status != '') {
            $query->where('status', $request->status);
        }

        // 4. Lọc theo Tình trạng thanh toán (unpaid, paid)
        if ($request->has('payment_status') && $request->payment_status != '') {
            $query->where('payment_status', $request->payment_status);
        }

        // Phân trang kết quả (15 đơn / trang)
        $bookings = $query->paginate(15);

        return response()->json([
            'status' => 'success',
            'message' => 'Kết quả tìm kiếm',
            'data' => $bookings
        ]);
    }
    // =========================================================================
    // LỄ TÂN: THÊM DỊCH VỤ / SẢN PHẨM VÀO HÓA ĐƠN ĐANG CHƠI
    // =========================================================================
    public function addItemToBooking(Request $request, $bookingId)
    {
        $request->validate([
            'type' => 'required|in:product,service', // Rẽ nhánh tại đây
            'item_id' => 'required|string', // Chứa ID của bảng Product HOẶC AdditionalService
            'quantity' => 'required|integer|min:1',
            'note' => 'nullable|string'
        ]);

        $user = $request->user('sanctum');

        return DB::transaction(function () use ($request, $bookingId, $user) {
            $booking = Booking::findOrFail($bookingId);
            $quantity = $request->quantity;
            $unitPrice = 0;
            $productId = null;
            $serviceId = null;

            // -----------------------------------------------------------------
            // RẼ NHÁNH 1: NẾU KHÁCH MUA HÀNG HÓA (CÓ TRỪ KHO)
            // -----------------------------------------------------------------
            if ($request->type === 'product') {
                $product = Product::lockForUpdate()->findOrFail($request->item_id);

                // Kiểm tra kho khắt khe
                if ($product->stock_quantity < $quantity) {
                    throw new \Exception("Hàng hóa này chỉ còn {$product->stock_quantity} sản phẩm trong kho!");
                }

                $unitPrice = $product->selling_price; // Lấy giá bán lẻ từ bảng Products
                $productId = $product->id;
                $beforeQty = $product->stock_quantity;

                // Trừ kho và tăng số lượng đã bán
                $product->decrement('stock_quantity', $quantity);
                $product->increment('sold_count', $quantity);

                // Ghi sổ cái Kho (Siêu quan trọng để chủ sân đối soát)
                InventoryTransaction::create([
                    'product_id' => $productId,
                    'transaction_type' => 'sale',
                    'quantity' => -$quantity, // Số âm vì xuất kho
                    'before_quantity' => $beforeQty,
                    'after_quantity' => $beforeQty - $quantity,
                    'reference_type' => 'booking',
                    'reference_id' => $booking->id,
                    'note' => "Bán cho hóa đơn {$booking->booking_code}",
                    'created_by' => $user ? $user->id : null,
                ]);
            }
            // -----------------------------------------------------------------
            // RẼ NHÁNH 2: NẾU KHÁCH GỌI DỊCH VỤ (KHÔNG TRỪ KHO)
            // -----------------------------------------------------------------
            else {
                $service = AdditionalService::findOrFail($request->item_id);
                $unitPrice = $service->price; // Lấy giá từ bảng Additional_Services
                $serviceId = $service->id;
            }

            // -----------------------------------------------------------------
            // ĐIỂM CHUNG: GHI VÀO BILL VÀ CỘNG TIỀN
            // -----------------------------------------------------------------
            $totalPrice = $unitPrice * $quantity;

            // 1. Ghi chi tiết vào tờ hóa đơn
            $detail = BookingServiceDetail::create([
                'booking_id' => $booking->id,
                'product_id' => $productId,  // Sẽ lưu Null nếu là service
                'service_id' => $serviceId,  // Sẽ lưu Null nếu là product
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'total_price' => $totalPrice,
                'note' => $request->note
            ]);

            // 2. Cộng dồn tiền vào tổng Bill
            $booking->increment('subtotal_service', $totalPrice);
            $booking->increment('total_price', $totalPrice);

            return response()->json([
                'status' => 'success',
                'message' => 'Đã thêm vào hóa đơn thành công!',
                'data' => $detail
            ]);
        });
    }

    // =========================================================================
// LỄ TÂN: THÊM NHIỀU DỊCH VỤ / SẢN PHẨM VÀO HÓA ĐƠN ĐANG CHƠI
// =========================================================================
    public function addItemsToBooking(Request $request, $bookingId)
    {
        $request->validate([
            'items' => 'required|array|min:1',
            'items.*.type' => 'required|in:product,service',
            'items.*.item_id' => 'required|string',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.note' => 'nullable|string',
        ]);

        $user = $request->user('sanctum');

        return DB::transaction(function () use ($request, $bookingId, $user) {
            $booking = Booking::lockForUpdate()->findOrFail($bookingId);

            $createdDetails = [];
            $totalAddedAmount = 0;

            foreach ($request->items as $item) {
                $quantity = $item['quantity'];
                $unitPrice = 0;
                $productId = null;
                $serviceId = null;

                // -------------------------------------------------------------
                // TRƯỜNG HỢP 1: SẢN PHẨM CÓ TRỪ KHO
                // -------------------------------------------------------------
                if ($item['type'] === 'product') {
                    $product = Product::lockForUpdate()->findOrFail($item['item_id']);

                    if ($product->stock_quantity < $quantity) {
                        throw new \Exception("Sản phẩm {$product->name} chỉ còn {$product->stock_quantity} trong kho.");
                    }

                    $unitPrice = $product->selling_price;
                    $productId = $product->id;

                    $beforeQty = $product->stock_quantity;
                    $afterQty = $beforeQty - $quantity;

                    $product->update([
                        'stock_quantity' => $afterQty,
                        'sold_count' => $product->sold_count + $quantity,
                    ]);

                    InventoryTransaction::create([
                        'product_id' => $productId,
                        'transaction_type' => 'sale',
                        'quantity' => -$quantity,
                        'before_quantity' => $beforeQty,
                        'after_quantity' => $afterQty,
                        'reference_type' => 'booking',
                        'reference_id' => $booking->id,
                        'note' => "Bán cho hóa đơn {$booking->booking_code}",
                        'created_by' => $user ? $user->id : null,
                    ]);
                }

                // -------------------------------------------------------------
                // TRƯỜNG HỢP 2: DỊCH VỤ KHÔNG TRỪ KHO
                // -------------------------------------------------------------
                if ($item['type'] === 'service') {
                    $service = AdditionalService::findOrFail($item['item_id']);

                    if ($service->status === 'inactive') {
                        throw new \Exception("Dịch vụ {$service->name} hiện đang tạm ngưng.");
                    }

                    $unitPrice = $service->price;
                    $serviceId = $service->id;
                }

                // -------------------------------------------------------------
                // GHI CHI TIẾT HÓA ĐƠN
                // -------------------------------------------------------------
                $totalPrice = $unitPrice * $quantity;
                $totalAddedAmount += $totalPrice;

                $detail = BookingServiceDetail::create([
                    'booking_id' => $booking->id,
                    'product_id' => $productId,
                    'service_id' => $serviceId,
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                    'total_price' => $totalPrice,
                    'note' => $item['note'] ?? null,
                ]);

                $createdDetails[] = $detail;
            }

            // -------------------------------------------------------------
            // CẬP NHẬT TỔNG TIỀN BILL SAU KHI THÊM TẤT CẢ MÓN
            // -------------------------------------------------------------
            $booking->update([
                'subtotal_service' => $booking->subtotal_service + $totalAddedAmount,
                'total_price' => $booking->total_price + $totalAddedAmount,
            ]);

            return response()->json([
                'status' => 'success',
                'message' => 'Đã thêm danh sách món vào hóa đơn thành công!',
                'data' => [
                    'booking_id' => $booking->id,
                    'total_added_amount' => $totalAddedAmount,
                    'details' => $createdDetails,
                ],
            ], 201);
        });
    }
}