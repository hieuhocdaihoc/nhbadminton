<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductFilteringTest extends TestCase
{
    use RefreshDatabase;

    public function test_keyword_and_category_filters_are_applied_together(): void
    {
        $this->signIn(null, ['role' => 'admin']);
        $racketCategory = Category::create(['name' => 'Vot', 'status' => 'active']);
        $shoeCategory = Category::create(['name' => 'Giay', 'status' => 'active']);

        Product::create([
            'category_id' => $racketCategory->id,
            'name' => 'Yonex Pro',
            'sku' => 'RACKET-001',
            'selling_price' => 1000000,
        ]);
        Product::create([
            'category_id' => $shoeCategory->id,
            'name' => 'Yonex Court Shoes',
            'sku' => 'SHOE-001',
            'selling_price' => 800000,
        ]);

        $this->getJson("/api/admin/products?keyword=Yonex&category_id={$racketCategory->id}")
            ->assertOk()
            ->assertJsonCount(1, 'data.data')
            ->assertJsonPath('data.data.0.sku', 'RACKET-001')
            ->assertJsonPath('stats.total', 1);
    }
}
