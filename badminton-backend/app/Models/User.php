<?php

namespace App\Models;

use App\Services\MembershipTierService;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Support\Str;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $table = 'users';
    protected $keyType = 'string';
    public $incrementing = false;

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
        'status',
    ];

    protected $hidden = ['password_hash'];

    protected $appends = ['avatar_url'];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
        });

        static::saving(function ($model) {
            if ($model->role === 'customer' || empty($model->getRawOriginal('membership_level'))) {
                $model->membership_level = MembershipTierService::levelForPoints((int) ($model->points ?? 0));
            }
        });
    }

    public function getMembershipLevelAttribute(?string $value): string
    {
        if (($this->attributes['role'] ?? 'customer') === 'customer') {
            return MembershipTierService::levelForPoints((int) ($this->attributes['points'] ?? 0));
        }

        return $value ?: MembershipTierService::LEVEL_DONG;
    }

    public function getAuthPassword()
    {
        return $this->password_hash;
    }

    // Relationships

    /** Quan hệ: User có nhiều booking với tư cách khách hàng */
    public function bookings()
    {
        return $this->hasMany(Booking::class, 'user_id', 'id');
    }

    /** Quan hệ: User có nhiều booking với tư cách nhân viên xử lý */
    public function staffBookings()
    {
        return $this->hasMany(Booking::class, 'staff_id', 'id');
    }

    /** Quan hệ: User có nhiều ca làm việc */
    public function staffShifts()
    {
        return $this->hasMany(StaffShift::class, 'staff_id', 'id');
    }

    /** Quan hệ: User có nhiều đánh giá */
    public function reviews()
    {
        return $this->hasMany(Review::class, 'user_id', 'id');
    }

    /** Quan hệ: User có nhiều đặt sân định kỳ */
    public function recurringBookings()
    {
        return $this->hasMany(RecurringBooking::class, 'user_id', 'id');
    }

    /** Quan hệ: User có nhiều thông báo */
    public function notifications()
    {
        return $this->hasMany(Notification::class, 'receiver_id', 'id');
    }

    /** Quan hệ: User có nhiều giao dịch thanh toán */
    public function payments()
    {
        return $this->hasMany(Payment::class, 'user_id', 'id');
    }

    /** Quan hệ: User đã xử lý nhiều yêu cầu hoàn tiền */
    public function processedRefunds()
    {
        return $this->hasMany(Refund::class, 'processed_by', 'id');
    }

    /** Quan hệ: User đã tạo nhiều đơn nhập hàng */
    public function purchaseOrders()
    {
        return $this->hasMany(PurchaseOrder::class, 'created_by', 'id');
    }

    /** Quan hệ: User đã tạo nhiều giao dịch kho */
    public function inventoryTransactions()
    {
        return $this->hasMany(InventoryTransaction::class, 'created_by', 'id');
    }

    /** Quan hệ: User có nhiều ảnh */
    public function images()
    {
        return $this->hasMany(Image::class, 'target_id', 'id')
            ->where('target_type', 'user')
            ->orderBy('sort_order', 'asc');
    }

    /** Quan hệ: User có một ảnh đại diện chính */
    public function avatar()
    {
        return $this->hasOne(Image::class, 'target_id', 'id')
            ->where('target_type', 'user')
            ->where('is_primary', true);
    }

    // Accessors

    public function getAvatarUrlAttribute()
    {
        if ($this->relationLoaded('avatar')) {
            return $this->getRelation('avatar')?->url;
        }

        return $this->avatar()->value('url');
    }
}
