<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Schema; // Thêm dòng này

class AppServiceProvider extends ServiceProvider
{
    /**
     * Chức năng: Đăng ký service hoặc binding dùng chung cho ứng dụng Laravel.
     */
    public function register(): void
    {
        //
    }

    /**
     * Chức năng: Khởi chạy các thiết lập toàn cục sau khi service provider được nạp.
     */
    public function boot(): void
    {
        // Thêm dòng này để fix lỗi 1071
        Schema::defaultStringLength(191);
    }
}