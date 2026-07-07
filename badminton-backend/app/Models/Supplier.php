<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Supplier extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'suppliers';

    public $timestamps = false;

    protected $fillable = [
        'name',
        'phone',
        'email',
        'address',
        'contact_person',
    ];

    // Relationships

    /** Quan hệ: nhà cung cấp có nhiều phiếu nhập hàng */
    public function purchaseOrders()
    {
        return $this->hasMany(PurchaseOrder::class, 'supplier_id', 'id');
    }
}
