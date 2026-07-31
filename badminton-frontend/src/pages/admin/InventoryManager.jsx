import { useCallback, useEffect, useState } from "react";
import { toast } from "../../utils/toast";
import { motion, AnimatePresence } from "framer-motion";
import { adminInventoryService } from "../../services/admin/inventoryService";
import { adminProductService } from "../../services/admin/productService";
import { adminSupplierService } from "../../services/admin/supplierService";

// Bộ nhãn hiển thị dùng chung cho mọi nơi (bảng lịch sử, bộ lọc, modal điều chỉnh)
// để đồng nhất cách gọi tên loại biến động kho.
const TRANSACTION_TYPE_LABELS = {
  import: "Nhập kho",
  sale: "Bán ra",
  export: "Xuất hủy / Hỏng hóc",
  adjustment: "Cân bằng kho",
};

const InventoryManager = () => {
  const [activeTab, setActiveTab] = useState("movement");

  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState({ type: "", text: "" });

  // Tab 1: Movement
  const [transactions, setTransactions] = useState([]);
  const [txPagination, setTxPagination] = useState({
    current_page: 1,
    last_page: 1,
  });
  const [filterType, setFilterType] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [adjustForm, setAdjustForm] = useState({
    product_id: "",
    transaction_type: "export",
    quantity: "",
    note: "",
  });

  // Tab 2: Purchase
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [poPagination, setPoPagination] = useState({
    current_page: 1,
    last_page: 1,
  });
  const [selectedPO, setSelectedPO] = useState(null);
  const [isPoDetailOpen, setIsPoDetailOpen] = useState(false);

  // Modal New PO
  const [isNewPoOpen, setIsNewPoOpen] = useState(false);
  const [newPoSupplier, setNewPoSupplier] = useState("");
  const [newPoItems, setNewPoItems] = useState([
    { product_id: "", quantity: 1, import_price: "" },
  ]);

  const [isProcessing, setIsProcessing] = useState(false);

  const loadBaseData = useCallback(async () => {
    try {
      const [prodRes, supRes] = await Promise.all([
        adminProductService.getProducts(1, "", ""),
        adminSupplierService.getSuppliers(""),
      ]);
      setProducts(prodRes.data?.data?.data || []);
      setSuppliers(supRes.data?.data || []);
    } catch (e) {
      console.error("Lỗi nạp dữ liệu nền:", e);
    }
  }, []);

  const fetchTabData = useCallback(async (page = 1) => {
    setIsLoading(true);
    try {
      if (activeTab === "movement") {
        const res = await adminInventoryService.getTransactions(
          page,
          filterType,
          filterProduct,
        );
        setTransactions(res.data?.data?.data || []);
        setTxPagination({
          current_page: res.data?.data?.current_page || 1,
          last_page: res.data?.data?.last_page || 1,
        });
      } else {
        const res = await adminInventoryService.getPurchaseOrders(page);
        setPurchaseOrders(res.data?.data?.data || []);
        setPoPagination({
          current_page: res.data?.data?.current_page || 1,
          last_page: res.data?.data?.last_page || 1,
        });
      }
    } catch {
      setMessage({ type: "error", text: "Đồng bộ sổ cái kho thất bại!" });
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, filterProduct, filterType]);

  useEffect(() => {
    const timer = setTimeout(() => loadBaseData(), 0);
    return () => clearTimeout(timer);
  }, [loadBaseData]);

  useEffect(() => {
    const timer = setTimeout(() => fetchTabData(1), 250);
    return () => clearTimeout(timer);
  }, [fetchTabData]);

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    if (
      !adjustForm.product_id ||
      adjustForm.quantity === "" ||
      !adjustForm.note.trim()
    )
      return toast.warn("Vui lòng điền đủ thông tin kiểm kho!");
    setIsProcessing(true);
    try {
      await adminInventoryService.adjustInventory({
        product_id: adjustForm.product_id,
        transaction_type: adjustForm.transaction_type,
        quantity: Number(adjustForm.quantity),
        note: adjustForm.note,
      });
      setMessage({
        type: "success",
        text: "Đã cân bằng số lượng kho thành công!",
      });
      setAdjustForm({
        product_id: "",
        transaction_type: "export",
        quantity: "",
        note: "",
      });
      fetchTabData(txPagination.current_page);
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Lỗi kiểm kho!",
      });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setMessage({ type: "", text: "" }), 2500);
    }
  };

  const handleAddPoItemRow = () =>
    setNewPoItems([
      ...newPoItems,
      { product_id: "", quantity: 1, import_price: "" },
    ]);
  const handleRemovePoItemRow = (index) =>
    setNewPoItems(newPoItems.filter((_, i) => i !== index));
  const handlePoItemChange = (index, field, value) => {
    const updated = [...newPoItems];
    updated[index][field] = value;
    setNewPoItems(updated);
  };

  const handleCreatePoSubmit = async (e) => {
    e.preventDefault();
    if (!newPoSupplier) return toast.warn("Vui lòng chọn nhà cung cấp!");
    if (newPoItems.some((i) => !i.product_id || !i.quantity || !i.import_price))
      return toast.warn("Vui lòng điền đủ thông tin các món nhập!");

    setIsProcessing(true);
    try {
      await adminInventoryService.createPurchaseOrder({
        supplier_id: newPoSupplier,
        items: newPoItems.map((i) => ({
          product_id: i.product_id,
          quantity: Number(i.quantity),
          import_price: Number(i.import_price),
        })),
      });
      setMessage({
        type: "success",
        text: "Nhập hàng và tăng tồn kho thành công!",
      });
      setIsNewPoOpen(false);
      setNewPoItems([{ product_id: "", quantity: 1, import_price: "" }]);
      setNewPoSupplier("");
      fetchTabData(1);
    } catch {
      setMessage({ type: "error", text: "Nhập kho thất bại!" });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setMessage({ type: "", text: "" }), 2500);
    }
  };

  const handleViewPoDetail = async (id) => {
    try {
      const res = await adminInventoryService.getPurchaseOrderDetail(id);
      setSelectedPO(res.data?.data);
      setIsPoDetailOpen(true);
    } catch {
      toast.error("Không thể lấy chi tiết hóa đơn!");
    }
  };

  const inputClass =
    "admin-input";

  return (
    <div className="admin-page-container">
      {/* TIÊU ĐỀ & TAB */}
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">
            Kiểm kho & Nhập hàng
          </h2>
          <p className="admin-page-subtitle">
            Theo dõi lịch sử biến động và đơn nhập
          </p>
        </div>

        <div className="bg-zinc-100/80 p-1 rounded-lg flex gap-1 border border-zinc-200/60">
          <button
            onClick={() => setActiveTab("movement")}
            className={`px-4 py-2 rounded text-xs font-medium transition-all ${activeTab === "movement" ? "bg-white text-zinc-800 shadow-sm border border-zinc-200/50" : "text-zinc-500 hover:text-zinc-700"}`}
          >
            Lịch sử biến động
          </button>
          <button
            onClick={() => setActiveTab("purchase")}
            className={`px-4 py-2 rounded text-xs font-medium transition-all ${activeTab === "purchase" ? "bg-white text-zinc-800 shadow-sm border border-zinc-200/50" : "text-zinc-500 hover:text-zinc-700"}`}
          >
            Nhập hàng (PO)
          </button>
        </div>
      </div>

      {/* THÔNG BÁO (TOAST) */}
      <AnimatePresence>
        {message.text && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`p-3 rounded-lg text-xs font-medium ${message.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-600 border border-red-200"}`}
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {activeTab === "movement" ? (
        <>
          {/* THANH CÔNG CỤ TAB 1 */}
          <div className="admin-card p-4 flex flex-col sm:flex-row gap-3 items-center">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-zinc-500">Mặt hàng:</span>
              <select
                value={filterProduct}
                onChange={(e) => setFilterProduct(e.target.value)}
                className="bg-[#f8f8fa] border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-700 outline-none focus:border-zinc-400 transition-colors w-full sm:w-64"
              >
                <option value="">Tất cả sản phẩm</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-zinc-500">Hình thức:</span>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-[#f8f8fa] border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-700 outline-none focus:border-zinc-400 transition-colors"
              >
                <option value="">Tất cả luồng</option>
                <option value="import">{TRANSACTION_TYPE_LABELS.import}</option>
                <option value="sale">{TRANSACTION_TYPE_LABELS.sale}</option>
                <option value="export">{TRANSACTION_TYPE_LABELS.export}</option>
                <option value="adjustment">{TRANSACTION_TYPE_LABELS.adjustment}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* BẢNG DANH SÁCH */}
            <div className="lg:col-span-8 admin-card overflow-hidden flex flex-col">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-zinc-50/60 border-b border-zinc-100 text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-5" style={{ width: "150px" }}>
                        Thời gian
                      </th>
                      <th className="py-3 px-3" style={{ width: "200px" }}>
                        Sản phẩm
                      </th>
                      <th
                        className="py-3 px-3 text-center"
                        style={{ width: "100px" }}
                      >
                        Loại
                      </th>
                      <th
                        className="py-3 px-3 text-right"
                        style={{ width: "90px" }}
                      >
                        Biến động
                      </th>
                      <th
                        className="py-3 px-3 text-center"
                        style={{ width: "120px" }}
                      >
                        Kho (Trước → Sau)
                      </th>
                      <th className="py-3 px-5" style={{ width: "200px" }}>
                        Lý do
                      </th>
                      <th className="py-3 px-5" style={{ width: "160px" }}>
                        Người thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan="7" className="py-16 text-center">
                          <div className="inline-block w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
                        </td>
                      </tr>
                    ) : transactions.length === 0 ? (
                      <tr>
                        <td
                          colSpan="7"
                          className="py-16 text-center text-xs text-zinc-400"
                        >
                          Không có dữ liệu
                        </td>
                      </tr>
                    ) : (
                      transactions.map((t) => (
                        <tr
                          key={t.id}
                          className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50/40 transition-colors"
                        >
                          <td className="py-3.5 px-5">
                            <span className="text-[11px] font-mono text-zinc-500">
                              {new Date(t.created_at).toLocaleString("vi-VN")}
                            </span>
                          </td>
                          <td className="py-3.5 px-3">
                            <p className="text-sm font-semibold text-zinc-800 truncate max-w-[180px]">
                              {t.product?.name || "Sản phẩm đã xóa"}
                            </p>
                            <p className="text-[10px] font-mono text-zinc-400">
                              {t.product?.sku}
                            </p>
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            <span className="px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded text-[10px] font-medium">
                              {TRANSACTION_TYPE_LABELS[t.transaction_type] || t.transaction_type}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            <span
                              className={`text-sm font-bold font-mono ${t.quantity > 0 ? "text-emerald-600" : "text-red-500"}`}
                            >
                              {t.quantity > 0 ? `+${t.quantity}` : t.quantity}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            <span className="text-xs font-mono text-zinc-500">
                              {t.before_quantity}{" "}
                              <span className="text-zinc-300 mx-1">→</span>{" "}
                              <span className="text-zinc-800 font-semibold">
                                {t.after_quantity}
                              </span>
                            </span>
                          </td>
                          <td className="py-3.5 px-5">
                            <p className="text-[11px] text-zinc-500 italic max-w-[180px] truncate">
                              {t.note}
                            </p>
                          </td>
                          <td className="py-3.5 px-5">
                            <p className="text-xs font-semibold text-zinc-700">
                              {t.creator?.full_name || "Không rõ"}
                            </p>
                            <p className="text-[10px] font-mono text-zinc-400">
                              {t.creator?.phone || ""}
                            </p>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {txPagination.last_page > 1 && (
                <div className="shrink-0 px-5 py-3 border-t border-zinc-100 flex justify-between items-center bg-zinc-50/50">
                  <span className="text-xs text-zinc-500">
                    Trang {txPagination.current_page} / {txPagination.last_page}
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={txPagination.current_page === 1}
                      onClick={() =>
                        fetchTabData(txPagination.current_page - 1)
                      }
                      className="admin-btn-outline"
                    >
                      Trước
                    </button>
                    <button
                      disabled={
                        txPagination.current_page === txPagination.last_page
                      }
                      onClick={() =>
                        fetchTabData(txPagination.current_page + 1)
                      }
                      className="admin-btn-outline"
                    >
                      Tiếp
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* BIỂU MẪU ĐIỀU CHỈNH */}
            <div className="lg:col-span-4 admin-card p-5 sticky top-5">
              <div className="border-b border-zinc-100 pb-3 mb-4">
                <h3 className="text-sm font-semibold text-zinc-800">
                  Kiểm kho thủ công
                </h3>
              </div>
              <form onSubmit={handleAdjustSubmit} className="space-y-4">
                <div>
                  <label className="admin-form-label">
                    Sản phẩm *
                  </label>
                  <select
                    required
                    value={adjustForm.product_id}
                    onChange={(e) =>
                      setAdjustForm({
                        ...adjustForm,
                        product_id: e.target.value,
                      })
                    }
                    className={inputClass}
                  >
                    <option value="" disabled>
                      Chọn hàng cân tồn
                    </option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Tồn: {p.stock_quantity})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="admin-form-label">
                    Loại điều chỉnh *
                  </label>
                  <select
                    required
                    value={adjustForm.transaction_type}
                    onChange={(e) =>
                      setAdjustForm({
                        ...adjustForm,
                        transaction_type: e.target.value,
                      })
                    }
                    className={inputClass}
                  >
                    <option value="export">{TRANSACTION_TYPE_LABELS.export}</option>
                    <option value="adjustment">{TRANSACTION_TYPE_LABELS.adjustment}</option>
                  </select>
                </div>
                <div>
                  <label className="admin-form-label">
                    Số lượng *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="VD: -2 hoặc 5"
                    value={adjustForm.quantity}
                    onChange={(e) =>
                      setAdjustForm({ ...adjustForm, quantity: e.target.value })
                    }
                    className={inputClass}
                  />
                  <p className="text-[10px] text-zinc-400 mt-1">
                    Nhập số âm (-) nếu xuất, dương (+) nếu nhập.
                  </p>
                </div>
                <div>
                  <label className="admin-form-label">
                    Ghi chú *
                  </label>
                  <textarea
                    rows="3"
                    required
                    placeholder="Lý do..."
                    value={adjustForm.note}
                    onChange={(e) =>
                      setAdjustForm({ ...adjustForm, note: e.target.value })
                    }
                    className={`${inputClass} resize-none`}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className={`w-full py-2.5 admin-btn-secondary ${isProcessing ? "opacity-60 cursor-not-allowed shadow-none hover:translate-y-0" : ""}`}
                >
                  {isProcessing ? "Đang xử lý..." : "Cập nhật kho"}
                </button>
              </form>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* THANH CÔNG CỤ TAB 2 */}
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setIsNewPoOpen(true)}
              className="admin-btn-primary flex items-center gap-2"
            >
              <span>+ Nhập hàng mới</span>
            </button>
          </div>

          <div className="admin-card overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-zinc-50/60 border-b border-zinc-100 text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-5">Mã chứng từ</th>
                    <th className="py-3 px-3">Nhà cung cấp</th>
                    <th className="py-3 px-3 text-right">Tổng chi</th>
                    <th className="py-3 px-3 text-center">Ngày lập</th>
                    <th className="py-3 px-3">Người nhập</th>
                    <th className="py-3 px-3 text-center">Trạng thái</th>
                    <th className="py-3 px-5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan="7" className="py-16 text-center">
                        <div className="inline-block w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
                      </td>
                    </tr>
                  ) : purchaseOrders.length === 0 ? (
                    <tr>
                      <td
                        colSpan="7"
                        className="py-16 text-center text-xs text-zinc-400"
                      >
                        Không có đơn nhập hàng nào
                      </td>
                    </tr>
                  ) : (
                    purchaseOrders.map((po) => (
                      <tr
                        key={po.id}
                        className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50/40 transition-colors group"
                      >
                        <td className="py-3.5 px-5">
                          <span className="text-xs font-mono font-medium text-zinc-700">
                            {po.purchase_code}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="text-sm font-semibold text-zinc-800">
                            {po.supplier?.name || "Đối tác vãng lai"}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <span className="text-sm font-semibold text-zinc-800">
                            {Number(po.total_amount).toLocaleString()}₫
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className="text-[11px] text-zinc-500">
                            {new Date(po.created_at).toLocaleDateString(
                              "vi-VN",
                            )}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <p className="text-xs font-semibold text-zinc-700">
                            {po.creator?.full_name || "Không rõ"}
                          </p>
                          <p className="text-[10px] font-mono text-zinc-400">
                            {po.creator?.phone || ""}
                          </p>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-emerald-700 bg-emerald-50">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Hoàn tất
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <button
                            onClick={() => handleViewPoDetail(po.id)}
                            className="admin-btn-outline px-3 py-1.5 opacity-0 group-hover:opacity-100"
                          >
                            Chi tiết
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {poPagination.last_page > 1 && (
              <div className="shrink-0 px-5 py-3 border-t border-zinc-100 flex justify-between items-center bg-zinc-50/50">
                <span className="text-xs text-zinc-500">
                  Trang {poPagination.current_page} / {poPagination.last_page}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={poPagination.current_page === 1}
                    onClick={() => fetchTabData(poPagination.current_page - 1)}
                    className="admin-btn-outline"
                  >
                    Trước
                  </button>
                  <button
                    disabled={
                      poPagination.current_page === poPagination.last_page
                    }
                    onClick={() => fetchTabData(poPagination.current_page + 1)}
                    className="admin-btn-outline"
                  >
                    Tiếp
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* CÁC CỬA SỔ (MODALS) */}
      <AnimatePresence>
        {/* CỬA SỔ NHẬP HÀNG MỚI */}
        {isNewPoOpen && (
          <div className="admin-modal-overlay">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-2xl rounded-2xl shadow-xl flex flex-col max-h-[85vh] overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-zinc-100 flex justify-between items-center">
                <h3 className="text-sm font-semibold text-zinc-800">
                  Nhập hàng mới
                </h3>
                <button
                  onClick={() => setIsNewPoOpen(false)}
                  className="text-zinc-400 hover:text-zinc-600"
                >
                  ✕
                </button>
              </div>

              <form
                onSubmit={handleCreatePoSubmit}
                className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar"
              >
                <div>
                  <label className="admin-form-label">
                    Nhà cung cấp *
                  </label>
                  <select
                    required
                    value={newPoSupplier}
                    onChange={(e) => setNewPoSupplier(e.target.value)}
                    className={inputClass}
                  >
                    <option value="" disabled>
                      Chọn đối tác
                    </option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-medium text-zinc-500">
                      Danh sách mặt hàng nhập
                    </label>
                    <button
                      type="button"
                      onClick={handleAddPoItemRow}
                      className="text-[11px] font-medium text-emerald-600 hover:text-emerald-700"
                    >
                      + Thêm dòng
                    </button>
                  </div>

                  <div className="space-y-2">
                    {newPoItems.map((item, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="flex-1">
                          <select
                            required
                            value={item.product_id}
                            onChange={(e) =>
                              handlePoItemChange(
                                index,
                                "product_id",
                                e.target.value,
                              )
                            }
                            className={`${inputClass} py-2`}
                          >
                            <option value="" disabled>
                              Chọn sản phẩm
                            </option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="w-24">
                          <input
                            type="number"
                            min="1"
                            required
                            placeholder="SL"
                            value={item.quantity}
                            onChange={(e) =>
                              handlePoItemChange(
                                index,
                                "quantity",
                                e.target.value,
                              )
                            }
                            className={`${inputClass} py-2 text-center`}
                          />
                        </div>
                        <div className="w-32">
                          <input
                            type="number"
                            min="0"
                            required
                            placeholder="Giá nhập"
                            value={item.import_price}
                            onChange={(e) =>
                              handlePoItemChange(
                                index,
                                "import_price",
                                e.target.value,
                              )
                            }
                            className={`${inputClass} py-2 text-right`}
                          />
                        </div>
                        <div className="w-8 flex justify-center">
                          {newPoItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemovePoItemRow(index)}
                              className="text-zinc-300 hover:text-red-500"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </form>

              <div className="px-6 py-4 border-t border-zinc-100 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsNewPoOpen(false)}
                  className="flex-1 py-2.5 admin-btn-outline"
                >
                  Hủy
                </button>
                <button
                  onClick={handleCreatePoSubmit}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 admin-btn-secondary disabled:opacity-60 disabled:hover:translate-y-0 disabled:shadow-none"
                >
                  {isProcessing ? "Đang xử lý..." : "Hoàn tất nhập kho"}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* CỬA SỔ CHI TIẾT PHIẾU NHẬP */}
        {isPoDetailOpen && selectedPO && (
          <div className="admin-modal-overlay">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="admin-modal-content"
            >
              <div className="px-6 py-4 border-b border-zinc-100 flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-800">
                    Chi tiết chứng từ
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    {selectedPO.purchase_code}
                  </p>
                </div>
                <button
                  onClick={() => setIsPoDetailOpen(false)}
                  className="text-zinc-400 hover:text-zinc-600"
                >
                  ✕
                </button>
              </div>

              <div className="p-6">
                <div className="bg-zinc-50 rounded-lg p-3 mb-5 border border-zinc-100">
                  <p className="text-[11px] text-zinc-500 mb-1">
                    Nhà cung cấp:
                  </p>
                  <p className="text-sm font-semibold text-zinc-800">
                    {selectedPO.supplier?.name}
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    SĐT: {selectedPO.supplier?.phone || "N/A"}
                  </p>
                </div>

                <div className="bg-zinc-50 rounded-lg p-3 mb-5 border border-zinc-100">
                  <p className="text-[11px] text-zinc-500 mb-1">
                    Người nhập kho:
                  </p>
                  <p className="text-sm font-semibold text-zinc-800">
                    {selectedPO.creator?.full_name || "Không rõ"}
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    SĐT: {selectedPO.creator?.phone || "N/A"}
                  </p>
                </div>

                <div className="border border-zinc-200/60 rounded-xl overflow-hidden mb-5">
                  <table className="w-full text-left">
                    <thead className="bg-zinc-50 border-b border-zinc-100 text-[10px] font-medium text-zinc-500 uppercase">
                      <tr>
                        <th className="px-3 py-2">Mặt hàng</th>
                        <th className="px-3 py-2 text-center">SL</th>
                        <th className="px-3 py-2 text-right">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {selectedPO.details?.map((d) => (
                        <tr key={d.id}>
                          <td className="px-3 py-2 text-xs font-semibold text-zinc-700">
                            {d.product?.name}
                          </td>
                          <td className="px-3 py-2 text-xs text-center">
                            {d.quantity}
                          </td>
                          <td className="px-3 py-2 text-xs text-right font-semibold text-zinc-800">
                            {Number(d.total_price).toLocaleString()}₫
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                  <span className="text-[11px] font-semibold text-emerald-800">
                    Tổng chi phí
                  </span>
                  <span className="text-base font-bold text-emerald-700">
                    {Number(selectedPO.total_amount).toLocaleString()} ₫
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InventoryManager;
