<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AdditionalService extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'additional_services';
    public $timestamps = false;

    protected $fillable = [
        'name',
        'service_type',
        'description',
        'price',
        'unit',
        'status',
    ];

    // Relationships

    /** Quan hệ: một dịch vụ có nhiều chi tiết dịch vụ trong đơn đặt sân */
    public function bookingServiceDetails()
    {
        return $this->hasMany(BookingServiceDetail::class, 'service_id', 'id');
    }
}
