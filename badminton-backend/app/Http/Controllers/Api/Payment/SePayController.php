<?php

namespace App\Http\Controllers\Api\Payment;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SePayController extends Controller
{
    /**
     * -------------------------------------------------------------
     * NHẬN WEBHOOK THANH TOÁN TỪ SEPAY
     * -------------------------------------------------------------
     */
    public function webhook(Request $request)
    {
        // Chỉ xử lý giao dịch tiền vào
        if ($request->transferType !== 'in') {
            return response()->json([
                'success' => true,
                'message' => 'Bỏ qua giao dịch không phải tiền vào'
            ]);
        }

        // Lấy nội dung chuyển khoản từ SePay
        $content = $request->content ?? '';

        // Gộp nhiều trường lại để dò mã booking an toàn hơn
        $searchText = trim(
            ($request->code ?? '') . ' ' .
            ($request->content ?? '') . ' ' .
            ($request->description ?? '') . ' ' .
            ($request->referenceCode ?? '')
        );

        // Tìm mã booking trong dữ liệu SePay gửi về
        preg_match('/BILL[\s_-]?[A-Z0-9]+/i', $searchText, $matches);

        if (empty($matches)) {
            return response()->json([
                'success' => true,
                'message' => 'Không tìm thấy mã booking trong nội dung chuyển khoản',
                'debug_search_text' => $searchText
            ]);
        }

        // Chuẩn hóa mã booking về đúng dạng trong database
        $rawBookingCode = strtoupper($matches[0]);
        $rawBookingCode = str_replace([' ', '-'], '_', $rawBookingCode);

        // Nếu nội dung là BILLWH9I2Q thì chuyển thành BILL_WH9I2Q
        if (!str_contains($rawBookingCode, 'BILL_')) {
            $bookingCode = 'BILL_' . str_replace('BILL', '', $rawBookingCode);
        } else {
            $bookingCode = $rawBookingCode;
        }

        // Tìm đơn đặt sân theo mã booking
        $booking = Booking::where('booking_code', $bookingCode)->first();

        if (!$booking) {
            return response()->json([
                'success' => true,
                'message' => 'Không tìm thấy đơn đặt sân tương ứng',
                'debug_booking_code' => $bookingCode,
                'debug_search_text' => $searchText
            ]);
        }

        // Kiểm tra giao dịch đã được xử lý trước đó chưa
        $isExistPayment = Payment::where('reference_code', $request->referenceCode)
            ->orWhere('sepay_transaction_id', $request->id)
            ->exists();

        if ($isExistPayment) {
            return response()->json([
                'success' => true,
                'message' => 'Giao dịch đã được xử lý trước đó'
            ]);
        }

        // Xử lý thanh toán và cập nhật booking trong transaction
        return DB::transaction(function () use ($request, $booking, $searchText) {

            // Khóa booking để tránh cập nhật trùng khi webhook gửi lại
            $booking = Booking::where('id', $booking->id)
                ->lockForUpdate()
                ->first();

            // Số tiền khách đã chuyển
            $paidAmount = (float) $request->transferAmount;

            // Số tiền còn phải thanh toán trước khi ghi nhận giao dịch
            $currentRemaining = (float) $booking->remaining_amount;

            // Tổng tiền đã thanh toán sau giao dịch này
            $newDepositAmount = (float) $booking->deposit_amount + $paidAmount;

            // Số tiền còn lại sau giao dịch này
            $newRemainingAmount = max($currentRemaining - $paidAmount, 0);

            // Xác định trạng thái thanh toán
            $paymentStatus = $newRemainingAmount <= 0 ? 'paid' : 'partially_paid';

            // Tạo mã phiếu thanh toán
            $paymentCode = 'PAY_' . strtoupper(Str::random(8));

            // Lưu lịch sử giao dịch vào bảng payments
            $payment = Payment::create([
                'payment_code' => $paymentCode,
                'booking_id' => $booking->id,
                'user_id' => $booking->user_id,
                'payment_method' => 'bank_transfer',
                'amount' => $paidAmount,
                'paid_at' => $request->transactionDate ?? now(),
                'status' => 'success',
                'sepay_transaction_id' => $request->id,
                'bank_gateway' => $request->gateway,
                'reference_code' => $request->referenceCode,
                'payment_content' => $searchText,
            ]);

            // Cập nhật trạng thái thanh toán của booking
            $booking->deposit_amount = $newDepositAmount;
            $booking->remaining_amount = $newRemainingAmount;
            $booking->payment_status = $paymentStatus;

            // Nếu đơn đang chờ và khách đã thanh toán thì tự động xác nhận đơn
            if ($booking->status === 'pending') {
                $booking->status = 'confirmed';
            }

            $booking->save();

            // Trả kết quả đúng format để SePay xác nhận webhook thành công
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
     * -------------------------------------------------------------
     * LẤY THÔNG TIN THANH TOÁN CỦA ĐƠN ĐẶT SÂN
     * -------------------------------------------------------------
     */
    public function paymentInfo($bookingId)
    {
        // Tìm đơn đặt sân theo id
        $booking = Booking::findOrFail($bookingId);

        // Lấy số tiền còn phải thanh toán
        $amount = (float) $booking->remaining_amount;

        // Tạo nội dung chuyển khoản theo mã thanh toán SePay
        // Tạo nội dung chuyển khoản theo mã đơn đặt sân
        $transferPrefix = env('SEPAY_TRANSFER_PREFIX');

        $transferContent = $transferPrefix
            ? $transferPrefix . ' ' . $booking->booking_code
            : $booking->booking_code;
        // Lấy thông tin tài khoản nhận tiền từ file .env
        $bankName = env('SEPAY_BANK_NAME');
        $bankAccount = env('SEPAY_BANK_ACCOUNT');
        $accountHolder = env('SEPAY_ACCOUNT_HOLDER');

        // Tạo link QR thanh toán SePay
        $qrUrl = 'https://qr.sepay.vn/img?' . http_build_query([
            'acc' => $bankAccount,
            'bank' => $bankName,
            'amount' => $amount,
            'des' => $transferContent,
        ]);

        // Trả thông tin thanh toán về frontend
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