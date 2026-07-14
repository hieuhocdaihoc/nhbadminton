<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('bookings')
            ->where('status', 'pending')
            ->update(['status' => 'confirmed']);
    }

    public function down(): void
    {
        // Không khôi phục được chính xác — pending đã bị khai tử có chủ đích.
    }
};
