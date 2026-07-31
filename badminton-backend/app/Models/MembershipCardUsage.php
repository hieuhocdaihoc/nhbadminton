<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class MembershipCardUsage extends Model
{
    use HasUuid;

    protected $table = 'membership_card_usages';

    public $timestamps = false;

    protected $fillable = [
        'card_id',
        'booking_id',
        'sessions_deducted',
        'used_at',
        'note',
    ];

    protected $casts = [
        'sessions_deducted' => 'integer',
        'used_at'           => 'datetime',
    ];

    public function card()
    {
        return $this->belongsTo(MembershipCard::class, 'card_id');
    }

    public function booking()
    {
        return $this->belongsTo(Booking::class, 'booking_id');
    }
}
