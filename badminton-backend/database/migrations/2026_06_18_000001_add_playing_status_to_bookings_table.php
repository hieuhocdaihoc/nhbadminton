<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        // Already included in base migration — skip if enum already has 'playing'
        $row = DB::select("SHOW COLUMNS FROM bookings LIKE 'status'");
        if (!empty($row) && strpos($row[0]->Type ?? $row[0]->type ?? '', 'playing') === false) {
            DB::statement("ALTER TABLE bookings MODIFY COLUMN status ENUM('confirmed','completed','cancelled','playing') NOT NULL DEFAULT 'confirmed'");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::statement("ALTER TABLE bookings MODIFY COLUMN status ENUM('pending','confirmed','completed','cancelled') NOT NULL DEFAULT 'pending'");
        // Note: rollback removes 'playing' value - ensure no rows have status='playing' before rolling back
    }
};
