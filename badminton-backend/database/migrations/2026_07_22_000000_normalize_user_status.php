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

        DB::statement("ALTER TABLE users MODIFY status ENUM('active','inactive','banned','blocked') NOT NULL DEFAULT 'active'");
        DB::table('users')->whereIn('status', ['inactive', 'banned'])->update(['status' => 'blocked']);
        DB::statement("ALTER TABLE users MODIFY status ENUM('active','blocked') NOT NULL DEFAULT 'active' COMMENT 'Trang thai tai khoan: active = hoat dong, blocked = bi khoa'");
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::statement("ALTER TABLE users MODIFY status ENUM('active','inactive','banned','blocked') NOT NULL DEFAULT 'active'");
        DB::table('users')->where('status', 'blocked')->update(['status' => 'inactive']);
        DB::statement("ALTER TABLE users MODIFY status ENUM('active','inactive','banned') NOT NULL DEFAULT 'active'");
    }
};
