<?php

namespace App\Http\Controllers\Api\User;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\BookingDetail;
use App\Models\RecurringBooking;
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
    public function store(Request $request)
    {
        $request->validate([
            'booking_type' => 'required|in:single,recurring',
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
            'day_of_week' => 'required_if:booking_type,recurring|integer|min:1|max:7',
            'start_time' => 'required_if:booking_type,recurring|date_format:H:i',
            'end_time' => 'required_if:booking_type,recurring|date_format:H:i|after:start_time',
        ]);

        // Lấy user nếu có token
        $user = $request->user('sanctum');
        $userId = $user ? $user->id : null;
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

            // Kiểm tra trùng lịch trước khi tạo đơn
            foreach ($request->slots as $slot) {
                if ($this->checkSlotBusy($request->court_id, $slot['date'], $slot['start'], $slot['end'])) {
                    return response()->json([
                        'status' => 'error',
                        'message' => "Khung giờ {$slot['start']}-{$slot['end']} đã có người đặt!"
                    ], 400);
                }
            }

            return DB::transaction(function () use ($request, $userId, $user, $promotion) {
                // Khóa sân để hạn chế race condition khi nhiều người đặt cùng lúc
                DB::table('courts')
                    ->where('id', $request->court_id)
                    ->lockForUpdate()
                    ->first();

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
            $targetDates = [];

            for ($date = $start->copy(); $date->lte($end); $date->addDay()) {
                if ($date->format('N') == $request->day_of_week) {
                    $targetDates[] = $date->format('Y-m-d');
                }
            }

            if (empty($targetDates)) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Không tìm thấy ngày hợp lệ trong dải thời gian đã chọn!'
                ], 400);
            }

            // Nếu 1 ngày trong chuỗi bị trùng lịch thì hủy toàn bộ
            foreach ($targetDates as $playDate) {
                if ($this->checkSlotBusy($request->court_id, $playDate, $request->start_time, $request->end_time)) {
                    return response()->json([
                        'status' => 'error',
                        'message' => "Ngày {$playDate} đã có lịch đặt. Không thể đăng ký chuỗi định kỳ!"
                    ], 400);
                }
            }

            return DB::transaction(function () use ($request, $userId, $user, $promotion, $targetDates) {
                DB::table('courts')
                    ->where('id', $request->court_id)
                    ->lockForUpdate()
                    ->first();

                // Tạo hợp đồng định kỳ gốc
                $recurring = RecurringBooking::create([
                    'user_id' => $userId,
                    'court_id' => $request->court_id,
                    'recurring_code' => 'REC_' . strtoupper(Str::random(6)),
                    'day_of_week' => $request->day_of_week,
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
    }

    // =========================================================================
    // 3. API LỊCH SỬ CÁ NHÂN
    // =========================================================================
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

        $query = Booking::with([
            'details' => function ($q) {
                $q->orderBy('booking_date', 'asc')
                    ->orderBy('start_time', 'asc');
            }
        ])->where('user_id', $user->id);

        if ($tab === 'upcoming') {
            $query->where('status', '!=', 'cancelled')
                ->whereHas('details', function ($q) use ($today) {
                    $q->where('booking_date', '>=', $today);
                });
        } elseif ($tab === 'history') {
            $query->where(function ($q) use ($today) {
                $q->where('status', 'cancelled')
                    ->orWhereDoesntHave('details', function ($subQ) use ($today) {
                        $subQ->where('booking_date', '>=', $today);
                    });
            });
        }

        $bookings = $query->orderBy('created_at', 'desc')->paginate(10);

        $formatted = $bookings->through(function ($booking) {
            $first = $booking->details->first();
            $last = $booking->details->last();

            return [
                'booking_id' => $booking->id,
                'booking_code' => $booking->booking_code,
                'type_label' => !is_null($booking->recurring_booking_id)
                    ? 'Buổi chơi Định kỳ'
                    : 'Đặt Lẻ',
                'total_price' => $booking->total_price,
                'status' => $booking->status,
                'payment_status' => $booking->payment_status,
                'created_at' => Carbon::parse($booking->created_at)->format('d/m/Y H:i'),
                'summary' => $first ? [
                    'court_id' => $first->court_id,
                    'play_date' => Carbon::parse($first->booking_date)->format('d/m/Y'),
                    'time_slot' => substr($first->start_time, 0, 5) . ' - ' . substr($last->end_time, 0, 5)
                ] : null,
                'details_count' => $booking->details->count(),
            ];
        });

        return response()->json([
            'status' => 'success',
            'data' => $formatted
        ]);
    }

    // =========================================================================
    // 4. API CONG KHAI: KHACH VANG LAI TRA CUU DON BANG MA DON + SO DIEN THOAI
    // =========================================================================
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
    private function calculateLoyaltyDiscount(?User $user, int|float $totalMinutes): float
    {
        if (!$user || $user->role !== 'customer' || (int) $user->points < 1000) {
            return 0;
        }

        $hours = $totalMinutes / 60;

        return max(0, $hours * 5000);
    }

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

            foreach ($receiverIds as $receiverId) {
                $rows[] = [
                    'id' => (string) Str::uuid(),
                    'receiver_id' => $receiverId,
                    'sender_id' => $senderId,
                    'title' => $title,
                    'content' => $content,
                    'is_read' => false,
                    'created_at' => $now,
                ];
            }
        }

        Notification::insert($rows);
    }

    // =========================================================================
    // HÀM PHỤ: TÍNH GIÁ THEO BẢNG GIÁ
    // =========================================================================
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
}
