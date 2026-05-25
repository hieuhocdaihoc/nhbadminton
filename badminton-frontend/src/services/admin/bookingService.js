import axiosClient from "../axiosClient";

export const adminBookingService = {
  // 1. Lấy tất cả các ca có lịch chơi trong ngày hôm nay
  getTodayBookings: () => {
    return axiosClient.get("/admin/bookings/today");
  },

  // 2. Lấy danh sách đặt lẻ
  getSingleBookings: (page = 1) => {
    return axiosClient.get(`/admin/bookings/single?page=${page}`);
  },

  // 3. Lấy danh sách hợp đồng gốc định kỳ
  getRecurringMasters: (page = 1) => {
    return axiosClient.get(`/admin/bookings/recurring?page=${page}`);
  },

  // 4. Lấy chi tiết các buổi chơi con thuộc 1 hợp đồng định kỳ
  getRecurringSessions: (recurringId) => {
    return axiosClient.get(`/admin/bookings/recurring/${recurringId}/sessions`);
  },

  // 5. Cập nhật trạng thái đơn: pending, confirmed, cancelled, completed
  updateStatus: (bookingId, payload) => {
    return axiosClient.patch(`/admin/bookings/${bookingId}/status`, payload);
  },

  // 6. Cập nhật trạng thái thanh toán: unpaid, partially_paid, paid
  updatePayment: (bookingId, payload) => {
    return axiosClient.patch(`/admin/bookings/${bookingId}/payment`, payload);
  },

  // 7. Lấy danh sách tất cả các sân
  getAllCourts: () => {
    return axiosClient.get("/admin/courts");
  },

  // 8. Gửi yêu cầu đổi lịch cho 1 ca chơi cụ thể
  rescheduleDetail: (detailId, payload) => {
    return axiosClient.patch(
      `/admin/bookings/details/${detailId}/reschedule`,
      payload,
    );
  },

  // 9. Thêm 1 món / dịch vụ vào bill
  addItemToBooking: (bookingId, payload) => {
    return axiosClient.post(`/admin/bookings/${bookingId}/add-item`, payload);
  },

  // 10. Thêm nhiều món / dịch vụ vào bill
  addItemsToBooking: (bookingId, payload) => {
    return axiosClient.post(`/admin/bookings/${bookingId}/add-items`, payload);
  },
};
