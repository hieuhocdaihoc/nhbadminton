<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use Illuminate\Http\Request;

class PaymentManagementController extends Controller
{
    /**
     * -------------------------------------------------------------
     * DANH SÁCH THANH TOÁN CHO ADMIN
     * -------------------------------------------------------------
     */
    public function index(Request $request)
    {
        $query = Payment::with([
            'booking:id,booking_code,total_price,deposit_amount,remaining_amount,payment_status,status,user_id',
            'user:id,full_name,email,phone'
        ]);

        // Lọc theo phương thức thanh toán
        if ($request->filled('payment_method')) {
            $query->where('payment_method', $request->payment_method);
        }

        // Lọc theo trạng thái payment
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        // Lọc từ ngày
        if ($request->filled('from_date')) {
            $query->whereDate('paid_at', '>=', $request->from_date);
        }

        // Lọc đến ngày
        if ($request->filled('to_date')) {
            $query->whereDate('paid_at', '<=', $request->to_date);
        }

        // Tìm kiếm theo mã thanh toán, mã đơn, nội dung thanh toán hoặc thông tin người dùng
        if ($request->filled('keyword')) {
            $keyword = $request->keyword;

            $query->where(function ($q) use ($keyword) {
                $q->where('payment_code', 'like', "%{$keyword}%")
                    ->orWhere('reference_code', 'like', "%{$keyword}%")
                    ->orWhere('payment_content', 'like', "%{$keyword}%")
                    ->orWhereHas('booking', function ($bookingQuery) use ($keyword) {
                        $bookingQuery->where('booking_code', 'like', "%{$keyword}%");
                    })
                    ->orWhereHas('user', function ($userQuery) use ($keyword) {
                        $userQuery->where('full_name', 'like', "%{$keyword}%")
                            ->orWhere('email', 'like', "%{$keyword}%")
                            ->orWhere('phone', 'like', "%{$keyword}%");
                    });
            });
        }

        $payments = $query
            ->orderByDesc('paid_at')
            ->paginate($request->get('per_page', 10));

        return response()->json([
            'status' => 'success',
            'message' => 'Lấy danh sách thanh toán thành công!',
            'data' => $payments
        ]);
    }

    /**
     * -------------------------------------------------------------
     * CHI TIẾT MỘT THANH TOÁN
     * -------------------------------------------------------------
     */
    public function show($id)
    {
        $payment = Payment::with([
            'booking',
            'user:id,full_name,email,phone'
        ])->findOrFail($id);

        return response()->json([
            'status' => 'success',
            'message' => 'Lấy chi tiết thanh toán thành công!',
            'data' => $payment
        ]);
    }

    /**
     * -------------------------------------------------------------
     * THỐNG KÊ DOANH THU
     * -------------------------------------------------------------
     */
    public function summary(Request $request)
    {
        $query = Payment::query()
            ->where('status', 'success');

        // Lọc từ ngày
        if ($request->filled('from_date')) {
            $query->whereDate('paid_at', '>=', $request->from_date);
        }

        // Lọc đến ngày
        if ($request->filled('to_date')) {
            $query->whereDate('paid_at', '<=', $request->to_date);
        }

        $totalRevenue = (clone $query)->sum('amount');

        $totalTransactions = (clone $query)->count();

        $cashRevenue = (clone $query)
            ->where('payment_method', 'cash')
            ->sum('amount');

        $bankRevenue = (clone $query)
            ->whereIn('payment_method', ['bank_transfer', 'sepay', 'online'])
            ->sum('amount');

        $revenueByMethod = (clone $query)
            ->selectRaw('payment_method, SUM(amount) as total_amount, COUNT(*) as total_transactions')
            ->groupBy('payment_method')
            ->get();

        return response()->json([
            'status' => 'success',
            'message' => 'Lấy thống kê doanh thu thành công!',
            'data' => [
                'total_revenue' => $totalRevenue,
                'total_transactions' => $totalTransactions,
                'cash_revenue' => $cashRevenue,
                'bank_revenue' => $bankRevenue,
                'revenue_by_method' => $revenueByMethod,
            ]
        ]);
    }

    /**
     * -------------------------------------------------------------
     * LỊCH SỬ THANH TOÁN THEO ĐƠN
     * -------------------------------------------------------------
     */
    public function paymentsByBooking($bookingId)
    {
        $payments = Payment::with([
            'user:id,full_name,email,phone'
        ])
            ->where('booking_id', $bookingId)
            ->orderByDesc('paid_at')
            ->get();

        return response()->json([
            'status' => 'success',
            'message' => 'Lấy lịch sử thanh toán của đơn thành công!',
            'data' => $payments
        ]);
    }
}