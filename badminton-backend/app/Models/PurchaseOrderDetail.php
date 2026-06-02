<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class PurchaseOrderDetail extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'purchase_order_details';
    public $timestamps = false; // Tắt hoàn toàn thời gian

    protected $fillable = [
        'purchase_order_id',
        'product_id',
        'quantity',
        'import_price',
        'total_price'
    ];

    /**
     * Chức năng: Khai báo quan hệ bản ghi thuộc về một sản phẩm.
     */
    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id', 'id');
    }
}