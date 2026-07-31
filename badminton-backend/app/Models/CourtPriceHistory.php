<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class CourtPriceHistory extends Model
{
    use HasUuids;

    protected $table = 'court_price_histories';
    public $timestamps = false;

    protected $fillable = [
        'court_pricing_id',
        'old_price',
        'new_price',
        'action',
        'note',
        'changed_by',
        'created_at',
    ];

    protected $casts = [
        'old_price'  => 'float',
        'new_price'  => 'float',
        'created_at' => 'datetime',
    ];

    /** Quan hệ: Người thực hiện thay đổi giá */
    public function changedBy()
    {
        return $this->belongsTo(User::class, 'changed_by', 'id');
    }
}
