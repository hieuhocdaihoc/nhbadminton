<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\BookingDetail;
use App\Models\Court;
use App\Models\Payment;
use App\Models\PurchaseOrder;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardReportController extends Controller
{
    private const HOURS_PER_DAY = 16;
    private const BANK_METHODS = ['bank_transfer', 'sepay', 'online'];
    private const TIME_SLOTS = [
        ['label' => '06-09h', 'start' => '06:00:00', 'end' => '09:00:00'],
        ['label' => '09-12h', 'start' => '09:00:00', 'end' => '12:00:00'],
        ['label' => '12-15h', 'start' => '12:00:00', 'end' => '15:00:00'],
        ['label' => '15-18h', 'start' => '15:00:00', 'end' => '18:00:00'],
        ['label' => '18-22h', 'start' => '18:00:00', 'end' => '22:00:00'],
    ];

    /** Chức năng: Tổng hợp KPI dashboard admin như doanh thu, booking, hiệu suất sân và dữ liệu vận hành. */
    public function index(Request $request)
    {
        $fromDate = $request->filled('from_date')
            ? Carbon::parse($request->from_date)->startOfDay()
            : now()->startOfMonth();

        $toDate = $request->filled('to_date')
            ? Carbon::parse($request->to_date)->endOfDay()
            : now()->endOfDay();

        $fromDateOnly = $fromDate->toDateString();
        $toDateOnly = $toDate->toDateString();

        $paymentQuery = Payment::where('status', 'success')
            ->whereBetween('paid_at', [$fromDate, $toDate]);

        // Tổng tiền đã hoàn cho khách (chỉ tính phiếu đã hoàn xong) — trừ khỏi lợi nhuận
        $refundAmount = \App\Models\Refund::where('status', 'completed')
            ->whereBetween('created_at', [$fromDate, $toDate])
            ->sum('amount');

        // Doanh thu thực nhận = tổng mọi giao dịch thành công (không lọc theo payment_method,
        // vì các luồng mua thẻ hiện ghi payment_method khác nhau tùy đường vào) trừ tiền đã hoàn.
        // Cùng công thức với trang Quản lý doanh thu (PaymentManagementController::summary).
        $grossRevenue = (clone $paymentQuery)->sum('amount');
        $totalRevenue = $grossRevenue - $refundAmount;
        $totalTransactions = (clone $paymentQuery)->count();
        $cashRevenue = (clone $paymentQuery)->where('payment_method', 'cash')->sum('amount');
        $bankRevenue = (clone $paymentQuery)->whereIn('payment_method', self::BANK_METHODS)->whereNotNull('booking_id')->sum('amount');
        $membershipRevenue = (clone $paymentQuery)->whereIn('payment_method', self::BANK_METHODS)->whereNull('booking_id')->sum('amount');
        $cardCreditUsage = (clone $paymentQuery)->where('payment_method', 'membership_card')->sum('amount');

        $bookingRevenueQuery = Booking::where('status', '!=', 'cancelled')
            ->whereHas('details', fn($q) => $q->whereBetween('booking_date', [$fromDateOnly, $toDateOnly]));

        $courtRevenue = (clone $bookingRevenueQuery)->sum('subtotal_court');
        $serviceRevenue = (clone $bookingRevenueQuery)->sum('subtotal_service');
        $totalBookings = (clone $bookingRevenueQuery)->count();

        $purchaseAmount = PurchaseOrder::whereBetween('created_at', [$fromDate, $toDate])->sum('total_amount');

        $newCustomers = DB::table('bookings as b')
            ->whereNotNull('b.customer_phone')
            ->where('b.customer_phone', '!=', '')
            ->whereBetween('b.created_at', [$fromDate, $toDate])
            ->whereRaw('b.created_at = (SELECT MIN(b2.created_at) FROM bookings b2 WHERE b2.customer_phone = b.customer_phone)')
            ->distinct('b.customer_phone')
            ->count('b.customer_phone');

        $activeCourtCount = Court::where('status', 'active')->count();
        $totalBookedMinutes = BookingDetail::whereBetween('booking_date', [$fromDateOnly, $toDateOnly])
            ->whereHas('booking', fn($q) => $q->where('status', '!=', 'cancelled'))
            ->sum('duration_minutes');

        $days = max($fromDate->diffInDays($toDate) + 1, 1);
        $availableMinutes = $activeCourtCount * $days * self::HOURS_PER_DAY * 60;
        $occupancyRate = $availableMinutes > 0
            ? round(($totalBookedMinutes / $availableMinutes) * 100, 1)
            : 0;

        $revenueChart = Payment::selectRaw('DATE(paid_at) as date, SUM(amount) as revenue')
            ->where('status', 'success')
            ->whereBetween('paid_at', [$fromDate, $toDate])
            ->groupByRaw('DATE(paid_at)')
            ->orderByRaw('DATE(paid_at)')
            ->get()
            ->map(fn($item) => [
                'date' => Carbon::parse($item->date)->format('d/m'),
                'revenue' => (float) $item->revenue,
            ]);

        $courtPerformance = Court::where('status', 'active')
            ->withSum([
                'bookingDetails as booked_minutes' => fn($q) => $q
                    ->whereBetween('booking_date', [$fromDateOnly, $toDateOnly])
                    ->whereHas('booking', fn($bq) => $bq->where('status', '!=', 'cancelled')),
            ], 'duration_minutes')
            ->withCount([
                'bookingDetails as booking_count' => fn($q) => $q
                    ->whereBetween('booking_date', [$fromDateOnly, $toDateOnly])
                    ->whereHas('booking', fn($bq) => $bq->where('status', '!=', 'cancelled')),
            ])
            ->get()
            ->map(function ($court) use ($days) {
                $bookedMinutes = (int) ($court->booked_minutes ?? 0);
                $availableMinutes = $days * self::HOURS_PER_DAY * 60;

                return [
                    'court_id' => $court->id,
                    'court_name' => $court->name,
                    'booking_count' => (int) $court->booking_count,
                    'booked_hours' => round($bookedMinutes / 60, 1),
                    'occupancy_rate' => $availableMinutes > 0
                        ? round(($bookedMinutes / $availableMinutes) * 100, 1)
                        : 0,
                ];
            })
            ->sortByDesc('occupancy_rate')
            ->values();

        $timeSlotStats = array_map(fn($slot) => [
            'label' => $slot['label'],
            'booking_count' => $this->countBookingsByTimeRange($fromDateOnly, $toDateOnly, $slot['start'], $slot['end']),
        ], self::TIME_SLOTS);

        $recentBookings = Booking::with([
            'details' => fn($q) => $q->orderBy('booking_date')->orderBy('start_time'),
            'details.court',
        ])
            ->whereHas('details')
            ->orderByDesc('created_at')
            ->limit(8)
            ->get()
            ->map(function ($booking) {
                $firstDetail = $booking->details->first();
                $lastDetail = $booking->details->last();

                return [
                    'booking_id' => $booking->id,
                    'booking_code' => $booking->booking_code,
                    'customer_name' => $booking->customer_name,
                    'customer_phone' => $booking->customer_phone,
                    'court_name' => $firstDetail?->court?->name,
                    'play_date' => $firstDetail?->booking_date,
                    'time_slot' => $firstDetail
                        ? substr($firstDetail->start_time, 0, 5) . ' - ' . substr($lastDetail->end_time, 0, 5)
                        : null,
                    'total_price' => (float) $booking->total_price,
                    'payment_status' => $booking->payment_status,
                    'status' => $booking->status,
                    'created_at' => $booking->created_at,
                ];
            });

        return response()->json([
            'status' => 'success',
            'message' => 'Lấy báo cáo dashboard thành công!',
            'data' => [
                'filters' => [
                    'from_date' => $fromDateOnly,
                    'to_date' => $toDateOnly,
                ],
                'summary' => [
                    'total_revenue' => (float) $totalRevenue,
                    'court_revenue' => (float) $courtRevenue,
                    'service_revenue' => (float) $serviceRevenue,
                    'cash_revenue' => (float) $cashRevenue,
                    'bank_revenue' => (float) $bankRevenue,
                    'membership_revenue' => (float) $membershipRevenue,
                    'card_credit_usage' => (float) $cardCreditUsage,
                    'net_revenue' => (float) $totalRevenue - (float) $refundAmount,
                    'purchase_amount' => (float) $purchaseAmount,
                    'refund_amount' => (float) $refundAmount,
                    'total_transactions' => (int) $totalTransactions,
                    'total_bookings' => (int) $totalBookings,
                    'new_customers' => (int) $newCustomers,
                    'occupancy_rate' => (float) $occupancyRate,
                ],
                'charts' => [
                    'revenue_chart' => $revenueChart,
                    'time_slot_stats' => $timeSlotStats,
                ],
                'court_performance' => $courtPerformance,
                'recent_bookings' => $recentBookings,
            ],
        ]);
    }

    /** Chức năng: Trả về hiệu suất từng sân trong khoảng thời gian — dùng cho trang báo cáo hiệu suất sân. */
    public function courtPerformance(Request $request)
    {
        $fromDate = $request->filled('from_date')
            ? Carbon::parse($request->from_date)->startOfDay()
            : now()->startOfMonth();

        $toDate = $request->filled('to_date')
            ? Carbon::parse($request->to_date)->endOfDay()
            : now()->endOfDay();

        $fromDateOnly = $fromDate->toDateString();
        $toDateOnly   = $toDate->toDateString();
        $days = max($fromDate->diffInDays($toDate) + 1, 1);

        $courtPerformance = Court::where('status', 'active')
            ->withSum([
                'bookingDetails as booked_minutes' => fn($q) => $q
                    ->whereBetween('booking_date', [$fromDateOnly, $toDateOnly])
                    ->whereHas('booking', fn($bq) => $bq->where('status', '!=', 'cancelled')),
            ], 'duration_minutes')
            ->withSum([
                'bookingDetails as revenue' => fn($q) => $q
                    ->whereBetween('booking_date', [$fromDateOnly, $toDateOnly])
                    ->whereHas('booking', fn($bq) => $bq->where('status', '!=', 'cancelled')),
            ], 'price')
            ->withCount([
                'bookingDetails as bookings' => fn($q) => $q
                    ->whereBetween('booking_date', [$fromDateOnly, $toDateOnly])
                    ->whereHas('booking', fn($bq) => $bq->where('status', '!=', 'cancelled')),
            ])
            ->get()
            ->map(function ($court) use ($days) {
                $bookedMinutes    = (int) ($court->booked_minutes ?? 0);
                $availableMinutes = $days * self::HOURS_PER_DAY * 60;

                return [
                    'court_id'    => $court->id,
                    'court_name'  => $court->name,
                    'bookings'    => (int) $court->bookings,
                    'booked_hours' => round($bookedMinutes / 60, 1),
                    'utilization' => $availableMinutes > 0
                        ? round(($bookedMinutes / $availableMinutes) * 100, 1)
                        : 0,
                    'revenue'     => (float) ($court->revenue ?? 0),
                ];
            })
            ->sortByDesc('utilization')
            ->values();

        return response()->json([
            'status' => 'success',
            'data'   => $courtPerformance,
        ]);
    }

    /** Chức năng: Đếm số lượt đặt sân có khung giờ giao nhau với khoảng thời gian chỉ định. */
    private function countBookingsByTimeRange(string $fromDate, string $toDate, string $start, string $end): int
    {
        return BookingDetail::whereBetween('booking_date', [$fromDate, $toDate])
            ->where('start_time', '<', $end)
            ->where('end_time', '>', $start)
            ->whereHas('booking', fn($q) => $q->where('status', '!=', 'cancelled'))
            ->count();
    }
}
