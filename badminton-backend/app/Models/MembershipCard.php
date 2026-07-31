<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
// Booking cùng namespace App\Models — dùng để tính ca đang treo ở đơn chưa hoàn thành

class MembershipCard extends Model
{
    use HasUuid;

    protected $table = 'membership_cards';

    protected $fillable = [
        'card_code',
        'user_id',
        'package_id',
        'total_sessions',
        'used_sessions',
        'valid_from',
        'valid_to',
        'price',
        'price_per_session',
        'status',
        'created_by',
        'note',
    ];

    protected $casts = [
        'price'             => 'float',
        'price_per_session' => 'float',
        'total_sessions'    => 'integer',
        'used_sessions'     => 'integer',
        'valid_from'        => 'date:Y-m-d',
        'valid_to'          => 'date:Y-m-d',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function package()
    {
        return $this->belongsTo(MembershipPackage::class, 'package_id');
    }

    public function usages()
    {
        return $this->hasMany(MembershipCardUsage::class, 'card_id')->orderByDesc('used_at');
    }

    /** Số ca còn lại (theo ca đã trừ) */
    public function remainingSessions(): int
    {
        return max(0, $this->total_sessions - $this->used_sessions);
    }

    /**
     * Số ca đã cam kết ở các đơn ĐÃ ĐẶT nhưng CHƯA HOÀN THÀNH (chưa trừ ca).
     * Dùng để chặn khách đặt vượt ca: ca thực sự trừ lúc hoàn thành nên phải
     * tính cả phần đang "treo" ở đơn confirmed/playing.
     */
    public function committedSessions(): int
    {
        return (int) Booking::where('membership_card_id', $this->id)
            ->whereIn('status', ['confirmed', 'playing'])
            ->sum('card_sessions_planned');
    }

    /** Ca còn có thể đặt = còn lại − đã cam kết ở đơn chưa hoàn thành */
    public function availableSessions(): int
    {
        return max(0, $this->remainingSessions() - $this->committedSessions());
    }

    /** Hết thời hạn mà chưa dùng hết ca → chuyển sang expired (gọi khi đọc thẻ) */
    public function syncExpiryStatus(): void
    {
        if ($this->status === 'active' && $this->valid_to < today()) {
            $this->update(['status' => 'expired']);
        }
    }

    /** Kiểm tra thẻ còn hợp lệ để sử dụng */
    public function isUsable(): bool
    {
        return $this->status === 'active'
            && $this->valid_to >= today()
            && $this->remainingSessions() > 0;
    }
}
