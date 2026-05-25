import axiosClient from "../axiosClient";

export const adminDashboardService = {
  getDashboardReport: ({ from_date = "", to_date = "" } = {}) => {
    const params = new URLSearchParams();

    if (from_date) params.append("from_date", from_date);
    if (to_date) params.append("to_date", to_date);

    return axiosClient.get(`/admin/dashboard-report?${params.toString()}`);
  },
};
