import axiosClient from '../axiosClient';

export const courtService = {
    // Lấy danh sách sân
    getPublicCourts: () => axiosClient.get('/courts'),

    // Lấy chi tiết sân (Dùng cho BookingPage)
    getPublicCourtById: (id) => axiosClient.get(`/courts/${id}`),

    // Lấy lưới giờ trống
    getCourtSlots: (id, date) =>
        axiosClient.get(`/courts/${id}/availability?date=${date}&mode=grid`),

    // Lấy bảng giá tổng hợp cho trang chủ (grouped by day_type)
    getPublicPricings: () => axiosClient.get('/pricings/public'),
};