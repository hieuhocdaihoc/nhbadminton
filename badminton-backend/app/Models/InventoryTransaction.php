<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class InventoryTransaction extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'inventory_transactions';
    const UPDATED_AT = null; // Tắt cột updated_at vì DB không có

    protected $fillable = [
        'product_id',
        'transaction_type',
        'quantity',
        'before_quantity',
        'after_quantity',
        'reference_type',
        'reference_id',
        'note',
        'created_by'
    ];

    // =========================================================================
    // THÊM MỐI QUAN HỆ: 1 Lịch sử biến động phải thuộc về 1 Sản phẩm cụ thể
    // =========================================================================
    /**
     * Chức năng: Khai báo quan hệ bản ghi thuộc về một sản phẩm.
     */
    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id', 'id');
    }

    /**
     * Chức năng: Khai báo quan hệ bản ghi được tạo bởi một người dùng trong hệ thống.
     */
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by', 'id');
    }
}
