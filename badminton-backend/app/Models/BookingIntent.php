<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BookingIntent extends Model
{
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id',
        'intent_code',
        'payload',
        'amount',
        'booking_type',
        'expires_at',
    ];

    protected $casts = [
        'payload'    => 'array',
        'expires_at' => 'datetime',
    ];
}
