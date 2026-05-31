import axiosClient from "../axiosClient";

export const adminPromotionService = {
  getPromotions: (params = {}) => {
    return axiosClient.get("/admin/promotions", { params });
  },

  createPromotion: (payload) => {
    return axiosClient.post("/admin/promotions", payload);
  },

  updatePromotion: (id, payload) => {
    return axiosClient.put(`/admin/promotions/${id}`, payload);
  },

  deletePromotion: (id) => {
    return axiosClient.delete(`/admin/promotions/${id}`);
  },
};
