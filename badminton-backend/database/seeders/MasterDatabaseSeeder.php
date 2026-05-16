<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema; // <-- 1. THÊM DÒNG IMPORT NÀY
use Illuminate\Support\Str;

class MasterDatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $userId = 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925';
        $court01_uuid = '1e78caa0-d9db-4e51-bf1b-eb58d3bbf0d5';
        $court02_uuid = 'b95cc409-3c58-43d6-ae30-c4a37c6e90f6';

        // =====================================================================
        // 2. SỬA LẠI ĐOẠN XÓA DỮ LIỆU CŨ (Tắt/Bật kiểm tra khóa ngoại)
        // =====================================================================
        Schema::disableForeignKeyConstraints(); // Tắt kiểm tra khóa ngoại

        DB::table('booking_details')->truncate();
        DB::table('bookings')->truncate();
        DB::table('recurring_bookings')->truncate();

        Schema::enableForeignKeyConstraints(); // Bật lại kiểm tra khóa ngoại
        // =====================================================================

        // ... Toàn bộ phần code insert bên dưới của bạn GIỮ NGUYÊN ...

        $bookingId = (string) Str::uuid();

        DB::table('bookings')->insert([
            'id' => $bookingId,
            'booking_code' => 'BILL_' . strtoupper(Str::random(6)),
            'user_id' => $userId,
            'subtotal_court' => 120000,
            'total_price' => 120000,
            'status' => 'confirmed',
            'payment_status' => 'paid',
            'customer_name' => 'Nguyen Van A',
            'customer_phone' => '0901234567',
            'created_at' => now()
        ]);

        DB::table('booking_details')->insert([
            'id' => (string) Str::uuid(),
            'booking_id' => $bookingId,
            'court_id' => $court01_uuid,
            'booking_date' => '2026-05-15',
            'start_time' => '17:00:00',
            'end_time' => '19:00:00',
            'duration_minutes' => 120,
            'price_per_hour' => 60000,
            'price' => 120000
        ]);

        DB::table('recurring_bookings')->insert([
            'id' => (string) Str::uuid(),
            'user_id' => $userId,
            'court_id' => $court02_uuid,
            'recurring_code' => 'REC_' . strtoupper(Str::random(5)),
            'day_of_week' => 5,
            'start_time' => '19:00:00',
            'end_time' => '21:00:00',
            'start_date' => '2026-05-01',
            'end_date' => '2026-12-31',
            'status' => 'active'
        ]);

        $this->command->info('Đã bơm thành công lịch test vào tài khoản Nguyen Van A (0901234567)!');
    }
}