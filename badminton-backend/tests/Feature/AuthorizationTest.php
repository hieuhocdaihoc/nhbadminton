<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_cannot_access_admin_routes(): void
    {
        $this->signIn();

        $this->getJson('/api/admin/categories')->assertForbidden();
    }

    public function test_staff_can_read_operational_data_but_cannot_update_admin_settings(): void
    {
        $this->signIn($this->createUser(['role' => 'staff']));

        $this->getJson('/api/admin/categories')->assertOk();
        $this->putJson('/api/admin/settings', ['settings' => ['club_name' => 'Changed']])
            ->assertForbidden();
    }

    public function test_staff_cannot_create_another_staff_account(): void
    {
        $this->signIn($this->createUser(['role' => 'staff']));

        $this->postJson('/api/admin/users', [
            'full_name' => 'New Staff',
            'email' => 'newstaff@example.test',
            'phone' => '0904444444',
            'password' => 'secret123',
            'role' => 'staff',
        ])->assertForbidden();

        $this->assertDatabaseMissing('users', ['phone' => '0904444444']);
    }

    public function test_admin_can_update_only_allowlisted_system_settings(): void
    {
        $this->signIn($this->createUser(['role' => 'admin']));

        $this->putJson('/api/admin/settings', [
            'settings' => [
                'club_name' => 'NH Test Club',
                'unexpected_secret' => 'must-not-be-saved',
            ],
        ])->assertOk();

        $this->assertDatabaseHas('system_settings', [
            'setting_key' => 'club_name',
            'setting_value' => 'NH Test Club',
        ]);
        $this->assertDatabaseMissing('system_settings', ['setting_key' => 'unexpected_secret']);
    }
}
