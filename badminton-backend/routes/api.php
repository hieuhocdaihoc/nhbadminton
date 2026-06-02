<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\User\BookingController as UserBooking;
use App\Http\Controllers\Api\User\ReviewController as UserReviewController;
use App\Http\Controllers\Api\Admin\{
    AdminUserController,
    AdditionalServiceController,
    BookingController as AdminBooking,
    CategoryController,
    CourtController,
    CourtPricingController,
    ImageController,
    InventoryTransactionController,
    NotificationController,
    ProductController,
    PurchaseOrderController,
    PromotionController,
    StaffShiftController,
    SupplierController,
    DashboardReportController,
    PaymentManagementController
};
use App\Http\Controllers\Api\Admin\ReviewController as AdminReviewController;
use App\Http\Controllers\Api\Payment\SePayController;


/*
|--------------------------------------------------------------------------
| 1. PUBLIC ENDPOINTS (CÔNG KHAI)
|--------------------------------------------------------------------------
*/
// Xác thực
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login'])->name('login');

// Tra cứu sân & bảng giá công khai
Route::get('/courts', [CourtController::class, 'getPublicCourts']);
Route::get('/courts/{id}', [CourtController::class, 'show']);
Route::get('/courts/{id}/pricing', [CourtPricingController::class, 'getPublicPricing']);
Route::post('/courts/calculate-price', [CourtPricingController::class, 'calculatePrice']);
// Webhook nhận thông báo thanh toán từ SePay
Route::post('/sepay/webhook', [SePayController::class, 'webhook']);
// Lấy thông tin thanh toán và QR chuyển khoản của đơn đặt sân
Route::get('/bookings/{id}/payment-info', [SePayController::class, 'paymentInfo']);

// Lịch trống & Đặt sân lẻ
Route::get('/courts/{id}/availability', [UserBooking::class, 'getCourtAvailability']);
Route::post('/bookings', [UserBooking::class, 'store']);
Route::post('/bookings/guest-lookup', [UserBooking::class, 'lookupGuestBooking']);
Route::post('/bookings/validate-promotion', [UserBooking::class, 'validatePromotion']);
Route::get('/reviews', [UserReviewController::class, 'index']);

/*
|--------------------------------------------------------------------------
| 2. AUTHENTICATED ENDPOINTS (BẢO MẬT VỚI SANCTUM)
|--------------------------------------------------------------------------
*/
Route::middleware('auth:sanctum')->group(function () {

    // --- PHÂN HỆ KHÁCH HÀNG THÀNH VIÊN ---
    Route::get('/user/bookings', [UserBooking::class, 'getUserBookings'])
        ->middleware('role:customer');
    Route::post('/reviews', [UserReviewController::class, 'store'])
        ->middleware('role:customer');

    Route::controller(AuthController::class)->group(function () {
        Route::get('/profile', 'getProfile');
        Route::put('/update-profile', 'updateProfile');
        Route::post('/change-password', 'changePassword');
        Route::post('/logout', 'logout');
        Route::post('/logout-all', 'logoutAllDevices');
        Route::post('/address', 'addAddress');
        Route::put('/address/{id}', 'updateAddress');
    });

    // --- PHÂN HỆ QUẢN TRỊ (ADMIN / LỄ TÂN) ---
    Route::prefix('admin')->middleware('role:admin,staff')->group(function () {
        // Lễ tân và admin được vận hành lịch đặt, thu tiền và bán thêm món.
        Route::controller(AdminBooking::class)->group(function () {
            Route::get('/bookings/today', 'getTodayBookings');
            Route::get('/bookings/single', 'getSingleBookings');
            Route::get('/bookings/recurring', 'getRecurringMasters');
            Route::get('/bookings/recurring/{id}/sessions', 'getRecurringSessions');
            Route::get('/bookings/search', 'searchBookings');
            Route::patch('/bookings/{id}/status', 'updateStatus');
            Route::patch('/bookings/{id}/payment', 'updatePayment');
            Route::patch('/bookings/details/{detailId}/reschedule', 'reschedule');
            Route::post('/bookings/{id}/add-item', 'addItemToBooking');
            Route::post('/bookings/{id}/add-items', 'addItemsToBooking');
        });

        // Dữ liệu đọc cần cho lễ tân chọn sân, sản phẩm và dịch vụ khi bán hàng.
        Route::apiResource('courts', CourtController::class)->only(['index', 'show']);
        Route::apiResource('court-pricing', CourtPricingController::class)->only(['index', 'show']);
        Route::apiResource('services', AdditionalServiceController::class)->only(['index', 'show']);
        Route::apiResource('categories', CategoryController::class)->only(['index', 'show']);
        Route::apiResource('suppliers', SupplierController::class)->only(['index', 'show']);
        Route::apiResource('products', ProductController::class)->only(['index', 'show']);
        Route::apiResource('promotions', PromotionController::class)->only(['index', 'show']);
        Route::post('court-pricing/calculate', [CourtPricingController::class, 'calculatePrice']);

        // Admin va staff duoc van hanh cac module nghiep vu; controller se chan vung tai khoan nhay cam.
        Route::get('/dashboard-report', [DashboardReportController::class, 'index']);

        Route::controller(AdminUserController::class)->group(function () {
            Route::get('/users', 'index');
            Route::post('/users', 'store');
            Route::get('/users/{id}', 'show');
            Route::put('/users/{id}', 'update');
            Route::get('/users/{id}/booking-stats', 'bookingStats');
            Route::patch('/users/{id}/status', 'updateStatus');
            Route::patch('/users/{id}/reset-password', 'resetPassword');
        });

        Route::controller(PaymentManagementController::class)->group(function () {
            Route::get('/payments', 'index');
            Route::get('/payments/summary', 'summary');
            Route::get('/payments/booking/{bookingId}', 'paymentsByBooking');
            Route::get('/payments/{id}', 'show');
        });

        Route::controller(NotificationController::class)->group(function () {
            Route::get('/notifications', 'index');
            Route::patch('/notifications/read-all', 'markAllAsRead');
            Route::patch('/notifications/{id}/read', 'markAsRead');
        });

        Route::controller(AdminReviewController::class)->group(function () {
            Route::get('/reviews', 'index');
            Route::patch('/reviews/{id}/reply', 'reply');
            Route::patch('/reviews/{id}/status', 'updateStatus');
            Route::delete('/reviews/{id}', 'destroy');
        });

        Route::controller(PurchaseOrderController::class)->group(function () {
            Route::get('purchase-orders', 'index');
            Route::get('purchase-orders/{id}', 'show');
            Route::post('purchase-orders', 'store');
        });

        Route::controller(InventoryTransactionController::class)->group(function () {
            Route::get('inventory-history', 'index');
            Route::post('inventory-adjustment', 'store');
        });

        Route::post('images', [ImageController::class, 'store']);
        Route::delete('images/{id}', [ImageController::class, 'destroy']);

        Route::apiResource('courts', CourtController::class)->except(['index', 'show']);
        Route::apiResource('court-pricing', CourtPricingController::class)->except(['index', 'show']);
        Route::apiResource('services', AdditionalServiceController::class)->except(['index', 'show']);
        Route::apiResource('categories', CategoryController::class)->except(['index', 'show']);
        Route::apiResource('suppliers', SupplierController::class)->except(['index', 'show']);
        Route::apiResource('products', ProductController::class)->except(['index', 'show']);
        Route::apiResource('promotions', PromotionController::class)->except(['index', 'show']);

        Route::middleware('role:admin')->group(function () {
            Route::patch('staff-shifts/{id}/check-in', [StaffShiftController::class, 'checkIn']);
            Route::patch('staff-shifts/{id}/check-out', [StaffShiftController::class, 'checkOut']);
            Route::apiResource('staff-shifts', StaffShiftController::class);
        });
    });
});
