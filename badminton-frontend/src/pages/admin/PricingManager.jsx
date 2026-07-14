import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { pricingService } from "../../services/admin/pricingService";
import { adminCourtService } from "../../services/admin/courtService";
import PriceHistory from "./PriceHistory";

const PricingManager = () => {
  const [activeTab, setActiveTab] = useState("config");
  const [courts, setCourts] = useState([]);
  const [pricings, setPricings] = useState([]);

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [editingGroup, setEditingGroup] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [calculator, setCalculator] = useState({
    court_id: "",
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
  const fetchSystemData = async () => {
    setIsLoading(true);
    try {
      const [courtRes, pricingRes] = await Promise.all([
        adminCourtService.getAllCourts(),
        pricingService.getAllPricings(),
      ]);
      const fetchedCourts = courtRes.data.data || [];
      const fetchedPricings = pricingRes.data.data || [];
      setCourts(fetchedCourts);
      setPricings(fetchedPricings);
      setCalculator((prev) => ({
        ...prev,
        court_id: prev.court_id || fetchedCourts[0]?.id || "",
      }));
    } catch (error) {
      setMessage({ type: "error", text: "Không thể tải dữ liệu." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemData();
  }, []);

  // Gộp bảng giá của mọi sân thành 1 danh sách mốc giá duy nhất (theo loại
  // ngày + khung giờ + thời vụ) — vì giá luôn áp dụng đồng nhất cho tất cả sân.
  const groupedPricings = useMemo(() => {
    const map = new Map();
    pricings.forEach((p) => {
      const key = [
        p.day_type,
        p.start_time.substring(0, 5),
        p.end_time.substring(0, 5),
        p.effective_from || "",
        p.effective_to || "",
      ].join("|");

      if (!map.has(key)) {
        map.set(key, {
          key,
          day_type: p.day_type,
          start_time: p.start_time.substring(0, 5),
          end_time: p.end_time.substring(0, 5),
          effective_from: p.effective_from,
          effective_to: p.effective_to,
          min_booking_minutes_set: new Set(),
          prices: new Set(),
          entries: [],
        });
      }
      const g = map.get(key);
      g.prices.add(Number(p.price));
      g.min_booking_minutes_set.add(Number(p.min_booking_minutes));
      g.entries.push({ id: p.id, court_id: p.court_id });
    });
    return Array.from(map.values()).sort((a, b) =>
      a.start_time.localeCompare(b.start_time),
    );
  }, [pricings]);

  // --- ACTIONS ---
  const handleOpenCreate = () => {
    setModalMode("create");
    setEditingGroup(null);
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

  const handleOpenEdit = (group) => {
    setModalMode("edit");
    setEditingGroup(group);
    setFormData({
      day_type: group.day_type,
      start_time: group.start_time,
      end_time: group.end_time,
      price: [...group.prices][0] ?? "",
      effective_from: group.effective_from || "",
      effective_to: group.effective_to || "",
      min_booking_minutes: group.min_booking_minutes_set.size > 0 ? [...group.min_booking_minutes_set][0] : 60,
    });
    setIsModalOpen(true);
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage({ type: "", text: "" });
    const basePayload = {
      ...formData,
      effective_from: formData.effective_from || null,
      effective_to: formData.effective_to || null,
      // Tạo mới: không gửi min_booking_minutes để backend giữ nguyên giá trị cũ
      // của bản ghi đã tồn tại (bản ghi mới sẽ nhận mặc định 60 phút).
      min_booking_minutes:
        modalMode === "edit" ? formData.min_booking_minutes : null,
    };

    try {
      // 1 request duy nhất — backend upsert cho tất cả sân trong 1 transaction,
      // lỗi giữa chừng thì rollback nên không bao giờ xảy ra lệch giá giữa các sân.
      await pricingService.bulkUpsertPricing({
        ...basePayload,
        entry_ids:
          modalMode === "edit" && editingGroup
            ? editingGroup.entries.map((en) => en.id)
            : [],
      });
      setMessage({
        type: "success",
        text: `Đã áp dụng giá cho tất cả ${courts.length} sân!`,
      });
      setIsModalOpen(false);
      fetchSystemData();
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Thao tác thất bại.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGroup = async (group) => {
    if (!window.confirm("Xóa mốc giá này khỏi tất cả các sân?")) return;
    try {
      await pricingService.bulkDeletePricing(group.entries.map((en) => en.id));
      setMessage({ type: "success", text: "Đã xóa mốc giá." });
      fetchSystemData();
    } catch (error) {
      setMessage({ type: "error", text: "Xóa thất bại." });
    }
  };

  const handleRunCalculator = async (e) => {
    e.preventDefault();
    setCalculator((prev) => ({ ...prev, loading: true, result: null }));
    try {
      const res = await pricingService.calculatePrice({
        court_id: calculator.court_id,
        date: calculator.date,
        start_time: calculator.start_time,
        end_time: calculator.end_time,
      });
      setCalculator((prev) => ({ ...prev, loading: false, result: res.data }));
    } catch (error) {
      alert(error.response?.data?.message || "Khung giờ không hợp lệ.");
      setCalculator((prev) => ({ ...prev, loading: false }));
    }
  };

  const inputClass =
    "admin-input";
  const calcInputClass =
    "admin-input bg-zinc-50";

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
          <h2 className="admin-page-title">
            Cấu hình bảng giá
          </h2>
          <p className="admin-page-subtitle">
            Mỗi mốc giá áp dụng chung cho tất cả các sân — không cần cấu hình riêng từng sân
          </p>
        </div>
      </div>

      {/* TAB CHUYỂN GIỮA CẤU HÌNH GIÁ VÀ LỊCH SỬ SỬA GIÁ */}
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

          {/* CALCULATOR */}
          <div className="admin-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center gap-2">
              <span className="w-5 h-5 bg-zinc-100 rounded flex items-center justify-center text-[10px]">
                ⚡
              </span>
              <h3 className="text-xs font-medium text-zinc-700">
                Kiểm tra giá cộng dồn
              </h3>
            </div>
            <form
              onSubmit={handleRunCalculator}
              className="p-5 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
            >
              <div>
                <label className="admin-form-label">
                  Sân
                </label>
                <select
                  value={calculator.court_id}
                  onChange={(e) =>
                    setCalculator({ ...calculator, court_id: e.target.value })
                  }
                  className={calcInputClass}
                >
                  {courts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="admin-form-label">
                  Ngày
                </label>
                <input
                  type="date"
                  value={calculator.date}
                  onChange={(e) =>
                    setCalculator({ ...calculator, date: e.target.value })
                  }
                  className={calcInputClass}
                />
              </div>
              <div>
                <label className="admin-form-label">
                  Bắt đầu
                </label>
                <input
                  type="time"
                  value={calculator.start_time}
                  onChange={(e) =>
                    setCalculator({ ...calculator, start_time: e.target.value })
                  }
                  className={calcInputClass}
                />
              </div>
              <div>
                <label className="admin-form-label">
                  Kết thúc
                </label>
                <input
                  type="time"
                  value={calculator.end_time}
                  onChange={(e) =>
                    setCalculator({ ...calculator, end_time: e.target.value })
                  }
                  className={calcInputClass}
                />
              </div>
              <button
                type="submit"
                disabled={calculator.loading}
                className="admin-btn-secondary h-[38px] w-full"
              >
                {calculator.loading ? "Đang tính..." : "Kiểm tra"}
              </button>
            </form>

            <AnimatePresence>
              {calculator.result && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-5 pb-5"
                >
                  <div className="bg-zinc-50 rounded-lg border border-zinc-100 p-4 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] text-zinc-400 mb-1.5 uppercase font-medium">
                        Chi tiết block
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {calculator.result.details.map((d, i) => (
                          <span
                            key={i}
                            className="text-[11px] bg-white text-zinc-600 px-2.5 py-1 rounded border border-zinc-200"
                          >
                            {d.khung_gia}:{" "}
                            <strong className="text-zinc-800">
                              {d.thanh_tien.toLocaleString()}₫
                            </strong>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="admin-stat-label lbl-default">
                        Tổng dự kiến
                      </p>
                      <p className="admin-stat-value val-default">
                        {calculator.result.total_price.toLocaleString()}₫
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* BẢNG GIÁ DUY NHẤT — ÁP DỤNG CHO TẤT CẢ SÂN */}
          <div className="admin-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-zinc-100 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-medium text-zinc-800">
                  Bảng giá chung
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {groupedPricings.length} mốc giá · áp dụng cho {courts.length} sân
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
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider bg-zinc-50/60 border-b border-zinc-100">
                    <th className="text-left py-3 px-5" style={{ width: "120px" }}>
                      Loại ngày
                    </th>
                    <th className="text-left py-3 px-3" style={{ width: "130px" }}>
                      Khung giờ
                    </th>
                    <th className="text-right py-3 px-3" style={{ width: "130px" }}>
                      Đơn giá/h
                    </th>
                    <th className="text-left py-3 px-3" style={{ width: "160px" }}>
                      Hiệu lực
                    </th>
                    <th className="text-center py-3 px-3" style={{ width: "100px" }}>
                      Độ phủ
                    </th>
                    <th className="text-right py-3 px-5" style={{ width: "100px" }}>
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan="6" className="py-16 text-center">
                        <div className="inline-block w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
                      </td>
                    </tr>
                  ) : groupedPricings.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-16 text-center text-xs text-zinc-400">
                        Chưa cấu hình mốc giá nào
                      </td>
                    </tr>
                  ) : (
                    groupedPricings.map((group) => {
                      const dtc = dayTypeConfig[group.day_type] || dayTypeConfig.weekday;
                      const isSeason = group.effective_from;
                      const priceList = [...group.prices];
                      const isConsistent = priceList.length === 1;
                      const fullyCovered = group.entries.length >= courts.length;
                      return (
                        <tr
                          key={group.key}
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
                              {group.start_time} – {group.end_time}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            {isConsistent ? (
                              <span className="text-sm font-semibold text-zinc-800">
                                {priceList[0].toLocaleString()}₫
                              </span>
                            ) : (
                              <span
                                className="text-[11px] font-semibold text-amber-600"
                                title="Các sân đang lệch giá — bấm Sửa để đồng nhất"
                              >
                                {Math.min(...priceList).toLocaleString()}–{Math.max(...priceList).toLocaleString()}₫
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {isSeason ? (
                              <span className="text-[11px] text-amber-600">
                                {group.effective_from} → {group.effective_to || "∞"}
                              </span>
                            ) : (
                              <span className="text-[11px] text-zinc-400">
                                Cố định
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${
                                fullyCovered
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-amber-50 text-amber-700"
                              }`}
                            >
                              {group.entries.length}/{courts.length} sân
                            </span>
                          </td>
                          <td className="py-3 px-5 text-right">
                            <div className="flex items-center justify-end gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleOpenEdit(group)}
                                className="admin-btn-outline px-2.5 py-1 text-[10px]"
                              >
                                Sửa
                              </button>
                              <button
                                onClick={() => handleDeleteGroup(group)}
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

          {/* CỬA SỔ (MODAL) */}
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
                        {modalMode === "create" ? "Tạo mốc giá" : "Cập nhật giá"}
                      </h4>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Áp dụng cho tất cả {courts.length} sân
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
                        <label className="admin-form-label">
                          Loại ngày *
                        </label>
                        <select
                          value={formData.day_type}
                          onChange={(e) =>
                            setFormData({ ...formData, day_type: e.target.value })
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
                            setFormData({ ...formData, start_time: e.target.value })
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
                            setFormData({ ...formData, end_time: e.target.value })
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
