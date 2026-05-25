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
    /**
     * -------------------------------------------------------------
     * BÁO CÁO TỔNG QUAN DASHBOARD ADMIN
     * -------------------------------------------------------------
     */
    public function index(Request $request)
    {
        $fromDate = $request->from_date
            ? Carbon::parse($request->from_date)->startOfDay()
            : now()->startOfMonth();

        $toDate = $request->to_date
            ? Carbon::parse($request->to_date)->endOfDay()
            : now()->endOfDay();

        $fromDateOnly = $fromDate->toDateString();
        $toDateOnly = $toDate->toDateString();

        /**
         * ---------------------------------------------------------
         * 1. DOANH THU THỰC THU
         * ---------------------------------------------------------
         * Lấy từ bảng payments vì đây là tiền thật sự đã thu.
         */
        $paymentQuery = Payment::where('status', 'success')
            ->whereBetween('paid_at', [$fromDate, $toDate]);

        $totalRevenue = (clone $paymentQuery)->sum('amount');

        $cashRevenue = (clone $paymentQuery)
            ->where('payment_method', 'cash')
            ->sum('amount');

        $bankRevenue = (clone $paymentQuery)
            ->whereIn('payment_method', ['bank_transfer', 'sepay', 'online'])
            ->sum('amount');

        /**
         * ---------------------------------------------------------
         * 2. DOANH THU THEO HÓA ĐƠN
         * ---------------------------------------------------------
         * Dùng bookings để tách tiền sân và tiền dịch vụ/pro-shop.
         */
        $bookingRevenueQuery = Booking::where('status', '!=', 'cancelled')
            ->whereHas('details', function ($q) use ($fromDateOnly, $toDateOnly) {
                $q->whereBetween('booking_date', [$fromDateOnly, $toDateOnly]);
            });

        $courtRevenue = (clone $bookingRevenueQuery)->sum('subtotal_court');
        $serviceRevenue = (clone $bookingRevenueQuery)->sum('subtotal_service');

        /**
         * ---------------------------------------------------------
         * 3. TỔNG TIỀN NHẬP HÀNG
         * ---------------------------------------------------------
         */
        $purchaseAmount = PurchaseOrder::whereBetween('created_at', [$fromDate, $toDate])
            ->sum('total_amount');

        /**
         * ---------------------------------------------------------
         * 4. LƯỢT ĐẶT SÂN
         * ---------------------------------------------------------
         * 1 booking_id = 1 lần chơi / 1 hóa đơn.
         */
        $totalBookings = (clone $bookingRevenueQuery)->count();

        /**
         * ---------------------------------------------------------
         * 5. KHÁCH HÀNG MỚI THEO SỐ ĐIỆN THOẠI
         * ---------------------------------------------------------
         * Tính số điện thoại có lần đặt đầu tiên nằm trong khoảng lọc.
         */
        $newCustomers = DB::table('bookings as b')
            ->whereNotNull('b.customer_phone')
            ->where('b.customer_phone', '!=', '')
            ->whereBetween('b.created_at', [$fromDate, $toDate])
            ->whereRaw('b.created_at = (
                SELECT MIN(b2.created_at)
                FROM bookings b2
                WHERE b2.customer_phone = b.customer_phone
            )')
            ->distinct('b.customer_phone')
            ->count('b.customer_phone');

        /**
         * ---------------------------------------------------------
         * 6. TỶ LỆ LẤP ĐẦY
         * ---------------------------------------------------------
         * Công thức tạm dùng:
         * tổng phút đã đặt / tổng phút khai thác dự kiến.
         *
         * Tạm giả định mỗi sân khai thác 16 giờ/ngày.
         * Sau này có thể nâng cấp lấy theo bảng court_pricing.
         */
        $activeCourtCount = Court::where('status', 'active')->count();

        $totalBookedMinutes = BookingDetail::whereBetween('booking_date', [$fromDateOnly, $toDateOnly])
            ->whereHas('booking', function ($q) {
                $q->where('status', '!=', 'cancelled');
            })
            ->sum('duration_minutes');

        $days = max($fromDate->diffInDays($toDate) + 1, 1);
        $availableMinutes = $activeCourtCount * $days * 16 * 60;

        $occupancyRate = $availableMinutes > 0
            ? round(($totalBookedMinutes / $availableMinutes) * 100, 1)
            : 0;

        /**
         * ---------------------------------------------------------
         * 7. BIỂU ĐỒ DOANH THU THEO NGÀY
         * ---------------------------------------------------------
         */
        $revenueChart = Payment::selectRaw('DATE(paid_at) as date, SUM(amount) as revenue')
            ->where('status', 'success')
            ->whereBetween('paid_at', [$fromDate, $toDate])
            ->groupByRaw('DATE(paid_at)')
            ->orderByRaw('DATE(paid_at)')
            ->get()
            ->map(function ($item) {
                return [
                    'date' => Carbon::parse($item->date)->format('d/m'),
                    'revenue' => (float) $item->revenue,
                ];
            });

        /**
         * ---------------------------------------------------------
         * 8. HIỆU SUẤT TỪNG SÂN
         * ---------------------------------------------------------
         */
        $courtPerformance = Court::where('status', 'active')
            ->withSum([
                'bookingDetails as booked_minutes' => function ($q) use ($fromDateOnly, $toDateOnly) {
                    $q->whereBetween('booking_date', [$fromDateOnly, $toDateOnly])
                        ->whereHas('booking', function ($bookingQuery) {
                            $bookingQuery->where('status', '!=', 'cancelled');
                        });
                }
            ], 'duration_minutes')
            ->withCount([
                'bookingDetails as booking_count' => function ($q) use ($fromDateOnly, $toDateOnly) {
                    $q->whereBetween('booking_date', [$fromDateOnly, $toDateOnly])
                        ->whereHas('booking', function ($bookingQuery) {
                            $bookingQuery->where('status', '!=', 'cancelled');
                        });
                }
            ])
            ->get()
            ->map(function ($court) use ($days) {
                $bookedMinutes = (int) ($court->booked_minutes ?? 0);
                $availableMinutes = $days * 16 * 60;

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

        /**
         * ---------------------------------------------------------
         * 9. LƯỢT ĐẶT THEO KHUNG GIỜ
         * ---------------------------------------------------------
         */
        $timeSlotStats = [
            [
                'label' => '06-09h',
                'booking_count' => $this->countBookingsByTimeRange($fromDateOnly, $toDateOnly, '06:00:00', '09:00:00')
            ],
            [
                'label' => '09-12h',
                'booking_count' => $this->countBookingsByTimeRange($fromDateOnly, $toDateOnly, '09:00:00', '12:00:00')
            ],
            [
                'label' => '12-15h',
                'booking_count' => $this->countBookingsByTimeRange($fromDateOnly, $toDateOnly, '12:00:00', '15:00:00')
            ],
            [
                'label' => '15-18h',
                'booking_count' => $this->countBookingsByTimeRange($fromDateOnly, $toDateOnly, '15:00:00', '18:00:00')
            ],
            [
                'label' => '18-22h',
                'booking_count' => $this->countBookingsByTimeRange($fromDateOnly, $toDateOnly, '18:00:00', '22:00:00')
            ],
        ];

        /**
         * ---------------------------------------------------------
         * 10. ĐƠN GẦN NHẤT
         * ---------------------------------------------------------
         */
        $recentBookings = Booking::with([
            'details' => function ($q) {
                $q->orderBy('booking_date')->orderBy('start_time');
            },
            'details.court'
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
                    'purchase_amount' => (float) $purchaseAmount,
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
            ]
        ]);
    }

    private function countBookingsByTimeRange($fromDate, $toDate, $start, $end)
    {
        return BookingDetail::whereBetween('booking_date', [$fromDate, $toDate])
            ->where('start_time', '<', $end)
            ->where('end_time', '>', $start)
            ->whereHas('booking', function ($q) {
                $q->where('status', '!=', 'cancelled');
            })
            ->count();
    }
}