<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('user_addresses');
    }

    public function down(): void
    {
        Schema::create('user_addresses', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id')->nullable();
            $table->string('province', 100)->nullable();
            $table->string('district', 100)->nullable();
            $table->string('ward', 100)->nullable();
            $table->string('address_line')->nullable();
            $table->string('address_type', 30)->default('home');
            $table->boolean('is_default')->default(false);
            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
        });
    }
};
