import React, { useState, useEffect } from "react";
import { toast } from "../../utils/toast";
import { motion, AnimatePresence } from "framer-motion";
import { pricingService } from "../../services/admin/pricingService";
import PriceHistory from "./PriceHistory";

const PricingManager = () => {
  const [activeTab, setActiveTab] = useState("config");
  const [pricings, setPricings] = useState([]);

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [editingEntry, setEditingEntry] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [calculator, setCalculator] = useState({
    date: new Date().toISOString().split("T")[0],
    start_time: "17:00",
    end_time: "19:00",
    result: null,
    loading: false,
  });

  const [formData, setFormData] = useState({
    day_type: "weekday",
    start_time: "05:00",
    end_time: "17:00",
    price: "",
    effective_from: "",
    effective_to: "",
    min_booking_minutes: 60,
  });

  // --- FETCH ---
  const fetchPricings = async () => {
    setIsLoading(true);
    try {
      const res = await pricingService.getAllPricings();
      setPricings(res.data.data || []);
    } catch {
      setMessage({ type: "error", text: "Không thể tải dữ liệu." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPricings();
  }, []);

  // --- ACTIONS ---
  const handleOpenCreate = () => {
    setModalMode("create");
    setEditingEntry(null);
    setFormData({
      day_type: "weekday",
      start_time: "05:00",
      end_time: "17:00",
      price: "",
      effective_from: "",
      effective_to: "",
      min_booking_minutes: 60,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p) => {
    setModalMode("edit");
    setEditingEntry(p);
    setFormData({
      day_type: p.day_type,
      start_time: p.start_time.substring(0, 5),
      end_time: p.end_time.substring(0, 5),
      price: p.price,
      effective_from: p.effective_from || "",
      effective_to: p.effective_to || "",
      min_booking_minutes: p.min_booking_minutes || 60,
    });
    setIsModalOpen(true);
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage({ type: "", text: "" });
    const payload = {
      ...formData,
      effective_from: formData.effective_from || null,
      effective_to: formData.effective_to || null,
      min_booking_minutes:
        modalMode === "edit" ? formData.min_booking_minutes : null,
      entry_ids: modalMode === "edit" && editingEntry ? [editingEntry.id] : [],
    };

    try {
      await pricingService.bulkUpsertPricing(payload);
      setMessage({
        type: "success",
        text:
          modalMode === "create"
            ? "Đã tạo mốc giá mới!"
            : "Đã cập nhật mốc giá!",
      });
      setIsModalOpen(false);
      fetchPricings();
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Thao tác thất bại.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm("Xóa mốc giá này?")) return;
    try {
      await pricingService.bulkDeletePricing([p.id]);
      setMessage({ type: "success", text: "Đã xóa mốc giá." });
      fetchPricings();
    } catch {
      setMessage({ type: "error", text: "Xóa thất bại." });
    }
  };

  const handleRunCalculator = async (e) => {
    e.preventDefault();
    setCalculator((prev) => ({ ...prev, loading: true, result: null }));
    try {
      const res = await pricingService.calculatePrice({
        date: calculator.date,
        start_time: calculator.start_time,
        end_time: calculator.end_time,
      });
      setCalculator((prev) => ({ ...prev, loading: false, result: res.data }));
    } catch (error) {
      toast.error(error.response?.data?.message || "Khung giờ không hợp lệ.");
      setCalculator((prev) => ({ ...prev, loading: false }));
    }
  };

  const inputClass = "admin-input";
  const calcInputClass = "admin-input bg-zinc-50";

  const dayTypeConfig = {
    weekday: { label: "Ngày thường", bg: "bg-blue-50", text: "text-blue-700" },
    weekend: {
      label: "Cuối tuần",
      bg: "bg-violet-50",
      text: "text-violet-700",
    },
    holiday: { label: "Ngày lễ", bg: "bg-red-50", text: "text-red-700" },
  };

  return (
    <div className="admin-page-container">
      {/* TIÊU ĐỀ */}
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">Cấu hình bảng giá</h2>
          <p className="admin-page-subtitle">
            Mỗi mốc giá áp dụng chung cho tất cả sân — không cần cấu hình riêng
            từng sân
          </p>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-1 border-b border-zinc-200">
        {[
          { key: "config", label: "Cấu hình giá" },
          { key: "history", label: "Lịch sử sửa giá" },
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

      {activeTab === "history" && <PriceHistory embedded />}

      {activeTab === "config" && (
        <>
          <AnimatePresence>
            {message.text && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={`p-3 rounded-lg text-xs font-medium ${
                  message.type === "success"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-red-50 text-red-600 border border-red-200"
                }`}
              >
                {message.text}
              </motion.div>
            )}
          </AnimatePresence>



          {/* BẢNG GIÁ CHUNG */}
          <div className="admin-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-zinc-100 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-medium text-zinc-800">
                  Bảng giá chung
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {pricings.length} mốc giá · áp dụng cho tất cả sân
                </p>
              </div>
              <button
                onClick={handleOpenCreate}
                className="admin-btn-primary px-4 py-2"
              >
                + Thêm mốc giá
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider bg-zinc-50/60 border-b border-zinc-100">
                    <th
                      className="text-left py-3 px-5"
                      style={{ width: "120px" }}
                    >
                      Loại ngày
                    </th>
                    <th
                      className="text-left py-3 px-3"
                      style={{ width: "130px" }}
                    >
                      Khung giờ
                    </th>
                    <th
                      className="text-right py-3 px-3"
                      style={{ width: "130px" }}
                    >
                      Đơn giá/h
                    </th>
                    <th
                      className="text-left py-3 px-3"
                      style={{ width: "160px" }}
                    >
                      Hiệu lực
                    </th>
                    <th
                      className="text-right py-3 px-5"
                      style={{ width: "100px" }}
                    >
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan="5" className="py-16 text-center">
                        <div className="inline-block w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
                      </td>
                    </tr>
                  ) : pricings.length === 0 ? (
                    <tr>
                      <td
                        colSpan="5"
                        className="py-16 text-center text-xs text-zinc-400"
                      >
                        Chưa cấu hình mốc giá nào
                      </td>
                    </tr>
                  ) : (
                    pricings.map((p) => {
                      const dtc =
                        dayTypeConfig[p.day_type] || dayTypeConfig.weekday;
                      const isSeason = p.effective_from;
                      return (
                        <tr
                          key={p.id}
                          className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50/40 transition-colors group"
                        >
                          <td className="py-3 px-5">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${dtc.bg} ${dtc.text}`}
                            >
                              {dtc.label}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-xs font-mono text-zinc-600">
                              {p.start_time.substring(0, 5)} –{" "}
                              {p.end_time.substring(0, 5)}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className="text-sm font-semibold text-zinc-800">
                              {Number(p.price).toLocaleString()}₫
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            {isSeason ? (
                              <span className="text-[11px] text-amber-600">
                                {p.effective_from} → {p.effective_to || "∞"}
                              </span>
                            ) : (
                              <span className="text-[11px] text-zinc-400">
                                Cố định
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-5 text-right">
                            <div className="flex items-center justify-end gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleOpenEdit(p)}
                                className="admin-btn-outline px-2.5 py-1 text-[10px]"
                              >
                                Sửa
                              </button>
                              <button
                                onClick={() => handleDelete(p)}
                                className="admin-btn-outline px-2 py-1 text-[10px] hover:text-red-500 hover:border-red-200"
                              >
                                Xóa
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* MODAL */}
          <AnimatePresence>
            {isModalOpen && (
              <div
                onClick={() => setIsModalOpen(false)}
                className="admin-modal-overlay"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={(e) => e.stopPropagation()}
                  className="admin-modal-content"
                >
                  <div className="admin-modal-header">
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-800">
                        {modalMode === "create"
                          ? "Tạo mốc giá"
                          : "Cập nhật giá"}
                      </h4>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Áp dụng cho tất cả sân
                      </p>
                    </div>
                    <button
                      onClick={() => setIsModalOpen(false)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors text-sm"
                    >
                      ✕
                    </button>
                  </div>
                  <form onSubmit={handleSubmitForm} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="admin-form-label">Loại ngày *</label>
                        <select
                          value={formData.day_type}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              day_type: e.target.value,
                            })
                          }
                          className={inputClass}
                        >
                          <option value="weekday">Ngày thường</option>
                          <option value="weekend">Cuối tuần</option>
                          <option value="holiday">Ngày lễ</option>
                        </select>
                      </div>
                      <div>
                        <label className="admin-form-label">
                          Đơn giá (VNĐ/h) *
                        </label>
                        <input
                          type="number"
                          required
                          placeholder="100000"
                          min="0"
                          value={formData.price}
                          onChange={(e) =>
                            setFormData({ ...formData, price: e.target.value })
                          }
                          className={inputClass}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="admin-form-label">
                          Giờ bắt đầu *
                        </label>
                        <input
                          type="time"
                          required
                          value={formData.start_time}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              start_time: e.target.value,
                            })
                          }
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="admin-form-label">
                          Giờ kết thúc *
                        </label>
                        <input
                          type="time"
                          required
                          value={formData.end_time}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              end_time: e.target.value,
                            })
                          }
                          className={inputClass}
                        />
                      </div>
                    </div>
                    <div className="bg-zinc-50 rounded-lg border border-zinc-100 p-4 space-y-3">
                      <p className="text-[11px] font-medium text-zinc-600">
                        Thời vụ (tùy chọn)
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-1">
                            Từ ngày
                          </label>
                          <input
                            type="date"
                            value={formData.effective_from}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                effective_from: e.target.value,
                              })
                            }
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-1">
                            Đến ngày
                          </label>
                          <input
                            type="date"
                            value={formData.effective_to}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                effective_to: e.target.value,
                              })
                            }
                            className={inputClass}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-3 border-t border-zinc-100">
                      <button
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        className="admin-btn-outline flex-1 py-2.5 text-xs font-medium"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="admin-btn-secondary flex-1 py-2.5 text-xs font-medium disabled:opacity-60"
                      >
                        {isSaving ? "Đang lưu..." : "Xác nhận"}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
};

export default PricingManager;
