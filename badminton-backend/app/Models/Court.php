<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class Court extends Model
{
    use HasUuid;

    protected $table = 'courts';

    public $timestamps = false;

    protected $fillable = [
        'name',
        'court_code',
        'floor_type',
        'has_lighting',
        'capacity',
        'location_note',
        'is_maintenance',
        'status',
    ];

    // Relationships

    /** Quan hệ: Sân có nhiều hình ảnh, sắp xếp theo thứ tự hiển thị */
    public function images()
    {
        return $this->hasMany(Image::class, 'target_id', 'id')
            ->where('target_type', 'court')
            ->orderBy('sort_order', 'asc');
    }

    /** Quan hệ: Sân có nhiều chi tiết đặt sân */
    public function bookingDetails()
    {
        return $this->hasMany(BookingDetail::class, 'court_id', 'id');
    }

    /** Quan hệ: Sân có nhiều đánh giá */
    public function reviews()
    {
        return $this->hasMany(Review::class, 'target_id', 'id')
            ->where('target_type', 'court');
    }

    /** Quan hệ: Sân có nhiều mức giá */
    public function pricing()
    {
        return $this->hasMany(CourtPricing::class, 'court_id', 'id');
    }

    /** Quan hệ: Sân có nhiều lịch đặt định kỳ */
    public function recurringBookings()
    {
        return $this->hasMany(RecurringBooking::class, 'court_id', 'id');
    }
}
