<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('promotions', 'valid_from')) {
            Schema::table('promotions', function (Blueprint $table) {
                $table->date('valid_from')->nullable()->after('min_points_required')
                    ->comment('Ngày bắt đầu hiệu lực');
                $table->date('valid_to')->nullable()->after('valid_from')
                    ->comment('Ngày hết hạn sử dụng');
                $table->boolean('auto_apply')->default(false)->after('valid_to')
                    ->comment('Tự động áp dụng khi đặt sân trong thời gian hiệu lực');
                $table->string('description', 255)->nullable()->after('auto_apply')
                    ->comment('Mô tả dịp áp dụng (VD: Kỷ niệm 1 năm thành lập sân)');
            });
        }
    }

    public function down(): void
    {
        Schema::table('promotions', function (Blueprint $table) {
            $table->dropColumn(['valid_from', 'valid_to', 'auto_apply', 'description']);
        });
    }
};
