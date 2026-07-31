<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ── 1. Gói thành viên (admin tạo, khách mua)
        Schema::create('membership_packages', function (Blueprint $table) {
            $table->uuid('id')->primary()->comment('Mã gói thành viên');
            $table->string('name', 100)->comment('Tên gói (VD: Gói 30 ca/tháng)');
            $table->text('description')->nullable()->comment('Mô tả gói');
            $table->unsignedInteger('total_sessions')->comment('Số ca trong gói (1 ca = 1 giờ)');
            $table->unsignedInteger('duration_days')->comment('Thời hạn sử dụng tính bằng ngày');
            $table->decimal('price', 12, 2)->comment('Giá gói (tổng tiền khách phải trả)');
            $table->decimal('price_per_session', 12, 2)->comment('Giá ưu đãi mỗi ca khi dùng thẻ (VD: 50.000đ/giờ)');
            $table->enum('status', ['active', 'inactive'])->default('active')->comment('Trạng thái gói: đang bán / ngưng bán');
            $table->timestamps();
        });

        // ── 2. Thẻ thành viên (1 khách chỉ có 1 thẻ active tại 1 thời điểm)
        Schema::create('membership_cards', function (Blueprint $table) {
            $table->uuid('id')->primary()->comment('Mã thẻ thành viên');
            $table->string('card_code', 30)->unique()->comment('Mã thẻ hiển thị (VD: CARD-2026-001)');
            $table->uuid('user_id')->comment('Khách hàng sở hữu thẻ');
            $table->uuid('package_id')->comment('Gói thành viên đã mua');
            $table->unsignedInteger('total_sessions')->comment('Tổng số ca của thẻ (copy từ gói lúc mua)');
            $table->unsignedInteger('used_sessions')->default(0)->comment('Số ca đã sử dụng');
            $table->date('valid_from')->comment('Ngày bắt đầu hiệu lực');
            $table->date('valid_to')->comment('Ngày hết hạn');
            $table->decimal('price', 12, 2)->comment('Số tiền khách đã thanh toán cho thẻ này');
            $table->decimal('price_per_session', 12, 2)->comment('Giá ưu đãi/giờ khi dùng thẻ (copy từ gói)');
            $table->enum('status', ['pending_payment', 'active', 'expired', 'depleted', 'cancelled'])
                ->default('pending_payment')
                ->comment('pending_payment=chờ TT / active=đang dùng / expired=hết hạn / depleted=hết ca / cancelled=hủy');
            $table->uuid('created_by')->nullable()->comment('Nhân viên tạo thẻ (null nếu mua online)');
            $table->text('note')->nullable()->comment('Ghi chú nội bộ');
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('package_id')->references('id')->on('membership_packages');
            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
        });

        // ── 3. Lịch sử sử dụng ca (trừ khi hoàn thành buổi chơi)
        Schema::create('membership_card_usages', function (Blueprint $table) {
            $table->uuid('id')->primary()->comment('Mã bản ghi sử dụng');
            $table->uuid('card_id')->nullable()->comment('Thẻ bị trừ ca');
            $table->uuid('booking_id')->comment('Đơn đặt sân tương ứng');
            $table->unsignedInteger('sessions_deducted')->default(1)->comment('Số ca bị trừ (= số giờ chơi)');
            $table->timestamp('used_at')->useCurrent()->comment('Thời điểm trừ ca (khi admin hoàn thành đơn)');
            $table->string('note', 255)->nullable()->comment('Ghi chú (VD: Sân 01 17:00-19:00)');

            $table->foreign('card_id')->references('id')->on('membership_cards')->nullOnDelete();
            $table->foreign('booking_id')->references('id')->on('bookings')->cascadeOnDelete();
        });

        // ── 4. Thêm cột vào bookings
        Schema::table('bookings', function (Blueprint $table) {
            $table->uuid('membership_card_id')->nullable()->after('promotion_id');
            $table->unsignedTinyInteger('card_sessions_planned')->nullable()->after('membership_card_id');
            $table->foreign('membership_card_id')->references('id')->on('membership_cards')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropForeign(['membership_card_id']);
            $table->dropColumn(['card_sessions_planned', 'membership_card_id']);
        });
        Schema::dropIfExists('membership_card_usages');
        Schema::dropIfExists('membership_cards');
        Schema::dropIfExists('membership_packages');
    }
};
