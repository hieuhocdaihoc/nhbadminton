<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\User\BookingController;
use App\Models\BookingDetail;
use App\Models\CourtPricing;
use App\Models\MembershipCard;
use App\Models\MembershipPackage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BookingInputSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_forge_user_id_to_use_another_customers_card(): void
    {
        $victim = $this->createUser();
        $court = $this->createCourt();
        $this->createFlatPricing();
        $card = $this->createActiveCard($victim);

        $this->postJson('/api/bookings', $this->singlePayload($court->id) + [
            'user_id' => $victim->id,
            'membership_card_id' => $card->id,
            'use_membership_card' => true,
        ])->assertUnprocessable();

        $this->assertDatabaseCount('bookings', 0);
    }

    public function test_prepare_payment_rejects_inactive_or_maintenance_court(): void
    {
        $inactive = $this->createCourt(['status' => 'inactive']);
        $maintenance = $this->createCourt(['is_maintenance' => true]);
        $this->createFlatPricing();

        $this->postJson('/api/bookings/prepare', $this->singlePayload($inactive->id))
            ->assertUnprocessable();

        $this->postJson('/api/bookings/prepare', $this->singlePayload($maintenance->id))
            ->assertUnprocessable();

        $publicCourtIds = collect(
            $this->getJson('/api/courts')->assertOk()->json('data')
        )->pluck('id');
        $this->assertNotContains($inactive->id, $publicCourtIds);
        $this->assertNotContains($maintenance->id, $publicCourtIds);

        $this->assertDatabaseCount('booking_intents', 0);
    }

    public function test_prepare_payment_rejects_reversed_and_overlapping_slots(): void
    {
        $court = $this->createCourt();
        $this->createFlatPricing();
        $date = today()->addDay()->toDateString();

        $this->postJson('/api/bookings/prepare', $this->singlePayload($court->id, [
            ['date' => $date, 'start' => '10:00', 'end' => '09:00'],
        ]))->assertUnprocessable();

        $this->postJson('/api/bookings/prepare', $this->singlePayload($court->id, [
            ['date' => $date, 'start' => '08:00', 'end' => '10:00'],
            ['date' => $date, 'start' => '09:00', 'end' => '11:00'],
        ]))->assertUnprocessable();

        $this->assertDatabaseCount('booking_intents', 0);
    }

    public function test_prepare_payment_rejects_time_range_without_pricing(): void
    {
        $court = $this->createCourt();

        $this->postJson('/api/bookings/prepare', $this->singlePayload($court->id))
            ->assertUnprocessable();

        $this->assertDatabaseCount('booking_intents', 0);
    }

    public function test_recurring_court_plan_never_uses_a_maintenance_court_as_replacement(): void
    {
        $preferred = $this->createCourt(['name' => 'Court A']);
        $maintenance = $this->createCourt([
            'name' => 'Court B',
            'is_maintenance' => true,
        ]);
        $available = $this->createCourt(['name' => 'Court C']);
        $date = today()->addDay()->toDateString();
        $booking = $this->createBooking();

        BookingDetail::create([
            'booking_id' => $booking->id,
            'court_id' => $preferred->id,
            'booking_date' => $date,
            'start_time' => '08:00',
            'end_time' => '09:00',
            'duration_minutes' => 60,
            'price_per_hour' => 100000,
            'price' => 100000,
        ]);

        $method = new \ReflectionMethod(BookingController::class, 'planSessionCourts');
        $plan = $method->invoke(
            app(BookingController::class),
            $preferred->id,
            [$date],
            '08:00',
            '09:00'
        );

        $this->assertSame($available->id, $plan['sessions'][$date]);
        $this->assertNotSame($maintenance->id, $plan['sessions'][$date]);
    }

    public function test_contract_only_court_cannot_be_reached_directly_without_active_card(): void
    {
        $court = $this->createCourt(['is_contract_only' => true]);
        $this->createFlatPricing();
        $date = today()->addDay()->toDateString();

        $this->getJson("/api/courts/{$court->id}")->assertForbidden();
        $this->getJson("/api/courts/{$court->id}/availability?date={$date}")->assertForbidden();
        $this->postJson('/api/bookings/prepare', $this->singlePayload($court->id))->assertForbidden();

        $customer = $this->signIn();
        $this->getJson("/api/courts/{$court->id}")->assertForbidden();

        $this->createActiveCard($customer);

        $this->getJson("/api/courts/{$court->id}")->assertOk();
        $this->getJson("/api/courts/{$court->id}/availability?date={$date}")->assertOk();
        $this->postJson('/api/bookings/prepare', $this->singlePayload($court->id))
            ->assertOk()
            ->assertJsonPath('status', 'success');
    }

    private function singlePayload(string $courtId, ?array $slots = null): array
    {
        return [
            'court_id' => $courtId,
            'booking_type' => 'single',
            'customer_name' => 'Khach Test',
            'customer_phone' => '0901234567',
            'payment_option' => 'full',
            'slots' => $slots ?? [[
                'date' => today()->addDay()->toDateString(),
                'start' => '08:00',
                'end' => '09:00',
            ]],
        ];
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

    private function createActiveCard($customer): MembershipCard
    {
        $package = MembershipPackage::create([
            'name' => 'Goi test',
            'total_sessions' => 30,
            'duration_days' => 90,
            'price' => 1500000,
            'price_per_session' => 50000,
            'status' => 'active',
        ]);

        return MembershipCard::create([
            'card_code' => 'CARD-SECURITY-001',
            'user_id' => $customer->id,
            'package_id' => $package->id,
            'total_sessions' => 30,
            'used_sessions' => 0,
            'valid_from' => today(),
            'valid_to' => today()->addDays(90),
            'price' => $package->price,
            'price_per_session' => $package->price_per_session,
            'status' => 'active',
        ]);
    }
}
