import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { adminCourtService } from "../../services/admin/courtService";

const CourtManager = () => {
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
    if (!window.confirm(`Xóa vĩnh viễn "${name}" khỏi hệ thống?`)) return;
    try {
      await adminCourtService.deleteCourt(id);
      setMessage({ type: "success", text: `Đã xóa ${name}.` });
      fetchCourts();
    } catch (error) {
      setMessage({
        type: "error",
        text: "Không thể xóa — sân đang vướng dữ liệu booking.",
      });
    }
  };

  const totalCourts = courts.length;
  const activeCourts = courts.filter((c) => c.status === "active").length;
  const maintenanceCourts = totalCourts - activeCourts;

  const inputClass =
    "w-full bg-[#f8f8fa] border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200 transition-all";

  return (
    <div className="max-w-[1400px] mx-auto space-y-5">
      {/* HEADER + STATS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-800">Quản lý sân</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Cơ sở vật chất, thảm trải và đèn chiếu sáng
          </p>
        </div>
        <div className="flex gap-2.5">
          <div className="bg-white border border-zinc-200/60 px-4 py-2 rounded-lg text-center min-w-[70px]">
            <p className="text-lg font-bold text-zinc-800">{totalCourts}</p>
            <p className="text-[10px] text-zinc-400 uppercase">Tổng sân</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200/60 px-4 py-2 rounded-lg text-center min-w-[70px]">
            <p className="text-lg font-bold text-emerald-600">{activeCourts}</p>
            <p className="text-[10px] text-emerald-500 uppercase">Sẵn sàng</p>
          </div>
          {maintenanceCourts > 0 && (
            <div className="bg-red-50 border border-red-200/60 px-4 py-2 rounded-lg text-center min-w-[70px]">
              <p className="text-lg font-bold text-red-500">
                {maintenanceCourts}
              </p>
              <p className="text-[10px] text-red-400 uppercase">Bảo trì</p>
            </div>
          )}
        </div>
      </div>

      {/* TOAST */}
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

      {/* TOOLBAR */}
      <div className="bg-white rounded-xl border border-zinc-200/60 p-4 flex justify-between items-center">
        <p className="text-xs text-zinc-500">{totalCourts} sân đang quản lý</p>
        <button
          onClick={handleOpenCreate}
          className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-medium transition-colors"
        >
          + Thêm sân mới
        </button>
      </div>

      {/* COURT GRID */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-zinc-200/60 p-16 text-center">
          <div className="inline-block w-6 h-6 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin mb-3" />
          <p className="text-xs text-zinc-400">Đang tải...</p>
        </div>
      ) : courts.length === 0 ? (
        <div className="bg-white rounded-xl border border-zinc-200/60 p-16 text-center">
          <p className="text-3xl mb-2 opacity-30">🏸</p>
          <p className="text-sm text-zinc-400">
            Chưa có sân nào trong hệ thống
          </p>
          <button
            onClick={handleOpenCreate}
            className="mt-4 px-4 py-2 bg-zinc-900 text-white rounded-lg text-xs font-medium hover:bg-zinc-800 transition-colors"
          >
            Thêm sân đầu tiên
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {courts.map((court, i) => {
            const isActive = court.status === "active";
            return (
              <motion.div
                key={court.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`bg-white rounded-xl border overflow-hidden transition-all group ${isActive ? "border-zinc-200/60 hover:border-zinc-300" : "border-zinc-200/60 opacity-60"}`}
              >
                {/* Color strip */}
                <div
                  className={`h-1 ${isActive ? "bg-lime-500" : "bg-zinc-300"}`}
                />

                <div className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div>
                      <span className="text-[10px] font-mono text-zinc-400">
                        {court.court_code}
                      </span>
                      <h4 className="text-sm font-semibold text-zinc-800 mt-0.5">
                        {court.name}
                      </h4>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${isActive ? "text-emerald-700 bg-emerald-50" : "text-zinc-500 bg-zinc-100"}`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-zinc-400"}`}
                      />
                      {isActive ? "Hoạt động" : "Bảo trì"}
                    </span>
                  </div>

                  {/* Details */}
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

                  {/* Actions */}
                  <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-end gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleOpenEdit(court)}
                      className="px-3 py-1.5 text-zinc-500 hover:bg-zinc-100 text-[11px] font-medium rounded-lg transition-colors"
                    >
                      Chỉnh sửa
                    </button>
                    <button
                      onClick={() => handleDeleteCourt(court.id, court.name)}
                      className="px-3 py-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 text-[11px] font-medium rounded-lg transition-colors"
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

      {/* MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div
            onClick={() => setIsModalOpen(false)}
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between">
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
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">
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
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">
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
                    <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">
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
                    <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">
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
                  <span className="text-xs text-zinc-600">Trạng thái</span>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value })
                    }
                    className="bg-[#f8f8fa] border border-zinc-200 rounded-lg text-xs px-3 py-2 text-zinc-700 outline-none focus:border-zinc-400 transition-colors"
                  >
                    <option value="active">Hoạt động</option>
                    <option value="inactive">Bảo trì</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-3 border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-lg text-xs font-medium transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className={`flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-medium transition-colors ${isSaving ? "opacity-60" : ""}`}
                  >
                    {isSaving ? "Đang lưu..." : "Lưu dữ liệu"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CourtManager;
