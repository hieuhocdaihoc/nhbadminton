<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Unique constraint already included in base migration — skip if index exists
        $hasIndex = collect(Schema::getIndexes('reviews'))
            ->contains(fn (array $index) => $index['name'] === 'reviews_unique_per_booking_court');

        if (!$hasIndex) {
            Schema::table('reviews', function (Blueprint $table) {
                $table->unique(
                    ['user_id', 'booking_id', 'target_type', 'target_id'],
                    'reviews_unique_per_booking_court'
                );
            });
        }
    }

    public function down(): void
    {
        Schema::table('reviews', function (Blueprint $table) {
            $table->dropUnique('reviews_unique_per_booking_court');
        });
    }
};
