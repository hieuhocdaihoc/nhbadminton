<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\RecurringBooking;
use Carbon\Carbon;
use Illuminate\Http\Request;
use App\Models\Product;
use App\Models\AdditionalService;
use App\Models\BookingServiceDetail;
use App\Models\InventoryTransaction;
use Illuminate\Support\Facades\DB;
use App\Services\PaymentService;
use Illuminate\Support\Str;
use App\Models\User;

class BookingController extends Controller
{
    //xem  danh sách các ca chơi hôm nay (dành cho lễ tân)
    /**
     * Chức năng: Lấy danh sách các đơn có ca chơi trong ngày hiện tại cho lễ tân/admin theo dõi.
     */
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
    // API ADMIN: Xem danh sách các ca chơi lẻ (không theo lịch đặt định kỳ)
    /**
     * Chức năng: Lấy danh sách đơn đặt sân lẻ, có hỗ trợ tìm theo tên, số điện thoại hoặc mã đơn.
     */
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


    // API ADMIN: Xem danh sách các lịch đặt định kỳ (Recurring Booking Masters)
    /**
     * Chức năng: Lấy danh sách hợp đồng/lịch đặt định kỳ gốc để quản lý lịch cố định.
     */
    public function getRecurringMasters(Request $request)
    {
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



    // API ADMIN: Xem chi tiết các buổi chơi con của một lịch đặt định kỳ
    /**
     * Chức năng: Lấy các buổi chơi con thuộc một lịch đặt định kỳ.
     */
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


    /**
     * -------------------------------------------------------------
     * CẬP NHẬT TRẠNG THÁI ĐƠN ĐẶT SÂN
     * -------------------------------------------------------------
     */
    /**
     * Chức năng: Cập nhật trạng thái đơn đặt sân và kích hoạt cộng điểm khi đơn completed + paid.
     */
    public function updateStatus(Request $request, $bookingId)
    {
        $request->validate([
            'status' => 'required|in:pending,confirmed,cancelled,completed',
        ]);

        return DB::transaction(function () use ($request, $bookingId) {
            // Khoa don de tranh cong diem hai lan neu nhieu nhan vien cap nhat cung luc.
            $booking = Booking::with('details')->lockForUpdate()->findOrFail($bookingId);
            $oldStatus = $booking->status;

            if ($request->status === 'completed' && $booking->payment_status !== 'paid') {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Chỉ có thể hoàn thành đơn sau khi khách đã thanh toán đủ.',
                ], 422);
            }

            $booking->status = $request->status;
            $booking->save();

            $reward = null;

            if ($oldStatus !== 'completed' && $booking->status === 'completed') {
                $reward = $this->rewardCustomerForCompletedBooking($booking);
            }

            return response()->json([
                'status' => 'success',
                'message' => 'Cap nhat trang thai don thanh cong!',
                'data' => $booking->fresh(['details', 'user']),
                'reward' => $reward,
            ]);
        });
    }

    /**
     * Cong diem thanh vien sau khi don hoan thanh.
     *
     * Quy tac hien tai: moi 1 gio choi duoc 10 diem. Diem duoc tinh theo
     * tong duration_minutes cua cac ca san trong booking.
     */
    /**
     * Chức năng: Cộng điểm thành viên cho khách sau khi đơn đã hoàn thành và đã thanh toán, đồng thời chống cộng trùng.
     */
    private function rewardCustomerForCompletedBooking(Booking $booking): ?array
    {
        if ($booking->points_awarded_at !== null) {
            return null;
        }

        if ($booking->status !== 'completed' || $booking->payment_status !== 'paid') {
            return null;
        }

        $totalMinutes = $this->calculateBookingPlayMinutes($booking);
        $earnedPoints = (int) floor($totalMinutes / 60 * 10);

        if ($earnedPoints <= 0) {
            return null;
        }

        $normalizedPhone = preg_replace('/\D+/', '', (string) $booking->customer_phone);
        $user = $booking->user_id
            ? User::lockForUpdate()->find($booking->user_id)
            : User::where('role', 'customer')
                ->where(function ($query) use ($booking, $normalizedPhone) {
                    $query->where('phone', $booking->customer_phone);

                    if ($normalizedPhone !== '') {
                        $query->orWhere('phone', $normalizedPhone);
                    }
                })
                ->lockForUpdate()
                ->first();

        if (!$user || $user->role !== 'customer') {
            return null;
        }

        if (!$booking->user_id) {
            $booking->user_id = $user->id;
            $booking->save();
        }

        $user->points = (int) $user->points + $earnedPoints;
        $user->total_spent = (float) $user->total_spent + (float) $booking->total_price;
        $user->membership_level = $this->resolveMembershipLevel((int) $user->points);
        $user->save();

        $booking->points_awarded_at = now();
        $booking->save();

        return [
            'user_id' => $user->id,
            'earned_points' => $earnedPoints,
            'current_points' => (int) $user->points,
            'membership_level' => $user->membership_level,
        ];
    }

    /**
     * Chức năng: Mô tả nghiệp vụ của hàm calculateBookingPlayMinutes.
     */
    private function calculateBookingPlayMinutes(Booking $booking): int
    {
        return (int) $booking->details->sum(function ($detail) {
            if ((int) $detail->duration_minutes > 0) {
                return (int) $detail->duration_minutes;
            }

            if ($detail->start_time && $detail->end_time) {
                return max(0, Carbon::parse($detail->end_time)->diffInMinutes(Carbon::parse($detail->start_time)));
            }

            return 0;
        });
    }

    /**
     * Chức năng: Xác định hạng thành viên dựa trên tổng điểm tích lũy hiện tại.
     */
    private function resolveMembershipLevel(int $points): string
    {
        if ($points >= 3000) {
            return 'Vang';
        }

        if ($points >= 1000) {
            return 'Bac';
        }

        return 'Dong';
    }
    /**
     * -------------------------------------------------------------
     * XÁC NHẬN THANH TOÁN ĐƠN ĐẶT SÂN
     * -------------------------------------------------------------
     */
    /**
     * Chức năng: Cập nhật trạng thái thanh toán thủ công tại quầy và ghi nhận payment tiền mặt.
     */
    public function updatePayment(Request $request, $bookingId)
    {
        $request->validate([
            'payment_status' => 'required|in:unpaid,partially_paid,paid',
        ]);

        return DB::transaction(function () use ($request, $bookingId) {

            $booking = Booking::with('details')->lockForUpdate()->findOrFail($bookingId);

            /**
             * Trường hợp lễ tân xác nhận khách đã thanh toán đủ
             */
            if ($request->payment_status === 'paid') {

                // Số tiền khách cần trả tại quầy
                $cashAmount = $booking->remaining_amount;

                // Nếu đơn đã thanh toán đủ rồi thì không tạo thêm payment nữa
                if ($cashAmount <= 0) {
                    return response()->json([
                        'status' => 'error',
                        'message' => 'Đơn này đã thanh toán đủ, không cần xác nhận thêm!'
                    ], 400);
                }

                app(PaymentService::class)->recordSuccessfulPayment($booking, [
                    'payment_code' => 'PAY-' . now()->format('YmdHis') . '-' . strtoupper(Str::random(6)),
                    'payment_method' => 'cash',
                    'amount' => $cashAmount,
                    'paid_at' => now(),
                    'reference_code' => $booking->booking_code ?? null,
                    'payment_content' => 'Lễ tân xác nhận khách thanh toán tiền mặt tại quầy',
                ]);
            }

            /**
             * Trường hợp đưa về chưa thanh toán
             */
            if ($request->payment_status === 'unpaid') {
                $booking->payment_status = 'unpaid';
                $booking->deposit_amount = 0;
                $booking->remaining_amount = $booking->total_price;
            }

            /**
             * Trường hợp thanh toán một phần
             */
            if ($request->payment_status === 'partially_paid') {
                $booking->payment_status = 'partially_paid';
            }

            $booking->save();

            return response()->json([
                'status' => 'success',
                'message' => 'Cập nhật thanh toán thành công!',
                'data' => $booking->fresh(['details', 'user']),
                'reward' => null,
            ]);
        });
    }









    // =========================================================================
    // API ADMIN: Đổi lịch (Ngày, Giờ, Sân) cho một ca chơi cụ thể
    // =========================================================================
    /**
     * Chức năng: Đổi ngày, giờ hoặc sân cho một chi tiết ca chơi sau khi kiểm tra trùng lịch.
     */
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
    // Hàm tính giá nội bộ dựa trên bảng Court_Pricing (có tính đến ngày hiệu lực và loại ngày)
    /**
     * Chức năng: Tính tiền sân nội bộ theo ngày chơi, khung giờ và bảng giá đang áp dụng.
     */
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
    /**
     * Chức năng: Tìm kiếm nhanh đơn đặt sân theo mã đơn, tên khách hoặc số điện thoại.
     */
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
    /**
     * Chức năng: Thêm một sản phẩm hoặc dịch vụ phát sinh vào bill của đơn đặt sân.
     */
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

            // 2. Cộng dồn tiền dịch vụ vào bill
            $newSubtotalService = (float) $booking->subtotal_service + $totalPrice;
            $newTotalPrice = (float) $booking->total_price + $totalPrice;
            $newRemainingAmount = (float) $booking->remaining_amount + $totalPrice;

            // Nếu phát sinh thêm dịch vụ thì số tiền đó là khoản còn phải thu
            $booking->update([
                'subtotal_service' => $newSubtotalService,
                'total_price' => $newTotalPrice,
                'remaining_amount' => $newRemainingAmount,
                'payment_status' => $newRemainingAmount > 0 ? 'partially_paid' : 'paid',
            ]);

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
    /**
     * Chức năng: Thêm nhiều sản phẩm/dịch vụ phát sinh vào bill trong một lần thao tác.
     */
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
            $newSubtotalService = (float) $booking->subtotal_service + $totalAddedAmount;
            $newTotalPrice = (float) $booking->total_price + $totalAddedAmount;
            $newRemainingAmount = (float) $booking->remaining_amount + $totalAddedAmount;

            // Khi thêm Pro-shop, phần tiền phát sinh này phải được cộng vào tiền còn phải thu.
            // Nếu trước đó khách đã trả tiền sân rồi, hệ thống sẽ chuyển sang partially_paid.
            $booking->update([
                'subtotal_service' => $newSubtotalService,
                'total_price' => $newTotalPrice,
                'remaining_amount' => $newRemainingAmount,
                'payment_status' => $newRemainingAmount > 0 ? 'partially_paid' : 'paid',
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
