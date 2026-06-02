<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class Review extends Model
{
    use HasUuid;

    protected $table = 'reviews';
    public $timestamps = false;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'user_id',
        'target_type',
        'target_id',
        'booking_id',
        'rating',
        'comment',
        'staff_reply',
        'status',
    ];

    protected $casts = [
        'rating' => 'integer',
    ];

    /**
     * Chức năng: Khai báo quan hệ bản ghi thuộc về một người dùng.
     */
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }

    /**
     * Chức năng: Khai báo quan hệ bản ghi thuộc về một đơn đặt sân.
     */
    public function booking()
    {
        return $this->belongsTo(Booking::class, 'booking_id', 'id');
    }

    /**
     * Chức năng: Khai báo quan hệ bản ghi thuộc về một sân.
     */
    public function court()
    {
        return $this->belongsTo(Court::class, 'target_id', 'id');
    }
}
