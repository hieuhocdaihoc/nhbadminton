import axiosClient from "../axiosClient";

export const adminInventoryService = {
  // -----------------------------------------------------------------
  // PHÂN HỆ 1: NHẬT KÝ BIẾN ĐỘNG & KIỂM KHO (Inventory Transactions)
  // -----------------------------------------------------------------
  getTransactions: (page = 1, type = "", productId = "") => {
    let url = `/admin/inventory-history?page=${page}`;
    if (type) url += `&type=${type}`;
    if (productId) url += `&product_id=${productId}`;
    return axiosClient.get(url);
  },

  adjustInventory: (payload) => {
    return axiosClient.post("/admin/inventory-adjustment", payload);
  },

  // -----------------------------------------------------------------
  // PHÂN HỆ 2: PHIẾU NHẬP HÀNG & DÒNG TIỀN CHI (Purchase Orders)
  // -----------------------------------------------------------------
  getPurchaseOrders: (page = 1) => {
    return axiosClient.get(`/admin/purchase-orders?page=${page}`);
  },

  getPurchaseOrderDetail: (id) => {
    return axiosClient.get(`/admin/purchase-orders/${id}`);
  },

  createPurchaseOrder: (payload) => {
    // payload gồm: { supplier_id, items: [{ product_id, quantity, import_price }] }
    return axiosClient.post("/admin/purchase-orders", payload);
  },
};
