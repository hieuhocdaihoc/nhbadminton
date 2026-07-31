import { useState, useEffect, useMemo } from "react";
import { toast } from "../../utils/toast";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { courtService } from "../../services/user/courtService";
import { bookingService } from "../../services/user/bookingService";
import { settingService } from "../../services/settingService";
import axiosClient from "../../services/axiosClient";

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
  const [courts, setCourts] = useState([]);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState([]);
  // Tổng tiền ước tính từ server (tính theo đúng ngày chơi thực tế) cho định kỳ/dài hạn
  const [serverEstimate, setServerEstimate] = useState(null);
  // Số buổi được thẻ cover (định kỳ/dài hạn dùng thẻ) — để hiển thị
  const [estimateCovered, setEstimateCovered] = useState(0);

  const [bookingType, setBookingType] = useState("single");
  // Đặt lẻ: "full" (chuyển khoản đủ) hoặc "deposit" (cọc giữ chỗ, trả nốt tại sân)
  const [paymentOption, setPaymentOption] = useState("full");
  const [depositPercent, setDepositPercent] = useState(20);

  useEffect(() => {
    settingService
      .getPublicSettings()
      .then((res) => {
        const pct = Number(res.data?.data?.deposit_percent);
        if (pct > 0) setDepositPercent(pct);
      })
      .catch(() => {});
  }, []);

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
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value],
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
      prev.includes(dateStr)
        ? prev.filter((d) => d !== dateStr)
        : [...prev, dateStr],
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
        const inRange =
          dStr >= longTermRange.startDate && dStr <= longTermRange.endDate;
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
  const [autoPromo, setAutoPromo] = useState(null);
  const [isAutoPromoFilled, setIsAutoPromoFilled] = useState(false);

  // Mã giảm giá ngày đặc biệt (kỷ niệm sân...) — tự động áp, hiển thị banner
  useEffect(() => {
    bookingService
      .getAutoPromotion()
      .then((res) => setAutoPromo(res.data?.data ?? null))
      .catch(() => {});
  }, []);

  // Điền sẵn mã tự động vào ô mã giảm giá để khách biết mình đang được giảm
  useEffect(() => {
    if (autoPromo?.code && !promotionCode) {
      setPromotionCode(autoPromo.code);
      setIsAutoPromoFilled(true);
    }
  }, [autoPromo, promotionCode]);

  const [errorMessage, setErrorMessage] = useState("");
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [successModal, setSuccessModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    bookings: [],
  });

  const isLoggedIn = () => {
    return !!localStorage.getItem("current_user");
  };

  // Thẻ thành viên — tự fetch khi đăng nhập
  const [memberCard, setMemberCard] = useState(null);
  useEffect(() => {
    if (!isLoggedIn()) return;
    axiosClient
      .get("/membership/my-card")
      .then((r) => setMemberCard(r.data.data || null))
      .catch(() => {});
  }, []);

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
        const [courtRes, availabilityRes, allCourtsRes] = await Promise.all([
          courtService.getPublicCourtById(courtIdParam),
          courtService.getCourtSlots(courtIdParam, dateParam),
          courtService.getPublicCourts(),
        ]);

        setCourt(courtRes.data?.data || courtRes.data);
        setSlots(availabilityRes.data?.data || []);
        setCourts(allCourtsRes.data?.data || allCourtsRes.data || []);

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
        const res = await bookingService.getIntentStatus(
          paymentInfo.intent_code,
        );
        const data = res.data?.data;

        if (data?.expired) {
          clearInterval(intervalId);
          setIsPaymentModalOpen(false);
          setPaymentInfo(null);
          toast.error("QR thanh toán đã hết hạn. Vui lòng đặt lại.");
          return;
        }

        if (data?.paid) {
          clearInterval(intervalId);
          const wasDeposit = paymentInfo?.is_deposit;
          const remainingAtVenue = paymentInfo?.remaining_at_venue;
          setIsPaymentModalOpen(false);
          setPaymentInfo(null);

          const depositNote = wasDeposit
            ? ` Vui lòng thanh toán nốt ${Number(remainingAtVenue || 0).toLocaleString("vi-VN")}đ tại sân sau khi chơi xong.`
            : "";

          if (isLoggedIn()) {
            toast.success(
              "Thanh toán thành công! Đơn đặt sân đã được xác nhận." +
                depositNote,
            );
            navigate("/booking-history");
          } else {
            const bookingCodes = data.booking_codes || [];
            setSuccessModal({
              isOpen: true,
              title: wasDeposit
                ? "Đặt cọc giữ chỗ thành công!"
                : "Thanh toán thành công!",
              message: `Đơn của bạn đã được xác nhận. Vui lòng lưu lại mã đơn để tra cứu sau này.${depositNote}`,
              bookings: bookingCodes.map((code) => ({ booking_code: code })),
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
      return toast.error("Vui lòng chọn ít nhất một khung giờ trống!");
    }

    setIsSubmitting(true);

    let payload;
    try {
      const totalAmount = selectedSlots.reduce(
        (acc, s) => acc + Number(s.price),
        0,
      );

      payload = {
        court_id: courtIdParam,
        booking_type: bookingType,
        customer_name: customerForm.fullName,
        customer_phone: customerForm.phone,
        note: customerForm.note || "",
        is_prepaid: true,
        total_amount: totalAmount,
        promotion_code: promotionCode.trim() || undefined,
        payment_option: bookingType === "single" ? paymentOption : "full",
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
          return toast.warn("Vui lòng chọn ít nhất một ngày trong tuần!");
        }
        const sortedSlots = [...selectedSlots].sort((a, b) =>
          a.start_time.localeCompare(b.start_time),
        );
        payload.start_date = recurringRange.startDate;
        payload.end_date = recurringRange.endDate;
        payload.start_time = sortedSlots[0].start_time;
        payload.end_time = sortedSlots[sortedSlots.length - 1].end_time;
        payload.time_slots = sortedSlots.map((s) => ({
          start: s.start_time,
          end: s.end_time,
        }));
        payload.days_of_week = selectedDays;
      } else if (bookingType === "long_term") {
        if (specificDates.length === 0) {
          setIsSubmitting(false);
          return toast.warn("Vui lòng chọn ít nhất một ngày cụ thể trên lịch!");
        }
        const sortedSlots = [...selectedSlots].sort((a, b) =>
          a.start_time.localeCompare(b.start_time),
        );
        payload.lt_start_date = longTermRange.startDate;
        payload.lt_end_date = longTermRange.endDate;
        payload.lt_start_time = sortedSlots[0].start_time;
        payload.lt_end_time = sortedSlots[sortedSlots.length - 1].end_time;
        payload.time_slots = sortedSlots.map((s) => ({
          start: s.start_time,
          end: s.end_time,
        }));
        payload.specific_dates = specificDates;
      }

      // Đặt lẻ dùng tối đa số ca khả dụng; backend chỉ đưa phần vượt thẻ vào QR.
      if (cardUsableForSingle && bookingType === "single") {
        payload.membership_card_id = memberCard.id;
        payload.card_sessions_planned = singleCoveredSessions;
        payload.use_membership_card = true;
      }

      // Định kỳ/dài hạn dùng thẻ: gắn thẻ để backend trừ ca các buổi trong hạn,
      // chỉ thu tiền phần vượt ca / ngoài hạn thẻ (backend tự tính coverage).
      if (
        cardUsableForContract &&
        (bookingType === "recurring" || bookingType === "long_term")
      ) {
        payload.membership_card_id = memberCard.id;
        payload.use_membership_card = true;
      }

      // ── Thanh toán online / dùng thẻ: tạo intent → hiện QR (hoặc tạo thẳng nếu thẻ cover trọn) ──
      const intentRes = await bookingService.preparePayment(payload);
      const intentData = intentRes.data?.data;

      // Thẻ cover trọn đơn/hợp đồng → không cần QR, tạo đơn trực tiếp.
      if (intentData?.fully_covered) {
        const res = await bookingService.createBooking(payload);
        const data = res.data?.data;
        const coveredCount = Number(intentData.covered_count || selectedHours);
        setSuccessModal({
          isOpen: true,
          title: "Đặt sân thành công!",
          message:
            bookingType === "single"
              ? `Đơn đã xác nhận. Thẻ ${memberCard.card_code} sẽ bị trừ ${coveredCount} ca khi hoàn thành buổi chơi.`
              : `Thẻ ${memberCard.card_code} sẽ trừ ca cho các buổi khi hoàn thành. Không cần thanh toán thêm.`,
          bookings: data?.bookings || [],
        });
        setSelectedSlots([]);
        setSpecificDates([]);
        setPromotionCode("");
        setPromotionPreview(null);
        setPromotionMessage("");
        return;
      }

      setPaymentInfo(intentData);
      setIsPaymentModalOpen(true);
    } catch (error) {
      // 409: một số buổi trùng lịch — hệ thống đề xuất đổi sân trống khác / bỏ buổi kín sân
      if (error.response?.status === 409 && error.response.data?.data) {
        const {
          moved = [],
          unavailable = [],
          playable_count: playableCount = 0,
        } = error.response.data.data;
        const lines = [];
        if (moved.length > 0) {
          lines.push(
            "Các buổi sau bị trùng lịch, sẽ ĐỔI sang sân khác còn trống:",
          );
          moved.forEach((m) => lines.push(`  • ${m.date} → ${m.court_name}`));
        }
        if (unavailable.length > 0) {
          lines.push("Các ngày sau KHÔNG còn sân nào trống, sẽ KHÔNG đặt:");
          unavailable.forEach((d) => lines.push(`  • ${d}`));
        }
        lines.push(
          "",
          `Tổng cộng sẽ đặt ${playableCount} buổi. Bạn có muốn tiếp tục?`,
        );
        if (window.confirm(lines.join("\n"))) {
          try {
            const retryPayload = { ...payload, accept_adjustments: true };
            const retryRes = await bookingService.preparePayment(retryPayload);
            const retryData = retryRes.data?.data;
            if (retryData?.fully_covered) {
              const res = await bookingService.createBooking(retryPayload);
              const data = res.data?.data;
              setSuccessModal({
                isOpen: true,
                title: "Đặt sân thành công!",
                message: `Thẻ ${memberCard.card_code} sẽ trừ ca cho các buổi khi hoàn thành. Không cần thanh toán thêm.`,
                bookings: data?.bookings || [],
              });
              setSelectedSlots([]);
              setSpecificDates([]);
              setPromotionCode("");
              setPromotionPreview(null);
            } else {
              setPaymentInfo(retryData);
              setIsPaymentModalOpen(true);
            }
          } catch (err2) {
            toast.error(
              "❌ " +
                (err2.response?.data?.message ||
                  "Thao tác thất bại, vui lòng kiểm tra lại!"),
            );
          }
        }
      } else {
        console.error("Lỗi xử lý đặt sân:", error);
        toast.error(
          "❌ " +
            (error.response?.data?.message ||
              "Thao tác thất bại, vui lòng kiểm tra lại!"),
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClosePaymentModal = () => {
    // Intent tự hết hạn sau 30 phút — không cần cancel gì thêm.
    // Booking chưa được tạo nên không có gì để rollback.
    setIsPaymentModalOpen(false);
    setPaymentInfo(null);
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
  // Số giờ đã chọn (1 slot = 1 giờ)
  const selectedHours = selectedSlots.length;

  const availableCardSessions = Number(
    memberCard?.available_sessions ?? memberCard?.remaining_sessions ?? 0,
  );
  const cardValidForSelectedDate =
    !memberCard?.valid_to_iso || dateParam <= memberCard.valid_to_iso;
  const cardUsableForSingle =
    memberCard &&
    memberCard.status === "active" &&
    cardValidForSelectedDate &&
    availableCardSessions > 0;
  const singleCoveredSessions = cardUsableForSingle
    ? Math.min(availableCardSessions, selectedHours)
    : 0;

  // Đủ toàn bộ ca thì tạo đơn trực tiếp sau khi server xác nhận, không cần QR.
  const cardApplicable =
    cardUsableForSingle && availableCardSessions >= Math.max(selectedHours, 1);

  // Định kỳ/dài hạn: thẻ chỉ cần còn ca > 0 là dùng được (cover phần nào hay phần đó,
  // phần vượt/ngoài hạn thẻ sẽ tính tiền — backend tự tính coverage).
  const cardUsableForContract =
    memberCard && memberCard.status === "active" && availableCardSessions > 0;

  const sortedSingleSlots = [...selectedSlots].sort((a, b) =>
    a.start_time.localeCompare(b.start_time),
  );
  const singlePayableBase = sortedSingleSlots
    .slice(singleCoveredSessions)
    .reduce((acc, slot) => acc + Number(slot.price), 0);
  const perSessionPrice =
    bookingType === "single"
      ? singlePayableBase
      : selectedSlots.reduce((acc, slot) => acc + Number(slot.price), 0);

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
    bookingType === "long_term"
      ? Math.max(specificDates.length, 1)
      : bookingType === "recurring"
        ? recurringSessionCount
        : 1;
  const localTotal = perSessionPrice * sessionMultiplier;
  // Định kỳ/dài hạn: dùng tổng tiền server tính theo đúng ngày chơi (tránh lấy nhầm
  // giá của ngày đang xem, VD hôm nay cuối tuần nhưng buổi chơi lại là ngày thường).
  const totalPrice =
    (bookingType === "recurring" || bookingType === "long_term") &&
    serverEstimate != null
      ? serverEstimate
      : localTotal;
  const previewDiscount =
    bookingType === "recurring" || bookingType === "long_term"
      ? promotionPreview?.discount_amount || 0
      : (promotionPreview?.discount_amount || 0) * sessionMultiplier;
  const estimatedTotal =
    (bookingType === "recurring" || bookingType === "long_term") &&
    serverEstimate != null
      ? serverEstimate
      : Math.max(0, totalPrice - previewDiscount);

  // Gọi server ước tính tổng tiền theo đúng ngày chơi cho định kỳ/dài hạn
  useEffect(() => {
    if (bookingType !== "recurring" && bookingType !== "long_term") {
      setServerEstimate(null);
      return;
    }
    if (!courtIdParam || selectedSlots.length === 0) {
      setServerEstimate(null);
      return;
    }
    const sorted = [...selectedSlots].sort((a, b) =>
      a.start_time.localeCompare(b.start_time),
    );
    const payload = {
      court_id: courtIdParam,
      start_time: sorted[0].start_time.slice(0, 5),
      end_time: sorted[sorted.length - 1].end_time.slice(0, 5),
      time_slots: sorted.map((s) => ({
        start: s.start_time.slice(0, 5),
        end: s.end_time.slice(0, 5),
      })),
      booking_type: bookingType,
    };
    if (promotionCode.trim()) {
      payload.promotion_code = promotionCode.trim();
    } else if (autoPromo?.code) {
      payload.promotion_code = autoPromo.code;
    }
    if (bookingType === "recurring") {
      if (selectedDays.length === 0) {
        setServerEstimate(null);
        return;
      }
      payload.start_date = recurringRange.startDate;
      payload.end_date = recurringRange.endDate;
      payload.days_of_week = selectedDays;
    } else {
      if (specificDates.length === 0) {
        setServerEstimate(null);
        return;
      }
      payload.dates = specificDates;
    }
    // Dùng thẻ cho hợp đồng → server tính phần thẻ cover, trả về tiền phần còn lại
    if (cardUsableForContract) {
      payload.membership_card_id = memberCard.id;
      payload.use_membership_card = true;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      bookingService
        .estimatePrice(payload)
        .then((res) => {
          if (cancelled) return;
          setServerEstimate(Number(res.data?.data?.total ?? 0));
          setEstimateCovered(Number(res.data?.data?.covered_count ?? 0));
        })
        .catch(() => {
          if (!cancelled) {
            setServerEstimate(null);
            setEstimateCovered(0);
          }
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [
    bookingType,
    courtIdParam,
    selectedSlots,
    recurringRange,
    selectedDays,
    specificDates,
    cardUsableForContract,
    memberCard,
    promotionCode,
    autoPromo,
  ]);

  // Mã tự động: khi khách đã chọn khung giờ, tự tính giảm giá để hiển thị ngay
  useEffect(() => {
    if (
      isAutoPromoFilled &&
      totalPrice > 0 &&
      !promotionPreview &&
      !isCheckingPromotion
    ) {
      handleValidatePromotion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAutoPromoFilled, totalPrice]);

  const inputClass = "user-input";

  return (
    <div className="bg-zinc-950 min-h-screen py-10 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-lime-400/[0.02] rounded-full blur-3xl pointer-events-none" />

      <div className="user-page-container relative z-10">
        <button
          onClick={() => navigate("/#courts")}
          className="inline-flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-lime-500 mb-8 transition-colors uppercase tracking-widest"
        >
          ← Trở về sơ đồ sân
        </button>

        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-400/10 border border-red-400/30 text-red-300 text-sm font-bold rounded-2xl"
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
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-lime-400 to-teal-500 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-lime-400/10">
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

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsMapOpen(!isMapOpen)}
                  className="flex items-center gap-1.5 px-4 py-2.5 border border-zinc-700 hover:border-lime-400 hover:bg-lime-400/10 hover:text-lime-500 rounded-2xl text-xs font-extrabold text-zinc-400 bg-zinc-900 transition-all shadow-sm"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    map
                  </span>
                  {isMapOpen ? "Ẩn sơ đồ" : "Xem sơ đồ sân"}
                </button>

                <div className="bg-zinc-900 p-2 rounded-2xl border border-zinc-700 shadow-sm flex items-center gap-3">
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
                    className="user-input py-1 px-3 w-auto border-none shadow-none focus:ring-0"
                  />
                </div>
              </div>
            </motion.div>

            {isMapOpen && courts.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="user-card-glass bg-zinc-900 border border-zinc-700 p-6 rounded-3xl shadow-sm"
              >
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-lime-500">
                    domain
                  </span>
                  Chọn sân nhanh từ sơ đồ:
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-700">
                  {courts.map((c) => {
                    const isSelectedCourt =
                      Number(c.id) === Number(courtIdParam);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSearchParams({
                            courtId: c.id,
                            date: dateParam,
                          });
                        }}
                        className={`relative py-4 px-3 rounded-xl border text-center transition-all duration-300 flex flex-col items-center justify-center gap-1 shadow-sm group ${
                          isSelectedCourt
                            ? "bg-lime-400/10 border-lime-400 text-lime-300 font-bold ring-2 ring-lime-400/10"
                            : "bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-lime-400 hover:text-lime-500"
                        }`}
                      >
                        <span className="material-symbols-outlined text-base">
                          sports_tennis
                        </span>
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-wide">
                            {c.name}
                          </p>
                          <p className="text-[9px] text-zinc-500 mt-0.5">
                            {c.floor_type || "Thảm BWF"}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

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
                      label: "Ca Tối",
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
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500">
                          {session.label}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-semibold ml-auto">
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
                              className={`p-4 rounded-2xl border text-left transition-all duration-300 h-[85px] flex flex-col justify-between relative overflow-hidden
                                                                ${
                                                                  isPassed
                                                                    ? "bg-zinc-700 border-zinc-500 cursor-not-allowed"
                                                                    : isBusy
                                                                      ? "bg-red-900/70 border-red-600 cursor-not-allowed"
                                                                      : isSelected
                                                                        ? "bg-lime-500 border-lime-400 text-white shadow-lg shadow-lime-500/15"
                                                                        : "bg-lime-400/20 border-lime-400/60 text-lime-300 hover:border-lime-300 hover:bg-lime-400/25 shadow-sm"
                                                                }`}
                            >
                              {isSelected && (
                                <div className="absolute top-2 right-2 w-5 h-5 bg-white rounded-full flex items-center justify-center text-lime-500 text-[10px] font-black shadow-sm">
                                  ✓
                                </div>
                              )}

                              <span
                                className={`font-mono font-extrabold text-sm ${
                                  isPassed
                                    ? "text-zinc-300"
                                    : isBusy
                                      ? "text-red-200"
                                      : isSelected
                                        ? "text-white"
                                        : "text-lime-300"
                                }`}
                              >
                                {slot.time_slot}
                              </span>

                              <div className="flex justify-between items-end">
                                <span
                                  className={`text-[9px] font-bold uppercase ${
                                    isPassed
                                      ? "text-zinc-400"
                                      : isBusy
                                        ? "text-red-300"
                                        : isSelected
                                          ? "text-lime-100"
                                          : "text-lime-400"
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
                                    isPassed
                                      ? "text-zinc-400"
                                      : isBusy
                                        ? "text-red-300"
                                        : isSelected
                                          ? "text-white"
                                          : "text-lime-300"
                                  }`}
                                >
                                  {isPassed
                                    ? "--"
                                    : isBusy
                                      ? "×"
                                      : `${slot.price / 1000}k`}
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
            className="user-card-glass p-0 overflow-hidden sticky top-8 shadow-lg shadow-zinc-200/50"
          >
            <div className="grid grid-cols-3 bg-zinc-800 p-1.5 m-3 rounded-2xl">
              {[
                { type: "single", label: "Đặt lẻ" },
                { type: "recurring", label: "Định kỳ" },
                { type: "long_term", label: "Dài hạn" },
              ].map((t) => (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => {
                    if (t.type !== "single" && !isLoggedIn()) {
                      toast.warn(
                        "Vui lòng đăng nhập để đặt sân định kỳ hoặc dài hạn.",
                      );
                      return;
                    }
                    setBookingType(t.type);
                  }}
                  className={`relative py-3 rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all duration-300 ${
                    bookingType === t.type
                      ? "text-white"
                      : "text-zinc-500 hover:text-white"
                  }`}
                >
                  {bookingType === t.type && (
                    <motion.div
                      layoutId="bookingTypeTab"
                      className="absolute inset-0 bg-lime-500 rounded-xl shadow-md"
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
                    <p className="text-xs text-zinc-400 italic">
                      Chưa chọn giờ nào...
                    </p>
                  ) : (
                    selectedSlots.map((s) => (
                      <motion.span
                        key={s.time_slot}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="px-3 py-1.5 bg-lime-400/10 text-lime-500 text-xs font-bold rounded-xl border border-lime-400/30"
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
                    className="bg-purple-400/10 p-4 rounded-2xl border border-purple-400/30 space-y-3 overflow-hidden"
                  >
                    <p className="text-[10px] font-bold text-purple-300 uppercase tracking-widest">
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
                        <p className="text-[9px] text-zinc-500 mb-1">
                          Đến ngày
                        </p>
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
                      <p className="text-[9px] text-zinc-500 mb-2">
                        Các ngày lặp trong tuần
                      </p>
                      <div className="flex gap-1.5 flex-wrap">
                        {DAY_OPTIONS.map((d) => (
                          <button
                            key={d.value}
                            type="button"
                            onClick={() => toggleDay(d.value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                              selectedDays.includes(d.value)
                                ? "bg-purple-600 text-white"
                                : "bg-zinc-900 text-zinc-400 border border-zinc-700 hover:border-purple-500"
                            }`}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <p className="text-[9px] text-purple-300 italic">
                      * Khung giờ đã chọn sẽ lặp vào các ngày được đánh dấu
                      trong suốt thời hạn hợp đồng.
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
                    className="bg-amber-400/10 p-4 rounded-2xl border border-amber-400/30 space-y-3 overflow-hidden"
                  >
                    <p className="text-[10px] font-bold text-amber-300 uppercase tracking-widest">
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
                            setLongTermRange((r) => ({
                              ...r,
                              startDate: e.target.value,
                            }));
                            setSpecificDates([]);
                          }}
                          className="user-input py-2.5 focus:border-amber-400"
                        />
                      </div>
                      <div>
                        <p className="text-[9px] text-zinc-500 mb-1">
                          Đến ngày
                        </p>
                        <input
                          type="date"
                          value={longTermRange.endDate}
                          min={longTermRange.startDate}
                          onChange={(e) => {
                            setLongTermRange((r) => ({
                              ...r,
                              endDate: e.target.value,
                            }));
                            setSpecificDates([]);
                          }}
                          className="user-input py-2.5 focus:border-amber-400"
                        />
                      </div>
                    </div>

                    {/* Lưới lịch */}
                    <div className="space-y-1">
                      <div className="grid grid-cols-7 gap-0.5 mb-1">
                        {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((d) => (
                          <div
                            key={d}
                            className="text-center text-[9px] font-bold text-zinc-500 py-1"
                          >
                            {d}
                          </div>
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
                                    ? "text-zinc-300 cursor-not-allowed"
                                    : isSelected
                                      ? "bg-amber-400 text-white"
                                      : "bg-zinc-900 text-zinc-300 border border-zinc-700 hover:bg-amber-400/20 hover:text-amber-300"
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
                      <div className="bg-amber-400/10 rounded-xl p-2 border border-amber-400/30">
                        <p className="text-[9px] text-amber-300 font-bold mb-1">
                          Đã chọn {specificDates.length} ngày:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {[...specificDates].sort().map((d) => (
                            <span
                              key={d}
                              className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-md font-mono border border-amber-400/30"
                            >
                              {new Date(d).toLocaleDateString("vi-VN", {
                                day: "2-digit",
                                month: "2-digit",
                              })}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="text-[9px] text-amber-300 italic">
                      * Mỗi tuần có thể chọn ngày khác nhau. Tất cả dùng chung
                      khung giờ đã chọn ở trên.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="pt-5 border-t border-dashed border-zinc-700">
                {bookingType === "long_term" && specificDates.length > 0 && (
                  <div className="flex justify-between items-center text-xs text-zinc-500 mb-2">
                    <span>Số buổi đã chọn:</span>
                    <span className="font-mono font-bold text-zinc-300">
                      {specificDates.length} buổi
                    </span>
                  </div>
                )}

                {/* Hộp quà tặng "Kỷ niệm 1 năm" / Khuyến mãi tự động */}
                {autoPromo && (
                  <div className="mb-4 rounded-2xl border border-lime-400/30 bg-lime-400/10 p-3 flex items-start gap-2.5 shadow-sm">
                    <span className="material-symbols-outlined text-lime-500 text-base mt-0.5 animate-bounce">
                      celebration
                    </span>
                    <div>
                      <p className="text-[11px] font-black text-lime-300 uppercase tracking-wider">
                        {autoPromo.name}
                      </p>
                      <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
                        Ưu đãi tự động: giảm{" "}
                        <span className="font-extrabold text-lime-500">
                          {autoPromo.discount_type === "percent"
                            ? `${autoPromo.discount_value}%`
                            : `${Number(autoPromo.discount_value).toLocaleString("vi-VN")}đ`}
                        </span>
                        . Đã tự động điền mã{" "}
                        <b className="font-mono text-lime-300">
                          {autoPromo.code}
                        </b>
                        .
                      </p>
                    </div>
                  </div>
                )}

                {/* Banner thẻ thành viên auto-apply */}
                {memberCard &&
                  bookingType === "single" &&
                  selectedHours > 0 && (
                    <div
                      className={`mb-4 rounded-2xl border p-3 flex items-start gap-2.5 shadow-sm ${
                        singleCoveredSessions > 0
                          ? "border-lime-500/40 bg-lime-500/10"
                          : "border-amber-500/40 bg-amber-500/10"
                      }`}
                    >
                      <span
                        className="material-symbols-outlined text-base mt-0.5 flex-shrink-0"
                        style={{
                          color:
                            singleCoveredSessions > 0 ? "#84cc16" : "#f59e0b",
                        }}
                      >
                        credit_card
                      </span>
                      <div className="flex-1 min-w-0">
                        {cardApplicable ? (
                          <>
                            <p className="text-[11px] font-black text-lime-300 uppercase tracking-wider">
                              Đang dùng thẻ {memberCard.card_code}
                            </p>
                            <p className="text-[10px] text-zinc-400 mt-0.5">
                              Khả dụng{" "}
                              <span className="text-lime-400 font-bold">
                                {availableCardSessions} ca
                              </span>
                              {" → "}trừ{" "}
                              <span className="text-lime-300 font-bold">
                                {selectedHours} ca
                              </span>{" "}
                              khi hoàn thành
                            </p>
                          </>
                        ) : singleCoveredSessions > 0 ? (
                          <>
                            <p className="text-[11px] font-black text-lime-300 uppercase tracking-wider">
                              Thẻ {memberCard.card_code} áp dụng một phần
                            </p>
                            <p className="text-[10px] text-zinc-400 mt-0.5">
                              Dùng thẻ{" "}
                              <span className="text-lime-400 font-bold">
                                {singleCoveredSessions} ca
                              </span>
                              {" · "}Thanh toán{" "}
                              <span className="text-amber-300 font-bold">
                                {selectedHours - singleCoveredSessions} ca còn
                                lại
                              </span>
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-[11px] font-black text-amber-300 uppercase tracking-wider">
                              Thẻ {memberCard.card_code} còn 0 ca khả dụng
                            </p>
                            <p className="text-[10px] text-zinc-400 mt-0.5">
                              Đã giữ cho đơn đang mở:{" "}
                              <span className="text-amber-400 font-bold">
                                {Number(memberCard.committed_sessions || 0)} ca
                              </span>
                              {" · "}Đơn này sẽ thanh toán{" "}
                              <span className="text-amber-300 font-bold">
                                {selectedHours} ca
                              </span>
                              .
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                {/* Tóm tắt tổng tiền */}
                <div className="flex justify-between items-center bg-zinc-900/60 border border-zinc-700 rounded-2xl p-4 mb-4 shadow-sm">
                  <div>
                    <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest block">
                      Tổng tiền thanh toán
                    </span>
                    {bookingType === "long_term" && (
                      <span className="text-[9px] text-amber-300 font-bold block mt-0.5">
                        * Có thể thay đổi theo ngày
                      </span>
                    )}
                    {cardUsableForContract &&
                      (bookingType === "recurring" ||
                        bookingType === "long_term") &&
                      estimateCovered > 0 && (
                        <span className="text-[9px] text-lime-400 font-bold block mt-0.5">
                          ✓ {estimateCovered} ca dùng thẻ (được trừ tiền)
                          {serverEstimate > 0 ? ", phần thừa tính tiền" : ""}
                        </span>
                      )}
                    {bookingType === "single" && singleCoveredSessions > 0 && (
                      <span className="text-[9px] text-lime-400 font-bold block mt-0.5">
                        {singleCoveredSessions} ca dùng thẻ
                        {singleCoveredSessions < selectedHours
                          ? `, ${selectedHours - singleCoveredSessions} ca tính tiền`
                          : ", không cần thanh toán thêm"}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-black text-lime-500 tracking-tighter block leading-none">
                      {(promotionPreview
                        ? estimatedTotal
                        : totalPrice
                      ).toLocaleString("vi-VN")}
                      <span className="text-xs text-zinc-500 font-bold ml-1">
                        đ
                      </span>
                    </span>
                    {promotionPreview && (
                      <span className="text-[10px] text-zinc-500 line-through block mt-1">
                        {totalPrice.toLocaleString("vi-VN")}đ
                      </span>
                    )}
                  </div>
                </div>

                {bookingType === "single" &&
                  paymentOption === "deposit" &&
                  totalPrice > 0 &&
                  (() => {
                    const grandTotal = promotionPreview
                      ? estimatedTotal
                      : totalPrice;
                    const effectiveDeposit = Math.max(
                      1000,
                      Math.min(
                        grandTotal,
                        Math.round((grandTotal * depositPercent) / 100),
                      ),
                    );
                    return (
                      <div className="mt-3 pt-3 border-t border-zinc-700 grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-[9px] font-bold text-lime-400 uppercase tracking-widest block">
                            Cọc giữ chỗ
                          </span>
                          <span className="text-sm font-black text-lime-300">
                            {effectiveDeposit.toLocaleString("vi-VN")}đ
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">
                            Còn lại tại sân
                          </span>
                          <span className="text-sm font-black text-zinc-300">
                            {Math.max(
                              0,
                              grandTotal - effectiveDeposit,
                            ).toLocaleString("vi-VN")}
                            đ
                          </span>
                        </div>
                      </div>
                    );
                  })()}
              </div>

              {promotionPreview && (
                <div className="rounded-2xl border border-lime-400/30 bg-lime-400/10 px-4 py-3 text-xs font-bold text-lime-300 shadow-sm flex items-center justify-between mb-4">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px]">
                      local_activity
                    </span>{" "}
                    Voucher {promotionPreview.code}
                  </span>
                  <span>
                    -{Number(previewDiscount).toLocaleString("vi-VN")}đ
                  </span>
                </div>
              )}

              <form onSubmit={handleFinalizeBooking} className="space-y-4">
                {/* Nhập thông tin liên hệ */}
                <div className="space-y-2">
                  <p className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest">
                    Thông tin khách chơi
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      className={`${inputClass} py-2.5 text-xs`}
                      placeholder="Họ tên đại diện *"
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
                      className={`${inputClass} py-2.5 text-xs`}
                      placeholder="Số điện thoại *"
                      required
                      value={customerForm.phone}
                      onChange={(e) =>
                        setCustomerForm({
                          ...customerForm,
                          phone: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                {/* Nhập mã giảm giá */}
                <div className="rounded-2xl border border-zinc-700 bg-zinc-900/60 p-3 space-y-2">
                  <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                    Có mã giảm giá khác?
                  </p>
                  <div className="flex gap-2">
                    <input
                      className={`${inputClass} uppercase py-2 px-3 text-xs bg-zinc-900`}
                      placeholder="MÃ VOUCHER"
                      value={promotionCode}
                      onChange={(e) => {
                        setPromotionCode(e.target.value.toUpperCase());
                        setPromotionPreview(null);
                        setPromotionMessage("");
                        setIsAutoPromoFilled(false);
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleValidatePromotion}
                      disabled={isCheckingPromotion || !promotionCode.trim()}
                      className="shrink-0 rounded-xl bg-lime-500 hover:bg-lime-400 px-4 text-xs font-black uppercase text-white disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                    >
                      {isCheckingPromotion ? "..." : "Áp dụng"}
                    </button>
                  </div>
                  {promotionMessage && (
                    <p
                      className={`text-[10px] font-semibold ${promotionPreview ? "text-lime-500" : "text-amber-300"}`}
                    >
                      {promotionMessage}
                    </p>
                  )}
                </div>

                {/* Phương thức thanh toán — ẩn khi dùng thẻ thành viên */}
                <div className="space-y-2">
                  <p className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest">
                    Phương thức thanh toán
                  </p>
                  {bookingType === "single" && cardApplicable ? (
                    <div className="p-3 bg-lime-500/10 text-lime-300 text-[10px] font-bold text-center rounded-xl uppercase border border-lime-500/30 tracking-wider">
                      Đã thanh toán qua thẻ thành viên — không cần chuyển khoản
                    </div>
                  ) : bookingType === "single" ? (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setPaymentOption("full")}
                          className={`p-3.5 rounded-2xl border text-left transition-all duration-300 ${
                            paymentOption === "full"
                              ? "bg-lime-500 text-zinc-950 border-lime-400 shadow-md shadow-lime-400/20"
                              : "bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-lime-400/40 hover:bg-zinc-900/60 shadow-sm"
                          }`}
                        >
                          <p className="text-[11px] font-black uppercase tracking-wider">
                            Thanh toán đủ
                          </p>
                          <p
                            className={`text-[9px] mt-0.5 ${paymentOption === "full" ? "text-zinc-800" : "text-zinc-500"}`}
                          >
                            Chuyển khoản 100% qua QR
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPaymentOption("deposit")}
                          className={`p-3.5 rounded-2xl border text-left transition-all duration-300 ${
                            paymentOption === "deposit"
                              ? "bg-lime-500 text-zinc-950 border-lime-400 shadow-md shadow-lime-400/20"
                              : "bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-lime-400/40 hover:bg-zinc-900/60 shadow-sm"
                          }`}
                        >
                          <p className="text-[11px] font-black uppercase tracking-wider">
                            Đặt cọc {depositPercent}%
                          </p>
                          <p
                            className={`text-[9px] mt-0.5 ${paymentOption === "deposit" ? "text-zinc-800" : "text-zinc-500"}`}
                          >
                            Giữ chỗ, trả nốt tại sân
                          </p>
                        </button>
                      </div>
                      {paymentOption === "deposit" && (
                        <p className="text-[10px] text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded-xl px-3 py-2 leading-relaxed">
                          Bạn sẽ chuyển khoản trước {depositPercent}% tổng tiền
                          để giữ chỗ, phần còn lại thanh toán tại sân sau khi
                          chơi xong. Tiền cọc <b>không hoàn lại</b> nếu hủy hoặc
                          không đến đúng giờ.
                        </p>
                      )}
                    </>
                  ) : bookingType === "long_term" ? (
                    <div className="p-3 bg-amber-400/10 text-amber-300 text-[10px] font-bold text-center rounded-xl uppercase border border-amber-400/30 tracking-wider">
                      Đặt dài hạn bắt buộc thanh toán online trước
                    </div>
                  ) : (
                    <div className="p-3 bg-purple-400/10 text-purple-300 text-[10px] font-bold text-center rounded-xl uppercase border border-purple-400/30 tracking-wider">
                      Đặt định kỳ bắt buộc thanh toán online trước
                    </div>
                  )}
                </div>

                {/* Nút thanh toán duy nhất */}
                <motion.button
                  type="submit"
                  disabled={selectedSlots.length === 0 || isSubmitting}
                  whileHover={
                    selectedSlots.length > 0 && !isSubmitting
                      ? { scale: 1.02 }
                      : {}
                  }
                  whileTap={
                    selectedSlots.length > 0 && !isSubmitting
                      ? { scale: 0.98 }
                      : {}
                  }
                  className={`user-btn-primary w-full py-4 text-xs font-black uppercase tracking-widest ${selectedSlots.length === 0 ? "opacity-50 cursor-not-allowed shadow-none" : ""}`}
                >
                  {isSubmitting && (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  )}
                  {isSubmitting
                    ? "Đang xử lý..."
                    : bookingType === "single" && cardApplicable
                      ? "ĐẶT SÂN — DÙNG THẺ THÀNH VIÊN"
                      : bookingType === "single" && paymentOption === "deposit"
                        ? `TIẾP TỤC — ĐẶT CỌC ${depositPercent}%`
                        : "TIẾP TỤC THANH TOÁN"}
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
              className="bg-zinc-900 border border-zinc-700 w-full max-w-md rounded-3xl overflow-hidden shadow-xl"
            >
              <div className="p-6 border-b border-zinc-800">
                <h3 className="text-lg font-extrabold text-white">
                  Thanh toán đặt sân
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Quét mã QR hoặc chuyển khoản đúng nội dung bên dưới.
                </p>
              </div>

              <div className="p-6 space-y-5">
                <div className="bg-white rounded-2xl p-4 flex justify-center border border-zinc-800">
                  <img
                    src={paymentInfo.qr_url}
                    alt="QR thanh toán"
                    className="w-64 h-64 object-contain"
                  />
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-zinc-500">Ngân hàng</span>
                    <span className="font-bold text-white text-right">
                      {paymentInfo.bank_name}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-zinc-500">Số tài khoản</span>
                    <span className="font-bold text-white text-right">
                      {paymentInfo.bank_account}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-zinc-500">Chủ tài khoản</span>
                    <span className="font-bold text-white text-right">
                      {paymentInfo.account_holder}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-zinc-500">
                      {paymentInfo.is_deposit ? "Đặt cọc giữ chỗ" : "Số tiền"}
                    </span>
                    <span className="font-extrabold text-lime-500 text-right">
                      {Number(paymentInfo.amount ?? 0).toLocaleString("vi-VN")}{" "}
                      VNĐ
                    </span>
                  </div>

                  {paymentInfo.is_deposit && (
                    <div className="flex justify-between gap-4">
                      <span className="text-zinc-500">
                        Còn lại thanh toán tại sân
                      </span>
                      <span className="font-extrabold text-zinc-300 text-right">
                        {Number(
                          paymentInfo.remaining_at_venue ?? 0,
                        ).toLocaleString("vi-VN")}{" "}
                        VNĐ
                      </span>
                    </div>
                  )}

                  <div className="bg-amber-400/10 border border-amber-400/30 rounded-2xl p-3">
                    <p className="text-[11px] text-amber-300 font-bold uppercase mb-1">
                      Nội dung chuyển khoản
                    </p>
                    <p className="text-sm font-extrabold text-amber-200 break-all font-mono">
                      {paymentInfo.transfer_content}
                    </p>
                  </div>

                  {paymentInfo.is_deposit && (
                    <div className="bg-amber-400/10 border border-amber-400/30 rounded-2xl p-3">
                      <p className="text-[11px] text-amber-300 font-semibold leading-relaxed">
                        Đây là tiền cọc giữ chỗ, <b>không hoàn lại</b> nếu hủy
                        hoặc không đến. Phần còn lại vui lòng thanh toán tại sân
                        sau khi chơi xong.
                      </p>
                    </div>
                  )}

                  <div className="bg-lime-400/10 border border-lime-400/30 rounded-2xl p-3">
                    <p className="text-[11px] text-lime-300 font-semibold">
                      Sau khi chuyển khoản thành công, hệ thống sẽ tự xác nhận
                      và chuyển trang.
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 pt-3">
                  <button
                    type="button"
                    onClick={handleClosePaymentModal}
                    className="flex-1 py-3 rounded-2xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-200 border border-zinc-700 transition-colors"
                  >
                    Tôi đã chuyển khoản
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        paymentInfo.transfer_content,
                      );
                      toast.success("Đã sao chép nội dung chuyển khoản!");
                    }}
                    className="flex-1 py-3 rounded-2xl bg-lime-500 text-white text-xs font-extrabold hover:bg-lime-400 transition-colors"
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
              className="bg-zinc-900 border border-zinc-700 w-full max-w-md rounded-3xl overflow-hidden shadow-xl"
            >
              <div className="p-6 border-b border-zinc-700">
                <h3 className="text-lg font-extrabold text-white">
                  {successModal.title}
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  {successModal.message}
                </p>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-lime-400/10 border border-lime-400/30 rounded-2xl p-4">
                  <p className="text-[11px] font-bold text-lime-500 uppercase mb-2">
                    Mã đơn đặt sân
                  </p>

                  <div className="space-y-2">
                    {successModal.bookings?.map((booking, index) => (
                      <div
                        key={booking.booking_id || index}
                        className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 shadow-sm"
                      >
                        <p className="text-sm font-extrabold text-lime-500">
                          {booking.booking_code || "Chưa có mã đơn"}
                        </p>

                        {booking.start_time && booking.end_time && (
                          <p className="text-[11px] text-zinc-500 mt-1">
                            Khung giờ: {booking.start_time} - {booking.end_time}
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

                <div className="bg-amber-400/10 border border-amber-400/30 rounded-2xl p-3">
                  <p className="text-[11px] text-amber-300 font-semibold leading-relaxed">
                    Bạn nên chụp màn hình hoặc lưu lại mã đơn này. Sau này có
                    thể dùng mã đơn để tra cứu lịch đặt sân.
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
