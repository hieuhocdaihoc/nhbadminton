<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('courts', 'is_contract_only')) {
            Schema::table('courts', function (Blueprint $table) {
                $table->boolean('is_contract_only')->default(false)->after('is_maintenance');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('courts', 'is_contract_only')) {
            Schema::table('courts', fn (Blueprint $table) => $table->dropColumn('is_contract_only'));
        }
    }
};
