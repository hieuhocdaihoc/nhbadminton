<?php

namespace Tests\Feature;

use App\Models\BookingIntent;
use App\Models\RecurringBooking;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Tests\TestCase;

class SePayWebhookAndIntentTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.sepay.webhook_api_key' => null]);
        Cache::flush();
    }

    public function test_pending_intent_is_not_reported_as_paid(): void
    {
        $intent = $this->createIntent();

        $this->getJson("/api/booking-intents/{$intent->intent_code}/status")
            ->assertOk()
            ->assertJsonPath('data.paid', false);
    }

    public function test_unknown_intent_is_not_reported_as_paid(): void
    {
        $this->getJson('/api/booking-intents/PAYUNKNOWN/status')
            ->assertNotFound()
            ->assertJsonPath('data.paid', false);
    }

    public function test_expired_intent_stays_unpaid_after_it_is_deleted(): void
    {
        $intent = $this->createIntent(['expires_at' => now()->subMinute()]);

        $this->getJson("/api/booking-intents/{$intent->intent_code}/status")
            ->assertOk()
            ->assertJsonPath('data.paid', false)
            ->assertJsonPath('data.expired', true);

        $this->getJson("/api/booking-intents/{$intent->intent_code}/status")
            ->assertNotFound()
            ->assertJsonPath('data.paid', false);
    }

    public function test_only_webhook_completion_cache_reports_intent_as_paid(): void
    {
        Cache::put('intent_paid_PAYDONE01', ['BILL_DONE']);

        $this->getJson('/api/booking-intents/PAYDONE01/status')
            ->assertOk()
            ->assertJsonPath('data.paid', true)
            ->assertJsonPath('data.booking_codes.0', 'BILL_DONE');
    }

    public function test_configured_webhook_api_key_rejects_missing_and_wrong_credentials(): void
    {
        config(['services.sepay.webhook_api_key' => 'test-secret']);
        $payload = ['transferType' => 'out'];

        $this->postJson('/api/sepay/webhook', $payload)->assertUnauthorized();
        $this->withHeader('Authorization', 'Apikey wrong-secret')
            ->postJson('/api/sepay/webhook', $payload)
            ->assertUnauthorized();

        $this->withHeader('Authorization', 'Apikey test-secret')
            ->postJson('/api/sepay/webhook', $payload)
            ->assertOk()
            ->assertJsonPath('success', true);
    }

    public function test_booking_webhook_records_partial_payment_and_is_idempotent(): void
    {
        $booking = $this->createBooking($this->createUser(), ['booking_code' => 'BILL_TEST01']);
        $payload = [
            'id' => 'SEPAY-TX-001',
            'referenceCode' => 'BANK-REF-001',
            'transferType' => 'in',
            'transferAmount' => 50000,
            'content' => $booking->booking_code,
            'gateway' => 'TESTBANK',
            'transactionDate' => now()->toDateTimeString(),
        ];

        $this->postJson('/api/sepay/webhook', $payload)
            ->assertOk()
            ->assertJsonPath('data.payment_status', 'partially_paid')
            ->assertJsonPath('data.remaining_amount', 150000);

        $this->assertDatabaseHas('payments', [
            'booking_id' => $booking->id,
            'sepay_transaction_id' => 'SEPAY-TX-001',
            'amount' => 50000,
            'status' => 'success',
        ]);

        $this->postJson('/api/sepay/webhook', $payload)
            ->assertOk();

        $this->assertDatabaseCount('payments', 1);
        $this->assertSame(50000.0, $booking->fresh()->deposit_amount);
    }

    public function test_outgoing_transfer_never_changes_booking_payment(): void
    {
        $booking = $this->createBooking($this->createUser(), ['booking_code' => 'BILL_TEST02']);

        $this->postJson('/api/sepay/webhook', [
            'transferType' => 'out',
            'transferAmount' => 200000,
            'content' => $booking->booking_code,
        ])->assertOk();

        $this->assertDatabaseCount('payments', 0);
        $this->assertSame('unpaid', $booking->fresh()->payment_status);
    }

    public function test_booking_intent_is_not_consumed_when_transfer_is_underpaid(): void
    {
        $intent = $this->createIntent(['intent_code' => 'PAYUNDER01']);

        $this->postJson('/api/sepay/webhook', [
            'id' => 'SEPAY-TX-UNDERPAID',
            'referenceCode' => 'BANK-REF-UNDERPAID',
            'transferType' => 'in',
            'transferAmount' => 99999,
            'content' => $intent->intent_code,
            'gateway' => 'TESTBANK',
        ])->assertUnprocessable();

        $this->assertDatabaseHas('booking_intents', ['id' => $intent->id]);
        $this->assertDatabaseCount('bookings', 0);
        $this->assertDatabaseCount('payments', 0);
    }

    public function test_contract_webhook_requires_full_payment_before_marking_any_session_paid(): void
    {
        $customer = $this->createUser();
        $court = $this->createCourt();
        $contract = RecurringBooking::create([
            'user_id' => $customer->id,
            'court_id' => $court->id,
            'recurring_code' => 'REC_TEST01',
            'days_of_week' => [1],
            'start_time' => '08:00',
            'end_time' => '09:00',
            'start_date' => today()->addDay(),
            'end_date' => today()->addWeeks(2),
            'status' => 'active',
            'type' => 'recurring',
        ]);
        $first = $this->createBooking($customer, [
            'recurring_booking_id' => $contract->id,
            'total_price' => 100000,
            'remaining_amount' => 100000,
        ]);
        $second = $this->createBooking($customer, [
            'recurring_booking_id' => $contract->id,
            'total_price' => 100000,
            'remaining_amount' => 100000,
        ]);

        $this->postJson('/api/sepay/webhook', [
            'id' => 'SEPAY-CONTRACT-UNDERPAID',
            'referenceCode' => 'BANK-CONTRACT-UNDERPAID',
            'transferType' => 'in',
            'transferAmount' => 150000,
            'content' => $contract->recurring_code,
            'gateway' => 'TESTBANK',
        ])->assertUnprocessable();

        $this->assertDatabaseCount('payments', 0);
        $this->assertSame('unpaid', $first->fresh()->payment_status);
        $this->assertSame('unpaid', $second->fresh()->payment_status);
    }

    private function createIntent(array $attributes = []): BookingIntent
    {
        return BookingIntent::create(array_merge([
            'id' => (string) Str::uuid(),
            'intent_code' => 'PAYTEST01',
            'payload' => ['booking_type' => 'single'],
            'amount' => 100000,
            'booking_type' => 'single',
            'expires_at' => now()->addMinutes(30),
        ], $attributes));
    }
}
