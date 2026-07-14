import { Fragment, useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { adminBookingService } from "../../services/admin/bookingService";
import { ClipboardList } from "lucide-react";
import EmptyState from "../../components/admin/EmptyState";
import LoadingSpinner from "../../components/admin/LoadingSpinner";
import {
  groupByProximity,
  relativeDayLabel,
  relativeDayStyle,
} from "../../utils/bookingDateGroups";

const SingleBookings = () => {
  const location = useLocation();
  const [bookings, setBookings] = useState([]);
  const [courts, setCourts] = useState([]);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // MODAL XÁC NHẬN CƠ BẢN (Duyệt, Thu tiền, Hủy)
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    actionData: null,
  });
  const [isProcessing, setIsProcessing] = useState(false);

  // STATE CHO MODAL ĐỔI LỊCH
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

  // --- TẢI DỮ LIỆU ---
  const fetchData = useCallback(async (page, search = "") => {
    setIsLoading(true);
    try {
      const res = await adminBookingService.getSingleBookings(page, search);
      setBookings(res.data?.data || []);
      setPagination({
        current_page: res.data?.current_page || 1,
        last_page: res.data?.last_page || 1,
      });
      const courtRes = await adminBookingService.getAllCourts();
      setCourts(courtRes.data?.data || courtRes.data || []);
    } catch (error) {
      console.error(error);
      setMessage({
        type: "error",
        text: "Lỗi tải dữ liệu. Vui lòng kiểm tra API.",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const codeFromNotification = location.state?.notificationBookingCode;
    const timer = setTimeout(() => {
      if (codeFromNotification) {
        setSearchTerm(codeFromNotification);
        setFilterStatus("all");
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [location.state?.notificationBookingCode]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData(1, searchTerm);
    }, 350);

    return () => clearTimeout(timer);
  }, [fetchData, searchTerm]);

  // --- LỌC TÌM KIẾM ---
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const matchSearch =
        !searchTerm ||
        b.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.customer_phone?.includes(searchTerm) ||
        b.booking_code?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = filterStatus === "all" || b.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [bookings, searchTerm, filterStatus]);

  // Sắp xếp & chia nhóm theo độ gần của ngày chơi: Hôm nay → Ngày mai → 7 ngày tới
  // → Sắp tới → Đã diễn ra (mới nhất trước). Cùng ngày thì theo giờ bắt đầu.
  const groupedBookings = useMemo(
    () =>
      groupByProximity(
        filteredBookings,
        (b) => b.details?.[0]?.booking_date,
        (b) => b.details?.[0]?.start_time || "",
      ),
    [filteredBookings],
  );

  // --- LOGIC XÁC NHẬN ---
  const requestAction = (booking, type) => {
    let title = "";
    let msg = "";
    let payload = {};
    let actionType = "status";

    if (type === "pay") {
      title = "Xác nhận đã thu tiền";
      msg = `Xác nhận ${booking.customer_name} đã thanh toán đủ tiền sân?`;
      payload = { payment_status: "paid" };
      actionType = "payment";
    } else if (type === "complete") {
      title = "Hoàn thành ca chơi";
      msg = `Xác nhận kết thúc ca chơi của ${booking.customer_name}?`;
      payload = { status: "completed" };
      actionType = "status";
    } else if (type === "cancel") {
      title = "Hủy đơn đặt sân";
      msg = `Hủy lịch đá của ${booking.customer_name}. Bạn có chắc chắn?`;
      payload = { status: "cancelled" };
      actionType = "status";
    }

    setConfirmModal({
      isOpen: true,
      title,
      message: msg,
      actionData: {
        id: booking.id,
        payload,
        actionType,
      },
    });
  };

  const executeAction = async () => {
    if (!confirmModal.actionData) return;
    setIsProcessing(true);
    try {
      if (confirmModal.actionData.actionType === "payment") {
        await adminBookingService.updatePayment(
          confirmModal.actionData.id,
          confirmModal.actionData.payload,
        );
      } else {
        await adminBookingService.updateStatus(
          confirmModal.actionData.id,
          confirmModal.actionData.payload,
        );
      }
      setMessage({ type: "success", text: "✓ Thao tác thành công!" });
      setConfirmModal({
        isOpen: false,
        title: "",
        message: "",
        actionData: null,
      });
      fetchData(pagination.current_page, searchTerm);
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || "Có lỗi xảy ra trong quá trình xử lý!");
    } finally {
      setIsProcessing(false);
      setTimeout(() => setMessage({ type: "", text: "" }), 2500);
    }
  };



  // --- LOGIC ĐỔI LỊCH ---
  const openRescheduleModal = (booking) => {
    const detail = booking.details?.[0];
    if (!detail) return alert("Không tìm thấy chi tiết ca chơi!");
    setRescheduleForm({
      court_id: detail.court_id,
      booking_date: detail.booking_date,
      start_time: detail.start_time.slice(0, 5),
      end_time: detail.end_time.slice(0, 5),
    });
    setRescheduleModal({ isOpen: true, detailId: detail.id, booking });
  };

  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      await adminBookingService.rescheduleDetail(
        rescheduleModal.detailId,
        rescheduleForm,
      );
      setMessage({
        type: "success",
        text: "Đổi lịch thành công! Hệ thống đã tự động tính lại giá.",
      });
      setRescheduleModal({ isOpen: false, detailId: null, booking: null });
      fetchData(pagination.current_page, searchTerm);
    } catch (error) {
      const errorMsg =
        error.response?.data?.message || "Có lỗi xảy ra khi đổi lịch!";
      alert(errorMsg);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setMessage({ type: "", text: "" }), 2500);
    }
  };

  // --- TIỆN ÍCH ---
  const statusConfig = {
    confirmed: {
      dot: "bg-blue-500",
      text: "text-blue-700",
      bg: "bg-blue-50",
      label: "Đã xác nhận",
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
      label: "Đã hủy",
    },
  };

  const filterTabs = [
    { key: "all", label: "Tất cả", count: bookings.length },
    {
      key: "confirmed",
      label: "Đã xác nhận",
      count: bookings.filter((b) => b.status === "confirmed").length,
    },
    {
      key: "playing",
      label: "Đang chơi",
      count: bookings.filter((b) => b.status === "playing").length,
    },
    {
      key: "completed",
      label: "Hoàn thành",
      count: bookings.filter((b) => b.status === "completed").length,
    },
    {
      key: "cancelled",
      label: "Đã hủy",
      count: bookings.filter((b) => b.status === "cancelled").length,
    },
  ];

  const inputClass =
    "admin-input placeholder:text-zinc-400";

  return (
    <div className="admin-page-container">
      {/* TOAST MESSAGE */}
      <AnimatePresence>
        {message.text && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${message.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-600 border border-red-200"}`}
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* THANH CÔNG CỤ */}
      <div className="admin-card p-4">
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
          {/* Search */}
          <div className="relative w-full lg:w-80">
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
              placeholder="Tìm tên, SĐT hoặc mã đơn..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="admin-input pl-10 py-2.5"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg overflow-x-auto">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilterStatus(tab.key)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-medium whitespace-nowrap transition-all ${filterStatus === tab.key ? "bg-white text-zinc-800 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span
                    className={`ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full ${filterStatus === tab.key ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-500"}`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* BOOKING CARDS */}
      {isLoading ? (
        <div className="admin-card border-none">
          <LoadingSpinner label="Đang tải dữ liệu..." />
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="admin-card border-none">
          <EmptyState icon={ClipboardList} title="Không tìm thấy đơn đặt sân nào" />
        </div>
      ) : (
        <div className="space-y-6">
          {groupedBookings.map((group) => (
            <div key={group.key}>
              {/* Group header */}
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className={`text-[10px] font-bold uppercase tracking-widest ${group.key === "today" ? "text-emerald-600" : group.key === "past" ? "text-zinc-400" : "text-zinc-500"}`}>
                  {group.label}
                </span>
                <span className="text-[10px] text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded-full">
                  {group.items.length} đơn
                </span>
                <div className="flex-1 h-px bg-zinc-100" />
              </div>

              {/* Cards grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {group.items.map((b) => {
                  const detail = b.details?.[0];
                  const courtName = detail?.court?.name || `Sân ${detail?.court_id?.slice(-2) || "..."}`;
                  const dateStr = detail?.booking_date
                    ? new Date(detail.booking_date).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
                    : "—";
                  const timeStr = detail
                    ? `${detail.start_time.slice(0, 5)} – ${detail.end_time.slice(0, 5)}`
                    : "—";
                  const sc = statusConfig[b.status] || statusConfig.confirmed;
                  const isCancelled = b.status === "cancelled";
                  const isNotificationTarget = location.state?.notificationBookingCode === b.booking_code;

                  // border-left color per status
                  const borderAccent = {
                    confirmed: "border-l-blue-400",
                    playing: "border-l-violet-500",
                    completed: "border-l-emerald-500",
                    cancelled: "border-l-zinc-300",
                  }[b.status] || "border-l-blue-400";

                  return (
                    <div
                      key={b.id}
                      className={`bg-white rounded-xl border border-zinc-200 border-l-4 ${borderAccent} shadow-sm hover:shadow-md transition-shadow group ${isCancelled ? "opacity-50" : ""} ${isNotificationTarget ? "ring-2 ring-emerald-300" : ""}`}
                    >
                      {/* Card header */}
                      <div className="flex items-start justify-between px-4 pt-4 pb-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 ${sc.dot.replace("bg-", "bg-")}`}
                            style={{ background: b.status === "confirmed" ? "#3b82f6" : b.status === "playing" ? "#8b5cf6" : b.status === "completed" ? "#10b981" : "#a1a1aa" }}
                          >
                            {b.customer_name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-zinc-800 truncate leading-tight">
                              {b.customer_name}
                            </p>
                            <p className="text-[10px] text-zinc-400 font-mono truncate">
                              {b.booking_code}
                            </p>
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${sc.bg} ${sc.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                          {sc.label}
                        </span>
                      </div>

                      {/* Card body */}
                      <div className="px-4 pb-3 grid grid-cols-2 gap-y-2 gap-x-3 border-t border-zinc-100 pt-3">
                        <div>
                          <p className="text-[9px] text-zinc-400 uppercase tracking-wider mb-0.5">Ngày</p>
                          <p className="text-xs text-zinc-700 font-medium">{dateStr}</p>
                          {detail?.booking_date && (
                            <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium ${relativeDayStyle(detail.booking_date)}`}>
                              {relativeDayLabel(detail.booking_date)}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="text-[9px] text-zinc-400 uppercase tracking-wider mb-0.5">Giờ</p>
                          <p className="text-xs text-zinc-700 font-mono font-medium">{timeStr}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-zinc-400 uppercase tracking-wider mb-0.5">Sân</p>
                          <p className="text-xs text-zinc-700 font-medium">{courtName}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-zinc-400 uppercase tracking-wider mb-0.5">SĐT</p>
                          <p className="text-xs text-zinc-700">{b.customer_phone || "—"}</p>
                        </div>
                      </div>

                      {/* Card footer: price + actions */}
                      <div className="flex items-center justify-between px-4 py-2.5 border-t border-zinc-100 bg-zinc-50/50 rounded-b-xl">
                        <div>
                          <p className="text-sm font-bold text-zinc-800">
                            {Number(b.total_price).toLocaleString()}₫
                          </p>
                          <p className={`text-[10px] ${b.payment_status === "paid" ? "text-emerald-600" : "text-amber-500"}`}>
                            {b.payment_status === "paid" ? "✓ Đã thu" : "○ Chưa thu"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {b.payment_status !== "paid" && !isCancelled && (
                            <button onClick={() => requestAction(b, "pay")} className="admin-btn-primary px-2.5 py-1 text-[10px] font-medium">
                              Thu tiền
                            </button>
                          )}
                          {["playing", "confirmed"].includes(b.status) && b.payment_status === "paid" && (
                            <button onClick={() => requestAction(b, "complete")} className="admin-btn-primary px-2.5 py-1 text-[10px] font-medium">
                              Hoàn thành
                            </button>
                          )}
                          {!isCancelled && !["playing", "completed"].includes(b.status) && (
                            <button onClick={() => openRescheduleModal(b)} className="admin-btn-outline px-2.5 py-1 text-[10px]">
                              Đổi lịch
                            </button>
                          )}
                          {!["playing", "cancelled", "completed"].includes(b.status) && (
                            <button onClick={() => requestAction(b, "cancel")} className="admin-btn-outline px-2.5 py-1 text-[10px] hover:text-red-500 hover:border-red-200">
                              Hủy
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PAGINATION */}
      {pagination.last_page > 1 && (
        <div className="flex justify-between items-center py-2">
          <span className="text-xs text-zinc-400">
            Trang {pagination.current_page} / {pagination.last_page}
          </span>
          <div className="flex gap-2">
            <button
              disabled={pagination.current_page === 1}
              onClick={() => fetchData(pagination.current_page - 1, searchTerm)}
              className="admin-btn-outline px-3.5 py-2 text-xs disabled:opacity-40"
            >
              ← Trước
            </button>
            <button
              disabled={pagination.current_page === pagination.last_page}
              onClick={() => fetchData(pagination.current_page + 1, searchTerm)}
              className="admin-btn-outline px-3.5 py-2 text-xs disabled:opacity-40"
            >
              Tiếp →
            </button>
          </div>
        </div>
      )}

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
                  Khách:{" "}
                  <span className="text-zinc-600">
                    {rescheduleModal.booking?.customer_name}
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
                  onClick={() =>
                    setConfirmModal({
                      isOpen: false,
                      title: "",
                      message: "",
                      actionData: null,
                    })
                  }
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

    </div>
  );
};

export default SingleBookings;
