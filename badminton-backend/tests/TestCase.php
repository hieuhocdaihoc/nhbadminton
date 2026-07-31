<?php

namespace Tests;

use App\Models\Booking;
use App\Models\Court;
use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;

abstract class TestCase extends BaseTestCase
{
    protected function createUser(array $attributes = []): User
    {
        return User::factory()->create($attributes);
    }

    protected function signIn(?User $user = null, array $attributes = []): User
    {
        $user ??= $this->createUser($attributes);
        Sanctum::actingAs($user);

        return $user;
    }

    protected function createCourt(array $attributes = []): Court
    {
        return Court::create(array_merge([
            'name' => 'Court A',
            'court_code' => 'COURT_' . Str::upper(Str::random(6)),
            'has_lighting' => true,
            'is_maintenance' => false,
            'is_contract_only' => false,
            'status' => 'active',
        ], $attributes));
    }

    protected function createBooking(?User $user = null, array $attributes = []): Booking
    {
        return Booking::create(array_merge([
            'booking_code' => 'BKG_' . Str::upper(Str::random(8)),
            'user_id' => $user?->id,
            'subtotal_court' => 200000,
            'subtotal_service' => 0,
            'discount_amount' => 0,
            'total_price' => 200000,
            'deposit_amount' => 0,
            'remaining_amount' => 200000,
            'status' => 'confirmed',
            'payment_status' => 'unpaid',
        ], $attributes));
    }
}
