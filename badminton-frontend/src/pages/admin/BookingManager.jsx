import React, { useState } from "react";

// DỮ LIỆU KHỞI TẠO HỆ THỐNG
const MOCK_COURTS = [
  { id: 1, name: "Sân số 01 (VIP)" },
  { id: 2, name: "Sân số 02 (Trung tâm)" },
  { id: 3, name: "Sân số 03" },
  { id: 4, name: "Sân số 04" },
  { id: 5, name: "Sân số 05 (Bảo trì)" },
];

// Sinh danh sách block giờ từ 05:00 đến 22:00
const GENERATE_HOURS = () => {
  const hours = [];
  for (let i = 5; i <= 22; i++) {
    hours.push(`${i.toString().padStart(2, "0")}:00`);
  }
  return hours;
};

const INITIAL_BOOKINGS = {
  "15:00-1": {
    id: "B1",
    user: "Minh Tuấn",
    phone: "0912345888",
    type: "Cọc online",
    status: "confirmed",
    price: 100000,
    paid: true,
    note: "Khách quen hay uống Revive",
  },
  "16:00-1": {
    id: "B2",
    user: "Minh Tuấn",
    phone: "0912345888",
    type: "Cọc online",
    status: "confirmed",
    price: 100000,
    paid: true,
    note: "",
  },
  "18:00-2": {
    id: "B3",
    user: "Hoàng Long",
    phone: "0903555123",
    type: "Khách vãng lai",
    status: "pending",
    price: 120000,
    paid: false,
    note: "Giữ chỗ qua điện thoại",
  },
  "19:00-2": {
    id: "B4",
    user: "CLB Smashers",
    phone: "0888999777",
    type: "Cố định tháng",
    status: "checked-in",
    price: 120000,
    paid: true,
    note: "Nhóm 8 người",
  },
  "20:00-2": {
    id: "B5",
    user: "CLB Smashers",
    phone: "0888999777",
    type: "Cố định tháng",
    status: "checked-in",
    price: 120000,
    paid: true,
    note: "Nhóm 8 người",
  },
  "17:00-3": {
    id: "B6",
    user: "Thanh Hương",
    phone: "0933444556",
    type: "Cọc online",
    status: "confirmed",
    price: 120000,
    paid: true,
    note: "",
  },
};

const BookingManager = () => {
  const [hours] = useState(GENERATE_HOURS());
  const [bookings, setBookings] = useState(INITIAL_BOOKINGS);
  const [filterStatus, setFilterStatus] = useState("all"); // 'all', 'pending', 'confirmed', 'checked-in'
  const [selectedDate, setSelectedDate] = useState("2026-05-12");

  // STATES MODAL QUẢN LÝ / CHỈNH SỬA BOOKING ĐÃ CÓ
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [activeBookingKey, setActiveBookingKey] = useState(null);
  const [editNote, setEditNote] = useState("");

  // STATES MODAL TẠO BOOKING NHANH (BẤM VÀO Ô TRỐNG)
  const [quickModalOpen, setQuickModalOpen] = useState(false);
  const [quickSlot, setQuickSlot] = useState({
    courtId: 1,
    courtName: "",
    time: "",
  });
  const [quickForm, setQuickForm] = useState({
    user: "",
    phone: "",
    type: "Khách vãng lai",
    price: 100000,
    paid: false,
    note: "",
  });

  // ========================================================
  // LOGIC THAO TÁC POPUP CHỈNH SỬA / XỬ LÝ LỊCH ĐẶT SẴN
  // ========================================================
  const handleOpenActionModal = (key) => {
    setActiveBookingKey(key);
    setEditNote(bookings[key]?.note || "");
    setActionModalOpen(true);
  };

  const handleUpdateStatus = (newStatus) => {
    if (!activeBookingKey) return;
    setBookings((prev) => ({
      ...prev,
      [activeBookingKey]: {
        ...prev[activeBookingKey],
        status: newStatus,
        paid: newStatus === "checked-in" ? true : prev[activeBookingKey].paid,
      },
    }));
    setActionModalOpen(false);
  };

  const handleTogglePaid = () => {
    if (!activeBookingKey) return;
    setBookings((prev) => ({
      ...prev,
      [activeBookingKey]: {
        ...prev[activeBookingKey],
        paid: !prev[activeBookingKey].paid,
      },
    }));
  };

  const handleSaveNote = () => {
    if (!activeBookingKey) return;
    setBookings((prev) => ({
      ...prev,
      [activeBookingKey]: {
        ...prev[activeBookingKey],
        note: editNote,
      },
    }));
    setActionModalOpen(false);
  };

  const handleDeleteBooking = () => {
    if (!activeBookingKey) return;
    const current = bookings[activeBookingKey];
    if (
      window.confirm(
        `⚠️ Xác nhận hủy lịch của "${current.user}" lúc ${activeBookingKey.split("-")[0]}?`,
      )
    ) {
      const copy = { ...bookings };
      delete copy[activeBookingKey];
      setBookings(copy);
      setActionModalOpen(false);
    }
  };

  // ========================================================
  // LOGIC THAO TÁC POPUP TẠO LỊCH ĐẶT NHANH TẠI QUẦY
  // ========================================================
  const handleOpenQuickModal = (court, time) => {
    if (court.id === 5) return; // Sân bảo trì cấm đặt
    const isPrime = parseInt(time) >= 17;
    setQuickSlot({ courtId: court.id, courtName: court.name, time });
    setQuickForm({
      user: "",
      phone: "",
      type: "Khách vãng lai",
      price: isPrime ? 120000 : 100000,
      paid: false,
      note: "",
    });
    setQuickModalOpen(true);
  };

  const handleSubmitQuickBooking = (e) => {
    e.preventDefault();
    const key = `${quickSlot.time}-${quickSlot.courtId}`;
    setBookings((prev) => ({
      ...prev,
      [key]: {
        id: `B_${Date.now().toString().slice(-4)}`,
        user: quickForm.user || "Khách Vãng Lai",
        phone: quickForm.phone || "Không cung cấp",
        type: quickForm.type,
        status: quickForm.paid ? "confirmed" : "pending",
        price: Number(quickForm.price),
        paid: quickForm.paid,
        note: quickForm.note,
      },
    }));
    setQuickModalOpen(false);
  };

  // ========================================================
  // THỐNG KÊ TÀI CHÍNH THỜI GIAN THỰC
  // ========================================================
  const stats = Object.values(bookings).reduce(
    (acc, curr) => {
      acc.totalSlots += 1;
      acc.revenue += curr.price;
      if (curr.paid) acc.collected += curr.price;
      if (curr.status === "pending") acc.pendingCount += 1;
      if (curr.status === "checked-in") acc.activePlayers += 1;
      return acc;
    },
    {
      totalSlots: 0,
      revenue: 0,
      collected: 0,
      pendingCount: 0,
      activePlayers: 0,
    },
  );

  const activeBooking = activeBookingKey ? bookings[activeBookingKey] : null;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* THANH TOPBAR VẬN HÀNH */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-100 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-zinc-800">
            Điều Phối & Khai Thác Sân
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Click ô trống để nạp khách · Click ô màu để kiểm duyệt.
          </p>
        </div>

        {/* Bộ lọc & Ngày */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-500">
            <span>Ngày:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent font-semibold text-zinc-800 focus:outline-none cursor-pointer"
            />
          </div>

          <div className="flex bg-zinc-100 p-0.5 rounded-lg text-xs font-medium">
            <button
              onClick={() => setFilterStatus("all")}
              className={`px-3 py-1.5 rounded-md transition-all ${filterStatus === "all" ? "bg-white text-zinc-800 shadow-sm font-semibold" : "text-zinc-500 hover:text-zinc-800"}`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setFilterStatus("pending")}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${filterStatus === "pending" ? "bg-white text-amber-600 shadow-sm font-semibold" : "text-zinc-500 hover:text-zinc-800"}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Chưa
              cọc
            </button>
            <button
              onClick={() => setFilterStatus("confirmed")}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${filterStatus === "confirmed" ? "bg-white text-blue-600 shadow-sm font-semibold" : "text-zinc-500 hover:text-zinc-800"}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Đã cọc
            </button>
            <button
              onClick={() => setFilterStatus("checked-in")}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${filterStatus === "checked-in" ? "bg-white text-emerald-600 shadow-sm font-semibold" : "text-zinc-500 hover:text-zinc-800"}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Đang
              chơi
            </button>
          </div>
        </div>
      </div>

      {/* HỆ THỐNG THẺ CHỈ SỐ NHANH */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-zinc-900 text-white p-4 rounded-2xl">
          <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
            Tổng doanh thu ca
          </p>
          <h4 className="text-xl font-black mt-1">
            {stats.revenue.toLocaleString()} đ
          </h4>
          <p className="text-[10px] text-zinc-400 mt-1">
            Tổng: {stats.totalSlots} block đã lấp
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-zinc-100">
          <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
            Thực thu tiền mặt/QR
          </p>
          <h4 className="text-xl font-black text-emerald-600 mt-1">
            {stats.collected.toLocaleString()} đ
          </h4>
          <p className="text-[10px] text-zinc-500 mt-1">
            Đã kiểm duyệt hoàn tất
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-zinc-100">
          <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
            Cần thu thêm
          </p>
          <h4 className="text-xl font-black text-amber-600 mt-1">
            {(stats.revenue - stats.collected).toLocaleString()} đ
          </h4>
          <p className="text-[10px] text-amber-600 font-semibold mt-1">
            Từ {stats.pendingCount} ca chưa cọc
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-zinc-100">
          <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
            Sân đang bận
          </p>
          <h4 className="text-xl font-black text-blue-600 mt-1">
            {stats.activePlayers} Ca
          </h4>
          <p className="text-[10px] text-zinc-500 mt-1">Đã xác nhận Check-in</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-zinc-100">
          <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
            Trạng thái Cụm
          </p>
          <h4 className="text-xl font-black text-zinc-900 mt-1">4/5 Sân</h4>
          <p className="text-[10px] text-red-500 font-bold mt-1">
            ● Sân 05 khóa bảo trì
          </p>
        </div>
      </div>

      {/* LƯỚI MA TRẬN KHAI THÁC */}
      <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden">
        {/* Thanh chú giải */}
        <div className="px-6 py-4 border-b border-zinc-100 flex flex-wrap justify-between items-center bg-zinc-50/50 gap-2">
          <span className="text-xs font-black text-zinc-800 uppercase tracking-wider">
            Sa Bàn Giờ Trực Tuyến
          </span>
          <div className="flex items-center gap-4 text-xs font-medium text-zinc-600">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-zinc-50 border border-zinc-200 block"></span>{" "}
              Trống
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-50 border border-amber-300 block"></span>{" "}
              Chưa cọc
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-blue-50 border border-blue-300 block"></span>{" "}
              Đã cọc
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-300 block"></span>{" "}
              Đang chơi
            </span>
          </div>
        </div>

        {/* Khung Table Matrix */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left min-w-[1100px]">
            <thead>
              <tr className="bg-zinc-100 text-zinc-700 text-xs font-bold uppercase tracking-wider border-b border-zinc-200">
                <th className="p-4 w-28 text-center border-r border-zinc-200 sticky left-0 bg-zinc-100/95 backdrop-blur-xs z-10">
                  Khung giờ
                </th>
                {MOCK_COURTS.map((court) => (
                  <th
                    key={court.id}
                    className="p-4 text-center border-r border-zinc-200 min-w-[200px] w-[20%]"
                  >
                    <div className="font-black text-sm text-zinc-900">
                      {court.name}
                    </div>
                    {court.id === 5 ? (
                      <span className="text-[9px] font-bold text-red-600 block mt-0.5">
                        Dừng phục vụ
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-emerald-600 block mt-0.5">
                        ● Khả dụng
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-sm">
              {hours.map((hour) => {
                const isPrimeTime = parseInt(hour) >= 17;
                return (
                  <tr
                    key={hour}
                    className="hover:bg-zinc-50/60 transition-colors"
                  >
                    {/* Cột Khung giờ */}
                    <td
                      className={`p-4 text-center border-r border-zinc-200 sticky left-0 backdrop-blur-xs shadow-2xs z-10 ${isPrimeTime ? "bg-amber-50/90 text-amber-950" : "bg-white/95 text-zinc-900"}`}
                    >
                      <span className="text-base font-black block tracking-tight">
                        {hour}
                      </span>
                      <span
                        className={`text-[9px] font-bold block mt-0.5 ${isPrimeTime ? "text-amber-600" : "text-zinc-400"}`}
                      >
                        {isPrimeTime ? "🔥 Giờ vàng" : "Giờ thường"}
                      </span>
                    </td>

                    {/* Các ô Cụm Sân */}
                    {MOCK_COURTS.map((court) => {
                      const slotKey = `${hour}-${court.id}`;
                      const booking = bookings[slotKey];

                      // Trường hợp sân bảo trì
                      if (court.id === 5) {
                        return (
                          <td
                            key={slotKey}
                            className="p-3 border-r border-zinc-200 bg-zinc-100/70 text-center align-middle"
                          >
                            <span className="text-xs text-zinc-400 font-bold block">
                              🔒 Bảo trì
                            </span>
                          </td>
                        );
                      }

                      // Trường hợp ĐÃ CÓ NGƯỜI ĐẶT
                      if (booking) {
                        // Kiểm tra xem có bị ẩn bởi bộ lọc không
                        if (
                          filterStatus !== "all" &&
                          booking.status !== filterStatus
                        ) {
                          return (
                            <td
                              key={slotKey}
                              className="p-2 border-r border-zinc-200 bg-zinc-50/20"
                            ></td>
                          );
                        }

                        const isPending = booking.status === "pending";
                        const isConfirmed = booking.status === "confirmed";
                        const isCheckedIn = booking.status === "checked-in";

                        return (
                          <td
                            key={slotKey}
                            className="p-2 border-r border-zinc-200 align-top"
                          >
                            <div
                              onClick={() => handleOpenActionModal(slotKey)}
                              className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between h-full min-h-[120px] shadow-2xs hover:shadow-md relative group ${
                                isPending
                                  ? "bg-amber-50/90 border-amber-300 hover:border-amber-500"
                                  : isConfirmed
                                    ? "bg-blue-50/90 border-blue-300 hover:border-blue-500"
                                    : "bg-emerald-50/90 border-emerald-300 hover:border-emerald-500"
                              }`}
                            >
                              {/* Nút nhỏ góc báo trạng thái */}
                              <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="bg-white text-zinc-800 rounded-full px-2 py-0.5 text-[9px] font-bold border shadow-xs">
                                  ✏️ Chi tiết
                                </span>
                              </div>

                              <div>
                                {/* Tên khách & Loại */}
                                <div className="flex items-start justify-between gap-1 mb-1">
                                  <span className="font-black text-xs text-zinc-900 truncate max-w-[100px] block">
                                    {booking.user}
                                  </span>
                                  <span
                                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${
                                      booking.paid
                                        ? "bg-emerald-200/80 text-emerald-800 font-black"
                                        : "bg-amber-200/80 text-amber-800"
                                    }`}
                                  >
                                    {booking.paid
                                      ? "Đã thanh toán"
                                      : "Chưa thu"}
                                  </span>
                                </div>

                                <p className="text-[11px] font-mono text-zinc-500 mt-0.5">
                                  📞 {booking.phone}
                                </p>

                                {/* Ghi chú nếu có */}
                                {booking.note && (
                                  <p className="text-[10px] text-zinc-600 bg-white/60 px-1.5 py-0.5 rounded border border-zinc-200/40 mt-1 italic truncate">
                                    "{booking.note}"
                                  </p>
                                )}
                              </div>

                              {/* Nhãn dưới cùng */}
                              <div className="mt-3 pt-2 border-t border-black/5 flex items-center justify-between text-[10px] font-bold">
                                <span className="text-zinc-500">
                                  {booking.price.toLocaleString()} đ
                                </span>
                                <span
                                  className={
                                    isPending
                                      ? "text-amber-700"
                                      : isConfirmed
                                        ? "text-blue-700"
                                        : "text-emerald-700"
                                  }
                                >
                                  {isPending
                                    ? "⏳ Chờ cọc"
                                    : isConfirmed
                                      ? "✓ Đã giữ"
                                      : "🏸 Đang thi đấu"}
                                </span>
                              </div>
                            </div>
                          </td>
                        );
                      }

                      // Trường hợp HOÀN TOÀN TRỐNG (Cho phép đặt ngay)
                      return (
                        <td
                          key={slotKey}
                          className="p-2 border-r border-zinc-200 align-middle text-center group"
                        >
                          <div
                            onClick={() => handleOpenQuickModal(court, hour)}
                            className="h-full min-h-[120px] border-2 border-dashed border-zinc-200/80 rounded-2xl flex flex-col items-center justify-center p-2 hover:border-blue-500 hover:bg-blue-50/20 transition-all cursor-pointer"
                          >
                            <span className="text-xs text-zinc-300 font-bold group-hover:text-blue-600 block transition-colors mb-1">
                              {isPrimeTime ? "Trống (Giờ Vàng)" : "Khung trống"}
                            </span>
                            <span className="opacity-0 group-hover:opacity-100 bg-blue-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-sm transition-all transform scale-95 group-hover:scale-100">
                              + Thêm khách
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Hướng dẫn Footer */}
        <div className="p-4 bg-zinc-50 border-t border-zinc-100 text-center text-xs text-zinc-500 font-medium">
          💡 <strong>Quy tắc hệ thống:</strong> Giờ vàng áp dụng tự động giá cao
          điểm. Lịch đặt chưa cọc quá 20 phút trước ca sẽ bị cảnh báo để ưu tiên
          cho khách vãng lai.
        </div>
      </div>

      {/* ==================================================================== */}
      {/* POPUP 1: MODAL QUẢN LÝ / CHỈNH SỬA / XỬ LÝ BOOKING ĐÃ ĐẶT */}
      {/* ==================================================================== */}
      {actionModalOpen && activeBooking && (
        <div
          onClick={() => setActionModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-zinc-100 overflow-hidden"
          >
            {/* Header Modal */}
            <div className="p-6 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold bg-zinc-200 text-zinc-700 px-2 py-0.5 rounded uppercase tracking-wider">
                  Mã ca: {activeBooking.id}
                </span>
                <h3 className="text-lg font-black text-zinc-900 mt-1">
                  {activeBooking.user}
                </h3>
                <p className="text-xs text-zinc-500 font-medium mt-0.5">
                  Khung:{" "}
                  <strong className="text-blue-600">
                    {activeBookingKey.split("-")[0]}
                  </strong>{" "}
                  ● Sân số {activeBookingKey.split("-")[1]}
                </p>
              </div>
              <button
                onClick={() => setActionModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Thân Modal */}
            <div className="p-6 space-y-5">
              {/* Khung Thông tin chi phí & Thanh toán */}
              <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-200/60 flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">
                    Chi phí sân
                  </p>
                  <p className="text-xl font-black text-zinc-900 mt-0.5">
                    {activeBooking.price.toLocaleString()} VNĐ
                  </p>
                  <p className="text-[10px] text-zinc-400 font-medium">
                    Hình thức: {activeBooking.type}
                  </p>
                </div>

                <div className="text-right">
                  <span
                    className={`inline-block px-3 py-1 rounded-xl text-xs font-black uppercase mb-2 ${
                      activeBooking.paid
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        : "bg-amber-100 text-amber-800 border border-amber-200"
                    }`}
                  >
                    {activeBooking.paid ? "✓ Đã thu đủ" : "⚠️ Chưa thanh toán"}
                  </span>
                  <button
                    type="button"
                    onClick={handleTogglePaid}
                    className="block w-full text-[10px] font-bold text-blue-600 hover:underline"
                  >
                    🔄{" "}
                    {activeBooking.paid
                      ? "Chuyển về chưa thu"
                      : "Xác nhận đã thu tiền"}
                  </button>
                </div>
              </div>

              {/* Cập nhật trạng thái vận hành */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                  Chuyển trạng thái quy trình
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus("pending")}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${activeBooking.status === "pending" ? "bg-amber-500 text-white border-amber-600" : "bg-white text-zinc-700 hover:bg-zinc-50"}`}
                  >
                    ⏳ Chờ cọc
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus("confirmed")}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${activeBooking.status === "confirmed" ? "bg-blue-600 text-white border-blue-700" : "bg-white text-zinc-700 hover:bg-zinc-50"}`}
                  >
                    ✓ Đã giữ sân
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus("checked-in")}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${activeBooking.status === "checked-in" ? "bg-emerald-600 text-white border-emerald-700" : "bg-white text-zinc-700 hover:bg-zinc-50"}`}
                  >
                    🏸 Đang thi đấu
                  </button>
                </div>
              </div>

              {/* Form Ghi chú nội bộ */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                  Ghi chú vận hành (Lễ tân)
                </label>
                <textarea
                  rows="2"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Thêm ghi chú: Khách mang theo nước, mượn rổ cầu..."
                  className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-800 focus:outline-none focus:border-blue-500 resize-none"
                />
                <div className="flex justify-end mt-1.5">
                  <button
                    type="button"
                    onClick={handleSaveNote}
                    className="px-3 py-1 bg-zinc-900 text-white text-[10px] font-bold rounded-lg hover:bg-zinc-800 transition-colors"
                  >
                    Lưu ghi chú
                  </button>
                </div>
              </div>
            </div>

            {/* Footer thao tác Hủy lịch */}
            <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between">
              <button
                type="button"
                onClick={handleDeleteBooking}
                className="text-xs font-bold text-red-600 hover:text-red-800 flex items-center gap-1"
              >
                🗑️ Hủy / Xóa ca này
              </button>

              <button
                type="button"
                onClick={() => setActionModalOpen(false)}
                className="px-5 py-2 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 font-bold rounded-xl text-xs transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* POPUP 2: MODAL THÊM LỊCH ĐẶT VÃNG LAI NHANH (KHI BẤM Ô TRỐNG) */}
      {/* ==================================================================== */}
      {quickModalOpen && (
        <div
          onClick={() => setQuickModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-zinc-100 overflow-hidden"
          >
            <div className="p-6 bg-blue-600 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold bg-blue-500 text-blue-100 px-2 py-0.5 rounded uppercase tracking-wider">
                  Đặt chỗ nhanh trực tiếp
                </span>
                <h3 className="text-lg font-black mt-0.5">
                  Khung {quickSlot.time}
                </h3>
                <p className="text-xs text-blue-100 font-medium">
                  {quickSlot.courtName}
                </p>
              </div>
              <button
                onClick={() => setQuickModalOpen(false)}
                className="text-blue-200 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitQuickBooking} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">
                  Tên khách hàng *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Ví dụ: Anh Long"
                  value={quickForm.user}
                  onChange={(e) =>
                    setQuickForm({ ...quickForm, user: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  placeholder="09xx xxx xxx"
                  value={quickForm.phone}
                  onChange={(e) =>
                    setQuickForm({ ...quickForm, phone: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">
                    Phân loại
                  </label>
                  <select
                    value={quickForm.type}
                    onChange={(e) =>
                      setQuickForm({ ...quickForm, type: e.target.value })
                    }
                    className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-800 focus:outline-none"
                  >
                    <option value="Khách vãng lai">Vãng lai</option>
                    <option value="Cố định tháng">Cố định</option>
                    <option value="Khách chuyển khoản">Đã CK</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">
                    Chi phí (VNĐ)
                  </label>
                  <input
                    type="number"
                    value={quickForm.price}
                    onChange={(e) =>
                      setQuickForm({ ...quickForm, price: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">
                  Ghi chú
                </label>
                <input
                  type="text"
                  placeholder="Yêu cầu riêng..."
                  value={quickForm.note}
                  onChange={(e) =>
                    setQuickForm({ ...quickForm, note: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-800 focus:outline-none"
                />
              </div>

              <div className="pt-2 border-t border-zinc-100 flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-700">
                  Trạng thái thanh toán
                </span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={quickForm.paid}
                    onChange={(e) =>
                      setQuickForm({ ...quickForm, paid: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-xs font-bold text-emerald-600">
                    Thu tiền ngay
                  </span>
                </label>
              </div>

              <div className="flex gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setQuickModalOpen(false)}
                  className="flex-1 py-2.5 bg-zinc-100 text-zinc-600 font-bold rounded-xl text-xs"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white font-medium rounded-lg text-xs transition-colors"
                >
                  Khóa ô sân này
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingManager;
