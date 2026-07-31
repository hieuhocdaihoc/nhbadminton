import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { adminCourtService } from "../../services/admin/courtService";
import { Grid3X3 } from "lucide-react";
import EmptyState from "../../components/admin/EmptyState";
import LoadingSpinner from "../../components/admin/LoadingSpinner";
import CourtPerformance from "./CourtPerformance";

const CourtManager = () => {
  const [activeTab, setActiveTab] = useState("list");
  const [courts, setCourts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [selectedCourtId, setSelectedCourtId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    court_code: "",
    floor_type: "Thảm BWF Tiêu chuẩn",
    has_lighting: true,
    capacity: 4,
    location_note: "",
    is_maintenance: false,
    is_contract_only: false,
    status: "active",
  });

  // --- FETCH ---
  const fetchCourts = async () => {
    setIsLoading(true);
    try {
      const response = await adminCourtService.getAllCourts();
      setCourts(response.data.data || []);
    } catch (error) {
      setMessage({ type: "error", text: "Không thể tải dữ liệu sân." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCourts();
  }, []);

  // --- ACTIONS ---
  const handleOpenCreate = () => {
    setModalMode("create");
    setSelectedCourtId(null);
    setFormData({
      name: "",
      court_code: `SAN_${Date.now().toString().slice(-4)}`,
      floor_type: "Thảm BWF Tiêu chuẩn",
      has_lighting: true,
      capacity: 4,
      location_note: "Khu vực cụm chính",
      is_maintenance: false,
      is_contract_only: false,
      status: "active",
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (court) => {
    setModalMode("edit");
    setSelectedCourtId(court.id);
    setFormData({
      name: court.name,
      court_code: court.court_code,
      floor_type: court.floor_type || "Thảm BWF Tiêu chuẩn",
      has_lighting: court.has_lighting ? true : false,
      capacity: court.capacity || 4,
      location_note: court.location_note || "",
      is_maintenance: Boolean(court.is_maintenance),
      is_contract_only: court.is_contract_only ? true : false,
      status: court.status || "active",
    });
    setIsModalOpen(true);
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage({ type: "", text: "" });
    const payload = {
      ...formData,
      has_lighting: formData.has_lighting ? 1 : 0,
      is_maintenance: formData.is_maintenance ? 1 : 0,
      capacity: formData.capacity ? parseInt(formData.capacity) : null,
    };
    try {
      if (modalMode === "create") {
        await adminCourtService.createCourt(payload);
        setMessage({ type: "success", text: "Thêm sân mới thành công!" });
      } else {
        await adminCourtService.updateCourt(selectedCourtId, payload);
        setMessage({ type: "success", text: "Cập nhật thông số thành công!" });
      }
      setIsModalOpen(false);
      fetchCourts();
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Lưu dữ liệu thất bại.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCourt = async (id, name) => {
    if (!window.confirm(`Xóa "${name}"? Nếu sân chưa từng có đơn đặt nào sẽ bị xóa vĩnh viễn, ngược lại chỉ chuyển sang ngưng hoạt động.`)) return;
    try {
      const res = await adminCourtService.deleteCourt(id);
      setMessage({ type: "success", text: res.data?.message || `Đã xử lý ${name}.` });
      fetchCourts();
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Thao tác thất bại.",
      });
    }
  };

  const totalCourts = courts.length;
  const availableCourts = courts.filter(
    (court) => court.status === "active" && !court.is_maintenance,
  ).length;
  const maintenanceCourts = courts.filter(
    (court) => court.status === "active" && court.is_maintenance,
  ).length;
  const inactiveCourts = courts.filter(
    (court) => court.status === "inactive",
  ).length;

  const inputClass =
    "admin-input";

  return (
    <div className="admin-page-container">
      {/* TIÊU ĐỀ + THỐNG KÊ */}
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">Quản lý sân</h2>
          <p className="admin-page-subtitle">
            Cơ sở vật chất và báo cáo hiệu suất sử dụng sân
          </p>
        </div>
        {activeTab === "list" && (
          <div className="flex gap-2.5">
            <div className="admin-stat-badge badge-default">
              <p className="admin-stat-value val-default">{totalCourts}</p>
              <p className="admin-stat-label lbl-default">Tổng sân</p>
            </div>
            <div className="admin-stat-badge badge-success">
              <p className="admin-stat-value val-success">{availableCourts}</p>
              <p className="admin-stat-label lbl-success">Sẵn sàng</p>
            </div>
            {maintenanceCourts > 0 && (
              <div className="admin-stat-badge badge-danger">
                <p className="admin-stat-value val-danger">
                  {maintenanceCourts}
                </p>
                <p className="admin-stat-label lbl-danger">Bảo trì</p>
              </div>
            )}
            {inactiveCourts > 0 && (
              <div className="admin-stat-badge badge-default">
                <p className="admin-stat-value val-default">{inactiveCourts}</p>
                <p className="admin-stat-label lbl-default">Ngừng HĐ</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* TAB CHUYỂN GIỮA DANH SÁCH SÂN VÀ HIỆU SUẤT */}
      <div className="flex gap-1 border-b border-zinc-200">
        {[
          { key: "list", label: "Danh sách sân" },
          { key: "performance", label: "Hiệu suất & doanh thu" },
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

      {activeTab === "performance" && <CourtPerformance embedded />}

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
      <div className="admin-card p-4 flex justify-between items-center">
        <p className="text-xs text-zinc-500">{totalCourts} sân đang quản lý</p>
        <button
          onClick={handleOpenCreate}
          className="admin-btn-primary"
        >
          + Thêm sân mới
        </button>
      </div>

      {/* LƯỚI SÂN */}
      {isLoading ? (
        <div className="admin-card border-none">
          <LoadingSpinner label="Đang tải..." />
        </div>
      ) : courts.length === 0 ? (
        <div className="admin-card border-none">
          <EmptyState
            icon={Grid3X3}
            title="Chưa có sân nào trong hệ thống"
            action={
              <button
                onClick={handleOpenCreate}
                className="admin-btn-secondary px-4 py-2"
              >
                Thêm sân đầu tiên
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {courts.map((court, i) => {
            const isInactive = court.status === "inactive";
            const isMaintenance = !isInactive && Boolean(court.is_maintenance);
            const isAvailable = !isInactive && !isMaintenance;
            const stateLabel = isInactive
              ? "Ngừng hoạt động"
              : isMaintenance
                ? "Đang bảo trì"
                : "Sẵn sàng";
            const stateClass = isInactive
              ? "text-zinc-500 bg-zinc-100"
              : isMaintenance
                ? "text-amber-700 bg-amber-50"
                : "text-emerald-700 bg-emerald-50";
            const stateDotClass = isInactive
              ? "bg-zinc-400"
              : isMaintenance
                ? "bg-amber-500"
                : "bg-emerald-500";
            return (
              <motion.div
                key={court.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`admin-card overflow-hidden group ${isInactive ? "border-zinc-200/60 opacity-60" : "border-zinc-200/60 hover:border-zinc-300"}`}
              >
                {/* Dải màu */}
                <div
                  className={`h-1 ${isAvailable ? "bg-emerald-500" : isMaintenance ? "bg-amber-400" : "bg-zinc-300"}`}
                />

                <div className="p-5">
                  {/* TIÊU ĐỀ */}
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div>
                      <span className="text-[10px] font-mono text-zinc-400">
                        {court.court_code}
                      </span>
                      <h4 className="text-sm font-semibold text-zinc-800 mt-0.5">
                        {court.name}
                      </h4>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${stateClass}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${stateDotClass}`}
                        />
                        {stateLabel}
                      </span>
                      {court.is_contract_only && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium text-violet-700 bg-violet-50">
                          Sân hội viên
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Chi tiết */}
                  <div className="space-y-2.5 text-xs border-t border-zinc-100 pt-4">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Bề mặt</span>
                      <span className="text-zinc-700">
                        {court.floor_type || "Tiêu chuẩn"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Đèn chiếu sáng</span>
                      <span className="text-zinc-700">
                        {court.has_lighting ? "Có" : "Không"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Sức chứa</span>
                      <span className="text-zinc-700">
                        {court.capacity || 4} người
                      </span>
                    </div>
                  </div>

                  {/* Hành động */}
                  <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-end gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleOpenEdit(court)}
                      className="admin-btn-outline"
                    >
                      Chỉnh sửa
                    </button>
                    <button
                      onClick={() => handleDeleteCourt(court.id, court.name)}
                      className="admin-btn-danger"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

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
                    {modalMode === "create"
                      ? "Thêm sân mới"
                      : "Cập nhật thông số"}
                  </h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Điền thông tin bên dưới
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
                <div>
                  <label className="admin-form-label">
                    Tên sân *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="admin-form-label">
                    Mã tra cứu *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.court_code}
                    onChange={(e) =>
                      setFormData({ ...formData, court_code: e.target.value })
                    }
                    className={`${inputClass} font-mono`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="admin-form-label">
                      Loại thảm
                    </label>
                    <input
                      type="text"
                      value={formData.floor_type}
                      onChange={(e) =>
                        setFormData({ ...formData, floor_type: e.target.value })
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="admin-form-label">
                      Sức chứa
                    </label>
                    <input
                      type="number"
                      value={formData.capacity}
                      onChange={(e) =>
                        setFormData({ ...formData, capacity: e.target.value })
                      }
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs text-zinc-600">Hệ thống đèn chiếu sáng</span>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, has_lighting: !formData.has_lighting })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.has_lighting ? "bg-zinc-900" : "bg-zinc-300"}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${formData.has_lighting ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between py-1">
                  <div>
                    <span className="text-xs text-zinc-600">Chỉ dành cho hội viên</span>
                    <p className="text-[10px] text-zinc-400 mt-0.5">Ẩn với khách thường, chỉ hiển thị cho khách đang có thẻ thành viên hoạt động</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, is_contract_only: !formData.is_contract_only })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${formData.is_contract_only ? "bg-violet-600" : "bg-zinc-300"}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${formData.is_contract_only ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>
                <div>
                  <label className="admin-form-label">
                    Vị trí trong trung tâm
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Khu A - Tầng 1, Cụm sân chính..."
                    value={formData.location_note}
                    onChange={(e) => setFormData({ ...formData, location_note: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs text-zinc-600">Trạng thái</span>
                  <select
                    value={formData.status}
                    onChange={(e) => {
                      const status = e.target.value;
                      setFormData({
                        ...formData,
                        status,
                        is_maintenance:
                          status === "inactive"
                            ? false
                            : formData.is_maintenance,
                      });
                    }}
                    className="admin-input"
                  >
                    <option value="active">Đang khai thác</option>
                    <option value="inactive">Ngừng hoạt động / Ẩn</option>
                  </select>
                </div>
                <div className="flex items-center justify-between gap-4 py-1">
                  <div>
                    <span className="text-xs text-zinc-600">Bảo trì tạm thời</span>
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      {formData.status === "inactive"
                        ? "Chỉ bật được khi sân đang khai thác"
                        : "Bật để tạm ngừng nhận lịch đặt mới"}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={formData.status === "inactive"}
                    onClick={() =>
                      setFormData({
                        ...formData,
                        is_maintenance: !formData.is_maintenance,
                      })
                    }
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${formData.is_maintenance ? "bg-amber-500" : "bg-zinc-300"}`}
                    aria-label="Bật hoặc tắt bảo trì tạm thời"
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${formData.is_maintenance ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
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
                    {isSaving ? "Đang lưu..." : "Lưu dữ liệu"}
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

export default CourtManager;
