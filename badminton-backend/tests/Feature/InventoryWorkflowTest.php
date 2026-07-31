<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\Supplier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InventoryWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_purchase_order_atomically_increases_stock_and_writes_audit_rows(): void
    {
        $admin = $this->signIn($this->createUser(['role' => 'admin']));
        $supplier = Supplier::create(['name' => 'Test Supplier']);
        $product = Product::create([
            'name' => 'Shuttlecock Tube',
            'sku' => 'SHUTTLE-01',
            'stock_quantity' => 10,
            'selling_price' => 150000,
            'status' => 'active',
        ]);

        $this->postJson('/api/admin/purchase-orders', [
            'supplier_id' => $supplier->id,
            'items' => [[
                'product_id' => $product->id,
                'quantity' => 5,
                'import_price' => 100000,
            ]],
        ])->assertCreated()->assertJsonPath('data.total_amount', 500000);

        $this->assertDatabaseHas('products', ['id' => $product->id, 'stock_quantity' => 15]);
        $this->assertDatabaseHas('purchase_orders', [
            'supplier_id' => $supplier->id,
            'total_amount' => 500000,
            'status' => 'completed',
            'created_by' => $admin->id,
        ]);
        $this->assertDatabaseHas('inventory_transactions', [
            'product_id' => $product->id,
            'transaction_type' => 'import',
            'quantity' => 5,
            'before_quantity' => 10,
            'after_quantity' => 15,
        ]);
    }

    public function test_inventory_adjustment_cannot_make_stock_negative(): void
    {
        $this->signIn($this->createUser(['role' => 'staff']));
        $product = Product::create([
            'name' => 'Grip Tape',
            'sku' => 'GRIP-01',
            'stock_quantity' => 3,
            'selling_price' => 20000,
            'status' => 'active',
        ]);

        $this->postJson('/api/admin/inventory-adjustment', [
            'product_id' => $product->id,
            'transaction_type' => 'export',
            'quantity' => -4,
            'note' => 'Damaged items',
        ])->assertStatus(400);

        $this->assertDatabaseHas('products', ['id' => $product->id, 'stock_quantity' => 3]);
        $this->assertDatabaseCount('inventory_transactions', 0);
    }

    public function test_inventory_adjustment_records_before_and_after_quantities(): void
    {
        $staff = $this->signIn($this->createUser(['role' => 'staff']));
        $product = Product::create([
            'name' => 'Sports Drink',
            'sku' => 'DRINK-01',
            'stock_quantity' => 20,
            'selling_price' => 15000,
            'status' => 'active',
        ]);

        $this->postJson('/api/admin/inventory-adjustment', [
            'product_id' => $product->id,
            'transaction_type' => 'adjustment',
            'quantity' => -2,
            'note' => 'Physical stock count',
        ])->assertCreated();

        $this->assertDatabaseHas('inventory_transactions', [
            'product_id' => $product->id,
            'quantity' => -2,
            'before_quantity' => 20,
            'after_quantity' => 18,
            'created_by' => $staff->id,
        ]);
    }
}
