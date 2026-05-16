<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\Admin\CourtController;
use App\Http\Controllers\Api\Admin\CourtPricingController;
use App\Http\Controllers\Api\Admin\ImageController;
use App\Http\Controllers\Api\Admin\BookingController as AdminBooking;
use App\Http\Controllers\Api\User\BookingController as UserBooking;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\Admin\AdditionalServiceController;
use App\Http\Controllers\Api\Admin\CategoryController;
use App\Http\Controllers\Api\Admin\SupplierController;
use App\Http\Controllers\Api\Admin\ProductController;
use App\Http\Controllers\Api\Admin\PurchaseOrderController;
use App\Http\Controllers\Api\Admin\InventoryTransactionController;
/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// =============================================================================
// 1. NHÓM API CÔNG KHAI (Mở hoàn toàn cho Khách Vãng Lai - KHÔNG yêu cầu Token)
// =============================================================================

// Luồng xác thực danh tính
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login'])->name('login');

// Phân hệ tra cứu Sân và Bảng giá tham khảo
Route::get('/courts', [CourtController::class, 'getPublicCourts']);
Route::get('/courts/{id}', [CourtController::class, 'show']);
Route::get('/courts/{id}/pricing', [CourtPricingController::class, 'getPublicPricing']);
Route::post('/courts/calculate-price', [CourtPricingController::class, 'calculatePrice']);

// Luồng đặt sân cốt lõi: Xem giờ trống và Tiếp nhận Đơn đặt hàng
Route::get('/courts/{id}/availability', [UserBooking::class, 'getCourtAvailability']);
Route::post('/bookings', [UserBooking::class, 'store']); // Đưa ra Public để tiếp nhận đơn lẻ


// =============================================================================
// 2. NHÓM API BẢO MẬT (Yêu cầu Token hợp lệ qua cơ chế Middleware Sanctum)
// =============================================================================
Route::middleware('auth:sanctum')->group(function () {

    // --- PHÂN HỆ NGƯỜI DÙNG THÀNH VIÊN ---
    Route::get('/user/bookings', [UserBooking::class, 'getUserBookings']);

    // Hồ sơ tài khoản
    Route::get('/profile', [AuthController::class, 'getProfile']);
    Route::put('/update-profile', [AuthController::class, 'updateProfile']);
    Route::post('/change-password', [AuthController::class, 'changePassword']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/logout-all', [AuthController::class, 'logoutAllDevices']);

    // Sổ địa chỉ liên hệ
    Route::post('/address', [AuthController::class, 'addAddress']);
    Route::put('/address/{id}', [AuthController::class, 'updateAddress']);


    // --- PHÂN HỆ QUẢN TRỊ HỆ THỐNG (ADMIN DASHBOARD) ---
    Route::prefix('admin')->group(function () {

        // CRUD Quản lý danh mục Sân & Giá
        Route::apiResource('courts', CourtController::class);
        Route::post('court-pricing/calculate', [CourtPricingController::class, 'calculatePrice']);
        Route::apiResource('court-pricing', CourtPricingController::class);

        // Upload hình ảnh đính kèm
        Route::post('images', [ImageController::class, 'store']);
        Route::delete('images/{id}', [ImageController::class, 'destroy']);

        // Phân hệ kiểm soát đơn đặt hàng của Ban Quản Lý
        Route::get('/bookings/today', [AdminBooking::class, 'getTodayBookings']);
        Route::get('/bookings/single', [AdminBooking::class, 'getSingleBookings']);
        Route::get('/bookings/recurring', [AdminBooking::class, 'getRecurringMasters']);
        Route::get('/bookings/recurring/{id}/sessions', [AdminBooking::class, 'getRecurringSessions']);
        Route::patch('/bookings/details/{detailId}/reschedule', [AdminBooking::class, 'reschedule']);
        Route::post('/bookings/{id}/add-item', [App\Http\Controllers\Api\Admin\BookingController::class, 'addItemToBooking']);
        Route::get('/bookings/search', [AdminBooking::class, 'searchBookings']);
        // Quản lý Dịch vụ / Hàng hóa bán kèm
        Route::apiResource('services', AdditionalServiceController::class);
        // Quản lý Danh mục sản phẩm (Nước uống, Quả cầu...)
        Route::apiResource('categories', CategoryController::class);

        // Quản lý Nhà cung cấp (Tạp hóa, Đại lý đồ thể thao...)
        Route::apiResource('suppliers', SupplierController::class);

        // Cập nhật trạng thái thanh toán và quy trình xử lý đơn
        Route::patch('/bookings/{id}/status', [AdminBooking::class, 'updateStatus']);
        // Quản lý Hàng hóa / Sản phẩm (Cần quản lý tồn kho)
        Route::apiResource('products', ProductController::class);

        // Quản lý Nhập Kho & Lịch sử
        // Phiếu nhập kho làm xong là chốt sổ, không có chuyện sửa hay xóa để đảm bảo luồng kế toán.
        // Nên ta chỉ dùng 3 hàm: index (xem danh sách), show (xem chi tiết) và store (tạo mới)
        Route::get('purchase-orders', [PurchaseOrderController::class, 'index']);
        Route::get('purchase-orders/{id}', [PurchaseOrderController::class, 'show']);
        Route::post('purchase-orders', [PurchaseOrderController::class, 'store']);
        // Quản lý và xem báo cáo Biến động kho
        Route::get('inventory-history', [InventoryTransactionController::class, 'index']);
        Route::post('inventory-adjustment', [InventoryTransactionController::class, 'store']);

    });
});