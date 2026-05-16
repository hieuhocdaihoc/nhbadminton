<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class UserAddress extends Model
{
    use HasUuid;

    protected $table = 'user_addresses'; // Khớp với tên bảng thực tế
    public $timestamps = false; // Bảng này trong DB của bạn chỉ có created_at, không có updated_at

    protected $fillable = [
        'user_id',
        'province',
        'district',
        'ward',
        'address_line',
        'address_type',
        'is_default'
    ];

    // Thiết lập quan hệ ngược lại với User
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }
}