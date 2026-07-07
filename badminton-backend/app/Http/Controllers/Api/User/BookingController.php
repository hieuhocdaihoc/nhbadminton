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
        ]);

        // Lấy user nếu có token (fallback cho webhook gọi store() qua fake request)
        $user = $request->user('sanctum') ?? $request->user();
        if (!$user && $request->has('user_id')) {
            $user = User::find($request->user_id);
        }
        $userId = $user ? $user->id : null;

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

                $createdBookings = [];
                $paymentBookingId = null;
                $grandTotal = 0;
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
                    $currentPromotionId = $promotionDiscount > 0 ? $promotion->id : null;
                    $promotionApplied = $promotionApplied || $promotionDiscount > 0;

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
                        'deposit_amount' => 0,
                        'remaining_amount' => $payableTotal,
                        'customer_name' => $request->customer_name,
                        'customer_phone' => $request->customer_phone,
                        'status' => 'pending',
                        'payment_status' => 'unpaid',
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

            return DB::transaction(function () use ($request, $userId, $user, $promotion, $targetDates, $selectedDays) {
                DB::table('courts')
                    ->where('id', $request->court_id)
                    ->lockForUpdate()
                    ->first();

                foreach ($targetDates as $playDate) {
                    if ($this->checkSlotBusy($request->court_id, $playDate, $request->start_time, $request->end_time)) {
                        return response()->json([
                            'status' => 'error',
                            'message' => "Ngày {$playDate} đã có lịch đặt. Không thể đăng ký chuỗi định kỳ!"
                        ], 400);
                    }
                }

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

                // Sinh sẵn hóa đơn độc lập cho từng tuần
                foreach ($targetDates as $playDate) {
                    $bookingId = (string) Str::uuid();

                    if (!$paymentBookingId) {
                        $paymentBookingId = $bookingId;
                    }

                    $slotPrice = $this->internalCalculatePrice(
                        $request->court_id,
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
                        'deposit_amount' => 0,
                        'remaining_amount' => $payableTotal,
                        'customer_name' => $request->customer_name,
                        'customer_phone' => $request->customer_phone,
                        'status' => 'pending',
                        'payment_status' => 'unpaid',
                        'created_at' => now()
                    ];

                    $detailsToInsert[] = [
                        'id' => (string) Str::uuid(),
                        'booking_id' => $bookingId,
                        'court_id' => $request->court_id,
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
                            'slots_count' => count($targetDates),
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
                        'total_sessions' => count($targetDates),
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

            return DB::transaction(function () use ($request, $userId, $user, $promotion, $targetDates, $rangeStart, $rangeEnd) {
                DB::table('courts')
                    ->where('id', $request->court_id)
                    ->lockForUpdate()
                    ->first();

                foreach ($targetDates as $playDate) {
                    if ($this->checkSlotBusy($request->court_id, $playDate, $request->lt_start_time, $request->lt_end_time)) {
                        return response()->json([
                            'status' => 'error',
                            'message' => "Ngày {$playDate} đã có lịch đặt trong khung giờ này!"
                        ], 400);
                    }
                }

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

                foreach ($targetDates as $playDate) {
                    $bookingId = (string) Str::uuid();

                    if (!$paymentBookingId) {
                        $paymentBookingId = $bookingId;
                    }

                    $slotPrice = $this->internalCalculatePrice(
                        $request->court_id,
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
                        'deposit_amount' => 0,
                        'remaining_amount' => $payableTotal,
                        'customer_name' => $request->customer_name,
                        'customer_phone' => $request->customer_phone,
                        'status' => 'pending',
                        'payment_status' => 'unpaid',
                        'created_at' => now()
                    ];

                    $detailsToInsert[] = [
                        'id' => (string) Str::uuid(),
                        'booking_id' => $bookingId,
                        'court_id' => $request->court_id,
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
                            'slots_count' => count($targetDates),
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
                        'total_sessions' => count($targetDates),
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
            for ($date = $start->copy(); $date->lte($end); $date->addDay()) {
                if (in_array((int) $date->format('N'), $selectedDays)) {
                    if ($this->checkSlotBusy($request->court_id, $date->format('Y-m-d'), $request->start_time, $request->end_time)) {
                        return response()->json(['status' => 'error', 'message' => "Ngày {$date->format('Y-m-d')} đã có lịch đặt!"], 400);
                    }
                }
            }
        } elseif ($type === 'long_term') {
            foreach ($request->specific_dates as $d) {
                if ($this->checkSlotBusy($request->court_id, $d, $request->lt_start_time, $request->lt_end_time)) {
                    return response()->json(['status' => 'error', 'message' => "Ngày {$d} đã có lịch đặt trong khung giờ này!"], 400);
                }
            }
        }

        // Tính tổng tiền
        $amount = $this->calculateIntentAmount($request, $promotion, $user);

        // Xóa các intent cũ đã hết hạn
        BookingIntent::where('expires_at', '<', now())->delete();

        $intentCode = 'PAY' . strtoupper(Str::random(7));
        $intent = BookingIntent::create([
            'id' => (string) Str::uuid(),
            'intent_code' => $intentCode,
            'payload' => $request->except('promotion_code') + ['promotion_code' => $request->promotion_code, 'user_id' => $user?->id],
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
            for ($date = $start->copy(); $date->lte($end); $date->addDay()) {
                if (in_array((int) $date->format('N'), $selectedDays)) {
                    $price = $this->internalCalculatePrice($request->court_id, $date->format('Y-m-d'), $request->start_time, $request->end_time);
                    $loyaltyDiscount = $this->calculateLoyaltyDiscount($user, $minutes);
                    $promoDiscount = (!$promotionApplied && $promotion) ? $this->calculatePromotionDiscount($promotion, $price) : 0;
                    $total += max(0, $price - min($price, $loyaltyDiscount + $promoDiscount));
                    $promotionApplied = $promotionApplied || $promoDiscount > 0;
                }
            }
        } elseif ($type === 'long_term') {
            $minutes = (strtotime($request->lt_end_time) - strtotime($request->lt_start_time)) / 60;
            foreach ($request->specific_dates as $d) {
                $price = $this->internalCalculatePrice($request->court_id, $d, $request->lt_start_time, $request->lt_end_time);
                $loyaltyDiscount = $this->calculateLoyaltyDiscount($user, $minutes);
                $promoDiscount = (!$promotionApplied && $promotion) ? $this->calculatePromotionDiscount($promotion, $price) : 0;
                $total += max(0, $price - min($price, $loyaltyDiscount + $promoDiscount));
                $promotionApplied = $promotionApplied || $promoDiscount > 0;
            }
        }

        return $total;
    }

    // =========================================================================
    // 4. API HỦY ĐƠN CHƯA THANH TOÁN (khi user đóng QR modal mà không trả tiền)
    // =========================================================================
    /**
     * Chức năng: Hủy các booking unpaid khi user đóng modal thanh toán.
     * Có thể hủy theo booking_id (đặt lẻ) hoặc recurring_booking_id (định kỳ/dài hạn).
     */
    public function cancelUnpaid(Request $request)
    {
        $request->validate([
            'booking_id' => 'nullable|uuid',
            'recurring_booking_id' => 'nullable|uuid',
        ]);

        return DB::transaction(function () use ($request) {
            // Hủy theo hợp đồng định kỳ/dài hạn
            if ($request->recurring_booking_id) {
                $updated = Booking::where('recurring_booking_id', $request->recurring_booking_id)
                    ->where('payment_status', 'unpaid')
                    ->where('status', 'pending')
                    ->update(['status' => 'cancelled']);

                RecurringBooking::where('id', $request->recurring_booking_id)
                    ->where('status', 'active')
                    ->update(['status' => 'cancelled']);

                return response()->json(['status' => 'success', 'cancelled' => $updated]);
            }

            // Hủy theo booking đơn lẻ
            if ($request->booking_id) {
                $updated = Booking::where('id', $request->booking_id)
                    ->where('payment_status', 'unpaid')
                    ->where('status', 'pending')
                    ->update(['status' => 'cancelled']);

                return response()->json(['status' => 'success', 'cancelled' => $updated]);
            }

            return response()->json(['status' => 'error', 'message' => 'Thiếu booking_id hoặc recurring_booking_id'], 400);
        });
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
}
