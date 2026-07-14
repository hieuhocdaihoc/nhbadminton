import axiosClient from "../axiosClient";

export const adminProductService = {
  // 1. Lấy danh sách sản phẩm (Có phân trang, nhận tham số page và từ khóa tìm kiếm)
  getProducts: (page = 1, keyword = "", categoryId = "") => {
    let url = `/admin/products?page=${page}`;
    if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;
    if (categoryId) url += `&category_id=${categoryId}`;
    return axiosClient.get(url);
  },

  // 2. Thêm mới sản phẩm
  createProduct: (payload) => {
    return axiosClient.post("/admin/products", payload);
  },

  // 3. Cập nhật thông tin sản phẩm
  updateProduct: (id, payload) => {
    return axiosClient.put(`/admin/products/${id}`, payload);
  },

  // 4. Ngưng kinh doanh (Xóa mềm)
  deleteProduct: (id) => {
    return axiosClient.delete(`/admin/products/${id}`);
  }, // <--- NHỚ CÓ DẤU PHẨY Ở ĐÂY NHA BẠN

  // =========================================================================
  // 5. KÍCH HOẠT HOẠT ĐỘNG TRỞ LẠI (SỬA LẠI THEO ĐÚNG LOGIC UPDATE CỦA BẠN)
  // =========================================================================
  restoreProduct: (id) => {
    // Gọi thẳng vào route PUT của resource, gửi kèm payload status = active
    return axiosClient.put(`/admin/products/${id}`, { status: "active" });
  },

  // 6. Báo cáo tồn kho: top bán chạy, cần nhập thêm, giá trị tồn kho theo danh mục
  getReport: () => {
    return axiosClient.get("/admin/products-report");
  },
};
