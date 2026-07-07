<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class Review extends Model
{
    use HasUuid;

    protected $table = 'reviews';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

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

    // Relationships

    /** Quan hệ: đánh giá thuộc về một người dùng */
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }

    /** Quan hệ: đánh giá thuộc về một đơn đặt sân */
    public function booking()
    {
        return $this->belongsTo(Booking::class, 'booking_id', 'id');
    }

    /** Quan hệ: đánh giá thuộc về một sân cầu lông */
    public function court()
    {
        return $this->belongsTo(Court::class, 'target_id', 'id');
    }

    /** Quan hệ: đối tượng được đánh giá (sân hoặc dịch vụ) theo target_type */
    public function subject()
    {
        if ($this->target_type === 'court') {
            return $this->belongsTo(Court::class, 'target_id', 'id');
        }

        if ($this->target_type === 'service') {
            return $this->belongsTo(AdditionalService::class, 'target_id', 'id');
        }

        return null;
    }
}
