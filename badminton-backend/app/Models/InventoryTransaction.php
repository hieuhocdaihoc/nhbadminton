<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InventoryTransaction extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'inventory_transactions';

    const UPDATED_AT = null;

    protected $fillable = [
        'product_id',
        'transaction_type',
        'quantity',
        'before_quantity',
        'after_quantity',
        'reference_type',
        'reference_id',
        'note',
        'created_by',
    ];

    // Relationships

    /** Quan hệ: bản ghi biến động thuộc về một sản phẩm */
    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id', 'id');
    }

    /** Quan hệ: bản ghi được tạo bởi một người dùng */
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by', 'id');
    }
}
