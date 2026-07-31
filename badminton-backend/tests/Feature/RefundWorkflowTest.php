<?php

namespace Tests\Feature;

use App\Models\Payment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RefundWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_record_manual_refund_and_summary_uses_net_revenue(): void
    {
        $admin = $this->signIn($this->createUser(['role' => 'admin']));
        $payment = $this->createSuccessfulPayment(100000);

        $response = $this->postJson('/api/admin/refunds', [
            'payment_id' => $payment->id,
            'amount' => 25000,
            'reason' => 'Khach huy san dung chinh sach.',
            'refund_method' => 'cash',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('data.processed_by.id', $admin->id);

        $this->assertDatabaseHas('refunds', [
            'payment_id' => $payment->id,
            'amount' => 25000,
            'refund_info' => null,
            'status' => 'completed',
        ]);

        $this->getJson('/api/admin/payments/summary')
            ->assertOk()
            ->assertJsonPath('data.gross_revenue', 100000)
            ->assertJsonPath('data.refund_amount', 25000)
            ->assertJsonPath('data.net_revenue', 75000);
    }

    public function test_total_active_refunds_cannot_exceed_original_payment(): void
    {
        $this->signIn($this->createUser(['role' => 'staff']));
        $payment = $this->createSuccessfulPayment(100000);

        $this->postJson('/api/admin/refunds', [
            'payment_id' => $payment->id,
            'amount' => 70000,
            'reason' => 'Hoan mot phan.',
            'refund_method' => 'bank_transfer',
            'bank_name' => 'Vietcombank',
            'bank_account' => '0123456789',
        ])->assertCreated();

        $this->assertDatabaseHas('refunds', [
            'payment_id' => $payment->id,
            'refund_info' => 'Ngân hàng: Vietcombank | STK: 0123456789',
        ]);

        $this->postJson('/api/admin/refunds', [
            'payment_id' => $payment->id,
            'amount' => 40000,
            'reason' => 'Hoan them.',
            'refund_method' => 'cash',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('amount');

        $this->assertDatabaseCount('refunds', 1);

        $this->getJson('/api/admin/payments')
            ->assertOk()
            ->assertJsonPath('data.data.0.refunded_amount', 70000)
            ->assertJsonPath('data.data.0.refundable_amount', 30000);
    }

    public function test_failed_payment_cannot_be_refunded(): void
    {
        $this->signIn($this->createUser(['role' => 'admin']));
        $payment = $this->createSuccessfulPayment(100000, ['status' => 'failed']);

        $this->postJson('/api/admin/refunds', [
            'payment_id' => $payment->id,
            'amount' => 10000,
            'reason' => 'Khong hop le.',
            'refund_method' => 'cash',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('payment_id');

        $this->assertDatabaseCount('refunds', 0);
    }

    public function test_bank_refund_requires_bank_name_and_account_number(): void
    {
        $this->signIn($this->createUser(['role' => 'admin']));
        $payment = $this->createSuccessfulPayment(100000);

        $this->postJson('/api/admin/refunds', [
            'payment_id' => $payment->id,
            'amount' => 10000,
            'reason' => 'Hoan qua ngan hang.',
            'refund_method' => 'bank_transfer',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['bank_name', 'bank_account']);

        $this->assertDatabaseCount('refunds', 0);
    }

    private function createSuccessfulPayment(float $amount, array $attributes = []): Payment
    {
        return Payment::create(array_merge([
            'payment_code' => 'PAY_' . fake()->unique()->numerify('########'),
            'payment_method' => 'cash',
            'amount' => $amount,
            'paid_at' => now(),
            'status' => 'success',
        ], $attributes));
    }
}
