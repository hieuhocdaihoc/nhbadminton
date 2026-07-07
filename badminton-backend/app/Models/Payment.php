<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    use HasUuids;

    protected $table = 'payments';

    public $timestamps = false;

    protected $fillable = [
        'payment_code',
        'booking_id',
        'user_id',
        'payment_method',
        'amount',
        'paid_at',
        'status',
        'sepay_transaction_id',
        'bank_gateway',
        'reference_code',
        'payment_content',
    ];

    protected $casts = [
        'amount'  => 'float',
        'paid_at' => 'datetime',
    ];

    // Relationships

    /** Quan hệ: Thanh toán thuộc về một đơn đặt sân */
    public function booking()
    {
        return $this->belongsTo(Booking::class, 'booking_id', 'id');
    }

    /** Quan hệ: Thanh toán thuộc về một người dùng */
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }

    /** Quan hệ: Thanh toán có nhiều yêu cầu hoàn tiền */
    public function refunds()
    {
        return $this->hasMany(Refund::class, 'payment_id', 'id');
    }
}
