<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'products';

    protected $fillable = [
        'category_id',
        'brand',
        'name',
        'sku',
        'description',
        'short_description',
        'material',
        'origin',
        'sold_count',
        'stock_quantity',
        'low_stock_threshold',
        'status',
        'selling_price',
    ];

    // Relationships

    /** Quan hệ: sản phẩm thuộc về một danh mục */
    public function category()
    {
        return $this->belongsTo(Category::class, 'category_id', 'id');
    }

    /** Quan hệ: sản phẩm có nhiều chi tiết dịch vụ đặt sân */
    public function bookingServiceDetails()
    {
        return $this->hasMany(BookingServiceDetail::class, 'product_id', 'id');
    }

    /** Quan hệ: sản phẩm có nhiều chi tiết phiếu nhập hàng */
    public function purchaseOrderDetails()
    {
        return $this->hasMany(PurchaseOrderDetail::class, 'product_id', 'id');
    }

    /** Quan hệ: sản phẩm có nhiều bản ghi biến động kho */
    public function inventoryTransactions()
    {
        return $this->hasMany(InventoryTransaction::class, 'product_id', 'id');
    }

    /** Quan hệ: sản phẩm có nhiều hình ảnh */
    public function images()
    {
        return $this->hasMany(Image::class, 'target_id', 'id')
            ->where('target_type', 'product')
            ->orderBy('sort_order', 'asc');
    }
}
