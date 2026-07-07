<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PurchaseOrder extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'purchase_orders';

    const UPDATED_AT = null;

    protected $fillable = [
        'supplier_id',
        'purchase_code',
        'total_amount',
        'status',
        'created_by',
    ];

    // Relationships

    /** Quan hệ: phiếu nhập hàng có nhiều dòng chi tiết */
    public function details()
    {
        return $this->hasMany(PurchaseOrderDetail::class, 'purchase_order_id', 'id');
    }

    /** Quan hệ: phiếu nhập hàng thuộc về một nhà cung cấp */
    public function supplier()
    {
        return $this->belongsTo(Supplier::class, 'supplier_id', 'id');
    }

    /** Quan hệ: phiếu nhập được tạo bởi một người dùng */
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by', 'id');
    }
}
