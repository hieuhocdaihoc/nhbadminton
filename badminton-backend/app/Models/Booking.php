<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class Booking extends Model
{
    use HasUuid;

    protected $table = 'bookings';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = [
        'booking_code',
        'user_id',
        'recurring_booking_id',
        'staff_id',
        'promotion_id',
        'membership_card_id',
        'card_sessions_planned',
        'subtotal_court',
        'subtotal_service',
        'discount_amount',
        'total_price',
        'deposit_amount',
        'remaining_amount',
        'customer_name',
        'customer_phone',
        'check_in_at',
        'check_out_at',
        'status',
        'payment_status',
        'points_awarded_at',
    ];

    protected $casts = [
        'subtotal_court'    => 'float',
        'subtotal_service'  => 'float',
        'discount_amount'   => 'float',
        'total_price'       => 'float',
        'deposit_amount'    => 'float',
        'remaining_amount'  => 'float',
        'check_in_at'       => 'datetime',
        'check_out_at'      => 'datetime',
        'points_awarded_at' => 'datetime',
    ];

    // Relationships

    /** Quan hệ: Booking thuộc về một khách hàng */
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }

    /** Quan hệ: Booking thuộc về một nhân viên xử lý */
    public function staff()
    {
        return $this->belongsTo(User::class, 'staff_id', 'id');
    }

    /** Quan hệ: Booking thuộc về một lịch đặt định kỳ */
    public function recurringBooking()
    {
        return $this->belongsTo(RecurringBooking::class, 'recurring_booking_id', 'id');
    }

    /** Quan hệ: Booking thuộc về một chương trình khuyến mãi */
    public function promotion()
    {
        return $this->belongsTo(Promotion::class, 'promotion_id', 'id');
    }

    /** Quan hệ: Booking có nhiều chi tiết sân đặt */
    public function details()
    {
        return $this->hasMany(BookingDetail::class, 'booking_id', 'id');
    }

    /** Quan hệ: Booking có nhiều chi tiết dịch vụ/sản phẩm phát sinh */
    public function serviceDetails()
    {
        return $this->hasMany(BookingServiceDetail::class, 'booking_id', 'id');
    }

    /** Quan hệ: Booking có nhiều giao dịch thanh toán */
    public function payments()
    {
        return $this->hasMany(Payment::class, 'booking_id', 'id');
    }

    /** Quan hệ: Booking có nhiều đánh giá */
    public function reviews()
    {
        return $this->hasMany(Review::class, 'booking_id', 'id');
    }
}
