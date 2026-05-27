<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Support\Str;
use App\Models\Booking;

class User extends Authenticatable
{
    use HasApiTokens, Notifiable;

    protected $table = 'users';
    protected $keyType = 'string';
    public $incrementing = false; // Tắt tự tăng vì dùng UUID

    protected $fillable = [
        'full_name',
        'email',
        'phone',
        'password_hash',
        'role',
        'gender',
        'date_of_birth',
        'customer_code',
        'membership_level',
        'points',
        'total_spent',
        'status'
    ];

    protected $hidden = ['password_hash'];

    // Tự động tạo UUID khi tạo mới User
    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
        });
    }

    // Ghi đè để Laravel hiểu password_hash là cột mật khẩu[cite: 1]
    public function getAuthPassword()
    {
        return $this->password_hash;
    }
    public function bookings()
    {
        return $this->hasMany(Booking::class, 'user_id', 'id');
    }

    public function staffShifts()
    {
        return $this->hasMany(StaffShift::class, 'staff_id', 'id');
    }
}
