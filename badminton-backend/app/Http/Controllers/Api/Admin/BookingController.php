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
use App\Models\MembershipCard;
use App\Models\Promotion;
use App\Models\RecurringBooking;
use App\Models\Refund;
use App\Models\User;
use App\Services\PaymentService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class BookingController extends Controller
{
    private const CHECK_IN_EARLY_MINUTES = 30;

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
            // Khi hủy đơn dùng thẻ: đánh dấu no_show = khách không đến → trừ ca phạt.
            // Hủy thường (khách báo trước) thì không trừ, ca được trả lại thẻ.
            'no_show' => ['nullable', 'boolean'],
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

            // No-show đơn dùng thẻ: trừ ca phạt bằng số giờ thực tế của đơn.
            $cardPenalty = null;
            if ($newStatus === 'cancelled' && $request->boolean('no_show') && $booking->membership_card_id) {
                $penaltySessions = $booking->details()->count();
                $card = \App\Models\MembershipCard::find($booking->membership_card_id);
                if ($card && $penaltySessions > 0 && $card->remainingSessions() > 0) {
                    $deduct = min($penaltySessions, $card->remainingSessions());
                    $cardPenalty = \App\Http\Controllers\Api\Admin\MembershipController::deductSessions(
                        $card,
                        $booking->id,
                        $deduct,
                        "Phạt no-show {$booking->booking_code}"
                    );
                }
            }

            $statusUpdate = ['status' => $newStatus];
            if ($newStatus === 'completed') {
                $statusUpdate['check_out_at'] = now();
                $statusUpdate['check_in_at'] = $booking->check_in_at ?? now();
            }
            $booking->update($statusUpdate);

            $reward = ($oldStatus !== 'completed' && $newStatus === 'completed')
                ? $this->rewardCustomerForCompletedBooking($booking->fresh())
                : null;

            return response()->json([
                'status' => 'success',
                'message' => $cardPenalty
                    ? "Đã hủy đơn (no-show) và trừ {$cardPenalty['sessions_deducted']} ca phạt — còn {$cardPenalty['remaining_sessions']} ca."
                    : 'Cập nhật trạng thái đơn thành công!',
                'data' => $booking->fresh(['details', 'user']),
                'reward' => $reward,
                'card_penalty' => $cardPenalty,
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

        $booking = Booking::with('details')->findOrFail($bookingId);

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

        $schedule = $this->bookingScheduleBounds($booking);
        if (!$schedule) {
            return response()->json([
                'status' => 'error',
                'message' => 'Đơn không có ca chơi hợp lệ để check-in.',
            ], 422);
        }

        $checkInOpensAt = $schedule['start']->copy()->subMinutes(self::CHECK_IN_EARLY_MINUTES);
        if (now()->lt($checkInOpensAt)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Chưa đến thời gian check-in cho ca chơi này.',
            ], 422);
        }
        if (now()->gte($schedule['end'])) {
            return response()->json([
                'status' => 'error',
                'message' => 'Ca chơi đã qua giờ kết thúc, không thể check-in.',
            ], 422);
        }

        $booking->update(['status' => 'playing', 'check_in_at' => now()]);

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

            $schedule = $this->bookingScheduleBounds($booking);
            if (!$schedule) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Đơn không có ca chơi hợp lệ để checkout.',
                ], 422);
            }
            if (now()->lt($schedule['start'])) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Chưa đến giờ bắt đầu ca chơi, không thể checkout.',
                ], 422);
            }

            // ── Phụ trội quá giờ: nếu checkout TRỄ hơn giờ kết thúc đã đặt vượt mức ân hạn
            // thì tính thêm tiền phần vượt theo giá/giờ của buổi cuối, cộng vào tiền phải thu.
            $graceMinutes = max(0, (int) (\App\Models\SystemSetting::getAll()['overtime_grace_minutes'] ?? 15));
            $lastDetail = $booking->details
                ->sortByDesc(fn($d) => Carbon::parse($d->booking_date)->format('Y-m-d') . ' ' . $d->end_time)
                ->first();
            $overtimeInfo = null;
            if ($lastDetail) {
                $bookedEnd = Carbon::parse(Carbon::parse($lastDetail->booking_date)->format('Y-m-d') . ' ' . $lastDetail->end_time);
                $lateMinutes = max(0, (int) floor((now()->timestamp - $bookedEnd->timestamp) / 60));
                $billableMinutes = max(0, $lateMinutes - $graceMinutes);
                if ($billableMinutes > 0) {
                    $rate = (float) $lastDetail->price_per_hour;
                    $overtimeFee = (int) round($billableMinutes / 60 * $rate);
                    if ($overtimeFee > 0) {
                        $lastDetail->update([
                            'overtime_minutes' => $billableMinutes,
                            'overtime_fee' => $overtimeFee,
                        ]);
                        $booking->update([
                            'subtotal_court' => $booking->subtotal_court + $overtimeFee,
                            'total_price' => $booking->total_price + $overtimeFee,
                            'remaining_amount' => $booking->remaining_amount + $overtimeFee,
                            'payment_status' => $booking->payment_status === 'paid' ? 'partially_paid' : $booking->payment_status,
                        ]);
                        $booking->refresh();
                        $overtimeInfo = ['minutes' => $billableMinutes, 'fee' => $overtimeFee];
                    }
                }
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

            $booking->update([
                'status' => 'completed',
                'check_out_at' => now(),
                'check_in_at' => $booking->check_in_at ?? now(),
            ]);

            // Trừ ca từ thẻ thành viên: trừ đúng số ca đã lên kế hoạch của đơn.
            // Đơn lẻ: card_sessions_planned = số slot; hợp đồng định kỳ/dài hạn: = số giờ của buổi
            // (1 buổi chỉ có 1 detail nên không dùng details()->count() được).
            $cardDeduction = null;
            if ($booking->membership_card_id) {
                $actualSessions = (int) ($booking->card_sessions_planned ?: $booking->details()->count());
                if ($actualSessions > 0) {
                    $card = MembershipCard::find($booking->membership_card_id);
                    if ($card && $card->isUsable()) {
                        // Không trừ quá số ca còn lại (phòng dữ liệu lệch giữa lúc đặt và lúc checkout)
                        $sessionsToDeduct = min($actualSessions, $card->remainingSessions());
                        $cardDeduction = \App\Http\Controllers\Api\Admin\MembershipController::deductSessions(
                            $card,
                            $booking->id,
                            $sessionsToDeduct,
                            "Hoàn thành {$booking->booking_code}"
                        );
                    }
                }
            }

            $overtimeMsg = $overtimeInfo
                ? " Tính phụ trội {$overtimeInfo['minutes']} phút quá giờ: +" . number_format($overtimeInfo['fee']) . "đ."
                : '';

            return response()->json([
                'status' => 'success',
                'message' => 'Checkout thành công! Ca chơi đã hoàn thành.' . $overtimeMsg,
                'data' => $booking->fresh(['details', 'user']),
                'reward' => $this->rewardCustomerForCompletedBooking($booking->fresh()),
                'card_deduction' => $cardDeduction,
                'overtime' => $overtimeInfo,
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
    /** Ưu đãi điểm khi đổi lịch: khách có >=1000 điểm được giảm 5.000đ mỗi giờ chơi. */
    private function rescheduleLoyaltyDiscount(?User $user, int|float $totalMinutes): float
    {
        if (!$user || $user->role !== 'customer' || (int) $user->points < 1000) {
            return 0;
        }

        return max(0, ($totalMinutes / 60) * 5000);
    }

    /** Giảm giá theo mã khuyến mãi (phần trăm hoặc số tiền cố định) trên tổng tiền mới. */
    private function reschedulePromotionDiscount(?Promotion $promotion, int|float $base): float
    {
        if (!$promotion || $base <= 0) {
            return 0;
        }

        if ($promotion->discount_type === 'percent') {
            return min($base, $base * ((float) $promotion->discount_value / 100));
        }

        return min($base, (float) $promotion->discount_value);
    }
    /** nhân viên đổi lịch giúp khách. */
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

            // ── Tính lại TOÀN BỘ tiền của đơn sau khi đổi lịch ──────────────────
            // Không cộng dồn chênh lệch thô nữa mà tính lại từ đầu để áp đúng
            // khuyến mãi (%/tiền) và ưu đãi điểm theo tổng số giờ mới.
            $oldTotal = (float) $booking->total_price;
            $booking->load('details');

            $subtotalCourt = (float) $booking->details->sum('price');
            $totalMinutes = (int) $booking->details->sum('duration_minutes');
            $base = $subtotalCourt + (float) $booking->subtotal_service;

            if (!empty($booking->membership_card_id)) {
                // Đơn dùng thẻ thành viên: không áp KM/điểm, giữ nguyên mức giảm đã lưu
                $discountAmount = (float) $booking->discount_amount;
            } else {
                $loyalty = $this->rescheduleLoyaltyDiscount($booking->user, $totalMinutes);
                $promotion = $booking->promotion_id ? Promotion::find($booking->promotion_id) : null;
                $promoDiscount = $this->reschedulePromotionDiscount($promotion, $base);
                $discountAmount = min($base, $loyalty + $promoDiscount);
            }

            $newTotal = max(0, $base - $discountAmount);
            $paidAmount = max(0, $oldTotal - (float) $booking->remaining_amount); // số đã thu trước đó
            $rawRemaining = $newTotal - $paidAmount;
            $overpaid = $rawRemaining < 0 ? abs($rawRemaining) : 0.0;
            $newRemaining = max(0, $rawRemaining);

            // Tính lại trạng thái thanh toán cho khớp số còn nợ sau khi đổi lịch
            if ($newRemaining <= 0) {
                $newPaymentStatus = 'paid';
            } elseif ($paidAmount > 0) {
                $newPaymentStatus = 'partially_paid';
            } else {
                $newPaymentStatus = 'unpaid';
            }

            $booking->update([
                'subtotal_court' => $subtotalCourt,
                'discount_amount' => $discountAmount,
                'total_price' => $newTotal,
                'remaining_amount' => $newRemaining,
                'payment_status' => $newPaymentStatus,
            ]);

            // Điểm 3: nếu đổi lịch làm giảm giá khiến khách đã trả DƯ tiền → ghi nhận
            // phiếu hoàn tiền (trạng thái "recorded") để nhân viên hoàn cho khách.
            if ($overpaid > 0) {
                Refund::create([
                    'payment_id' => null,
                    'amount' => $overpaid,
                    'reason' => "Đổi lịch làm giảm giá đơn {$booking->booking_code}, hoàn phần chênh cho khách.",
                    'refund_method' => 'cash',
                    'processed_by' => optional(request()->user())->id,
                    'status' => 'recorded',
                ]);
            }

            $diff = $newTotal - $oldTotal;
            if ($overpaid > 0) {
                $priceMsg = 'Giá giảm, khách đã trả dư ' . number_format($overpaid) . 'đ — đã ghi nhận phiếu hoàn tiền.';
            } elseif ($diff > 0) {
                $priceMsg = 'Giá tăng ' . number_format($diff) . 'đ, khách cần thanh toán thêm phần chênh lệch.';
            } elseif ($diff < 0) {
                $priceMsg = 'Giá giảm ' . number_format(abs($diff)) . 'đ so với trước.';
            } else {
                $priceMsg = 'Giá không đổi.';
            }

            return response()->json([
                'status' => 'success',
                'message' => 'Đổi lịch thành công! ' . $priceMsg,
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
                    'status' => 'error',
                    'message' => 'Không thể thêm dịch vụ/sản phẩm cho đơn đã hoàn thành hoặc đã hủy.',
                ], 422);
            }

            $quantity = $validated['quantity'];
            $productId = null;
            $serviceId = null;

            if ($validated['type'] === 'product') {
                $product = Product::lockForUpdate()->findOrFail($validated['item_id']);

                if ($product->status !== 'active') {
                    throw ValidationException::withMessages([
                        'item_id' => "Sản phẩm {$product->name} hiện đang tạm ngưng.",
                    ]);
                }
                if ($product->stock_quantity < $quantity) {
                    throw ValidationException::withMessages([
                        'quantity' => "Sản phẩm chỉ còn {$product->stock_quantity} trong kho.",
                    ]);
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
                if ($service->status !== 'active') {
                    throw ValidationException::withMessages([
                        'item_id' => "Dịch vụ {$service->name} hiện đang tạm ngưng.",
                    ]);
                }
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
                    'status' => 'error',
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

                    if ($product->status !== 'active') {
                        throw ValidationException::withMessages([
                            'items' => "Sản phẩm {$product->name} hiện đang tạm ngưng.",
                        ]);
                    }
                    if ($product->stock_quantity < $quantity) {
                        throw ValidationException::withMessages([
                            'items' => "Sản phẩm {$product->name} chỉ còn {$product->stock_quantity} trong kho.",
                        ]);
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
                        throw ValidationException::withMessages([
                            'items' => "Dịch vụ {$service->name} hiện đang tạm ngưng.",
                        ]);
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
     * @return array{start: Carbon, end: Carbon}|null
     */
    private function bookingScheduleBounds(Booking $booking): ?array
    {
        $booking->loadMissing('details');
        if ($booking->details->isEmpty()) {
            return null;
        }

        $starts = $booking->details->map(
            fn($detail) => Carbon::parse(
                Carbon::parse($detail->booking_date)->format('Y-m-d') . ' ' . $detail->start_time
            )
        );
        $ends = $booking->details->map(
            fn($detail) => Carbon::parse(
                Carbon::parse($detail->booking_date)->format('Y-m-d') . ' ' . $detail->end_time
            )
        );

        return ['start' => $starts->min(), 'end' => $ends->max()];
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
    private function internalCalculatePrice(string $courtId, string $date, string $start, string $end): float // $courtId giữ để tương thích call sites
    {
        $dayType = (date('N', strtotime($date)) >= 6) ? 'weekend' : 'weekday';

        $pricings = CourtPricing::where('day_type', $dayType)
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
