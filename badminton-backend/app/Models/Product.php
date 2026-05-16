<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class Product extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'products';

    // Khai báo các cột được phép thêm/sửa
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
        'selling_price' // ĐÃ BỔ SUNG GIÁ BÁN LẺ VÀO ĐÂY
    ];

    // Tạo mối quan hệ: 1 Sản phẩm thuộc về 1 Danh mục
    public function category()
    {
        return $this->belongsTo(Category::class, 'category_id', 'id');
    }
}