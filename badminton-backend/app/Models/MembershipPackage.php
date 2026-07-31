<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class MembershipPackage extends Model
{
    use HasUuid;

    protected $table = 'membership_packages';

    protected $fillable = [
        'name',
        'description',
        'total_sessions',
        'duration_days',
        'price',
        'price_per_session',
        'status',
    ];

    protected $casts = [
        'price'             => 'float',
        'price_per_session' => 'float',
        'total_sessions'    => 'integer',
        'duration_days'     => 'integer',
    ];

    public function cards()
    {
        return $this->hasMany(MembershipCard::class, 'package_id');
    }
}
