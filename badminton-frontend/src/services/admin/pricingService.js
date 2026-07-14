import axiosClient from "../axiosClient";

export const pricingService = {
  // 1. Lấy toàn bộ danh sách cấu hình giá
  getAllPricings: () => {
    return axiosClient.get("/admin/court-pricing");
  },

  // 2. Thêm cấu hình giá mới
  createPricing: (pricingData) => {
    return axiosClient.post("/admin/court-pricing", pricingData);
  },

  // 3. Xem chi tiết 1 cấu hình
  getPricingById: (id) => {
    return axiosClient.get(`/admin/court-pricing/${id}`);
  },

  // 4. Cập nhật cấu hình giá
  updatePricing: (id, pricingData) => {
    return axiosClient.put(`/admin/court-pricing/${id}`, pricingData);
  },

  // 5. Xóa cấu hình giá
  deletePricing: (id) => {
    return axiosClient.delete(`/admin/court-pricing/${id}`);
  },

  // 6a. Tạo/cập nhật 1 mốc giá cho TẤT CẢ sân trong 1 request (transaction phía backend)
  bulkUpsertPricing: (payload) => {
    return axiosClient.post("/admin/court-pricing-bulk", payload);
  },

  // 6b. Xóa 1 mốc giá khỏi tất cả sân trong 1 request
  bulkDeletePricing: (entryIds) => {
    return axiosClient.delete("/admin/court-pricing-bulk", {
      data: { entry_ids: entryIds },
    });
  },

  // 6. Test công cụ tính tiền tự động
  calculatePrice: (payload) => {
    return axiosClient.post("/admin/court-pricing/calculate", payload);
  },

  // 7. Lịch sử sửa giá sân (số lần cập nhật, chênh lệch cũ/mới, ai sửa)
  getPriceHistory: (courtId = "") => {
    return axiosClient.get("/admin/court-pricing-history", {
      params: { court_id: courtId || undefined },
    });
  },
};
