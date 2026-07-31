<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. court_pricing: xoá bản ghi trùng, giữ 1 bản ghi đại diện mỗi khung giờ
        $keepIds = DB::table('court_pricing')
            ->select(DB::raw('MIN(id) as id'))
            ->groupBy('day_type', 'start_time', 'end_time', 'effective_from', 'effective_to')
            ->pluck('id');

        DB::table('court_pricing')->whereNotIn('id', $keepIds)->delete();

        // 2. court_price_history: xoá bản ghi trùng (cùng thao tác ghi cho nhiều sân)
        $keepHistIds = DB::table('court_price_histories')
            ->select(DB::raw('MIN(id) as id'))
            ->groupBy('court_pricing_id', 'action', 'note', 'new_price', 'changed_by')
            ->pluck('id');

        DB::table('court_price_histories')->whereNotIn('id', $keepHistIds)->delete();

        // 3. Xoá cột court_id khỏi court_pricing
        $this->dropCourtId('court_pricing');

        // 4. Xoá cột court_id khỏi court_price_histories
        $this->dropCourtId('court_price_histories');
    }

    public function down(): void
    {
        // Không hỗ trợ rollback — thêm lại court_id sẽ mất liên kết với dữ liệu gốc
    }

    private function dropCourtId(string $tableName): void
    {
        if (!Schema::hasColumn($tableName, 'court_id')) {
            return;
        }

        if (DB::getDriverName() === 'mysql') {
            try {
                DB::statement("ALTER TABLE `$tableName` DROP FOREIGN KEY `{$tableName}_court_id_foreign`");
            } catch (\Throwable) {
            }

            DB::statement("ALTER TABLE `$tableName` DROP COLUMN `court_id`");
            return;
        }

        $courtIndex = collect(Schema::getIndexes($tableName))
            ->first(fn (array $index) => $index['columns'] === ['court_id']);

        if ($courtIndex) {
            Schema::table($tableName, fn (Blueprint $table) => $table->dropIndex($courtIndex['name']));
        }

        Schema::table($tableName, function (Blueprint $table) {
            $table->dropForeign(['court_id']);
            $table->dropColumn('court_id');
        });
    }
};
