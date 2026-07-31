<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class CourtPricing extends Model
{
    use HasUuid;

    protected $table = 'court_pricing';

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;

    protected $fillable = [
        'day_type',
        'start_time',
        'end_time',
        'price',
        'effective_from',
        'effective_to',
        'min_booking_minutes',
    ];

    protected $casts = [
        'price'                => 'float',
        'min_booking_minutes'  => 'integer',
        'effective_from'       => 'date:Y-m-d',
        'effective_to'         => 'date:Y-m-d',
    ];

    // Relationships
}
