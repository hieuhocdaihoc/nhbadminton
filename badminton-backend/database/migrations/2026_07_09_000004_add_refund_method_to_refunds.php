<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('refunds', 'refund_method')) {
            Schema::table('refunds', function (Blueprint $table) {
                $table->string('refund_method', 30)->default('cash')->after('reason')
                    ->comment('cash: tiền mặt | bank_transfer: chuyển khoản banking cá nhân');
                $table->string('refund_info', 255)->nullable()->after('refund_method')
                    ->comment('Thông tin nhận tiền (STK/ngân hàng/người nhận)');
                $table->timestamp('created_at')->useCurrent()->after('status');
            });
        }
    }

    public function down(): void
    {
        Schema::table('refunds', function (Blueprint $table) {
            $table->dropColumn(['refund_method', 'refund_info', 'created_at']);
        });
    }
};
