<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class UserAddress extends Model
{
    use HasUuid;

    protected $table = 'user_addresses';
    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'province',
        'district',
        'ward',
        'address_line',
        'address_type',
        'is_default',
    ];

    // Relationships

    /** Quan hệ: địa chỉ thuộc về một người dùng */
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }
}
