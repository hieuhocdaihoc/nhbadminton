<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class BookingServiceDetail extends Model
{
    use HasUuids;

    protected $table = 'booking_service_details';
    public $timestamps = false;

    protected $fillable = [
        'booking_id',
        'service_id',
        'product_id',
        'quantity',
        'unit_price',
        'total_price',
        'note',
    ];

    // Relationships

    /** Quan hệ: BookingServiceDetail thuộc về một booking */
    public function booking()
    {
        return $this->belongsTo(Booking::class, 'booking_id', 'id');
    }

    /** Quan hệ: BookingServiceDetail thuộc về một sản phẩm */
    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id', 'id');
    }

    /** Quan hệ: BookingServiceDetail thuộc về một dịch vụ bổ sung */
    public function service()
    {
        return $this->belongsTo(AdditionalService::class, 'service_id', 'id');
    }
}
