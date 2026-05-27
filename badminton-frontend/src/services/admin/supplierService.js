import axiosClient from "../axiosClient";

export const adminSupplierService = {
  // 1. Lấy danh sách nhà cung cấp (Có bộ lọc tìm kiếm song song tên/SĐT)
  getSuppliers: (keyword = "") => {
    let url = "/admin/suppliers";
    if (keyword) url += `?keyword=${encodeURIComponent(keyword)}`;
    return axiosClient.get(url);
  },

  // 2. Thêm mới nhà cung cấp
  createSupplier: (payload) => {
    return axiosClient.post("/admin/suppliers", payload);
  },

  // 3. Cập nhật thông tin nhà cung cấp
  updateSupplier: (id, payload) => {
    return axiosClient.put(`/admin/suppliers/${id}`, payload);
  },

  // 4. Xóa cứng đối tác khỏi hệ thống (Có đánh chặn ràng buộc khóa ngoại kế toán)
  deleteSupplier: (id) => {
    return axiosClient.delete(`/admin/suppliers/${id}`);
  },
};
