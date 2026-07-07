<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class BookingDetail extends Model
{
    use HasUuid;

    protected $table = 'booking_details';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = [
        'booking_id',
        'court_id',
        'booking_date',
        'start_time',
        'end_time',
        'duration_minutes',
        'price_per_hour',
        'price',
        'overtime_minutes',
        'overtime_fee',
    ];

    protected $casts = [
        'price_per_hour'   => 'float',
        'price'            => 'float',
        'overtime_fee'     => 'float',
        'duration_minutes' => 'integer',
        'overtime_minutes' => 'integer',
    ];

    // Relationships

    /** Quan hệ: BookingDetail thuộc về một booking */
    public function booking()
    {
        return $this->belongsTo(Booking::class, 'booking_id', 'id');
    }

    /** Quan hệ: BookingDetail thuộc về một sân */
    public function court()
    {
        return $this->belongsTo(Court::class, 'court_id', 'id');
    }
}
