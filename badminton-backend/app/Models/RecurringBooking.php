<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class RecurringBooking extends Model
{
    use HasUuid;

    protected $table = 'recurring_bookings';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'court_id',
        'recurring_code',
        'days_of_week',
        'start_time',
        'end_time',
        'start_date',
        'end_date',
        'status',
        'type',
    ];

    protected $casts = [
        'days_of_week' => 'array',
        'start_date'   => 'date:Y-m-d',
        'end_date'     => 'date:Y-m-d',
    ];

    // Relationships

    /** Quan hệ: RecurringBooking thuộc về một khách hàng */
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }

    /** Quan hệ: RecurringBooking thuộc về một sân */
    public function court()
    {
        return $this->belongsTo(Court::class, 'court_id', 'id');
    }

    /** Quan hệ: RecurringBooking có nhiều booking phát sinh */
    public function bookings()
    {
        return $this->hasMany(Booking::class, 'recurring_booking_id', 'id');
    }
}
