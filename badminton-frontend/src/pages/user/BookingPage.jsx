import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { courtService } from "../../services/user/courtService";
import { bookingService } from "../../services/user/bookingService";

const BookingPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const now = new Date();
  const todayStr = now.toLocaleDateString("sv-SE");
  const currentHour = now.getHours().toString().padStart(2, "0");
  const currentMinute = now.getMinutes().toString().padStart(2, "0");
  const currentTimeStr = `${currentHour}:${currentMinute}`;

  const courtIdParam = searchParams.get("courtId");
  const rawDateParam = searchParams.get("date") || todayStr;
  const dateParam = rawDateParam < todayStr ? todayStr : rawDateParam;

  const [court, setCourt] = useState(null);
  const [slots, setSlots] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState([]);

  const [bookingType, setBookingType] = useState("single");
  const [payLater, setPayLater] = useState(false);

  const [recurringRange, setRecurringRange] = useState({
    startDate: dateParam,
    endDate: new Date(new Date(dateParam).getTime() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
  });

  // Ngày trong tuần: 1=T2, 2=T3, ..., 7=CN (ISO)
  const DAY_OPTIONS = [
    { value: 1, label: "T2" },
    { value: 2, label: "T3" },
    { value: 3, label: "T4" },
    { value: 4, label: "T5" },
    { value: 5, label: "T6" },
    { value: 6, label: "T7" },
    { value: 7, label: "CN" },
  ];

  // Khởi tạo với ngày tương ứng ngày đang chọn
  const initDayOfWeek = (() => {
    const d = new Date(dateParam).getDay();
    return d === 0 ? 7 : d;
  })();

  const [selectedDays, setSelectedDays] = useState([initDayOfWeek]);

  const toggleDay = (value) => {
    setSelectedDays((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value]
    );
  };

  // --- TRẠNG THÁI DÀI HẠN (LONG TERM) ---
  const [longTermRange, setLongTermRange] = useState({
    startDate: dateParam,
    endDate: new Date(new Date(dateParam).getTime() + 60 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
  });
  const [specificDates, setSpecificDates] = useState([]);

  const toggleSpecificDate = (dateStr) => {
    setSpecificDates((prev) =>
      prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr]
    );
  };

  // Sinh ra tất cả các ngày trong khoảng longTermRange (theo tuần để hiển thị lưới)
  const buildLongTermWeeks = () => {
    const start = new Date(longTermRange.startDate);
    const end = new Date(longTermRange.endDate);
    if (isNaN(start) || isNaN(end) || start > end) return [];

    // Tìm thứ Hai đầu tuần của start
    const firstMonday = new Date(start);
    const dayOfWeek = firstMonday.getDay(); // 0=CN, 1=T2...
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    firstMonday.setDate(firstMonday.getDate() + diff);

    const weeks = [];
    const cur = new Date(firstMonday);

    while (cur <= end) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(cur);
        const dStr = d.toLocaleDateString("sv-SE");
        const inRange = dStr >= longTermRange.startDate && dStr <= longTermRange.endDate;
        const isPast = dStr < todayStr;
        week.push({ date: d, dateStr: dStr, inRange, isPast });
        cur.setDate(cur.getDate() + 1);
      }
      weeks.push(week);
    }

    return weeks;
  };

  const [customerForm, setCustomerForm] = useState({
    fullName: "",
    phone: "",
    note: "",
  });
  const [promotionCode, setPromotionCode] = useState("");
  const [promotionPreview, setPromotionPreview] = useState(null);
  const [promotionMessage, setPromotionMessage] = useState("");
  const [isCheckingPromotion, setIsCheckingPromotion] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [createdBookingInfo, setCreatedBookingInfo] = useState(null);

  const [successModal, setSuccessModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    bookings: [],
  });

  const isLoggedIn = () => {
    return !!localStorage.getItem("current_user");
  };

  useEffect(() => {
    const fetchSystemConfig = async () => {
      if (!courtIdParam) {
        setErrorMessage("Thiếu mã định danh sân thi đấu.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage("");
      setSelectedSlots([]);

      try {
        const [courtRes, availabilityRes] = await Promise.all([
          courtService.getPublicCourtById(courtIdParam),
          courtService.getCourtSlots(courtIdParam, dateParam),
        ]);

        setCourt(courtRes.data?.data || courtRes.data);
        setSlots(availabilityRes.data?.data || []);

        const storedUser = localStorage.getItem("current_user");

        if (storedUser) {
          try {
            const userObj = JSON.parse(storedUser);

            setCustomerForm((f) => ({
              ...f,
              fullName: userObj.full_name || "",
              phone: userObj.phone || "",
            }));
          } catch (e) {
            console.error("Lỗi parse user:", e);
          }
        }
      } catch (error) {
        console.error("Lỗi API:", error);
        setErrorMessage(
          "Hệ thống bận hoặc API đang được bảo trì. Vui lòng thử lại sau.",
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchSystemConfig();
  }, [courtIdParam, dateParam]);

  useEffect(() => {
    if (!isPaymentModalOpen || !paymentInfo?.intent_code) {
      return;
    }

    const intervalId = setInterval(async () => {
      try {
        const res = await bookingService.getIntentStatus(paymentInfo.intent_code);
        const data = res.data?.data;

        if (data?.expired) {
          clearInterval(intervalId);
          setIsPaymentModalOpen(false);
          setPaymentInfo(null);
          setCreatedBookingInfo(null);
          alert("QR thanh toán đã hết hạn. Vui lòng đặt lại.");
          return;
        }

        if (data?.paid) {
          clearInterval(intervalId);
          setIsPaymentModalOpen(false);
          setPaymentInfo(null);
          setCreatedBookingInfo(null);

          if (isLoggedIn()) {
            alert("Thanh toán thành công! Đơn đặt sân đã được xác nhận.");
            navigate("/booking-history");
          } else {
            setSuccessModal({
              isOpen: true,
              title: "Thanh toán thành công!",
              message: "Đơn của bạn đã được xác nhận. Vui lòng lưu lại mã đơn để tra cứu sau này.",
              bookings: [],
            });
          }
        }
      } catch (error) {
        console.error("Lỗi kiểm tra trạng thái thanh toán:", error);
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [isPaymentModalOpen, paymentInfo, navigate]);

  const handleToggleSlot = (slot) => {
    setPromotionPreview(null);
    setPromotionMessage("");
    setSelectedSlots((prev) => {
      const exists = prev.some((s) => s.time_slot === slot.time_slot);

      if (exists) {
        return prev.filter((s) => s.time_slot !== slot.time_slot);
      }

      return [...prev, slot].sort((a, b) =>
        a.start_time.localeCompare(b.start_time),
      );
    });
  };

  const handleValidatePromotion = async () => {
    if (!promotionCode.trim()) {
      setPromotionPreview(null);
      setPromotionMessage("Vui lòng nhập mã giảm giá.");
      return;
    }

    if (totalPrice <= 0) {
      setPromotionMessage("Bạn cần chọn khung giờ trước khi áp mã.");
      return;
    }

    setIsCheckingPromotion(true);
    setPromotionMessage("");

    try {
      const response = await bookingService.validatePromotion({
        promotion_code: promotionCode.trim(),
        customer_phone: customerForm.phone,
        total_amount: totalPrice,
      });
      const data = response.data?.data;
      setPromotionPreview(data);
      setPromotionMessage(
        `Đã áp dụng ${data.code}: giảm ${Number(data.discount_amount || 0).toLocaleString("vi-VN")}đ`,
      );
    } catch (error) {
      setPromotionPreview(null);
      setPromotionMessage(
        error.response?.data?.message || "Mã giảm giá không hợp lệ.",
      );
    } finally {
      setIsCheckingPromotion(false);
    }
  };

  const handleFinalizeBooking = async (e) => {
    e.preventDefault();

    if (selectedSlots.length === 0) {
      return alert(
        "Vui lòng chọn ít nhất một khung giờ trống!",
      );
    }

    setIsSubmitting(true);

    try {
      const isPrepaid = (bookingType === "recurring" || bookingType === "long_term") ? true : !payLater;
      const totalAmount = selectedSlots.reduce(
        (acc, s) => acc + Number(s.price),
        0,
      );

      let payload = {
        court_id: courtIdParam,
        booking_type: bookingType,
        customer_name: customerForm.fullName,
        customer_phone: customerForm.phone,
        note: customerForm.note || "",
        is_prepaid: isPrepaid,
        total_amount: totalAmount,
        promotion_code: promotionCode.trim() || undefined,
      };

      if (bookingType === "single") {
        payload.slots = selectedSlots.map((s) => ({
          date: dateParam,
          start: s.start_time,
          end: s.end_time,
        }));
      } else if (bookingType === "recurring") {
        if (selectedDays.length === 0) {
          setIsSubmitting(false);
          return alert("Vui lòng chọn ít nhất một ngày trong tuần!");
        }

        const sortedSlots = [...selectedSlots].sort((a, b) =>
          a.start_time.localeCompare(b.start_time),
        );

        payload.start_date = recurringRange.startDate;
        payload.end_date = recurringRange.endDate;
        payload.start_time = sortedSlots[0].start_time;
        payload.end_time = sortedSlots[sortedSlots.length - 1].end_time;
        payload.days_of_week = selectedDays;

      } else if (bookingType === "long_term") {
        if (specificDates.length === 0) {
          setIsSubmitting(false);
          return alert("Vui lòng chọn ít nhất một ngày cụ thể trên lịch!");
        }

        const sortedSlots = [...selectedSlots].sort((a, b) =>
          a.start_time.localeCompare(b.start_time),
        );

        payload.lt_start_date = longTermRange.startDate;
        payload.lt_end_date = longTermRange.endDate;
        payload.lt_start_time = sortedSlots[0].start_time;
        payload.lt_end_time = sortedSlots[sortedSlots.length - 1].end_time;
        payload.specific_dates = specificDates;
      }

      if (isPrepaid) {
        // Thanh toán online: tạo intent trước, chưa tạo booking
        const intentRes = await bookingService.preparePayment(payload);
        const intentData = intentRes.data?.data;
        setCreatedBookingInfo({ intent_code: intentData.intent_code });
        setPaymentInfo(intentData);
        setIsPaymentModalOpen(true);
        return;
      }

      // Giữ chỗ / thanh toán tại sân: tạo booking ngay
      const response = await bookingService.createBooking(payload);

      if (response.status === 201 || response.data?.status === "success") {
        const responseData = response.data?.data || response.data;
        setCreatedBookingInfo(responseData);

        if (isLoggedIn()) {
          alert(
            "🎉 " + (response.data?.message || "Đặt sân thành công!"),
          );
          navigate("/booking-history");
        } else {
          setSuccessModal({
            isOpen: true,
            title: "Đặt sân thành công!",
            message:
              "Vui lòng lưu lại mã đơn để tra cứu lịch đặt sân sau này.",
            bookings: responseData?.bookings || [],
          });
        }
      }
    } catch (error) {
      console.error("Lỗi xử lý đặt sân:", error);
      alert(
        "❌ " +
          (error.response?.data?.message ||
            "Thao tác thất bại, vui lòng kiểm tra lại!"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClosePaymentModal = () => {
    // Intent tự hết hạn sau 30 phút — không cần cancel gì thêm.
    // Booking chưa được tạo nên không có gì để rollback.
    setIsPaymentModalOpen(false);
    setPaymentInfo(null);
    setCreatedBookingInfo(null);
    setSelectedSlots([]);
    setSpecificDates([]);
    setPromotionCode("");
    setPromotionPreview(null);
  };

  const morningSlots = slots.filter((s) => s.start_time < "12:00");
  const afternoonSlots = slots.filter(
    (s) => s.start_time >= "12:00" && s.start_time < "18:00",
  );
  const eveningSlots = slots.filter((s) => s.start_time >= "18:00");
  const perSessionPrice = selectedSlots.reduce((acc, s) => acc + Number(s.price), 0);

  const recurringSessionCount = useMemo(() => {
    if (bookingType !== "recurring" || selectedDays.length === 0) return 1;
    const start = new Date(recurringRange.startDate);
    const end = new Date(recurringRange.endDate);
    if (isNaN(start) || isNaN(end) || start > end) return 1;
    let count = 0;
    const cur = new Date(start);
    while (cur <= end) {
      const dow = cur.getDay() === 0 ? 7 : cur.getDay();
      if (selectedDays.includes(dow)) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return Math.max(count, 1);
  }, [bookingType, recurringRange, selectedDays]);

  const sessionMultiplier =
    bookingType === "long_term" ? Math.max(specificDates.length, 1)
    : bookingType === "recurring" ? recurringSessionCount
    : 1;
  const totalPrice = perSessionPrice * sessionMultiplier;
  const previewDiscount = (promotionPreview?.discount_amount || 0) * sessionMultiplier;
  const estimatedTotal = Math.max(0, totalPrice - previewDiscount);

  const inputClass = "user-input";

  return (
    <div className="bg-zinc-950 min-h-screen py-10 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-lime-500/[0.03] rounded-full blur-3xl pointer-events-none" />

      <div className="user-page-container relative z-10">
        <button
          onClick={() => navigate("/#courts")}
          className="inline-flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-lime-400 mb-8 transition-colors uppercase tracking-widest"
        >
          ← Trở về sơ đồ sân
        </button>

        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold rounded-2xl"
          >
            {errorMessage}
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="user-card-glass flex flex-col sm:flex-row justify-between items-center gap-4"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-lime-500 to-emerald-500 text-zinc-950 flex items-center justify-center font-black text-xl shadow-lg shadow-lime-500/20">
                  🏸
                </div>

                <div>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                    {court?.name || "Đang tải..."}
                  </h1>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                    {court?.floor_type || "Thảm tiêu chuẩn BWF"}
                  </p>
                </div>
              </div>

              <div className="bg-zinc-800/80 p-2 rounded-2xl border border-zinc-700/50 flex items-center gap-3">
                <span className="text-[10px] font-bold text-zinc-500 uppercase ml-2 whitespace-nowrap">
                  Ngày:
                </span>

                <input
                  type="date"
                  min={todayStr}
                  value={dateParam}
                  onChange={(e) =>
                    setSearchParams({
                      courtId: courtIdParam,
                      date: e.target.value,
                    })
                  }
                  className="user-input py-2 w-auto"
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="user-card-glass"
            >
              <h3 className="font-extrabold text-base text-white mb-8 flex items-center gap-2 uppercase tracking-wide">
                <span className="w-1.5 h-5 bg-lime-500 rounded-full" />
                Lưới Giờ Khai Thác
              </h3>

              {isLoading ? (
                <div className="py-20 text-center">
                  <span className="w-7 h-7 border-3 border-lime-500 border-t-transparent rounded-full animate-spin inline-block mb-3" />
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                    Đang tải lịch...
                  </p>
                </div>
              ) : (
                <div className="space-y-10">
                  {[
                    { label: "Ca Sáng", slots: morningSlots, icon: "☀️" },
                    { label: "Ca Chiều", slots: afternoonSlots, icon: "⛅" },
                    {
                      label: "Ca Tối · Giờ Vàng",
                      slots: eveningSlots,
                      icon: "🌙",
                    },
                  ].map((session, sIdx) => (
                    <div
                      key={sIdx}
                      className={session.slots.length === 0 ? "hidden" : ""}
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-lg">{session.icon}</span>
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400">
                          {session.label}
                        </span>
                        <span className="text-[10px] text-zinc-600 font-semibold ml-auto">
                          {session.slots.filter((s) => s.is_available).length}{" "}
                          trống
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {session.slots.map((slot, idx) => {
                          const isPassed =
                            dateParam === todayStr &&
                            slot.start_time <= currentTimeStr;

                          const isBusy = !slot.is_available;
                          const isSelected = selectedSlots.some(
                            (s) => s.time_slot === slot.time_slot,
                          );
                          const isDisabled = isPassed || isBusy;

                          return (
                            <motion.button
                              key={idx}
                              disabled={isDisabled}
                              onClick={() => handleToggleSlot(slot)}
                              whileHover={
                                !isDisabled ? { scale: 1.03, y: -3 } : {}
                              }
                              whileTap={!isDisabled ? { scale: 0.97 } : {}}
                              transition={{
                                type: "spring",
                                stiffness: 300,
                                damping: 25,
                              }}
                              className={`p-4 rounded-2xl border-2 text-left transition-all duration-300 h-[85px] flex flex-col justify-between relative overflow-hidden
                                                                ${
                                                                  isDisabled
                                                                    ? "bg-zinc-800/30 border-zinc-800/50 opacity-40 cursor-not-allowed text-zinc-500"
                                                                    : isSelected
                                                                      ? "bg-lime-500 border-lime-400 text-zinc-950 shadow-xl shadow-lime-500/25"
                                                                      : "bg-zinc-800/70 border-zinc-700/60 text-white hover:border-lime-500/40 hover:bg-zinc-800 hover:shadow-[0_0_20px_rgba(163,230,53,0.08)]"
                                                                }`}
                            >
                              {isSelected && (
                                <div className="absolute top-2 right-2 w-5 h-5 bg-zinc-950 rounded-full flex items-center justify-center text-lime-400 text-[10px] font-black">
                                  ✓
                                </div>
                              )}

                              <span
                                className={`font-mono font-extrabold text-sm ${
                                  isDisabled
                                    ? "text-zinc-600"
                                    : isSelected
                                      ? "text-zinc-950"
                                      : "text-white"
                                }`}
                              >
                                {slot.time_slot}
                              </span>

                              <div className="flex justify-between items-end">
                                <span
                                  className={`text-[9px] font-bold uppercase ${
                                    isDisabled
                                      ? "text-zinc-600"
                                      : isSelected
                                        ? "text-zinc-800"
                                        : "text-zinc-400"
                                  }`}
                                >
                                  {isPassed
                                    ? "Hết giờ"
                                    : isBusy
                                      ? "Đã kín"
                                      : "Giá ca"}
                                </span>

                                <span
                                  className={`text-sm font-extrabold ${
                                    isDisabled
                                      ? "text-zinc-600"
                                      : isSelected
                                        ? "text-zinc-950"
                                        : "text-lime-400"
                                  }`}
                                >
                                  {isPassed ? "--" : `${slot.price / 1000}k`}
                                </span>
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="user-card-glass p-0 overflow-hidden sticky top-8 shadow-2xl shadow-black/30"
          >
            <div className="grid grid-cols-3 bg-zinc-800/80 p-1.5 m-3 rounded-2xl">
              {[
                { type: "single", label: "Đặt lẻ" },
                { type: "recurring", label: "Định kỳ" },
                { type: "long_term", label: "Dài hạn" },
              ].map((t) => (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => {
                    setBookingType(t.type);
                    setPayLater(false);
                  }}
                  className={`relative py-3 rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all duration-300 ${
                    bookingType === t.type
                      ? "text-zinc-950"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {bookingType === t.type && (
                    <motion.div
                      layoutId="bookingTypeTab"
                      className="absolute inset-0 bg-lime-500 rounded-xl shadow-lg shadow-lime-500/20"
                      transition={{
                        type: "spring",
                        stiffness: 350,
                        damping: 30,
                      }}
                    />
                  )}

                  <span className="relative z-10">{t.label}</span>
                </button>
              ))}
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-3">
                  Khung giờ đã chọn
                </span>

                <div className="flex flex-wrap gap-2 min-h-[40px]">
                  {selectedSlots.length === 0 ? (
                    <p className="text-xs text-zinc-600 italic">
                      Chưa chọn giờ nào...
                    </p>
                  ) : (
                    selectedSlots.map((s) => (
                      <motion.span
                        key={s.time_slot}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="px-3 py-1.5 bg-lime-500/15 text-lime-400 text-xs font-bold rounded-xl border border-lime-500/25"
                      >
                        {s.time_slot}
                      </motion.span>
                    ))
                  )}
                </div>
              </div>

              <AnimatePresence>
                {bookingType === "recurring" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-purple-500/10 p-4 rounded-2xl border border-purple-500/20 space-y-3 overflow-hidden"
                  >
                    <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">
                      Thời hạn hợp đồng
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[9px] text-zinc-500 mb-1">Từ ngày</p>
                        <input
                          type="date"
                          value={recurringRange.startDate}
                          min={todayStr}
                          onChange={(e) =>
                            setRecurringRange((r) => ({
                              ...r,
                              startDate: e.target.value,
                            }))
                          }
                          className="user-input py-2.5"
                        />
                      </div>

                      <div>
                        <p className="text-[9px] text-zinc-500 mb-1">Đến ngày</p>
                        <input
                          type="date"
                          value={recurringRange.endDate}
                          min={recurringRange.startDate}
                          onChange={(e) =>
                            setRecurringRange((r) => ({
                              ...r,
                              endDate: e.target.value,
                            }))
                          }
                          className="user-input py-2.5"
                        />
                      </div>
                    </div>

                    <div>
                      <p className="text-[9px] text-zinc-500 mb-2">Các ngày lặp trong tuần</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {DAY_OPTIONS.map((d) => (
                          <button
                            key={d.value}
                            type="button"
                            onClick={() => toggleDay(d.value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                              selectedDays.includes(d.value)
                                ? "bg-purple-500 text-white"
                                : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-purple-400"
                            }`}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <p className="text-[9px] text-purple-400/70 italic">
                      * Khung giờ đã chọn sẽ lặp vào các ngày được đánh dấu trong suốt thời hạn hợp đồng.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {bookingType === "long_term" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-amber-500/10 p-4 rounded-2xl border border-amber-500/20 space-y-3 overflow-hidden"
                  >
                    <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">
                      Lịch dài hạn — chọn từng ngày cụ thể
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[9px] text-zinc-500 mb-1">Từ ngày</p>
                        <input
                          type="date"
                          value={longTermRange.startDate}
                          min={todayStr}
                          onChange={(e) => {
                            setLongTermRange((r) => ({ ...r, startDate: e.target.value }));
                            setSpecificDates([]);
                          }}
                          className="user-input py-2.5 focus:border-amber-400"
                        />
                      </div>
                      <div>
                        <p className="text-[9px] text-zinc-500 mb-1">Đến ngày</p>
                        <input
                          type="date"
                          value={longTermRange.endDate}
                          min={longTermRange.startDate}
                          onChange={(e) => {
                            setLongTermRange((r) => ({ ...r, endDate: e.target.value }));
                            setSpecificDates([]);
                          }}
                          className="user-input py-2.5 focus:border-amber-400"
                        />
                      </div>
                    </div>

                    {/* Lưới lịch */}
                    <div className="space-y-1">
                      <div className="grid grid-cols-7 gap-0.5 mb-1">
                        {["T2","T3","T4","T5","T6","T7","CN"].map((d) => (
                          <div key={d} className="text-center text-[9px] font-bold text-zinc-500 py-1">{d}</div>
                        ))}
                      </div>
                      {buildLongTermWeeks().map((week, wi) => (
                        <div key={wi} className="grid grid-cols-7 gap-0.5">
                          {week.map(({ date, dateStr, inRange, isPast }) => {
                            const isSelected = specificDates.includes(dateStr);
                            const disabled = !inRange || isPast;
                            return (
                              <button
                                key={dateStr}
                                type="button"
                                disabled={disabled}
                                onClick={() => toggleSpecificDate(dateStr)}
                                className={`rounded-lg py-1.5 text-[10px] font-bold transition-colors ${
                                  disabled
                                    ? "text-zinc-700 cursor-not-allowed"
                                    : isSelected
                                      ? "bg-amber-500 text-zinc-950"
                                      : "bg-zinc-800 text-zinc-300 hover:bg-amber-500/20 hover:text-amber-300"
                                }`}
                              >
                                {date.getDate()}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>

                    {specificDates.length > 0 && (
                      <div className="bg-amber-500/5 rounded-xl p-2 border border-amber-500/10">
                        <p className="text-[9px] text-amber-400 font-bold mb-1">
                          Đã chọn {specificDates.length} ngày:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {[...specificDates].sort().map((d) => (
                            <span key={d} className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-md font-mono">
                              {new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="text-[9px] text-amber-400/70 italic">
                      * Mỗi tuần có thể chọn ngày khác nhau. Tất cả dùng chung khung giờ đã chọn ở trên.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="pt-5 border-t border-dashed border-zinc-700/50">
                {bookingType === "long_term" && specificDates.length > 0 && (
                  <div className="flex justify-between items-center text-xs text-zinc-500 mb-1.5">
                    <span>{perSessionPrice.toLocaleString()}đ/ngày</span>
                    <span>× {specificDates.length} ngày</span>
                  </div>
                )}
                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-xs font-bold text-zinc-500 uppercase">
                      {bookingType === "long_term" ? "Ước tính:" : "Tổng cộng:"}
                    </span>
                    {bookingType === "long_term" && (
                      <p className="text-[10px] text-amber-500/70 mt-0.5">
                        * Giá cuối tuần có thể khác ngày thường
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-black text-lime-400 tracking-tighter">
                      {totalPrice.toLocaleString()}
                    </span>
                    <span className="text-xs text-zinc-500 font-semibold ml-1">
                      VNĐ
                    </span>
                  </div>
                </div>
              </div>

              {promotionPreview && (
                <div className="rounded-2xl border border-lime-500/20 bg-lime-500/10 p-4 text-xs font-bold text-lime-300">
                  <div className="flex justify-between">
                    <span>Voucher {promotionPreview.code}</span>
                    <span>
                      -{Number(previewDiscount).toLocaleString("vi-VN")}đ
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between border-t border-lime-500/20 pt-2 text-white">
                    <span>Tạm tính sau giảm</span>
                    <span>{estimatedTotal.toLocaleString("vi-VN")}đ</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleFinalizeBooking} className="space-y-4">
                <input
                  className={inputClass}
                  placeholder="Họ và tên đại diện *"
                  required
                  value={customerForm.fullName}
                  onChange={(e) =>
                    setCustomerForm({
                      ...customerForm,
                      fullName: e.target.value,
                    })
                  }
                />

                <input
                  className={inputClass}
                  placeholder="Số điện thoại liên hệ *"
                  required
                  value={customerForm.phone}
                  onChange={(e) =>
                    setCustomerForm({
                      ...customerForm,
                      phone: e.target.value,
                    })
                  }
                />

                <div className="rounded-2xl border border-zinc-700/60 bg-zinc-800/35 p-3">
                  <div className="flex gap-2">
                    <input
                      className={`${inputClass} uppercase`}
                      placeholder="Mã giảm giá nếu có"
                      value={promotionCode}
                      onChange={(e) => {
                        setPromotionCode(e.target.value.toUpperCase());
                        setPromotionPreview(null);
                        setPromotionMessage("");
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleValidatePromotion}
                      disabled={isCheckingPromotion || !promotionCode.trim()}
                      className="shrink-0 rounded-2xl bg-lime-500 px-4 text-xs font-black uppercase text-zinc-950 hover:bg-lime-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isCheckingPromotion ? "..." : "Áp mã"}
                    </button>
                  </div>
                  {promotionMessage && (
                    <p
                      className={`mt-2 text-[11px] font-semibold ${promotionPreview ? "text-lime-300" : "text-amber-300"}`}
                    >
                      {promotionMessage}
                    </p>
                  )}
                </div>

                {bookingType === "single" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPayLater(false)}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        !payLater
                          ? "bg-lime-500 text-zinc-950 border-lime-400"
                          : "bg-zinc-800/50 text-zinc-400 border-zinc-700/50 hover:border-lime-500/30"
                      }`}
                    >
                      <p className="text-xs font-extrabold uppercase">
                        Thanh toán online
                      </p>
                      <p className="text-[10px] mt-1 opacity-80">
                        Chuyển khoản trước qua QR
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPayLater(true)}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        payLater
                          ? "bg-lime-500 text-zinc-950 border-lime-400"
                          : "bg-zinc-800/50 text-zinc-400 border-zinc-700/50 hover:border-lime-500/30"
                      }`}
                    >
                      <p className="text-xs font-extrabold uppercase">
                        Thanh toán tại sân
                      </p>
                      <p className="text-[10px] mt-1 opacity-80">
                        Giữ chỗ, đến sân thanh toán
                      </p>
                    </button>
                  </div>
                ) : bookingType === "long_term" ? (
                  <div className="p-3 bg-amber-500/10 text-amber-400 text-[10px] font-bold text-center rounded-xl uppercase border border-amber-500/20 tracking-wider">
                    Đặt dài hạn bắt buộc thanh toán online trước
                  </div>
                ) : (
                  <div className="p-3 bg-purple-500/10 text-purple-400 text-[10px] font-bold text-center rounded-xl uppercase border border-purple-500/20 tracking-wider">
                    Đặt sân định kỳ bắt buộc thanh toán online
                    trước
                  </div>
                )}

                <motion.button
                  type="submit"
                  disabled={selectedSlots.length === 0 || isSubmitting}
                  whileHover={
                    selectedSlots.length > 0 && !isSubmitting
                      ? {
                          scale: 1.02,
                          boxShadow: "0 0 25px rgba(163,230,53,0.3)",
                        }
                      : {}
                  }
                  whileTap={
                    selectedSlots.length > 0 && !isSubmitting
                      ? { scale: 0.98 }
                      : {}
                  }
                  className={`user-btn-primary w-full py-4 ${selectedSlots.length === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {isSubmitting && (
                    <span className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                  )}

                  {isSubmitting
                    ? "Đang xử lý..."
                    : bookingType === "recurring"
                      ? "Thanh toán lịch định kỳ"
                      : bookingType === "long_term"
                        ? `Thanh toán dài hạn (${specificDates.length} ngày)`
                        : payLater
                        ? "Xác nhận giữ chỗ"
                        : `Thanh toán ${
                            estimatedTotal > 0
                              ? estimatedTotal.toLocaleString() + "đ"
                              : ""
                          }`}
                </motion.button>
              </form>
            </div>
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {isPaymentModalOpen && paymentInfo && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-100">
                <h3 className="text-lg font-extrabold text-zinc-900">
                  Thanh toán đặt sân
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Quét mã QR hoặc chuyển khoản đúng nội dung bên
                  dưới.
                </p>
              </div>

              <div className="p-6 space-y-5">
                <div className="bg-zinc-50 rounded-2xl p-4 flex justify-center border border-zinc-100">
                  <img
                    src={paymentInfo.qr_url}
                    alt="QR thanh toán"
                    className="w-64 h-64 object-contain"
                  />
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-zinc-500">Ngân hàng</span>
                    <span className="font-bold text-zinc-900 text-right">
                      {paymentInfo.bank_name}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-zinc-500">Số tài khoản</span>
                    <span className="font-bold text-zinc-900 text-right">
                      {paymentInfo.bank_account}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-zinc-500">Chủ tài khoản</span>
                    <span className="font-bold text-zinc-900 text-right">
                      {paymentInfo.account_holder}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-zinc-500">Số tiền</span>
                    <span className="font-extrabold text-lime-600 text-right">
                      {Number(paymentInfo.remaining_amount ?? paymentInfo.amount ?? 0).toLocaleString(
                        "vi-VN",
                      )}{" "}
                      VNĐ
                    </span>
                  </div>

                  <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3">
                    <p className="text-[11px] text-amber-700 font-bold uppercase mb-1">
                      Nội dung chuyển khoản
                    </p>
                    <p className="text-sm font-extrabold text-amber-900 break-all">
                      {paymentInfo.transfer_content}
                    </p>
                  </div>

                  <div className="bg-lime-50 border border-lime-100 rounded-2xl p-3">
                    <p className="text-[11px] text-lime-700 font-semibold">
                      Sau khi chuyển khoản thành công, hệ thống sẽ
                      tự xác nhận và chuyển trang.
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 pt-3">
                  <button
                    type="button"
                    onClick={handleClosePaymentModal}
                    className="flex-1 py-3 rounded-2xl bg-zinc-100 text-zinc-700 text-xs font-bold hover:bg-zinc-200"
                  >
                    Tôi đã chuyển khoản
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        paymentInfo.transfer_content,
                      );
                      alert("Đã sao chép nội dung chuyển khoản!");
                    }}
                    className="flex-1 py-3 rounded-2xl bg-zinc-900 text-white text-xs font-bold hover:bg-zinc-800"
                  >
                    Copy nội dung
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {successModal.isOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-100">
                <h3 className="text-lg font-extrabold text-zinc-900">
                  {successModal.title}
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  {successModal.message}
                </p>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-lime-50 border border-lime-100 rounded-2xl p-4">
                  <p className="text-[11px] font-bold text-lime-700 uppercase mb-2">
                    Mã đơn đặt sân
                  </p>

                  <div className="space-y-2">
                    {successModal.bookings?.map((booking, index) => (
                      <div
                        key={booking.booking_id || index}
                        className="bg-white border border-lime-100 rounded-xl p-3"
                      >
                        <p className="text-sm font-extrabold text-zinc-900">
                          {booking.booking_code || "Chưa có mã đơn"}
                        </p>

                        {booking.start_time && booking.end_time && (
                          <p className="text-[11px] text-zinc-500 mt-1">
                            Khung giờ: {booking.start_time} -{" "}
                            {booking.end_time}
                          </p>
                        )}

                        <p className="text-[11px] text-zinc-500 mt-1">
                          Số tiền:{" "}
                          {Number(booking.total_price || 0).toLocaleString(
                            "vi-VN",
                          )}
                          đ
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3">
                  <p className="text-[11px] text-amber-700 font-semibold leading-relaxed">
                    Bạn nên chụp màn hình hoặc lưu lại mã đơn
                    này. Sau này có thể dùng mã đơn để tra cứu
                    lịch đặt sân.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSuccessModal({
                        isOpen: false,
                        title: "",
                        message: "",
                        bookings: [],
                      });
                      navigate("/guest-booking-lookup");
                    }}
                    className="user-btn-primary w-full py-3"
                  >
                    Tra cứu đơn
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSuccessModal({
                        isOpen: false,
                        title: "",
                        message: "",
                        bookings: [],
                      });
                      navigate("/");
                    }}
                    className="user-btn-secondary w-full py-3"
                  >
                    Tôi đã lưu mã đơn
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BookingPage;
