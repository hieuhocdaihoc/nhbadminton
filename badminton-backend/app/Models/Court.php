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
    public function images()
    {
        return $this->hasMany(Image::class, 'target_id', 'id')
            ->where('target_type', 'court')
            ->orderBy('sort_order', 'asc');
    }
    public function bookingDetails()
    {
        return $this->hasMany(\App\Models\BookingDetail::class, 'court_id', 'id');
    }
}