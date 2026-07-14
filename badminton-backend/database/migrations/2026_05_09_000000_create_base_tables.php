<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::disableForeignKeyConstraints();

        // 1. users
        Schema::create('users', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->string('full_name', 100);
            $table->string('email', 150)->unique();
            $table->string('phone', 20)->nullable()->unique();
            $table->string('password_hash', 255)->nullable();
            $table->enum('role', ['admin', 'staff', 'customer'])->default('customer');
            $table->enum('gender', ['male', 'female', 'other'])->nullable();
            $table->date('date_of_birth')->nullable();
            $table->string('customer_code', 20)->nullable()->unique();
            $table->string('membership_level', 20)->default('bronze');
            $table->integer('points')->default(0);
            $table->decimal('total_spent', 15, 2)->default(0);
            $table->enum('status', ['active', 'inactive', 'banned'])->default('active');
            $table->timestamps();
        });

        // 2. courts
        Schema::create('courts', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->string('name', 100);
            $table->string('court_code', 20)->unique();
            $table->string('floor_type', 50)->nullable();
            $table->boolean('has_lighting')->default(true);
            $table->integer('capacity')->nullable();
            $table->string('location_note', 255)->nullable();
            $table->boolean('is_maintenance')->default(false);
            $table->enum('status', ['active', 'inactive'])->default('active');
        });

        // 3. images
        Schema::create('images', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->text('url');
            $table->string('alt_text', 255)->nullable();
            $table->string('target_type', 50)->nullable();
            $table->char('target_id', 36)->nullable();
            $table->integer('sort_order')->default(0);
            $table->boolean('is_primary')->default(false);
        });

        // 4. additional_services
        Schema::create('additional_services', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->string('name', 100);
            $table->string('service_type', 50)->nullable();
            $table->text('description')->nullable();
            $table->decimal('price', 12, 2)->default(0);
            $table->string('unit', 30)->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
        });

        // 5. categories
        Schema::create('categories', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->string('name', 100);
            $table->text('description')->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
        });

        // 6. suppliers
        Schema::create('suppliers', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->string('name', 150);
            $table->string('phone', 20)->nullable();
            $table->string('email', 150)->nullable();
            $table->string('address', 255)->nullable();
            $table->string('contact_person', 100)->nullable();
        });

        // 7. products
        Schema::create('products', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('category_id', 36)->nullable();
            $table->string('brand', 100)->nullable();
            $table->string('name', 150);
            $table->string('sku', 50)->nullable()->unique();
            $table->text('description')->nullable();
            $table->text('short_description')->nullable();
            $table->string('material', 100)->nullable();
            $table->string('origin', 100)->nullable();
            $table->integer('sold_count')->default(0);
            $table->integer('stock_quantity')->default(0);
            $table->integer('low_stock_threshold')->default(5);
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->decimal('selling_price', 12, 2)->default(0);
            $table->timestamps();

            $table->foreign('category_id')->references('id')->on('categories')->nullOnDelete();
        });

        // 8. promotions (includes valid_from, valid_to, auto_apply, description from later migration)
        Schema::create('promotions', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->string('code', 50)->unique();
            $table->string('name', 150);
            $table->enum('discount_type', ['percent', 'fixed'])->default('percent');
            $table->decimal('discount_value', 12, 2)->default(0);
            $table->integer('per_user_limit')->nullable();
            $table->integer('min_points_required')->default(0);
            $table->date('valid_from')->nullable();
            $table->date('valid_to')->nullable();
            $table->boolean('auto_apply')->default(false);
            $table->string('description', 255)->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
        });

        // 9. system_settings
        Schema::create('system_settings', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->string('setting_key', 100)->unique();
            $table->text('setting_value')->nullable();
        });

        // 10. recurring_bookings (includes days_of_week as json and type from later migrations)
        Schema::create('recurring_bookings', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('user_id', 36)->nullable();
            $table->char('court_id', 36)->nullable();
            $table->string('recurring_code', 30)->unique();
            $table->json('days_of_week')->nullable();
            $table->time('start_time');
            $table->time('end_time');
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->enum('status', ['active', 'inactive', 'cancelled'])->default('active');
            $table->enum('type', ['recurring', 'long_term'])->default('recurring');

            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
            $table->foreign('court_id')->references('id')->on('courts')->nullOnDelete();
        });

        // 11. bookings (includes points_awarded_at and playing status from later migrations)
        Schema::create('bookings', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->string('booking_code', 30)->unique();
            $table->char('user_id', 36)->nullable();
            $table->char('recurring_booking_id', 36)->nullable();
            $table->char('staff_id', 36)->nullable();
            $table->char('promotion_id', 36)->nullable();
            $table->decimal('subtotal_court', 12, 2)->default(0);
            $table->decimal('subtotal_service', 12, 2)->default(0);
            $table->decimal('discount_amount', 12, 2)->default(0);
            $table->decimal('total_price', 12, 2)->default(0);
            $table->decimal('deposit_amount', 12, 2)->default(0);
            $table->decimal('remaining_amount', 12, 2)->default(0);
            $table->string('customer_name', 100)->nullable();
            $table->string('customer_phone', 20)->nullable();
            $table->dateTime('check_in_at')->nullable();
            $table->dateTime('check_out_at')->nullable();
            $table->enum('status', ['confirmed', 'completed', 'cancelled', 'playing'])->default('confirmed');
            $table->enum('payment_status', ['unpaid', 'partial', 'paid'])->default('unpaid');
            $table->dateTime('points_awarded_at')->nullable();

            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
            $table->foreign('recurring_booking_id')->references('id')->on('recurring_bookings')->nullOnDelete();
            $table->foreign('staff_id')->references('id')->on('users')->nullOnDelete();
            $table->foreign('promotion_id')->references('id')->on('promotions')->nullOnDelete();
        });

        // 12. booking_details
        Schema::create('booking_details', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('booking_id', 36)->nullable();
            $table->char('court_id', 36)->nullable();
            $table->date('booking_date');
            $table->time('start_time');
            $table->time('end_time');
            $table->integer('duration_minutes')->default(0);
            $table->decimal('price_per_hour', 12, 2)->default(0);
            $table->decimal('price', 12, 2)->default(0);
            $table->integer('overtime_minutes')->default(0);
            $table->decimal('overtime_fee', 12, 2)->default(0);

            $table->foreign('booking_id')->references('id')->on('bookings')->cascadeOnDelete();
            $table->foreign('court_id')->references('id')->on('courts')->nullOnDelete();
        });

        // 13. booking_service_details
        Schema::create('booking_service_details', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('booking_id', 36)->nullable();
            $table->char('service_id', 36)->nullable();
            $table->char('product_id', 36)->nullable();
            $table->integer('quantity')->default(1);
            $table->decimal('unit_price', 12, 2)->default(0);
            $table->decimal('total_price', 12, 2)->default(0);
            $table->string('note', 255)->nullable();

            $table->foreign('booking_id')->references('id')->on('bookings')->cascadeOnDelete();
            $table->foreign('service_id')->references('id')->on('additional_services')->nullOnDelete();
            $table->foreign('product_id')->references('id')->on('products')->nullOnDelete();
        });

        // 14. booking_intents
        Schema::create('booking_intents', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->string('intent_code', 20)->unique();
            $table->json('payload');
            $table->decimal('amount', 12, 2);
            $table->string('booking_type', 20);
            $table->timestamp('expires_at');
            $table->timestamps();
        });

        // 15. payments
        Schema::create('payments', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->string('payment_code', 50)->nullable()->unique();
            $table->char('booking_id', 36)->nullable();
            $table->char('user_id', 36)->nullable();
            $table->string('payment_method', 50)->nullable();
            $table->decimal('amount', 12, 2)->default(0);
            $table->dateTime('paid_at')->nullable();
            $table->enum('status', ['pending', 'completed', 'failed', 'refunded'])->default('pending');
            $table->string('sepay_transaction_id', 100)->nullable();
            $table->string('bank_gateway', 50)->nullable();
            $table->string('reference_code', 100)->nullable();
            $table->string('payment_content', 255)->nullable();

            $table->foreign('booking_id')->references('id')->on('bookings')->nullOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
        });

        // 16. refunds (includes refund_method, refund_info, created_at from later migration)
        Schema::create('refunds', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('payment_id', 36)->nullable();
            $table->decimal('amount', 12, 2)->default(0);
            $table->text('reason')->nullable();
            $table->string('refund_method', 30)->default('cash');
            $table->string('refund_info', 255)->nullable();
            $table->char('processed_by', 36)->nullable();
            $table->enum('status', ['pending', 'completed', 'rejected'])->default('pending');
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('payment_id')->references('id')->on('payments')->nullOnDelete();
            $table->foreign('processed_by')->references('id')->on('users')->nullOnDelete();
        });

        // 17. reviews (includes status and unique constraint from later migrations)
        Schema::create('reviews', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('user_id', 36)->nullable();
            $table->string('target_type', 50)->nullable();
            $table->char('target_id', 36)->nullable();
            $table->char('booking_id', 36)->nullable();
            $table->tinyInteger('rating')->default(5);
            $table->text('comment')->nullable();
            $table->text('staff_reply')->nullable();
            $table->string('status', 50)->default('approved');

            $table->unique(
                ['user_id', 'booking_id', 'target_type', 'target_id'],
                'reviews_unique_per_booking_court'
            );

            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
            $table->foreign('booking_id')->references('id')->on('bookings')->nullOnDelete();
        });

        // 18. notifications (includes group_key from later migration)
        Schema::create('notifications', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('receiver_id', 36)->nullable();
            $table->char('sender_id', 36)->nullable();
            $table->string('title', 255)->nullable();
            $table->text('content')->nullable();
            $table->boolean('is_read')->default(false);
            $table->timestamp('created_at')->useCurrent();
            $table->string('group_key', 64)->nullable()->index();

            $table->foreign('receiver_id')->references('id')->on('users')->nullOnDelete();
            $table->foreign('sender_id')->references('id')->on('users')->nullOnDelete();
        });

        // 19. court_pricing
        Schema::create('court_pricing', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('court_id', 36)->nullable();
            $table->string('day_type', 30)->nullable();
            $table->time('start_time');
            $table->time('end_time');
            $table->decimal('price', 12, 2)->default(0);
            $table->date('effective_from')->nullable();
            $table->date('effective_to')->nullable();
            $table->integer('min_booking_minutes')->default(60);

            $table->foreign('court_id')->references('id')->on('courts')->cascadeOnDelete();
        });

        // 20. court_price_histories
        Schema::create('court_price_histories', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('court_pricing_id', 36)->nullable();
            $table->char('court_id', 36)->nullable();
            $table->decimal('old_price', 12, 2)->nullable();
            $table->decimal('new_price', 12, 2)->nullable();
            $table->string('action', 20)->default('update');
            $table->string('note', 255)->nullable();
            $table->char('changed_by', 36)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index('court_id');
            $table->index('court_pricing_id');

            $table->foreign('court_id')->references('id')->on('courts')->nullOnDelete();
            $table->foreign('changed_by')->references('id')->on('users')->nullOnDelete();
        });

        // 21. Staff_Shifts
        Schema::create('Staff_Shifts', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('staff_id', 36)->nullable();
            $table->date('shift_date');
            $table->string('shift_name', 50)->nullable();
            $table->time('start_time');
            $table->time('end_time');
            $table->dateTime('check_in_time')->nullable();
            $table->dateTime('check_out_time')->nullable();
            $table->string('status', 30)->default('scheduled');
            $table->text('note')->nullable();

            $table->foreign('staff_id')->references('id')->on('users')->nullOnDelete();
        });

        // 22. inventory_transactions
        Schema::create('inventory_transactions', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('product_id', 36)->nullable();
            $table->string('transaction_type', 30);
            $table->integer('quantity')->default(0);
            $table->integer('before_quantity')->default(0);
            $table->integer('after_quantity')->default(0);
            $table->string('reference_type', 50)->nullable();
            $table->char('reference_id', 36)->nullable();
            $table->text('note')->nullable();
            $table->char('created_by', 36)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('product_id')->references('id')->on('products')->nullOnDelete();
            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
        });

        // 23. purchase_orders
        Schema::create('purchase_orders', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('supplier_id', 36)->nullable();
            $table->string('purchase_code', 30)->unique();
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->enum('status', ['draft', 'confirmed', 'received', 'cancelled'])->default('draft');
            $table->char('created_by', 36)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('supplier_id')->references('id')->on('suppliers')->nullOnDelete();
            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
        });

        // 24. purchase_order_details
        Schema::create('purchase_order_details', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('purchase_order_id', 36)->nullable();
            $table->char('product_id', 36)->nullable();
            $table->integer('quantity')->default(1);
            $table->decimal('import_price', 12, 2)->default(0);
            $table->decimal('total_price', 12, 2)->default(0);

            $table->foreign('purchase_order_id')->references('id')->on('purchase_orders')->cascadeOnDelete();
            $table->foreign('product_id')->references('id')->on('products')->nullOnDelete();
        });

        // 25. user_addresses
        Schema::create('user_addresses', function (Blueprint $table) {
            $table->char('id', 36)->primary();
            $table->char('user_id', 36)->nullable();
            $table->string('province', 100)->nullable();
            $table->string('district', 100)->nullable();
            $table->string('ward', 100)->nullable();
            $table->string('address_line', 255)->nullable();
            $table->string('address_type', 30)->default('home');
            $table->boolean('is_default')->default(false);

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::enableForeignKeyConstraints();
    }

    public function down(): void
    {
        Schema::disableForeignKeyConstraints();

        Schema::dropIfExists('user_addresses');
        Schema::dropIfExists('purchase_order_details');
        Schema::dropIfExists('purchase_orders');
        Schema::dropIfExists('inventory_transactions');
        Schema::dropIfExists('Staff_Shifts');
        Schema::dropIfExists('court_price_histories');
        Schema::dropIfExists('court_pricing');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('reviews');
        Schema::dropIfExists('refunds');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('booking_intents');
        Schema::dropIfExists('booking_service_details');
        Schema::dropIfExists('booking_details');
        Schema::dropIfExists('bookings');
        Schema::dropIfExists('recurring_bookings');
        Schema::dropIfExists('system_settings');
        Schema::dropIfExists('promotions');
        Schema::dropIfExists('products');
        Schema::dropIfExists('suppliers');
        Schema::dropIfExists('categories');
        Schema::dropIfExists('additional_services');
        Schema::dropIfExists('images');
        Schema::dropIfExists('courts');
        Schema::dropIfExists('users');

        Schema::enableForeignKeyConstraints();
    }
};
