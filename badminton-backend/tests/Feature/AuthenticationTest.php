<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_can_register_with_a_normalized_vietnamese_phone_number(): void
    {
        $response = $this->postJson('/api/register', [
            'full_name' => 'Nguyen Van Test',
            'email' => 'customer@example.test',
            'phone' => '090 123-4567',
            'password' => 'secret123',
        ]);

        $response->assertCreated()
            ->assertJsonPath('user.phone', '0901234567')
            ->assertJsonPath('user.role', 'customer')
            ->assertJsonPath('user.membership_level', 'Dong')
            ->assertJsonMissingPath('user.password_hash');

        $user = \App\Models\User::where('phone', '0901234567')->firstOrFail();
        $this->assertTrue(Hash::check('secret123', $user->password_hash));
    }

    public function test_registration_rejects_invalid_phone_weak_password_and_duplicate_identity(): void
    {
        $this->postJson('/api/register', [
            'full_name' => 'A',
            'email' => 'not-an-email',
            'phone' => '12345',
            'password' => '123',
        ])->assertUnprocessable()->assertJsonValidationErrors(['full_name', 'email', 'phone', 'password']);

        $this->createUser(['email' => 'used@example.test', 'phone' => '0901111111']);

        $this->postJson('/api/register', [
            'full_name' => 'Valid Name',
            'email' => 'used@example.test',
            'phone' => '0901111111',
            'password' => 'secret123',
        ])->assertUnprocessable()->assertJsonValidationErrors(['email', 'phone']);
    }

    public function test_active_user_can_login_and_invalid_credentials_are_rejected(): void
    {
        $user = $this->createUser(['phone' => '0902222222']);

        $this->postJson('/api/login', ['phone' => $user->phone, 'password' => 'wrong'])
            ->assertUnauthorized();

        $this->postJson('/api/login', ['phone' => $user->phone, 'password' => 'password'])
            ->assertOk()
            ->assertJsonPath('token_type', 'Bearer')
            ->assertJsonPath('role', 'customer')
            ->assertJsonStructure(['access_token', 'permissions', 'redirect_to']);

        $this->assertDatabaseCount('personal_access_tokens', 1);
    }

    public function test_blocked_user_cannot_login_and_existing_tokens_are_revoked(): void
    {
        $user = $this->createUser(['phone' => '0903333333', 'status' => 'blocked']);

        $this->postJson('/api/login', ['phone' => $user->phone, 'password' => 'password'])
            ->assertForbidden();

        $token = $user->createToken('old-session')->plainTextToken;

        $this->withToken($token)->getJson('/api/profile')
            ->assertForbidden()
            ->assertJsonPath('error_code', 'ACCOUNT_BLOCKED');

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_profile_requires_authentication(): void
    {
        $this->getJson('/api/profile')->assertUnauthorized();
    }
}
