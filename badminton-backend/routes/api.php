<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\User\BookingController as UserBooking;
use App\Http\Controllers\Api\Admin\{
    AdminUserController,
    AdditionalServiceController,
    BookingController as AdminBooking,
    CategoryController,
    CourtController,
    CourtPricingController,
    ImageController,
    InventoryTransactionController,
    ProductController,
    PurchaseOrderController,
    SupplierController
};
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

/*
|--------------------------------------------------------------------------
| 2. AUTHENTICATED ENDPOINTS (BẢO MẬT VỚI SANCTUM)
|--------------------------------------------------------------------------
*/
Route::middleware('auth:sanctum')->group(function () {

    // --- PHÂN HỆ KHÁCH HÀNG THÀNH VIÊN ---
    Route::get('/user/bookings', [UserBooking::class, 'getUserBookings']);

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
    Route::prefix('admin')->group(function () {

        // Quản lý User / Nhân viên
        Route::controller(AdminUserController::class)->group(function () {
            Route::get('/users', 'index');
            Route::post('/users', 'store');
            Route::get('/users/{id}', 'show');
            Route::put('/users/{id}', 'update');
            Route::get('/users/{id}/booking-stats', 'bookingStats');
            Route::patch('/users/{id}/status', 'updateStatus');
            Route::patch('/users/{id}/reset-password', 'resetPassword');
        });

        // Quản lý Đơn đặt sân & Bán thêm món
        Route::controller(AdminBooking::class)->group(function () {
            Route::get('/bookings/today', 'getTodayBookings');
            Route::get('/bookings/single', 'getSingleBookings');
            Route::get('/bookings/recurring', 'getRecurringMasters');
            Route::get('/bookings/recurring/{id}/sessions', 'getRecurringSessions');
            Route::get('/bookings/search', 'searchBookings');
            Route::patch('/bookings/{id}/status', 'updateStatus');
            Route::patch('/bookings/details/{detailId}/reschedule', 'reschedule');
            Route::post('/bookings/{id}/add-item', 'addItemToBooking');
            Route::post('/bookings/{id}/add-items', 'addItemsToBooking');
        });

        // Quản lý Nhập kho (Phiếu nhập)
        Route::controller(PurchaseOrderController::class)->group(function () {
            Route::get('purchase-orders', 'index');
            Route::get('purchase-orders/{id}', 'show');
            Route::post('purchase-orders', 'store');
        });

        // Quản lý Sổ cái kho & Kiểm kho thủ công
        Route::controller(InventoryTransactionController::class)->group(function () {
            Route::get('inventory-history', 'index');
            Route::post('inventory-adjustment', 'store');
        });

        // Quản lý Hình ảnh
        Route::post('images', [ImageController::class, 'store']);
        Route::delete('images/{id}', [ImageController::class, 'destroy']);

        // Tính giá sân (Nút bấm thử cho Admin)
        Route::post('court-pricing/calculate', [CourtPricingController::class, 'calculatePrice']);

        // Các bộ API CRUD nền tảng (Sân, Giá, Dịch vụ, Danh mục, Đối tác, Sản phẩm)
        Route::apiResources([
            'courts' => CourtController::class,
            'court-pricing' => CourtPricingController::class,
            'services' => AdditionalServiceController::class,
            'categories' => CategoryController::class,
            'suppliers' => SupplierController::class,
            'products' => ProductController::class,
        ]);
    });
});