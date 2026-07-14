<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class CleanSlateSeeder extends Seeder
{
    public function run(): void
    {
        // =====================================================================
        // 1. XÓA TOÀN BỘ DỮ LIỆU
        // =====================================================================
        Schema::disableForeignKeyConstraints();

        $tables = [
            'purchase_order_details',
            'purchase_orders',
            'inventory_transactions',
            'staff_shifts',
            'booking_service_details',
            'payments',
            'refunds',
            'booking_intents',
            'booking_details',
            'bookings',
            'recurring_bookings',
            'reviews',
            'notifications',
            'court_price_histories',
            'court_pricing',
            'images',
            'additional_services',
            'products',
            'categories',
            'suppliers',
            'promotions',
            'user_addresses',
            'personal_access_tokens',
            'courts',
            'system_settings',
            'users',
        ];

        foreach ($tables as $table) {
            if (Schema::hasTable($table)) {
                DB::table($table)->truncate();
            }
        }

        Schema::enableForeignKeyConstraints();

        // =====================================================================
        // 2. UUID CỐ ĐỊNH
        // =====================================================================
        $adminId    = 'aaaaaaaa-0001-0001-0001-000000000001';
        $customerId = 'cccccccc-0001-0001-0001-000000000001';

        $court01 = '1e78caa0-d9db-4e51-bf1b-eb58d3bbf0d5';
        $court02 = 'b95cc409-3c58-43d6-ae30-c4a37c6e90f6';
        $court03 = '8ef9d035-7dc8-419b-9d19-6addc9196826';
        $court04 = 'f078a9d4-780a-444d-b6d6-e803bcd7db3c';
        $court05 = '71504586-8d59-43ad-ac8f-d40a529651fb';

        // =====================================================================
        // 3. TÀI KHOẢN
        // =====================================================================
        DB::table('users')->insert([
            [
                'id'            => $adminId,
                'full_name'     => 'Admin NHBadminton',
                'phone'         => '0394421192',
                'email'         => 'admin@nhbadminton.vn',
                'password_hash' => Hash::make('hieu1411'),
                'role'          => 'admin',
                'status'        => 'active',
                'points'        => 0,
                'total_spent'   => 0,
                'created_at'    => now(),
                'updated_at'    => now(),
            ],
            [
                'id'            => $customerId,
                'full_name'     => 'Ngoc Hieu',
                'phone'         => '0985795487',
                'email'         => 'ngochieu@gmail.com',
                'password_hash' => Hash::make('hieu12'),
                'role'          => 'customer',
                'status'        => 'active',
                'points'        => 0,
                'total_spent'   => 0,
                'created_at'    => now(),
                'updated_at'    => now(),
            ],
        ]);

        // =====================================================================
        // 4. 5 SÂN
        // =====================================================================
        $courts = [
            ['id' => $court01, 'name' => 'Sân 01', 'court_code' => 'C01', 'floor_type' => 'wood', 'has_lighting' => 1, 'capacity' => 4, 'is_maintenance' => 0, 'status' => 'active'],
            ['id' => $court02, 'name' => 'Sân 02', 'court_code' => 'C02', 'floor_type' => 'wood', 'has_lighting' => 1, 'capacity' => 4, 'is_maintenance' => 0, 'status' => 'active'],
            ['id' => $court03, 'name' => 'Sân 03', 'court_code' => 'C03', 'floor_type' => 'wood', 'has_lighting' => 1, 'capacity' => 4, 'is_maintenance' => 0, 'status' => 'active'],
            ['id' => $court04, 'name' => 'Sân 04', 'court_code' => 'C04', 'floor_type' => 'wood', 'has_lighting' => 1, 'capacity' => 4, 'is_maintenance' => 0, 'status' => 'active'],
            ['id' => $court05, 'name' => 'Sân 05', 'court_code' => 'C05', 'floor_type' => 'wood', 'has_lighting' => 1, 'capacity' => 4, 'is_maintenance' => 0, 'status' => 'active'],
        ];

        foreach ($courts as $c) {
            DB::table('courts')->insert($c);
        }

        // =====================================================================
        // 5. BẢNG GIÁ MẶC ĐỊNH (áp cho tất cả 5 sân)
        // =====================================================================
        $pricingSlots = [
            // Ngày trong tuần (weekday)
            ['day_type' => 'weekday', 'start_time' => '05:00:00', 'end_time' => '17:00:00', 'price' => 70000, 'min_booking_minutes' => 60],
            ['day_type' => 'weekday', 'start_time' => '17:00:00', 'end_time' => '22:00:00', 'price' => 120000, 'min_booking_minutes' => 60],
            // Cuối tuần (weekend)
            ['day_type' => 'weekend', 'start_time' => '05:00:00', 'end_time' => '17:00:00', 'price' => 90000, 'min_booking_minutes' => 60],
            ['day_type' => 'weekend', 'start_time' => '17:00:00', 'end_time' => '22:00:00', 'price' => 150000, 'min_booking_minutes' => 60],
        ];

        foreach ([$court01, $court02, $court03, $court04, $court05] as $courtId) {
            foreach ($pricingSlots as $slot) {
                DB::table('court_pricing')->insert(array_merge($slot, [
                    'id'       => (string) Str::uuid(),
                    'court_id' => $courtId,
                ]));
            }
        }

        // =====================================================================
        // 6. DỊCH VỤ BỔ SUNG
        // =====================================================================
        $services = [
            ['id' => '019e2eea-496b-7203-a558-63991dd9cbfa', 'name' => 'Thuê đèn chiếu sáng', 'service_type' => 'rental', 'price' => 15000, 'unit' => 'buổi', 'status' => 'active'],
            ['id' => 'e16d513f-4ad0-11f1-b356-0250edbfc5ac', 'name' => 'Thuê vợt Yonex',      'service_type' => 'rental', 'price' => 25000, 'unit' => 'cái',   'status' => 'active'],
            ['id' => 'e16d53ad-4ad0-11f1-b356-0250edbfc5ac', 'name' => 'Thuê vợt Lining',     'service_type' => 'rental', 'price' => 20000, 'unit' => 'cái',   'status' => 'active'],
            ['id' => 'e16d542d-4ad0-11f1-b356-0250edbfc5ac', 'name' => 'Thuê giày',           'service_type' => 'rental', 'price' => 30000, 'unit' => 'đôi',   'status' => 'active'],
            ['id' => 'e16d5465-4ad0-11f1-b356-0250edbfc5ac', 'name' => 'Đan lưới vợt',        'service_type' => 'other',  'price' => 80000, 'unit' => 'cái',   'status' => 'active'],
        ];

        foreach ($services as $s) {
            DB::table('additional_services')->insert($s);
        }

        // =====================================================================
        // 7. DANH MỤC SẢN PHẨM
        // =====================================================================
        $catNuoc   = '019e2f03-e4fc-70a8-9dc8-a9440ba74874';
        $catCauLong = '019e3f04-5e3f-703d-b904-b61b1236bfa3';

        DB::table('categories')->insert([
            ['id' => $catNuoc,    'name' => 'Nước giải khát',    'status' => 'active'],
            ['id' => $catCauLong, 'name' => 'Sản phẩm cầu lông', 'status' => 'active'],
        ]);

        // =====================================================================
        // 8. SẢN PHẨM MẪU
        // =====================================================================
        $products = [
            ['category_id' => $catNuoc,    'name' => 'Nước suối Lavie 500ml',      'sku' => 'NUOC_LAVIE_500', 'brand' => 'Lavie',    'selling_price' => 8000,    'stock_quantity' => 200, 'low_stock_threshold' => 20],
            ['category_id' => $catNuoc,    'name' => 'Pocari Sweat 330ml',          'sku' => 'POCARI_330',     'brand' => 'Pocari',   'selling_price' => 15000,   'stock_quantity' => 150, 'low_stock_threshold' => 15],
            ['category_id' => $catNuoc,    'name' => 'Red Bull lon 250ml',          'sku' => 'REDBULL_250',    'brand' => 'Red Bull', 'selling_price' => 18000,   'stock_quantity' => 100, 'low_stock_threshold' => 10],
            ['category_id' => $catCauLong, 'name' => 'Vợt Yonex Astrox 88S',       'sku' => 'VOT_YONEX_88S',  'brand' => 'Yonex',    'selling_price' => 2800000, 'stock_quantity' => 10,  'low_stock_threshold' => 2],
            ['category_id' => $catCauLong, 'name' => 'Vợt Li-Ning N90 III',        'sku' => 'VOT_LINING_N90', 'brand' => 'Li-Ning',  'selling_price' => 3200000, 'stock_quantity' => 5,   'low_stock_threshold' => 1],
            ['category_id' => $catCauLong, 'name' => 'Dây cước căng vợt BG65',     'sku' => 'CUOC_BG65',      'brand' => 'Yonex',    'selling_price' => 120000,  'stock_quantity' => 50,  'low_stock_threshold' => 5],
        ];

        foreach ($products as $p) {
            DB::table('products')->insert(array_merge($p, [
                'id'         => (string) Str::uuid(),
                'status'     => 'active',
                'created_at' => now(),
                'updated_at' => now(),
            ]));
        }

        // =====================================================================
        // 9. KHUYẾN MÃI MẪU (1 mã tự động + 1 mã thường)
        // =====================================================================
        DB::table('promotions')->insert([
            [
                'id'                  => (string) Str::uuid(),
                'code'                => 'KHAISON10',
                'name'                => 'Khai sân — Giảm 10%',
                'description'         => 'Ưu đãi khai trương, áp dụng tự động cho tất cả đơn đặt sân.',
                'discount_type'       => 'percent',
                'discount_value'      => 10,
                'per_user_limit'      => 0,
                'min_points_required' => 0,
                'valid_from'          => now()->toDateString(),
                'valid_to'            => now()->addDays(30)->toDateString(),
                'auto_apply'          => 1,
                'status'              => 'active',
            ],
            [
                'id'                  => (string) Str::uuid(),
                'code'                => 'VIPKHACH50',
                'name'                => 'Voucher VIP 50k',
                'description'         => 'Giảm 50.000đ cho khách VIP, dùng 1 lần.',
                'discount_type'       => 'fixed',
                'discount_value'      => 50000,
                'per_user_limit'      => 1,
                'min_points_required' => 0,
                'valid_from'          => now()->toDateString(),
                'valid_to'            => now()->addDays(30)->toDateString(),
                'auto_apply'          => 0,
                'status'              => 'active',
            ],
        ]);

        // =====================================================================
        // 10. CẤU HÌNH HỆ THỐNG
        // =====================================================================
        $settings = [
            ['setting_key' => 'club_name',                   'setting_value' => 'NH Badminton'],
            ['setting_key' => 'address',                     'setting_value' => '123 Đường Cầu Lông, Q.1, TP.HCM'],
            ['setting_key' => 'phone',                       'setting_value' => '0394421192'],
            ['setting_key' => 'email',                       'setting_value' => 'admin@nhbadminton.vn'],
            ['setting_key' => 'open_time',                   'setting_value' => '05:00'],
            ['setting_key' => 'close_time',                  'setting_value' => '22:00'],
            ['setting_key' => 'deposit_percent',             'setting_value' => '20'],
            ['setting_key' => 'reschedule_advance_hours',    'setting_value' => '24'],
            ['setting_key' => 'reschedule_same_day_hours',   'setting_value' => '2'],
        ];

        foreach ($settings as $s) {
            DB::table('system_settings')->insert(array_merge($s, [
                'id' => (string) Str::uuid(),
            ]));
        }

        $this->command->info('✓ CleanSlateSeeder hoàn thành:');
        $this->command->info('  - 2 tài khoản: admin (0394421192) + customer (0985795487)');
        $this->command->info('  - 5 sân (Sân 01 – 05) với bảng giá mặc định');
        $this->command->info('  - 5 dịch vụ bổ sung, 2 danh mục, 6 sản phẩm mẫu');
        $this->command->info('  - 2 khuyến mãi mẫu: KHAISON10 (auto 10%) + VIPKHACH50 (50k VIP)');
        $this->command->info('  - Cấu hình hệ thống cơ bản');
    }
}
