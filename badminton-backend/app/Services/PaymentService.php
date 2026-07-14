<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Payment;
use Illuminate\Support\Str;

class PaymentService
{
    /**
     * Chức năng: Ghi nhận một giao dịch thanh toán thành công và đồng bộ lại số tiền đã trả/còn lại của booking.
     */
    public function recordSuccessfulPayment(Booking $booking, array $data): Payment
    {
        $amount = (float) ($data['amount'] ?? 0);

        if ($amount <= 0) {
            throw new \InvalidArgumentException('So tien thanh toan phai lon hon 0.');
        }

        $payment = Payment::create([
            'payment_code' => $data['payment_code'] ?? 'PAY_' . strtoupper(Str::random(8)),
            'booking_id' => $booking->id,
            'user_id' => $booking->user_id,
            'payment_method' => $data['payment_method'],
            'amount' => $amount,
            'paid_at' => $data['paid_at'] ?? now(),
            'status' => 'success',
            'sepay_transaction_id' => $data['sepay_transaction_id'] ?? null,
            'bank_gateway' => $data['bank_gateway'] ?? null,
            'reference_code' => $data['reference_code'] ?? null,
            'payment_content' => $data['payment_content'] ?? null,
        ]);

        $newDepositAmount = (float) $booking->deposit_amount + $amount;
        $newRemainingAmount = max((float) $booking->remaining_amount - $amount, 0);

        $booking->deposit_amount = $newDepositAmount;
        $booking->remaining_amount = $newRemainingAmount;
        $booking->payment_status = $newRemainingAmount <= 0 ? 'paid' : 'partially_paid';

        $booking->save();

        return $payment;
    }
}
