<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Refund extends Model
{
    use HasUuids;

    protected $table = 'refunds';

    public $timestamps = false;

    protected $fillable = [
        'payment_id',
        'amount',
        'reason',
        'refund_method',
        'refund_info',
        'processed_by',
        'status',
    ];

    protected $casts = [
        'amount' => 'float',
    ];

    // Relationships

    /** Quan hệ: Hoàn tiền thuộc về một giao dịch thanh toán */
    public function payment()
    {
        return $this->belongsTo(Payment::class, 'payment_id', 'id');
    }

    /** Quan hệ: Hoàn tiền được xử lý bởi một người dùng (nhân viên/admin) */
    public function processedBy()
    {
        return $this->belongsTo(User::class, 'processed_by', 'id');
    }
}
