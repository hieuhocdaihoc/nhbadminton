<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use App\Models\User;

class Booking extends Model
{
    use HasUuid;

    protected $table = 'bookings';
    public $timestamps = false; // Bảng chỉ sử dụng trường created_at thủ công

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'booking_code',
        'user_id',
        'recurring_booking_id',
        'staff_id',
        'promotion_id',
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
        'payment_status'
    ];

    protected $casts = [
        'subtotal_court' => 'float',
        'subtotal_service' => 'float',
        'discount_amount' => 'float',
        'total_price' => 'float',
        'deposit_amount' => 'float',
        'remaining_amount' => 'float',
        'check_in_at' => 'datetime',
        'check_out_at' => 'datetime',
    ];

    // Quan hệ: Một Hóa đơn có nhiều Chi tiết đặt sân
    public function details()
    {
        return $this->hasMany(BookingDetail::class, 'booking_id', 'id');
    }

    // Quan hệ: Hóa đơn này thuộc về Hợp đồng Khung nào (nếu có)
    public function recurringBooking()
    {
        return $this->belongsTo(RecurringBooking::class, 'recurring_booking_id', 'id');
    }
    public function serviceDetails()
    {
        // Laravel sẽ tự động biến đổi tên hàm camelCase này thành snake_case "service_details" khi trả về dạng JSON cho React
        return $this->hasMany(BookingServiceDetail::class, 'booking_id', 'id');
    }
    /**
     * -------------------------------------------------------------
     * QUAN HỆ VỚI THANH TOÁN
     * -------------------------------------------------------------
     */
    public function payments()
    {
        return $this->hasMany(Payment::class, 'booking_id', 'id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }

    public function promotion()
    {
        return $this->belongsTo(Promotion::class, 'promotion_id', 'id');
    }
}
