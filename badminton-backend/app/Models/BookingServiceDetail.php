<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class BookingServiceDetail extends Model
{
    use HasFactory, HasUuids;

    // Khai báo chính xác tên bảng trong Database của bạn
    protected $table = 'booking_service_details';

    // Tắt tự động timestamps vì bảng này của bạn không thiết kế cột created_at/updated_at
    public $timestamps = false;

    // Các cột cho phép hệ thống thêm/sửa dữ liệu tự động
    protected $fillable = [
        'booking_id',
        'service_id',
        'product_id',
        'quantity',
        'unit_price',
        'total_price',
        'note'
    ];

    // =========================================================================
    // CÁC MỐI QUAN HỆ (RELATIONS) ĐỂ LÁT ĐỔ DATA LÊN GIAO DIỆN
    // =========================================================================

    // 1. Chi tiết này phải thuộc về 1 Đơn đặt sân (Booking) cụ thể
    /**
     * Chức năng: Khai báo quan hệ bản ghi thuộc về một đơn đặt sân.
     */
    public function booking()
    {
        return $this->belongsTo(Booking::class, 'booking_id', 'id');
    }

    // 2. Nếu món hàng thêm vào là Sản phẩm (Nước uống, quả cầu...)
    /**
     * Chức năng: Khai báo quan hệ bản ghi thuộc về một sản phẩm.
     */
    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id', 'id');
    }

    // 3. Nếu món hàng thêm vào là Dịch vụ (Thuê vợt, dạy cầu...)
    /**
     * Chức năng: Khai báo quan hệ dòng bill thuộc về một dịch vụ bổ sung.
     */
    public function service()
    {
        return $this->belongsTo(AdditionalService::class, 'service_id', 'id');
    }
}