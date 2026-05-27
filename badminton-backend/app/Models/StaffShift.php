<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class StaffShift extends Model
{
    use HasUuids;

    protected $table = 'Staff_Shifts';
    public $timestamps = false;

    protected $fillable = [
        'staff_id',
        'shift_date',
        'shift_name',
        'start_time',
        'end_time',
        'check_in_time',
        'check_out_time',
        'status',
        'note',
    ];

    protected $casts = [
        'shift_date' => 'date:Y-m-d',
        'check_in_time' => 'datetime:Y-m-d H:i:s',
        'check_out_time' => 'datetime:Y-m-d H:i:s',
    ];

    public function staff()
    {
        return $this->belongsTo(User::class, 'staff_id', 'id');
    }
}
