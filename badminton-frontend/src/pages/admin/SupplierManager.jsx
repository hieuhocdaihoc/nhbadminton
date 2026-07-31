import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { adminSupplierService } from "../../services/admin/supplierService";

const SupplierManager = () => {
  const [activeTab, setActiveTab] = useState("list");
  const [suppliers, setSuppliers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [searchKeyword, setSearchKeyword] = useState("");
  const [stats, setStats] = useState({ total: 0, total_orders: 0, total_import_amount: 0 });

  const [form, setForm] = useState({
    id: null,
    name: "",
    phone: "",
    email: "",
    address: "",
    contact_person: "",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchSuppliers = async () => {
    setIsLoading(true);
    try {
      const res = await adminSupplierService.getSuppliers(searchKeyword);
      setSuppliers(res.data?.data || []);
      setStats(res.data?.stats || { total: 0, total_orders: 0, total_import_amount: 0 });
    } catch (error) {
      setMessage({
        type: "error",
        text: "Không thể tải danh sách nhà cung cấp.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Chỉ tải lần đầu; các lần tìm kiếm được kích hoạt bởi biểu mẫu.
  useEffect(() => {
    fetchSuppliers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Top nhà cung cấp theo tổng tiền đã nhập — tính từ dữ liệu đã tải (không phân trang)
  const topSuppliers = useMemo(() => {
    return [...suppliers]
      .map((s) => ({
        id: s.id,
        name: s.name,
        orderCount: s.purchase_orders_count || 0,
        totalAmount: Number(s.total_import_amount || 0),
      }))
      .filter((s) => s.orderCount > 0)
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [suppliers]);

  const maxSupplierAmount = Math.max(1, ...topSuppliers.map((s) => s.totalAmount));

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchSuppliers();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    setIsProcessing(true);
    setMessage({ type: "", text: "" });

    const payload = {
      name: form.name,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      contact_person: form.contact_person || null,
    };

    try {
      if (isEditing) {
        await adminSupplierService.updateSupplier(form.id, payload);
        setMessage({ type: "success", text: "Cập nhật đối tác thành công!" });
      } else {
        await adminSupplierService.createSupplier(payload);
        setMessage({ type: "success", text: "Thêm nhà cung cấp thành công!" });
      }
      resetForm();
      fetchSuppliers();
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Có lỗi xảy ra!",
      });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setMessage({ type: "", text: "" }), 2500);
    }
  };

  const handleEditClick = (supplier) => {
    setIsEditing(true);
    setForm({
      id: supplier.id,
      name: supplier.name,
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
      contact_person: supplier.contact_person || "",
    });
  };

  const handleDeleteClick = async (supplier) => {
    if (window.confirm(`Xóa vĩnh viễn nhà cung cấp [${supplier.name}]?`)) {
      try {
        await adminSupplierService.deleteSupplier(supplier.id);
        setMessage({ type: "success", text: "Đã xóa nhà cung cấp!" });
        fetchSuppliers();
      } catch (error) {
        setMessage({
          type: "error",
          text: error.response?.data?.message || "Không thể xóa nhà cung cấp!",
        });
      } finally {
        setTimeout(() => setMessage({ type: "", text: "" }), 2500);
      }
    }
  };

  const resetForm = () => {
    setForm({
      id: null,
      name: "",
      phone: "",
      email: "",
      address: "",
      contact_person: "",
    });
    setIsEditing(false);
  };

  const inputClass =
    "admin-input";

  return (
    <div className="admin-page-container">
      {/* TIÊU ĐỀ */}
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">
            Nhà cung cấp
          </h2>
          <p className="admin-page-subtitle">
            Quản lý đối tác phân phối hàng hóa và dịch vụ
          </p>
        </div>
        <div className="admin-stat-group">
          <div className="admin-stat-badge badge-default">
            <p className="admin-stat-value val-default">{stats.total}</p>
            <p className="admin-stat-label lbl-default">Nhà cung cấp</p>
          </div>
          <div className="admin-stat-badge badge-default">
            <p className="admin-stat-value val-default">{stats.total_orders}</p>
            <p className="admin-stat-label lbl-default">Phiếu nhập</p>
          </div>
          <div className="admin-stat-badge badge-success">
            <p className="admin-stat-value val-success">{Number(stats.total_import_amount || 0).toLocaleString()}đ</p>
            <p className="admin-stat-label lbl-success">Tổng tiền nhập</p>
          </div>
        </div>
      </div>

      {/* TAB CHUYỂN GIỮA DANH SÁCH VÀ BÁO CÁO */}
      <div className="flex gap-1 border-b border-zinc-200">
        {[
          { key: "list", label: "Danh sách" },
          { key: "report", label: "Báo cáo nhập hàng" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === t.key
                ? "border-emerald-500 text-emerald-600"
                : "border-transparent text-zinc-400 hover:text-zinc-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "report" && (
        <div className="admin-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-zinc-100">
            <h3 className="text-sm font-medium text-zinc-800">Top nhà cung cấp theo tổng tiền nhập</h3>
          </div>
          {topSuppliers.length === 0 ? (
            <p className="p-16 text-center text-sm text-zinc-400">Chưa có phiếu nhập hàng nào.</p>
          ) : (
            <div className="divide-y divide-zinc-100">
              {topSuppliers.map((s, i) => (
                <div key={s.id} className="flex items-center gap-4 px-5 py-3.5">
                  <span className="text-xs font-bold text-zinc-300 w-4">{i + 1}</span>
                  <div className="min-w-0 w-40 shrink-0">
                    <p className="text-xs font-medium text-zinc-800 truncate">{s.name}</p>
                    <p className="text-[10px] text-zinc-400">{s.orderCount} phiếu nhập</p>
                  </div>
                  <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${(s.totalAmount / maxSupplierAmount) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-zinc-800 w-28 text-right shrink-0">
                    {s.totalAmount.toLocaleString()}đ
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "list" && (
        <>
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

      {/* THANH CÔNG CỤ */}
      <div className="admin-card p-4">
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
          <form
            onSubmit={handleSearchSubmit}
            className="relative w-full sm:w-80"
          >
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              placeholder="Tìm tên hoặc số điện thoại..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="admin-input pl-10 py-2.5"
            />
            <button type="submit" className="hidden"></button>
          </form>
          <span className="text-[11px] text-zinc-400 font-medium">
            Tổng: {suppliers.length} đối tác
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* BẢNG DANH SÁCH (TRÁI) */}
        <div className="lg:col-span-8 admin-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-zinc-50/60 border-b border-zinc-100 text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-5" style={{ width: "220px" }}>
                    Công ty / Đại diện
                  </th>
                  <th className="py-3 px-3" style={{ width: "120px" }}>
                    Liên hệ
                  </th>
                  <th className="py-3 px-3" style={{ width: "180px" }}>
                    Địa chỉ
                  </th>
                  <th
                    className="py-3 px-5 text-right"
                    style={{ width: "100px" }}
                  >
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan="4" className="py-16 text-center">
                      <div className="inline-block w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
                    </td>
                  </tr>
                ) : suppliers.length === 0 ? (
                  <tr>
                    <td
                      colSpan="4"
                      className="py-16 text-center text-xs text-zinc-400"
                    >
                      Không tìm thấy nhà cung cấp nào
                    </td>
                  </tr>
                ) : (
                  suppliers.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50/40 transition-colors group"
                    >
                      <td className="py-3.5 px-5">
                        <p className="text-sm font-semibold text-zinc-800">
                          {s.name}
                        </p>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          {s.contact_person || (
                            <span className="italic text-zinc-400">
                              Không rõ đại diện
                            </span>
                          )}
                        </p>
                      </td>
                      <td className="py-3.5 px-3">
                        <p className="text-xs font-mono text-zinc-700">
                          {s.phone || (
                            <span className="italic text-zinc-400">Trống</span>
                          )}
                        </p>
                        {s.email && (
                          <p className="text-[10px] text-zinc-500 mt-0.5">
                            {s.email}
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-3">
                        <p className="text-xs text-zinc-600 max-w-[200px] truncate">
                          {s.address || (
                            <span className="italic text-zinc-400">
                              Chưa có
                            </span>
                          )}
                        </p>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEditClick(s)}
                            className="admin-btn-outline px-2.5 py-1 text-[10px]"
                          >
                            Sửa
                          </button>
                          <button
                            onClick={() => handleDeleteClick(s)}
                            className="admin-btn-outline px-2 py-1 text-[10px] hover:text-red-500 hover:border-red-200"
                          >
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* BIỂU MẪU (PHẢI) */}
        <div className="lg:col-span-4 admin-card p-5 sticky top-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-100">
            <h3 className="text-sm font-semibold text-zinc-800">
              {isEditing ? "Sửa nhà cung cấp" : "Thêm nhà cung cấp"}
            </h3>
            {isEditing && (
              <button
                onClick={resetForm}
                className="text-[10px] font-medium text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                Hủy sửa
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="admin-form-label">
                Tên công ty / Đối tác *
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputClass}
                placeholder="VD: Công ty TNHH ABC"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="admin-form-label">
                  Số điện thoại
                </label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={inputClass}
                  placeholder="0987..."
                />
              </div>
              <div>
                <label className="admin-form-label">
                  Người đại diện
                </label>
                <input
                  type="text"
                  value={form.contact_person}
                  onChange={(e) =>
                    setForm({ ...form, contact_person: e.target.value })
                  }
                  className={inputClass}
                  placeholder="Nguyễn Văn A"
                />
              </div>
            </div>

            <div>
              <label className="admin-form-label">
                Email liên hệ
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputClass}
                placeholder="contact@example.com"
              />
            </div>

            <div>
              <label className="admin-form-label">
                Địa chỉ
              </label>
              <textarea
                rows="2"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className={`${inputClass} resize-none`}
                placeholder="Địa chỉ kho / văn phòng"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isProcessing || !form.name.trim()}
                className={`w-full py-2.5 ${isEditing ? "admin-btn-secondary" : "admin-btn-primary"} ${isProcessing || !form.name.trim() ? "opacity-60 cursor-not-allowed shadow-none hover:translate-y-0" : ""}`}
              >
                {isProcessing
                  ? "Đang lưu..."
                  : isEditing
                    ? "Lưu thay đổi"
                    : "Tạo nhà cung cấp"}
              </button>
            </div>
          </form>
        </div>
      </div>
        </>
      )}
    </div>
  );
};

export default SupplierManager;
