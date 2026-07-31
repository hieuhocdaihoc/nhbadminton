<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminUserStatusTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_block_customer_and_receives_active_booking_warning(): void
    {
        $admin = $this->createUser(['role' => 'admin']);
        $customer = $this->createUser();
        $this->createBooking($customer, ['status' => 'confirmed']);
        $token = $customer->createToken('customer-session')->plainTextToken;

        $this->signIn($admin);
        $response = $this->patchJson("/api/admin/users/{$customer->id}/status", [
            'status' => 'blocked',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.status', 'blocked');
        $this->assertNotNull($response->json('warning'));
        $this->assertDatabaseHas('users', ['id' => $customer->id, 'status' => 'blocked']);

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/profile')->assertForbidden();
        $this->assertDatabaseMissing('personal_access_tokens', ['tokenable_id' => $customer->id]);
    }

    public function test_admin_account_cannot_be_blocked_through_user_management(): void
    {
        $admin = $this->createUser(['role' => 'admin']);
        $this->signIn($admin);

        $this->patchJson("/api/admin/users/{$admin->id}/status", ['status' => 'blocked'])
            ->assertForbidden();

        $this->assertDatabaseHas('users', ['id' => $admin->id, 'status' => 'active']);
    }
}
