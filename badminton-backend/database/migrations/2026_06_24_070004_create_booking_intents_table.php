<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('booking_intents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('intent_code', 20)->unique(); // PAY_XXXXXX
            $table->json('payload');                     // toàn bộ params đặt sân
            $table->decimal('amount', 12, 2);
            $table->string('booking_type', 20);          // single | recurring | long_term
            $table->timestamp('expires_at');             // hết hạn sau 30 phút
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('booking_intents');
    }
};
