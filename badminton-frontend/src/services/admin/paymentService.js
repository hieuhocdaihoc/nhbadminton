import axiosClient from "../axiosClient";

export const adminPaymentService = {
  // 1. Lấy danh sách thanh toán / giao dịch
  getPayments: ({
    page = 1,
    per_page = 10,
    keyword = "",
    payment_method = "",
    status = "",
    from_date = "",
    to_date = "",
  } = {}) => {
    const params = new URLSearchParams();

    params.append("page", page);
    params.append("per_page", per_page);

    if (keyword) params.append("keyword", keyword);
    if (payment_method) params.append("payment_method", payment_method);
    if (status) params.append("status", status);
    if (from_date) params.append("from_date", from_date);
    if (to_date) params.append("to_date", to_date);

    return axiosClient.get(`/admin/payments?${params.toString()}`);
  },

  // 2. Lấy thống kê doanh thu
  getRevenueSummary: ({ from_date = "", to_date = "" } = {}) => {
    const params = new URLSearchParams();

    if (from_date) params.append("from_date", from_date);
    if (to_date) params.append("to_date", to_date);

    return axiosClient.get(`/admin/payments/summary?${params.toString()}`);
  },

  // 3. Xem chi tiết 1 giao dịch thanh toán
  getPaymentDetail: (id) => {
    return axiosClient.get(`/admin/payments/${id}`);
  },

  // 4. Lấy lịch sử thanh toán theo đơn đặt sân
  getPaymentsByBooking: (bookingId) => {
    return axiosClient.get(`/admin/payments/booking/${bookingId}`);
  },
};
