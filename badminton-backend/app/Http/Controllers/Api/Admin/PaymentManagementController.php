<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use Illuminate\Http\Request;

class PaymentManagementController extends Controller
{
    private const BANK_METHODS = ['bank_transfer', 'sepay', 'online'];

    /** Chức năng: Lấy danh sách giao dịch thanh toán để quản trị đối soát doanh thu. */
    public function index(Request $request)
    {
        $query = Payment::with([
            'booking:id,booking_code,total_price,deposit_amount,remaining_amount,payment_status,status,user_id',
            'user:id,full_name,email,phone',
        ]);

        $query->when($request->filled('payment_method'), fn($q) => $q->where('payment_method', $request->payment_method))
              ->when($request->filled('status'),         fn($q) => $q->where('status', $request->status))
              ->when($request->filled('from_date'),      fn($q) => $q->whereDate('paid_at', '>=', $request->from_date))
              ->when($request->filled('to_date'),        fn($q) => $q->whereDate('paid_at', '<=', $request->to_date))
              ->when($request->filled('keyword'), function ($q) use ($request) {
                  $keyword = $request->keyword;
                  $q->where(function ($sub) use ($keyword) {
                      $sub->where('payment_code', 'like', "%{$keyword}%")
                          ->orWhere('reference_code', 'like', "%{$keyword}%")
                          ->orWhere('payment_content', 'like', "%{$keyword}%")
                          ->orWhereHas('booking', fn($bq) => $bq->where('booking_code', 'like', "%{$keyword}%"))
                          ->orWhereHas('user', fn($uq) => $uq
                              ->where('full_name', 'like', "%{$keyword}%")
                              ->orWhere('email', 'like', "%{$keyword}%")
                              ->orWhere('phone', 'like', "%{$keyword}%"));
                  });
              });

        $payments = $query->orderByDesc('paid_at')->paginate($request->get('per_page', 10));

        return response()->json([
            'status'  => 'success',
            'message' => 'Lấy danh sách thanh toán thành công!',
            'data'    => $payments,
        ]);
    }

    /** Chức năng: Lấy chi tiết một giao dịch thanh toán. */
    public function show($id)
    {
        $payment = Payment::with(['booking', 'user:id,full_name,email,phone'])->findOrFail($id);

        return response()->json([
            'status'  => 'success',
            'message' => 'Lấy chi tiết thanh toán thành công!',
            'data'    => $payment,
        ]);
    }

    /** Chức năng: Tổng hợp doanh thu thanh toán theo thời gian, phương thức và trạng thái. */
    public function summary(Request $request)
    {
        $query = Payment::where('status', 'success');

        $query->when($request->filled('from_date'), fn($q) => $q->whereDate('paid_at', '>=', $request->from_date))
              ->when($request->filled('to_date'),   fn($q) => $q->whereDate('paid_at', '<=', $request->to_date));

        $totalRevenue      = (clone $query)->sum('amount');
        $totalTransactions = (clone $query)->count();
        $cashRevenue       = (clone $query)->where('payment_method', 'cash')->sum('amount');
        $bankRevenue       = (clone $query)->whereIn('payment_method', self::BANK_METHODS)->sum('amount');

        $revenueByMethod = (clone $query)
            ->selectRaw('payment_method, SUM(amount) as total_amount, COUNT(*) as total_transactions')
            ->groupBy('payment_method')
            ->get();

        return response()->json([
            'status'  => 'success',
            'message' => 'Lấy thống kê doanh thu thành công!',
            'data'    => [
                'total_revenue'      => $totalRevenue,
                'total_transactions' => $totalTransactions,
                'cash_revenue'       => $cashRevenue,
                'bank_revenue'       => $bankRevenue,
                'revenue_by_method'  => $revenueByMethod,
            ],
        ]);
    }

    /** Chức năng: Lấy toàn bộ giao dịch thanh toán thuộc một đơn đặt sân. */
    public function paymentsByBooking($bookingId)
    {
        $payments = Payment::with(['user:id,full_name,email,phone'])
            ->where('booking_id', $bookingId)
            ->orderByDesc('paid_at')
            ->get();

        return response()->json([
            'status'  => 'success',
            'message' => 'Lấy lịch sử thanh toán của đơn thành công!',
            'data'    => $payments,
        ]);
    }
}
