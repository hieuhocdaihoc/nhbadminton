<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class CourtPricing extends Model
{
    use HasUuid;

    protected $table = 'court_pricing';
    public $timestamps = false; // Bảng không dùng created_at, updated_at

    protected $keyType = 'string';
    public $incrementing = false;

    // Chỉ chứa tên các cột cho phép insert/update
    protected $fillable = [
        'court_id',
        'day_type',
        'start_time',
        'end_time',
        'price',
        'effective_from',
        'effective_to',
        'min_booking_minutes',
    ];

    // Tự động ép kiểu dữ liệu chuẩn (Casts) khi lấy từ DB ra
    protected $casts = [
        'price' => 'float',
        'min_booking_minutes' => 'integer',
        'effective_from' => 'date:Y-m-d',
        'effective_to' => 'date:Y-m-d',
    ];

    // Quan hệ: Một mức giá này thuộc về một Sân cụ thể
    public function court()
    {
        return $this->belongsTo(Court::class, 'court_id', 'id');
    }
    // Bổ sung Quan hệ: Một Hợp đồng định kỳ sẽ sinh ra nhiều Hóa đơn (Buổi chơi)
    public function bookings()
    {
        return $this->hasMany(Booking::class, 'recurring_booking_id', 'id');
    }
}