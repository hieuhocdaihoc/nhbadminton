<?php

namespace App\Http\Controllers\Api\Payment;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Payment;
use App\Services\PaymentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SePayController extends Controller
{
    /**
     * Nhận webhook thanh toán từ SePay.
     */
    /**
     * Chức năng: Nhận webhook SePay, dò mã booking, chống giao dịch trùng và ghi nhận thanh toán chuyển khoản.
     */
    public function webhook(Request $request)
    {
        if ($request->transferType !== 'in') {
            return response()->json([
                'success' => true,
                'message' => 'Bỏ qua giao dịch không phải tiền vào'
            ]);
        }

        $searchText = trim(
            ($request->code ?? '') . ' ' .
            ($request->content ?? '') . ' ' .
            ($request->description ?? '') . ' ' .
            ($request->referenceCode ?? '')
        );

        preg_match('/BILL[\s_-]?[A-Z0-9]+/i', $searchText, $matches);

        if (empty($matches)) {
            return response()->json([
                'success' => true,
                'message' => 'Không tìm thấy mã booking trong nội dung chuyển khoản',
                'debug_search_text' => $searchText
            ]);
        }

        $rawBookingCode = strtoupper($matches[0]);
        $rawBookingCode = str_replace([' ', '-'], '_', $rawBookingCode);
        $bookingCode = str_contains($rawBookingCode, 'BILL_')
            ? $rawBookingCode
            : 'BILL_' . str_replace('BILL', '', $rawBookingCode);

        $booking = Booking::where('booking_code', $bookingCode)->first();

        if (!$booking) {
            return response()->json([
                'success' => true,
                'message' => 'Không tìm thấy đơn đặt sân tương ứng',
                'debug_booking_code' => $bookingCode,
                'debug_search_text' => $searchText
            ]);
        }

        $paidAmount = (float) $request->transferAmount;

        if ($paidAmount <= 0) {
            return response()->json([
                'success' => false,
                'message' => 'Số tiền thanh toán không hợp lệ'
            ], 422);
        }

        // Chỉ kiểm tra trùng theo khóa webhook thật sự có giá trị để tránh bắt nhầm các dòng NULL.
        $duplicateQuery = Payment::query();
        $hasDuplicateKey = false;

        if ($request->filled('referenceCode')) {
            $duplicateQuery->where('reference_code', $request->referenceCode);
            $hasDuplicateKey = true;
        }

        if ($request->filled('id')) {
            $hasDuplicateKey
                ? $duplicateQuery->orWhere('sepay_transaction_id', $request->id)
                : $duplicateQuery->where('sepay_transaction_id', $request->id);
            $hasDuplicateKey = true;
        }

        if ($hasDuplicateKey && $duplicateQuery->exists()) {
            return response()->json([
                'success' => true,
                'message' => 'Giao dịch đã được xử lý trước đó'
            ]);
        }

        return DB::transaction(function () use ($request, $booking, $searchText, $paidAmount) {
            $booking = Booking::where('id', $booking->id)
                ->lockForUpdate()
                ->firstOrFail();

            $duplicateQuery = Payment::query();
            $hasDuplicateKey = false;

            if ($request->filled('referenceCode')) {
                $duplicateQuery->where('reference_code', $request->referenceCode);
                $hasDuplicateKey = true;
            }

            if ($request->filled('id')) {
                $hasDuplicateKey
                    ? $duplicateQuery->orWhere('sepay_transaction_id', $request->id)
                    : $duplicateQuery->where('sepay_transaction_id', $request->id);
                $hasDuplicateKey = true;
            }

            if ($hasDuplicateKey && $duplicateQuery->exists()) {
                return response()->json([
                    'success' => true,
                    'message' => 'Giao dịch đã được xử lý trước đó'
                ]);
            }

            $payment = app(PaymentService::class)->recordSuccessfulPayment($booking, [
                'payment_method' => 'bank_transfer',
                'amount' => $paidAmount,
                'paid_at' => $request->transactionDate ?? now(),
                'sepay_transaction_id' => $request->id,
                'bank_gateway' => $request->gateway,
                'reference_code' => $request->referenceCode,
                'payment_content' => $searchText,
            ]);

            $booking->refresh();

            return response()->json([
                'success' => true,
                'message' => 'Xử lý thanh toán SePay thành công',
                'data' => [
                    'booking_code' => $booking->booking_code,
                    'payment_code' => $payment->payment_code,
                    'paid_amount' => $paidAmount,
                    'payment_status' => $booking->payment_status,
                    'remaining_amount' => $booking->remaining_amount,
                ]
            ]);
        });
    }

    /**
     * Lấy thông tin thanh toán và QR chuyển khoản cho đơn đặt sân.
     */
    /**
     * Chức năng: Trả thông tin số tiền cần thanh toán và QR chuyển khoản cho một đơn đặt sân.
     */
    public function paymentInfo($bookingId)
    {
        $booking = Booking::findOrFail($bookingId);
        $amount = (float) $booking->remaining_amount;
        $transferPrefix = env('SEPAY_TRANSFER_PREFIX');
        $transferContent = $transferPrefix
            ? $transferPrefix . ' ' . $booking->booking_code
            : $booking->booking_code;

        $bankName = env('SEPAY_BANK_NAME');
        $bankAccount = env('SEPAY_BANK_ACCOUNT');
        $accountHolder = env('SEPAY_ACCOUNT_HOLDER');

        $qrUrl = 'https://qr.sepay.vn/img?' . http_build_query([
            'acc' => $bankAccount,
            'bank' => $bankName,
            'amount' => $amount,
            'des' => $transferContent,
        ]);

        return response()->json([
            'message' => 'Lấy thông tin thanh toán thành công',
            'data' => [
                'booking_id' => $booking->id,
                'booking_code' => $booking->booking_code,
                'total_price' => (float) $booking->total_price,
                'deposit_amount' => (float) $booking->deposit_amount,
                'remaining_amount' => (float) $booking->remaining_amount,
                'payment_status' => $booking->payment_status,
                'bank_name' => $bankName,
                'bank_account' => $bankAccount,
                'account_holder' => $accountHolder,
                'transfer_content' => $transferContent,
                'qr_url' => $qrUrl,
            ]
        ]);
    }
}
