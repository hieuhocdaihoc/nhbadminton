<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\Admin\MembershipController;
use App\Models\BookingIntent;
use App\Models\MembershipCard;
use App\Models\MembershipPackage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MembershipWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_purchase_creates_intent_without_issuing_card(): void
    {
        $customer = $this->signIn();
        $package = $this->createPackage();

        $response = $this->postJson('/api/membership/purchase', [
            'package_id' => $package->id,
        ])->assertCreated()
            ->assertJsonPath('data.status', 'pending');

        $intentCode = $response->json('data.intent_code');
        $this->assertStringStartsWith('MEM', $intentCode);
        $this->assertDatabaseHas('booking_intents', [
            'intent_code' => $intentCode,
            'booking_type' => 'membership',
        ]);
        $intent = BookingIntent::where('intent_code', $intentCode)->firstOrFail();
        $this->assertSame($customer->id, $intent->payload['user_id']);
        $this->assertSame($package->id, $intent->payload['package_id']);
        $this->assertSame('pending', $intent->payload['membership_status']);
        $this->assertDatabaseCount('membership_cards', 0);

        $this->getJson('/api/membership/my-card')
            ->assertOk()
            ->assertJsonPath('data', null);

        $this->getJson("/api/membership/purchase/{$intentCode}/status")
            ->assertOk()
            ->assertJsonPath('data.paid', false)
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.card', null);

        $second = $this->postJson('/api/membership/purchase', [
            'package_id' => $package->id,
        ])->assertCreated();
        $this->assertSame($intentCode, $second->json('data.intent_code'));
        $this->assertDatabaseCount('booking_intents', 1);
    }

    public function test_membership_webhook_issues_exactly_one_active_card_after_full_payment(): void
    {
        $customer = $this->signIn();
        $package = $this->createPackage();
        $purchase = $this->postJson('/api/membership/purchase', [
            'package_id' => $package->id,
        ])->assertCreated();
        $intentCode = $purchase->json('data.intent_code');

        $payload = [
            'transferType' => 'in',
            'transferAmount' => $package->price,
            'content' => "Thanh toan {$intentCode}",
            'id' => 'SEPAY-MEMBER-001',
            'gateway' => 'TESTBANK',
            'transactionDate' => now()->toDateTimeString(),
        ];

        $this->postJson('/api/sepay/webhook', $payload)
            ->assertOk()
            ->assertJsonPath('success', true);

        $intent = BookingIntent::where('intent_code', $intentCode)->firstOrFail();
        $this->assertSame('paid', $intent->payload['membership_status']);
        $this->assertNotNull($intent->payload['card_id']);
        $this->assertDatabaseHas('membership_cards', [
            'id' => $intent->payload['card_id'],
            'user_id' => $customer->id,
            'package_id' => $package->id,
            'status' => 'active',
            'used_sessions' => 0,
        ]);
        $this->assertDatabaseHas('payments', [
            'user_id' => $customer->id,
            'payment_method' => 'membership_card',
            'amount' => $package->price,
            'status' => 'success',
            'sepay_transaction_id' => 'SEPAY-MEMBER-001',
        ]);

        $this->getJson("/api/membership/purchase/{$intentCode}/status")
            ->assertOk()
            ->assertJsonPath('data.paid', true)
            ->assertJsonPath('data.card.status', 'active');

        $this->postJson('/api/sepay/webhook', $payload)
            ->assertOk()
            ->assertJsonPath('success', true);
        $this->assertDatabaseCount('membership_cards', 1);
        $this->assertDatabaseCount('payments', 1);
    }

    public function test_cancelled_or_underpaid_purchase_does_not_issue_card(): void
    {
        $this->signIn();
        $package = $this->createPackage();
        $purchase = $this->postJson('/api/membership/purchase', [
            'package_id' => $package->id,
        ])->assertCreated();
        $intentCode = $purchase->json('data.intent_code');

        $this->deleteJson("/api/membership/purchase/{$intentCode}")
            ->assertOk();
        $cancelledIntent = BookingIntent::where('intent_code', $intentCode)->firstOrFail();
        $this->assertSame('cancelled', $cancelledIntent->payload['membership_status']);
        $this->assertDatabaseCount('membership_cards', 0);

        $newPurchase = $this->postJson('/api/membership/purchase', [
            'package_id' => $package->id,
        ])->assertCreated();
        $newIntentCode = $newPurchase->json('data.intent_code');

        $this->postJson('/api/sepay/webhook', [
            'transferType' => 'in',
            'transferAmount' => $package->price - 1,
            'content' => $newIntentCode,
            'id' => 'SEPAY-MEMBER-UNDERPAID',
        ])->assertUnprocessable()
            ->assertJsonPath('success', false);

        $this->assertDatabaseCount('membership_cards', 0);
        $underpaidIntent = BookingIntent::where('intent_code', $newIntentCode)->firstOrFail();
        $this->assertSame('pending', $underpaidIntent->payload['membership_status']);
    }

    public function test_late_webhook_completes_a_purchase_after_customer_closes_qr(): void
    {
        $customer = $this->signIn();
        $package = $this->createPackage();
        $purchase = $this->postJson('/api/membership/purchase', [
            'package_id' => $package->id,
        ])->assertCreated();
        $intentCode = $purchase->json('data.intent_code');

        $this->deleteJson("/api/membership/purchase/{$intentCode}")
            ->assertOk();

        $this->postJson('/api/sepay/webhook', [
            'transferType' => 'in',
            'transferAmount' => $package->price,
            'content' => "Thanh toan tre {$intentCode}",
            'id' => 'SEPAY-MEMBER-LATE',
        ])->assertOk()
            ->assertJsonPath('success', true);

        $intent = BookingIntent::where('intent_code', $intentCode)->firstOrFail();
        $this->assertSame('paid', $intent->payload['membership_status']);
        $this->assertDatabaseHas('membership_cards', [
            'id' => $intent->payload['card_id'],
            'user_id' => $customer->id,
            'status' => 'active',
        ]);
        $this->assertDatabaseHas('payments', [
            'payment_code' => "MEM-{$intentCode}",
            'sepay_transaction_id' => 'SEPAY-MEMBER-LATE',
            'status' => 'success',
        ]);
    }

    public function test_admin_confirmation_creates_one_active_card_and_payment(): void
    {
        $admin = $this->signIn($this->createUser(['role' => 'admin']));
        $customer = $this->createUser();
        $package = MembershipPackage::create([
            'name' => 'Ten Sessions',
            'total_sessions' => 10,
            'duration_days' => 30,
            'price' => 1000000,
            'price_per_session' => 100000,
            'status' => 'active',
        ]);

        $this->postJson('/api/admin/membership/cards', [
            'user_id' => $customer->id,
            'package_id' => $package->id,
            'payment_channel' => 'bank_transfer',
        ])->assertUnprocessable();
        $this->assertDatabaseCount('membership_cards', 0);
        $this->assertDatabaseCount('payments', 0);

        $response = $this->postJson('/api/admin/membership/cards', [
            'user_id' => $customer->id,
            'package_id' => $package->id,
            'payment_channel' => 'bank_transfer',
            'payment_confirmed' => true,
        ])->assertCreated()->assertJsonPath('data.status', 'active');

        $cardId = $response->json('data.id');
        $this->assertDatabaseHas('membership_cards', [
            'id' => $cardId,
            'created_by' => $admin->id,
            'used_sessions' => 0,
            'status' => 'active',
        ]);

        $this->postJson('/api/admin/membership/cards', [
            'user_id' => $customer->id,
            'package_id' => $package->id,
            'payment_channel' => 'cash',
            'payment_confirmed' => true,
        ])->assertUnprocessable();

        $this->assertDatabaseHas('payments', [
            'user_id' => $customer->id,
            'payment_method' => 'membership_card',
            'amount' => 1000000,
            'status' => 'success',
            'bank_gateway' => 'MANUAL_BANK_TRANSFER',
        ]);
        $this->assertDatabaseCount('membership_cards', 1);
        $this->assertDatabaseCount('payments', 1);
    }

    public function test_admin_cannot_issue_card_while_customer_has_pending_online_purchase(): void
    {
        $customer = $this->signIn();
        $package = $this->createPackage();

        $this->postJson('/api/membership/purchase', [
            'package_id' => $package->id,
        ])->assertCreated();

        $this->signIn($this->createUser(['role' => 'admin']));
        $this->postJson('/api/admin/membership/cards', [
            'user_id' => $customer->id,
            'package_id' => $package->id,
            'payment_channel' => 'cash',
            'payment_confirmed' => true,
        ])->assertUnprocessable();

        $this->assertDatabaseCount('membership_cards', 0);
        $this->assertDatabaseCount('payments', 0);
    }

    public function test_deducting_last_sessions_depletes_card_and_writes_usage_history(): void
    {
        $customer = $this->createUser();
        $package = MembershipPackage::create([
            'name' => 'Two Sessions',
            'total_sessions' => 2,
            'duration_days' => 7,
            'price' => 200000,
            'price_per_session' => 100000,
            'status' => 'active',
        ]);
        $card = MembershipCard::create([
            'card_code' => 'CARD-TEST-001',
            'user_id' => $customer->id,
            'package_id' => $package->id,
            'total_sessions' => 2,
            'used_sessions' => 0,
            'valid_from' => today(),
            'valid_to' => today()->addWeek(),
            'price' => 200000,
            'price_per_session' => 100000,
            'status' => 'active',
        ]);
        $booking = $this->createBooking($customer, [
            'membership_card_id' => $card->id,
            'card_sessions_planned' => 2,
        ]);

        $result = MembershipController::deductSessions($card, $booking->id, 2, 'Completed booking');

        $this->assertSame(0, $result['remaining_sessions']);
        $this->assertSame('depleted', $result['card_status']);
        $this->assertDatabaseHas('membership_card_usages', [
            'card_id' => $card->id,
            'booking_id' => $booking->id,
            'sessions_deducted' => 2,
        ]);
    }

    public function test_available_sessions_excludes_sessions_committed_to_open_bookings(): void
    {
        $customer = $this->createUser();
        $package = MembershipPackage::create([
            'name' => 'Five Sessions',
            'total_sessions' => 5,
            'duration_days' => 30,
            'price' => 500000,
            'price_per_session' => 100000,
            'status' => 'active',
        ]);
        $card = MembershipCard::create([
            'card_code' => 'CARD-TEST-002',
            'user_id' => $customer->id,
            'package_id' => $package->id,
            'total_sessions' => 5,
            'used_sessions' => 1,
            'valid_from' => today(),
            'valid_to' => today()->addMonth(),
            'price' => 500000,
            'price_per_session' => 100000,
            'status' => 'active',
        ]);
        $this->createBooking($customer, [
            'membership_card_id' => $card->id,
            'card_sessions_planned' => 2,
            'status' => 'confirmed',
        ]);
        $this->createBooking($customer, [
            'membership_card_id' => $card->id,
            'card_sessions_planned' => 1,
            'status' => 'cancelled',
        ]);

        $this->assertSame(4, $card->remainingSessions());
        $this->assertSame(2, $card->committedSessions());
        $this->assertSame(2, $card->availableSessions());
    }

    private function createPackage(): MembershipPackage
    {
        return MembershipPackage::create([
            'name' => 'Online Thirty Sessions',
            'total_sessions' => 30,
            'duration_days' => 30,
            'price' => 60000,
            'price_per_session' => 2000,
            'status' => 'active',
        ]);
    }
}
