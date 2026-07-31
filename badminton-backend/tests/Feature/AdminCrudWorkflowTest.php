<?php

namespace Tests\Feature;

use App\Models\BookingDetail;
use App\Models\Category;
use App\Models\CourtPriceHistory;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminCrudWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->signIn(null, ['role' => 'admin']);
    }

    public function test_admin_can_create_staff_without_membership_level(): void
    {
        $this->postJson('/api/admin/users', [
            'full_name' => 'Nhan Vien Test',
            'email' => 'staff-create@example.com',
            'phone' => '0912345678',
            'password' => 'secret123',
            'role' => 'staff',
            'gender' => 'male',
            'date_of_birth' => '2000-01-01',
            'status' => 'active',
        ])->assertCreated()
            ->assertJsonPath('data.role', 'staff')
            ->assertJsonPath('data.membership_level', 'Dong');

        $this->assertDatabaseHas('users', [
            'email' => 'staff-create@example.com',
            'role' => 'staff',
            'membership_level' => 'Dong',
            'customer_code' => null,
        ]);
    }

    public function test_category_and_service_lifecycle_uses_soft_deactivation(): void
    {
        $this->postJson('/api/admin/services', [
            'name' => 'Thue dung cu',
            'service_type' => 'rental',
            'price' => 30000,
        ])->assertUnprocessable();

        $categoryId = $this->postJson('/api/admin/categories', [
            'name' => 'Do tap',
            'description' => 'Danh muc test',
        ])->assertCreated()->json('data.id');

        $this->patchJson("/api/admin/categories/{$categoryId}", [
            'name' => 'Do tap cau long',
        ])->assertOk();

        $this->deleteJson("/api/admin/categories/{$categoryId}")->assertOk();
        $this->assertDatabaseHas('categories', [
            'id' => $categoryId,
            'name' => 'Do tap cau long',
            'status' => 'inactive',
        ]);

        $serviceId = $this->postJson('/api/admin/services', [
            'name' => 'Dan luoi vot',
            'service_type' => 'other',
            'price' => 30000,
            'unit' => 'cai',
        ])->assertCreated()->json('data.id');

        $this->patchJson("/api/admin/services/{$serviceId}", ['price' => 35000])
            ->assertOk()
            ->assertJsonPath('data.price', 35000);

        $this->deleteJson("/api/admin/services/{$serviceId}")->assertOk();
        $this->deleteJson("/api/admin/services/{$serviceId}")->assertStatus(400);
        $this->assertDatabaseHas('additional_services', ['id' => $serviceId, 'status' => 'inactive']);
    }

    public function test_product_edit_persists_descriptive_fields_but_never_direct_stock_changes(): void
    {
        $category = Category::create(['name' => 'Phu kien', 'status' => 'active']);

        $productId = $this->postJson('/api/admin/products', [
            'category_id' => $category->id,
            'name' => 'Bang quan can',
            'sku' => 'GRIP-EDIT-01',
            'brand' => 'Brand A',
            'description' => 'Mo ta cu',
            'selling_price' => 20000,
            'low_stock_threshold' => 5,
        ])->assertCreated()
            ->assertJsonPath('data.stock_quantity', 0)
            ->json('data.id');

        $this->patchJson("/api/admin/products/{$productId}", [
            'brand' => 'Brand B',
            'description' => 'Mo ta moi',
            'low_stock_threshold' => 12,
            'stock_quantity' => 999,
        ])->assertOk();

        $this->assertDatabaseHas('products', [
            'id' => $productId,
            'brand' => 'Brand B',
            'description' => 'Mo ta moi',
            'low_stock_threshold' => 12,
            'stock_quantity' => 0,
        ]);
    }

    public function test_promotion_rejects_percent_over_one_hundred_and_deactivates_on_delete(): void
    {
        $this->postJson('/api/admin/promotions', [
            'code' => 'invalid-percent',
            'name' => 'Sai phan tram',
            'discount_type' => 'percent',
            'discount_value' => 101,
        ])->assertUnprocessable();

        $promotionId = $this->postJson('/api/admin/promotions', [
            'code' => 'summer-10',
            'name' => 'Khuyen mai he',
            'discount_type' => 'percent',
            'discount_value' => 10,
            'valid_from' => today()->toDateString(),
            'valid_to' => today()->addWeek()->toDateString(),
        ])->assertCreated()
            ->assertJsonPath('data.code', 'SUMMER-10')
            ->json('data.id');

        $this->deleteJson("/api/admin/promotions/{$promotionId}")->assertOk();
        $this->assertDatabaseHas('promotions', ['id' => $promotionId, 'status' => 'inactive']);
    }

    public function test_court_with_upcoming_booking_cannot_be_hidden_or_deleted(): void
    {
        $court = $this->createCourt();
        $booking = $this->createBooking();
        BookingDetail::create([
            'booking_id' => $booking->id,
            'court_id' => $court->id,
            'booking_date' => today()->addDay(),
            'start_time' => '08:00',
            'end_time' => '09:00',
            'duration_minutes' => 60,
            'price_per_hour' => 100000,
            'price' => 100000,
        ]);

        $this->putJson("/api/admin/courts/{$court->id}", [
            'name' => $court->name,
            'court_code' => $court->court_code,
            'is_maintenance' => true,
            'status' => 'active',
        ])->assertUnprocessable();

        $this->deleteJson("/api/admin/courts/{$court->id}")->assertUnprocessable();
        $this->assertDatabaseHas('courts', ['id' => $court->id, 'status' => 'active']);
    }

    public function test_court_maintenance_and_inactive_states_are_kept_distinct(): void
    {
        $courtId = $this->postJson('/api/admin/courts', [
            'name' => 'San bao tri',
            'court_code' => 'COURT_MAINTENANCE',
            'is_maintenance' => true,
            'status' => 'active',
        ])->assertCreated()
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.is_maintenance', true)
            ->json('data.id');

        $this->putJson("/api/admin/courts/{$courtId}", [
            'name' => 'San ngung hoat dong',
            'court_code' => 'COURT_MAINTENANCE',
            'is_maintenance' => true,
            'status' => 'inactive',
        ])->assertOk()
            ->assertJsonPath('data.status', 'inactive')
            ->assertJsonPath('data.is_maintenance', false);

        $this->assertDatabaseHas('courts', [
            'id' => $courtId,
            'status' => 'inactive',
            'is_maintenance' => false,
        ]);
    }

    public function test_pricing_bulk_upsert_blocks_overlap_and_writes_history(): void
    {
        $firstId = $this->postJson('/api/admin/court-pricing-bulk', [
            'day_type' => 'weekday',
            'start_time' => '06:00',
            'end_time' => '12:00',
            'price' => 100000,
            'min_booking_minutes' => 30,
        ])->assertOk();

        $this->assertDatabaseCount('court_pricing', 1);
        $pricingId = \App\Models\CourtPricing::query()->value('id');
        $this->assertNotNull($pricingId);
        $this->assertDatabaseCount('court_price_histories', 1);

        $this->postJson('/api/admin/court-pricing-bulk', [
            'day_type' => 'weekday',
            'start_time' => '10:00',
            'end_time' => '14:00',
            'price' => 120000,
            'min_booking_minutes' => 30,
        ])->assertUnprocessable();

        $this->postJson('/api/admin/court-pricing-bulk', [
            'day_type' => 'weekday',
            'start_time' => '06:00',
            'end_time' => '12:00',
            'price' => 110000,
            'min_booking_minutes' => 30,
            'entry_ids' => [$pricingId],
        ])->assertOk();

        $this->assertDatabaseHas('court_pricing', ['id' => $pricingId, 'price' => 110000]);
        $this->assertSame(2, CourtPriceHistory::count());
    }
}
