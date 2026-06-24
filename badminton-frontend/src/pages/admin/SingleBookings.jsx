import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { adminBookingService } from "../../services/admin/bookingService";

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

  // --- LOGIC XÁC NHẬN ---
  const requestAction = (booking, type) => {
    let title = "";
    let msg = "";
    let payload = {};
    let actionType = "status";

    if (type === "confirm") {
      title = "Xác nhận duyệt đơn";
      msg = `Xác nhận giữ sân cho khách hàng ${booking.customer_name}?`;
      payload = { status: "confirmed" };
      actionType = "status";
    } else if (type === "pay") {
      title = "Xác nhận đã thu tiền";
      msg = `Xác nhận ${booking.customer_name} đã thanh toán đủ tiền sân?`;
      payload = { payment_status: "paid" };
      actionType = "payment";
    } else if (type === "checkin") {
      title = "Check-in khách";
      msg = `Xác nhận khách hàng ${booking.customer_name} đã đến sân và bắt đầu chơi?`;
      payload = { status: "playing" };
      actionType = "status";
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
      alert(error.response?.data?.message || "❌ Có lỗi xảy ra trong quá trình xử lý!");
    } finally {
      setIsProcessing(false);
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
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
      alert("❌ " + errorMsg);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setMessage({ type: "", text: "" }), 4000);
    }
  };

  // --- TIỆN ÍCH ---
  const statusConfig = {
    pending: {
      dot: "bg-amber-400",
      text: "text-amber-700",
      bg: "bg-amber-50",
      label: "Chờ duyệt",
    },
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
      key: "pending",
      label: "Chờ duyệt",
      count: bookings.filter((b) => b.status === "pending").length,
    },
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
    "w-full bg-[#f8f8fa] border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200 transition-all placeholder:text-zinc-400";

  return (
    <div className="max-w-[1400px] mx-auto space-y-5">
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

      {/* TOOLBAR */}
      <div className="bg-white rounded-xl border border-zinc-200/60 p-4">
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
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-700 outline-none focus:border-zinc-300 focus:bg-white transition-all"
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
        <div className="bg-white rounded-xl border border-zinc-200/60 p-16 text-center">
          <div className="inline-block w-6 h-6 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin mb-3" />
          <p className="text-xs text-zinc-400">Đang tải dữ liệu...</p>
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="bg-white rounded-xl border border-zinc-200/60 p-16 text-center">
          <p className="text-3xl mb-2 opacity-30">📋</p>
          <p className="text-sm text-zinc-400">
            Không tìm thấy đơn đặt sân nào
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-zinc-200/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider bg-zinc-50/60 border-b border-zinc-100">
                  <th
                    className="text-left py-3 px-5"
                    style={{ width: "260px" }}
                  >
                    Khách hàng
                  </th>
                  <th
                    className="text-left py-3 px-3"
                    style={{ width: "110px" }}
                  >
                    Ngày
                  </th>
                  <th
                    className="text-left py-3 px-3"
                    style={{ width: "110px" }}
                  >
                    Giờ
                  </th>
                  <th className="text-left py-3 px-3" style={{ width: "70px" }}>
                    Sân
                  </th>
                  <th
                    className="text-right py-3 px-3"
                    style={{ width: "100px" }}
                  >
                    Số tiền
                  </th>
                  <th
                    className="text-center py-3 px-3"
                    style={{ width: "90px" }}
                  >
                    Trạng thái
                  </th>
                  <th
                    className="text-right py-3 px-5"
                    style={{ width: "200px" }}
                  >
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map((b) => {
                  const detail = b.details?.[0];
                  const courtName =
                    detail?.court?.name ||
                    `Sân ${detail?.court_id?.slice(-2) || "..."}`;
                  const dateStr = detail?.booking_date
                    ? new Date(detail.booking_date).toLocaleDateString(
                        "vi-VN",
                        { day: "2-digit", month: "2-digit", year: "numeric" },
                      )
                    : "—";
                  const timeStr = detail
                    ? `${detail.start_time.slice(0, 5)} – ${detail.end_time.slice(0, 5)}`
                    : "—";
                  const sc = statusConfig[b.status] || statusConfig.pending;
                  const isCancelled = b.status === "cancelled";
                  const isNotificationTarget =
                    location.state?.notificationBookingCode === b.booking_code;

                  return (
                    <tr
                      key={b.id}
                      className={`border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50/40 transition-colors group ${
                        isCancelled ? "opacity-45" : ""
                      } ${
                        isNotificationTarget
                          ? "bg-lime-50 ring-1 ring-inset ring-lime-300"
                          : ""
                      }`}
                    >
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-500 font-medium text-xs shrink-0">
                            {b.customer_name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium text-zinc-800 truncate">
                              {b.customer_name}
                            </p>
                            <p className="text-[11px] text-zinc-400 font-mono truncate">
                              {b.booking_code} · {b.customer_phone}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-xs text-zinc-600">
                        {dateStr}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="text-xs font-mono text-zinc-600">
                          {timeStr}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-xs text-zinc-600">
                        {courtName}
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <p className="text-sm font-semibold text-zinc-800">
                          {Number(b.total_price).toLocaleString()}₫
                        </p>
                        <p
                          className={`text-[10px] ${b.payment_status === "paid" ? "text-emerald-600" : "text-amber-500"}`}
                        >
                          {b.payment_status === "paid"
                            ? "✓ Đã thu"
                            : "○ Chưa thu"}
                        </p>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${sc.bg} ${sc.text}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}
                          />
                          {sc.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          {b.status === "pending" && (
                            <button
                              onClick={() => requestAction(b, "confirm")}
                              className="px-2.5 py-1 bg-zinc-900 text-white rounded text-[10px] font-medium hover:bg-zinc-800 transition-colors"
                            >
                              Duyệt
                            </button>
                          )}
                          {b.status === "confirmed" && (
                            <button
                              onClick={() => requestAction(b, "checkin")}
                              className="px-2.5 py-1 bg-violet-600 text-white rounded text-[10px] font-medium hover:bg-violet-700 transition-colors"
                            >
                              Check-in
                            </button>
                          )}
                          {b.payment_status !== "paid" && !isCancelled && (
                            <button
                              onClick={() => requestAction(b, "pay")}
                              className="px-2.5 py-1 bg-lime-600 text-white rounded text-[10px] font-medium hover:bg-lime-700 transition-colors"
                            >
                              Thu tiền
                            </button>
                          )}
                          {["playing", "confirmed"].includes(b.status) && b.payment_status === "paid" && (
                            <button
                              onClick={() => requestAction(b, "complete")}
                              className="px-2.5 py-1 bg-emerald-600 text-white rounded text-[10px] font-medium hover:bg-emerald-700 transition-colors"
                            >
                              Hoàn thành
                            </button>
                          )}
                          {!isCancelled && !["playing", "completed"].includes(b.status) && (
                            <button
                              onClick={() => openRescheduleModal(b)}
                              className="px-2.5 py-1 border border-zinc-200 text-zinc-500 rounded text-[10px] hover:bg-zinc-50 transition-colors"
                            >
                              Đổi lịch
                            </button>
                          )}
                          {!["playing", "cancelled", "completed"].includes(b.status) && (
                            <button
                              onClick={() => requestAction(b, "cancel")}
                              className="px-2 py-1 text-zinc-400 rounded text-[10px] hover:text-red-500 hover:bg-red-50 transition-colors"
                            >
                              Hủy
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
              className="px-3.5 py-2 border border-zinc-200 rounded-lg text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 transition-colors"
            >
              ← Trước
            </button>
            <button
              disabled={pagination.current_page === pagination.last_page}
              onClick={() => fetchData(pagination.current_page + 1, searchTerm)}
              className="px-3.5 py-2 border border-zinc-200 rounded-lg text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 transition-colors"
            >
              Tiếp →
            </button>
          </div>
        </div>
      )}

      {/* MODAL ĐỔI LỊCH */}
      <AnimatePresence>
        {rescheduleModal.isOpen && (
          <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-zinc-100">
                <h3 className="text-sm font-semibold text-zinc-800">
                  Đổi lịch ca chơi
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Khách:{" "}
                  <span className="text-zinc-600">
                    {rescheduleModal.booking?.customer_name}
                  </span>
                </p>
              </div>
              <form onSubmit={handleRescheduleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">
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
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">
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
                    <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">
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
                    <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">
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
                    className="flex-1 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-lg text-xs font-medium transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    {isProcessing ? "Đang xử lý..." : "Lưu lịch mới"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL XÁC NHẬN */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-xs rounded-2xl shadow-xl p-6 text-center"
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
                  className="flex-1 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-lg text-xs font-medium transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={executeAction}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-medium transition-colors"
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
