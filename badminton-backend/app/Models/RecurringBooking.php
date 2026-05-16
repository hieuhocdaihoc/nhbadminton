<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class RecurringBooking extends Model
{
    use HasUuid;

    protected $table = 'recurring_bookings';
    public $timestamps = false;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'user_id',
        'court_id',
        'recurring_code',
        'day_of_week',
        'start_time',
        'end_time',
        'start_date',
        'end_date',
        'status'
    ];

    protected $casts = [
        'day_of_week' => 'integer',
        'start_date' => 'date:Y-m-d',
        'end_date' => 'date:Y-m-d',
    ];
    public function court()
    {
        return $this->belongsTo(Court::class, 'court_id', 'id');
    }
    // Thêm hàm này để lấy thông tin người đặt (User)
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }
}