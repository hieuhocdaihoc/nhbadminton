<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class MasterDatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // =====================================================================
        // UUID CỐ ĐỊNH
        // =====================================================================
        $userId      = 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925'; // Nguyen Van A
        $userId2     = '33333333-3333-3333-3333-333333333333';  // Khách hàng Khách
        $court01     = '1e78caa0-d9db-4e51-bf1b-eb58d3bbf0d5'; // Sân 01
        $court02     = 'b95cc409-3c58-43d6-ae30-c4a37c6e90f6'; // Sân 02
        $court03     = '8ef9d035-7dc8-419b-9d19-6addc9196826'; // Sân 03
        $court04     = 'f078a9d4-780a-444d-b6d6-e803bcd7db3c'; // Sân 04
        $court05     = '71504586-8d59-43ad-ac8f-d40a529651fb'; // Sân 05

        // ID dịch vụ bổ sung
        $svcDen      = '019e2eea-496b-7203-a558-63991dd9cbfa'; // Đèn
        $svcVot1     = 'e16d513f-4ad0-11f1-b356-0250edbfc5ac'; // Thuê vợt Yonex
        $svcVot2     = 'e16d53ad-4ad0-11f1-b356-0250edbfc5ac'; // Thuê vợt Lining
        $svcGiay     = 'e16d542d-4ad0-11f1-b356-0250edbfc5ac'; // Thuê giày
        $svcDanLuoi  = 'e16d5465-4ad0-11f1-b356-0250edbfc5ac'; // Đan lưới

        // ID danh mục
        $catNuoc     = '019e2f03-e4fc-70a8-9dc8-a9440ba74874'; // Nước giải khát
        $catCauLong  = '019e3f04-5e3f-703d-b904-b61b1236bfa3'; // Sản phẩm cầu lông

        // =====================================================================
        // XÓA DỮ LIỆU CŨ
        // =====================================================================
        // =====================================================================
        // TÀI KHOẢN HỆ THỐNG (admin + staff mẫu)
        // =====================================================================
        DB::table('users')->updateOrInsert(
            ['phone' => '0999999999'],
            [
                'id'            => 'aaaaaaaa-0000-0000-0000-000000000001',
                'full_name'     => 'Admin NHBadminton',
                'email'         => 'admin@nhbadminton.vn',
                'phone'         => '0999999999',
                'password_hash' => Hash::make('Admin@123'),
                'role'          => 'admin',
                'status'        => 'active',
                'points'        => 0,
                'total_spent'   => 0,
                'created_at'    => now(),
                'updated_at'    => now(),
            ]
        );

        DB::table('users')->updateOrInsert(
            ['phone' => '0888888888'],
            [
                'id'            => 'bbbbbbbb-0000-0000-0000-000000000002',
                'full_name'     => 'Nhân viên mẫu',
                'email'         => 'staff@nhbadminton.vn',
                'phone'         => '0888888888',
                'password_hash' => Hash::make('Staff@123'),
                'role'          => 'staff',
                'status'        => 'active',
                'points'        => 0,
                'total_spent'   => 0,
                'created_at'    => now(),
                'updated_at'    => now(),
            ]
        );

        Schema::disableForeignKeyConstraints();
        DB::table('booking_service_details')->truncate();
        DB::table('payments')->truncate();
        DB::table('booking_details')->truncate();
        DB::table('bookings')->truncate();
        DB::table('recurring_bookings')->truncate();
        Schema::enableForeignKeyConstraints();

        // =====================================================================
        // SẢN PHẨM MẪU (thêm vào nếu chưa có)
        // =====================================================================
        $existingSkus = DB::table('products')->pluck('sku')->toArray();

        $products = [
            [
                'id'                 => (string) Str::uuid(),
                'category_id'        => $catNuoc,
                'name'               => 'Nước suối Lavie 500ml',
                'sku'                => 'NUOC_LAVIE_500',
                'brand'              => 'Lavie',
                'description'        => 'Nước khoáng thiên nhiên Lavie chai 500ml',
                'selling_price'      => 8000,
                'stock_quantity'     => 200,
                'low_stock_threshold'=> 20,
                'status'             => 'active',
            ],
            [
                'id'                 => (string) Str::uuid(),
                'category_id'        => $catNuoc,
                'name'               => 'Pocari Sweat 330ml',
                'sku'                => 'POCARI_330',
                'brand'              => 'Pocari',
                'description'        => 'Nước uống bổ sung ion Pocari Sweat 330ml',
                'selling_price'      => 15000,
                'stock_quantity'     => 150,
                'low_stock_threshold'=> 15,
                'status'             => 'active',
            ],
            [
                'id'                 => (string) Str::uuid(),
                'category_id'        => $catNuoc,
                'name'               => 'Red Bull lon 250ml',
                'sku'                => 'REDBULL_250',
                'brand'              => 'Red Bull',
                'description'        => 'Nước tăng lực Red Bull lon 250ml',
                'selling_price'      => 18000,
                'stock_quantity'     => 100,
                'low_stock_threshold'=> 10,
                'status'             => 'active',
            ],
            [
                'id'                 => (string) Str::uuid(),
                'category_id'        => $catCauLong,
                'name'               => 'Vợt cầu lông Yonex Astrox 88S',
                'sku'                => 'VOT_YONEX_88S',
                'brand'              => 'Yonex',
                'description'        => 'Vợt cầu lông cao cấp Yonex Astrox 88S, 3U G5',
                'selling_price'      => 2800000,
                'stock_quantity'     => 10,
                'low_stock_threshold'=> 2,
                'status'             => 'active',
            ],
            [
                'id'                 => (string) Str::uuid(),
                'category_id'        => $catCauLong,
                'name'               => 'Vợt cầu lông Lining N90 III',
                'sku'                => 'VOT_LINING_N90',
                'brand'              => 'Li-Ning',
                'description'        => 'Vợt cầu lông Li-Ning N90 III, phiên bản giới hạn',
                'selling_price'      => 3200000,
                'stock_quantity'     => 5,
                'low_stock_threshold'=> 1,
                'status'             => 'active',
            ],
            [
                'id'                 => (string) Str::uuid(),
                'category_id'        => $catCauLong,
                'name'               => 'Dây cước căng vợt BG65',
                'sku'                => 'CUOC_BG65',
                'brand'              => 'Yonex',
                'description'        => 'Dây cước Yonex BG65 dành cho đan lưới vợt',
                'selling_price'      => 120000,
                'stock_quantity'     => 50,
                'low_stock_threshold'=> 5,
                'status'             => 'active',
            ],
        ];

        foreach ($products as $p) {
            if (!in_array($p['sku'], $existingSkus)) {
                DB::table('products')->insert(array_merge($p, ['created_at' => now()]));
            }
        }

        // =====================================================================
        // ĐẶT SÂN VÃNG LAI (SINGLE BOOKINGS)
        // =====================================================================

        // --- Booking 1: Đã hoàn thành, đã thanh toán ---
        $b1 = (string) Str::uuid();
        DB::table('bookings')->insert([
            'id'               => $b1,
            'booking_code'     => 'BILL-VL001',
            'user_id'          => $userId,
            'subtotal_court'   => 120000,
            'subtotal_service' => 50000,
            'total_price'      => 170000,
            'status'           => 'completed',
            'payment_status'   => 'paid',
            'customer_name'    => 'Nguyen Van A',
            'customer_phone'   => '0901234567',
            'check_in_at'      => '2026-06-25 17:05:00',
            'check_out_at'     => '2026-06-25 19:10:00',
            'created_at'       => '2026-06-25 15:00:00',
        ]);
        DB::table('booking_details')->insert([
            'id'               => (string) Str::uuid(),
            'booking_id'       => $b1,
            'court_id'         => $court01,
            'booking_date'     => '2026-06-25',
            'start_time'       => '17:00:00',
            'end_time'         => '19:00:00',
            'duration_minutes' => 120,
            'price_per_hour'   => 60000,
            'price'            => 120000,
        ]);
        DB::table('booking_service_details')->insert([
            'id'          => (string) Str::uuid(),
            'booking_id'  => $b1,
            'service_id'  => $svcVot1,
            'quantity'    => 2,
            'unit_price'  => 25000,
            'total_price' => 50000,
        ]);
        DB::table('payments')->insert([
            'id'             => (string) Str::uuid(),
            'payment_code'   => 'PAY-001',
            'booking_id'     => $b1,
            'user_id'        => $userId,
            'payment_method' => 'cash',
            'amount'         => 170000,
            'paid_at'        => '2026-06-25 19:15:00',
            'status'         => 'success',
        ]);

        // --- Booking 2: Đã xác nhận, chưa thanh toán (khách vãng lai, không đăng nhập) ---
        $b2 = (string) Str::uuid();
        DB::table('bookings')->insert([
            'id'               => $b2,
            'booking_code'     => 'BILL-VL002',
            'user_id'          => null,
            'subtotal_court'   => 90000,
            'total_price'      => 90000,
            'status'           => 'confirmed',
            'payment_status'   => 'unpaid',
            'customer_name'    => 'Tran Thi Bich',
            'customer_phone'   => '0912345678',
            'created_at'       => '2026-06-27 09:00:00',
        ]);
        DB::table('booking_details')->insert([
            'id'               => (string) Str::uuid(),
            'booking_id'       => $b2,
            'court_id'         => $court02,
            'booking_date'     => '2026-06-28',
            'start_time'       => '06:00:00',
            'end_time'         => '07:30:00',
            'duration_minutes' => 90,
            'price_per_hour'   => 60000,
            'price'            => 90000,
        ]);

        // --- Booking 3: Đang chơi, đặt qua tài khoản ---
        $b3 = (string) Str::uuid();
        DB::table('bookings')->insert([
            'id'               => $b3,
            'booking_code'     => 'BILL-VL003',
            'user_id'          => $userId2,
            'subtotal_court'   => 150000,
            'subtotal_service' => 30000,
            'total_price'      => 180000,
            'status'           => 'playing',
            'payment_status'   => 'paid',
            'customer_name'    => 'Khach Hang Khach',
            'customer_phone'   => '0933333333',
            'check_in_at'      => '2026-06-28 08:05:00',
            'created_at'       => '2026-06-28 07:30:00',
        ]);
        DB::table('booking_details')->insert([
            'id'               => (string) Str::uuid(),
            'booking_id'       => $b3,
            'court_id'         => $court03,
            'booking_date'     => '2026-06-28',
            'start_time'       => '08:00:00',
            'end_time'         => '10:30:00',
            'duration_minutes' => 150,
            'price_per_hour'   => 60000,
            'price'            => 150000,
        ]);
        DB::table('booking_service_details')->insert([
            'id'          => (string) Str::uuid(),
            'booking_id'  => $b3,
            'service_id'  => $svcDen,
            'quantity'    => 3,
            'unit_price'  => 10000,
            'total_price' => 30000,
            'note'        => '3 đèn bàn',
        ]);
        DB::table('payments')->insert([
            'id'             => (string) Str::uuid(),
            'payment_code'   => 'PAY-003',
            'booking_id'     => $b3,
            'user_id'        => $userId2,
            'payment_method' => 'bank_transfer',
            'amount'         => 180000,
            'paid_at'        => '2026-06-28 08:00:00',
            'status'         => 'success',
        ]);

        // --- Booking 4: Chờ xác nhận, tương lai ---
        $b4 = (string) Str::uuid();
        DB::table('bookings')->insert([
            'id'               => $b4,
            'booking_code'     => 'BILL-VL004',
            'user_id'          => $userId,
            'subtotal_court'   => 120000,
            'total_price'      => 120000,
            'status'           => 'confirmed',
            'payment_status'   => 'unpaid',
            'customer_name'    => 'Nguyen Van A',
            'customer_phone'   => '0901234567',
            'created_at'       => '2026-06-28 10:00:00',
        ]);
        DB::table('booking_details')->insert([
            'id'               => (string) Str::uuid(),
            'booking_id'       => $b4,
            'court_id'         => $court04,
            'booking_date'     => '2026-07-02',
            'start_time'       => '19:00:00',
            'end_time'         => '21:00:00',
            'duration_minutes' => 120,
            'price_per_hour'   => 60000,
            'price'            => 120000,
        ]);

        // --- Booking 5: Hoàn thành, đặt hôm trước ---
        $b5 = (string) Str::uuid();
        DB::table('bookings')->insert([
            'id'               => $b5,
            'booking_code'     => 'BILL-VL005',
            'user_id'          => null,
            'subtotal_court'   => 60000,
            'subtotal_service' => 30000,
            'total_price'      => 90000,
            'status'           => 'completed',
            'payment_status'   => 'paid',
            'customer_name'    => 'Le Van Cuong',
            'customer_phone'   => '0977123456',
            'check_in_at'      => '2026-07-01 05:05:00',
            'check_out_at'     => '2026-07-01 06:05:00',
            'created_at'       => '2026-06-30 20:00:00',
        ]);
        DB::table('booking_details')->insert([
            'id'               => (string) Str::uuid(),
            'booking_id'       => $b5,
            'court_id'         => $court05,
            'booking_date'     => '2026-07-01',
            'start_time'       => '05:00:00',
            'end_time'         => '06:00:00',
            'duration_minutes' => 60,
            'price_per_hour'   => 60000,
            'price'            => 60000,
        ]);
        DB::table('booking_service_details')->insert([
            'id'          => (string) Str::uuid(),
            'booking_id'  => $b5,
            'service_id'  => $svcGiay,
            'quantity'    => 1,
            'unit_price'  => 30000,
            'total_price' => 30000,
        ]);
        DB::table('payments')->insert([
            'id'             => (string) Str::uuid(),
            'payment_code'   => 'PAY-005',
            'booking_id'     => $b5,
            'user_id'        => null,
            'payment_method' => 'cash',
            'amount'         => 90000,
            'paid_at'        => '2026-07-01 06:10:00',
            'status'         => 'success',
        ]);

        // --- Booking 6: Sắp tới, ngày 10/7 ---
        $b6 = (string) Str::uuid();
        DB::table('bookings')->insert([
            'id'               => $b6,
            'booking_code'     => 'BILL-VL006',
            'user_id'          => $userId,
            'subtotal_court'   => 180000,
            'subtotal_service' => 80000,
            'total_price'      => 260000,
            'status'           => 'confirmed',
            'payment_status'   => 'partial',
            'deposit_amount'   => 100000,
            'remaining_amount' => 160000,
            'customer_name'    => 'Nguyen Van A',
            'customer_phone'   => '0901234567',
            'created_at'       => '2026-07-05 08:00:00',
        ]);
        DB::table('booking_details')->insert([
            'id'               => (string) Str::uuid(),
            'booking_id'       => $b6,
            'court_id'         => $court01,
            'booking_date'     => '2026-07-10',
            'start_time'       => '08:00:00',
            'end_time'         => '11:00:00',
            'duration_minutes' => 180,
            'price_per_hour'   => 60000,
            'price'            => 180000,
        ]);
        DB::table('booking_service_details')->insert([
            'id'          => (string) Str::uuid(),
            'booking_id'  => $b6,
            'service_id'  => $svcVot2,
            'quantity'    => 1,
            'unit_price'  => 50000,
            'total_price' => 50000,
        ]);
        DB::table('booking_service_details')->insert([
            'id'          => (string) Str::uuid(),
            'booking_id'  => $b6,
            'service_id'  => $svcDanLuoi,
            'quantity'    => 1,
            'unit_price'  => 80000,
            'total_price' => 80000,
            'note'        => 'Cang BG65 24lbs',
        ]);
        DB::table('payments')->insert([
            'id'             => (string) Str::uuid(),
            'payment_code'   => 'PAY-006',
            'booking_id'     => $b6,
            'user_id'        => $userId,
            'payment_method' => 'bank_transfer',
            'amount'         => 100000,
            'paid_at'        => '2026-07-05 08:05:00',
            'status'         => 'success',
            'payment_content'=> 'Coc dat san BILL-VL006',
        ]);

        // =====================================================================
        // ĐẶT SÂN ĐỊNH KỲ (RECURRING BOOKINGS - type = 'recurring')
        // =====================================================================

        // --- Recurring 1: Thứ 2, 4, 6 hàng tuần, sân 01 ---
        $rec1 = (string) Str::uuid();
        DB::table('recurring_bookings')->insert([
            'id'           => $rec1,
            'user_id'      => $userId,
            'court_id'     => $court01,
            'recurring_code'=> 'REC-DK001',
            'days_of_week' => json_encode([2, 4, 6]),
            'start_time'   => '19:00:00',
            'end_time'     => '21:00:00',
            'start_date'   => '2026-06-22',
            'end_date'     => '2026-07-10',
            'status'       => 'active',
            'type'         => 'recurring',
        ]);

        // Tạo booking_details cho các ngày khớp (thứ 2/4/6 từ 22/6 → 10/7)
        $recDates1 = ['2026-06-22', '2026-06-24', '2026-06-26', '2026-06-29', '2026-07-01', '2026-07-03', '2026-07-06', '2026-07-08', '2026-07-10'];
        foreach ($recDates1 as $idx => $date) {
            $rb = (string) Str::uuid();
            $isPast = strtotime($date) < strtotime('2026-06-28');
            DB::table('bookings')->insert([
                'id'                   => $rb,
                'booking_code'         => 'BILL-REC1-' . str_pad($idx + 1, 2, '0', STR_PAD_LEFT),
                'user_id'              => $userId,
                'recurring_booking_id' => $rec1,
                'subtotal_court'       => 120000,
                'total_price'          => 120000,
                'status'               => $isPast ? 'completed' : 'confirmed',
                'payment_status'       => $isPast ? 'paid' : 'unpaid',
                'customer_name'        => 'Nguyen Van A',
                'customer_phone'       => '0901234567',
                'check_in_at'          => $isPast ? $date . ' 19:05:00' : null,
                'check_out_at'         => $isPast ? $date . ' 21:10:00' : null,
                'created_at'           => '2026-06-20 10:00:00',
            ]);
            DB::table('booking_details')->insert([
                'id'               => (string) Str::uuid(),
                'booking_id'       => $rb,
                'court_id'         => $court01,
                'booking_date'     => $date,
                'start_time'       => '19:00:00',
                'end_time'         => '21:00:00',
                'duration_minutes' => 120,
                'price_per_hour'   => 60000,
                'price'            => 120000,
            ]);
            if ($isPast) {
                DB::table('payments')->insert([
                    'id'             => (string) Str::uuid(),
                    'payment_code'   => 'PAY-REC1-' . str_pad($idx + 1, 2, '0', STR_PAD_LEFT),
                    'booking_id'     => $rb,
                    'user_id'        => $userId,
                    'payment_method' => 'cash',
                    'amount'         => 120000,
                    'paid_at'        => $date . ' 21:15:00',
                    'status'         => 'success',
                ]);
            }
        }

        // --- Recurring 2: Cuối tuần (thứ 7, chủ nhật), sân 02 ---
        $rec2 = (string) Str::uuid();
        DB::table('recurring_bookings')->insert([
            'id'            => $rec2,
            'user_id'       => $userId2,
            'court_id'      => $court02,
            'recurring_code'=> 'REC-DK002',
            'days_of_week'  => json_encode([7, 1]), // 7=thứ 7, 1=chủ nhật
            'start_time'    => '06:00:00',
            'end_time'      => '08:00:00',
            'start_date'    => '2026-06-28',
            'end_date'      => '2026-07-10',
            'status'        => 'active',
            'type'          => 'recurring',
        ]);
        $recDates2 = ['2026-06-28', '2026-06-29', '2026-07-05', '2026-07-06'];
        foreach ($recDates2 as $idx => $date) {
            $rb2 = (string) Str::uuid();
            DB::table('bookings')->insert([
                'id'                   => $rb2,
                'booking_code'         => 'BILL-REC2-' . str_pad($idx + 1, 2, '0', STR_PAD_LEFT),
                'user_id'              => $userId2,
                'recurring_booking_id' => $rec2,
                'subtotal_court'       => 120000,
                'total_price'          => 120000,
                'status'               => 'confirmed',
                'payment_status'       => 'unpaid',
                'customer_name'        => 'Khach Hang Khach',
                'customer_phone'       => '0933333333',
                'created_at'           => '2026-06-26 09:00:00',
            ]);
            DB::table('booking_details')->insert([
                'id'               => (string) Str::uuid(),
                'booking_id'       => $rb2,
                'court_id'         => $court02,
                'booking_date'     => $date,
                'start_time'       => '06:00:00',
                'end_time'         => '08:00:00',
                'duration_minutes' => 120,
                'price_per_hour'   => 60000,
                'price'            => 120000,
            ]);
        }

        // =====================================================================
        // ĐẶT SÂN DÀI HẠN (LONG-TERM BOOKINGS - type = 'long_term')
        // =====================================================================

        // --- Long-term 1: Các ngày cụ thể từ 23/6 → 9/7 (thứ 3, 5), sân 03 ---
        $lt1 = (string) Str::uuid();
        DB::table('recurring_bookings')->insert([
            'id'            => $lt1,
            'user_id'       => $userId,
            'court_id'      => $court03,
            'recurring_code'=> 'LT-DH001',
            'days_of_week'  => json_encode([3, 5]), // lưu pattern gốc (thứ 3, thứ 5)
            'start_time'    => '17:00:00',
            'end_time'      => '19:00:00',
            'start_date'    => '2026-06-23',
            'end_date'      => '2026-07-09',
            'status'        => 'active',
            'type'          => 'long_term',
        ]);
        $ltDates1 = ['2026-06-23', '2026-06-25', '2026-06-30', '2026-07-02', '2026-07-07', '2026-07-09'];
        foreach ($ltDates1 as $idx => $date) {
            $ltb = (string) Str::uuid();
            $isPast = strtotime($date) < strtotime('2026-06-28');
            DB::table('bookings')->insert([
                'id'                   => $ltb,
                'booking_code'         => 'BILL-LT1-' . str_pad($idx + 1, 2, '0', STR_PAD_LEFT),
                'user_id'              => $userId,
                'recurring_booking_id' => $lt1,
                'subtotal_court'       => 120000,
                'subtotal_service'     => $isPast ? 20000 : null,
                'total_price'          => $isPast ? 140000 : 120000,
                'status'               => $isPast ? 'completed' : 'confirmed',
                'payment_status'       => $isPast ? 'paid' : 'unpaid',
                'customer_name'        => 'Nguyen Van A',
                'customer_phone'       => '0901234567',
                'check_in_at'          => $isPast ? $date . ' 17:05:00' : null,
                'check_out_at'         => $isPast ? $date . ' 19:10:00' : null,
                'created_at'           => '2026-06-20 14:00:00',
            ]);
            DB::table('booking_details')->insert([
                'id'               => (string) Str::uuid(),
                'booking_id'       => $ltb,
                'court_id'         => $court03,
                'booking_date'     => $date,
                'start_time'       => '17:00:00',
                'end_time'         => '19:00:00',
                'duration_minutes' => 120,
                'price_per_hour'   => 60000,
                'price'            => 120000,
            ]);
            if ($isPast) {
                DB::table('booking_service_details')->insert([
                    'id'          => (string) Str::uuid(),
                    'booking_id'  => $ltb,
                    'service_id'  => $svcDen,
                    'quantity'    => 2,
                    'unit_price'  => 10000,
                    'total_price' => 20000,
                ]);
                DB::table('payments')->insert([
                    'id'             => (string) Str::uuid(),
                    'payment_code'   => 'PAY-LT1-' . str_pad($idx + 1, 2, '0', STR_PAD_LEFT),
                    'booking_id'     => $ltb,
                    'user_id'        => $userId,
                    'payment_method' => 'cash',
                    'amount'         => 140000,
                    'paid_at'        => $date . ' 19:20:00',
                    'status'         => 'success',
                ]);
            }
        }

        // --- Long-term 2: Hợp đồng tuần - sân 04, ngày cụ thể từ 1/7 → 10/7 ---
        $lt2 = (string) Str::uuid();
        DB::table('recurring_bookings')->insert([
            'id'            => $lt2,
            'user_id'       => null,
            'court_id'      => $court04,
            'recurring_code'=> 'LT-DH002',
            'days_of_week'  => json_encode([2, 4, 6]),
            'start_time'    => '20:00:00',
            'end_time'      => '22:00:00',
            'start_date'    => '2026-07-01',
            'end_date'      => '2026-07-10',
            'status'        => 'active',
            'type'          => 'long_term',
        ]);
        $ltDates2 = ['2026-07-01', '2026-07-03', '2026-07-06', '2026-07-08', '2026-07-10'];
        foreach ($ltDates2 as $idx => $date) {
            $ltb2 = (string) Str::uuid();
            DB::table('bookings')->insert([
                'id'                   => $ltb2,
                'booking_code'         => 'BILL-LT2-' . str_pad($idx + 1, 2, '0', STR_PAD_LEFT),
                'user_id'              => null,
                'recurring_booking_id' => $lt2,
                'subtotal_court'       => 120000,
                'total_price'          => 120000,
                'status'               => 'confirmed',
                'payment_status'       => 'unpaid',
                'customer_name'        => 'Cong Ty TNHH ABC',
                'customer_phone'       => '0288123456',
                'created_at'           => '2026-06-28 11:00:00',
            ]);
            DB::table('booking_details')->insert([
                'id'               => (string) Str::uuid(),
                'booking_id'       => $ltb2,
                'court_id'         => $court04,
                'booking_date'     => $date,
                'start_time'       => '20:00:00',
                'end_time'         => '22:00:00',
                'duration_minutes' => 120,
                'price_per_hour'   => 60000,
                'price'            => 120000,
            ]);
        }

        $this->command->info('✓ Đã seed thành công:');
        $this->command->info('  - ' . count($products) . ' sản phẩm mẫu (bỏ qua nếu SKU đã tồn tại)');
        $this->command->info('  - 6 đơn đặt vãng lai (single)');
        $this->command->info('  - 2 lịch định kỳ (recurring) với ' . (count($recDates1) + count($recDates2)) . ' buổi');
        $this->command->info('  - 2 lịch dài hạn (long_term) với ' . (count($ltDates1) + count($ltDates2)) . ' buổi');
        $this->command->info('  - Tất cả ngày đặt tối đa đến 10/07/2026');
    }
}
