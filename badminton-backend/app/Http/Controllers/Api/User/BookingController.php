<?php

namespace App\Http\Controllers\Api\User;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\BookingDetail;
use App\Models\BookingIntent;
use App\Models\Court;
use App\Models\RecurringBooking;
use App\Models\Review;
use App\Models\Notification;
use App\Models\MembershipCard;
use App\Models\Promotion;
use App\Models\User;
use App\Services\CourtPricingResolver;
use App\Services\MembershipTierService;
use App\Services\PaymentService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class BookingController extends Controller
{
    public function __construct(private CourtPricingResolver $pricingResolver)
    {
    }

    // =========================================================================
    // 1. API CÔNG KHAI: Xem lịch trống của 1 ngày
    // =========================================================================
    // tra cuu lich trong/ban cua mot san theo ngay de khach chon khung gio dat
    public function getCourtAvailability(Request $request, $courtId)
    {
        $request->validate([
            'date' => 'required|date'
        ]);
        //kiểm tra phân quyền truy cập sân
        $court = Court::find($courtId);
        if ($accessError = $this->courtBookingAccessError($court, $request->user('sanctum'))) {
            return response()->json([
                'status' => 'error',
                'message' => $accessError,
            ], $court && $court->is_contract_only ? 403 : 422);
        }

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
            $pricings = $this->pricingResolver->effectiveForDate($targetDate);

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
    // chot dat san le hoac dinh ky, tinh gia, giam gia, chong trung lich va tao booking
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
            'slots.*.date' => 'required_with:slots|date|after_or_equal:today',
            'slots.*.start' => 'required_with:slots|date_format:H:i',
            'slots.*.end' => 'required_with:slots|date_format:H:i',

            // Đặt định kỳ
            'start_date' => 'required_if:booking_type,recurring|date|after_or_equal:today',
            'end_date' => 'required_if:booking_type,recurring|date|after_or_equal:start_date',
            'days_of_week' => 'required_if:booking_type,recurring|array|min:1',
            'days_of_week.*' => 'integer|min:1|max:7',
            'start_time' => 'required_if:booking_type,recurring|date_format:H:i',
            'end_time' => 'required_if:booking_type,recurring|date_format:H:i|after:start_time',
            'time_slots' => 'nullable|array',
            'time_slots.*.start' => 'required_with:time_slots|date_format:H:i',
            'time_slots.*.end' => 'required_with:time_slots|date_format:H:i',

            // Đặt dài hạn
            'lt_start_date' => 'required_if:booking_type,long_term|date|after_or_equal:today',
            'lt_end_date' => 'required_if:booking_type,long_term|date|after_or_equal:lt_start_date',
            'specific_dates' => 'required_if:booking_type,long_term|array|min:1',
            'specific_dates.*' => 'date|after_or_equal:today',
            'lt_start_time' => 'required_if:booking_type,long_term|date_format:H:i',
            'lt_end_time' => 'required_if:booking_type,long_term|date_format:H:i|after:lt_start_time',

            // Đặt sân bằng thẻ thành viên (đã trả tiền khi mua thẻ → không cần QR)
            'membership_card_id' => ['nullable', 'exists:membership_cards,id'],
            'card_sessions_planned' => ['nullable', 'integer', 'min:1'],
            'use_membership_card' => ['nullable', 'boolean'],

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
        $staffId = $isStaffRequest ? $authUser->id : null;

        // Xác định tài khoản gắn với booking:
        // - Lễ tân tạo đơn định kỳ/dài hạn tại quầy thay mặt 1 khách hàng đã chọn.
        // - Webhook thanh toán tạo booking cho khách tự đặt (không có Sanctum session lúc đó).
        // - Khách tự đăng nhập đặt trực tiếp.
        if ($isStaffRequest && $request->filled('on_behalf_of_user_id')) {
            $user = User::find($request->on_behalf_of_user_id);
        } elseif ($isVerifiedPayment && !$authUser && $request->has('user_id')) {
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
        // Thẻ thành viên cho hợp đồng định kỳ/dài hạn: nếu thẻ cover TRỌN toàn bộ hợp đồng thì
        // cho tạo trực tiếp (0đ, không cần QR); nếu chỉ cover một phần thì phần còn lại vẫn phải
        // thanh toán online như thường (guard bên dưới vẫn yêu cầu is_verified_payment cho phần đó).
        $contractCard = null;
        $cardFullyCovers = false;
        if (
            in_array($request->booking_type, ['recurring', 'long_term'], true)
            && $request->boolean('use_membership_card')
            && $request->filled('membership_card_id')
        ) {
            $contractCard = MembershipCard::find($request->membership_card_id);
            if (!$contractCard || $contractCard->user_id !== $userId || !$contractCard->isUsable()) {
                return response()->json(['status' => 'error', 'message' => 'Thẻ thành viên không hợp lệ hoặc không thuộc tài khoản này.'], 422);
            }
            $coverage = $this->computeCardCoverage($contractCard, $this->buildContractSessionsForCoverage($request));
            $cardFullyCovers = $coverage['payable'] <= 0 && $coverage['covered_count'] > 0;
        }

        if (in_array($request->booking_type, ['recurring', 'long_term'], true)) {
            if (!$userId) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Định kỳ/dài hạn yêu cầu tài khoản khách hàng. Vui lòng đăng nhập hoặc chọn tài khoản khách.',
                ], 422);
            }
            if (!$isVerifiedPayment && !$staffConfirmedFullPayment && !$cardFullyCovers) {
                return response()->json([
                    'status' => 'error',
                    'message' => $isStaffRequest
                        ? 'Vui lòng xác nhận đã thu đủ 100% tại quầy trước khi tạo hợp đồng định kỳ/dài hạn.'
                        : 'Lịch định kỳ/dài hạn yêu cầu thanh toán 100% online khi đặt. Vui lòng chọn thanh toán chuyển khoản.',
                ], 422);
            }
        }

        // Kiểm tra sân đang hoạt động
        $court = Court::find($request->court_id);
        if ($accessError = $this->courtBookingAccessError($court, $user)) {
            return response()->json([
                'status' => 'error',
                'message' => $accessError,
            ], $court && $court->is_contract_only ? 403 : 422);
        }

        // Kiểm tra ngày đặt phải từ hôm nay trở đi
        $today = now()->format('Y-m-d');
        if ($request->booking_type === 'single') {
            foreach ($request->slots as $slot) {
                if ($slot['date'] < $today) {
                    return response()->json([
                        'status' => 'error',
                        'message' => "Không thể đặt sân cho ngày đã qua ({$slot['date']}).",
                    ], 422);
                }
            }
        }
        if ($request->booking_type === 'recurring' && $request->start_date < $today) {
            return response()->json([
                'status' => 'error',
                'message' => 'Ngày bắt đầu hợp đồng định kỳ phải từ hôm nay trở đi.',
            ], 422);
        }
        if ($request->booking_type === 'long_term' && $request->lt_start_date < $today) {
            return response()->json([
                'status' => 'error',
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

            if ($slotError = $this->singleSlotsValidationError($request->slots)) {
                return response()->json([
                    'status' => 'error',
                    'message' => $slotError,
                ], 422);
            }

            return DB::transaction(function () use ($request, $userId, $user, $promotion, $isStaffRequest, $staffId) {
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

                // Thẻ chỉ bao số ca thực sự còn khả dụng. Phần vượt ca, đã được giữ cho
                // đơn khác hoặc nằm ngoài hạn thẻ vẫn được tạo intent để thanh toán.
                $cardRequested = $request->boolean('use_membership_card')
                    && $request->filled('membership_card_id');
                $memberCardModel = null;
                if ($cardRequested) {
                    $memberCardModel = MembershipCard::whereKey($request->membership_card_id)
                        ->lockForUpdate()
                        ->first();

                    if (!$memberCardModel || $memberCardModel->user_id !== $userId) {
                        return response()->json([
                            'status' => 'error',
                            'message' => 'Thẻ thành viên không hợp lệ hoặc không thuộc tài khoản này.',
                        ], 422);
                    }

                    if (!$memberCardModel->isUsable()) {
                        $memberCardModel = null;
                    }
                }

                // Tính cùng một kế hoạch coverage/giá cho cả bước tạo QR và tạo đơn.
                $singlePlan = $this->buildSingleBookingPlan($request, $memberCardModel, $promotion, $user);
                $preparedGroups = [];
                $grandTotal = (float) $singlePlan['total_price'];
                $totalPayable = (float) $singlePlan['payable_total'];

                foreach ($singlePlan['groups'] as $pricedGroup) {
                    $group = $pricedGroup['group'];
                    $bookingId = (string) Str::uuid();
                    $bookingCode = 'BILL_' . strtoupper(Str::random(6));
                    $detailsToInsert = [];

                    foreach ($pricedGroup['slots'] as $pricedSlot) {
                        $slot = $pricedSlot['slot'];
                        $slotPrice = $pricedSlot['price'];
                        $minutes = (strtotime($slot['end']) - strtotime($slot['start'])) / 60;

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

                    $preparedGroups[] = [
                        'booking_id' => $bookingId,
                        'booking_code' => $bookingCode,
                        'group' => $group,
                        'booking_total' => $pricedGroup['booking_total'],
                        'total_price' => $pricedGroup['total_price'],
                        'card_value' => $pricedGroup['card_value'],
                        'covered_count' => $pricedGroup['covered_count'],
                        'discount_amount' => $pricedGroup['discount_amount'],
                        'payable_total' => $pricedGroup['payable_total'],
                        'promotion_id' => $pricedGroup['promotion_id'],
                        'promotion_discount' => $pricedGroup['promotion_discount'],
                        'details' => $detailsToInsert,
                    ];
                }

                // Chính sách "không giữ sân 0 đồng": đơn lẻ tạo tại quầy phải thu trước
                // tối thiểu deposit_percent% tổng tiền (cấu hình trong SystemSetting).
                // Đơn từ webhook thanh toán online (is_verified_payment) đã có tiền vào tài khoản
                // nên bỏ qua kiểm tra này.
                // Chỉ bỏ qua deposit guard khi webhook đã xác nhận tiền hoặc thẻ cover trọn.
                $isVerifiedPayment = (bool) $request->attributes->get('is_verified_payment')
                    || $totalPayable <= 0;
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
                $fallbackBookingId = null;

                foreach ($preparedGroups as $prepared) {
                    $bookingId = $prepared['booking_id'];
                    $bookingCode = $prepared['booking_code'];
                    $group = $prepared['group'];
                    $bookingTotal = $prepared['booking_total'];
                    $totalPrice = $prepared['total_price'];
                    $cardValue = $prepared['card_value'];
                    $coveredCount = $prepared['covered_count'];
                    $discountAmount = $prepared['discount_amount'];
                    $payableTotal = $prepared['payable_total'];
                    $currentPromotionId = $prepared['promotion_id'];
                    $promotionDiscount = $prepared['promotion_discount'];
                    $detailsToInsert = $prepared['details'];

                    $prepayment = $this->applyPrepayment($payableTotal, $prepaidRemaining);
                    $depositAmount = $cardValue + $prepayment['deposit_amount'];
                    $paymentStatus = $prepayment['remaining_amount'] <= 0
                        ? 'paid'
                        : ($depositAmount > 0 ? 'partially_paid' : 'unpaid');

                    Booking::insert([
                        'id' => $bookingId,
                        'booking_code' => $bookingCode,
                        'user_id' => $userId,
                        'recurring_booking_id' => null,
                        'staff_id' => $staffId,
                        'promotion_id' => $currentPromotionId,
                        'membership_card_id' => $coveredCount > 0 ? $memberCardModel->id : null,
                        'card_sessions_planned' => $coveredCount > 0 ? $coveredCount : null,
                        'subtotal_court' => $bookingTotal,
                        'subtotal_service' => 0,
                        'discount_amount' => $discountAmount,
                        'total_price' => $totalPrice,
                        'deposit_amount' => $depositAmount,
                        'remaining_amount' => $prepayment['remaining_amount'],
                        'customer_name' => $request->customer_name,
                        'customer_phone' => $request->customer_phone,
                        'status' => $prepayment['status'],
                        'payment_status' => $paymentStatus,
                        'created_at' => now()
                    ]);

                    BookingDetail::insert($detailsToInsert);

                    // Khi Lễ tân/Admin tự tạo đơn lẻ tại quầy và có thu tiền mặt trả trước
                    if ($isStaffRequest && $prepayment['deposit_amount'] > 0) {
                        $createdModel = Booking::find($bookingId);
                        if ($createdModel) {
                            app(PaymentService::class)->recordSuccessfulPayment($createdModel, [
                                'payment_code' => 'PAY-' . now()->format('YmdHis') . '-' . strtoupper(Str::random(6)),
                                'payment_method' => 'cash',
                                'amount' => $prepayment['deposit_amount'],
                                'paid_at' => now(),
                                'reference_code' => $bookingCode,
                                'payment_content' => 'Lễ tân tự tạo đơn lẻ và thu tiền mặt tại quầy',
                            ]);
                        }
                    }

                    // Đặt bằng thẻ thành viên: KHÔNG ghi payments — doanh thu đã được ghi
                    // 1 lần duy nhất lúc mua thẻ (kích hoạt thẻ). Ghi thêm ở đây là tính trùng.

                    $fallbackBookingId ??= $bookingId;
                    if (!$paymentBookingId && $payableTotal > 0) {
                        $paymentBookingId = $bookingId;
                    }

                    $createdBookings[] = [
                        'booking_id' => $bookingId,
                        'booking_code' => $bookingCode,
                        'total_price' => $totalPrice,
                        'payable_amount' => $payableTotal,
                        'card_sessions' => $coveredCount,
                        'discount_amount' => $discountAmount,
                        'promotion_discount' => $promotionDiscount,
                        'slots_count' => count($group),
                        'start_time' => $group[0]['start'],
                        'end_time' => $group[count($group) - 1]['end'],
                    ];
                }

                $paymentBookingId ??= $fallbackBookingId;

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

            return DB::transaction(function () use ($request, $userId, $user, $promotion, $targetDates, $selectedDays, $staffConfirmedFullPayment, $contractCard, $isStaffRequest, $staffId) {
                // Khóa toàn bộ sân vì buổi trùng lịch có thể được chuyển sang sân khác
                DB::table('courts')->lockForUpdate()->get();

                $plan = $this->planContractSlotCourts($request->court_id, $targetDates, $this->contractTimeSlots($request, 'recurring'));

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

                $res = $this->processContractBookings(
                    $recurring->id,
                    $plan,
                    $contractCard,
                    $promotion,
                    $user,
                    $request,
                    $noPartialPrepay,
                    $staffConfirmedFullPayment,
                    $staffId
                );

                $bookingsToInsert = $res['bookingsToInsert'];
                $detailsToInsert = $res['detailsToInsert'];
                $paymentBookingId = $res['paymentBookingId'];
                $totalContractAmount = $res['totalContractAmount'];

                Booking::insert($bookingsToInsert);
                BookingDetail::insert($detailsToInsert);

                if (($isStaffRequest || $staffConfirmedFullPayment) && !empty($bookingsToInsert)) {
                    foreach ($bookingsToInsert as $bData) {
                        $cashAmount = (float) ($bData['deposit_amount'] ?? 0);
                        if ($cashAmount > 0 && empty($bData['membership_card_id']) && $bData['status'] !== 'cancelled') {
                            $createdModel = Booking::find($bData['id']);
                            if ($createdModel) {
                                app(PaymentService::class)->recordSuccessfulPayment($createdModel, [
                                    'payment_code' => 'PAY-' . now()->format('YmdHis') . '-' . strtoupper(Str::random(6)),
                                    'payment_method' => 'cash',
                                    'amount' => $cashAmount,
                                    'paid_at' => now(),
                                    'reference_code' => $bData['booking_code'],
                                    'payment_content' => 'Lễ tân tự tạo hợp đồng định kỳ và thu tiền mặt tại quầy',
                                ]);
                            }
                        } elseif ($cashAmount > 0 && !empty($bData['membership_card_id']) && $bData['status'] !== 'cancelled') {
                            $payableCash = max(0, (float) $bData['total_price'] - ((float) ($contractCard?->price_per_session ?? 0) * (int) ($bData['card_sessions_planned'] ?? 0)));
                            if ($payableCash > 0) {
                                $createdModel = Booking::find($bData['id']);
                                if ($createdModel) {
                                    app(PaymentService::class)->recordSuccessfulPayment($createdModel, [
                                        'payment_code' => 'PAY-' . now()->format('YmdHis') . '-' . strtoupper(Str::random(6)),
                                        'payment_method' => 'cash',
                                        'amount' => $payableCash,
                                        'paid_at' => now(),
                                        'reference_code' => $bData['booking_code'],
                                        'payment_content' => 'Lễ tân thu tiền mặt phần ca thừa ngoài thẻ thành viên cho định kỳ',
                                    ]);
                                }
                            }
                        }
                    }
                }

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

            return DB::transaction(function () use ($request, $userId, $user, $promotion, $targetDates, $rangeStart, $rangeEnd, $staffConfirmedFullPayment, $contractCard, $isStaffRequest, $staffId) {
                // Khóa toàn bộ sân vì buổi trùng lịch có thể được chuyển sang sân khác
                DB::table('courts')->lockForUpdate()->get();

                $plan = $this->planContractSlotCourts($request->court_id, $targetDates, $this->contractTimeSlots($request, 'long_term'));

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

                $res = $this->processContractBookings(
                    $longTerm->id,
                    $plan,
                    $contractCard,
                    $promotion,
                    $user,
                    $request,
                    $noPartialPrepay,
                    $staffConfirmedFullPayment,
                    $staffId
                );

                $bookingsToInsert = $res['bookingsToInsert'];
                $detailsToInsert = $res['detailsToInsert'];
                $paymentBookingId = $res['paymentBookingId'];
                $totalContractAmount = $res['totalContractAmount'];

                Booking::insert($bookingsToInsert);
                BookingDetail::insert($detailsToInsert);

                if (($isStaffRequest || $staffConfirmedFullPayment) && !empty($bookingsToInsert)) {
                    foreach ($bookingsToInsert as $bData) {
                        $cashAmount = (float) ($bData['deposit_amount'] ?? 0);
                        if ($cashAmount > 0 && empty($bData['membership_card_id']) && $bData['status'] !== 'cancelled') {
                            $createdModel = Booking::find($bData['id']);
                            if ($createdModel) {
                                app(PaymentService::class)->recordSuccessfulPayment($createdModel, [
                                    'payment_code' => 'PAY-' . now()->format('YmdHis') . '-' . strtoupper(Str::random(6)),
                                    'payment_method' => 'cash',
                                    'amount' => $cashAmount,
                                    'paid_at' => now(),
                                    'reference_code' => $bData['booking_code'],
                                    'payment_content' => 'Lễ tân tự tạo hợp đồng dài hạn và thu tiền mặt tại quầy',
                                ]);
                            }
                        } elseif ($cashAmount > 0 && !empty($bData['membership_card_id']) && $bData['status'] !== 'cancelled') {
                            $payableCash = max(0, (float) $bData['total_price'] - ((float) ($contractCard?->price_per_session ?? 0) * (int) ($bData['card_sessions_planned'] ?? 0)));
                            if ($payableCash > 0) {
                                $createdModel = Booking::find($bData['id']);
                                if ($createdModel) {
                                    app(PaymentService::class)->recordSuccessfulPayment($createdModel, [
                                        'payment_code' => 'PAY-' . now()->format('YmdHis') . '-' . strtoupper(Str::random(6)),
                                        'payment_method' => 'cash',
                                        'amount' => $payableCash,
                                        'paid_at' => now(),
                                        'reference_code' => $bData['booking_code'],
                                        'payment_content' => 'Lễ tân thu tiền mặt phần ca thừa ngoài thẻ thành viên cho dài hạn',
                                    ]);
                                }
                            }
                        }
                    }
                }

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
    // 3. API CHUẨN BỊ THANH TOÁN ONLINE (tạo intent, chưa tạo booking). chuẩn bị thông tin thanh toán
    // =========================================================================
    // validate params, tinh tong tien, luu intent tam thoi
    public function preparePayment(Request $request)
    {
        $request->validate([
            'booking_type' => 'required|in:single,recurring,long_term',
            'court_id' => 'required|exists:courts,id',
            'customer_name' => 'required|string|max:100',
            'customer_phone' => 'required|string|max:20',
            'promotion_code' => 'nullable|string|max:50',
            'membership_card_id' => 'nullable|exists:membership_cards,id',
            'card_sessions_planned' => 'nullable|integer|min:1',
            'use_membership_card' => 'nullable|boolean',
            // Chỉ đặt lẻ mới được chọn cọc giữ chỗ; định kỳ/dài hạn luôn thanh toán đủ.
            'payment_option' => ['nullable', 'in:full,deposit'],
            'slots' => 'required_if:booking_type,single|array',
            'slots.*.date' => 'required_with:slots|date|after_or_equal:today',
            'slots.*.start' => 'required_with:slots|date_format:H:i',
            'slots.*.end' => 'required_with:slots|date_format:H:i',
            'start_date' => 'required_if:booking_type,recurring|date|after_or_equal:today',
            'end_date' => 'required_if:booking_type,recurring|date|after_or_equal:start_date',
            'days_of_week' => 'required_if:booking_type,recurring|array|min:1',
            'days_of_week.*' => 'integer|min:1|max:7',
            'start_time' => 'required_if:booking_type,recurring|date_format:H:i',
            'end_time' => 'required_if:booking_type,recurring|date_format:H:i|after:start_time',
            'time_slots' => 'nullable|array',
            'time_slots.*.start' => 'required_with:time_slots|date_format:H:i',
            'time_slots.*.end' => 'required_with:time_slots|date_format:H:i',
            'lt_start_date' => 'required_if:booking_type,long_term|date|after_or_equal:today',
            'lt_end_date' => 'required_if:booking_type,long_term|date|after_or_equal:lt_start_date',
            'specific_dates' => 'required_if:booking_type,long_term|array|min:1',
            'specific_dates.*' => 'date|after_or_equal:today',
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
        $court = Court::find($request->court_id);
        if ($accessError = $this->courtBookingAccessError($court, $user)) {
            return response()->json([
                'status' => 'error',
                'message' => $accessError,
            ], $court && $court->is_contract_only ? 403 : 422);
        }

        if (in_array($type, ['recurring', 'long_term']) && !$request->user('sanctum')) {
            return response()->json(['status' => 'error', 'message' => 'Vui lòng đăng nhập để sử dụng tính năng này!'], 401);
        }

        // Kiểm tra trùng lịch trước khi tạo intent
        if ($type === 'single') {
            if ($slotError = $this->singleSlotsValidationError($request->slots)) {
                return response()->json([
                    'status' => 'error',
                    'message' => $slotError,
                ], 422);
            }

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

            $plan = $this->planContractSlotCourts($request->court_id, $targetDates, $this->contractTimeSlots($request, 'recurring'));
            if (empty($plan['sessions'])) {
                return response()->json(['status' => 'error', 'message' => 'Tất cả các buổi đều đã kín sân trong khung giờ này!'], 400);
            }
            // Cần xác nhận điều chỉnh trước khi hiện QR; sau khi khách đồng ý,
            // accept_adjustments đi kèm payload nên store() ở webhook sẽ tự áp kế hoạch.
            if ((!empty($plan['moved']) || !empty($plan['unavailable'])) && !$request->boolean('accept_adjustments')) {
                return $this->adjustmentsRequiredResponse($plan);
            }
        } elseif ($type === 'long_term') {
            $plan = $this->planContractSlotCourts($request->court_id, array_unique($request->specific_dates), $this->contractTimeSlots($request, 'long_term'));
            if (empty($plan['sessions'])) {
                return response()->json(['status' => 'error', 'message' => 'Tất cả các buổi đều đã kín sân trong khung giờ này!'], 400);
            }
            if ((!empty($plan['moved']) || !empty($plan['unavailable'])) && !$request->boolean('accept_adjustments')) {
                return $this->adjustmentsRequiredResponse($plan);
            }
        }

        // Đặt lẻ dùng tối đa số ca khả dụng; phần không được thẻ cover sẽ tính tiền.
        $singlePlan = null;
        if ($type === 'single') {
            $memberCardModel = null;
            if ($request->boolean('use_membership_card') && $request->filled('membership_card_id')) {
                $memberCardModel = MembershipCard::find($request->membership_card_id);
                if (!$memberCardModel || $memberCardModel->user_id !== $user?->id) {
                    return response()->json(['status' => 'error', 'message' => 'Thẻ thành viên không hợp lệ.'], 422);
                }
                if (!$memberCardModel->isUsable()) {
                    $memberCardModel = null;
                }
            }

            $singlePlan = $this->buildSingleBookingPlan(
                $request,
                $memberCardModel,
                $promotion,
                $user
            );

            if ($memberCardModel && $singlePlan['payable_total'] <= 0 && $singlePlan['covered_count'] > 0) {
                return response()->json([
                    'status' => 'success',
                    'data' => [
                        'fully_covered' => true,
                        'amount' => 0,
                        'covered_count' => $singlePlan['covered_count'],
                        'covered_ca' => $singlePlan['covered_count'],
                    ],
                ]);
            }
        }

        // Thẻ thành viên cho hợp đồng định kỳ/dài hạn: chỉ thu phần thẻ KHÔNG cover được.
        $contractPayable = null;
        if (
            in_array($type, ['recurring', 'long_term'], true)
            && $request->boolean('use_membership_card')
            && $request->filled('membership_card_id')
        ) {
            $card = MembershipCard::find($request->membership_card_id);
            if (!$card || $card->user_id !== $user?->id || !$card->isUsable()) {
                return response()->json(['status' => 'error', 'message' => 'Thẻ thành viên không hợp lệ hoặc không thuộc tài khoản này.'], 422);
            }
            $coverage = $this->computeCardCoverage($card, $this->buildContractSessionsForCoverage($request));
            $contractPayable = (float) $coverage['payable'];

            // Thẻ cover TRỌN → không cần QR, báo frontend tạo đơn trực tiếp
            if ($contractPayable <= 0) {
                return response()->json([
                    'status' => 'success',
                    'data' => [
                        'fully_covered' => true,
                        'amount' => 0,
                        'covered_count' => $coverage['covered_count'],
                    ],
                ]);
            }
        }

        // Tính tổng tiền (100%) và số tiền thực sự cần chuyển khoản (100% hoặc % cọc).
        if ($singlePlan !== null) {
            $fullAmount = (float) $singlePlan['payable_total'];
        } elseif ($contractPayable !== null) {
            $fullAmount = $contractPayable;
        } else {
            $fullAmount = $this->calculateFullBookingAmount($request, $promotion, $user);
        }
        if ($fullAmount <= 0) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy bảng giá hợp lệ cho toàn bộ khung giờ đã chọn.',
            ], 422);
        }

        $isDeposit = $type === 'single' && $request->payment_option === 'deposit';
        if ($isDeposit) {
            $depositPercent = (float) (\App\Models\SystemSetting::getAll()['deposit_percent'] ?? 20);
            $depositPercent = max(1, min(100, $depositPercent));
            $amount = max(1000, min($fullAmount, round($fullAmount * $depositPercent / 100)));
        } else {
            $amount = $fullAmount;
        }
        $remainingAtVenue = $isDeposit ? max(0, $fullAmount - $amount) : 0;

        // Xóa các intent cũ đã hết hạn
        BookingIntent::where('booking_type', '!=', 'membership')
            ->where('expires_at', '<', now())
            ->delete();
        BookingIntent::where('booking_type', 'membership')
            ->where('expires_at', '<', now()->subDay())
            ->delete();

        $intentCode = 'PAY' . strtoupper(Str::random(7));
        $intent = BookingIntent::create([
            'id' => (string) Str::uuid(),
            'intent_code' => $intentCode,
            'payload' => $request->except('promotion_code') + ['promotion_code' => $promotion?->code ?? $request->promotion_code, 'user_id' => $user?->id],
            'amount' => $amount,
            'booking_type' => $type,
            'expires_at' => now()->addMinutes(30),
        ]);

        $bankName = config('services.sepay.bank_name');
        $bankAccount = config('services.sepay.bank_account');
        $accountHolder = config('services.sepay.account_holder');
        $transferPrefix = config('services.sepay.transfer_prefix');
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
                'covered_count' => (int) ($singlePlan['covered_count'] ?? ($coverage['covered_count'] ?? 0)),
                'expires_at' => $intent->expires_at,
                'bank_name' => $bankName,
                'bank_account' => $bankAccount,
                'account_holder' => $accountHolder,
                'transfer_content' => $transferContent,
                'qr_url' => $qrUrl,
            ]
        ]);
    }

    // tinh tong tien day du (100%) cua don theo loai dat san, ap dung
    private function calculateFullBookingAmount(Request $request, ?Promotion $promotion, $user): float
    {
        $type = $request->booking_type;
        $total = 0;
        $promotionApplied = false;

        if ($type === 'single') {
            $subtotal = 0;
            $totalMinutes = 0;
            foreach ($request->slots as $slot) {
                $price = (float) $this->internalCalculatePrice($request->court_id, $slot['date'], $slot['start'], $slot['end']);
                $minutes = max(0, (strtotime($slot['end']) - strtotime($slot['start'])) / 60);
                $subtotal += $price;
                $totalMinutes += $minutes;
            }
            $loyaltyDiscount = $this->calculateLoyaltyDiscount($user, $totalMinutes);
            $promoDiscount = $promotion ? $this->calculatePromotionDiscount($promotion, $subtotal) : 0;
            return max(0, $subtotal - min($subtotal, $loyaltyDiscount + $promoDiscount));
        } elseif ($type === 'recurring') {
            $start = \Carbon\Carbon::parse($request->start_date);
            $end = \Carbon\Carbon::parse($request->end_date);
            $selectedDays = array_map('intval', $request->days_of_week);
            $timeSlots = $this->contractTimeSlots($request, 'recurring');
            $minutes = $this->contractTotalMinutes($timeSlots);
            $targetDates = [];
            for ($date = $start->copy(); $date->lte($end); $date->addDay()) {
                if (in_array((int) $date->format('N'), $selectedDays)) {
                    $targetDates[] = $date->format('Y-m-d');
                }
            }
            // Chỉ tính tiền các buổi thực sự đặt được (buổi trùng đã đổi sân, buổi kín hết sân thì bỏ)
            $plan = $this->planContractSlotCourts($request->court_id, $targetDates, $timeSlots);
            foreach ($plan['sessions'] as $playDate => $slotPlans) {
                $price = array_sum(array_map(
                    fn($slotPlan) => $this->internalCalculatePrice($slotPlan['court_id'], $playDate, $slotPlan['start'], $slotPlan['end']),
                    $slotPlans
                ));
                $loyaltyDiscount = $this->calculateLoyaltyDiscount($user, $minutes);
                $promoDiscount = (!$promotionApplied && $promotion) ? $this->calculatePromotionDiscount($promotion, $price) : 0;
                $total += max(0, $price - min($price, $loyaltyDiscount + $promoDiscount));
                $promotionApplied = $promotionApplied || $promoDiscount > 0;
            }
        } elseif ($type === 'long_term') {
            $timeSlots = $this->contractTimeSlots($request, 'long_term');
            $minutes = $this->contractTotalMinutes($timeSlots);
            $rawDates = (array) ($request->specific_dates ?? $request->dates ?? []);
            $plan = $this->planContractSlotCourts($request->court_id, array_unique($rawDates), $timeSlots);
            foreach ($plan['sessions'] as $playDate => $slotPlans) {
                $price = array_sum(array_map(
                    fn($slotPlan) => $this->internalCalculatePrice($slotPlan['court_id'], $playDate, $slotPlan['start'], $slotPlan['end']),
                    $slotPlans
                ));
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
    // lay lich su dat san cua khach hang
    public function getUserBookings(Request $request)
    {
        $user = $request->user('sanctum');

        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Vui lòng đăng nhập!'
            ], 401);
        }

        $tab = $request->query('tab', 'all');
        $today = now()->format('Y-m-d');
        $perPage = 10;
        $page = max(1, (int) $request->query('page', 1));

        // Ngưỡng giờ tối thiểu trước giờ chơi để còn được gửi yêu cầu hủy/đổi (mặc định 24h)
        $minHours = max(0, (float) (\App\Models\SystemSetting::getAll()['cancel_request_min_hours'] ?? 24));

        // ── A. ĐƠN LẺ (không có recurring_booking_id) ──────────────────────
        $singleQuery = Booking::with([
            'details' => fn($q) => $q->with('court')->orderBy('booking_date')->orderBy('start_time'),
        ])->where('user_id', $user->id)->whereNull('recurring_booking_id');

        if ($tab === 'upcoming') {
            $singleQuery->where('status', '!=', 'cancelled')
                ->whereHas('details', fn($q) => $q->where('booking_date', '>=', $today));
        } elseif ($tab === 'history') {
            $singleQuery->where(
                fn($q) => $q
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
        $reviewedIds = Review::where('user_id', $user->id)
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
            $last = $b->details->last();
            $earliestStart = $first
                ? Carbon::parse(Carbon::parse($first->booking_date)->format('Y-m-d') . ' ' . $first->start_time)
                : null;
            $lockedByTime = $earliestStart ? now()->addHours($minHours)->greaterThan($earliestStart) : false;
            $items[] = [
                'item_type' => 'single',
                'booking_id' => $b->id,
                'booking_code' => $b->booking_code,
                'type_label' => 'Đặt Lẻ',
                'total_price' => (float) $b->total_price,
                'status' => $b->status,
                'payment_status' => $b->payment_status,
                'has_reviewed' => isset($reviewedIds[$b->id]),
                'created_at' => Carbon::parse($b->created_at)->format('d/m/Y H:i'),
                'details_count' => $b->details->count(),
                'request_locked_by_time' => $lockedByTime,
                'summary' => $first ? [
                    'court_id' => $first->court_id,
                    'court_name' => $first->court?->name ?? '—',
                    'play_date' => Carbon::parse($first->booking_date)->format('d/m/Y'),
                    'time_slot' => substr($first->start_time, 0, 5) . ' - ' . substr($last->end_time, 0, 5),
                ] : null,
                '_sort' => $b->created_at?->timestamp ?? 0,
            ];
        }

        foreach ($groups as $g) {
            $sessions = $g->bookings;
            $totalSessions = $sessions->count();
            $completedCnt = $sessions->where('status', 'completed')->count();
            $paidCnt = $sessions->where('payment_status', 'paid')->count();
            $totalPrice = $sessions->sum('total_price');

            if ($g->status === 'cancelled') {
                $groupStatus = 'cancelled';
            } elseif ($completedCnt === $totalSessions && $totalSessions > 0) {
                $groupStatus = 'completed';
            } else {
                $groupStatus = 'active';
            }

            // Giờ bắt đầu buổi sớm nhất còn ở tương lai của hợp đồng → khóa nút nếu trong ngưỡng giờ
            $groupStarts = $sessions->flatMap(
                fn($b) => $b->details->map(
                    fn($d) => Carbon::parse(Carbon::parse($d->booking_date)->format('Y-m-d') . ' ' . $d->start_time)
                )
            );
            $groupFuture = $groupStarts->filter(fn($c) => $c->isFuture());
            $groupEarliest = $groupFuture->isNotEmpty()
                ? $groupFuture->min()
                : ($groupStarts->isEmpty() ? null : $groupStarts->min());
            $groupLockedByTime = $groupEarliest
                ? now()->addHours($minHours)->greaterThan($groupEarliest)
                : false;

            $sessionsFormatted = $sessions->map(function ($b) use ($groupReviewedIds) {
                $first = $b->details->first();
                $last = $b->details->last();
                return [
                    'booking_id' => $b->id,
                    'booking_code' => $b->booking_code,
                    'status' => $b->status,
                    'payment_status' => $b->payment_status,
                    'total_price' => (float) $b->total_price,
                    'has_reviewed' => isset($groupReviewedIds[$b->id]),
                    'court_id' => $first?->court_id,
                    'court_name' => $first?->court?->name ?? '—',
                    'play_date' => $first ? Carbon::parse($first->booking_date)->format('d/m/Y') : null,
                    'play_date_raw' => $first?->booking_date,
                    'time_slot' => $first
                        ? substr($first->start_time, 0, 5) . ' - ' . substr($last->end_time, 0, 5)
                        : null,
                ];
            })->values();

            $groupSlotTimes = $sessions->flatMap(fn($b) => $b->details)
                ->map(fn($d) => substr($d->start_time, 0, 5) . ' - ' . substr($d->end_time, 0, 5))
                ->unique()
                ->values()
                ->toArray();
            $groupTimeSlotStr = !empty($groupSlotTimes)
                ? implode(', ', $groupSlotTimes)
                : (substr($g->start_time, 0, 5) . ' - ' . substr($g->end_time, 0, 5));

            $items[] = [
                'item_type' => 'group',
                'recurring_id' => $g->id,
                'recurring_code' => $g->recurring_code,
                'group_type' => $g->type,
                'type_label' => $g->type === 'long_term' ? 'Dài hạn' : 'Định kỳ',
                'court_name' => $g->court?->name ?? ($sessions->first()?->details->first()?->court?->name ?? '—'),
                'start_date' => Carbon::parse($g->start_date)->format('d/m/Y'),
                'end_date' => Carbon::parse($g->end_date)->format('d/m/Y'),
                'time_slot' => $groupTimeSlotStr,
                'total_sessions' => $totalSessions,
                'completed_sessions' => $completedCnt,
                'paid_sessions' => $paidCnt,
                'total_price' => (float) $totalPrice,
                'status' => $groupStatus,
                'request_locked_by_time' => $groupLockedByTime,
                'sessions' => $sessionsFormatted,
                '_sort' => strtotime($g->start_date) ?? 0,
            ];
        }
        usort($items, fn($a, $b) => $b['_sort'] - $a['_sort']);

        // Phân trang thủ công
        $total = count($items);
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = min($page, $lastPage);
        $sliced = array_slice($items, ($page - 1) * $perPage, $perPage);

        // Xóa key nội bộ
        $sliced = array_map(function ($item) {
            unset($item['_sort']);
            return $item;
        }, $sliced);

        return response()->json([
            'status' => 'success',
            'data' => [
                'data' => array_values($sliced),
                'current_page' => $page,
                'last_page' => $lastPage,
                'total' => $total,
            ],
        ]);
    }

    // =========================================================================
    // 4. API CONG KHAI: KHACH VANG LAI TRA CUU DON BANG MA DON + SO DIEN THOAI
    // =========================================================================
    // cho khach vang lai tra cuu don bang ma booking va so dien thoai
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

    // kiem tra ma voucher khi khach nhap truoc luc chot dat san
    public function validatePromotion(Request $request)
    {
        $validated = $request->validate([
            'promotion_code' => 'required|string|max:50',
            'customer_phone' => 'nullable|string|max:20',
            'total_amount' => 'required|numeric|min:0',
        ]);

        $user = $request->user('sanctum');
        $totalAmount = (float) $validated['total_amount'];
        $promotion = $this->resolvePromotionForBooking(
            $validated['promotion_code'],
            $user,
            $validated['customer_phone'] ?? null,
            $totalAmount
        );

        $discountAmount = $this->calculatePromotionDiscount($promotion, $totalAmount);

        return response()->json([
            'status' => 'success',
            'message' => 'Mã giảm giá hợp lệ.',
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

    // lap ke hoach gia cho dat le, gom phan the bao va phan khach phai thanh toan
    private function buildSingleBookingPlan(
        Request $request,
        ?MembershipCard $card,
        ?Promotion $promotion,
        $user
    ): array {
        $coverage = $card
            ? $this->computeCardCoverage($card, $this->buildSingleSessionsForCoverage($request))
            : ['covered' => [], 'covered_count' => 0, 'covered_ca' => 0, 'payable' => 0.0];

        $groups = [];
        $totalPrice = 0.0;
        $totalPayable = 0.0;
        $promotionApplied = false;

        foreach ($this->groupContinuousSlots($request->slots ?? []) as $group) {
            $pricedSlots = [];
            $uncoveredSubtotal = 0.0;
            $uncoveredMinutes = 0.0;
            $coveredCa = 0;

            foreach ($group as $slot) {
                $price = (float) $this->internalCalculatePrice(
                    $request->court_id,
                    $slot['date'],
                    $slot['start'],
                    $slot['end']
                );
                $minutes = max(0, (strtotime($slot['end']) - strtotime($slot['start'])) / 60);
                $ca = max(1, (int) round($minutes / 60));
                $isCovered = !empty($coverage['covered'][$this->singleSlotCoverageKey($slot)]);

                if ($isCovered) {
                    $coveredCa += $ca;
                } else {
                    $uncoveredSubtotal += $price;
                    $uncoveredMinutes += $minutes;
                }

                $pricedSlots[] = [
                    'slot' => $slot,
                    'price' => $price,
                    'covered' => $isCovered,
                    'ca' => $ca,
                ];
            }

            $cardValue = $card ? (float) $card->price_per_session * $coveredCa : 0.0;
            $loyaltyDiscount = $uncoveredSubtotal > 0
                ? $this->calculateLoyaltyDiscount($user, $uncoveredMinutes)
                : 0.0;
            $promotionDiscount = (!$promotionApplied && $promotion && $uncoveredSubtotal > 0)
                ? $this->calculatePromotionDiscount($promotion, $uncoveredSubtotal)
                : 0.0;
            $discountAmount = min($uncoveredSubtotal, $loyaltyDiscount + $promotionDiscount);
            $payableTotal = max(0, $uncoveredSubtotal - $discountAmount);
            $bookingTotal = $cardValue + $uncoveredSubtotal;
            $bookingFinalTotal = $cardValue + $payableTotal;

            $groups[] = [
                'group' => $group,
                'slots' => $pricedSlots,
                'booking_total' => $bookingTotal,
                'total_price' => $bookingFinalTotal,
                'card_value' => $cardValue,
                'covered_count' => $coveredCa,
                'discount_amount' => $discountAmount,
                'payable_total' => $payableTotal,
                'promotion_id' => $promotionDiscount > 0 ? $promotion->id : null,
                'promotion_discount' => $promotionDiscount,
            ];

            $totalPrice += $bookingFinalTotal;
            $totalPayable += $payableTotal;
            $promotionApplied = $promotionApplied || $promotionDiscount > 0;
        }

        return [
            'groups' => $groups,
            'total_price' => $totalPrice,
            'payable_total' => $totalPayable,
            'covered_count' => (int) ($coverage['covered_ca'] ?? 0),
        ];
    }

    // dung danh sach buoi choi cua don le de tinh the cover duoc bao nhieu ca
    private function buildSingleSessionsForCoverage(Request $request): array
    {
        $sessions = [];

        foreach ($request->slots ?? [] as $slot) {
            $minutes = max(0, (strtotime($slot['end']) - strtotime($slot['start'])) / 60);
            $sessions[] = [
                'key' => $this->singleSlotCoverageKey($slot),
                'date' => $slot['date'],
                'ca' => max(1, (int) round($minutes / 60)),
                'price' => (float) $this->internalCalculatePrice(
                    $request->court_id,
                    $slot['date'],
                    $slot['start'],
                    $slot['end']
                ),
            ];
        }

        return $sessions;
    }

    // tao khoa dinh danh duy nhat cho 1 khung gio (ngay|gio bat dau|gio ket thuc)
    private function singleSlotCoverageKey(array $slot): string
    {
        return $slot['date'] . '|' . substr($slot['start'], 0, 5) . '|' . substr($slot['end'], 0, 5);
    }

    // kiem tra cac khung gio khach chon co hop le va co bi trung nhau khong
    private function singleSlotsValidationError(array $slots): ?string
    {
        $slotsByDate = [];

        foreach ($slots as $slot) {
            if ($slot['end'] <= $slot['start']) {
                return "Khung giờ {$slot['start']}-{$slot['end']} không hợp lệ.";
            }

            foreach ($slotsByDate[$slot['date']] ?? [] as $existing) {
                if ($slot['start'] < $existing['end'] && $slot['end'] > $existing['start']) {
                    return "Các khung giờ ngày {$slot['date']} đang bị trùng nhau.";
                }
            }

            $slotsByDate[$slot['date']][] = $slot;
        }

        return null;
    }

    // kiem tra san co cho dat khong (dang hoat dong, khong bao tri, san hop dong thi phai co the)
    private function courtBookingAccessError(?Court $court, ?User $user): ?string
    {
        if (!$court || $court->status !== 'active' || $court->is_maintenance) {
            return 'Sân này hiện không nhận đặt lịch.';
        }

        if (!$court->is_contract_only) {
            return null;
        }

        $hasActiveCard = $user && MembershipCard::where('user_id', $user->id)
            ->where('status', 'active')
            ->where('valid_to', '>=', today())
            ->exists();

        return $hasActiveCard
            ? null
            : 'Sân này chỉ dành cho khách hàng có thẻ thành viên đang hoạt động.';
    }

    // =========================================================================
    // HÀM PHỤ: CHIA SLOT ĐẶT LẺ THÀNH CÁC NHÓM LIỀN NHAU
    // =========================================================================
    // gom cac khung gio lien tiep thanh cung mot hoa don va tach khung gio roi nhau
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
    // kiem tra mot khung gio co bi trung voi booking chua huy hay khong
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

    // lap ke hoach san cho tung buoi cua chuoi dinh ky/dai han
    private function planSessionCourts(string $preferredCourtId, array $dates, string $startTime, string $endTime): array
    {
        $courts = \App\Models\Court::where('status', 'active')
            ->where('is_maintenance', false)
            ->orderBy('name')
            ->get();

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
                    'date' => $date,
                    'court_id' => $alternative->id,
                    'court_name' => $alternative->name,
                ];
            } else {
                $unavailable[] = $date;
            }
        }

        return ['sessions' => $sessions, 'moved' => $moved, 'unavailable' => $unavailable];
    }

    // lay danh sach khung gio cua hop dong (nhieu khung hoac 1 khung mac dinh)
    private function contractTimeSlots(Request $request, string $type): array
    {
        $slots = collect((array) $request->input('time_slots', []))
            ->map(fn($slot) => [
                'start' => substr((string) ($slot['start'] ?? ''), 0, 5),
                'end' => substr((string) ($slot['end'] ?? ''), 0, 5),
            ])
            ->filter(fn($slot) => $slot['start'] && $slot['end'] && strtotime($slot['end']) > strtotime($slot['start']))
            ->sortBy('start')
            ->values()
            ->all();

        if (!empty($slots)) {
            return $slots;
        }

        return [
            [
                'start' => $type === 'recurring' ? $request->start_time : $request->lt_start_time,
                'end' => $type === 'recurring' ? $request->end_time : $request->lt_end_time,
            ]
        ];
    }

    // tinh tong so phut choi cua tat ca khung gio trong 1 buoi hop dong
    private function contractTotalMinutes(array $timeSlots): int
    {
        return (int) array_sum(array_map(
            fn($slot) => max(0, (strtotime($slot['end']) - strtotime($slot['start'])) / 60),
            $timeSlots
        ));
    }

    // lap ke hoach san cho tung buoi: buoi nao trung lich thi tu tim san khac con trong
    private function planContractSlotCourts(string $preferredCourtId, array $dates, array $timeSlots): array
    {
        $courts = \App\Models\Court::where('status', 'active')
            ->where('is_maintenance', false)
            ->orderBy('name')
            ->get();

        $sessions = [];
        $moved = [];
        $unavailable = [];

        foreach ($dates as $date) {
            $datePlans = [];
            $missingSlots = [];

            foreach ($timeSlots as $slot) {
                $start = $slot['start'];
                $end = $slot['end'];

                if (!$this->checkSlotBusy($preferredCourtId, $date, $start, $end)) {
                    $datePlans[] = ['court_id' => $preferredCourtId, 'start' => $start, 'end' => $end];
                    continue;
                }

                $alternative = $courts->first(
                    fn($c) => $c->id !== $preferredCourtId
                    && !$this->checkSlotBusy($c->id, $date, $start, $end)
                );

                if ($alternative) {
                    $datePlans[] = ['court_id' => $alternative->id, 'start' => $start, 'end' => $end];
                    $moved[] = [
                        'date' => $date,
                        'start_time' => $start,
                        'end_time' => $end,
                        'court_id' => $alternative->id,
                        'court_name' => $alternative->name,
                    ];
                } else {
                    $missingSlots[] = "{$start}-{$end}";
                }
            }

            if (!empty($datePlans)) {
                $sessions[$date] = $datePlans;
            }

            if (!empty($missingSlots)) {
                $unavailable[] = ['date' => $date, 'slots' => $missingSlots];
            }
        }

        return ['sessions' => $sessions, 'moved' => $moved, 'unavailable' => $unavailable];
    }

    // tra phan hoi http 409 kem ke hoach dieu chinh (buoi doi san / buoi bi bo)
    private function adjustmentsRequiredResponse(array $plan)
    {
        return response()->json([
            'status' => 'adjustments_required',
            'message' => 'Một số buổi bị trùng lịch, cần bạn xác nhận điều chỉnh trước khi đặt.',
            'data' => [
                'moved' => $plan['moved'],
                'unavailable' => $plan['unavailable'],
                'playable_count' => count($plan['sessions']),
            ],
        ], 409);
    }

    // =========================================================================
    // HÀM PHỤ: TÍNH ƯU ĐÃI ĐIỂM THÀNH VIÊN
    // =========================================================================
    // tinh giam gia theo diem thanh vien dua tren so phut khach dat san
    private function calculateLoyaltyDiscount(?User $user, int|float $totalMinutes): float
    {
        if (!$user || $user->role !== 'customer') {
            return 0;
        }

        return MembershipTierService::discountForMinutes((int) $user->points, $totalMinutes);
    }

    // ap tien tra truoc (le tan ghi nhan tai quay) vao 1 booking cu the
    private function applyPrepayment(float $payableTotal, float &$prepaidRemaining, bool $forceFullyPaid = false): array
    {
        // Đơn miễn phí hoàn toàn (giảm giá 100%) — không cần thu tiền, xác nhận ngay.
        if ($payableTotal <= 0) {
            return [
                'deposit_amount' => 0,
                'remaining_amount' => 0,
                'status' => 'confirmed',
                'payment_status' => 'paid',
            ];
        }

        // Định kỳ/dài hạn do lễ tân xác nhận đã thu đủ 100% tại quầy — không thu một phần.
        if ($forceFullyPaid) {
            return [
                'deposit_amount' => $payableTotal,
                'remaining_amount' => 0,
                'status' => 'confirmed',
                'payment_status' => 'paid',
            ];
        }

        $depositForThis = min($prepaidRemaining, $payableTotal);
        $prepaidRemaining -= $depositForThis;
        $remainingForThis = $payableTotal - $depositForThis;

        return [
            'deposit_amount' => $depositForThis,
            'remaining_amount' => $remainingForThis,
            // Mọi đường tạo đơn đều đã đảm bảo có tiền ở cấp đơn (tối thiểu 20% tại quầy,
            // 100% định kỳ/dài hạn, hoặc webhook xác nhận tiền vào) → xác nhận luôn.
            // Booking thứ 2+ trong đơn nhiều block có thể nhận deposit 0 vì tiền trả trước
            // đã bị block đầu tiêu hết — vẫn confirmed vì cả đơn đã đạt mức thu tối thiểu.
            'status' => 'confirmed',
            'payment_status' => $remainingForThis <= 0 ? 'paid' : ($depositForThis > 0 ? 'partially_paid' : 'unpaid'),
        ];
    }

    // tim ma giam gia ngay dac biet (auto_apply) con han de tu dong ap dung
    // tim ma giam gia ngay dac biet (auto_apply) con han de tu dong ap dung
    private function resolveAutoPromotion(?User $user, ?string $customerPhone, float $totalAmount = 0): ?Promotion
    {
        $promotion = Promotion::currentlyValid()
            ->where('auto_apply', true)
            ->orderByRaw("CASE WHEN discount_type = 'percent' THEN 200000 * discount_value / 100 ELSE discount_value END DESC")
            ->first();

        if (!$promotion) {
            return null;
        }

        // Bỏ qua mã tự động cố định nếu lớn hơn tổng giá trị đơn
        if ($totalAmount > 0 && $promotion->discount_type === 'fixed' && (float) $promotion->discount_value > $totalAmount) {
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

    // API cong khai tra ve ma giam gia ngay dac biet dang hieu luc (neu co)
    public function autoPromotion()
    {
        $promotion = Promotion::currentlyValid()
            ->where('auto_apply', true)
            ->orderByRaw("CASE WHEN discount_type = 'percent' THEN 200000 * discount_value / 100 ELSE discount_value END DESC")
            ->first();

        return response()->json([
            'status' => 'success',
            'data' => $promotion ? [
                'code' => $promotion->code,
                'name' => $promotion->name,
                'description' => $promotion->description,
                'discount_type' => $promotion->discount_type,
                'discount_value' => (float) $promotion->discount_value,
                'valid_to' => $promotion->valid_to?->toDateString(),
            ] : null,
        ]);
    }

    // tim va kiem tra dieu kien voucher theo ma, tai khoan hoac so dien thoai khach
    private function resolvePromotionForBooking(?string $code, ?User $user, ?string $customerPhone, float $totalAmount = 0): ?Promotion
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
                'message' => 'Mã giảm giá không tồn tại hoặc đã ngừng áp dụng.',
            ], 422));
        }

        // Kiểm tra hạn sử dụng của mã
        $today = now()->toDateString();
        $validFromStr = $promotion->valid_from ? \Carbon\Carbon::parse($promotion->valid_from)->toDateString() : null;
        $validToStr = $promotion->valid_to ? \Carbon\Carbon::parse($promotion->valid_to)->toDateString() : null;
        if (
            ($validFromStr && $today < $validFromStr)
            || ($validToStr && $today > $validToStr)
        ) {
            abort(response()->json([
                'status' => 'error',
                'message' => 'Mã giảm giá đã hết hạn hoặc chưa đến ngày áp dụng.',
            ], 422));
        }

        // Kiểm tra mã giảm cố định lớn hơn giá trị đơn hàng (Ví dụ: Đơn 80k không được áp mã 100k)
        if ($totalAmount > 0 && $promotion->discount_type === 'fixed' && (float) $promotion->discount_value > $totalAmount) {
            abort(response()->json([
                'status' => 'error',
                'message' => 'Mã giảm giá (' . number_format($promotion->discount_value, 0, ',', '.') . 'đ) lớn hơn giá trị đơn hàng (' . number_format($totalAmount, 0, ',', '.') . 'đ). Đơn hàng phải từ ' . number_format($promotion->discount_value, 0, ',', '.') . 'đ trở lên để áp dụng.',
            ], 422));
        }

        $currentPoints = $user ? (int) $user->points : 0;
        if ($currentPoints < (int) $promotion->min_points_required) {
            abort(response()->json([
                'status' => 'error',
                'message' => 'Tài khoản chưa đủ điểm tích lũy để dùng mã giảm giá này.',
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
                    'message' => 'Bạn đã dùng hết số lượt của mã giảm giá này.',
                ], 422));
            }
        }

        return $promotion;
    }

    // tinh so tien duoc giam tu voucher theo loai fixed hoac percent
    private function calculatePromotionDiscount(?Promotion $promotion, int|float $baseAmount): float
    {
        if (!$promotion || $baseAmount <= 0) {
            return 0;
        }

        if ($promotion->discount_type === 'percent') {
            return min($baseAmount, $baseAmount * ((float) $promotion->discount_value / 100));
        }

        $fixedVal = (float) $promotion->discount_value;
        if ($fixedVal > $baseAmount) {
            return 0;
        }

        return min($baseAmount, $fixedVal);
    }

    // tao thong bao cho admin/staff khi co don dat san moi
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
    // uoc tinh tong tien truoc khi dat, tinh theo dung ngay choi that cua tung buoi
    public function estimatePrice(Request $request)
    {
        $validated = $request->validate([
            'court_id' => ['required', 'exists:courts,id'],
            'start_time' => ['required', 'date_format:H:i'],
            'end_time' => ['required', 'date_format:H:i', 'after:start_time'],
            'time_slots' => ['nullable', 'array'],
            'time_slots.*.start' => ['required_with:time_slots', 'date_format:H:i'],
            'time_slots.*.end' => ['required_with:time_slots', 'date_format:H:i'],
            'booking_type' => ['required', 'in:single,recurring,long_term'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'days_of_week' => ['nullable', 'array'],
            'days_of_week.*' => ['integer', 'min:1', 'max:7'],
            'dates' => ['nullable', 'array'],
            'dates.*' => ['date'],
            'membership_card_id' => ['nullable', 'exists:membership_cards,id'],
            'use_membership_card' => ['nullable', 'boolean'],
            'promotion_code' => ['nullable', 'string', 'max:50'],
            'customer_phone' => ['nullable', 'string', 'max:20'],
        ]);

        $user = $request->user('sanctum') ?? $request->user();
        $promotion = $this->resolvePromotionForBooking($request->promotion_code ?? null, $user, $request->customer_phone ?? null);
        if (!$promotion) {
            $promotion = $this->resolveAutoPromotion($user, $request->customer_phone ?? null);
        }

        // Xác định danh sách ngày chơi thực tế
        $dates = [];
        if ($validated['booking_type'] === 'recurring') {
            if (empty($validated['start_date']) || empty($validated['end_date']) || empty($validated['days_of_week'])) {
                return response()->json(['status' => 'success', 'data' => ['total' => 0, 'session_count' => 0]]);
            }
            $days = array_map('intval', $validated['days_of_week']);
            for ($d = Carbon::parse($validated['start_date']); $d->lte(Carbon::parse($validated['end_date'])); $d->addDay()) {
                if (in_array((int) $d->format('N'), $days, true)) {
                    $dates[] = $d->format('Y-m-d');
                }
            }
        } elseif ($validated['booking_type'] === 'long_term') {
            $dates = $validated['dates'] ?? [];
        } else {
            $dates = !empty($validated['start_date']) ? [$validated['start_date']] : [];
        }

        $timeSlots = $this->contractTimeSlots($request, $validated['booking_type']);
        $groupedSlots = $this->groupContinuousTimeSlots($timeSlots);
        $sessions = [];
        $fullTotal = $this->calculateFullBookingAmount($request, $promotion, $user);

        foreach ($dates as $date) {
            foreach ($groupedSlots as $groupSlots) {
                $minutes = (int) array_sum(array_map(
                    fn($slot) => max(0, (strtotime($slot['end']) - strtotime($slot['start'])) / 60),
                    $groupSlots
                ));
                $ca = max(1, (int) round($minutes / 60));
                $price = array_sum(array_map(
                    fn($slot) => $this->internalCalculatePrice($validated['court_id'], $date, $slot['start'], $slot['end']),
                    $groupSlots
                ));
                $firstStart = $groupSlots[0]['start'];
                $lastEnd = $groupSlots[count($groupSlots) - 1]['end'];
                $sessions[] = [
                    'key' => $date . '|' . $firstStart . '-' . $lastEnd,
                    'date' => $date,
                    'ca' => $ca,
                    'price' => $price,
                ];
            }
        }

        // Nếu dùng thẻ (định kỳ/dài hạn) → tính phần thẻ cover được, chỉ hiển thị tiền phần còn lại
        $coveredCount = 0;
        $payable = $fullTotal;
        if (
            in_array($validated['booking_type'], ['recurring', 'long_term'], true)
            && !empty($validated['use_membership_card'])
            && !empty($validated['membership_card_id'])
        ) {
            $card = MembershipCard::find($validated['membership_card_id']);
            if ($card && $card->isUsable()) {
                $coverage = $this->computeCardCoverage($card, $sessions);
                $payable = (float) $coverage['payable'];
                $coveredCount = (int) ($coverage['covered_ca'] ?? $coverage['covered_count']);
            }
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'total' => (float) $payable,
                'full_total' => (float) $fullTotal,
                'session_count' => count($dates),
                'covered_count' => $coveredCount,
            ],
        ]);
    }

    // group continuous time slots into blocks
    private function groupContinuousTimeSlots(array $slots): array
    {
        usort($slots, function ($a, $b) {
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

            if ($lastSlot['end'] === $slot['start']) {
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

    // gop cac khung gio lien tiep nhau thanh 1 nhom de tao chung 1 don
    private function groupContinuousSlotPlans(array $slotPlans): array
    {
        usort($slotPlans, function ($a, $b) {
            return strcmp($a['start'], $b['start']);
        });

        $groups = [];
        $currentGroup = [];

        foreach ($slotPlans as $sp) {
            if (empty($currentGroup)) {
                $currentGroup[] = $sp;
                continue;
            }

            $lastSp = $currentGroup[count($currentGroup) - 1];

            if ($lastSp['court_id'] === $sp['court_id'] && $lastSp['end'] === $sp['start']) {
                $currentGroup[] = $sp;
            } else {
                $groups[] = $currentGroup;
                $currentGroup = [$sp];
            }
        }

        if (!empty($currentGroup)) {
            $groups[] = $currentGroup;
        }

        return $groups;
    }

    // tao toan bo don con cho hop dong dinh ky/dai han theo ke hoach san da chot
    private function processContractBookings(
        string $recurringId,
        array $plan,
        ?MembershipCard $contractCard,
        ?Promotion $promotion,
        $user,
        Request $request,
        float $noPartialPrepay,
        bool $staffConfirmedFullPayment,
        ?string $staffId = null
    ): array {
        $bookingsToInsert = [];
        $detailsToInsert = [];
        $paymentBookingId = null;
        $totalContractAmount = 0.0;
        $promotionApplied = false;

        $covSessions = [];
        foreach ($plan['sessions'] as $pDate => $slotPlans) {
            $groupedSlotPlans = $this->groupContinuousSlotPlans($slotPlans);
            foreach ($groupedSlotPlans as $gSlots) {
                $gMinutes = (int) array_sum(array_map(
                    fn($sp) => max(0, (strtotime($sp['end']) - strtotime($sp['start'])) / 60),
                    $gSlots
                ));
                $gCa = max(1, (int) round($gMinutes / 60));
                $gPrice = array_sum(array_map(
                    fn($sp) => $this->internalCalculatePrice($sp['court_id'], $pDate, $sp['start'], $sp['end']),
                    $gSlots
                ));
                $gKey = $pDate . '|' . $gSlots[0]['start'] . '-' . $gSlots[count($gSlots) - 1]['end'];
                $covSessions[] = [
                    'key' => $gKey,
                    'date' => $pDate,
                    'ca' => $gCa,
                    'price' => $gPrice,
                    'slots' => $gSlots,
                ];
            }
        }

        $cardCoverage = $contractCard ? $this->computeCardCoverage($contractCard, $covSessions) : null;

        foreach ($covSessions as $sessionInfo) {
            $playDate = $sessionInfo['date'];
            $gSlots = $sessionInfo['slots'];
            $gKey = $sessionInfo['key'];
            $gCa = $sessionInfo['ca'];
            $slotPrice = $sessionInfo['price'];

            $bookingId = (string) Str::uuid();

            $isFullyCardCovered = $cardCoverage && !empty($cardCoverage['covered'][$gKey]);
            $partialInfo = $cardCoverage['partial_covered'][$gKey] ?? null;

            if ($isFullyCardCovered) {
                $cardTotal = $contractCard->price_per_session * $gCa;
                $bookingsToInsert[] = [
                    'id' => $bookingId,
                    'booking_code' => 'BILL_' . strtoupper(Str::random(6)),
                    'user_id' => $user?->id ?? $request->user('sanctum')?->id,
                    'recurring_booking_id' => $recurringId,
                    'staff_id' => $staffId,
                    'promotion_id' => null,
                    'membership_card_id' => $contractCard->id,
                    'card_sessions_planned' => $gCa,
                    'subtotal_court' => $cardTotal,
                    'subtotal_service' => 0,
                    'discount_amount' => 0,
                    'total_price' => $cardTotal,
                    'deposit_amount' => $cardTotal,
                    'remaining_amount' => 0,
                    'customer_name' => $request->customer_name,
                    'customer_phone' => $request->customer_phone,
                    'status' => 'confirmed',
                    'payment_status' => 'paid',
                    'created_at' => now()
                ];
            } elseif ($partialInfo) {
                $coveredCa = $partialInfo['covered_ca'];
                $payableForGroup = $partialInfo['payable'];
                $cardValue = $contractCard->price_per_session * $coveredCa;
                $groupTotal = $cardValue + $payableForGroup;

                if (!$paymentBookingId) {
                    $paymentBookingId = $bookingId;
                }

                $totalContractAmount += $payableForGroup;

                $bookingsToInsert[] = [
                    'id' => $bookingId,
                    'booking_code' => 'BILL_' . strtoupper(Str::random(6)),
                    'user_id' => $user?->id ?? $request->user('sanctum')?->id,
                    'recurring_booking_id' => $recurringId,
                    'staff_id' => $staffId,
                    'promotion_id' => null,
                    'membership_card_id' => $contractCard->id,
                    'card_sessions_planned' => $coveredCa,
                    'subtotal_court' => $slotPrice,
                    'subtotal_service' => 0,
                    'discount_amount' => 0,
                    'total_price' => $groupTotal,
                    'deposit_amount' => $groupTotal,
                    'remaining_amount' => 0,
                    'customer_name' => $request->customer_name,
                    'customer_phone' => $request->customer_phone,
                    'status' => $staffConfirmedFullPayment ? 'confirmed' : 'pending',
                    'payment_status' => $staffConfirmedFullPayment ? 'paid' : 'unpaid',
                    'created_at' => now()
                ];
            } else {
                if (!$paymentBookingId) {
                    $paymentBookingId = $bookingId;
                }

                $loyaltyDiscount = $this->calculateLoyaltyDiscount($user, $gCa * 60);
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
                    'user_id' => $user?->id ?? $request->user('sanctum')?->id,
                    'recurring_booking_id' => $recurringId,
                    'staff_id' => $staffId,
                    'promotion_id' => $currentPromotionId,
                    'membership_card_id' => null,
                    'card_sessions_planned' => null,
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
            }

            foreach ($gSlots as $slotPlan) {
                $detailMinutes = (strtotime($slotPlan['end']) - strtotime($slotPlan['start'])) / 60;
                $detailPrice = $this->internalCalculatePrice($slotPlan['court_id'], $playDate, $slotPlan['start'], $slotPlan['end']);
                $detailsToInsert[] = [
                    'id' => (string) Str::uuid(),
                    'booking_id' => $bookingId,
                    'court_id' => $slotPlan['court_id'],
                    'booking_date' => $playDate,
                    'start_time' => $slotPlan['start'] . ':00',
                    'end_time' => $slotPlan['end'] . ':00',
                    'duration_minutes' => $detailMinutes,
                    'price_per_hour' => ($detailMinutes > 0) ? ($detailPrice / ($detailMinutes / 60)) : 0,
                    'price' => $detailPrice
                ];
            }
        }

        return [
            'bookingsToInsert' => $bookingsToInsert,
            'detailsToInsert' => $detailsToInsert,
            'paymentBookingId' => $paymentBookingId,
            'totalContractAmount' => $totalContractAmount,
            'covSessions' => $covSessions,
        ];
    }

    /**
     * Tính mức thẻ thành viên cover cho một danh sách buổi của hợp đồng định kỳ/dài hạn.
     * Quy tắc "linh hoạt": trừ thẻ cho buổi SỚM NHẤT trước, trừ toàn bộ hoặc một phần số ca khả dụng trong thẻ.
     *
     * @param  array  $sessions  mỗi phần tử: ['key'=>string, 'date'=>'Y-m-d', 'ca'=>int, 'price'=>float]
     * @return array{covered: array<string,bool>, partial_covered: array<string, array>, covered_count: int, covered_ca: int, payable: float}
     */
    // tinh the thanh vien cover duoc bao nhieu buoi, uu tien tru cho buoi som nhat
    private function computeCardCoverage(?MembershipCard $card, array $sessions): array
    {
        $result = [
            'covered' => [],
            'partial_covered' => [],
            'covered_count' => 0,
            'covered_ca' => 0,
            'payable' => 0.0,
        ];

        if (!$card || !$card->isUsable()) {
            foreach ($sessions as $s) {
                $result['payable'] += (float) ($s['price'] ?? 0.0);
            }
            return $result;
        }

        // Sắp xếp theo ngày/giờ (sớm nhất trước).
        usort($sessions, function ($a, $b) {
            $dateCompare = strcmp($a['date'], $b['date']);
            return $dateCompare !== 0 ? $dateCompare : strcmp((string) $a['key'], (string) $b['key']);
        });

        $remaining = (int) $card->availableSessions();
        $validTo = $card->valid_to ? \Carbon\Carbon::parse($card->valid_to)->format('Y-m-d') : null;

        foreach ($sessions as $s) {
            $inDate = !$validTo || $s['date'] <= $validTo;
            $sessionCa = max(1, (int) ($s['ca'] ?? 1));
            $sessionPrice = (float) ($s['price'] ?? 0.0);

            if ($inDate && $remaining > 0) {
                $coveredCa = min($remaining, $sessionCa);
                $uncoveredCa = $sessionCa - $coveredCa;
                $pricePerCa = $sessionCa > 0 ? ($sessionPrice / $sessionCa) : 0.0;

                $result['covered_ca'] += $coveredCa;
                $remaining -= $coveredCa;

                $payableForSession = $uncoveredCa * $pricePerCa;
                $result['payable'] += $payableForSession;

                if ($coveredCa === $sessionCa) {
                    $result['covered'][$s['key']] = true;
                    $result['covered_count']++;
                } else {
                    $result['partial_covered'][$s['key']] = [
                        'covered_ca' => $coveredCa,
                        'uncovered_ca' => $uncoveredCa,
                        'payable' => $payableForSession,
                    ];
                }
            } else {
                $result['payable'] += $sessionPrice;
            }
        }

        return $result;
    }

    // dung danh sach buoi (ngay, so ca, gia) cua hop dong dinh ky/dai han de tinh coverage the
    private function buildContractSessionsForCoverage(Request $request): array
    {
        $type = $request->booking_type;

        if ($type === 'recurring') {
            $dates = [];
            $s = \Carbon\Carbon::parse($request->start_date);
            $e = \Carbon\Carbon::parse($request->end_date);
            $days = array_map('intval', (array) $request->days_of_week);
            for ($d = $s->copy(); $d->lte($e); $d->addDay()) {
                if (in_array((int) $d->format('N'), $days, true)) {
                    $dates[] = $d->format('Y-m-d');
                }
            }
        } elseif ($type === 'long_term') {
            $dates = (array) $request->specific_dates;
        } else {
            return [];
        }

        $timeSlots = $this->contractTimeSlots($request, $type);
        $groups = $this->groupContinuousTimeSlots($timeSlots);
        $sessions = [];

        foreach ($dates as $date) {
            foreach ($groups as $groupSlots) {
                $minutes = (int) array_sum(array_map(
                    fn($slot) => max(0, (strtotime($slot['end']) - strtotime($slot['start'])) / 60),
                    $groupSlots
                ));
                $ca = max(1, (int) round($minutes / 60));
                $price = array_sum(array_map(
                    fn($slot) => $this->internalCalculatePrice($request->court_id, $date, $slot['start'], $slot['end']),
                    $groupSlots
                ));
                $firstStart = $groupSlots[0]['start'];
                $lastEnd = $groupSlots[count($groupSlots) - 1]['end'];
                $sessions[] = [
                    'key' => $date . '|' . $firstStart . '-' . $lastEnd,
                    'date' => $date,
                    'ca' => $ca,
                    'price' => $price,
                ];
            }
        }
        return $sessions;
    }

    // tinh nhanh tien san cho 1 khung gio bang service tinh gia
    private function internalCalculatePrice($courtId, $date, $start, $end)
    {
        return $this->pricingResolver->calculate($date, $start, $end)['total_price'];
    }

    // khach hang gui yeu cau doi lich hoac huy don den admin/staff
    // gio bat dau (carbon) cua buoi som nhat trong mot don le
    private function bookingEarliestStart(Booking $booking): ?Carbon
    {
        $booking->loadMissing('details');
        $starts = $booking->details->map(
            fn($d) => Carbon::parse(Carbon::parse($d->booking_date)->format('Y-m-d') . ' ' . $d->start_time)
        );

        return $starts->isEmpty() ? null : $starts->min();
    }

    // gio bat dau (carbon) cua buoi som nhat con o tuong lai trong mot hop dong
    private function recurringEarliestStart(RecurringBooking $recurring): ?Carbon
    {
        $recurring->loadMissing('bookings.details');
        $starts = $recurring->bookings->flatMap(
            fn($b) => $b->details->map(
                fn($d) => Carbon::parse(Carbon::parse($d->booking_date)->format('Y-m-d') . ' ' . $d->start_time)
            )
        );

        if ($starts->isEmpty()) {
            return null;
        }

        $future = $starts->filter(fn($c) => $c->isFuture());

        return $future->isNotEmpty() ? $future->min() : $starts->min();
    }
    // kiem tra xem don dat san co thuoc ve nguoi dung dang dang nhap hay khong
    private function userOwnsBookingOrMatchingWalkIn(Booking $booking, User $user): bool
    {
        if ($booking->user_id !== null) {
            return $booking->user_id === $user->id;
        }

        $bookingPhone = preg_replace('/\D+/', '', (string) $booking->customer_phone);
        $userPhone = preg_replace('/\D+/', '', (string) $user->phone);

        return $bookingPhone !== '' && $bookingPhone === $userPhone;
    }
    // khach hang gui yeu cau doi lich hoac huy don den admin/staff
    public function sendRequest(Request $request)
    {
        $validated = $request->validate([
            'booking_code' => ['required', 'string', 'max:50'],
            'type' => ['required', 'in:change,cancel'],
            'message' => ['required', 'string', 'max:500'],
        ]);

        $user = $request->user();
        $code = strtoupper(trim($validated['booking_code']));

        // Xác minh đơn tồn tại và thuộc về người dùng đang đăng nhập
        // Đơn walk-in (user_id = null) cũng cho phép nếu khách tìm thấy đúng mã
        $booking = Booking::where('booking_code', $code)->first();
        if ($booking && !$this->userOwnsBookingOrMatchingWalkIn($booking, $user)) {
            $booking = null;
        }
        $recurringBooking = !$booking
            ? RecurringBooking::where('recurring_code', $code)
                ->where('user_id', $user->id)
                ->first()
            : null;

        if (!$booking && !$recurringBooking) {
            return response()->json(['message' => 'Không tìm thấy đơn đặt sân.'], 404);
        }

        // Đơn đã hủy / đã hoàn thành thì không cho gửi yêu cầu
        $currentStatus = $booking?->status ?? $recurringBooking?->status;
        if (in_array($currentStatus, ['cancelled', 'completed'], true)) {
            return response()->json(['message' => 'Đơn đã hủy hoặc đã hoàn thành, không thể gửi yêu cầu.'], 422);
        }

        // Quy tắc: chỉ được gửi yêu cầu hủy/đổi trước giờ chơi của buổi sớm nhất
        // ít nhất N giờ (mặc định 24h, cấu hình qua system_settings). Chốt chặn thật ở backend.
        $minHours = max(0, (float) (\App\Models\SystemSetting::getAll()['cancel_request_min_hours'] ?? 24));
        $earliestStart = $booking
            ? $this->bookingEarliestStart($booking)
            : $this->recurringEarliestStart($recurringBooking);

        if ($earliestStart && now()->addHours($minHours)->greaterThan($earliestStart)) {
            return response()->json(['message' => 'Chỉ được gửi yêu cầu hủy/đổi trước giờ chơi ít nhất 1 ngày.'], 422);
        }

        $typeLabel = $validated['type'] === 'cancel' ? 'hủy lịch' : 'đổi lịch';

        // Mã ĐỊNH TUYẾN nằm ở TIÊU ĐỀ để bấm thông báo dẫn đúng trang; còn NỘI DUNG
        // hiển thị thân thiện (tên sân + khoảng ngày; buổi con thì hiện ngày chơi) cho dễ tìm.
        if ($booking && $booking->recurring_booking_id) {
            $parent = RecurringBooking::with('court')->find($booking->recurring_booking_id);
            $routingCode = $parent?->recurring_code ?? $code;
            $label = ($parent && $parent->type === 'long_term') ? 'hợp đồng dài hạn' : 'hợp đồng định kỳ';
            $courtName = $parent?->court?->name ?? '—';
            $range = ($parent && $parent->start_date)
                ? Carbon::parse($parent->start_date)->format('d/m/Y') . ' – ' . Carbon::parse($parent->end_date)->format('d/m/Y')
                : '';
            $sessDate = optional($booking->details()->orderBy('booking_date')->first())->booking_date;
            $sessStr = $sessDate ? ' — buổi ngày ' . Carbon::parse($sessDate)->format('d/m/Y') : '';
            $subject = "{$label} sân {$courtName}" . ($range ? " ({$range})" : '') . $sessStr;
        } elseif (!$booking) {
            $recurringBooking->loadMissing('court');
            $routingCode = $recurringBooking->recurring_code;
            $label = ($recurringBooking->type === 'long_term') ? 'hợp đồng dài hạn' : 'hợp đồng định kỳ';
            $courtName = $recurringBooking->court?->name ?? '—';
            $range = $recurringBooking->start_date
                ? Carbon::parse($recurringBooking->start_date)->format('d/m/Y') . ' – ' . Carbon::parse($recurringBooking->end_date)->format('d/m/Y')
                : '';
            $subject = "{$label} sân {$courtName}" . ($range ? " ({$range})" : '');
        } else {
            $routingCode = $booking->booking_code;
            $playDate = optional($booking->details()->orderBy('booking_date')->first())->booking_date;
            $subject = $playDate ? ('đơn ngày ' . Carbon::parse($playDate)->format('d/m/Y')) : ('đơn ' . $booking->booking_code);
        }

        // group_key dùng chung cho tất cả bản ghi → khi 1 người đọc thì cả nhóm được mark read
        $groupKey = 'req_' . strtolower($routingCode);

        $adminStaffIds = User::whereIn('role', ['admin', 'staff'])->pluck('id');
        $now = now();
        $rows = $adminStaffIds->map(fn($receiverId) => [
            'id' => (string) Str::uuid(),
            'receiver_id' => $receiverId,
            'sender_id' => $user->id,
            'title' => "Yêu cầu {$typeLabel} — {$routingCode}",
            'content' => "{$user->full_name} yêu cầu {$typeLabel} {$subject}: {$validated['message']}",
            'is_read' => false,
            'created_at' => $now,
            'group_key' => $groupKey,
        ])->all();
        Notification::insert($rows);

        return response()->json(['message' => 'Đã gửi yêu cầu thành công. Nhân viên sẽ liên hệ bạn sớm nhất có thể.']);
    }

    // =========================================================================
    // API ĐỔI LỊCH TỰ ĐỘNG CHO TỪNG BUỔI (kể cả buổi lẻ trong hợp đồng)
    // =========================================================================
    // khach yeu cau doi lich mot buoi cu the theo chinh sach:
    public function rescheduleSession(Request $request)
    {
        $validated = $request->validate([
            'booking_code' => ['required', 'string', 'max:50'],
            'new_date' => ['required', 'date'],
            'new_start' => ['required', 'date_format:H:i'],
            'new_end' => ['required', 'date_format:H:i', 'after:new_start'],
        ]);

        $user = $request->user();
        $code = strtoupper(trim($validated['booking_code']));

        $booking = Booking::with('details')
            ->where('booking_code', $code)
            ->first();
        if ($booking && !$this->userOwnsBookingOrMatchingWalkIn($booking, $user)) {
            $booking = null;
        }

        if (!$booking || $booking->details->isEmpty()) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy đơn đặt sân.'], 404);
        }

        if (in_array($booking->status, ['cancelled', 'completed'], true)) {
            return response()->json(['status' => 'error', 'message' => 'Đơn đã hủy hoặc đã hoàn thành, không thể đổi lịch.'], 400);
        }

        // Sắp xếp tất cả detail theo giờ bắt đầu để xác định block thời gian gốc
        $details = $booking->details->sortBy('start_time')->values();
        $firstDetail = $details->first();
        $lastDetail = $details->last();

        $oldDate = Carbon::parse($firstDetail->booking_date)->format('Y-m-d');
        $oldStartAt = Carbon::parse($oldDate . ' ' . $firstDetail->start_time);

        // Tổng thời lượng gốc (phút) = từ đầu buổi đầu đến cuối buổi cuối
        $origTotalMinutes = (strtotime($lastDetail->end_time) - strtotime($firstDetail->start_time)) / 60;

        // Thời lượng khung giờ mới phải bằng gốc
        $newTotalMinutes = (strtotime($validated['new_end'] . ':00') - strtotime($validated['new_start'] . ':00')) / 60;

        if ($newTotalMinutes !== $origTotalMinutes) {
            $hours = $origTotalMinutes / 60;
            return response()->json([
                'status' => 'error',
                'message' => "Đơn gốc có tổng {$hours} giờ. Vui lòng chọn khung giờ mới có cùng thời lượng ({$hours} giờ).",
            ], 422);
        }

        $detailIds = $details->pluck('id')->all();
        $courtId = $firstDetail->court_id;

        return DB::transaction(function () use ($validated, $booking, $details, $firstDetail, $lastDetail, $oldStartAt, $origTotalMinutes, $detailIds, $courtId) {
            // ─── BÁO SAU: giờ chơi đã qua → mất buổi ───
            if (now()->greaterThanOrEqualTo($oldStartAt)) {
                $booking->update(['status' => 'completed']);

                return response()->json([
                    'status' => 'error',
                    'policy' => 'forfeited',
                    'message' => 'Bạn báo đổi lịch sau giờ chơi nên buổi này bị mất theo chính sách. Không hoàn tiền.',
                ], 422);
            }

            if ($validated['new_date'] < now()->format('Y-m-d')) {
                return response()->json(['status' => 'error', 'message' => 'Ngày mới phải từ hôm nay trở đi.'], 422);
            }

            // ─── Tính thời gian mới cho từng detail (giữ nguyên offset và độ dài từng slot) ───
            $origBlockStart = strtotime($firstDetail->start_time);
            $newBlockStart = strtotime($validated['new_start'] . ':00');

            $updatedDetails = $details->map(function ($detail) use ($origBlockStart, $newBlockStart, $validated, $courtId) {
                $offsetSec = strtotime($detail->start_time) - $origBlockStart;
                $durationSec = strtotime($detail->end_time) - strtotime($detail->start_time);
                $newStart = date('H:i:s', $newBlockStart + $offsetSec);
                $newEnd = date('H:i:s', $newBlockStart + $offsetSec + $durationSec);

                return [
                    'detail' => $detail,
                    'new_start' => $newStart,
                    'new_end' => $newEnd,
                    'new_date' => $validated['new_date'],
                    'duration' => $durationSec / 60,
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
                    'status' => 'error',
                    'policy' => 'busy',
                    'message' => 'Khung giờ bạn chọn đã có người đặt. Vui lòng chọn theo giờ rảnh của sân bên dưới.',
                    'free_slots' => $freeSlots,
                ], 409);
            }

            // ─── Thuận lợi: cập nhật tất cả detail và tính lại tổng giá ───
            $oldTotalCourtPrice = 0;
            $newTotalCourtPrice = 0;

            foreach ($updatedDetails as $item) {
                $detail = $item['detail'];
                $newPrice = $this->internalCalculatePrice($courtId, $item['new_date'], substr($item['new_start'], 0, 5), substr($item['new_end'], 0, 5));
                $duration = $item['duration'];

                $oldTotalCourtPrice += (float) $detail->price;
                $newTotalCourtPrice += $newPrice;

                $detail->update([
                    'booking_date' => $item['new_date'],
                    'start_time' => $item['new_start'],
                    'end_time' => $item['new_end'],
                    'duration_minutes' => $duration,
                    'price' => $newPrice,
                    'price_per_hour' => $duration > 0 ? ($newPrice / ($duration / 60)) : 0,
                ]);
            }

            $priceDiff = $newTotalCourtPrice - $oldTotalCourtPrice;

            $booking->update([
                'subtotal_court' => $booking->subtotal_court + $priceDiff,
                'total_price' => $booking->total_price + $priceDiff,
                'remaining_amount' => max(0, (float) $booking->remaining_amount + $priceDiff),
            ]);

            return response()->json([
                'status' => 'success',
                'policy' => 'approved',
                'message' => 'Đổi lịch thành công!',
                'data' => [
                    'booking_code' => $booking->booking_code,
                    'new_date' => $validated['new_date'],
                    'new_time' => $validated['new_start'] . ' - ' . $validated['new_end'],
                    'price_diff' => $priceDiff,
                ],
            ]);
        });
    }

    // =========================================================================
    // API THỐNG KÊ SỐ BUỔI CỦA TÀI KHOẢN
    // =========================================================================
    // tong hop so buoi cua tai khoan: da dat, da choi, sap toi, da huy
    public function myBookingStats(Request $request)
    {
        $user = $request->user();
        $today = now()->format('Y-m-d');

        $bookings = Booking::where('user_id', $user->id)->with('details:id,booking_id,booking_date')->get();

        $played = 0;
        $upcoming = 0;
        foreach ($bookings as $b) {
            if (in_array($b->status, ['cancelled'], true))
                continue;
            $date = optional($b->details->first())->booking_date;
            if (!$date)
                continue;
            $d = Carbon::parse($date)->format('Y-m-d');
            if ($b->status === 'completed' || $d < $today)
                $played++;
            elseif ($d >= $today)
                $upcoming++;
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'total_sessions' => $bookings->whereNotIn('status', ['cancelled'])->count(),
                'played_sessions' => $played,
                'upcoming_sessions' => $upcoming,
                'cancelled_sessions' => $bookings->where('status', 'cancelled')->count(),
                'total_spent' => (float) $bookings->whereNotIn('status', ['cancelled'])
                    ->whereIn('payment_status', ['paid', 'partially_paid'])
                    ->sum(fn($b) => (float) $b->total_price - (float) $b->remaining_amount),
                'points' => (int) $user->points,
            ],
        ]);
    }

    // liet ke cac khung gio 1 tieng con trong cua san trong mot ngay (06:00–22:00)
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
