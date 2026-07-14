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
        'valid_from',
        'valid_to',
        'auto_apply',
        'description',
        'status',
    ];

    protected $casts = [
        'discount_value'      => 'float',
        'per_user_limit'      => 'integer',
        'min_points_required' => 'integer',
        'valid_from'          => 'date',
        'valid_to'            => 'date',
        'auto_apply'          => 'boolean',
    ];

    /** Scope: chỉ lấy mã còn hiệu lực tại thời điểm hiện tại */
    public function scopeCurrentlyValid($query)
    {
        $today = now()->toDateString();
        return $query->where('status', 'active')
            ->where(fn($q) => $q->whereNull('valid_from')->orWhere('valid_from', '<=', $today))
            ->where(fn($q) => $q->whereNull('valid_to')->orWhere('valid_to', '>=', $today));
    }

    // Relationships

    /** Quan hệ: một khuyến mãi có nhiều đơn đặt sân */
    public function bookings()
    {
        return $this->hasMany(Booking::class, 'promotion_id', 'id');
    }
}
