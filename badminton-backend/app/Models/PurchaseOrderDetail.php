<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PurchaseOrderDetail extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'purchase_order_details';

    public $timestamps = false;

    protected $fillable = [
        'purchase_order_id',
        'product_id',
        'quantity',
        'import_price',
        'total_price',
    ];

    // Relationships

    /** Quan hệ: chi tiết phiếu nhập thuộc về một sản phẩm */
    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id', 'id');
    }

    /** Quan hệ: chi tiết phiếu nhập thuộc về một phiếu nhập hàng */
    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class, 'purchase_order_id', 'id');
    }
}
