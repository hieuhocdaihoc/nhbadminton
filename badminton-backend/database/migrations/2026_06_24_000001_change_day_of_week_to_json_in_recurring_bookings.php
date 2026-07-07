<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Thêm cột json mới
        Schema::table('recurring_bookings', function (Blueprint $table) {
            $table->json('days_of_week')->nullable()->after('recurring_code');
        });

        // 2. Chuyển dữ liệu cũ sang dạng mảng JSON
        DB::statement('UPDATE recurring_bookings SET days_of_week = JSON_ARRAY(day_of_week) WHERE day_of_week IS NOT NULL');

        // 3. Xoá cột cũ
        Schema::table('recurring_bookings', function (Blueprint $table) {
            $table->dropColumn('day_of_week');
        });
    }

    public function down(): void
    {
        Schema::table('recurring_bookings', function (Blueprint $table) {
            $table->tinyInteger('day_of_week')->nullable()->after('recurring_code');
        });

        // Lấy ngày đầu tiên trong mảng làm giá trị rollback
        DB::statement('UPDATE recurring_bookings SET day_of_week = JSON_UNQUOTE(JSON_EXTRACT(days_of_week, "$[0]"))');

        Schema::table('recurring_bookings', function (Blueprint $table) {
            $table->dropColumn('days_of_week');
        });
    }
};
