<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('membership_level', 50)->nullable()->default(null)->change();
            $table->string('customer_code', 20)->nullable()->default(null)->change();
            $table->string('gender', 10)->nullable()->default(null)->change();
            $table->date('date_of_birth')->nullable()->default(null)->change();
        });
    }

    public function down(): void {}
};
