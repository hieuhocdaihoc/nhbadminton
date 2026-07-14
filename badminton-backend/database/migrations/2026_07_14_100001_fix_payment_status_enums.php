<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // payments.status: code dùng 'success' nhưng migration cũ chỉ có pending/completed/failed/refunded
        DB::statement("ALTER TABLE payments MODIFY status ENUM('pending','success','completed','failed','refunded') NOT NULL DEFAULT 'pending'");

        // bookings.payment_status: code dùng 'partially_paid' nhưng migration cũ chỉ có partial
        DB::statement("ALTER TABLE bookings MODIFY payment_status ENUM('unpaid','partially_paid','paid') NOT NULL DEFAULT 'unpaid'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE payments MODIFY status ENUM('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending'");
        DB::statement("ALTER TABLE bookings MODIFY payment_status ENUM('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid'");
    }
};
