<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $tables = [
            'bookings'           => ['created_at', 'updated_at'],
            'recurring_bookings' => ['created_at', 'updated_at'],
            'payments'           => ['created_at', 'updated_at'],
            'reviews'            => ['created_at', 'updated_at'],
            'notifications'      => ['created_at', 'updated_at'],
            'court_pricing'      => ['created_at', 'updated_at'],
            'additional_services'=> ['created_at', 'updated_at'],
        ];

        foreach ($tables as $table => $cols) {
            Schema::table($table, function (Blueprint $t) use ($cols) {
                foreach ($cols as $col) {
                    if (!Schema::hasColumn($t->getTable(), $col)) {
                        if ($col === 'created_at') {
                            $t->timestamp('created_at')->nullable();
                        } else {
                            $t->timestamp('updated_at')->nullable();
                        }
                    }
                }
            });
        }
    }

    public function down(): void {}
};
