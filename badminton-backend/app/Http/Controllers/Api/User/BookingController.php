<?php

namespace App\Http\Controllers\Api\User;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\BookingDetail;
use App\Models\RecurringBooking;
use App\Models\CourtPricing;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class BookingController extends Controller
{
    // =========================================================================
    // 1. API CÔNG KHAI: Tra cứu lưới giờ khả dụng (Hỗ trợ trả về mảng Grid cho UI)
    // =========================================================================
    public function getCourtAvailability(Request $request, $courtId)
    {
        $request->validate(['date' => 'required|date']);
        $targetDate = $request->date;
        $todayStr = now()->format('Y-m-d');

        // Bỏ qua nếu User chọn ngày trong quá khứ
        if ($targetDate < $todayStr) {
            return response()->json(['status' => 'success', 'data' => []]);
        }

        // Truy vấn các ca chơi đã được giữ chỗ (Không tính đơn đã hủy)
        $busySlots = BookingDetail::where('court_id', $courtId)
            ->where('booking_date', $targetDate)
            ->whereHas('booking', function ($query) {
                $query->where('status', '!=', 'cancelled');
            })->get();

        // Chế độ Grid: Dành cho giao diện đặt sân của User (Hiển thị từng block 60p kèm giá)
        if ($request->query('mode') === 'grid') {
            $dayType = (date('N', strtotime($targetDate)) >= 6) ? 'weekend' : 'weekday';
            $pricings = CourtPricing::where('court_id', $courtId)
                ->where('day_type', $dayType)->orderBy('start_time')->get();

            $gridSlots = [];
            $currentTimeStr = now()->format('H:i');
            $isToday = ($targetDate === $todayStr);

            foreach ($pricings as $pricing) {
                $start = Carbon::parse($pricing->start_time);
                $end = Carbon::parse($pricing->end_time);

                while ($start->copy()->addMinutes(60)->lte($end)) {
                    $slotStart = $start->format('H:i');
                    $slotEnd = $start->copy()->addMinutes(60)->format('H:i');

                    // Kiểm tra block này có nằm trong khung giờ bận hay không
                    $isBusy = $busySlots->contains(function ($b) use ($slotStart, $slotEnd) {
                        $bStart = substr($b->start_time, 0, 5);
                        $bEnd = substr($b->end_time, 0, 5);
                        return ($slotStart < $bEnd) && ($slotEnd > $bStart);
                    });

                    // Tự động khóa các block giờ đã trôi qua nếu xem lịch ngày hôm nay
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
            return response()->json(['status' => 'success', 'data' => $gridSlots]);
        }

        // Chế độ mặc định: Trả về danh sách giờ bận tóm tắt
        $formattedBusy = $busySlots->map(function ($item) {
            return [
                'start_time' => substr($item->start_time, 0, 5),
                'end_time' => substr($item->end_time, 0, 5),
                'type' => !is_null($item->booking->recurring_booking_id) ? 'recurring' : 'single'
            ];
        });

        return response()->json(['status' => 'success', 'data' => ['busy_slots' => $formattedBusy]]);
    }

    // =========================================================================
    // 2. API CHỐT ĐẶT SÂN: Xử lý lưu đơn hàng (Phân quyền động theo Booking Type)
    // =========================================================================
    public function store(Request $request)
    {
        $request->validate([
            'booking_type' => 'required|in:single,recurring',
            'court_id' => 'required|exists:courts,id',
            'customer_name' => 'required|string|max:100',
            'customer_phone' => 'required|string|max:20',

            // Validate quy tắc đặt lẻ
            'slots' => 'required_if:booking_type,single|array',
            'slots.*.date' => 'required_with:slots|date',
            'slots.*.start' => 'required_with:slots|date_format:H:i',
            'slots.*.end' => 'required_with:slots|date_format:H:i|after:slots.*.start',

            // Validate quy tắc đặt định kỳ
            'start_date' => 'required_if:booking_type,recurring|date',
            'end_date' => 'required_if:booking_type,recurring|date|after_or_equal:start_date',
            'day_of_week' => 'required_if:booking_type,recurring|integer|min:1|max:7',
            'start_time' => 'required_if:booking_type,recurring|date_format:H:i',
            'end_time' => 'required_if:booking_type,recurring|date_format:H:i|after:start_time',
        ]);

        // Lấy thông tin tài khoản nếu request có gửi kèm Bearer Token
        $user = $request->user('sanctum');
        $userId = $user ? $user->id : null;

        // ---------------------------------------------------------------------
        // KỊCH BẢN A: ĐẶT LẺ (SINGLE) -> Mở cửa tự do cho cả khách vãng lai
        // ---------------------------------------------------------------------
        if ($request->booking_type === 'single') {

            // Kiểm tra trước rủi ro đụng lịch ngầm
            foreach ($request->slots as $slot) {
                if ($this->checkSlotBusy($request->court_id, $slot['date'], $slot['start'], $slot['end'])) {
                    return response()->json([
                        'status' => 'error',
                        'message' => "Khung giờ {$slot['start']}-{$slot['end']} đã có người đặt!"
                    ], 400);
                }
            }

            return DB::transaction(function () use ($request, $userId) {
                // Khóa record Sân để tránh Race Condition (2 người đặt cùng lúc)
                DB::table('courts')->where('id', $request->court_id)->lockForUpdate()->first();

                $bookingId = (string) Str::uuid();
                $totalPrice = 0;
                $detailsToInsert = [];

                foreach ($request->slots as $slot) {
                    $slotPrice = $this->internalCalculatePrice($request->court_id, $slot['date'], $slot['start'], $slot['end']);
                    $totalPrice += $slotPrice;
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

                // Ghi nhận hóa đơn (Nếu vãng lai thì user_id sẽ tự động lưu giá trị NULL)
                Booking::insert([
                    'id' => $bookingId,
                    'booking_code' => 'BILL_' . strtoupper(Str::random(6)),
                    'user_id' => $userId,
                    'recurring_booking_id' => null,
                    'subtotal_court' => $totalPrice,
                    'total_price' => $totalPrice,
                    'deposit_amount' => 0,
                    'remaining_amount' => $totalPrice,
                    'customer_name' => $request->customer_name,
                    'customer_phone' => $request->customer_phone,
                    'status' => 'pending',
                    'payment_status' => 'unpaid',
                    'created_at' => now()
                ]);

                BookingDetail::insert($detailsToInsert);

                return response()->json([
                    'status' => 'success',
                    'message' => 'Đặt sân lẻ thành công!',
                    'data' => ['booking_id' => $bookingId, 'total_price' => $totalPrice]
                ], 201);
            });
        }

        // ---------------------------------------------------------------------
        // KỊCH BẢN B: ĐẶT ĐỊNH KỲ (RECURRING) -> BẮT BUỘC PHẢI CÓ TÀI KHOẢN
        // ---------------------------------------------------------------------
        if ($request->booking_type === 'recurring') {

            // Rào cản kiểm tra: Chặn lập tức nếu phát hiện là khách vãng lai
            if (!$userId) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Tính năng đặt lịch cố định chỉ dành cho thành viên. Vui lòng đăng nhập!'
                ], 401);
            }

            // Quét dải ngày hiệu lực để trích xuất ra các ngày đánh chính xác
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

            // Kiểm tra đụng lịch: Một buổi vướng lịch sẽ hủy toàn bộ giao dịch
            foreach ($targetDates as $playDate) {
                if ($this->checkSlotBusy($request->court_id, $playDate, $request->start_time, $request->end_time)) {
                    return response()->json([
                        'status' => 'error',
                        'message' => "Ngày {$playDate} đã có lịch đặt. Không thể đăng ký chuỗi định kỳ!"
                    ], 400);
                }
            }

            return DB::transaction(function () use ($request, $userId, $targetDates) {
                DB::table('courts')->where('id', $request->court_id)->lockForUpdate()->first();

                // Khởi tạo bản ghi Hợp đồng gốc (Master Contract)
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
                $minutes = (strtotime($request->end_time) - strtotime($request->start_time)) / 60;

                // Chiến lược Eager Generation: Sinh sẵn hóa đơn độc lập cho từng tuần thi đấu
                foreach ($targetDates as $playDate) {
                    $bookingId = (string) Str::uuid();
                    $slotPrice = $this->internalCalculatePrice($request->court_id, $playDate, $request->start_time, $request->end_time);

                    $bookingsToInsert[] = [
                        'id' => $bookingId,
                        'booking_code' => 'BILL_' . strtoupper(Str::random(6)),
                        'user_id' => $userId,
                        'recurring_booking_id' => $recurring->id,
                        'subtotal_court' => $slotPrice,
                        'total_price' => $slotPrice,
                        'deposit_amount' => 0,
                        'remaining_amount' => $slotPrice,
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

                return response()->json([
                    'status' => 'success',
                    'message' => 'Đăng ký hợp đồng định kỳ thành công!'
                ], 201);
            });
        }
    }

    // =========================================================================
    // 3. API LỊCH SỬ CÁ NHÂN: Truy xuất các đơn của riêng User đang đăng nhập
    // =========================================================================
    public function getUserBookings(Request $request)
    {
        $user = $request->user('sanctum');
        if (!$user) {
            return response()->json(['status' => 'error', 'message' => 'Vui lòng đăng nhập!'], 401);
        }

        $tab = $request->query('tab', 'all');
        $today = now()->format('Y-m-d');

        $query = Booking::with([
            'details' => function ($q) {
                $q->orderBy('booking_date', 'asc')->orderBy('start_time', 'asc');
            }
        ])->where('user_id', $user->id);

        // Lọc trạng thái Tab view
        if ($tab === 'upcoming') {
            $query->where('status', '!=', 'cancelled')->whereHas('details', function ($q) use ($today) {
                $q->where('booking_date', '>=', $today);
            });
        } elseif ($tab === 'history') {
            $query->where(function ($q) use ($today) {
                $q->where('status', 'cancelled')->orWhereDoesntHave('details', function ($subQ) use ($today) {
                    $subQ->where('booking_date', '>=', $today);
                });
            });
        }

        $bookings = $query->orderBy('created_at', 'desc')->paginate(10);

        // Chuẩn hóa cấu trúc đầu ra để giao diện vẽ các thẻ (Card) trực quan
        $formatted = $bookings->through(function ($booking) {
            $first = $booking->details->first();
            return [
                'booking_id' => $booking->id,
                'booking_code' => $booking->booking_code,
                'type_label' => !is_null($booking->recurring_booking_id) ? 'Buổi chơi Định kỳ' : 'Đặt Lẻ',
                'total_price' => $booking->total_price,
                'status' => $booking->status,
                'payment_status' => $booking->payment_status,
                'created_at' => Carbon::parse($booking->created_at)->format('d/m/Y H:i'),
                'summary' => $first ? [
                    'court_id' => $first->court_id,
                    'play_date' => Carbon::parse($first->booking_date)->format('d/m/Y'),
                    'time_slot' => substr($first->start_time, 0, 5) . ' - ' . substr($first->end_time, 0, 5)
                ] : null,
                'details_count' => $booking->details->count(),
            ];
        });

        return response()->json(['status' => 'success', 'data' => $formatted]);
    }

    // --- CÁC HÀM TIỆN ÍCH TÍNH TOÁN NỘI BỘ ---

    // Dò tìm va chạm lịch dựa trên khoảng thời gian bắt đầu và kết thúc
    private function checkSlotBusy($courtId, $date, $start, $end)
    {
        return BookingDetail::where('court_id', $courtId)->where('booking_date', $date)
            ->where(function ($q) use ($start, $end) {
                $q->where('start_time', '<', $end . ':00')->where('end_time', '>', $start . ':00');
            })
            ->whereHas('booking', function ($q) {
                $q->where('status', '!=', 'cancelled');
            })->exists();
    }

    // Động cơ tính giá tiền chính xác dựa trên sự đan xen các dải giá trong ngày
    private function internalCalculatePrice($courtId, $date, $start, $end)
    {
        $dayOfWeek = date('N', strtotime($date));
        $dayType = ($dayOfWeek >= 6) ? 'weekend' : 'weekday';

        $pricings = CourtPricing::where('court_id', $courtId)->where('day_type', $dayType)
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

            // Tìm điểm chung (Overlap) giữa ca chơi thực tế và khung giờ cấu hình bảng giá
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