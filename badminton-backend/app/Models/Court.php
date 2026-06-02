<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class Court extends Model
{
    use HasUuid;

    protected $table = 'courts';
    public $timestamps = false; // Bảng này của bạn không thiết kế created_at và updated_at

    protected $fillable = [
        'name',
        'court_code',
        'floor_type',
        'has_lighting',
        'capacity',
        'location_note',
        'is_maintenance',
        'status'
    ];
    // Lấy tất cả hình ảnh của sân này
    /**
     * Chức năng: Khai báo quan hệ model có nhiều hình ảnh hiển thị.
     */
    public function images()
    {
        return $this->hasMany(Image::class, 'target_id', 'id')
            ->where('target_type', 'court')
            ->orderBy('sort_order', 'asc');
    }
    /**
     * Chức năng: Khai báo quan hệ sân có nhiều chi tiết đặt sân.
     */
    public function bookingDetails()
    {
        return $this->hasMany(\App\Models\BookingDetail::class, 'court_id', 'id');
    }

    /**
     * Chức năng: Khai báo quan hệ model có nhiều đánh giá liên quan.
     */
    public function reviews()
    {
        return $this->hasMany(Review::class, 'target_id', 'id')
            ->where('target_type', 'court');
    }
}
