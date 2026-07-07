import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { adminBookingService } from "../../services/admin/bookingService";

const RecurringBookings = () => {
  const location = useLocation();
  const [masters, setMasters] = useState([]);
  const [selectedMaster, setSelectedMaster] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [courts, setCourts] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [searchTerm, setSearchTerm] = useState("");
  const [sessionSearchTerm, setSessionSearchTerm] = useState("");

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    actionData: null,
  });

  const [rescheduleModal, setRescheduleModal] = useState({
    isOpen: false,
    detailId: null,
    booking: null,
  });
  const [rescheduleForm, setRescheduleForm] = useState({
    court_id: "",
    booking_date: "",
    start_time: "",
    end_time: "",
  });
  const [isProcessing, setIsProcessing] = useState(false);

  const DAYS = [
    "",
    "Thứ 2",
    "Thứ 3",
    "Thứ 4",
    "Thứ 5",
    "Thứ 6",
    "Thứ 7",
    "Chủ nhật",
  ];

  const formatDaysOfWeek = (daysOfWeek) => {
    if (!daysOfWeek) return "—";
    const arr = Array.isArray(daysOfWeek) ? daysOfWeek : [daysOfWeek];
    return arr
      .slice()
      .sort((a, b) => a - b)
      .map((d) => DAYS[d] || `Ngày ${d}`)
      .join(", ");
  };

  // --- FETCH ---
  const fetchInitData = useCallback(async (search = "") => {
    setIsLoading(true);
    try {
      const [mastersRes, courtsRes] = await Promise.all([
        adminBookingService.getRecurringMasters(1, search),
        adminBookingService.getAllCourts(),
      ]);
      setMasters(mastersRes.data?.data || mastersRes.data || []);
      setCourts(courtsRes.data?.data || courtsRes.data || []);
    } catch (e) {
      console.error(e);
      setMessage({ type: "error", text: "Lỗi tải dữ liệu." });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const codeFromNotification = location.state?.notificationBookingCode;
    const timer = setTimeout(() => {
      if (codeFromNotification) {
        setSearchTerm(codeFromNotification);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [location.state?.notificationBookingCode]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInitData(searchTerm);
    }, 350);

    return () => clearTimeout(timer);
  }, [fetchInitData, searchTerm]);

  const handleSelectMaster = async (master) => {
    setSelectedMaster(master);
    setIsLoadingSessions(true);
    setSessionSearchTerm("");
    try {
      const res = await adminBookingService.getRecurringSessions(master.id);
      setSessions(res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  // --- FILTER ---
  const filteredMasters = useMemo(() => {
    if (!searchTerm) return masters;
    const lower = searchTerm.toLowerCase();
    return masters.filter(
      (m) =>
        m.recurring_code?.toLowerCase().includes(lower) ||
        m.user?.full_name?.toLowerCase().includes(lower) ||
        m.user?.phone?.includes(lower),
    );
  }, [masters, searchTerm]);

  const filteredSessions = useMemo(() => {
    if (!sessionSearchTerm) return sessions;
    const lower = sessionSearchTerm.toLowerCase();
    return sessions.filter(
      (s) =>
        s.booking_code?.toLowerCase().includes(lower) ||
        s.customer_name?.toLowerCase().includes(lower),
    );
  }, [sessions, sessionSearchTerm]);

  // --- ACTIONS ---
  const requestAction = (sessionBooking, type) => {
    let title = "";
    let msg = "";
    let payload = {};
    let actionType = "status";

    if (type === "confirm") {
      title = "Xác nhận duyệt ca";
      msg = "Xác nhận giữ sân cho ca đá này?";
      payload = { status: "confirmed" };
      actionType = "status";
    } else if (type === "complete") {
      title = "Hoàn thành ca chơi";
      msg = "Xác nhận kết thúc ca chơi này?";
      payload = { status: "completed" };
      actionType = "status";
    } else if (type === "pay") {
      title = "Xác nhận đã thu tiền";
      msg = "Xác nhận đã thu đủ tiền cho ca đá này?";
      payload = { payment_status: "paid" };
      actionType = "payment";
    } else if (type === "cancel") {
      title = "Hủy ca đá này";
      msg = "Chỉ hủy duy nhất ca đá này, không ảnh hưởng hợp đồng gốc.";
      payload = { status: "cancelled" };
      actionType = "status";
    }

    setConfirmModal({
      isOpen: true,
      title,
      message: msg,
      actionData: {
        id: sessionBooking.id,
        payload,
        actionType,
      },
    });
  };

  const executeAction = async () => {
    if (!confirmModal.actionData) return;

    setIsProcessing(true);

    try {
      const { id, payload, actionType } = confirmModal.actionData;

      if (actionType === "payment") {
        await adminBookingService.updatePayment(id, payload);
      } else {
        await adminBookingService.updateStatus(id, payload);
      }

      setMessage({ type: "success", text: "✓ Thành công!" });
      setConfirmModal({
        isOpen: false,
        title: "",
        message: "",
        actionData: null,
      });

      if (selectedMaster) {
        handleSelectMaster(selectedMaster);
      }
    } catch (e) {
      alert(e.response?.data?.message || "Lỗi hệ thống!");
    } finally {
      setIsProcessing(false);
      setTimeout(() => setMessage({ type: "", text: "" }), 2500);
    }
  };

  // --- RESCHEDULE ---
  const openRescheduleModal = (sessionBooking) => {
    const detail = sessionBooking.details?.[0];
    if (!detail) return alert("Không tìm thấy chi tiết ca chơi!");
    setRescheduleForm({
      court_id: detail.court_id,
      booking_date: detail.booking_date,
      start_time: detail.start_time.slice(0, 5),
      end_time: detail.end_time.slice(0, 5),
    });
    setRescheduleModal({
      isOpen: true,
      detailId: detail.id,
      booking: sessionBooking,
    });
  };

  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      await adminBookingService.rescheduleDetail(
        rescheduleModal.detailId,
        rescheduleForm,
      );
      setMessage({ type: "success", text: "Đổi lịch thành công!" });
      setRescheduleModal({ isOpen: false, detailId: null, booking: null });
      if (selectedMaster) handleSelectMaster(selectedMaster);
    } catch (error) {
      alert(error.response?.data?.message || "Có lỗi xảy ra!");
    } finally {
      setIsProcessing(false);
      setTimeout(() => setMessage({ type: "", text: "" }), 2500);
    }
  };

  // --- UTILS ---
  const statusConfig = {
    pending: {
      dot: "bg-amber-400",
      text: "text-amber-700",
      bg: "bg-amber-50",
      label: "Chờ",
    },
    confirmed: {
      dot: "bg-blue-500",
      text: "text-blue-700",
      bg: "bg-blue-50",
      label: "Đã chốt",
    },
    playing: {
      dot: "bg-violet-500",
      text: "text-violet-700",
      bg: "bg-violet-50",
      label: "Đang chơi",
    },
    completed: {
      dot: "bg-emerald-500",
      text: "text-emerald-700",
      bg: "bg-emerald-50",
      label: "Hoàn thành",
    },
    cancelled: {
      dot: "bg-zinc-400",
      text: "text-zinc-500",
      bg: "bg-zinc-100",
      label: "Hủy",
    },
  };

  const formatVN = (dateStr) =>
    dateStr ? dateStr.split("-").reverse().join("/") : "...";

  const inputClass =
    "admin-input";

  return (
    <div className="max-w-[1600px] mx-auto gap-4 h-[calc(100dvh-80px)] flex flex-col overflow-hidden">
      {/* THÔNG BÁO (TOAST) */}
      <AnimatePresence>
        {message.text && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`shrink-0 p-3 rounded-lg text-xs font-medium ${message.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-600 border border-red-200"}`}
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* BỐ CỤC CHIA ĐÔI CHÍNH */}
      <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
        {/* TRÁI — DANH SÁCH HỢP ĐỒNG */}
        <div className="col-span-4 admin-card border-none flex flex-col min-h-0 overflow-hidden">
          <div className="shrink-0 px-4 py-3 border-b border-zinc-100">
            <h2 className="text-sm font-semibold text-zinc-800 mb-2.5">
              Hợp đồng định kỳ
            </h2>
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400"
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
                placeholder="Tìm tên, SĐT, mã HĐ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="admin-input pl-9 py-2"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
              </div>
            ) : (
              filteredMasters.map((m) => {
                const isSelected = selectedMaster?.id === m.id;
                const isNotificationTarget =
                  location.state?.notificationBookingCode === m.recurring_code;
                return (
                  <button
                    key={m.id}
                    onClick={() => handleSelectMaster(m)}
                    className={`w-full p-3 rounded-lg border text-left transition-all duration-150 ${
                      isSelected
                        ? "bg-zinc-900 border-zinc-900 text-white"
                        : "bg-white border-zinc-100 hover:border-zinc-200"
                    } ${
                      isNotificationTarget && !isSelected
                        ? "ring-2 ring-emerald-300 bg-emerald-50"
                        : ""
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span
                        className={`text-[10px] font-mono ${isSelected ? "text-zinc-400" : "text-zinc-400"}`}
                      >
                        {m.recurring_code}
                      </span>
                      <span
                        className={`text-[10px] ${isSelected ? "text-zinc-400" : "text-zinc-400"}`}
                      >
                        {m.court?.name}
                      </span>
                    </div>
                    <p
                      className={`text-xs font-medium truncate ${isSelected ? "text-white" : "text-zinc-800"}`}
                    >
                      {m.user?.full_name || "Khách vãng lai"}
                    </p>
                    <p
                      className={`text-[11px] mt-0.5 ${isSelected ? "text-zinc-400" : "text-zinc-500"}`}
                    >
                      {m.user?.phone || "N/A"}
                    </p>
                    <div
                      className={`mt-2 pt-2 border-t border-dashed flex justify-between items-center text-[10px] ${isSelected ? "border-zinc-700 text-zinc-400" : "border-zinc-100 text-zinc-400"}`}
                    >
                      <span>
                        {formatDaysOfWeek(m.days_of_week ?? m.day_of_week)}
                      </span>
                      <span className="font-mono">
                        {formatVN(m.start_date)} → {formatVN(m.end_date)}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* PHẢI — BẢNG CHI TIẾT BUỔI CHƠI */}
        <div className="col-span-8 admin-card border-none flex flex-col min-h-0 overflow-hidden">
          {/* Session Header */}
          <div className="shrink-0 px-5 py-3.5 border-b border-zinc-100 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-500 font-medium text-xs shrink-0">
                {selectedMaster?.user?.full_name?.charAt(0).toUpperCase() ||
                  "?"}
              </div>
              <div>
                <h3 className="text-sm font-medium text-zinc-800">
                  {selectedMaster?.user?.full_name || "Chọn hợp đồng bên trái"}
                </h3>
                {selectedMaster && (
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-400">
                    <span>{selectedMaster.user?.phone}</span>
                    <span>·</span>
                    <span>
                      {formatDaysOfWeek(selectedMaster.days_of_week ?? selectedMaster.day_of_week)}
                    </span>
                    <span>·</span>
                    <span className="font-mono">
                      {formatVN(selectedMaster.start_date)} →{" "}
                      {formatVN(selectedMaster.end_date)}
                    </span>
                  </div>
                )}
              </div>
            </div>
            {selectedMaster && (
              <div className="relative w-44">
                <svg
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400"
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
                  placeholder="Tìm ca..."
                  value={sessionSearchTerm}
                  onChange={(e) => setSessionSearchTerm(e.target.value)}
                  className="admin-input w-full pl-8 pr-3 py-1.5 text-[11px]"
                />
              </div>
            )}
          </div>

          {/* Bảng buổi chơi */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-zinc-50/60 sticky top-0 z-10 border-b border-zinc-100">
                <tr className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                  <th className="py-2.5 px-5" style={{ width: "150px" }}>
                    Mã ca
                  </th>
                  <th className="py-2.5 px-3" style={{ width: "100px" }}>
                    Ngày
                  </th>
                  <th className="py-2.5 px-3" style={{ width: "100px" }}>
                    Giờ
                  </th>
                  <th
                    className="py-2.5 px-3 text-right"
                    style={{ width: "90px" }}
                  >
                    Số tiền
                  </th>
                  <th
                    className="py-2.5 px-3 text-center"
                    style={{ width: "80px" }}
                  >
                    Trạng thái
                  </th>
                  <th
                    className="py-2.5 px-5 text-right"
                    style={{ width: "200px" }}
                  >
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {!selectedMaster ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="py-20 text-center text-xs text-zinc-300"
                    >
                      ← Chọn hợp đồng bên trái để xem chi tiết
                    </td>
                  </tr>
                ) : isLoadingSessions ? (
                  <tr>
                    <td colSpan="6" className="py-20 text-center">
                      <div className="inline-block w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map((s) => {
                    const sc = statusConfig[s.status] || statusConfig.pending;
                    const isCancelled = s.status === "cancelled";
                    return (
                      <tr
                        key={s.id}
                        className={`border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50/40 transition-colors group ${isCancelled ? "opacity-45" : ""}`}
                      >
                        <td className="py-3 px-5 font-mono text-[11px] text-zinc-700">
                          {s.booking_code}
                        </td>
                        <td className="py-3 px-3 text-xs text-zinc-600">
                          {s.details?.[0]?.booking_date
                            ? formatVN(s.details[0].booking_date)
                            : "—"}
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-xs font-mono text-zinc-600">
                            {s.details?.[0]?.start_time?.slice(0, 5)} –{" "}
                            {s.details?.[0]?.end_time?.slice(0, 5)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <p className="text-xs font-semibold text-zinc-800">
                            {Number(s.total_price).toLocaleString()}₫
                          </p>
                          <p
                            className={`text-[10px] ${s.payment_status === "paid" ? "text-emerald-600" : "text-amber-500"}`}
                          >
                            {s.payment_status === "paid"
                              ? "✓ Đã thu"
                              : "○ Chưa thu"}
                          </p>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${sc.bg} ${sc.text}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}
                            />
                            {sc.label}
                          </span>
                        </td>
                        <td className="py-3 px-5 text-right">
                          <div className="flex items-center justify-end gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            {s.status === "pending" && (
                              <button
                                onClick={() => requestAction(s, "confirm")}
                                className="admin-btn-secondary px-2.5 py-1 text-[10px] font-medium"
                              >
                                Duyệt
                              </button>
                            )}
                            {s.payment_status !== "paid" && !isCancelled && (
                              <button
                                onClick={() => requestAction(s, "pay")}
                                className="admin-btn-primary px-2.5 py-1 text-[10px] font-medium"
                              >
                                Thu
                              </button>
                            )}
                            {["playing", "confirmed"].includes(s.status) && s.payment_status === "paid" && (
                              <button
                                onClick={() => requestAction(s, "complete")}
                                className="admin-btn-primary px-2.5 py-1 text-[10px] font-medium"
                              >
                                Hoàn thành
                              </button>
                            )}
                            {!["playing", "cancelled", "completed"].includes(s.status) && (
                              <button
                                onClick={() => openRescheduleModal(s)}
                                className="admin-btn-outline px-2.5 py-1 text-[10px]"
                              >
                                Đổi lịch
                              </button>
                            )}
                            {!["playing", "cancelled", "completed"].includes(s.status) && (
                              <button
                                onClick={() => requestAction(s, "cancel")}
                                className="admin-btn-outline px-2 py-1 text-[10px] hover:text-red-500 hover:border-red-200"
                              >
                                Hủy
                              </button>
                            )}
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
      </div>

      {/* CỬA SỔ XÁC NHẬN */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="admin-modal-overlay">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="admin-modal-content max-w-xs p-6 text-center"
            >
              <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-xl mx-auto mb-4">
                ⚠️
              </div>
              <h3 className="text-sm font-semibold text-zinc-800 mb-1">
                {confirmModal.title}
              </h3>
              <p className="text-xs text-zinc-500 mb-6 leading-relaxed">
                {confirmModal.message}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmModal({ isOpen: false })}
                  className="admin-btn-outline flex-1 py-2.5 text-xs font-medium"
                >
                  Hủy
                </button>
                <button
                  onClick={executeAction}
                  disabled={isProcessing}
                  className="admin-btn-secondary flex-1 py-2.5 text-xs font-medium"
                >
                  {isProcessing ? "..." : "Xác nhận"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CỬA SỔ ĐỔI LỊCH */}
      <AnimatePresence>
        {rescheduleModal.isOpen && (
          <div className="admin-modal-overlay">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="admin-modal-content"
            >
              <div className="admin-modal-header p-6 border-b border-zinc-100">
                <h3 className="text-sm font-semibold text-zinc-800">
                  Đổi lịch ca chơi
                </h3>
                <p className="admin-page-subtitle">
                  Ca:{" "}
                  <span className="text-zinc-600 font-mono">
                    {rescheduleModal.booking?.booking_code}
                  </span>
                </p>
              </div>
              <form onSubmit={handleRescheduleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="admin-form-label">
                    Sân
                  </label>
                  <select
                    required
                    value={rescheduleForm.court_id}
                    onChange={(e) =>
                      setRescheduleForm({
                        ...rescheduleForm,
                        court_id: e.target.value,
                      })
                    }
                    className={inputClass}
                  >
                    <option value="" disabled>
                      Chọn sân
                    </option>
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
                    required
                    value={rescheduleForm.booking_date}
                    onChange={(e) =>
                      setRescheduleForm({
                        ...rescheduleForm,
                        booking_date: e.target.value,
                      })
                    }
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="admin-form-label">
                      Bắt đầu
                    </label>
                    <input
                      type="time"
                      required
                      value={rescheduleForm.start_time}
                      onChange={(e) =>
                        setRescheduleForm({
                          ...rescheduleForm,
                          start_time: e.target.value,
                        })
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="admin-form-label">
                      Kết thúc
                    </label>
                    <input
                      type="time"
                      required
                      value={rescheduleForm.end_time}
                      onChange={(e) =>
                        setRescheduleForm({
                          ...rescheduleForm,
                          end_time: e.target.value,
                        })
                      }
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-3 border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={() =>
                      setRescheduleModal({
                        isOpen: false,
                        detailId: null,
                        booking: null,
                      })
                    }
                    className="admin-btn-outline flex-1 py-2.5 text-xs font-medium"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="admin-btn-secondary flex-1 py-2.5 text-xs font-medium"
                  >
                    {isProcessing ? "Đang xử lý..." : "Lưu lịch mới"}
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

export default RecurringBookings;
