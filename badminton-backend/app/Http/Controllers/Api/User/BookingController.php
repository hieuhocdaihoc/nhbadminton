<?php

namespace App\Http\Controllers\Api\User;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\BookingDetail;
use App\Models\BookingIntent;
use App\Models\RecurringBooking;
use App\Models\Review;
use App\Models\CourtPricing;
use App\Models\Notification;
use App\Models\Promotion;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class BookingController extends Controller
{
    // =========================================================================
    // 1. API CÔNG KHAI: Tra cứu lưới giờ khả dụng
    // =========================================================================
    /**
     * Chức năng: Tra cứu lịch trống/bận của một sân theo ngày để khách chọn khung giờ đặt.
     */
    public function getCourtAvailability(Request $request, $courtId)
    {
        $request->validate([
            'date' => 'required|date'
        ]);

        $targetDate = $request->date;
        $todayStr = now()->format('Y-m-d');

        // Không trả lịch nếu user chọn ngày quá khứ
        if ($targetDate < $todayStr) {
            return response()->json([
                'status' => 'success',
                'data' => []
            ]);
        }

        // Lấy các khung giờ đã bận, không tính đơn đã hủy
        $busySlots = BookingDetail::where('court_id', $courtId)
            ->where('booking_date', $targetDate)
            ->whereHas('booking', function ($query) {
                $query->where('status', '!=', 'cancelled');
            })
            ->get();

        // Chế độ grid dùng cho giao diện đặt sân
        if ($request->query('mode') === 'grid') {
            $dayType = (date('N', strtotime($targetDate)) >= 6) ? 'weekend' : 'weekday';

            $pricings = CourtPricing::where('court_id', $courtId)
                ->where('day_type', $dayType)
                ->orderBy('start_time')
                ->get();

            $gridSlots = [];
            $currentTimeStr = now()->format('H:i');
            $isToday = ($targetDate === $todayStr);

            foreach ($pricings as $pricing) {
                $start = Carbon::parse($pricing->start_time);
                $end = Carbon::parse($pricing->end_time);

                while ($start->copy()->addMinutes(60)->lte($end)) {
                    $slotStart = $start->format('H:i');
                    $slotEnd = $start->copy()->addMinutes(60)->format('H:i');

                    // Kiểm tra block này có bị trùng với booking nào không
                    $isBusy = $busySlots->contains(function ($b) use ($slotStart, $slotEnd) {
                        $bStart = substr($b->start_time, 0, 5);
                        $bEnd = substr($b->end_time, 0, 5);

                        return ($slotStart < $bEnd) && ($slotEnd > $bStart);
                    });

                    // Nếu là hôm nay thì khóa các giờ đã qua
                    $isPassed = $isToday && ($slotStart <= $currentTimeStr);

                    $gridSlots[] = [
                        'time_slot' => "$slotStart - $slotEnd",
                        'start_time' => $slotStart,
                        'end_time' => $slotEnd,
                        'price' => $pricing->price,
                        'is_available' => (!$isBusy && !$isPassed)
                    ];

                    $start->addMinutes(60);
                }
            }

            return response()->json([
                'status' => 'success',
                'data' => $gridSlots
            ]);
        }

        // Chế độ mặc định: trả về các khung giờ bận
        $formattedBusy = $busySlots->map(function ($item) {
            return [
                'start_time' => substr($item->start_time, 0, 5),
                'end_time' => substr($item->end_time, 0, 5),
                'type' => !is_null($item->booking->recurring_booking_id) ? 'recurring' : 'single'
            ];
        });

        return response()->json([
            'status' => 'success',
            'data' => [
                'busy_slots' => $formattedBusy
            ]
        ]);
    }

    // =========================================================================
    // 2. API CHỐT ĐẶT SÂN
    // =========================================================================
    /**
     * Chức năng: Chốt đặt sân lẻ hoặc định kỳ, tính giá, giảm giá, chống trùng lịch và tạo booking.
     */
    public function store(Request $request)
    {
        $request->validate([
            'booking_type' => 'required|in:single,recurring,long_term',
            'court_id' => 'required|exists:courts,id',
            'customer_name' => 'required|string|max:100',
            'customer_phone' => 'required|string|max:20',
            'promotion_code' => 'nullable|string|max:50',

            // Đặt lẻ
            'slots' => 'required_if:booking_type,single|array',
            'slots.*.date' => 'required_with:slots|date',
            'slots.*.start' => 'required_with:slots|date_format:H:i',
            'slots.*.end' => 'required_with:slots|date_format:H:i',

            // Đặt định kỳ
            'start_date' => 'required_if:booking_type,recurring|date',
            'end_date' => 'required_if:booking_type,recurring|date|after_or_equal:start_date',
            'days_of_week' => 'required_if:booking_type,recurring|array|min:1',
            'days_of_week.*' => 'integer|min:1|max:7',
            'start_time' => 'required_if:booking_type,recurring|date_format:H:i',
            'end_time' => 'required_if:booking_type,recurring|date_format:H:i|after:start_time',

            // Đặt dài hạn
            'lt_start_date' => 'required_if:booking_type,long_term|date',
            'lt_end_date' => 'required_if:booking_type,long_term|date|after_or_equal:lt_start_date',
            'specific_dates' => 'required_if:booking_type,long_term|array|min:1',
            'specific_dates.*' => 'date',
            'lt_start_time' => 'required_if:booking_type,long_term|date_format:H:i',
            'lt_end_time' => 'required_if:booking_type,long_term|date_format:H:i|after:lt_start_time',

            // Lễ tân tạo đơn LẺ tại quầy: số tiền khách trả trước bằng tiền mặt (không bắt buộc,
            // có thể trả một phần). Hệ thống chỉ ghi nhận số tiền, không xử lý giao dịch thanh toán nào.
            'prepaid_amount' => ['nullable', 'numeric', 'min:0'],

            // Lễ tân tạo đơn định kỳ/dài hạn thay mặt 1 khách hàng cụ thể (chọn tài khoản có sẵn).
            'on_behalf_of_user_id' => ['nullable', 'exists:users,id'],

            // Lễ tân xác nhận ĐÃ THU ĐỦ 100% tại quầy (tiền mặt/chuyển khoản cá nhân) cho hợp đồng
            // định kỳ/dài hạn — chính sách không cho thu một phần như đặt lẻ, phải đủ 100% mới tạo.
            'staff_payment_confirmed' => ['nullable', 'boolean'],

            // Người dùng đã xem và đồng ý kế hoạch điều chỉnh (đổi sân buổi trùng / bỏ buổi
            // không còn sân trống) mà API trả về ở lần gọi trước (HTTP 409).
            'accept_adjustments' => ['nullable', 'boolean'],
        ]);

        // $request->has('user_id') KHÔNG PHẢI tín hiệu tin cậy — client tự do thêm key này vào
        // JSON gửi lên. Cờ is_verified_payment chỉ được set từ code server (SePayController khi
        // gọi store() nội bộ sau khi webhook xác nhận tiền đã về), không nằm trong input của client
        // nên không thể giả mạo qua request.
        $isVerifiedPayment = (bool) $request->attributes->get('is_verified_payment', false);

        $authUser = $request->user('sanctum') ?? $request->user();
        $isStaffRequest = $authUser && in_array($authUser->role, ['admin', 'staff'], true);

        // Xác định tài khoản gắn với booking:
        // - Lễ tân tạo đơn định kỳ/dài hạn tại quầy thay mặt 1 khách hàng đã chọn.
        // - Webhook thanh toán tạo booking cho khách tự đặt (không có Sanctum session lúc đó).
        // - Khách tự đăng nhập đặt trực tiếp.
        if ($isStaffRequest && $request->filled('on_behalf_of_user_id')) {
            $user = User::find($request->on_behalf_of_user_id);
        } elseif (!$authUser && $request->has('user_id')) {
            $user = User::find($request->user_id);
        } else {
            $user = $authUser;
        }
        $userId = $user ? $user->id : null;

        // Lễ tân xác nhận đã thu đủ 100% tại quầy — chỉ có giá trị khi chính lễ tân là người gửi
        // request này (không thể tự xưng qua payload nếu không có Sanctum token hợp lệ với role đó).
        $staffConfirmedFullPayment = $isStaffRequest && $request->boolean('staff_payment_confirmed');

        // CHÍNH SÁCH: Định kỳ/dài hạn luôn phải gắn với 1 tài khoản (không có khách vãng lai),
        // và luôn phải thanh toán ĐỦ 100% — hoặc khách tự thanh toán online (webhook xác nhận),
        // hoặc lễ tân thu đủ 100% tại quầy rồi xác nhận (không cho thu một phần như đặt lẻ).
        if (in_array($request->booking_type, ['recurring', 'long_term'], true)) {
            if (!$userId) {
                return response()->json([
                    'status'  => 'error',
                    'message' => 'Định kỳ/dài hạn yêu cầu tài khoản khách hàng. Vui lòng đăng nhập hoặc chọn tài khoản khách.',
                ], 422);
            }
            if (!$isVerifiedPayment && !$staffConfirmedFullPayment) {
                return response()->json([
                    'status'  => 'error',
                    'message' => $isStaffRequest
                        ? 'Vui lòng xác nhận đã thu đủ 100% tại quầy trước khi tạo hợp đồng định kỳ/dài hạn.'
                        : 'Lịch định kỳ/dài hạn yêu cầu thanh toán 100% online khi đặt. Vui lòng chọn thanh toán chuyển khoản.',
                ], 422);
            }
        }

        // Kiểm tra sân đang hoạt động
        $court = \App\Models\Court::find($request->court_id);
        if (!$court || $court->status !== 'active' || $court->is_maintenance) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Sân này hiện không nhận đặt lịch (đang bảo trì hoặc ngưng hoạt động).',
            ], 422);
        }

        // Kiểm tra ngày đặt phải từ hôm nay trở đi
        $today = now()->format('Y-m-d');
        if ($request->booking_type === 'single') {
            foreach ($request->slots as $slot) {
                if ($slot['date'] < $today) {
                    return response()->json([
                        'status'  => 'error',
                        'message' => "Không thể đặt sân cho ngày đã qua ({$slot['date']}).",
                    ], 422);
                }
            }
        }
        if ($request->booking_type === 'recurring' && $request->start_date < $today) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Ngày bắt đầu hợp đồng định kỳ phải từ hôm nay trở đi.',
            ], 422);
        }
        if ($request->booking_type === 'long_term' && $request->lt_start_date < $today) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Ngày bắt đầu hợp đồng dài hạn phải từ hôm nay trở đi.',
            ], 422);
        }

        $promotion = $this->resolvePromotionForBooking(
            $request->promotion_code,
            $user,
            $request->customer_phone
        );

        // Ngày đặc biệt: tự động áp mã auto_apply còn hạn nếu khách không nhập mã nào
        if (!$promotion) {
            $promotion = $this->resolveAutoPromotion($user, $request->customer_phone);
        }

        // ---------------------------------------------------------------------
        // KỊCH BẢN A: ĐẶT LẺ
        // ---------------------------------------------------------------------
        if ($request->booking_type === 'single') {

            // Validate lại end > start cho từng slot
            foreach ($request->slots as $slot) {
                if ($slot['end'] <= $slot['start']) {
                    return response()->json([
                        'status' => 'error',
                        'message' => "Khung giờ {$slot['start']}-{$slot['end']} không hợp lệ!"
                    ], 400);
                }
            }

            return DB::transaction(function () use ($request, $userId, $user, $promotion) {
                // Khóa sân để hạn chế race condition khi nhiều người đặt cùng lúc
                DB::table('courts')
                    ->where('id', $request->court_id)
                    ->lockForUpdate()
                    ->first();

                // Tiền mặt khách trả trước tại quầy (nếu lễ tân nhập) — trừ dần cho từng
                // booking được tạo ra bên dưới, không vượt quá tổng tiền của mỗi booking.
                $prepaidRemaining = max(0, (float) ($request->prepaid_amount ?? 0));

                foreach ($request->slots as $slot) {
                    if ($this->checkSlotBusy($request->court_id, $slot['date'], $slot['start'], $slot['end'])) {
                        return response()->json([
                            'status' => 'error',
                            'message' => "Khung giờ {$slot['start']}-{$slot['end']} đã có người đặt!"
                        ], 400);
                    }
                }

                /**
                 * Chia slot thành các nhóm liên tiếp.
                 *
                 * Ví dụ:
                 * 17:00-18:00 + 18:00-19:00
                 * => cùng 1 booking_id
                 *
                 * 08:00-10:00 + 14:00-16:00
                 * => tách thành 2 booking_id khác nhau
                 */
                $slotGroups = $this->groupContinuousSlots($request->slots);

                // ── PHA 1: tính tiền toàn bộ các block, CHƯA ghi DB ──────────────
                $preparedGroups = [];
                $grandTotal = 0;
                $totalPayable = 0;
                $promotionApplied = false;

                foreach ($slotGroups as $group) {
                    $bookingId = (string) Str::uuid();
                    $bookingCode = 'BILL_' . strtoupper(Str::random(6));
                    $bookingTotal = 0;
                    $bookingMinutes = 0;
                    $detailsToInsert = [];

                    foreach ($group as $slot) {
                        $slotPrice = $this->internalCalculatePrice(
                            $request->court_id,
                            $slot['date'],
                            $slot['start'],
                            $slot['end']
                        );

                        $bookingTotal += $slotPrice;
                        $grandTotal += $slotPrice;

                        $minutes = (strtotime($slot['end']) - strtotime($slot['start'])) / 60;
                        $bookingMinutes += $minutes;

                        $detailsToInsert[] = [
                            'id' => (string) Str::uuid(),
                            'booking_id' => $bookingId,
                            'court_id' => $request->court_id,
                            'booking_date' => $slot['date'],
                            'start_time' => $slot['start'] . ':00',
                            'end_time' => $slot['end'] . ':00',
                            'duration_minutes' => $minutes,
                            'price_per_hour' => ($minutes > 0) ? ($slotPrice / ($minutes / 60)) : 0,
                            'price' => $slotPrice
                        ];
                    }

                    $loyaltyDiscount = $this->calculateLoyaltyDiscount($user, $bookingMinutes);
                    $promotionDiscount = (!$promotionApplied && $promotion)
                        ? $this->calculatePromotionDiscount($promotion, $bookingTotal)
                        : 0;
                    $discountAmount = min($bookingTotal, $loyaltyDiscount + $promotionDiscount);
                    $payableTotal = max(0, $bookingTotal - $discountAmount);
                    $grandTotal -= $discountAmount;
                    $totalPayable += $payableTotal;
                    $currentPromotionId = $promotionDiscount > 0 ? $promotion->id : null;
                    $promotionApplied = $promotionApplied || $promotionDiscount > 0;

                    $preparedGroups[] = [
                        'booking_id' => $bookingId,
                        'booking_code' => $bookingCode,
                        'group' => $group,
                        'booking_total' => $bookingTotal,
                        'discount_amount' => $discountAmount,
                        'payable_total' => $payableTotal,
                        'promotion_id' => $currentPromotionId,
                        'promotion_discount' => $promotionDiscount,
                        'details' => $detailsToInsert,
                    ];
                }

                // Chính sách "không giữ sân 0 đồng": đơn lẻ tạo tại quầy phải thu trước
                // tối thiểu deposit_percent% tổng tiền (cấu hình trong SystemSetting).
                // Đơn từ webhook thanh toán online (is_verified_payment) đã có tiền vào tài khoản
                // nên bỏ qua kiểm tra này.
                $isVerifiedPayment = (bool) $request->attributes->get('is_verified_payment');
                $depositPercent = max(1, min(100, (float) (\App\Models\SystemSetting::getAll()['deposit_percent'] ?? 20)));
                $minPrepaid = ceil($totalPayable * $depositPercent / 100);
                if (!$isVerifiedPayment && $totalPayable > 0 && $prepaidRemaining < $minPrepaid) {
                    return response()->json([
                        'status' => 'error',
                        'message' => 'Phải thu trước tối thiểu ' . $depositPercent . '% tổng tiền ('
                            . number_format($minPrepaid) . 'đ / ' . number_format($totalPayable)
                            . 'đ) mới được tạo đơn giữ sân!'
                    ], 422);
                }

                // ── PHA 2: đã đạt mức thu tối thiểu — ghi DB ─────────────────────
                $createdBookings = [];
                $paymentBookingId = null;

                foreach ($preparedGroups as $prepared) {
                    $bookingId = $prepared['booking_id'];
                    $bookingCode = $prepared['booking_code'];
                    $group = $prepared['group'];
                    $bookingTotal = $prepared['booking_total'];
                    $discountAmount = $prepared['discount_amount'];
                    $payableTotal = $prepared['payable_total'];
                    $currentPromotionId = $prepared['promotion_id'];
                    $promotionDiscount = $prepared['promotion_discount'];
                    $detailsToInsert = $prepared['details'];

                    // Áp tiền trả trước (nếu có) vào booking này trước khi sang booking tiếp theo
                    $prepayment = $this->applyPrepayment($payableTotal, $prepaidRemaining);

                    Booking::insert([
                        'id' => $bookingId,
                        'booking_code' => $bookingCode,
                        'user_id' => $userId,
                        'recurring_booking_id' => null,
                        'promotion_id' => $currentPromotionId,
                        'subtotal_court' => $bookingTotal,
                        'subtotal_service' => 0,
                        'discount_amount' => $discountAmount,
                        'total_price' => $payableTotal,
                        'deposit_amount' => $prepayment['deposit_amount'],
                        'remaining_amount' => $prepayment['remaining_amount'],
                        'customer_name' => $request->customer_name,
                        'customer_phone' => $request->customer_phone,
                        'status' => $prepayment['status'],
                        'payment_status' => $prepayment['payment_status'],
                        'created_at' => now()
                    ]);

                    BookingDetail::insert($detailsToInsert);

                    if (!$paymentBookingId) {
                        $paymentBookingId = $bookingId;
                    }

                    $createdBookings[] = [
                        'booking_id' => $bookingId,
                        'booking_code' => $bookingCode,
                        'total_price' => $payableTotal,
                        'discount_amount' => $discountAmount,
                        'promotion_discount' => $promotionDiscount,
                        'slots_count' => count($group),
                        'start_time' => $group[0]['start'],
                        'end_time' => $group[count($group) - 1]['end'],
                    ];
                }

                $this->notifyAdminsAboutNewBookings(
                    $createdBookings,
                    $request->customer_name,
                    $request->customer_phone,
                    $user,
                    'Đặt sân lẻ'
                );

                return response()->json([
                    'status' => 'success',
                    'message' => count($createdBookings) > 1
                        ? 'Đặt sân thành công! Các khung giờ cách nhau đã được tách thành nhiều hóa đơn.'
                        : 'Đặt sân lẻ thành công!',
                    'data' => [
                        'booking_id' => $paymentBookingId,
                        'payment_booking_id' => $paymentBookingId,
                        'payment_booking_code' => $createdBookings[0]['booking_code'] ?? null,
                        'bookings' => $createdBookings,
                        'booking_count' => count($createdBookings),
                        'total_price' => $grandTotal,
                    ]
                ], 201);
            });
        }

        // ---------------------------------------------------------------------
        // KỊCH BẢN B: ĐẶT ĐỊNH KỲ
        // ---------------------------------------------------------------------
        if ($request->booking_type === 'recurring') {

            // Đặt định kỳ bắt buộc phải đăng nhập
            if (!$userId) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Tính năng đặt lịch cố định chỉ dành cho thành viên. Vui lòng đăng nhập!'
                ], 401);
            }

            $start = Carbon::parse($request->start_date);
            $end = Carbon::parse($request->end_date);
            $selectedDays = array_map('intval', $request->days_of_week);
            $targetDates = [];

            for ($date = $start->copy(); $date->lte($end); $date->addDay()) {
                if (in_array((int) $date->format('N'), $selectedDays)) {
                    $targetDates[] = $date->format('Y-m-d');
                }
            }

            if (empty($targetDates)) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Không tìm thấy ngày hợp lệ trong dải thời gian đã chọn!'
                ], 400);
            }

            return DB::transaction(function () use ($request, $userId, $user, $promotion, $targetDates, $selectedDays, $staffConfirmedFullPayment) {
                // Khóa toàn bộ sân vì buổi trùng lịch có thể được chuyển sang sân khác
                DB::table('courts')->lockForUpdate()->get();

                $plan = $this->planSessionCourts($request->court_id, $targetDates, $request->start_time, $request->end_time);

                if (empty($plan['sessions'])) {
                    return response()->json([
                        'status' => 'error',
                        'message' => 'Tất cả các buổi đều đã kín sân trong khung giờ này!'
                    ], 400);
                }

                if ((!empty($plan['moved']) || !empty($plan['unavailable'])) && !$request->boolean('accept_adjustments')) {
                    return $this->adjustmentsRequiredResponse($plan);
                }

                // Định kỳ/dài hạn không cho thu một phần — chỉ có 2 trạng thái: chưa xác nhận
                // (chặn ở guard phía trên) hoặc lễ tân đã xác nhận thu đủ 100%.
                $noPartialPrepay = 0.0;

                // Tạo hợp đồng định kỳ gốc
                $recurring = RecurringBooking::create([
                    'user_id' => $userId,
                    'court_id' => $request->court_id,
                    'recurring_code' => 'REC_' . strtoupper(Str::random(6)),
                    'days_of_week' => $selectedDays,
                    'start_time' => $request->start_time . ':00',
                    'end_time' => $request->end_time . ':00',
                    'start_date' => $request->start_date,
                    'end_date' => $request->end_date,
                    'status' => 'active'
                ]);

                $bookingsToInsert = [];
                $detailsToInsert = [];

                $paymentBookingId = null;
                $totalContractAmount = 0;
                $promotionApplied = false;

                $minutes = (strtotime($request->end_time) - strtotime($request->start_time)) / 60;

                // Sinh sẵn hóa đơn độc lập cho từng tuần (buổi trùng đã được đổi sang sân trống khác)
                foreach ($plan['sessions'] as $playDate => $sessionCourtId) {
                    $bookingId = (string) Str::uuid();

                    if (!$paymentBookingId) {
                        $paymentBookingId = $bookingId;
                    }

                    $slotPrice = $this->internalCalculatePrice(
                        $sessionCourtId,
                        $playDate,
                        $request->start_time,
                        $request->end_time
                    );

                    $loyaltyDiscount = $this->calculateLoyaltyDiscount($user, $minutes);
                    $promotionDiscount = (!$promotionApplied && $promotion)
                        ? $this->calculatePromotionDiscount($promotion, $slotPrice)
                        : 0;
                    $discountAmount = min($slotPrice, $loyaltyDiscount + $promotionDiscount);
                    $payableTotal = max(0, $slotPrice - $discountAmount);
                    $currentPromotionId = $promotionDiscount > 0 ? $promotion->id : null;
                    $promotionApplied = $promotionApplied || $promotionDiscount > 0;

                    $totalContractAmount += $payableTotal;

                    $prepayment = $this->applyPrepayment($payableTotal, $noPartialPrepay, $staffConfirmedFullPayment);

                    $bookingsToInsert[] = [
                        'id' => $bookingId,
                        'booking_code' => 'BILL_' . strtoupper(Str::random(6)),
                        'user_id' => $userId,
                        'recurring_booking_id' => $recurring->id,
                        'promotion_id' => $currentPromotionId,
                        'subtotal_court' => $slotPrice,
                        'subtotal_service' => 0,
                        'discount_amount' => $discountAmount,
                        'total_price' => $payableTotal,
                        'deposit_amount' => $prepayment['deposit_amount'],
                        'remaining_amount' => $prepayment['remaining_amount'],
                        'customer_name' => $request->customer_name,
                        'customer_phone' => $request->customer_phone,
                        'status' => $prepayment['status'],
                        'payment_status' => $prepayment['payment_status'],
                        'created_at' => now()
                    ];

                    $detailsToInsert[] = [
                        'id' => (string) Str::uuid(),
                        'booking_id' => $bookingId,
                        'court_id' => $sessionCourtId,
                        'booking_date' => $playDate,
                        'start_time' => $request->start_time . ':00',
                        'end_time' => $request->end_time . ':00',
                        'duration_minutes' => $minutes,
                        'price_per_hour' => ($minutes > 0) ? ($slotPrice / ($minutes / 60)) : 0,
                        'price' => $slotPrice
                    ];
                }

                Booking::insert($bookingsToInsert);
                BookingDetail::insert($detailsToInsert);

                $this->notifyAdminsAboutNewBookings(
                    [
                        [
                            'booking_code' => $recurring->recurring_code,
                            'total_price' => $totalContractAmount,
                            'slots_count' => count($plan['sessions']),
                        ]
                    ],
                    $request->customer_name,
                    $request->customer_phone,
                    $user,
                    'Lịch định kỳ'
                );

                return response()->json([
                    'status' => 'success',
                    'message' => 'Đăng ký hợp đồng định kỳ thành công!',
                    'data' => [
                        'recurring_id' => $recurring->id,
                        'payment_booking_id' => $paymentBookingId,
                        'booking_id' => $paymentBookingId,
                        'total_price' => $totalContractAmount,
                        'total_sessions' => count($plan['sessions']),
                        'moved_sessions' => $plan['moved'],
                        'skipped_dates' => $plan['unavailable'],
                    ]
                ], 201);
            });
        }

        // ---------------------------------------------------------------------
        // KỊCH BẢN C: ĐẶT DÀI HẠN (chọn từng ngày cụ thể, mỗi tuần khác nhau)
        // ---------------------------------------------------------------------
        if ($request->booking_type === 'long_term') {

            if (!$userId) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Tính năng đặt dài hạn chỉ dành cho thành viên. Vui lòng đăng nhập!'
                ], 401);
            }

            $targetDates = array_unique($request->specific_dates);
            sort($targetDates);

            // Validate tất cả ngày phải nằm trong khoảng lt_start_date → lt_end_date
            $rangeStart = $request->lt_start_date;
            $rangeEnd = $request->lt_end_date;
            foreach ($targetDates as $d) {
                if ($d < $rangeStart || $d > $rangeEnd) {
                    return response()->json([
                        'status' => 'error',
                        'message' => "Ngày {$d} nằm ngoài khoảng thời gian đã chọn!"
                    ], 400);
                }
            }

            return DB::transaction(function () use ($request, $userId, $user, $promotion, $targetDates, $rangeStart, $rangeEnd, $staffConfirmedFullPayment) {
                // Khóa toàn bộ sân vì buổi trùng lịch có thể được chuyển sang sân khác
                DB::table('courts')->lockForUpdate()->get();

                $plan = $this->planSessionCourts($request->court_id, $targetDates, $request->lt_start_time, $request->lt_end_time);

                if (empty($plan['sessions'])) {
                    return response()->json([
                        'status' => 'error',
                        'message' => 'Tất cả các buổi đều đã kín sân trong khung giờ này!'
                    ], 400);
                }

                if ((!empty($plan['moved']) || !empty($plan['unavailable'])) && !$request->boolean('accept_adjustments')) {
                    return $this->adjustmentsRequiredResponse($plan);
                }

                // Định kỳ/dài hạn không cho thu một phần — chỉ có 2 trạng thái: chưa xác nhận
                // (chặn ở guard phía trên) hoặc lễ tân đã xác nhận thu đủ 100%.
                $noPartialPrepay = 0.0;

                // Tạo hợp đồng dài hạn gốc
                $longTerm = RecurringBooking::create([
                    'user_id' => $userId,
                    'court_id' => $request->court_id,
                    'recurring_code' => 'LTB_' . strtoupper(Str::random(6)),
                    'days_of_week' => null,
                    'start_time' => $request->lt_start_time . ':00',
                    'end_time' => $request->lt_end_time . ':00',
                    'start_date' => $rangeStart,
                    'end_date' => $rangeEnd,
                    'status' => 'active',
                    'type' => 'long_term',
                ]);

                $bookingsToInsert = [];
                $detailsToInsert = [];
                $paymentBookingId = null;
                $totalContractAmount = 0;
                $promotionApplied = false;

                $minutes = (strtotime($request->lt_end_time) - strtotime($request->lt_start_time)) / 60;

                foreach ($plan['sessions'] as $playDate => $sessionCourtId) {
                    $bookingId = (string) Str::uuid();

                    if (!$paymentBookingId) {
                        $paymentBookingId = $bookingId;
                    }

                    $slotPrice = $this->internalCalculatePrice(
                        $sessionCourtId,
                        $playDate,
                        $request->lt_start_time,
                        $request->lt_end_time
                    );

                    $loyaltyDiscount = $this->calculateLoyaltyDiscount($user, $minutes);
                    $promotionDiscount = (!$promotionApplied && $promotion)
                        ? $this->calculatePromotionDiscount($promotion, $slotPrice)
                        : 0;
                    $discountAmount = min($slotPrice, $loyaltyDiscount + $promotionDiscount);
                    $payableTotal = max(0, $slotPrice - $discountAmount);
                    $currentPromotionId = $promotionDiscount > 0 ? $promotion->id : null;
                    $promotionApplied = $promotionApplied || $promotionDiscount > 0;

                    $totalContractAmount += $payableTotal;

                    $prepayment = $this->applyPrepayment($payableTotal, $noPartialPrepay, $staffConfirmedFullPayment);

                    $bookingsToInsert[] = [
                        'id' => $bookingId,
                        'booking_code' => 'BILL_' . strtoupper(Str::random(6)),
                        'user_id' => $userId,
                        'recurring_booking_id' => $longTerm->id,
                        'promotion_id' => $currentPromotionId,
                        'subtotal_court' => $slotPrice,
                        'subtotal_service' => 0,
                        'discount_amount' => $discountAmount,
                        'total_price' => $payableTotal,
                        'deposit_amount' => $prepayment['deposit_amount'],
                        'remaining_amount' => $prepayment['remaining_amount'],
                        'customer_name' => $request->customer_name,
                        'customer_phone' => $request->customer_phone,
                        'status' => $prepayment['status'],
                        'payment_status' => $prepayment['payment_status'],
                        'created_at' => now()
                    ];

                    $detailsToInsert[] = [
                        'id' => (string) Str::uuid(),
                        'booking_id' => $bookingId,
                        'court_id' => $sessionCourtId,
                        'booking_date' => $playDate,
                        'start_time' => $request->lt_start_time . ':00',
                        'end_time' => $request->lt_end_time . ':00',
                        'duration_minutes' => $minutes,
                        'price_per_hour' => ($minutes > 0) ? ($slotPrice / ($minutes / 60)) : 0,
                        'price' => $slotPrice
                    ];
                }

                Booking::insert($bookingsToInsert);
                BookingDetail::insert($detailsToInsert);

                $this->notifyAdminsAboutNewBookings(
                    [
                        [
                            'booking_code' => $longTerm->recurring_code,
                            'total_price' => $totalContractAmount,
                            'slots_count' => count($plan['sessions']),
                        ]
                    ],
                    $request->customer_name,
                    $request->customer_phone,
                    $user,
                    'Lịch dài hạn'
                );

                return response()->json([
                    'status' => 'success',
                    'message' => 'Đăng ký lịch dài hạn thành công!',
                    'data' => [
                        'recurring_id' => $longTerm->id,
                        'payment_booking_id' => $paymentBookingId,
                        'booking_id' => $paymentBookingId,
                        'total_price' => $totalContractAmount,
                        'total_sessions' => count($plan['sessions']),
                        'moved_sessions' => $plan['moved'],
                        'skipped_dates' => $plan['unavailable'],
                    ]
                ], 201);
            });
        }
    }

    // =========================================================================
    // 3. API CHUẨN BỊ THANH TOÁN ONLINE (tạo intent, chưa tạo booking)
    // =========================================================================
    /**
     * Chức năng: Validate params, tính tổng tiền, lưu intent tạm thời.
     * Booking thật chỉ được tạo sau khi webhook SePay xác nhận tiền vào.
     */
    public function preparePayment(Request $request)
    {
        $request->validate([
            'booking_type' => 'required|in:single,recurring,long_term',
            'court_id' => 'required|exists:courts,id',
            'customer_name' => 'required|string|max:100',
            'customer_phone' => 'required|string|max:20',
            'promotion_code' => 'nullable|string|max:50',
            // Chỉ đặt lẻ mới được chọn cọc giữ chỗ; định kỳ/dài hạn luôn thanh toán đủ.
            'payment_option' => ['nullable', 'in:full,deposit'],
            'slots' => 'required_if:booking_type,single|array',
            'slots.*.date' => 'required_with:slots|date',
            'slots.*.start' => 'required_with:slots|date_format:H:i',
            'slots.*.end' => 'required_with:slots|date_format:H:i',
            'start_date' => 'required_if:booking_type,recurring|date',
            'end_date' => 'required_if:booking_type,recurring|date|after_or_equal:start_date',
            'days_of_week' => 'required_if:booking_type,recurring|array|min:1',
            'days_of_week.*' => 'integer|min:1|max:7',
            'start_time' => 'required_if:booking_type,recurring|date_format:H:i',
            'end_time' => 'required_if:booking_type,recurring|date_format:H:i|after:start_time',
            'lt_start_date' => 'required_if:booking_type,long_term|date',
            'lt_end_date' => 'required_if:booking_type,long_term|date|after_or_equal:lt_start_date',
            'specific_dates' => 'required_if:booking_type,long_term|array|min:1',
            'specific_dates.*' => 'date',
            'lt_start_time' => 'required_if:booking_type,long_term|date_format:H:i',
            'lt_end_time' => 'required_if:booking_type,long_term|date_format:H:i|after:lt_start_time',
        ]);

        $user = $request->user('sanctum');
        $promotion = $this->resolvePromotionForBooking(
            $request->promotion_code,
            $user,
            $request->customer_phone
        );

        // Ngày đặc biệt: tự động áp mã auto_apply còn hạn nếu khách không nhập mã nào
        if (!$promotion) {
            $promotion = $this->resolveAutoPromotion($user, $request->customer_phone);
        }

        // Recurring/long_term bắt buộc đăng nhập (không cho guest tạo intent)
        $type = $request->booking_type;
        if (in_array($type, ['recurring', 'long_term']) && !$request->user('sanctum')) {
            return response()->json(['status' => 'error', 'message' => 'Vui lòng đăng nhập để sử dụng tính năng này!'], 401);
        }

        // Kiểm tra trùng lịch trước khi tạo intent
        if ($type === 'single') {
            foreach ($request->slots as $slot) {
                if ($this->checkSlotBusy($request->court_id, $slot['date'], $slot['start'], $slot['end'])) {
                    return response()->json(['status' => 'error', 'message' => "Khung giờ {$slot['start']}-{$slot['end']} ngày {$slot['date']} đã có người đặt!"], 400);
                }
            }
        } elseif ($type === 'recurring') {
            $start = \Carbon\Carbon::parse($request->start_date);
            $end = \Carbon\Carbon::parse($request->end_date);
            $selectedDays = array_map('intval', $request->days_of_week);
            $targetDates = [];
            for ($date = $start->copy(); $date->lte($end); $date->addDay()) {
                if (in_array((int) $date->format('N'), $selectedDays)) {
                    $targetDates[] = $date->format('Y-m-d');
                }
            }

            $plan = $this->planSessionCourts($request->court_id, $targetDates, $request->start_time, $request->end_time);
            if (empty($plan['sessions'])) {
                return response()->json(['status' => 'error', 'message' => 'Tất cả các buổi đều đã kín sân trong khung giờ này!'], 400);
            }
            // Cần xác nhận điều chỉnh trước khi hiện QR; sau khi khách đồng ý,
            // accept_adjustments đi kèm payload nên store() ở webhook sẽ tự áp kế hoạch.
            if ((!empty($plan['moved']) || !empty($plan['unavailable'])) && !$request->boolean('accept_adjustments')) {
                return $this->adjustmentsRequiredResponse($plan);
            }
        } elseif ($type === 'long_term') {
            $plan = $this->planSessionCourts($request->court_id, array_unique($request->specific_dates), $request->lt_start_time, $request->lt_end_time);
            if (empty($plan['sessions'])) {
                return response()->json(['status' => 'error', 'message' => 'Tất cả các buổi đều đã kín sân trong khung giờ này!'], 400);
            }
            if ((!empty($plan['moved']) || !empty($plan['unavailable'])) && !$request->boolean('accept_adjustments')) {
                return $this->adjustmentsRequiredResponse($plan);
            }
        }

        // Tính tổng tiền (100%) và số tiền thực sự cần chuyển khoản (100% hoặc % cọc)
        $fullAmount = $this->calculateFullBookingAmount($request, $promotion, $user);
        $isDeposit = $type === 'single' && $request->payment_option === 'deposit';
        $amount = $isDeposit ? $this->calculateIntentAmount($request, $promotion, $user) : $fullAmount;
        $remainingAtVenue = $isDeposit ? max(0, $fullAmount - $amount) : 0;

        // Xóa các intent cũ đã hết hạn
        BookingIntent::where('expires_at', '<', now())->delete();

        $intentCode = 'PAY' . strtoupper(Str::random(7));
        $intent = BookingIntent::create([
            'id' => (string) Str::uuid(),
            'intent_code' => $intentCode,
            'payload' => $request->except('promotion_code') + ['promotion_code' => $promotion?->code ?? $request->promotion_code, 'user_id' => $user?->id],
            'amount' => $amount,
            'booking_type' => $type,
            'expires_at' => now()->addMinutes(30),
        ]);

        $bankName = env('SEPAY_BANK_NAME');
        $bankAccount = env('SEPAY_BANK_ACCOUNT');
        $accountHolder = env('SEPAY_ACCOUNT_HOLDER');
        $transferPrefix = env('SEPAY_TRANSFER_PREFIX');
        $transferContent = $transferPrefix ? $transferPrefix . ' ' . $intentCode : $intentCode;

        $qrUrl = 'https://qr.sepay.vn/img?' . http_build_query([
            'acc' => $bankAccount,
            'bank' => $bankName,
            'amount' => $amount,
            'des' => $transferContent,
        ]);

        return response()->json([
            'status' => 'success',
            'data' => [
                'intent_id' => $intent->id,
                'intent_code' => $intentCode,
                'amount' => $amount,
                'is_deposit' => $isDeposit,
                'full_amount' => $fullAmount,
                'remaining_at_venue' => $remainingAtVenue,
                'expires_at' => $intent->expires_at,
                'bank_name' => $bankName,
                'bank_account' => $bankAccount,
                'account_holder' => $accountHolder,
                'transfer_content' => $transferContent,
                'qr_url' => $qrUrl,
            ]
        ]);
    }

    private function calculateIntentAmount(Request $request, ?Promotion $promotion, $user): float
    {
        $total = $this->calculateFullBookingAmount($request, $promotion, $user);

        // Đặt cọc giữ chỗ: chỉ áp dụng cho đặt lẻ, tỷ lệ % tổng tiền.
        if ($request->booking_type === 'single' && $request->payment_option === 'deposit') {
            $depositPercent = (float) (\App\Models\SystemSetting::getAll()['deposit_percent'] ?? 20);
            $depositPercent = max(1, min(100, $depositPercent));
            $depositAmount  = round($total * $depositPercent / 100);
            return max(1000, min($total, $depositAmount));
        }

        return $total;
    }

    /**
     * Chức năng: Tính tổng tiền đầy đủ (100%) của đơn theo loại đặt sân, áp dụng
     * giảm giá thành viên và mã khuyến mãi. Dùng làm cơ sở tính tiền cọc.
     */
    private function calculateFullBookingAmount(Request $request, ?Promotion $promotion, $user): float
    {
        $type = $request->booking_type;
        $total = 0;
        $promotionApplied = false;

        if ($type === 'single') {
            foreach ($request->slots as $slot) {
                $price = $this->internalCalculatePrice($request->court_id, $slot['date'], $slot['start'], $slot['end']);
                $minutes = (strtotime($slot['end']) - strtotime($slot['start'])) / 60;
                $loyaltyDiscount = $this->calculateLoyaltyDiscount($user, $minutes);
                $promoDiscount = (!$promotionApplied && $promotion) ? $this->calculatePromotionDiscount($promotion, $price) : 0;
                $total += max(0, $price - min($price, $loyaltyDiscount + $promoDiscount));
                $promotionApplied = $promotionApplied || $promoDiscount > 0;
            }
        } elseif ($type === 'recurring') {
            $start = \Carbon\Carbon::parse($request->start_date);
            $end = \Carbon\Carbon::parse($request->end_date);
            $selectedDays = array_map('intval', $request->days_of_week);
            $minutes = (strtotime($request->end_time) - strtotime($request->start_time)) / 60;
            $targetDates = [];
            for ($date = $start->copy(); $date->lte($end); $date->addDay()) {
                if (in_array((int) $date->format('N'), $selectedDays)) {
                    $targetDates[] = $date->format('Y-m-d');
                }
            }
            // Chỉ tính tiền các buổi thực sự đặt được (buổi trùng đã đổi sân, buổi kín hết sân thì bỏ)
            $plan = $this->planSessionCourts($request->court_id, $targetDates, $request->start_time, $request->end_time);
            foreach ($plan['sessions'] as $playDate => $sessionCourtId) {
                $price = $this->internalCalculatePrice($sessionCourtId, $playDate, $request->start_time, $request->end_time);
                $loyaltyDiscount = $this->calculateLoyaltyDiscount($user, $minutes);
                $promoDiscount = (!$promotionApplied && $promotion) ? $this->calculatePromotionDiscount($promotion, $price) : 0;
                $total += max(0, $price - min($price, $loyaltyDiscount + $promoDiscount));
                $promotionApplied = $promotionApplied || $promoDiscount > 0;
            }
        } elseif ($type === 'long_term') {
            $minutes = (strtotime($request->lt_end_time) - strtotime($request->lt_start_time)) / 60;
            $plan = $this->planSessionCourts($request->court_id, array_unique($request->specific_dates), $request->lt_start_time, $request->lt_end_time);
            foreach ($plan['sessions'] as $playDate => $sessionCourtId) {
                $price = $this->internalCalculatePrice($sessionCourtId, $playDate, $request->lt_start_time, $request->lt_end_time);
                $loyaltyDiscount = $this->calculateLoyaltyDiscount($user, $minutes);
                $promoDiscount = (!$promotionApplied && $promotion) ? $this->calculatePromotionDiscount($promotion, $price) : 0;
                $total += max(0, $price - min($price, $loyaltyDiscount + $promoDiscount));
                $promotionApplied = $promotionApplied || $promoDiscount > 0;
            }
        }

        return $total;
    }

    // =========================================================================
    // 4. API LỊCH SỬ CÁ NHÂN (gom nhóm định kỳ / dài hạn)
    // =========================================================================
    /**
     * Chức năng: Lấy lịch sử đặt sân của khách hàng.
     * Đơn lẻ hiển thị riêng; đơn định kỳ/dài hạn được gom thành 1 nhóm có danh sách buổi bên trong.
     */
    public function getUserBookings(Request $request)
    {
        $user = $request->user('sanctum');

        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Vui lòng đăng nhập!'
            ], 401);
        }

        $tab    = $request->query('tab', 'all');
        $today  = now()->format('Y-m-d');
        $perPage = 10;
        $page   = max(1, (int) $request->query('page', 1));

        // ── A. ĐƠN LẺ (không có recurring_booking_id) ──────────────────────
        $singleQuery = Booking::with([
            'details' => fn($q) => $q->with('court')->orderBy('booking_date')->orderBy('start_time'),
        ])->where('user_id', $user->id)->whereNull('recurring_booking_id');

        if ($tab === 'upcoming') {
            $singleQuery->where('status', '!=', 'cancelled')
                ->whereHas('details', fn($q) => $q->where('booking_date', '>=', $today));
        } elseif ($tab === 'history') {
            $singleQuery->where(fn($q) => $q
                ->where('status', 'cancelled')
                ->orWhereDoesntHave('details', fn($sq) => $sq->where('booking_date', '>=', $today))
            );
        }

        $singles = $singleQuery->orderBy('created_at', 'desc')->get();

        // ── B. NHÓM ĐỊNH KỲ / DÀI HẠN ─────────────────────────────────────
        $groupQuery = RecurringBooking::with([
            'court',
            'bookings' => fn($q) => $q
                ->with(['details' => fn($d) => $d->with('court')->orderBy('booking_date')->orderBy('start_time')])
                ->orderBy('created_at', 'asc'),
        ])->where('user_id', $user->id);

        if ($tab === 'upcoming') {
            $groupQuery->whereHas('bookings.details', fn($q) => $q->where('booking_date', '>=', $today));
        } elseif ($tab === 'history') {
            $groupQuery->whereDoesntHave('bookings.details', fn($q) => $q->where('booking_date', '>=', $today));
        }

        $groups = $groupQuery->orderByDesc('start_date')->get();

        // ── C. MAP REVIEW ───────────────────────────────────────────────────
        $allBookingIds = $singles->pluck('id');
        $reviewedIds   = Review::where('user_id', $user->id)
            ->whereIn('booking_id', $allBookingIds)
            ->pluck('booking_id')->flip();

        // For group sessions we need reviewed ids from ALL bookings in groups
        $groupBookingIds = $groups->flatMap(fn($g) => $g->bookings->pluck('id'));
        $groupReviewedIds = Review::where('user_id', $user->id)
            ->whereIn('booking_id', $groupBookingIds)
            ->pluck('booking_id')->flip();

        // ── D. BUILD ITEMS ──────────────────────────────────────────────────
        $items = [];

        foreach ($singles as $b) {
            $first = $b->details->first();
            $last  = $b->details->last();
            $items[] = [
                'item_type'      => 'single',
                'booking_id'     => $b->id,
                'booking_code'   => $b->booking_code,
                'type_label'     => 'Đặt Lẻ',
                'total_price'    => (float) $b->total_price,
                'status'         => $b->status,
                'payment_status' => $b->payment_status,
                'has_reviewed'   => isset($reviewedIds[$b->id]),
                'created_at'     => Carbon::parse($b->created_at)->format('d/m/Y H:i'),
                'details_count'  => $b->details->count(),
                'summary'        => $first ? [
                    'court_id'   => $first->court_id,
                    'court_name' => $first->court?->name ?? '—',
                    'play_date'  => Carbon::parse($first->booking_date)->format('d/m/Y'),
                    'time_slot'  => substr($first->start_time, 0, 5) . ' - ' . substr($last->end_time, 0, 5),
                ] : null,
                '_sort' => $b->created_at?->timestamp ?? 0,
            ];
        }

        foreach ($groups as $g) {
            $sessions     = $g->bookings;
            $totalSessions = $sessions->count();
            $completedCnt = $sessions->where('status', 'completed')->count();
            $paidCnt      = $sessions->where('payment_status', 'paid')->count();
            $totalPrice   = $sessions->sum('total_price');

            if ($g->status === 'cancelled') {
                $groupStatus = 'cancelled';
            } elseif ($completedCnt === $totalSessions && $totalSessions > 0) {
                $groupStatus = 'completed';
            } else {
                $groupStatus = 'active';
            }

            $sessionsFormatted = $sessions->map(function ($b) use ($groupReviewedIds) {
                $first = $b->details->first();
                $last  = $b->details->last();
                return [
                    'booking_id'     => $b->id,
                    'booking_code'   => $b->booking_code,
                    'status'         => $b->status,
                    'payment_status' => $b->payment_status,
                    'total_price'    => (float) $b->total_price,
                    'has_reviewed'   => isset($groupReviewedIds[$b->id]),
                    'court_id'       => $first?->court_id,
                    'court_name'     => $first?->court?->name ?? '—',
                    'play_date'      => $first ? Carbon::parse($first->booking_date)->format('d/m/Y') : null,
                    'play_date_raw'  => $first?->booking_date,
                    'time_slot'      => $first
                        ? substr($first->start_time, 0, 5) . ' - ' . substr($last->end_time, 0, 5)
                        : null,
                ];
            })->values();

            $items[] = [
                'item_type'          => 'group',
                'recurring_id'       => $g->id,
                'recurring_code'     => $g->recurring_code,
                'group_type'         => $g->type,
                'type_label'         => $g->type === 'long_term' ? 'Dài hạn' : 'Định kỳ',
                'court_name'         => $g->court?->name ?? ($sessions->first()?->details->first()?->court?->name ?? '—'),
                'start_date'         => Carbon::parse($g->start_date)->format('d/m/Y'),
                'end_date'           => Carbon::parse($g->end_date)->format('d/m/Y'),
                'time_slot'          => substr($g->start_time, 0, 5) . ' - ' . substr($g->end_time, 0, 5),
                'total_sessions'     => $totalSessions,
                'completed_sessions' => $completedCnt,
                'paid_sessions'      => $paidCnt,
                'total_price'        => (float) $totalPrice,
                'status'             => $groupStatus,
                'sessions'           => $sessionsFormatted,
                '_sort'              => strtotime($g->start_date) ?? 0,
            ];
        }

        // Sắp xếp mới nhất lên đầu
        usort($items, fn($a, $b) => $b['_sort'] - $a['_sort']);

        // Phân trang thủ công
        $total    = count($items);
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page     = min($page, $lastPage);
        $sliced   = array_slice($items, ($page - 1) * $perPage, $perPage);

        // Xóa key nội bộ
        $sliced = array_map(function ($item) {
            unset($item['_sort']);
            return $item;
        }, $sliced);

        return response()->json([
            'status' => 'success',
            'data' => [
                'data'         => array_values($sliced),
                'current_page' => $page,
                'last_page'    => $lastPage,
                'total'        => $total,
            ],
        ]);
    }

    // =========================================================================
    // 4. API CONG KHAI: KHACH VANG LAI TRA CUU DON BANG MA DON + SO DIEN THOAI
    // =========================================================================
    /**
     * Chức năng: Cho khách vãng lai tra cứu đơn bằng mã booking và số điện thoại.
     */
    public function lookupGuestBooking(Request $request)
    {
        $validated = $request->validate([
            'booking_code' => 'required|string|max:50',
            'customer_phone' => 'required|string|max:20',
        ]);

        $bookingCode = strtoupper(trim($validated['booking_code']));
        $rawPhone = trim($validated['customer_phone']);
        $normalizedPhone = preg_replace('/\D+/', '', $rawPhone);

        $booking = Booking::with([
            'details' => function ($query) {
                $query->with('court')
                    ->orderBy('booking_date', 'asc')
                    ->orderBy('start_time', 'asc');
            },
            'serviceDetails.product',
            'serviceDetails.service',
        ])
            ->whereRaw('UPPER(booking_code) = ?', [$bookingCode])
            ->where(function ($query) use ($rawPhone, $normalizedPhone) {
                $query->where('customer_phone', $rawPhone);

                if ($normalizedPhone !== '') {
                    $query->orWhere('customer_phone', $normalizedPhone);
                }
            })
            ->first();

        if (!$booking) {
            return response()->json([
                'status' => 'error',
                'message' => 'Khong tim thay don dat san phu hop voi ma don va so dien thoai.',
            ], 404);
        }

        $firstDetail = $booking->details->first();
        $lastDetail = $booking->details->last();

        return response()->json([
            'status' => 'success',
            'data' => [
                'booking_id' => $booking->id,
                'booking_code' => $booking->booking_code,
                'customer_name' => $booking->customer_name,
                'customer_phone' => $booking->customer_phone,
                'type_label' => $booking->recurring_booking_id ? 'Lich dinh ky' : 'Dat le',
                'status' => $booking->status,
                'payment_status' => $booking->payment_status,
                'subtotal_court' => (float) $booking->subtotal_court,
                'subtotal_service' => (float) $booking->subtotal_service,
                'discount_amount' => (float) $booking->discount_amount,
                'deposit_amount' => (float) $booking->deposit_amount,
                'remaining_amount' => (float) $booking->remaining_amount,
                'total_price' => (float) $booking->total_price,
                'created_at' => $booking->created_at
                    ? Carbon::parse($booking->created_at)->format('d/m/Y H:i')
                    : null,
                'summary' => $firstDetail ? [
                    'play_date' => Carbon::parse($firstDetail->booking_date)->format('d/m/Y'),
                    'time_slot' => substr($firstDetail->start_time, 0, 5) . ' - ' . substr($lastDetail->end_time, 0, 5),
                    'court_name' => $firstDetail->court?->name,
                ] : null,
                'details' => $booking->details->map(function ($detail) {
                    return [
                        'id' => $detail->id,
                        'court_name' => $detail->court?->name,
                        'court_code' => $detail->court?->court_code,
                        'booking_date' => Carbon::parse($detail->booking_date)->format('d/m/Y'),
                        'start_time' => substr($detail->start_time, 0, 5),
                        'end_time' => substr($detail->end_time, 0, 5),
                        'duration_minutes' => (int) $detail->duration_minutes,
                        'price_per_hour' => (float) $detail->price_per_hour,
                        'price' => (float) $detail->price,
                        'overtime_minutes' => (int) $detail->overtime_minutes,
                        'overtime_fee' => (float) $detail->overtime_fee,
                    ];
                })->values(),
                'services' => $booking->serviceDetails->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'name' => $item->product?->name ?? $item->service?->name ?? 'Mat hang / dich vu',
                        'quantity' => (int) $item->quantity,
                        'unit_price' => (float) $item->unit_price,
                        'total_price' => (float) $item->total_price,
                        'note' => $item->note,
                    ];
                })->values(),
            ],
        ]);
    }

    /**
     * Chức năng: Kiểm tra mã voucher khi khách nhập trước lúc chốt đặt sân.
     */
    public function validatePromotion(Request $request)
    {
        $validated = $request->validate([
            'promotion_code' => 'required|string|max:50',
            'customer_phone' => 'nullable|string|max:20',
            'total_amount' => 'required|numeric|min:0',
        ]);

        $user = $request->user('sanctum');
        $promotion = $this->resolvePromotionForBooking(
            $validated['promotion_code'],
            $user,
            $validated['customer_phone'] ?? null
        );

        $discountAmount = $this->calculatePromotionDiscount($promotion, (float) $validated['total_amount']);

        return response()->json([
            'status' => 'success',
            'message' => 'Ma giam gia hop le.',
            'data' => [
                'id' => $promotion->id,
                'code' => $promotion->code,
                'name' => $promotion->name,
                'discount_type' => $promotion->discount_type,
                'discount_value' => (float) $promotion->discount_value,
                'discount_amount' => $discountAmount,
            ],
        ]);
    }

    // =========================================================================
    // HÀM PHỤ: CHIA SLOT ĐẶT LẺ THÀNH CÁC NHÓM LIỀN NHAU
    // =========================================================================
    /**
     * Chức năng: Gom các khung giờ liên tiếp thành cùng một hóa đơn và tách khung giờ rời nhau.
     */
    private function groupContinuousSlots(array $slots)
    {
        usort($slots, function ($a, $b) {
            $dateCompare = strcmp($a['date'], $b['date']);

            if ($dateCompare !== 0) {
                return $dateCompare;
            }

            return strcmp($a['start'], $b['start']);
        });

        $groups = [];
        $currentGroup = [];

        foreach ($slots as $slot) {
            if (empty($currentGroup)) {
                $currentGroup[] = $slot;
                continue;
            }

            $lastSlot = $currentGroup[count($currentGroup) - 1];

            $isSameDate = $lastSlot['date'] === $slot['date'];
            $isContinuous = $lastSlot['end'] === $slot['start'];

            if ($isSameDate && $isContinuous) {
                $currentGroup[] = $slot;
            } else {
                $groups[] = $currentGroup;
                $currentGroup = [$slot];
            }
        }

        if (!empty($currentGroup)) {
            $groups[] = $currentGroup;
        }

        return $groups;
    }

    // =========================================================================
    // HÀM PHỤ: KIỂM TRA TRÙNG LỊCH
    // =========================================================================
    /**
     * Chức năng: Kiểm tra một khung giờ có bị trùng với booking chưa hủy hay không.
     */
    private function checkSlotBusy($courtId, $date, $start, $end)
    {
        return BookingDetail::where('court_id', $courtId)
            ->where('booking_date', $date)
            ->where(function ($q) use ($start, $end) {
                $q->where('start_time', '<', $end . ':00')
                    ->where('end_time', '>', $start . ':00');
            })
            ->whereHas('booking', function ($q) {
                $q->where('status', '!=', 'cancelled');
            })
            ->exists();
    }

    /**
     * Chức năng: Lập kế hoạch sân cho từng buổi của chuỗi định kỳ/dài hạn.
     * Buổi nào sân yêu cầu bị trùng lịch thì tự tìm sân khác đang hoạt động còn trống
     * cùng khung giờ để thay thế; nếu không còn sân nào trống thì đánh dấu bỏ buổi đó.
     * Trả về: sessions [ngày => court_id sẽ dùng], moved [các buổi bị đổi sân kèm tên sân],
     * unavailable [các ngày không còn sân nào trống].
     */
    private function planSessionCourts(string $preferredCourtId, array $dates, string $startTime, string $endTime): array
    {
        $courts = \App\Models\Court::where('status', 'active')->orderBy('name')->get();

        $sessions = [];
        $moved = [];
        $unavailable = [];

        foreach ($dates as $date) {
            if (!$this->checkSlotBusy($preferredCourtId, $date, $startTime, $endTime)) {
                $sessions[$date] = $preferredCourtId;
                continue;
            }

            $alternative = $courts->first(
                fn($c) => $c->id !== $preferredCourtId
                    && !$this->checkSlotBusy($c->id, $date, $startTime, $endTime)
            );

            if ($alternative) {
                $sessions[$date] = $alternative->id;
                $moved[] = [
                    'date'       => $date,
                    'court_id'   => $alternative->id,
                    'court_name' => $alternative->name,
                ];
            } else {
                $unavailable[] = $date;
            }
        }

        return ['sessions' => $sessions, 'moved' => $moved, 'unavailable' => $unavailable];
    }

    /**
     * Chức năng: Trả phản hồi HTTP 409 kèm kế hoạch điều chỉnh (buổi đổi sân / buổi bị bỏ)
     * để frontend hiển thị cho người dùng xác nhận trước khi gửi lại với accept_adjustments=true.
     */
    private function adjustmentsRequiredResponse(array $plan)
    {
        return response()->json([
            'status'  => 'adjustments_required',
            'message' => 'Một số buổi bị trùng lịch, cần bạn xác nhận điều chỉnh trước khi đặt.',
            'data'    => [
                'moved'          => $plan['moved'],
                'unavailable'    => $plan['unavailable'],
                'playable_count' => count($plan['sessions']),
            ],
        ], 409);
    }

    // =========================================================================
    // HÀM PHỤ: TÍNH ƯU ĐÃI ĐIỂM THÀNH VIÊN
    // =========================================================================
    /**
     * Chức năng: Tính giảm giá theo điểm thành viên dựa trên số phút khách đặt sân.
     */
    private function calculateLoyaltyDiscount(?User $user, int|float $totalMinutes): float
    {
        if (!$user || $user->role !== 'customer' || (int) $user->points < 1000) {
            return 0;
        }

        $hours = $totalMinutes / 60;

        return max(0, $hours * 5000);
    }

    /**
     * Chức năng: Áp tiền trả trước (lễ tân ghi nhận tại quầy) vào 1 booking cụ thể,
     * trừ dần từ ngân sách còn lại ($prepaidRemaining, truyền theo tham chiếu để dùng
     * chung cho nhiều booking liên tiếp trong cùng 1 đơn/hợp đồng). Trả về đủ 4 field
     * cần cho Booking::insert: deposit_amount, remaining_amount, status, payment_status.
     */
    private function applyPrepayment(float $payableTotal, float &$prepaidRemaining, bool $forceFullyPaid = false): array
    {
        // Đơn miễn phí hoàn toàn (giảm giá 100%) — không cần thu tiền, xác nhận ngay.
        if ($payableTotal <= 0) {
            return [
                'deposit_amount'   => 0,
                'remaining_amount' => 0,
                'status'           => 'confirmed',
                'payment_status'   => 'paid',
            ];
        }

        // Định kỳ/dài hạn do lễ tân xác nhận đã thu đủ 100% tại quầy — không thu một phần.
        if ($forceFullyPaid) {
            return [
                'deposit_amount'   => $payableTotal,
                'remaining_amount' => 0,
                'status'           => 'confirmed',
                'payment_status'   => 'paid',
            ];
        }

        $depositForThis = min($prepaidRemaining, $payableTotal);
        $prepaidRemaining -= $depositForThis;
        $remainingForThis = $payableTotal - $depositForThis;

        return [
            'deposit_amount'   => $depositForThis,
            'remaining_amount' => $remainingForThis,
            // Mọi đường tạo đơn đều đã đảm bảo có tiền ở cấp đơn (tối thiểu 20% tại quầy,
            // 100% định kỳ/dài hạn, hoặc webhook xác nhận tiền vào) → xác nhận luôn.
            // Booking thứ 2+ trong đơn nhiều block có thể nhận deposit 0 vì tiền trả trước
            // đã bị block đầu tiêu hết — vẫn confirmed vì cả đơn đã đạt mức thu tối thiểu.
            'status'           => 'confirmed',
            'payment_status'   => $remainingForThis <= 0 ? 'paid' : ($depositForThis > 0 ? 'partially_paid' : 'unpaid'),
        ];
    }

    /**
     * Chức năng: Tìm mã giảm giá ngày đặc biệt (auto_apply) còn hạn để tự động áp dụng.
     * Vẫn tôn trọng giới hạn lượt dùng và điểm tối thiểu; không đủ điều kiện thì bỏ qua.
     */
    private function resolveAutoPromotion(?User $user, ?string $customerPhone): ?Promotion
    {
        $promotion = Promotion::currentlyValid()
            ->where('auto_apply', true)
            ->orderByRaw("CASE WHEN discount_type = 'percent' THEN 200000 * discount_value / 100 ELSE discount_value END DESC")
            ->first();

        if (!$promotion) {
            return null;
        }

        // Không đủ điểm thì bỏ qua thay vì báo lỗi (khách không chủ động nhập mã)
        $currentPoints = $user ? (int) $user->points : 0;
        if ($currentPoints < (int) $promotion->min_points_required) {
            return null;
        }

        $limit = (int) $promotion->per_user_limit;
        if ($limit > 0) {
            $usedCount = Booking::where('promotion_id', $promotion->id)
                ->where(function ($query) use ($user, $customerPhone) {
                    if ($user) {
                        $query->where('user_id', $user->id);
                    } else {
                        $query->where('customer_phone', $customerPhone);
                    }
                })
                ->count();

            if ($usedCount >= $limit) {
                return null;
            }
        }

        return $promotion;
    }

    /**
     * Chức năng: API công khai trả về mã giảm giá ngày đặc biệt đang hiệu lực (nếu có)
     * để trang đặt sân hiển thị banner "hôm nay được tự động giảm giá".
     */
    public function autoPromotion()
    {
        $promotion = Promotion::currentlyValid()
            ->where('auto_apply', true)
            ->orderByRaw("CASE WHEN discount_type = 'percent' THEN 200000 * discount_value / 100 ELSE discount_value END DESC")
            ->first();

        return response()->json([
            'status' => 'success',
            'data' => $promotion ? [
                'code'           => $promotion->code,
                'name'           => $promotion->name,
                'description'    => $promotion->description,
                'discount_type'  => $promotion->discount_type,
                'discount_value' => (float) $promotion->discount_value,
                'valid_to'       => $promotion->valid_to?->toDateString(),
            ] : null,
        ]);
    }

    /**
     * Chức năng: Tìm và kiểm tra điều kiện voucher theo mã, tài khoản hoặc số điện thoại khách.
     */
    private function resolvePromotionForBooking(?string $code, ?User $user, ?string $customerPhone): ?Promotion
    {
        $code = strtoupper(trim((string) $code));

        if ($code === '') {
            return null;
        }

        $promotion = Promotion::whereRaw('UPPER(code) = ?', [$code])
            ->where('status', 'active')
            ->first();

        if (!$promotion) {
            abort(response()->json([
                'status' => 'error',
                'message' => 'Ma giam gia khong ton tai hoac da ngung ap dung.',
            ], 422));
        }

        // Kiểm tra hạn sử dụng của mã
        $today = now()->toDateString();
        if (($promotion->valid_from && $today < $promotion->valid_from->toDateString())
            || ($promotion->valid_to && $today > $promotion->valid_to->toDateString())) {
            abort(response()->json([
                'status' => 'error',
                'message' => 'Ma giam gia da het han hoac chua den ngay ap dung.',
            ], 422));
        }

        $currentPoints = $user ? (int) $user->points : 0;
        if ($currentPoints < (int) $promotion->min_points_required) {
            abort(response()->json([
                'status' => 'error',
                'message' => 'Tai khoan chua du diem tich luy de dung ma giam gia nay.',
            ], 422));
        }

        $limit = (int) $promotion->per_user_limit;
        if ($limit > 0) {
            $usedCount = Booking::where('promotion_id', $promotion->id)
                ->where(function ($query) use ($user, $customerPhone) {
                    if ($user) {
                        $query->where('user_id', $user->id);
                    } else {
                        $query->where('customer_phone', $customerPhone);
                    }
                })
                ->count();

            if ($usedCount >= $limit) {
                abort(response()->json([
                    'status' => 'error',
                    'message' => 'Ban da dung het so luot cua ma giam gia nay.',
                ], 422));
            }
        }

        return $promotion;
    }

    /**
     * Chức năng: Tính số tiền được giảm từ voucher theo loại fixed hoặc percent.
     */
    private function calculatePromotionDiscount(?Promotion $promotion, int|float $baseAmount): float
    {
        if (!$promotion || $baseAmount <= 0) {
            return 0;
        }

        if ($promotion->discount_type === 'percent') {
            return min($baseAmount, $baseAmount * ((float) $promotion->discount_value / 100));
        }

        return min($baseAmount, (float) $promotion->discount_value);
    }

    /**
     * Chức năng: Tạo thông báo cho admin/staff khi có đơn đặt sân mới.
     */
    private function notifyAdminsAboutNewBookings(
        array $bookings,
        ?string $customerName,
        ?string $customerPhone,
        ?User $sender,
        string $bookingType
    ): void {
        $receiverIds = User::whereIn('role', ['admin', 'staff'])
            ->where('status', 'active')
            ->pluck('id');

        if ($receiverIds->isEmpty()) {
            return;
        }

        $rows = [];
        $senderId = $sender?->id ?? $customerPhone;
        $now = now();

        foreach ($bookings as $booking) {
            $code = $booking['booking_code'] ?? 'Đơn mới';
            $amount = number_format((float) ($booking['total_price'] ?? 0), 0, ',', '.');
            $slotsCount = (int) ($booking['slots_count'] ?? 1);
            $displayName = $customerName ?: 'Khách hàng';
            $displayPhone = $customerPhone ?: 'chưa có SĐT';
            $title = 'Có đơn đặt sân mới';
            $content = "{$bookingType} {$code} từ {$displayName} ({$displayPhone}), {$slotsCount} ca, tổng {$amount}đ.";
            $groupKey = 'booking_' . strtolower($code);

            foreach ($receiverIds as $receiverId) {
                $rows[] = [
                    'id' => (string) Str::uuid(),
                    'receiver_id' => $receiverId,
                    'sender_id' => $senderId,
                    'title' => $title,
                    'content' => $content,
                    'is_read' => false,
                    'created_at' => $now,
                    'group_key' => $groupKey,
                ];
            }
        }

        Notification::insert($rows);
    }

    // =========================================================================
    // HÀM PHỤ: TÍNH GIÁ THEO BẢNG GIÁ
    // =========================================================================
    /**
     * Chức năng: Tính giá thuê sân theo bảng giá nội bộ cho khung giờ khách chọn.
     */
    private function internalCalculatePrice($courtId, $date, $start, $end)
    {
        $dayOfWeek = date('N', strtotime($date));
        $dayType = ($dayOfWeek >= 6) ? 'weekend' : 'weekday';

        $pricings = CourtPricing::where('court_id', $courtId)
            ->where('day_type', $dayType)
            ->where(function ($q) use ($date) {
                $q->whereNull('effective_from')
                    ->orWhere('effective_from', '<=', $date);
            })
            ->where(function ($q) use ($date) {
                $q->whereNull('effective_to')
                    ->orWhere('effective_to', '>=', $date);
            })
            ->orderByRaw('effective_from DESC')
            ->get();

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

    /**
     * Chức năng: Khách hàng gửi yêu cầu đổi lịch hoặc hủy đơn đến admin/staff.
     * Tạo thông báo cho toàn bộ admin/staff, nhúng mã đơn vào content để routing tự động.
     */
    public function sendRequest(Request $request)
    {
        $validated = $request->validate([
            'booking_code' => ['required', 'string', 'max:50'],
            'type'         => ['required', 'in:change,cancel'],
            'message'      => ['required', 'string', 'max:500'],
        ]);

        $user = $request->user();
        $code = strtoupper(trim($validated['booking_code']));

        // Xác minh đơn tồn tại và thuộc về người dùng đang đăng nhập
        // Đơn walk-in (user_id = null) cũng cho phép nếu khách tìm thấy đúng mã
        $booking = Booking::where('booking_code', $code)
            ->where(fn($q) => $q->where('user_id', $user->id)->orWhereNull('user_id'))
            ->first();
        $recurringBooking = !$booking
            ? RecurringBooking::where('recurring_code', $code)
                ->where(fn($q) => $q->where('user_id', $user->id)->orWhereNull('user_id'))
                ->first()
            : null;

        if (!$booking && !$recurringBooking) {
            return response()->json(['message' => 'Không tìm thấy đơn đặt sân.'], 404);
        }

        $typeLabel = $validated['type'] === 'cancel' ? 'hủy lịch' : 'đổi lịch';

        // group_key dùng chung cho tất cả bản ghi → khi 1 người đọc thì cả nhóm được mark read
        $groupKey = 'req_' . strtolower($code);

        $adminStaffIds = User::whereIn('role', ['admin', 'staff'])->pluck('id');
        $now = now();
        $rows = $adminStaffIds->map(fn ($receiverId) => [
            'id'          => (string) Str::uuid(),
            'receiver_id' => $receiverId,
            'sender_id'   => $user->id,
            'title'       => "Yêu cầu {$typeLabel} — {$code}",
            'content'     => "{$user->full_name} yêu cầu {$typeLabel} đơn {$code}: {$validated['message']}",
            'is_read'     => false,
            'created_at'  => $now,
            'group_key'   => $groupKey,
        ])->all();
        Notification::insert($rows);

        return response()->json(['message' => 'Đã gửi yêu cầu thành công. Nhân viên sẽ liên hệ bạn sớm nhất có thể.']);
    }

    // =========================================================================
    // API ĐỔI LỊCH TỰ ĐỘNG CHO TỪNG BUỔI (kể cả buổi lẻ trong hợp đồng)
    // =========================================================================
    /**
     * Chức năng: Khách yêu cầu đổi lịch một buổi cụ thể theo chính sách:
     * - Báo TRƯỚC giờ chơi + giờ mới trống  → đổi ngay (approved).
     * - Báo TRƯỚC nhưng giờ mới đã bận      → từ chối kèm danh sách giờ rảnh của sân.
     * - Báo SAU giờ chơi                     → mất buổi (forfeited), không hoàn tiền.
     */
    public function rescheduleSession(Request $request)
    {
        $validated = $request->validate([
            'booking_code' => ['required', 'string', 'max:50'],
            'new_date'     => ['required', 'date'],
            'new_start'    => ['required', 'date_format:H:i'],
            'new_end'      => ['required', 'date_format:H:i', 'after:new_start'],
        ]);

        $user = $request->user();
        $code = strtoupper(trim($validated['booking_code']));

        $booking = Booking::with('details')
            ->where('booking_code', $code)
            ->where(fn($q) => $q->where('user_id', $user->id)->orWhereNull('user_id'))
            ->first();

        if (!$booking || $booking->details->isEmpty()) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy đơn đặt sân.'], 404);
        }

        if (in_array($booking->status, ['cancelled', 'completed'], true)) {
            return response()->json(['status' => 'error', 'message' => 'Đơn đã hủy hoặc đã hoàn thành, không thể đổi lịch.'], 400);
        }

        // Sắp xếp tất cả detail theo giờ bắt đầu để xác định block thời gian gốc
        $details     = $booking->details->sortBy('start_time')->values();
        $firstDetail = $details->first();
        $lastDetail  = $details->last();

        $oldDate    = Carbon::parse($firstDetail->booking_date)->format('Y-m-d');
        $oldStartAt = Carbon::parse($oldDate . ' ' . $firstDetail->start_time);

        // Tổng thời lượng gốc (phút) = từ đầu buổi đầu đến cuối buổi cuối
        $origTotalMinutes = (strtotime($lastDetail->end_time) - strtotime($firstDetail->start_time)) / 60;

        // Thời lượng khung giờ mới phải bằng gốc
        $newTotalMinutes = (strtotime($validated['new_end'] . ':00') - strtotime($validated['new_start'] . ':00')) / 60;

        if ($newTotalMinutes !== $origTotalMinutes) {
            $hours = $origTotalMinutes / 60;
            return response()->json([
                'status'  => 'error',
                'message' => "Đơn gốc có tổng {$hours} giờ. Vui lòng chọn khung giờ mới có cùng thời lượng ({$hours} giờ).",
            ], 422);
        }

        $detailIds = $details->pluck('id')->all();
        $courtId   = $firstDetail->court_id;

        return DB::transaction(function () use ($validated, $booking, $details, $firstDetail, $lastDetail, $oldStartAt, $origTotalMinutes, $detailIds, $courtId) {
            // ─── BÁO SAU: giờ chơi đã qua → mất buổi ───
            if (now()->greaterThanOrEqualTo($oldStartAt)) {
                $booking->update(['status' => 'completed']);

                return response()->json([
                    'status'  => 'error',
                    'policy'  => 'forfeited',
                    'message' => 'Bạn báo đổi lịch sau giờ chơi nên buổi này bị mất theo chính sách. Không hoàn tiền.',
                ], 422);
            }

            if ($validated['new_date'] < now()->format('Y-m-d')) {
                return response()->json(['status' => 'error', 'message' => 'Ngày mới phải từ hôm nay trở đi.'], 422);
            }

            // ─── Tính thời gian mới cho từng detail (giữ nguyên offset và độ dài từng slot) ───
            $origBlockStart = strtotime($firstDetail->start_time);
            $newBlockStart  = strtotime($validated['new_start'] . ':00');

            $updatedDetails = $details->map(function ($detail) use ($origBlockStart, $newBlockStart, $validated, $courtId) {
                $offsetSec   = strtotime($detail->start_time) - $origBlockStart;
                $durationSec = strtotime($detail->end_time) - strtotime($detail->start_time);
                $newStart    = date('H:i:s', $newBlockStart + $offsetSec);
                $newEnd      = date('H:i:s', $newBlockStart + $offsetSec + $durationSec);

                return [
                    'detail'    => $detail,
                    'new_start' => $newStart,
                    'new_end'   => $newEnd,
                    'new_date'  => $validated['new_date'],
                    'duration'  => $durationSec / 60,
                ];
            });

            // ─── BÁO TRƯỚC: kiểm tra toàn bộ khung giờ mới có trống không ───
            $isBusy = BookingDetail::where('court_id', $courtId)
                ->where('booking_date', $validated['new_date'])
                ->whereNotIn('id', $detailIds)
                ->where(fn($q) => $q
                    ->where('start_time', '<', $validated['new_end'] . ':00')
                    ->where('end_time', '>', $validated['new_start'] . ':00'))
                ->whereHas('booking', fn($q) => $q->where('status', '!=', 'cancelled'))
                ->exists();

            if ($isBusy) {
                $freeSlots = $this->findFreeSlots($courtId, $validated['new_date'], $detailIds);

                return response()->json([
                    'status'     => 'error',
                    'policy'     => 'busy',
                    'message'    => 'Khung giờ bạn chọn đã có người đặt. Vui lòng chọn theo giờ rảnh của sân bên dưới.',
                    'free_slots' => $freeSlots,
                ], 409);
            }

            // ─── Thuận lợi: cập nhật tất cả detail và tính lại tổng giá ───
            $oldTotalCourtPrice = 0;
            $newTotalCourtPrice = 0;

            foreach ($updatedDetails as $item) {
                $detail   = $item['detail'];
                $newPrice = $this->internalCalculatePrice($courtId, $item['new_date'], substr($item['new_start'], 0, 5), substr($item['new_end'], 0, 5));
                $duration = $item['duration'];

                $oldTotalCourtPrice += (float) $detail->price;
                $newTotalCourtPrice += $newPrice;

                $detail->update([
                    'booking_date'     => $item['new_date'],
                    'start_time'       => $item['new_start'],
                    'end_time'         => $item['new_end'],
                    'duration_minutes' => $duration,
                    'price'            => $newPrice,
                    'price_per_hour'   => $duration > 0 ? ($newPrice / ($duration / 60)) : 0,
                ]);
            }

            $priceDiff = $newTotalCourtPrice - $oldTotalCourtPrice;

            $booking->update([
                'subtotal_court'   => $booking->subtotal_court + $priceDiff,
                'total_price'      => $booking->total_price + $priceDiff,
                'remaining_amount' => max(0, (float) $booking->remaining_amount + $priceDiff),
            ]);

            return response()->json([
                'status'  => 'success',
                'policy'  => 'approved',
                'message' => 'Đổi lịch thành công!',
                'data'    => [
                    'booking_code' => $booking->booking_code,
                    'new_date'     => $validated['new_date'],
                    'new_time'     => $validated['new_start'] . ' - ' . $validated['new_end'],
                    'price_diff'   => $priceDiff,
                ],
            ]);
        });
    }

    // =========================================================================
    // API THỐNG KÊ SỐ BUỔI CỦA TÀI KHOẢN
    // =========================================================================
    /**
     * Chức năng: Tổng hợp số buổi của tài khoản: đã đặt, đã chơi, sắp tới, đã hủy,
     * và tổng chi tiêu — hiển thị ở trang lịch sử đặt sân.
     */
    public function myBookingStats(Request $request)
    {
        $user = $request->user();
        $today = now()->format('Y-m-d');

        $bookings = Booking::where('user_id', $user->id)->with('details:id,booking_id,booking_date')->get();

        $played = 0;
        $upcoming = 0;
        foreach ($bookings as $b) {
            if (in_array($b->status, ['cancelled'], true)) continue;
            $date = optional($b->details->first())->booking_date;
            if (!$date) continue;
            $d = Carbon::parse($date)->format('Y-m-d');
            if ($b->status === 'completed' || $d < $today) $played++;
            elseif ($d >= $today) $upcoming++;
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'total_sessions'     => $bookings->whereNotIn('status', ['cancelled'])->count(),
                'played_sessions'    => $played,
                'upcoming_sessions'  => $upcoming,
                'cancelled_sessions' => $bookings->where('status', 'cancelled')->count(),
                'total_spent'        => (float) $bookings->whereNotIn('status', ['cancelled'])
                    ->whereIn('payment_status', ['paid', 'partially_paid'])
                    ->sum(fn($b) => (float) $b->total_price - (float) $b->remaining_amount),
                'points'             => (int) $user->points,
            ],
        ]);
    }

    /**
     * Chức năng: Liệt kê các khung giờ 1 tiếng còn trống của sân trong một ngày (06:00–22:00).
     */
    private function findFreeSlots(string $courtId, string $date, array|string|null $excludeDetailIds = null): array
    {
        $excludeIds = is_array($excludeDetailIds) ? $excludeDetailIds : array_filter([$excludeDetailIds]);

        $busy = BookingDetail::where('court_id', $courtId)
            ->where('booking_date', $date)
            ->when(!empty($excludeIds), fn($q) => $q->whereNotIn('id', $excludeIds))
            ->whereHas('booking', fn($q) => $q->where('status', '!=', 'cancelled'))
            ->get(['start_time', 'end_time']);

        $freeSlots = [];
        for ($hour = 6; $hour < 22; $hour++) {
            $start = sprintf('%02d:00:00', $hour);
            $end = sprintf('%02d:00:00', $hour + 1);

            $overlap = $busy->first(fn($b) => $b->start_time < $end && $b->end_time > $start);
            if (!$overlap) {
                $freeSlots[] = ['start' => substr($start, 0, 5), 'end' => substr($end, 0, 5)];
            }
        }

        return $freeSlots;
    }
}
