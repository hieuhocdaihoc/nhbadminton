<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\Refund;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PaymentManagementController extends Controller
{
    private const BANK_METHODS = ['bank_transfer', 'sepay', 'online'];

    /**
     * Chức năng: Ghi nhận thông tin hoàn tiền. Hệ thống CHỈ lưu lại thông tin —
     * việc chuyển tiền thực tế do cá nhân thực hiện (tiền mặt hoặc banking cá nhân).
     */
    public function storeRefund(Request $request)
    {
        $validated = $request->validate([
            'payment_id'    => ['required', 'exists:payments,id'],
            'amount'        => ['required', 'numeric', 'min:1'],
            'reason'        => ['required', 'string', 'max:500'],
            'refund_method' => ['required', 'in:cash,bank_transfer'],
            'refund_info'   => ['nullable', 'string', 'max:255'],
            'bank_name'     => ['nullable', 'required_if:refund_method,bank_transfer', 'string', 'min:2', 'max:100'],
            'bank_account'  => ['nullable', 'required_if:refund_method,bank_transfer', 'string', 'regex:/^[A-Za-z0-9.\-]{4,50}$/'],
        ], [
            'bank_name.required_if' => 'Vui lòng nhập tên ngân hàng nhận tiền.',
            'bank_account.required_if' => 'Vui lòng nhập số tài khoản nhận tiền.',
            'bank_account.regex' => 'Số tài khoản chỉ được chứa chữ, số, dấu chấm hoặc dấu gạch ngang.',
        ]);

        $refundData = $validated;
        unset($refundData['bank_name'], $refundData['bank_account']);
        $refundData['refund_info'] = $validated['refund_method'] === 'bank_transfer'
            ? 'Ngân hàng: ' . trim($validated['bank_name']) . ' | STK: ' . trim($validated['bank_account'])
            : null;

        $refund = DB::transaction(function () use ($request, $validated, $refundData) {
            $payment = Payment::query()->lockForUpdate()->findOrFail($validated['payment_id']);

            if (!in_array($payment->status, ['success', 'completed'], true)) {
                throw ValidationException::withMessages([
                    'payment_id' => 'Chỉ có thể ghi nhận hoàn tiền cho giao dịch đã thanh toán thành công.',
                ]);
            }

            $reservedAmount = (float) Refund::query()
                ->where('payment_id', $payment->id)
                ->where('status', '!=', 'rejected')
                ->sum('amount');
            $refundableAmount = max(0, (float) $payment->amount - $reservedAmount);

            if ((float) $validated['amount'] > $refundableAmount) {
                throw ValidationException::withMessages([
                    'amount' => 'Số tiền hoàn vượt quá số tiền còn có thể hoàn của giao dịch.',
                ]);
            }

            return Refund::create($refundData + [
                'processed_by' => $request->user()->id,
                // Đây là thao tác ghi sổ sau khi nhân viên đã xử lý thủ công,
                // nên khoản hoàn được trừ khỏi doanh thu ngay khi lưu.
                'status' => 'completed',
            ]);
        });

        return response()->json([
            'status'  => 'success',
            'message' => 'Đã ghi nhận khoản hoàn tiền và cập nhật doanh thu thực nhận.',
            'data'    => $refund->load([
                'payment:id,payment_code,booking_id,amount',
                'processedBy:id,full_name',
            ]),
        ], 201);
    }

    /**
     * Chức năng: Cập nhật trạng thái phiếu hoàn tiền (nhân viên đã hoàn tiền mặt
     * ngoài đời thì đánh dấu "đã hoàn"; hoặc từ chối phiếu). Chỉ phiếu "đã hoàn"
     * mới được trừ khỏi doanh thu trong báo cáo thống kê.
     */
    public function updateRefundStatus(Request $request, $id)
    {
        $validated = $request->validate([
            'status' => ['required', 'in:recorded,pending,completed,rejected'],
        ]);

        $refund = DB::transaction(function () use ($id, $request, $validated) {
            $refund = Refund::query()->lockForUpdate()->findOrFail($id);

            if ($validated['status'] !== 'rejected' && $refund->payment_id) {
                $payment = Payment::query()->lockForUpdate()->findOrFail($refund->payment_id);
                $otherReservedAmount = (float) Refund::query()
                    ->where('payment_id', $payment->id)
                    ->where('id', '!=', $refund->id)
                    ->where('status', '!=', 'rejected')
                    ->sum('amount');

                if ((float) $refund->amount > max(0, (float) $payment->amount - $otherReservedAmount)) {
                    throw ValidationException::withMessages([
                        'status' => 'Không thể mở lại phiếu vì tổng tiền hoàn sẽ vượt quá giao dịch gốc.',
                    ]);
                }
            }

            $refund->update([
                'status'       => $validated['status'],
                'processed_by' => $request->user()->id,
            ]);

            return $refund;
        });

        return response()->json([
            'status'  => 'success',
            'message' => 'Đã cập nhật trạng thái phiếu hoàn tiền.',
            'data'    => $refund,
        ]);
    }

    /** Chức năng: Danh sách các lần hoàn tiền đã ghi nhận. */
    public function refunds(Request $request)
    {
        $refunds = Refund::with([
                'payment:id,payment_code,booking_id',
                'processedBy:id,full_name',
            ])
            ->orderByDesc('created_at')
            ->limit(200)
            ->get();

        return response()->json(['status' => 'success', 'data' => $refunds]);
    }

    /** Chức năng: Lấy danh sách giao dịch thanh toán để quản trị đối soát doanh thu. */
    public function index(Request $request)
    {
        $query = $this->withRefundTotals(
            Payment::with([
                'booking:id,booking_code,total_price,deposit_amount,remaining_amount,payment_status,status,user_id',
                'user:id,full_name,email,phone',
            ])
        );

        $query->when($request->filled('payment_method'), fn($q) => $q->where('payment_method', $request->payment_method))
              ->when($request->filled('status'),         fn($q) => $q->where('status', $request->status))
              ->when($request->filled('from_date'),      fn($q) => $q->whereDate('paid_at', '>=', $request->from_date))
              ->when($request->filled('to_date'),        fn($q) => $q->whereDate('paid_at', '<=', $request->to_date))
              // Tìm gọn theo đúng 4 thứ: mã thanh toán, mã đơn (kể cả mã hợp đồng cha
              // định kỳ/dài hạn — vì mỗi buổi con có mã riêng, khách thường nhớ mã hợp đồng), tên, SĐT.
              ->when($request->filled('keyword'), function ($q) use ($request) {
                  $keyword = $request->keyword;
                  $q->where(function ($sub) use ($keyword) {
                      $sub->where('payment_code', 'like', "%{$keyword}%")
                          ->orWhereHas('booking', fn($bq) => $bq
                              ->where('booking_code', 'like', "%{$keyword}%")
                              ->orWhereHas('recurringBooking', fn($rq) => $rq
                                  ->where('recurring_code', 'like', "%{$keyword}%")))
                          ->orWhereHas('user', fn($uq) => $uq
                              ->where('full_name', 'like', "%{$keyword}%")
                              ->orWhere('phone', 'like', "%{$keyword}%"));
                  });
              });

        $payments = $query->orderByDesc('paid_at')->paginate($request->get('per_page', 10));
        $payments->getCollection()->transform(
            fn(Payment $payment) => $this->appendRefundableAmount($payment)
        );

        return response()->json([
            'status'  => 'success',
            'message' => 'Lấy danh sách thanh toán thành công!',
            'data'    => $payments,
        ]);
    }

    /** Chức năng: Lấy chi tiết một giao dịch thanh toán. */
    public function show($id)
    {
        $payment = $this->withRefundTotals(
            Payment::with(['booking', 'user:id,full_name,email,phone'])
        )->findOrFail($id);
        $this->appendRefundableAmount($payment);

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

        $totalRevenue      = (float) (clone $query)->sum('amount');
        $totalTransactions = (clone $query)->count();
        $cashRevenue       = (float) (clone $query)->where('payment_method', 'cash')->sum('amount');
        $bankRevenue       = (float) (clone $query)->whereIn('payment_method', self::BANK_METHODS)->sum('amount');

        $refundQuery = Refund::query()->where('status', 'completed');
        $refundQuery
            ->when($request->filled('from_date'), fn($q) => $q->whereDate('created_at', '>=', $request->from_date))
            ->when($request->filled('to_date'), fn($q) => $q->whereDate('created_at', '<=', $request->to_date));

        $refundAmount = (float) (clone $refundQuery)->sum('amount');
        $cashRefundAmount = (float) (clone $refundQuery)->where('refund_method', 'cash')->sum('amount');
        $bankRefundAmount = (float) (clone $refundQuery)->where('refund_method', 'bank_transfer')->sum('amount');

        $revenueByMethod = (clone $query)
            ->selectRaw('payment_method, SUM(amount) as total_amount, COUNT(*) as total_transactions')
            ->groupBy('payment_method')
            ->get();

        return response()->json([
            'status'  => 'success',
            'message' => 'Lấy thống kê doanh thu thành công!',
            'data'    => [
                'total_revenue'      => $totalRevenue,
                'gross_revenue'      => $totalRevenue,
                'refund_amount'      => $refundAmount,
                'net_revenue'        => $totalRevenue - $refundAmount,
                'total_transactions' => $totalTransactions,
                'cash_revenue'       => $cashRevenue,
                'bank_revenue'       => $bankRevenue,
                'cash_refund_amount' => $cashRefundAmount,
                'bank_refund_amount' => $bankRefundAmount,
                'cash_net_revenue'   => $cashRevenue - $cashRefundAmount,
                'bank_net_revenue'   => $bankRevenue - $bankRefundAmount,
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

    private function withRefundTotals($query)
    {
        return $query
            ->withSum([
                'refunds as refunded_amount' => fn($q) => $q->where('status', 'completed'),
            ], 'amount')
            ->withSum([
                'refunds as reserved_refund_amount' => fn($q) => $q->where('status', '!=', 'rejected'),
            ], 'amount');
    }

    private function appendRefundableAmount(Payment $payment): Payment
    {
        $refundedAmount = (float) ($payment->refunded_amount ?? 0);
        $reservedAmount = (float) ($payment->reserved_refund_amount ?? 0);

        $payment->setAttribute('refunded_amount', $refundedAmount);
        $payment->setAttribute('refundable_amount', max(0, (float) $payment->amount - $reservedAmount));
        $payment->makeHidden('reserved_refund_amount');

        return $payment;
    }
}
