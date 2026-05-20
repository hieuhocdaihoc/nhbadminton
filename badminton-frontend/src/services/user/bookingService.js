import axiosClient from '../axiosClient';

export const bookingService = {
    // Tạo đơn đặt sân mới (Yêu cầu Token)
    createBooking: (payload) => {
        return axiosClient.post('/bookings', payload);
    },

    // Xem lịch sử đặt sân cá nhân (Yêu cầu Token)
    getUserBookingHistory: (tab = 'all', page = 1) => {
        return axiosClient.get(`/user/bookings?tab=${tab}&page=${page}`);
    },

    // Lấy thông tin thanh toán
    getPaymentInfo: (bookingId) => {
        return axiosClient.get(`/bookings/${bookingId}/payment-info`);
    }
};