<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class Payment extends Model
{
    use HasFactory, HasUuids;

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
        'amount' => 'float',
        'paid_at' => 'datetime',
    ];

    /**
     * -------------------------------------------------------------
     * QUAN HỆ VỚI ĐƠN ĐẶT SÂN
     * -------------------------------------------------------------
     */
    /**
     * Chức năng: Khai báo quan hệ bản ghi thuộc về một đơn đặt sân.
     */
    public function booking()
    {
        return $this->belongsTo(Booking::class, 'booking_id', 'id');
    }

    /**
     * -------------------------------------------------------------
     * QUAN HỆ VỚI NGƯỜI THANH TOÁN
     * -------------------------------------------------------------
     */
    /**
     * Chức năng: Khai báo quan hệ bản ghi thuộc về một người dùng.
     */
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }
}