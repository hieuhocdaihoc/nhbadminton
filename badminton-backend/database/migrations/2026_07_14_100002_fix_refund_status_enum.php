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

        // refunds.status: code dùng 'recorded' nhưng migration cũ chỉ có pending/completed/rejected
        DB::statement("ALTER TABLE refunds MODIFY status ENUM('recorded','pending','completed','rejected') NOT NULL DEFAULT 'recorded'");
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::statement("ALTER TABLE refunds MODIFY status ENUM('pending','completed','rejected') NOT NULL DEFAULT 'pending'");
    }
};
