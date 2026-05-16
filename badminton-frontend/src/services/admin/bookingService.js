import axiosClient from '../axiosClient';

export const adminBookingService = {
    // 1. Lấy tất cả các ca có lịch chơi trong ngày hôm nay
    getTodayBookings: () => {
        return axiosClient.get('/admin/bookings/today');
    },

    // 2. Lấy danh sách đặt lẻ (Có phân trang 15 item)
    getSingleBookings: (page = 1) => {
        return axiosClient.get(`/admin/bookings/single?page=${page}`);
    },

    // 3. Lấy danh sách các hợp đồng gốc định kỳ (Có phân trang 15 item)
    getRecurringMasters: (page = 1) => {
        return axiosClient.get(`/admin/bookings/recurring?page=${page}`);
    },

    // 4. Lấy chi tiết các buổi chơi con thuộc 1 hợp đồng định kỳ
    getRecurringSessions: (recurringId) => {
        return axiosClient.get(`/admin/bookings/recurring/${recurringId}/sessions`);
    },

    // 5. Cập nhật trạng thái và thanh toán của 1 booking
    updateStatus: (bookingId, payload) => {
        return axiosClient.patch(`/admin/bookings/${bookingId}/status`, payload);
    },

    // ==========================================
    // CÁC HÀM MỚI THÊM CHO TÍNH NĂNG ĐỔI LỊCH
    // ==========================================

    // 6. Lấy danh sách tất cả các sân (Để thả vào Dropdown lúc đổi lịch)
    getAllCourts: () => {
        // Giả sử route API backend của bạn là /api/admin/courts
        return axiosClient.get('/admin/courts');
    },

    // 7. Gửi yêu cầu đổi lịch cho 1 ca chơi cụ thể
    rescheduleDetail: (detailId, payload) => {
        // Route này map chính xác với hàm public function reschedule($request, $detailId) ở Backend
        return axiosClient.patch(`/admin/bookings/details/${detailId}/reschedule`, payload);
    }, // <--- NHỚ CÓ DẤU PHẨY Ở ĐÂY NHA BẠN

    // =========================================================================
    // 8. LỄ TÂN THÊM MÓN / DỊCH VỤ VÀO ĐƠN ĐANG CHƠI (MỚI THÊM)
    // =========================================================================
    addItemToBooking: (bookingId, payload) => {
        // Đường dẫn này map chính xác với Route::post('/bookings/{id}/add-item', ...) bên Laravel của bạn
        return axiosClient.post(`/admin/bookings/${bookingId}/add-item`, payload);
    }
};