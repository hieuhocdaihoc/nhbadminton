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
    PaymentManagementController,
    SystemSettingController
};
use App\Http\Controllers\Api\Admin\ReviewController as AdminReviewController;
use App\Http\Controllers\Api\Admin\MembershipController as AdminMembership;
use App\Http\Controllers\Api\User\MembershipController as UserMembership;
use App\Http\Controllers\Api\Payment\SePayController;


/*
|--------------------------------------------------------------------------
| 1. PUBLIC ENDPOINTS (CÔNG KHAI)
|--------------------------------------------------------------------------
*/
// Xác thực
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login'])->name('login');

// Cấu hình hệ thống (địa chỉ, hotline, giờ hoạt động...) cho Footer/Trang chủ hiển thị
Route::get('/settings', [SystemSettingController::class, 'index']);

// Gói thành viên công khai
Route::get('/membership/packages', [UserMembership::class, 'packages']);

// Tra cứu sân & bảng giá công khai
Route::get('/courts', [CourtController::class, 'getPublicCourts']);
Route::get('/courts/{id}', [CourtController::class, 'showPublic']);
Route::get('/courts/{id}/pricing', [CourtPricingController::class, 'getPublicPricing']);
Route::get('/pricings/public', [CourtPricingController::class, 'getPublicAllPricings']);
Route::post('/courts/calculate-price', [CourtPricingController::class, 'calculatePrice']);
// Webhook nhận thông báo thanh toán từ SePay
Route::post('/sepay/webhook', [SePayController::class, 'webhook']);
// Lấy thông tin thanh toán và QR chuyển khoản của đơn đặt sân
Route::get('/bookings/{id}/payment-info', [SePayController::class, 'paymentInfo']);
Route::get('/booking-intents/{code}/status', [SePayController::class, 'intentStatus']);

// Lịch trống & Đặt sân lẻ
Route::get('/courts/{id}/availability', [UserBooking::class, 'getCourtAvailability']);
Route::post('/bookings', [UserBooking::class, 'store']);
Route::post('/bookings/prepare', [UserBooking::class, 'preparePayment']);
Route::post('/bookings/estimate', [UserBooking::class, 'estimatePrice']);
Route::post('/bookings/guest-lookup', [UserBooking::class, 'lookupGuestBooking']);
Route::post('/bookings/validate-promotion', [UserBooking::class, 'validatePromotion']);
// Mã giảm giá ngày đặc biệt đang hiệu lực (tự động áp) — cho banner trang đặt sân
Route::get('/promotions/auto-today', [UserBooking::class, 'autoPromotion']);
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
    Route::post('/user/booking-request', [UserBooking::class, 'sendRequest'])
        ->middleware('role:customer');
    // Đổi lịch tự động theo chính sách báo trước/báo sau (áp dụng cho từng buổi)
    Route::post('/user/bookings/reschedule', [UserBooking::class, 'rescheduleSession'])
        ->middleware('role:customer');
    // Thống kê số buổi của tài khoản
    Route::get('/user/booking-stats', [UserBooking::class, 'myBookingStats'])
        ->middleware('role:customer');
    Route::post('/reviews', [UserReviewController::class, 'store'])
        ->middleware('role:customer');
    // Thẻ thành viên của khách
    Route::get('/membership/my-card', [UserMembership::class, 'myCard'])
        ->middleware('role:customer');
    // Khách tự mua gói: tạo intent + QR; chỉ cấp thẻ sau khi webhook xác nhận tiền
    Route::post('/membership/purchase', [UserMembership::class, 'purchase'])
        ->middleware('role:customer');
    Route::get('/membership/purchase/{intentCode}/status', [UserMembership::class, 'purchaseStatus'])
        ->middleware('role:customer');
    Route::delete('/membership/purchase/{intentCode}', [UserMembership::class, 'cancelPurchase'])
        ->middleware('role:customer');

    Route::controller(AuthController::class)->group(function () {
        Route::get('/profile', 'getProfile');
        Route::put('/update-profile', 'updateProfile');
        Route::post('/change-password', 'changePassword');
        Route::post('/logout', 'logout');
        Route::post('/logout-all', 'logoutAllDevices');
        Route::post('/avatar', 'uploadAvatar');
    });

    // Ca làm của nhân viên đang đăng nhập (dùng để kiểm tra có đang trong ca không)
    Route::get('/staff/my-shifts', [StaffShiftController::class, 'myShifts'])
        ->middleware('role:staff');

    // --- PHÂN HỆ QUẢN TRỊ (ADMIN / LỄ TÂN) ---
    Route::prefix('admin')->middleware('role:admin,staff')->group(function () {
        // Lễ tân và admin được vận hành lịch đặt, thu tiền và bán thêm món.
        Route::controller(AdminBooking::class)->group(function () {
            Route::get('/bookings/today', 'getTodayBookings');
            Route::get('/bookings/single', 'getSingleBookings');
            Route::get('/bookings/recurring', 'getRecurringMasters');
            Route::get('/bookings/recurring/{id}/sessions', 'getRecurringSessions');
            Route::get('/bookings/long-term', 'getLongTermMasters');
            Route::get('/bookings/long-term/{id}/sessions', 'getRecurringSessions');
            Route::get('/bookings/search', 'searchBookings');
            Route::patch('/bookings/{id}/status', 'updateStatus');
            Route::post('/bookings/{id}/check-in', 'checkIn');
            Route::patch('/bookings/{id}/payment', 'updatePayment');
            Route::patch('/bookings/{id}/checkout', 'checkout');
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
        Route::get('products-report', [ProductController::class, 'report']);
        Route::apiResource('promotions', PromotionController::class)->only(['index', 'show']);
        Route::post('court-pricing/calculate', [CourtPricingController::class, 'calculatePrice']);

        // Admin va staff duoc van hanh cac module nghiep vu; controller se chan vung tai khoan nhay cam.
        Route::get('/dashboard-report', [DashboardReportController::class, 'index']);
        // Báo cáo hiệu suất & doanh thu từng sân theo khoảng thời gian
        Route::get('/reports/court-performance', [DashboardReportController::class, 'courtPerformance']);
        // Lịch sử sửa giá sân
        Route::get('/court-pricing-history', [CourtPricingController::class, 'priceHistory']);

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
            // Ghi nhận hoàn tiền (hệ thống chỉ lưu thông tin, hoàn tiền thực hiện thủ công)
            Route::get('/refunds', 'refunds');
            Route::post('/refunds', 'storeRefund');
            Route::patch('/refunds/{id}/status', 'updateRefundStatus');
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
        // Mốc giá dùng chung: 1 request áp/xóa cho tất cả sân trong 1 transaction
        Route::post('court-pricing-bulk', [CourtPricingController::class, 'bulkUpsert']);
        Route::delete('court-pricing-bulk', [CourtPricingController::class, 'bulkDestroy']);
        Route::apiResource('court-pricing', CourtPricingController::class)->except(['index', 'show']);
        Route::apiResource('services', AdditionalServiceController::class)->except(['index', 'show']);
        Route::apiResource('categories', CategoryController::class)->except(['index', 'show']);
        Route::apiResource('suppliers', SupplierController::class)->except(['index', 'show']);
        Route::apiResource('products', ProductController::class)->except(['index', 'show']);
        Route::apiResource('promotions', PromotionController::class)->except(['index', 'show']);

        // Quản lý gói & thẻ thành viên
        Route::controller(AdminMembership::class)->group(function () {
            Route::get('membership/packages', 'indexPackages');
            Route::post('membership/packages', 'storePackage');
            Route::put('membership/packages/{id}', 'updatePackage');
            Route::delete('membership/packages/{id}', 'destroyPackage');

            Route::get('membership/cards', 'indexCards');
            Route::get('membership/cards/{id}', 'showCard');
            Route::post('membership/cards', 'storeCard');
            Route::patch('membership/cards/{id}/activate', 'activateCard');
            Route::patch('membership/cards/{id}/cancel', 'cancelCard');
        });

        Route::middleware('role:admin')->group(function () {
            Route::apiResource('staff-shifts', StaffShiftController::class);

            Route::get('settings', [SystemSettingController::class, 'index']);
            Route::put('settings', [SystemSettingController::class, 'update']);
        });
    });
});
