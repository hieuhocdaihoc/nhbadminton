<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\User\BookingController;
use App\Models\CourtPricing;
use App\Models\MembershipCard;
use App\Models\MembershipPackage;
use App\Models\User;
use App\Services\PaymentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Tests\TestCase;

class BookingMembershipCoverageTest extends TestCase
{
    use RefreshDatabase;

    public function test_my_card_reports_sessions_committed_to_open_bookings(): void
    {
        $customer = $this->signIn();
        $card = $this->createActiveCard($customer, 30);

        $this->createBooking($customer, [
            'membership_card_id' => $card->id,
            'card_sessions_planned' => 30,
            'status' => 'confirmed',
        ]);

        $this->getJson('/api/membership/my-card')
            ->assertOk()
            ->assertJsonPath('data.remaining_sessions', 30)
            ->assertJsonPath('data.committed_sessions', 30)
            ->assertJsonPath('data.available_sessions', 0);
    }

    public function test_single_booking_with_all_card_sessions_committed_requires_full_payment(): void
    {
        $customer = $this->signIn();
        $court = $this->createCourt();
        $this->createFlatPricing();
        $card = $this->createActiveCard($customer, 30);

        $this->createBooking($customer, [
            'membership_card_id' => $card->id,
            'card_sessions_planned' => 30,
            'status' => 'confirmed',
        ]);

        $response = $this->postJson('/api/bookings/prepare', $this->singlePayload($court->id, $card->id))
            ->assertOk()
            ->assertJsonPath('data.covered_count', 0)
            ->assertJsonPath('data.full_amount', 200000)
            ->assertJsonPath('data.amount', 200000);

        $this->assertNotEmpty($response->json('data.qr_url'));
    }

    public function test_single_booking_uses_available_card_session_and_charges_only_excess(): void
    {
        $customer = $this->signIn();
        $court = $this->createCourt();
        $this->createFlatPricing();
        $card = $this->createActiveCard($customer, 2);

        $this->createBooking($customer, [
            'membership_card_id' => $card->id,
            'card_sessions_planned' => 1,
            'status' => 'confirmed',
        ]);

        $this->postJson('/api/bookings/prepare', $this->singlePayload($court->id, $card->id))
            ->assertOk()
            ->assertJsonPath('data.covered_count', 1)
            ->assertJsonPath('data.full_amount', 100000)
            ->assertJsonPath('data.amount', 100000);
    }

    public function test_single_booking_fully_covered_by_card_skips_qr(): void
    {
        $customer = $this->signIn();
        $court = $this->createCourt();
        $this->createFlatPricing();
        $card = $this->createActiveCard($customer, 2);

        $payload = $this->singlePayload($court->id, $card->id);

        $this->postJson('/api/bookings/prepare', $payload)
            ->assertOk()
            ->assertJsonPath('data.fully_covered', true)
            ->assertJsonPath('data.covered_count', 2)
            ->assertJsonPath('data.amount', 0);

        $this->postJson('/api/bookings', $payload)
            ->assertCreated()
            ->assertJsonPath('data.bookings.0.card_sessions', 2)
            ->assertJsonPath('data.bookings.0.payable_amount', 0);

        $this->assertDatabaseHas('bookings', [
            'membership_card_id' => $card->id,
            'card_sessions_planned' => 2,
            'payment_status' => 'paid',
        ]);
    }

    public function test_paid_single_booking_records_card_and_bank_portions_together(): void
    {
        $customer = $this->signIn();
        $court = $this->createCourt();
        $this->createFlatPricing();
        $card = $this->createActiveCard($customer, 2);

        $this->createBooking($customer, [
            'membership_card_id' => $card->id,
            'card_sessions_planned' => 1,
            'status' => 'confirmed',
        ]);

        $request = Request::create('/api/bookings', 'POST', $this->singlePayload($court->id, $card->id));
        $request->setUserResolver(fn () => $customer);
        $request->attributes->set('is_verified_payment', true);

        $response = app(BookingController::class)->store($request);
        $this->assertSame(201, $response->getStatusCode());

        $data = json_decode($response->getContent(), true)['data'];
        $booking = \App\Models\Booking::findOrFail($data['payment_booking_id']);

        $this->assertSame(1, (int) $booking->card_sessions_planned);
        $this->assertSame(150000.0, $booking->total_price);
        $this->assertSame(50000.0, $booking->deposit_amount);
        $this->assertSame(100000.0, $booking->remaining_amount);
        $this->assertSame('partially_paid', $booking->payment_status);

        app(PaymentService::class)->recordSuccessfulPayment($booking, [
            'payment_method' => 'bank_transfer',
            'amount' => 100000,
        ]);

        $booking->refresh();
        $this->assertSame(150000.0, $booking->deposit_amount);
        $this->assertSame(0.0, $booking->remaining_amount);
        $this->assertSame('paid', $booking->payment_status);
    }

    public function test_recurring_and_long_term_with_thirty_session_card_charge_four_excess_sessions(): void
    {
        $customer = $this->signIn();
        $court = $this->createCourt();
        $this->createFlatPricing();
        $card = $this->createActiveCard($customer, 30);
        $start = today()->addDay();
        $dates = collect(range(0, 33))
            ->map(fn (int $offset) => $start->copy()->addDays($offset)->toDateString())
            ->all();

        $common = [
            'court_id' => $court->id,
            'customer_name' => 'Khach Test',
            'customer_phone' => '0901234567',
            'payment_option' => 'full',
            'membership_card_id' => $card->id,
            'use_membership_card' => true,
        ];

        $this->postJson('/api/bookings/prepare', $common + [
            'booking_type' => 'recurring',
            'start_date' => $dates[0],
            'end_date' => $dates[33],
            'days_of_week' => [1, 2, 3, 4, 5, 6, 7],
            'start_time' => '08:00',
            'end_time' => '09:00',
        ])->assertOk()
            ->assertJsonPath('data.covered_count', 30)
            ->assertJsonPath('data.full_amount', 400000)
            ->assertJsonPath('data.amount', 400000);

        $this->postJson('/api/bookings/prepare', $common + [
            'booking_type' => 'long_term',
            'lt_start_date' => $dates[0],
            'lt_end_date' => $dates[33],
            'specific_dates' => $dates,
            'lt_start_time' => '08:00',
            'lt_end_time' => '09:00',
        ])->assertOk()
            ->assertJsonPath('data.covered_count', 30)
            ->assertJsonPath('data.full_amount', 400000)
            ->assertJsonPath('data.amount', 400000);
    }

    private function singlePayload(string $courtId, string $cardId): array
    {
        $date = today()->addDay()->toDateString();

        return [
            'court_id' => $courtId,
            'booking_type' => 'single',
            'customer_name' => 'Khach Test',
            'customer_phone' => '0901234567',
            'payment_option' => 'full',
            'membership_card_id' => $cardId,
            'card_sessions_planned' => 2,
            'use_membership_card' => true,
            'slots' => [
                ['date' => $date, 'start' => '08:00', 'end' => '09:00'],
                ['date' => $date, 'start' => '09:00', 'end' => '10:00'],
            ],
        ];
    }

    private function createActiveCard(User $customer, int $sessions): MembershipCard
    {
        $package = MembershipPackage::create([
            'name' => "Goi {$sessions} ca",
            'total_sessions' => $sessions,
            'duration_days' => 120,
            'price' => $sessions * 50000,
            'price_per_session' => 50000,
            'status' => 'active',
        ]);

        return MembershipCard::create([
            'card_code' => 'CARD-TEST-' . str_pad((string) $sessions, 3, '0', STR_PAD_LEFT),
            'user_id' => $customer->id,
            'package_id' => $package->id,
            'total_sessions' => $sessions,
            'used_sessions' => 0,
            'valid_from' => today(),
            'valid_to' => today()->addDays(120),
            'price' => $package->price,
            'price_per_session' => $package->price_per_session,
            'status' => 'active',
        ]);
    }

    private function createFlatPricing(): void
    {
        foreach (['weekday', 'weekend'] as $dayType) {
            CourtPricing::create([
                'day_type' => $dayType,
                'start_time' => '06:00',
                'end_time' => '22:00',
                'price' => 100000,
                'min_booking_minutes' => 30,
            ]);
        }
    }
}
