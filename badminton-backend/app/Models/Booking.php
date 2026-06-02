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
        'payment_status',
        'points_awarded_at'
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
        'points_awarded_at' => 'datetime',
    ];

    // Quan hệ: Một Hóa đơn có nhiều Chi tiết đặt sân
    /**
     * Chức năng: Khai báo quan hệ booking có nhiều dòng chi tiết sân đã đặt.
     */
    public function details()
    {
        return $this->hasMany(BookingDetail::class, 'booking_id', 'id');
    }

    // Quan hệ: Hóa đơn này thuộc về Hợp đồng Khung nào (nếu có)
    /**
     * Chức năng: Khai báo quan hệ booking thuộc một lịch đặt định kỳ nếu có.
     */
    public function recurringBooking()
    {
        return $this->belongsTo(RecurringBooking::class, 'recurring_booking_id', 'id');
    }
    /**
     * Chức năng: Khai báo quan hệ booking có nhiều dòng sản phẩm/dịch vụ phát sinh.
     */
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
    /**
     * Chức năng: Khai báo quan hệ booking có nhiều giao dịch thanh toán.
     */
    public function payments()
    {
        return $this->hasMany(Payment::class, 'booking_id', 'id');
    }

    /**
     * Chức năng: Khai báo quan hệ bản ghi thuộc về một người dùng.
     */
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }

    /**
     * Chức năng: Khai báo quan hệ booking thuộc về một voucher nếu có áp dụng.
     */
    public function promotion()
    {
        return $this->belongsTo(Promotion::class, 'promotion_id', 'id');
    }

    /**
     * Chức năng: Khai báo quan hệ model có nhiều đánh giá liên quan.
     */
    public function reviews()
    {
        return $this->hasMany(Review::class, 'booking_id', 'id');
    }
}
