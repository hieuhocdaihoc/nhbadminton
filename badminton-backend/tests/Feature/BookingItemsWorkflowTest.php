<?php

namespace Tests\Feature;

use App\Models\AdditionalService;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class BookingItemsWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_batch_add_items_updates_bill_stock_and_inventory_audit_atomically(): void
    {
        $staff = $this->signIn(null, ['role' => 'staff']);
        $booking = $this->createBooking(null, [
            'deposit_amount' => 200000,
            'remaining_amount' => 0,
            'payment_status' => 'paid',
        ]);
        $product = $this->createProduct(['stock_quantity' => 10, 'selling_price' => 15000]);
        $service = AdditionalService::create([
            'name' => 'Thue vot',
            'service_type' => 'other',
            'price' => 30000,
            'status' => 'active',
        ]);

        $this->postJson("/api/admin/bookings/{$booking->id}/add-items", [
            'items' => [
                ['type' => 'product', 'item_id' => $product->id, 'quantity' => 2],
                ['type' => 'service', 'item_id' => $service->id, 'quantity' => 1],
            ],
        ])->assertCreated()
            ->assertJsonPath('data.total_added_amount', 60000);

        $booking->refresh();
        $this->assertSame(60000.0, $booking->subtotal_service);
        $this->assertSame(260000.0, $booking->total_price);
        $this->assertSame(60000.0, $booking->remaining_amount);
        $this->assertSame('partially_paid', $booking->payment_status);
        $this->assertDatabaseHas('products', [
            'id' => $product->id,
            'stock_quantity' => 8,
            'sold_count' => 2,
        ]);
        $this->assertDatabaseHas('inventory_transactions', [
            'product_id' => $product->id,
            'transaction_type' => 'sale',
            'quantity' => -2,
            'before_quantity' => 10,
            'after_quantity' => 8,
            'reference_id' => $booking->id,
            'created_by' => $staff->id,
        ]);
        $this->assertDatabaseCount('booking_service_details', 2);
    }

    public function test_batch_failure_rolls_back_items_processed_before_stock_error(): void
    {
        $this->signIn(null, ['role' => 'staff']);
        $booking = $this->createBooking();
        $available = $this->createProduct([
            'name' => 'Nuoc',
            'sku' => 'DRINK-ROLLBACK',
            'stock_quantity' => 10,
        ]);
        $insufficient = $this->createProduct([
            'name' => 'Cau',
            'sku' => 'SHUTTLE-ROLLBACK',
            'stock_quantity' => 1,
        ]);

        $this->postJson("/api/admin/bookings/{$booking->id}/add-items", [
            'items' => [
                ['type' => 'product', 'item_id' => $available->id, 'quantity' => 2],
                ['type' => 'product', 'item_id' => $insufficient->id, 'quantity' => 2],
            ],
        ])->assertUnprocessable();

        $this->assertDatabaseHas('products', ['id' => $available->id, 'stock_quantity' => 10]);
        $this->assertDatabaseHas('products', ['id' => $insufficient->id, 'stock_quantity' => 1]);
        $this->assertDatabaseCount('booking_service_details', 0);
        $this->assertDatabaseCount('inventory_transactions', 0);
        $this->assertSame(200000.0, $booking->fresh()->total_price);
    }

    public function test_single_add_item_rejects_inactive_catalog_entry(): void
    {
        $this->signIn(null, ['role' => 'staff']);
        $booking = $this->createBooking();
        $product = $this->createProduct(['status' => 'inactive']);

        $this->postJson("/api/admin/bookings/{$booking->id}/add-item", [
            'type' => 'product',
            'item_id' => $product->id,
            'quantity' => 1,
        ])->assertUnprocessable();

        $this->assertDatabaseCount('booking_service_details', 0);
    }

    private function createProduct(array $attributes = []): Product
    {
        return Product::create(array_merge([
            'name' => 'San pham test',
            'sku' => 'ITEM-' . strtoupper(Str::random(8)),
            'stock_quantity' => 5,
            'sold_count' => 0,
            'selling_price' => 10000,
            'status' => 'active',
        ], $attributes));
    }
}
