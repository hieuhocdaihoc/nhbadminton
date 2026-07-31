<?php

namespace Tests\Feature;

use App\Services\PaymentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use Tests\TestCase;

class PaymentServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_successful_payments_move_booking_from_partial_to_paid(): void
    {
        $customer = $this->createUser();
        $booking = $this->createBooking($customer);
        $service = app(PaymentService::class);

        $first = $service->recordSuccessfulPayment($booking, [
            'payment_method' => 'cash',
            'amount' => 50000,
        ]);

        $this->assertSame('success', $first->status);
        $this->assertSame(50000.0, $booking->fresh()->deposit_amount);
        $this->assertSame(150000.0, $booking->fresh()->remaining_amount);
        $this->assertSame('partially_paid', $booking->fresh()->payment_status);

        $service->recordSuccessfulPayment($booking->fresh(), [
            'payment_method' => 'bank_transfer',
            'amount' => 150000,
        ]);

        $booking->refresh();
        $this->assertSame(200000.0, $booking->deposit_amount);
        $this->assertSame(0.0, $booking->remaining_amount);
        $this->assertSame('paid', $booking->payment_status);
        $this->assertDatabaseCount('payments', 2);
    }

    public function test_zero_or_negative_payment_is_rejected_without_writing_data(): void
    {
        $booking = $this->createBooking($this->createUser());

        $this->expectException(InvalidArgumentException::class);

        try {
            app(PaymentService::class)->recordSuccessfulPayment($booking, [
                'payment_method' => 'cash',
                'amount' => 0,
            ]);
        } finally {
            $this->assertDatabaseCount('payments', 0);
        }
    }
}
