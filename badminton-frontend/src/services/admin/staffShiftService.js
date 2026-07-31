import axiosClient from "../axiosClient";

export const staffShiftService = {
  getMyShifts: () => axiosClient.get("/staff/my-shifts"),
  getShifts: (params = {}) => axiosClient.get("/admin/staff-shifts", { params }),
  createShift: (payload) => axiosClient.post("/admin/staff-shifts", payload),
  updateShift: (id, payload) => axiosClient.put(`/admin/staff-shifts/${id}`, payload),
  deleteShift: (id) => axiosClient.delete(`/admin/staff-shifts/${id}`),
};
