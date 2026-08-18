<?php

namespace Tests\Feature;

use App\Models\CourtPricing;
use App\Models\Promotion;
use App\Services\MembershipTierService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PricingAndPromotionTest extends TestCase
{
    use RefreshDatabase;

    public function test_membership_tiers_and_hourly_discounts_follow_points(): void
    {
        $this->assertSame('Dong', MembershipTierService::levelForPoints(0));
        $this->assertSame('Dong', MembershipTierService::levelForPoints(999));
        $this->assertSame('Bac', MembershipTierService::levelForPoints(1000));
        $this->assertSame('Bac', MembershipTierService::levelForPoints(2999));
        $this->assertSame('Vang', MembershipTierService::levelForPoints(3000));

        $this->assertSame(0, MembershipTierService::hourlyDiscountForPoints(999));
        $this->assertSame(2000, MembershipTierService::hourlyDiscountForPoints(1000));
        $this->assertSame(5000, MembershipTierService::hourlyDiscountForPoints(3000));
        $this->assertSame(3000.0, MembershipTierService::discountForMinutes(1000, 90));
        $this->assertSame(7500.0, MembershipTierService::discountForMinutes(3000, 90));
    }

    public function test_price_calculation_combines_overlapping_hourly_bands(): void
    {
        CourtPricing::create([
            'day_type' => 'weekday',
            'start_time' => '06:00',
            'end_time' => '08:00',
            'price' => 100000,
            'min_booking_minutes' => 30,
        ]);
        CourtPricing::create([
            'day_type' => 'weekday',
            'start_time' => '08:00',
            'end_time' => '10:00',
            'price' => 120000,
            'min_booking_minutes' => 30,
        ]);

        $date = now()->next('Monday')->toDateString();
        $this->postJson('/api/courts/calculate-price', [
            'date' => $date,
            'start_time' => '07:00',
            'end_time' => '09:00',
        ])->assertOk()
            ->assertJsonPath('total_price', 220000)
            ->assertJsonCount(2, 'details');
    }

    public function test_seasonal_schedule_replaces_the_default_schedule_for_its_effective_date(): void
    {
        $court = $this->createCourt();
        $seasonalDate = now()->next('Monday')->toDateString();
        $defaultDate = now()->next('Monday')->addWeek()->toDateString();

        CourtPricing::create([
            'day_type' => 'weekday',
            'start_time' => '05:00',
            'end_time' => '23:00',
            'price' => 10000,
            'min_booking_minutes' => 60,
        ]);
        CourtPricing::create([
            'day_type' => 'weekday',
            'start_time' => '05:00',
            'end_time' => '17:00',
            'price' => 100000,
            'effective_from' => $seasonalDate,
            'effective_to' => $seasonalDate,
            'min_booking_minutes' => 60,
        ]);

        $seasonalSlots = collect(
            $this->getJson("/api/courts/{$court->id}/availability?date={$seasonalDate}&mode=grid")
                ->assertOk()
                ->assertJsonCount(12, 'data')
                ->json('data')
        );

        $this->assertCount(12, $seasonalSlots->pluck('time_slot')->unique());
        $this->assertTrue($seasonalSlots->every(
            fn(array $slot) => (float) $slot['price'] === 100000.0
        ));
        $this->assertSame('16:00 - 17:00', $seasonalSlots->last()['time_slot']);

        $this->postJson('/api/courts/calculate-price', [
            'date' => $seasonalDate,
            'start_time' => '05:00',
            'end_time' => '18:00',
        ])->assertOk()
            ->assertJsonPath('total_price', 1200000)
            ->assertJsonCount(1, 'details')
            ->assertJsonPath('details.0.loai_gia', 'Giá thời vụ');

        $this->postJson('/api/courts/calculate-price', [
            'date' => $defaultDate,
            'start_time' => '05:00',
            'end_time' => '06:00',
        ])->assertOk()
            ->assertJsonPath('total_price', 10000)
            ->assertJsonPath('details.0.loai_gia', 'Giá mặc định');
    }

    public function test_promotion_validation_applies_percent_and_fixed_discounts_safely(): void
    {
        Promotion::create([
            'code' => 'TENPERCENT',
            'name' => 'Ten percent',
            'discount_type' => 'percent',
            'discount_value' => 10,
            'valid_from' => today()->subDay(),
            'valid_to' => today()->addDay(),
            'status' => 'active',
        ]);
        Promotion::create([
            'code' => 'FIXED50',
            'name' => 'Fixed discount',
            'discount_type' => 'fixed',
            'discount_value' => 50000,
            'status' => 'active',
        ]);

        $this->postJson('/api/bookings/validate-promotion', [
            'promotion_code' => 'tenpercent',
            'total_amount' => 200000,
        ])->assertOk()->assertJsonPath('data.discount_amount', 20000);

        $this->postJson('/api/bookings/validate-promotion', [
            'promotion_code' => 'FIXED50',
            'total_amount' => 30000,
        ])->assertOk()->assertJsonPath('data.discount_amount', 30000);
    }

    public function test_promotion_dates_serialization_preserves_exact_date_strings(): void
    {
        $admin = \App\Models\User::factory()->create(['role' => 'admin']);
        $response = $this->actingAs($admin)->postJson('/api/admin/promotions', [
            'code' => 'DATEFIX',
            'name' => 'Date fix test',
            'discount_type' => 'fixed',
            'discount_value' => 10000,
            'valid_from' => '2026-08-16',
            'valid_to' => '2026-08-18',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.valid_from', '2026-08-16')
            ->assertJsonPath('data.valid_to', '2026-08-18');
    }

    public function test_expired_or_inactive_promotion_is_rejected(): void
    {
        Promotion::create([
            'code' => 'EXPIRED',
            'name' => 'Expired',
            'discount_type' => 'fixed',
            'discount_value' => 10000,
            'valid_to' => today()->subDay(),
            'status' => 'active',
        ]);

        $this->postJson('/api/bookings/validate-promotion', [
            'promotion_code' => 'EXPIRED',
            'total_amount' => 100000,
        ])->assertUnprocessable();
    }
}
