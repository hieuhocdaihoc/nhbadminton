<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('bookings', 'points_awarded_at')) {
            Schema::table('bookings', function (Blueprint $table) {
                $table->dateTime('points_awarded_at')->nullable()->after('payment_status');
            });
        }
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn('points_awarded_at');
        });
    }
};
