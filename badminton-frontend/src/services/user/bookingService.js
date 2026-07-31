import axiosClient from '../axiosClient';

export const bookingService = {
    createBooking: (payload) => {
        return axiosClient.post('/bookings', payload);
    },

    getUserBookingHistory: (tab = 'all', page = 1) => {
        return axiosClient.get(`/user/bookings?tab=${tab}&page=${page}`);
    },

    lookupGuestBooking: (payload) => {
        return axiosClient.post('/bookings/guest-lookup', payload);
    },

    validatePromotion: (payload) => {
        return axiosClient.post('/bookings/validate-promotion', payload);
    },

    getPaymentInfo: (bookingId) => {
        return axiosClient.get(`/bookings/${bookingId}/payment-info`);
    },

    preparePayment: (payload) => {
        return axiosClient.post('/bookings/prepare', payload);
    },

    getIntentStatus: (intentCode) => {
        return axiosClient.get(`/booking-intents/${intentCode}/status`);
    },

    sendRequest: (payload) => {
        return axiosClient.post('/user/booking-request', payload);
    },

    // Đổi lịch tự động theo chính sách báo trước/báo sau
    rescheduleSession: (payload) => {
        return axiosClient.post('/user/bookings/reschedule', payload);
    },

    // Thống kê số buổi của tài khoản
    getMyBookingStats: () => {
        return axiosClient.get('/user/booking-stats');
    },

    // Mã giảm giá ngày đặc biệt đang tự động áp dụng hôm nay
    getAutoPromotion: () => {
        return axiosClient.get('/promotions/auto-today');
    },

    // Ước tính tổng tiền theo đúng ngày chơi thực tế (định kỳ/dài hạn)
    estimatePrice: (payload) => {
        return axiosClient.post('/bookings/estimate', payload);
    },
};
