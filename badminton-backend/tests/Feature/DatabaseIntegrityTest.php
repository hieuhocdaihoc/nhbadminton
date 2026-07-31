<?php

namespace Tests\Feature;

use App\Models\BookingDetail;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DatabaseIntegrityTest extends TestCase
{
    use RefreshDatabase;

    public function test_fresh_schema_contains_current_business_columns(): void
    {
        $this->assertTrue(Schema::hasColumns('bookings', [
            'membership_card_id',
            'card_sessions_planned',
            'payment_status',
        ]));
        $this->assertTrue(Schema::hasColumn('courts', 'is_contract_only'));
        $this->assertTrue(Schema::hasColumns('booking_intents', [
            'intent_code',
            'payload',
            'amount',
            'booking_type',
            'expires_at',
        ]));
        $this->assertFalse(Schema::hasColumn('court_pricing', 'court_id'));
        $this->assertFalse(Schema::hasColumn('court_price_histories', 'court_id'));
    }

    public function test_deleting_booking_cascades_details(): void
    {
        $booking = $this->createBooking($this->createUser());
        $court = $this->createCourt();
        $detail = BookingDetail::create([
            'booking_id' => $booking->id,
            'court_id' => $court->id,
            'booking_date' => today()->toDateString(),
            'start_time' => '10:00',
            'end_time' => '11:00',
            'duration_minutes' => 60,
            'price' => 100000,
        ]);

        $booking->delete();

        $this->assertDatabaseMissing('booking_details', ['id' => $detail->id]);
    }

    public function test_deleting_category_preserves_product_and_nulls_reference(): void
    {
        $category = Category::create(['name' => 'Rackets', 'status' => 'active']);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Test Racket',
            'sku' => 'RACKET-TEST',
            'stock_quantity' => 1,
            'selling_price' => 1000000,
            'status' => 'active',
        ]);

        $category->delete();

        $this->assertDatabaseHas('products', ['id' => $product->id, 'category_id' => null]);
    }
}
