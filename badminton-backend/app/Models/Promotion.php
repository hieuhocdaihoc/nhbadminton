<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Promotion extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'promotions';
    public $timestamps = false;

    protected $fillable = [
        'code',
        'name',
        'discount_type',
        'discount_value',
        'per_user_limit',
        'min_points_required',
        'status',
    ];

    protected $casts = [
        'discount_value' => 'float',
        'per_user_limit' => 'integer',
        'min_points_required' => 'integer',
    ];

    public function bookings()
    {
        return $this->hasMany(Booking::class, 'promotion_id', 'id');
    }
}
