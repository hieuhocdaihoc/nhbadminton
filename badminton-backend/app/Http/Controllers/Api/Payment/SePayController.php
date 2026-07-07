<?php

namespace App\Http\Controllers\Api\Payment;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\BookingIntent;
use App\Models\Payment;
use App\Models\RecurringBooking;
use App\Models\User;
use App\Services\PaymentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

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

        // Ưu tiên match intent code PAY... (đặt online chưa tạo booking)
        preg_match('/PAY[A-Z0-9]{7}/i', $searchText, $intentMatches);
        if (!empty($intentMatches)) {
            $intentCode = strtoupper($intentMatches[0]);
            $intent = BookingIntent::where('intent_code', $intentCode)
                ->where('expires_at', '>', now())
                ->first();

            if ($intent) {
                $paidAmount = (float) $request->transferAmount;
                if ($paidAmount <= 0) {
                    return response()->json(['success' => false, 'message' => 'Số tiền không hợp lệ'], 422);
                }

                // Lock: xóa intent ngay lập tức để tránh xử lý 2 lần
                // (frontend poll thấy intent gone → trả paid=true ngay, không còn bị "expired" nhầm)
                $locked = BookingIntent::where('intent_code', $intent->intent_code)
                    ->where('expires_at', '>', now())
                    ->delete();

                if (!$locked) {
                    return response()->json(['success' => true, 'message' => 'Intent đã được xử lý trước đó']);
                }

                // Tạo booking TỪ NGOÀI transaction (store() tự quản lý transaction của nó)
                $bookingController = app(\App\Http\Controllers\Api\User\BookingController::class);
                $fakeRequest = \Illuminate\Http\Request::create('/bookings', 'POST', $intent->payload);
                $fakeRequest->setUserResolver(function () use ($intent) {
                    $userId = $intent->payload['user_id'] ?? null;
                    return $userId ? User::find($userId) : null;
                });

                try {
                    $response = $bookingController->store($fakeRequest);
                } catch (\Illuminate\Validation\ValidationException $ve) {
                    return response()->json(['success' => false, 'message' => 'Validation: ' . json_encode($ve->errors())], 422);
                } catch (\Throwable $e) {
                    return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
                }

                $responseData = json_decode($response->getContent(), true);

                if (($responseData['status'] ?? '') !== 'success') {
                    $intent->delete();
                    return response()->json([
                        'success' => false,
                        'message' => 'Tạo booking thất bại: ' . ($responseData['message'] ?? 'unknown'),
                    ], 500);
                }

                // Ghi nhận payment trong transaction riêng
                $data = $responseData['data'] ?? [];
                $bookingId = $data['payment_booking_id'] ?? $data['booking_id'] ?? null;

                DB::transaction(function () use ($bookingId, $data, $paidAmount, $request, $searchText) {
                    if ($bookingId) {
                        $booking = Booking::find($bookingId);
                        if ($booking) {
                            app(PaymentService::class)->recordSuccessfulPayment($booking, [
                                'payment_method' => 'bank_transfer',
                                'amount' => $paidAmount,
                                'paid_at' => $request->transactionDate ?? now(),
                                'sepay_transaction_id' => $request->id ?? null,
                                'bank_gateway' => $request->gateway ?? null,
                                'reference_code' => $request->referenceCode ?? null,
                                'payment_content' => $searchText,
                            ]);
                        }

                        // Nếu recurring/long_term, mark toàn bộ sessions paid
                        if (!empty($data['recurring_id'])) {
                            $remaining = $paidAmount;
                            $siblings = Booking::where('recurring_booking_id', $data['recurring_id'])
                                ->where('id', '!=', $bookingId)
                                ->where('payment_status', '!=', 'paid')
                                ->get();
                            foreach ($siblings as $b) {
                                if ($remaining <= 0)
                                    break;
                                $toApply = min($remaining, (float) $b->remaining_amount);
                                app(PaymentService::class)->recordSuccessfulPayment($b, [
                                    'payment_method' => 'bank_transfer',
                                    'amount' => $toApply,
                                    'paid_at' => $request->transactionDate ?? now(),
                                    'sepay_transaction_id' => $request->id ?? null,
                                    'bank_gateway' => $request->gateway ?? null,
                                    'reference_code' => $request->referenceCode ?? null,
                                    'payment_content' => $searchText,
                                ]);
                                $remaining -= $toApply;
                            }
                        }
                    }
                });

                return response()->json([
                    'success' => true,
                    'message' => 'Đặt sân và thanh toán thành công',
                    'data' => ['intent_code' => $intent->intent_code, 'paid_amount' => $paidAmount],
                ]);
            }
        }

        // Thử match mã hợp đồng REC_ / LTB_ trước (thanh toán toàn bộ hợp đồng)
        preg_match('/(REC|LTB)[\s_-]?[A-Z0-9]+/i', $searchText, $contractMatches);

        if (!empty($contractMatches)) {
            $rawCode = strtoupper($contractMatches[0]);
            $recurringCode = str_replace([' ', '-'], '_', $rawCode);
            if (!str_contains($recurringCode, '_')) {
                $recurringCode = substr($recurringCode, 0, 3) . '_' . substr($recurringCode, 3);
            }

            $recurringBooking = RecurringBooking::where('recurring_code', $recurringCode)->first();

            if ($recurringBooking) {
                $paidAmount = (float) $request->transferAmount;

                if ($paidAmount <= 0) {
                    return response()->json(['success' => false, 'message' => 'Số tiền không hợp lệ'], 422);
                }

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
                    return response()->json(['success' => true, 'message' => 'Giao dịch đã được xử lý trước đó']);
                }

                return DB::transaction(function () use ($request, $recurringBooking, $searchText, $paidAmount) {
                    $unpaidBookings = Booking::where('recurring_booking_id', $recurringBooking->id)
                        ->where('payment_status', '!=', 'paid')
                        ->lockForUpdate()
                        ->get();

                    $remaining = $paidAmount;
                    $paidCount = 0;
                    $lastPayment = null;

                    foreach ($unpaidBookings as $b) {
                        if ($remaining <= 0)
                            break;
                        $toApply = min($remaining, (float) $b->remaining_amount);
                        $lastPayment = app(PaymentService::class)->recordSuccessfulPayment($b, [
                            'payment_method' => 'bank_transfer',
                            'amount' => $toApply,
                            'paid_at' => $request->transactionDate ?? now(),
                            'sepay_transaction_id' => $request->id,
                            'bank_gateway' => $request->gateway,
                            'reference_code' => $request->referenceCode,
                            'payment_content' => $searchText,
                        ]);
                        $remaining -= $toApply;
                        $paidCount++;
                    }

                    return response()->json([
                        'success' => true,
                        'message' => "Thanh toán hợp đồng thành công ({$paidCount} ca)",
                        'data' => [
                            'recurring_code' => $recurringBooking->recurring_code,
                            'paid_sessions' => $paidCount,
                            'paid_amount' => $paidAmount,
                        ]
                    ]);
                });
            }
        }

        // Thử match mã đặt lẻ BILL_
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
        $booking = Booking::with('recurringBooking')->findOrFail($bookingId);
        $transferPrefix = env('SEPAY_TRANSFER_PREFIX');
        $bankName = env('SEPAY_BANK_NAME');
        $bankAccount = env('SEPAY_BANK_ACCOUNT');
        $accountHolder = env('SEPAY_ACCOUNT_HOLDER');

        // Nếu booking thuộc hợp đồng định kỳ/dài hạn → tổng tiền tất cả sessions
        if ($booking->recurring_booking_id && $booking->recurringBooking) {
            $recurringCode = $booking->recurringBooking->recurring_code;

            $siblingBookings = Booking::where('recurring_booking_id', $booking->recurring_booking_id)
                ->where('payment_status', '!=', 'paid')
                ->get();

            $amount = (float) $siblingBookings->sum('remaining_amount');
            $sessionsCount = $siblingBookings->count();

            $transferContent = $transferPrefix
                ? $transferPrefix . ' ' . $recurringCode
                : $recurringCode;

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
                    'booking_code' => $recurringCode,
                    'total_price' => $amount,
                    'deposit_amount' => 0,
                    'remaining_amount' => $amount,
                    'payment_status' => $booking->payment_status,
                    'sessions_count' => $sessionsCount,
                    'bank_name' => $bankName,
                    'bank_account' => $bankAccount,
                    'account_holder' => $accountHolder,
                    'transfer_content' => $transferContent,
                    'qr_url' => $qrUrl,
                ]
            ]);
        }

        // Đặt lẻ thông thường
        $amount = (float) $booking->remaining_amount;
        $transferContent = $transferPrefix
            ? $transferPrefix . ' ' . $booking->booking_code
            : $booking->booking_code;

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

    /**
     * Chức năng: Kiểm tra intent còn tồn tại không (để frontend biết đã được xử lý chưa).
     * Intent bị xóa sau khi webhook tạo booking xong → trả về paid=true.
     */
    public function intentStatus($code)
    {
        $intent = BookingIntent::where('intent_code', strtoupper($code))->first();

        if (!$intent) {
            // Intent không còn → đã được webhook xử lý (paid) hoặc hết hạn
            return response()->json(['status' => 'success', 'data' => ['paid' => true]]);
        }

        if ($intent->expires_at->isPast()) {
            $intent->delete();
            return response()->json(['status' => 'success', 'data' => ['paid' => false, 'expired' => true]]);
        }

        return response()->json(['status' => 'success', 'data' => ['paid' => false, 'expires_at' => $intent->expires_at]]);
    }
}
