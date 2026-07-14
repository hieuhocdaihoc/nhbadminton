<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('system_settings')
            ->where('setting_key', 'deposit_amount')
            ->update(['setting_key' => 'deposit_percent', 'setting_value' => '20']);
    }

    public function down(): void
    {
        DB::table('system_settings')
            ->where('setting_key', 'deposit_percent')
            ->update(['setting_key' => 'deposit_amount', 'setting_value' => '10000']);
    }
};
