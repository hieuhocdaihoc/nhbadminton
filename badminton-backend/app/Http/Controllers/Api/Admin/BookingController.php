<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdditionalService;
use App\Models\Booking;
use App\Models\BookingDetail;
use App\Models\BookingServiceDetail;
use App\Models\Court;
use App\Models\CourtPricing;
use App\Models\InventoryTransaction;
use App\Models\Product;
use App\Models\RecurringBooking;
use App\Models\User;
use App\Services\PaymentService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class BookingController extends Controller
{
    private const ALLOWED_TRANSITIONS = [
        'confirmed' => ['cancelled'],
        'playing' => ['completed'],
        'completed' => [],
        'cancelled' => [],
    ];

    // Ngưỡng điểm phân hạng thành viên
    private const MEMBERSHIP_LEVELS = [
        3000 => 'Vang',
        1000 => 'Bac',
        0 => 'Dong',
    ];

    /**
     * Chức năng: Lấy danh sách tất cả đơn có buổi chơi vào ngày hôm nay (dành cho lễ tân).
     */
    public function getTodayBookings()
    {
        $today = now()->format('Y-m-d');

        $bookings = Booking::whereHas('details', fn($q) => $q->where('booking_date', $today))
            ->with(['details.court', 'serviceDetails.product', 'serviceDetails.service'])
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'status' => 'success',
            'count' => $bookings->count(),
            'data' => $bookings,
        ]);
    }

    /**
     * Chức năng: Lấy danh sách đơn đặt lẻ (không thuộc hợp đồng định kỳ/dài hạn), hỗ trợ tìm kiếm.
     */
    public function getSingleBookings(Request $request)
    {
        $query = Booking::whereNull('recurring_booking_id')->with(['details.court']);

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(
                fn($q) => $q
                    ->where('customer_name', 'like', "%{$search}%")
                    ->orWhere('customer_phone', 'like', "%{$search}%")
                    ->orWhere('booking_code', 'like', "%{$search}%")
            );
        }

        return response()->json($query->orderByDesc('created_at')->paginate(15));
    }

    /**
     * Chức năng: Lấy danh sách hợp đồng đặt sân định kỳ (lặp hàng tuần), hỗ trợ tìm kiếm.
     */
    public function getRecurringMasters(Request $request)
    {
        return response()->json($this->queryContractMasters('recurring', $request)->paginate(15));
    }

    /**
     * Chức năng: Lấy danh sách hợp đồng đặt sân dài hạn (tự chọn ngày), hỗ trợ tìm kiếm.
     */
    public function getLongTermMasters(Request $request)
    {
        return response()->json($this->queryContractMasters('long_term', $request)->paginate(15));
    }

    /**
     * Chức năng: Xây dựng query chung cho danh sách hợp đồng (recurring hoặc long_term).
     */
    private function queryContractMasters(string $type, Request $request)
    {
        $query = RecurringBooking::with(['court', 'user'])->where('type', $type);

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(
                fn($q) => $q
                    ->where('recurring_code', 'like', "%{$search}%")
                    ->orWhereHas(
                        'user',
                        fn($u) => $u
                            ->where('full_name', 'like', "%{$search}%")
                            ->orWhere('phone', 'like', "%{$search}%")
                    )
            );
        }

        return $query->orderByDesc('start_date');
    }

    /**
     * Chức năng: Lấy danh sách tất cả buổi chơi con thuộc một hợp đồng định kỳ/dài hạn.
     */
    public function getRecurringSessions(Request $request, $recurringId)
    {
        $query = Booking::where('recurring_booking_id', $recurringId)->with(['details.court']);

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(
                fn($q) => $q
                    ->where('customer_name', 'like', "%{$search}%")
                    ->orWhere('customer_phone', 'like', "%{$search}%")
                    ->orWhere('booking_code', 'like', "%{$search}%")
            );
        }

        return response()->json([
            'status' => 'success',
            'data' => $query->orderBy('created_at')->get(),
        ]);
    }

    /**
     * Chức năng: Tìm kiếm đơn đặt sân theo từ khóa, ngày chơi, trạng thái và tình trạng thanh toán.
     */
    public function searchBookings(Request $request)
    {
        $query = Booking::with(['details'])->orderByDesc('created_at');

        if ($request->filled('keyword')) {
            $kw = $request->keyword;
            $query->where(
                fn($q) => $q
                    ->where('customer_phone', 'like', "%{$kw}%")
                    ->orWhere('customer_name', 'like', "%{$kw}%")
                    ->orWhere('booking_code', 'like', "%{$kw}%")
            );
        }

        if ($request->filled('play_date')) {
            $query->whereHas('details', fn($q) => $q->where('booking_date', $request->play_date));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('payment_status')) {
            $query->where('payment_status', $request->payment_status);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Kết quả tìm kiếm',
            'data' => $query->paginate(15),
        ]);
    }

    /**
     * Chức năng: Chuyển trạng thái đơn (pending→confirmed, confirmed→cancelled...) theo quy tắc nghiệp vụ.
     */
    public function updateStatus(Request $request, $bookingId)
    {
        $request->validate([
            'status' => ['required', 'in:pending,confirmed,cancelled,completed'],
        ]);

        return DB::transaction(function () use ($request, $bookingId) {
            $booking = Booking::with('details')->lockForUpdate()->findOrFail($bookingId);
            $oldStatus = $booking->status;
            $newStatus = $request->status;

            $allowed = self::ALLOWED_TRANSITIONS[$oldStatus] ?? [];
            if (!in_array($newStatus, $allowed, true)) {
                return response()->json([
                    'status' => 'error',
                    'message' => "Không thể chuyển từ trạng thái '{$oldStatus}' sang '{$newStatus}'.",
                ], 422);
            }

            if ($newStatus === 'completed' && $booking->payment_status !== 'paid') {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Chỉ có thể hoàn thành đơn sau khi khách đã thanh toán đủ.',
                ], 422);
            }

            $booking->update(['status' => $newStatus]);

            $reward = ($oldStatus !== 'completed' && $newStatus === 'completed')
                ? $this->rewardCustomerForCompletedBooking($booking->fresh())
                : null;

            return response()->json([
                'status' => 'success',
                'message' => 'Cập nhật trạng thái đơn thành công!',
                'data' => $booking->fresh(['details', 'user']),
                'reward' => $reward,
            ]);
        });
    }

    /**
     * Chức năng: Xác minh SĐT + mã đơn rồi chuyển đơn sang trạng thái đang chơi (playing).
     */
    public function checkIn(Request $request, $bookingId)
    {
        $request->validate([
            'phone' => ['required', 'string'],
            'booking_code' => ['required', 'string'],
        ]);

        $booking = Booking::findOrFail($bookingId);

        if ($booking->status !== 'confirmed') {
            $label = match ($booking->status) {
                'pending' => 'chưa được duyệt',
                'playing' => 'đang trong ca chơi',
                'completed' => 'đã hoàn thành',
                'cancelled' => 'đã bị hủy',
                default => 'không hợp lệ',
            };
            return response()->json([
                'status' => 'error',
                'message' => "Không thể check-in: đơn {$label}.",
            ], 422);
        }

        $phoneMatch = preg_replace('/\D/', '', $booking->customer_phone) === preg_replace('/\D/', '', $request->phone);
        $codeMatch = strtoupper(trim($booking->booking_code)) === strtoupper(trim($request->booking_code));

        if (!$phoneMatch || !$codeMatch) {
            return response()->json([
                'status' => 'error',
                'message' => 'Số điện thoại hoặc mã đơn không khớp. Vui lòng kiểm tra lại.',
            ], 422);
        }

        $booking->update(['status' => 'playing']);

        return response()->json([
            'status' => 'success',
            'message' => 'Check-in thành công! Khách đã vào sân.',
            'data' => $booking->fresh(['details', 'user']),
        ]);
    }

    /**
     * Chức năng: Thu tiền còn lại rồi hoàn thành đơn trong một bước (dành cho lễ tân cuối ca).
     */
    public function checkout(Request $request, $bookingId)
    {
        return DB::transaction(function () use ($bookingId) {
            $booking = Booking::with('details')->lockForUpdate()->findOrFail($bookingId);

            if (!in_array($booking->status, ['playing', 'confirmed'], true)) {
                $label = match ($booking->status) {
                    'pending' => 'chưa được duyệt',
                    'completed' => 'đã hoàn thành',
                    'cancelled' => 'đã bị hủy',
                    default => 'không hợp lệ',
                };
                return response()->json([
                    'status' => 'error',
                    'message' => "Không thể checkout: đơn {$label}.",
                ], 422);
            }

            if ($booking->remaining_amount > 0 && $booking->payment_status !== 'paid') {
                app(PaymentService::class)->recordSuccessfulPayment($booking, [
                    'payment_code' => 'PAY-' . now()->format('YmdHis') . '-' . strtoupper(Str::random(6)),
                    'payment_method' => 'cash',
                    'amount' => $booking->remaining_amount,
                    'paid_at' => now(),
                    'reference_code' => $booking->booking_code,
                    'payment_content' => 'Thu tiền cuối ca tại quầy',
                ]);
                $booking->refresh();
            }

            $booking->update(['status' => 'completed']);

            return response()->json([
                'status' => 'success',
                'message' => 'Checkout thành công! Ca chơi đã hoàn thành.',
                'data' => $booking->fresh(['details', 'user']),
                'reward' => $this->rewardCustomerForCompletedBooking($booking->fresh()),
            ]);
        });
    }

    /**
     * Chức năng: Xác nhận thanh toán tại quầy (tiền mặt) hoặc điều chỉnh trạng thái thanh toán của đơn.
     */
    public function updatePayment(Request $request, $bookingId)
    {
        $request->validate([
            'payment_status' => ['required', 'in:unpaid,partially_paid,paid'],
        ]);

        return DB::transaction(function () use ($request, $bookingId) {
            $booking = Booking::with('details')->lockForUpdate()->findOrFail($bookingId);

            if ($booking->status === 'cancelled') {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Không thể cập nhật thanh toán cho đơn đã bị hủy.',
                ], 422);
            }

            if ($request->payment_status === 'paid') {
                $cashAmount = $booking->remaining_amount;
                if ($cashAmount <= 0) {
                    return response()->json([
                        'status' => 'error',
                        'message' => 'Đơn này đã thanh toán đủ, không cần xác nhận thêm!',
                    ], 400);
                }

                app(PaymentService::class)->recordSuccessfulPayment($booking, [
                    'payment_code' => 'PAY-' . now()->format('YmdHis') . '-' . strtoupper(Str::random(6)),
                    'payment_method' => 'cash',
                    'amount' => $cashAmount,
                    'paid_at' => now(),
                    'reference_code' => $booking->booking_code,
                    'payment_content' => 'Lễ tân xác nhận khách thanh toán tiền mặt tại quầy',
                ]);
            }

            if ($request->payment_status === 'unpaid') {
                $booking->update([
                    'payment_status' => 'unpaid',
                    'deposit_amount' => 0,
                    'remaining_amount' => $booking->total_price,
                ]);
            }

            if ($request->payment_status === 'partially_paid') {
                $booking->update(['payment_status' => 'partially_paid']);
            }

            return response()->json([
                'status' => 'success',
                'message' => 'Cập nhật thanh toán thành công!',
                'data' => $booking->fresh(['details', 'user']),
            ]);
        });
    }

    /**
     * Chức năng: Đổi ngày, giờ hoặc sân cho một buổi chơi cụ thể sau khi kiểm tra trùng lịch và tính lại giá.
     */
    public function reschedule(Request $request, $detailId)
    {
        $validated = $request->validate([
            'court_id' => ['required', 'exists:courts,id'],
            'booking_date' => ['required', 'date'],
            'start_time' => ['required', 'date_format:H:i'],
            'end_time' => ['required', 'date_format:H:i', 'after:start_time'],
        ]);

        return DB::transaction(function () use ($validated, $detailId) {
            $detail = BookingDetail::with('booking')->findOrFail($detailId);
            $booking = $detail->booking;

            if (in_array($booking->status, ['cancelled', 'completed'], true)) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Không thể đổi lịch cho đơn đã hủy hoặc hoàn thành.',
                ], 400);
            }

            if ($validated['booking_date'] < now()->format('Y-m-d')) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Ngày dời lịch phải từ hôm nay trở đi.',
                ], 422);
            }

            $targetCourt = Court::findOrFail($validated['court_id']);
            if ($targetCourt->status !== 'active' || $targetCourt->is_maintenance) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Sân này hiện không nhận đặt lịch (đang bảo trì hoặc ngưng hoạt động).',
                ], 422);
            }

            // Kiểm tra trùng lịch — bỏ qua chính buổi đang đổi
            $isBusy = BookingDetail::where('court_id', $validated['court_id'])
                ->where('booking_date', $validated['booking_date'])
                ->where('id', '!=', $detailId)
                ->where(
                    fn($q) => $q
                        ->where('start_time', '<', $validated['end_time'] . ':00')
                        ->where('end_time', '>', $validated['start_time'] . ':00')
                )
                ->whereHas('booking', fn($q) => $q->where('status', '!=', 'cancelled'))
                ->exists();

            if ($isBusy) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Lịch mới đã có người đặt, vui lòng chọn giờ/sân khác.',
                ], 400);
            }

            $newPrice = $this->internalCalculatePrice($validated['court_id'], $validated['booking_date'], $validated['start_time'], $validated['end_time']);
            $priceDiff = $newPrice - $detail->price;
            $newDuration = (strtotime($validated['end_time']) - strtotime($validated['start_time'])) / 60;

            $detail->update([
                'court_id' => $validated['court_id'],
                'booking_date' => $validated['booking_date'],
                'start_time' => $validated['start_time'] . ':00',
                'end_time' => $validated['end_time'] . ':00',
                'duration_minutes' => $newDuration,
                'price' => $newPrice,
                'price_per_hour' => $newDuration > 0 ? ($newPrice / ($newDuration / 60)) : 0,
            ]);

            $booking->update([
                'subtotal_court' => $booking->subtotal_court + $priceDiff,
                'total_price' => $booking->total_price + $priceDiff,
                'remaining_amount' => $booking->remaining_amount + $priceDiff,
            ]);

            return response()->json([
                'status' => 'success',
                'message' => 'Đổi lịch thành công! Hóa đơn đã được cập nhật giá.',
                'data' => $booking->load('details'),
            ]);
        });
    }

    /**
     * Chức năng: Thêm một sản phẩm hoặc dịch vụ phát sinh vào bill đang mở.
     */
    public function addItemToBooking(Request $request, $bookingId)
    {
        $validated = $request->validate([
            'type' => ['required', 'in:product,service'],
            'item_id' => ['required', 'string'],
            'quantity' => ['required', 'integer', 'min:1'],
            'note' => ['nullable', 'string'],
        ]);

        return DB::transaction(function () use ($validated, $bookingId, $request) {
            $booking = Booking::findOrFail($bookingId);

            if (in_array($booking->status, ['cancelled', 'completed'], true)) {
                return response()->json([
                    'status'  => 'error',
                    'message' => 'Không thể thêm dịch vụ/sản phẩm cho đơn đã hoàn thành hoặc đã hủy.',
                ], 422);
            }

            $quantity = $validated['quantity'];
            $productId = null;
            $serviceId = null;

            if ($validated['type'] === 'product') {
                $product = Product::lockForUpdate()->findOrFail($validated['item_id']);

                if ($product->stock_quantity < $quantity) {
                    throw new \Exception("Hàng hóa này chỉ còn {$product->stock_quantity} sản phẩm trong kho!");
                }

                $unitPrice = $product->selling_price;
                $productId = $product->id;
                $beforeQty = $product->stock_quantity;

                $product->decrement('stock_quantity', $quantity);
                $product->increment('sold_count', $quantity);

                InventoryTransaction::create([
                    'product_id' => $productId,
                    'transaction_type' => 'sale',
                    'quantity' => -$quantity,
                    'before_quantity' => $beforeQty,
                    'after_quantity' => $beforeQty - $quantity,
                    'reference_type' => 'booking',
                    'reference_id' => $booking->id,
                    'note' => "Bán cho hóa đơn {$booking->booking_code}",
                    'created_by' => $request->user()?->id,
                ]);
            } else {
                $service = AdditionalService::findOrFail($validated['item_id']);
                $unitPrice = $service->price;
                $serviceId = $service->id;
            }

            $totalPrice = $unitPrice * $quantity;

            $detail = BookingServiceDetail::create([
                'booking_id' => $booking->id,
                'product_id' => $productId,
                'service_id' => $serviceId,
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'total_price' => $totalPrice,
                'note' => $validated['note'] ?? null,
            ]);

            $newRemaining = (float) $booking->remaining_amount + $totalPrice;

            $booking->update([
                'subtotal_service' => (float) $booking->subtotal_service + $totalPrice,
                'total_price' => (float) $booking->total_price + $totalPrice,
                'remaining_amount' => $newRemaining,
                'payment_status' => $newRemaining > 0 ? 'partially_paid' : 'paid',
            ]);

            return response()->json([
                'status' => 'success',
                'message' => 'Đã thêm vào hóa đơn thành công!',
                'data' => $detail,
            ]);
        });
    }

    /**
     * Chức năng: Thêm nhiều sản phẩm/dịch vụ phát sinh vào bill trong một lần thao tác (batch).
     */
    public function addItemsToBooking(Request $request, $bookingId)
    {
        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.type' => ['required', 'in:product,service'],
            'items.*.item_id' => ['required', 'string'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.note' => ['nullable', 'string'],
        ]);

        return DB::transaction(function () use ($validated, $bookingId, $request) {
            $booking = Booking::lockForUpdate()->findOrFail($bookingId);

            if (in_array($booking->status, ['cancelled', 'completed'], true)) {
                return response()->json([
                    'status'  => 'error',
                    'message' => 'Không thể thêm dịch vụ/sản phẩm cho đơn đã hoàn thành hoặc đã hủy.',
                ], 422);
            }

            $createdDetails = [];
            $totalAddedAmount = 0;

            foreach ($validated['items'] as $item) {
                $quantity = $item['quantity'];
                $productId = null;
                $serviceId = null;

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
                        'created_by' => $request->user()?->id,
                    ]);
                } else {
                    $service = AdditionalService::findOrFail($item['item_id']);

                    if ($service->status === 'inactive') {
                        throw new \Exception("Dịch vụ {$service->name} hiện đang tạm ngưng.");
                    }

                    $unitPrice = $service->price;
                    $serviceId = $service->id;
                }

                $totalPrice = $unitPrice * $quantity;
                $totalAddedAmount += $totalPrice;

                $createdDetails[] = BookingServiceDetail::create([
                    'booking_id' => $booking->id,
                    'product_id' => $productId,
                    'service_id' => $serviceId,
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                    'total_price' => $totalPrice,
                    'note' => $item['note'] ?? null,
                ]);
            }

            $newRemaining = (float) $booking->remaining_amount + $totalAddedAmount;

            $booking->update([
                'subtotal_service' => (float) $booking->subtotal_service + $totalAddedAmount,
                'total_price' => (float) $booking->total_price + $totalAddedAmount,
                'remaining_amount' => $newRemaining,
                'payment_status' => $newRemaining > 0 ? 'partially_paid' : 'paid',
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

    /**
     * Chức năng: Cộng điểm thành viên cho khách sau khi đơn hoàn thành và đã thanh toán đủ, chống cộng trùng.
     */
    private function rewardCustomerForCompletedBooking(Booking $booking): ?array
    {
        if ($booking->points_awarded_at !== null)
            return null;
        if ($booking->status !== 'completed' || $booking->payment_status !== 'paid')
            return null;

        $earnedPoints = (int) floor($this->calculateBookingPlayMinutes($booking) / 60 * 10);
        if ($earnedPoints <= 0)
            return null;

        $normalizedPhone = preg_replace('/\D+/', '', (string) $booking->customer_phone);

        $user = $booking->user_id
            ? User::lockForUpdate()->find($booking->user_id)
            : User::where('role', 'customer')
                ->where(
                    fn($q) => $q
                        ->where('phone', $booking->customer_phone)
                        ->when($normalizedPhone !== '', fn($q2) => $q2->orWhere('phone', $normalizedPhone))
                )
                ->lockForUpdate()
                ->first();

        if (!$user || $user->role !== 'customer')
            return null;

        if (!$booking->user_id) {
            $booking->update(['user_id' => $user->id]);
        }

        $user->update([
            'points' => (int) $user->points + $earnedPoints,
            'total_spent' => (float) $user->total_spent + (float) $booking->total_price,
            'membership_level' => $this->resolveMembershipLevel((int) $user->points + $earnedPoints),
        ]);

        $booking->update(['points_awarded_at' => now()]);

        return [
            'user_id' => $user->id,
            'earned_points' => $earnedPoints,
            'current_points' => (int) $user->points + $earnedPoints,
            'membership_level' => $user->membership_level,
        ];
    }

    /**
     * Chức năng: Tính tổng số phút thực chơi của đơn dựa trên các buổi chơi con.
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
     * Chức năng: Xác định hạng thành viên dựa trên tổng điểm tích lũy.
     */
    private function resolveMembershipLevel(int $points): string
    {
        foreach (self::MEMBERSHIP_LEVELS as $threshold => $level) {
            if ($points >= $threshold)
                return $level;
        }
        return 'Dong';
    }

    /**
     * Chức năng: Tính giá tiền sân theo bảng giá hiệu lực tại ngày và khung giờ tương ứng.
     */
    private function internalCalculatePrice(string $courtId, string $date, string $start, string $end): float
    {
        $dayType = (date('N', strtotime($date)) >= 6) ? 'weekend' : 'weekday';

        $pricings = CourtPricing::where('court_id', $courtId)
            ->where('day_type', $dayType)
            ->where(fn($q) => $q->whereNull('effective_from')->orWhere('effective_from', '<=', $date))
            ->where(fn($q) => $q->whereNull('effective_to')->orWhere('effective_to', '>=', $date))
            ->orderByDesc('effective_from')
            ->get();

        $price = 0.0;
        $filled = [];

        foreach ($pricings as $pricing) {
            $dbS = substr($pricing->start_time, 0, 5);
            $dbE = substr($pricing->end_time, 0, 5);
            $overlapS = max($start, $dbS);
            $overlapE = min($end, $dbE);

            if ($overlapS < $overlapE) {
                $key = "{$overlapS}-{$overlapE}";
                if (!isset($filled[$key])) {
                    $price += ((strtotime($overlapE) - strtotime($overlapS)) / 3600) * $pricing->price;
                    $filled[$key] = true;
                }
            }
        }

        return $price;
    }
}
