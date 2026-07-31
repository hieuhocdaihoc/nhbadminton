<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::statement("ALTER TABLE purchase_orders MODIFY status ENUM('completed') NOT NULL DEFAULT 'completed'");
        DB::table('purchase_orders')->update(['status' => 'completed']);
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::statement("ALTER TABLE purchase_orders MODIFY status ENUM('draft','confirmed','received','cancelled') NOT NULL DEFAULT 'draft'");
    }
};
