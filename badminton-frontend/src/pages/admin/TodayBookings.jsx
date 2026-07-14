import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { adminBookingService } from "../../services/admin/bookingService";
import { adminProductService } from "../../services/admin/productService";
import { adminAdditionalService } from "../../services/admin/additionalService";
import { adminCourtService } from "../../services/admin/courtService";

const emptyItemRow = {
  selected_val: "",
  quantity: 1,
  note: "",
};

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 06:00 → 21:00

const statusConfig = {
  confirmed: {
    dot: "bg-blue-500",
    text: "text-blue-700",
    bg: "bg-blue-50",
    cell: "bg-blue-100 border-blue-300 text-blue-800",
    label: "Đã xác nhận",
  },
  playing: {
    dot: "bg-violet-500",
    text: "text-violet-700",
    bg: "bg-violet-50",
    cell: "bg-violet-100 border-violet-300 text-violet-800",
    label: "Đang chơi",
  },
  completed: {
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    bg: "bg-emerald-50",
    cell: "bg-emerald-100 border-emerald-300 text-emerald-800",
    label: "Hoàn thành",
  },
  cancelled: {
    dot: "bg-zinc-400",
    text: "text-zinc-500",
    bg: "bg-zinc-100",
    cell: "bg-zinc-200 border-zinc-300 text-zinc-500",
    label: "Đã hủy",
  },
};

const TodayBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [courts, setCourts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCourt, setFilterCourt] = useState("all");

  // Ca đang mở trong drawer thao tác (bấm vào 1 ô trên lưới)
  const [selectedRow, setSelectedRow] = useState(null);

  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);

  const [addItemModal, setAddItemModal] = useState({
    isOpen: false,
    booking: null,
  });
  const [itemRows, setItemRows] = useState([{ ...emptyItemRow }]);
  const [isAddingItem, setIsAddingItem] = useState(false);

  const [checkInModal, setCheckInModal] = useState({ isOpen: false, booking: null });
  const [checkInForm, setCheckInForm] = useState({ phone: "", booking_code: "" });
  const [checkInError, setCheckInError] = useState("");
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const todayFormatted = new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // -------------------------------------------------------------
  // GỘP CÁC KHUNG GIỜ LIỀN NHAU
  // Nếu 17:00-18:00 và 18:00-19:00 => 17:00-19:00
  // Nếu 08:00-10:00 và 14:00-16:00 => tách thành 2 dòng
  // -------------------------------------------------------------
  const buildDisplayRows = (bookingList) => {
    const rows = [];

    bookingList.forEach((booking) => {
      const details = [...(booking.details || [])].sort((a, b) => {
        const dateCompare = String(a.booking_date).localeCompare(
          String(b.booking_date),
        );
        if (dateCompare !== 0) return dateCompare;

        const courtCompare = String(a.court_id).localeCompare(
          String(b.court_id),
        );
        if (courtCompare !== 0) return courtCompare;

        return String(a.start_time).localeCompare(String(b.start_time));
      });

      if (details.length === 0) {
        rows.push({
          ...booking,
          _displayKey: `${booking.id}_nodetail`,
          _groupDetails: [],
          _groupStart: null,
          _groupEnd: null,
          _groupCourtId: null,
          _groupCourtName: '—',
          _groupPrice: 0,
          _noDetails: true,
        });
        return;
      }

      let currentGroup = [details[0]];

      for (let i = 1; i < details.length; i++) {
        const previous = currentGroup[currentGroup.length - 1];
        const current = details[i];

        const isSameDate = previous.booking_date === current.booking_date;
        const isSameCourt = previous.court_id === current.court_id;
        const isContinuous = previous.end_time === current.start_time;

        if (isSameDate && isSameCourt && isContinuous) {
          currentGroup.push(current);
        } else {
          rows.push(createDisplayRow(booking, currentGroup));
          currentGroup = [current];
        }
      }

      rows.push(createDisplayRow(booking, currentGroup));
    });

    return rows;
  };

  const createDisplayRow = (booking, groupDetails) => {
    const firstDetail = groupDetails[0];
    const lastDetail = groupDetails[groupDetails.length - 1];

    return {
      ...booking,
      _displayKey: `${booking.id}_${firstDetail?.id || Math.random()}`,
      _groupDetails: groupDetails,
      _groupStart: firstDetail?.start_time,
      _groupEnd: lastDetail?.end_time,
      _groupCourtId: firstDetail?.court_id,
      _groupCourtName:
        firstDetail?.court?.name ||
        `Sân ${firstDetail?.court_id?.slice(-2) || "..."}`,
      _groupPrice: groupDetails.reduce(
        (sum, detail) => sum + Number(detail.price || 0),
        0,
      ),
    };
  };

  // --- FETCH ---
  const fetchTodayData = async () => {
    setIsLoading(true);

    try {
      const [bookingRes, prodRes, servRes, courtRes] = await Promise.all([
        adminBookingService.getTodayBookings(),
        adminProductService.getProducts(1, "", ""),
        adminAdditionalService.getServices(),
        adminCourtService.getCourts(),
      ]);

      setBookings(bookingRes.data?.data || []);
      setProducts(prodRes.data?.data?.data || []);
      setServices(servRes.data?.data || []);

      const courtData = courtRes.data?.data?.data || courtRes.data?.data || [];
      setCourts(courtData);
    } catch (error) {
      console.error("Lỗi tải dữ liệu hôm nay:", error);
      setMessage({ type: "error", text: "Không thể tải dữ liệu." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayData();
  }, []);

  // Đồng bộ ca đang mở trong drawer với dữ liệu mới nhất sau mỗi lần fetch lại
  useEffect(() => {
    if (!selectedRow) return;
    const fresh = buildDisplayRows(bookings).find((b) => b.id === selectedRow.id);
    setSelectedRow(fresh || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings]);

  // --- ACTIONS ---
  const handleUpdateStatus = async (id, status) => {
    try {
      setMessage({ type: "", text: "" });
      await adminBookingService.updateStatus(id, { status });
      setMessage({ type: "success", text: "✓ Cập nhật trạng thái đơn thành công!" });
      fetchTodayData();
    } catch (error) {
      alert(error.response?.data?.message || "Thao tác thất bại!");
    }
  };

  const handleUpdatePayment = async (id, payment_status) => {
    try {
      setMessage({ type: "", text: "" });
      await adminBookingService.updatePayment(id, { payment_status });
      setMessage({ type: "success", text: "✓ Cập nhật thanh toán thành công!" });
      fetchTodayData();
    } catch (error) {
      alert(error.response?.data?.message || "Thao tác thất bại!");
    }
  };

  const openCheckInModal = (booking) => {
    setCheckInModal({ isOpen: true, booking });
    setCheckInForm({ phone: "", booking_code: "" });
    setCheckInError("");
  };

  const handleCheckIn = async (e) => {
    e.preventDefault();
    setCheckInError("");
    if (!checkInForm.phone.trim() || !checkInForm.booking_code.trim()) {
      setCheckInError("Vui lòng nhập đầy đủ số điện thoại và mã đơn.");
      return;
    }
    setIsCheckingIn(true);
    try {
      await adminBookingService.checkIn(checkInModal.booking.id, {
        phone: checkInForm.phone.trim(),
        booking_code: checkInForm.booking_code.trim(),
      });
      setCheckInModal({ isOpen: false, booking: null });
      setMessage({ type: "success", text: "✓ Check-in thành công! Khách đã vào sân." });
      fetchTodayData();
    } catch (error) {
      setCheckInError(error.response?.data?.message || "Check-in thất bại. Vui lòng thử lại.");
    } finally {
      setIsCheckingIn(false);
    }
  };

  // Thu tiền cuối ca + hoàn thành trong 1 bước (backend tự tính phần còn thiếu)
  const handleCheckout = async (id) => {
    if (!window.confirm("Xác nhận thu tiền còn lại và hoàn thành ca chơi này?")) return;
    setIsCheckingOut(true);
    try {
      setMessage({ type: "", text: "" });
      await adminBookingService.checkout(id);
      setMessage({ type: "success", text: "✓ Đã thu tiền và hoàn thành ca chơi!" });
      setSelectedRow(null);
      fetchTodayData();
    } catch (error) {
      alert(error.response?.data?.message || "Thao tác thất bại!");
    } finally {
      setIsCheckingOut(false);
    }
  };

  const openAddItemModal = (booking) => {
    setAddItemModal({ isOpen: true, booking });
    setItemRows([{ ...emptyItemRow }]);
  };

  const handleAddItemRow = () => {
    setItemRows((prev) => [...prev, { ...emptyItemRow }]);
  };

  const handleRemoveItemRow = (index) => {
    setItemRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemRowChange = (index, field, value) => {
    const updatedRows = [...itemRows];
    updatedRows[index][field] = value;
    setItemRows(updatedRows);
  };

  const handleCloseAddItemModal = () => {
    setAddItemModal({ isOpen: false, booking: null });
    setItemRows([{ ...emptyItemRow }]);
  };

  const handleAddItemSubmit = async (e) => {
    e.preventDefault();

    const hasInvalidRow = itemRows.some(
      (item) =>
        !item.selected_val || !item.quantity || Number(item.quantity) < 1,
    );

    if (hasInvalidRow) {
      return alert("Vui lòng chọn đầy đủ mặt hàng/dịch vụ và số lượng hợp lệ!");
    }

    const items = itemRows.map((item) => {
      const [type, item_id] = item.selected_val.split("|");

      return {
        type,
        item_id,
        quantity: Number(item.quantity),
        note: item.note || null,
      };
    });

    setIsAddingItem(true);

    try {
      await adminBookingService.addItemsToBooking(addItemModal.booking.id, {
        items,
      });

      setMessage({
        type: "success",
        text: `Thêm ${items.length} món vào bill thành công!`,
      });

      handleCloseAddItemModal();
      fetchTodayData();
    } catch (error) {
      alert(error.response?.data?.message || "Có lỗi xảy ra khi thêm món!");
    } finally {
      setIsAddingItem(false);
      setTimeout(() => setMessage({ type: "", text: "" }), 2500);
    }
  };

  const handleOpenBill = (booking) => {
    setSelectedBill(booking);
    setIsBillModalOpen(true);
  };

  // --- FILTER ---
  const displayBookings = useMemo(() => {
    return buildDisplayRows(bookings);
  }, [bookings]);

  const activeCourts = useMemo(() => {
    return courts
      .filter((court) => court.status !== "inactive")
      .filter((court) => filterCourt === "all" || court.id === filterCourt)
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [courts, filterCourt]);

  const filteredBookings = useMemo(() => {
    return displayBookings.filter((b) => {
      const matchSearch =
        !searchTerm ||
        b.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.customer_phone?.includes(searchTerm);

      const matchFilter =
        filterStatus === "all" ||
        (filterStatus === "unpaid" &&
          b.payment_status === "unpaid" &&
          b.status !== "cancelled") ||
        (filterStatus === "partial" &&
          b.payment_status === "partially_paid" &&
          b.status !== "cancelled") ||
        (filterStatus === "paid" && b.payment_status === "paid");

      return matchSearch && matchFilter;
    });
  }, [displayBookings, searchTerm, filterStatus]);

  // Tìm ca đặt phủ lên 1 ô (sân × giờ) cụ thể trên lưới
  const findCellBooking = (courtId, hour) => {
    const hStart = `${String(hour).padStart(2, "0")}:00`;
    const hEnd = `${String(hour + 1).padStart(2, "0")}:00`;
    return filteredBookings.find((b) => {
      if (b._groupCourtId !== courtId) return false;
      const bStart = b._groupStart?.slice(0, 5);
      const bEnd = b._groupEnd?.slice(0, 5);
      return bStart < hEnd && bEnd > hStart;
    });
  };

  const unpaidCount = filteredBookings.filter(
    (b) => b.payment_status === "unpaid" && b.status !== "cancelled",
  ).length;
  const partialCount = filteredBookings.filter(
    (b) => b.payment_status === "partially_paid" && b.status !== "cancelled",
  ).length;
  const paidCount = filteredBookings.filter(
    (b) => b.payment_status === "paid",
  ).length;

  const inputClass = "admin-input";

  const filterTabs = [
    { key: "all", label: "Tất cả", count: filteredBookings.length },
    { key: "unpaid", label: "Chưa thu", count: unpaidCount },
    { key: "partial", label: "Nợ Pro-shop", count: partialCount },
    { key: "paid", label: "Đã thu", count: paidCount },
  ];

  // --- Số liệu chi tiết cho ca đang mở trong drawer ---
  const rowFinance = (b) => {
    const courtAmount = Number(b._groupPrice || b.subtotal_court || 0);
    const serviceAmount = Number(b.subtotal_service || 0);
    const totalAmount = Number(b.total_price || 0);
    const remainingAmount = Number(b.remaining_amount || 0);
    const paidAmount = totalAmount - remainingAmount;
    const isOnlyProshopDebt =
      serviceAmount > 0 &&
      remainingAmount > 0 &&
      paidAmount >= Number(b.subtotal_court || 0);
    return { courtAmount, serviceAmount, totalAmount, remainingAmount, paidAmount, isOnlyProshopDebt };
  };

  return (
    <div className="admin-page-container">
      {/* TIÊU ĐỀ */}
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">Ca đấu hôm nay</h2>
          <p className="admin-page-subtitle">{todayFormatted} · Bấm vào 1 ô trên lưới để thao tác</p>
        </div>

        <div className="flex gap-2.5">
          <div className="admin-stat-badge badge-default">
            <p className="admin-stat-value val-default">{filteredBookings.length}</p>
            <p className="admin-stat-label lbl-default">Đang xem</p>
          </div>

          {(unpaidCount > 0 || partialCount > 0) && (
            <div className="bg-amber-50 border border-amber-200/60 px-4 py-2 rounded-lg text-center min-w-[70px]">
              <p className="text-lg font-bold text-amber-600">{unpaidCount + partialCount}</p>
              <p className="text-[10px] text-amber-500 uppercase">Cần thu</p>
            </div>
          )}
        </div>
      </div>

      {/* THÔNG BÁO (TOAST) */}
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

      {/* THANH CÔNG CỤ */}
      <div className="admin-card p-4">
        <div className="flex flex-col xl:flex-row gap-3 justify-between items-start xl:items-center">
          <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
            <div className="relative w-full sm:w-72">
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
                placeholder="Tìm tên hoặc SĐT..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="admin-input pl-10 py-2.5"
              />
            </div>

            <select
              value={filterCourt}
              onChange={(e) => setFilterCourt(e.target.value)}
              className="admin-input w-full sm:w-44 px-3 py-2.5 text-xs"
            >
              <option value="all">Tất cả sân</option>
              {courts
                .filter((c) => c.status !== "inactive")
                .map((court) => (
                  <option key={court.id} value={court.id}>
                    {court.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg overflow-x-auto max-w-full">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilterStatus(tab.key)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-medium whitespace-nowrap transition-all ${
                  filterStatus === tab.key
                    ? "bg-white text-zinc-800 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span
                    className={`ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full ${
                      filterStatus === tab.key
                        ? "bg-zinc-900 text-white"
                        : "bg-zinc-200 text-zinc-500"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CHÚ THÍCH MÀU */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(statusConfig).map(([key, cfg]) => (
          <span key={key} className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500">
            <span className={`w-2.5 h-2.5 rounded ${cfg.dot}`} /> {cfg.label}
          </span>
        ))}
      </div>

      {/* LƯỚI CA ĐẤU */}
      {isLoading ? (
        <div className="admin-card p-16 text-center">
          <div className="inline-block w-6 h-6 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin mb-3" />
          <p className="text-xs text-zinc-400">Đang tải...</p>
        </div>
      ) : activeCourts.length === 0 ? (
        <div className="admin-card p-16 text-center">
          <p className="text-3xl mb-2 opacity-30">📭</p>
          <p className="text-sm text-zinc-400">Chưa có sân nào đang hoạt động</p>
        </div>
      ) : (
        <div className="admin-card p-4 overflow-x-auto">
          <table className="min-w-[900px] w-full">
            <thead>
              <tr>
                <th className="text-left w-28">Sân</th>
                {HOURS.map((h) => (
                  <th key={h} className="text-center !p-1 text-[10px]">{h}h</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeCourts.map((court) => (
                <tr key={court.id}>
                  <td className="font-semibold text-sm whitespace-nowrap">
                    {court.name}
                    {court.is_maintenance ? (
                      <span className="block text-[10px] text-red-500 font-medium">Bảo trì</span>
                    ) : null}
                  </td>
                  {HOURS.map((h) => {
                    const b = findCellBooking(court.id, h);
                    const cfg = b ? statusConfig[b.status] : null;
                    return (
                      <td key={h} className="!p-0.5">
                        <button
                          type="button"
                          onClick={() => b && setSelectedRow(b)}
                          className={`w-full h-11 rounded-md border text-[9px] font-bold transition-all ${
                            cfg
                              ? `${cfg.cell} hover:scale-105 cursor-pointer`
                              : "bg-white border-zinc-100 cursor-default"
                          }`}
                          title={b ? `${b.customer_name} · ${b.booking_code}` : "Trống"}
                        >
                          {b ? b.customer_name?.split(" ").slice(-1)[0] : ""}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ĐƠN THIẾU CHI TIẾT — không thể xếp vào lưới */}
      {displayBookings.some((b) => b._noDetails) && (
        <div className="admin-card p-4 mt-4">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-3">
            Đơn chưa có thông tin sân / giờ
          </p>
          <div className="space-y-2">
            {displayBookings.filter((b) => b._noDetails).map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedRow(b)}
                className="flex w-full items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-left hover:bg-amber-100"
              >
                <div>
                  <p className="text-sm font-bold text-slate-900">{b.customer_name || 'Khách vãng lai'}</p>
                  <p className="text-xs text-slate-500">{b.booking_code} · {b.customer_phone}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${statusConfig[b.status]?.cell || 'bg-slate-100 text-slate-500'}`}>
                  {statusConfig[b.status]?.label || b.status}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* DRAWER THAO TÁC — MỞ KHI BẤM VÀO 1 Ô */}
      <AnimatePresence>
        {selectedRow && (() => {
          const b = selectedRow;
          const sc = statusConfig[b.status] || statusConfig.confirmed;
          const isCancelled = b.status === "cancelled";
          const isCompleted = b.status === "completed";
          const { courtAmount, serviceAmount, totalAmount, remainingAmount, paidAmount, isOnlyProshopDebt } = rowFinance(b);
          const timeStr =
            b._groupStart && b._groupEnd
              ? `${b._groupStart.slice(0, 5)} – ${b._groupEnd.slice(0, 5)}`
              : "—";

          return (
            <div className="admin-modal-overlay" onClick={() => setSelectedRow(null)}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="admin-modal-content max-w-lg"
              >
                <div className="admin-modal-header">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-zinc-800">{b.customer_name}</h4>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${sc.bg} ${sc.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} /> {sc.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5 font-mono">
                      {b.customer_phone} · {b._groupCourtName} · {timeStr}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedRow(null)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors text-sm"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-6 space-y-5">
                  {/* Tài chính */}
                  <div className="bg-zinc-50 rounded-xl border border-zinc-100 p-4 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-500">Tiền sân</span>
                      <span className="font-semibold text-zinc-800">{courtAmount.toLocaleString()}₫</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-500">Pro-shop</span>
                      <span className="font-semibold text-violet-600">{serviceAmount.toLocaleString()}₫</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-500">Đã thu</span>
                      <span className="font-semibold text-emerald-600">{paidAmount.toLocaleString()}₫</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-500">Còn thu</span>
                      <span className={`font-bold ${remainingAmount > 0 ? "text-amber-600" : "text-zinc-400"}`}>
                        {remainingAmount.toLocaleString()}₫
                      </span>
                    </div>
                    <div className="flex justify-between text-sm pt-1.5 border-t border-zinc-200 mt-1.5">
                      <span className="font-bold text-zinc-900">Tổng bill</span>
                      <span className="font-bold text-zinc-900">{totalAmount.toLocaleString()}₫</span>
                    </div>
                    {isOnlyProshopDebt && (
                      <div className="admin-debt-alert mt-2"><span>⚠ Nợ Pro-shop</span></div>
                    )}
                  </div>

                  {/* Hành động */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleOpenBill(b)}
                      className="admin-btn-outline py-2.5 text-xs font-medium"
                    >
                      🧾 Xem Bill
                    </button>

                    {!isCancelled && !isCompleted && (
                      <button
                        onClick={() => openAddItemModal(b)}
                        className="admin-btn-outline border-dashed py-2.5 text-xs font-medium"
                      >
                        + Thêm dịch vụ
                      </button>
                    )}

                    {b.status === "confirmed" && (
                      <button
                        onClick={() => openCheckInModal(b)}
                        className="admin-btn-primary py-2.5 text-xs font-medium col-span-2"
                      >
                        Check-in
                      </button>
                    )}

                    {(b.status === "confirmed" || b.status === "playing") && remainingAmount > 0 && (
                      <button
                        onClick={() => handleUpdatePayment(b.id, "paid")}
                        className="admin-btn-outline py-2.5 text-xs font-medium col-span-2"
                      >
                        Ghi nhận đã thu {remainingAmount.toLocaleString()}₫
                      </button>
                    )}

                    {(b.status === "confirmed" || b.status === "playing") && (
                      <button
                        onClick={() => handleCheckout(b.id)}
                        disabled={isCheckingOut}
                        className="admin-btn-primary py-2.5 text-xs font-medium col-span-2 disabled:opacity-60"
                      >
                        {isCheckingOut
                          ? "Đang xử lý..."
                          : remainingAmount > 0
                            ? `Thu ${remainingAmount.toLocaleString()}₫ & Hoàn thành`
                            : "Hoàn thành ca chơi"}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* MODAL THÊM MÓN */}
      <AnimatePresence>
        {addItemModal.isOpen && (
          <div
            className="admin-modal-overlay"
            onClick={handleCloseAddItemModal}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="admin-modal-content max-w-2xl"
            >
              <div className="admin-modal-header p-6 border-b border-zinc-100">
                <h3 className="text-sm font-semibold text-zinc-800">
                  Bán thêm dịch vụ / sản phẩm
                </h3>

                <p className="admin-page-subtitle">
                  Khách:{" "}
                  <span className="text-zinc-600">
                    {addItemModal.booking?.customer_name}
                  </span>
                </p>
              </div>

              <form
                onSubmit={handleAddItemSubmit}
                className="p-6 space-y-4 max-h-[70vh] overflow-y-auto"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-medium text-zinc-500">
                      Danh sách mặt hàng / dịch vụ
                    </label>

                    <button
                      type="button"
                      onClick={handleAddItemRow}
                      className="text-[11px] font-medium text-emerald-600 hover:text-emerald-700"
                    >
                      + Thêm dòng
                    </button>
                  </div>

                  {itemRows.map((item, index) => (
                    <div
                      key={index}
                      className="border border-zinc-100 rounded-xl p-3 space-y-3 bg-zinc-50/40"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-zinc-500">
                          Món #{index + 1}
                        </span>

                        {itemRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItemRow(index)}
                            className="text-[11px] text-red-500 hover:text-red-600"
                          >
                            Xóa
                          </button>
                        )}
                      </div>

                      <div>
                        <select
                          required
                          value={item.selected_val}
                          onChange={(e) =>
                            handleItemRowChange(
                              index,
                              "selected_val",
                              e.target.value,
                            )
                          }
                          className={inputClass}
                        >
                          <option value="" disabled>
                            — Vui lòng chọn —
                          </option>

                          {products.length > 0 && (
                            <optgroup label="🥤 Sản phẩm">
                              {products.map((p) => (
                                <option
                                  key={`p_${p.id}`}
                                  value={`product|${p.id}`}
                                  disabled={p.stock_quantity <= 0}
                                >
                                  {p.name} -{" "}
                                  {Number(p.selling_price).toLocaleString()}đ{" "}
                                  {p.stock_quantity <= 0
                                    ? "(Hết)"
                                    : `(${p.stock_quantity})`}
                                </option>
                              ))}
                            </optgroup>
                          )}

                          {services.length > 0 && (
                            <optgroup label="Dịch vụ">
                              {services.map((s) => (
                                <option
                                  key={`s_${s.id}`}
                                  value={`service|${s.id}`}
                                  disabled={s.status === "inactive"}
                                >
                                  {s.name} - {Number(s.price).toLocaleString()}đ
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="admin-form-label">
                            Số lượng
                          </label>

                          <input
                            type="number"
                            min="1"
                            required
                            value={item.quantity}
                            onChange={(e) =>
                              handleItemRowChange(
                                index,
                                "quantity",
                                e.target.value,
                              )
                            }
                            className={inputClass}
                          />
                        </div>

                        <div>
                          <label className="admin-form-label">
                            Ghi chú
                          </label>

                          <input
                            type="text"
                            placeholder="Tùy chọn..."
                            value={item.note}
                            onChange={(e) =>
                              handleItemRowChange(index, "note", e.target.value)
                            }
                            className={inputClass}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-3 border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={handleCloseAddItemModal}
                    className="admin-btn-outline flex-1 py-2.5 text-xs font-medium"
                  >
                    Hủy
                  </button>

                  <button
                    type="submit"
                    disabled={isAddingItem}
                    className="admin-btn-secondary flex-1 py-2.5 text-xs font-medium disabled:opacity-60"
                  >
                    {isAddingItem
                      ? "Đang thêm..."
                      : `Thêm ${itemRows.length} món vào Bill`}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL BILL IN NHIỆT */}
      <AnimatePresence>
        {isBillModalOpen && selectedBill && (
          <div
            onClick={() => setIsBillModalOpen(false)}
            className="admin-modal-overlay"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-[360px] shadow-xl rounded-2xl p-6 relative font-mono text-zinc-900"
            >
              <div className="text-center mb-5">
                <h2 className="text-lg font-black tracking-tight uppercase leading-none mb-1">
                  NH BADMINTON
                </h2>

                <p className="text-[10px] text-zinc-400">
                  Sân cầu lông · SĐT: 0987.654.321
                </p>

                <div className="mt-4 pt-3 border-t border-dashed border-zinc-300">
                  <p className="text-xs font-semibold uppercase text-zinc-600">
                    Hóa đơn thanh toán
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 text-xs mb-4">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Mã GD:</span>
                  <strong>
                    #
                    {selectedBill.booking_code?.split("_")[1] ||
                      selectedBill.id?.slice(0, 6)}
                  </strong>
                </div>

                <div className="flex justify-between">
                  <span className="text-zinc-500">Ngày:</span>
                  <span>{new Date().toLocaleString("vi-VN")}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-zinc-500">Khách:</span>
                  <strong className="truncate max-w-[140px] text-right">
                    {selectedBill.customer_name}
                  </strong>
                </div>
              </div>

              <table className="w-full text-[11px] mb-4 text-left">
                <thead className="border-y border-dashed border-zinc-300">
                  <tr>
                    <th className="py-1.5 font-semibold w-1/2">Mô tả</th>
                    <th className="py-1.5 font-semibold text-center">SL</th>
                    <th className="py-1.5 font-semibold text-right">
                      Thành tiền
                    </th>
                  </tr>
                </thead>

                <tbody className="border-b border-dashed border-zinc-300">
                  {selectedBill.details?.map((detail) => (
                    <tr key={detail.id}>
                      <td className="py-2 pr-2">
                        <strong className="block text-xs">
                          {detail.court?.name || "Sân thuê"}
                        </strong>

                        <span className="text-[10px] text-zinc-400">
                          {detail.start_time?.slice(0, 5)} –{" "}
                          {detail.end_time?.slice(0, 5)}
                        </span>
                      </td>

                      <td className="py-2 text-center align-top text-xs">1</td>

                      <td className="py-2 text-right align-top font-semibold text-xs">
                        {Number(detail.price || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}

                  {selectedBill.service_details?.map((item) => (
                    <tr
                      key={item.id}
                      className="border-t border-dotted border-zinc-200"
                    >
                      <td className="py-2 pr-2">
                        <strong className="block text-[11px]">
                          {item.product?.name ||
                            item.service?.name ||
                            "Dịch vụ"}
                        </strong>

                        {item.note && (
                          <span className="text-[9px] text-zinc-400 block">
                            *{item.note}
                          </span>
                        )}
                      </td>

                      <td className="py-2 text-center align-top text-zinc-600">
                        {item.quantity}
                      </td>

                      <td className="py-2 text-right align-top font-semibold">
                        {Number(item.total_price).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="space-y-1 text-xs mb-5">
                <div className="flex justify-between text-zinc-500">
                  <span>Tiền sân:</span>
                  <span>
                    {Number(selectedBill.subtotal_court || 0).toLocaleString()}đ
                  </span>
                </div>

                <div className="flex justify-between text-zinc-500">
                  <span>Pro-shop:</span>
                  <span>
                    {Number(
                      selectedBill.subtotal_service || 0,
                    ).toLocaleString()}
                    đ
                  </span>
                </div>

                <div className="flex justify-between text-zinc-500">
                  <span>Đã thu:</span>
                  <span>
                    {Number(selectedBill.deposit_amount || 0).toLocaleString()}đ
                  </span>
                </div>

                <div className="flex justify-between text-zinc-500">
                  <span>Còn thu:</span>
                  <span
                    className={
                      Number(selectedBill.remaining_amount || 0) > 0
                        ? "text-amber-600 font-bold"
                        : ""
                    }
                  >
                    {Number(
                      selectedBill.remaining_amount || 0,
                    ).toLocaleString()}
                    đ
                  </span>
                </div>

                <div className="flex justify-between text-sm mt-2 pt-2 border-t-2 border-zinc-800 font-bold">
                  <span>TỔNG BILL:</span>
                  <span>
                    {Number(selectedBill.total_price || 0).toLocaleString()}đ
                  </span>
                </div>
              </div>

              <p className="text-center text-[10px] text-zinc-400 mb-6">
                Cảm ơn quý khách!
                <br />
                Wifi: NH_Badminton · Pass: 88888888
              </p>

              <div className="flex gap-2 font-sans print:hidden">
                <button
                  onClick={() => setIsBillModalOpen(false)}
                  className="admin-btn-outline flex-1 py-2.5 text-xs font-medium"
                >
                  Đóng
                </button>

                <button
                  onClick={() => alert("Kết nối máy in...")}
                  className="admin-btn-secondary flex-1 py-2.5 text-xs font-medium"
                >
                  🖨️ In Bill
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── CỬA SỔ NHẬN SÂN (CHECK-IN) ── */}
      <AnimatePresence>
        {checkInModal.isOpen && (
          <div className="admin-modal-overlay">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="admin-modal-content max-w-sm p-6"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-800 text-sm">Xác nhận Check-in</h3>
                  <p className="text-xs text-zinc-500">Sân {checkInModal.booking?._groupCourtName} · {checkInModal.booking?.customer_name || "Khách vãng lai"}</p>
                </div>
              </div>

              <form onSubmit={handleCheckIn} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">
                    Số điện thoại khách
                  </label>
                  <input
                    type="tel"
                    placeholder="Nhập SĐT của khách"
                    value={checkInForm.phone}
                    onChange={(e) => setCheckInForm({ ...checkInForm, phone: e.target.value })}
                    className="admin-input w-full px-3 py-2.5 text-sm"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">
                    Mã đơn đặt sân
                  </label>
                  <input
                    type="text"
                    placeholder="VD: BK-20240624-001"
                    value={checkInForm.booking_code}
                    onChange={(e) => setCheckInForm({ ...checkInForm, booking_code: e.target.value })}
                    className="admin-input w-full px-3 py-2.5 text-sm font-mono"
                  />
                </div>

                {checkInError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2.5">
                    ⚠ {checkInError}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setCheckInModal({ isOpen: false, booking: null })}
                    className="admin-btn-outline flex-1 py-2.5 text-sm font-medium"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isCheckingIn}
                    className="admin-btn-primary bg-violet-600 hover:bg-violet-700 border-transparent text-white flex-1 py-2.5 text-sm font-medium disabled:opacity-60"
                  >
                    {isCheckingIn ? "Đang xác minh..." : "Xác nhận Check-in"}
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

export default TodayBookings;
