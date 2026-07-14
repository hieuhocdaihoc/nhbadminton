<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('court_price_histories')) {
            return;
        }
        Schema::create('court_price_histories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('court_pricing_id')->nullable()->comment('Bản ghi giá bị thay đổi');
            $table->uuid('court_id')->nullable()->comment('Sân được sửa giá');
            $table->decimal('old_price', 12, 2)->nullable()->comment('Giá cũ');
            $table->decimal('new_price', 12, 2)->nullable()->comment('Giá mới');
            $table->string('action', 20)->default('update')->comment('create / update / delete');
            $table->string('note', 255)->nullable()->comment('Khung giờ / loại ngày bị sửa');
            $table->uuid('changed_by')->nullable()->comment('Người thực hiện');
            $table->timestamp('created_at')->useCurrent();

            $table->index('court_id');
            $table->index('court_pricing_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('court_price_histories');
    }
};
