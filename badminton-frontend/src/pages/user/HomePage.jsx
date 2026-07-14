import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { courtService } from "../../services/user/courtService";
import { reviewService } from "../../services/user/reviewService";

/* ═══════════════════════════════════════════════════════════
   DỮ LIỆU TĨNH - GIỮ NGUYÊN TỪ BẢN GỐC
   ═══════════════════════════════════════════════════════════ */
const NH_UTILITIES = [
  {
    icon: "bolt",
    title: "Giữ chỗ tự động 100%",
    desc: "Hệ thống xử lý thời gian thực. Sân của bạn được khóa lịch ngay lập tức khi hoàn tất thanh toán cọc. Đặt sân, hủy sân, thay đổi lịch hoàn toàn tự động — không cần gọi điện chờ đợi.",
    span: true,
  },
  {
    icon: "layers",
    title: "Thảm Tiêu Chuẩn BWF",
    desc: "100% mặt sân sử dụng thảm chất lượng cao, độ bám tốt, bảo vệ khớp.",
  },
  {
    icon: "qr_code_scanner",
    title: "Thanh toán QR siêu tốc",
    desc: "Tích hợp cổng thanh toán trực tuyến qua mã QR tự động. Chạm là xong, vào sân ngay.",
  },
  {
    icon: "storefront",
    title: "Tiện ích Pro-shop trọn gói",
    desc: "Cung cấp đầy đủ nước giải khát, cho thuê vợt, đan lưới kỹ thuật số ngay tại quầy lễ tân trung tâm. Mọi thứ bạn cần cho một buổi tập hoàn hảo.",
    span: true,
  },
];

const STEPS = [
  {
    number: "01",
    title: "Chọn vị trí sân",
    desc: "Quan sát sa bàn trực quan của NH Badminton và click vào vị trí sân thi đấu mà bạn muốn chơi.",
  },
  {
    number: "02",
    title: "Chọn khung giờ",
    desc: "Hệ thống hiển thị lưới giờ trống thực tế. Bạn có thể chọn đặt lẻ 1 ngày hoặc chọn đặt cố định theo tháng.",
  },
  {
    number: "03",
    title: "Xác nhận & Cọc",
    desc: "Phân luồng thanh toán thông minh giữa khách chơi lẻ và khách đặt lịch cố định dài hạn.",
  },
  {
    number: "04",
    title: "Check-in vào sân",
    desc: "Nhận mã đặt sân. Đến trung tâm, đưa mã cho lễ tân để nhận thảm và bắt đầu trận đấu!",
  },
];

/* ═══════════════════════════════════════════════════════════
   FRAMER MOTION VARIANTS
   ═══════════════════════════════════════════════════════════ */
const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
  },
};
const fadeSlideUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};
const floatAnimation = {
  y: [0, -12, 0],
  rotate: [0, 3, -3, 0],
  transition: { duration: 5, repeat: Infinity, ease: "easeInOut" },
};
const floatSlow = {
  y: [0, -18, 0],
  transition: { duration: 7, repeat: Infinity, ease: "easeInOut" },
};

/* ═══════════════════════════════════════════════════════════
   HOMEPAGE COMPONENT
   ═══════════════════════════════════════════════════════════ */
const HomePage = () => {
  const navigate = useNavigate();
  // ─── STATES GIỮ NGUYÊN ───
  const [publicCourts, setPublicCourts] = useState([]);
  const [publicReviews, setPublicReviews] = useState([]);
  const [pricings, setPricings] = useState({ weekday: [], weekend: [], holiday: [] });
  const [reviewSummary, setReviewSummary] = useState({
    average_rating: 0,
    total_reviews: 0,
  });
  const [reviewIndex, setReviewIndex] = useState(0);
  const [isLoadingCourts, setIsLoadingCourts] = useState(false);
  const [searchDate, setSearchDate] = useState(
    new Date().toLocaleDateString("sv-SE"),
  );
  const [blockedBanner, setBlockedBanner] = useState(false);
  const [previewCourt, setPreviewCourt] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("blocked") === "1") {
      setBlockedBanner(true);
      window.history.replaceState({}, "", "/");
    }
  }, []);

  // ─── FETCH COURTS TỪ API ───
  useEffect(() => {
    const fetchCourts = async () => {
      setIsLoadingCourts(true);
      try {
        const response = await courtService.getPublicCourts();
        const courtsData = response.data?.data || response.data || [];
        const list = Array.isArray(courtsData) ? courtsData : [];
        setPublicCourts(list);
        if (list.length > 0) setPreviewCourt(list[0]);
      } catch (error) {
        console.error("Lỗi tải danh sách sân trang chủ:", error);
      } finally {
        setIsLoadingCourts(false);
      }
    };
    fetchCourts();
  }, []);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const response = await reviewService.getPublicReviews({
          target_type: "court",
          limit: 6,
        });
        const payload = response.data?.data || {};
        setPublicReviews(payload.reviews || []);
        setReviewSummary(
          payload.summary || { average_rating: 0, total_reviews: 0 },
        );
      } catch (error) {
        console.error("Lỗi tải đánh giá trang chủ:", error);
      }
    };

    fetchReviews();
  }, []);

  useEffect(() => {
    courtService.getPublicPricings()
      .then((res) => setPricings(res.data?.data || { weekday: [], weekend: [], holiday: [] }))
      .catch(() => {});
  }, []);

  // ─── ĐIỀU HƯỚNG CHỌN SÂN ───
  const handleSelectCourtToBook = (court) => {
    if (!searchDate) {
      alert("Vui lòng chọn ngày thi đấu trước!");
      return;
    }
    navigate(`/booking-page?courtId=${court.id}&date=${searchDate}`);
  };

  return (
    <div className="bg-zinc-950 font-sans text-zinc-300 selection:bg-lime-400 selection:text-white overflow-x-hidden">
      {blockedBanner && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-red-600 text-white px-6 py-3 rounded-xl shadow-lg text-sm font-medium">
          <span>🔒</span>
          <span>
            Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.
          </span>
          <button
            onClick={() => setBlockedBanner(false)}
            className="ml-2 text-white/70 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* ╔══════════════════════════════════════════════════════╗F
                ║  PHẦN MỞ ĐẦU (HERO) - GIAO DIỆN LIGHT SPORTY KÈM HIỆU ỨNG NỔI ║
                ╚══════════════════════════════════════════════════════╝ */}
      <section className="relative min-h-[92vh] flex items-center pt-24 pb-20 overflow-hidden">
        {/* ── TRANG TRÍ NỀN ── */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-lime-400/5 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-teal-400/5 rounded-full blur-3xl" />
          <div className="absolute top-1/3 right-1/4 w-px h-40 bg-gradient-to-b from-lime-400/20 to-transparent rotate-12" />
          <div className="absolute bottom-1/4 left-1/3 w-px h-32 bg-gradient-to-b from-lime-400/10 to-transparent -rotate-12" />
        </div>

        <div className="user-page-container relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* ── TRÁI: NỘI DUNG VĂN BẢN (Stagger Fade-in) ── */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="text-center lg:text-left"
            >
              {/* Huy hiệu */}
              <motion.div
                variants={fadeSlideUp}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-lime-400/10 border border-lime-400/30 text-lime-500 font-bold text-xs uppercase tracking-widest mb-8"
              >
                <span className="w-2 h-2 rounded-full bg-lime-400 animate-pulse" />
                Trung tâm Cầu lông Tiêu chuẩn BWF
              </motion.div>

              {/* Khẩu hiệu */}
              <motion.h1
                variants={fadeSlideUp}
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.05] uppercase"
              >
                Bứt Phá
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-lime-500 via-teal-600 to-lime-400">
                  Giới Hạn
                </span>
                <br />
                <span className="text-zinc-500 text-3xl sm:text-4xl md:text-5xl block mt-2">
                  Làm Chủ Sân Đấu
                </span>
              </motion.h1>

              {/* Đoạn mô tả */}
              <motion.p
                variants={fadeSlideUp}
                className="mt-6 text-base md:text-lg text-zinc-400 max-w-lg mx-auto lg:mx-0 leading-relaxed"
              >
                Trải nghiệm hệ thống mặt sân thảm cao cấp chuẩn quốc tế. Chủ
                động kiểm tra giờ trống và đặt lịch tự động, không cần chờ đợi.
              </motion.p>

              {/* Nút bấm Hành động */}
              <motion.div
                variants={fadeSlideUp}
                className="mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
              >
                <motion.a
                  href="/#courts"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  className="user-btn-primary px-8 py-4 text-base"
                >
                  🏸 Đặt Sân Ngay
                </motion.a>
                <motion.a
                  href="/#steps"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  className="user-btn-secondary px-8 py-4 text-base"
                >
                  Tìm hiểu quy trình →
                </motion.a>
              </motion.div>

              {/* Thống kê nhỏ */}
              <motion.div
                variants={fadeSlideUp}
                className="mt-12 flex items-center gap-8 justify-center lg:justify-start"
              >
                {[
                  { val: "5+", label: "Sân thi đấu" },
                  { val: "18h", label: "Hoạt động/ngày" },
                  { val: "100%", label: "Thảm BWF" },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <p className="text-2xl font-black text-lime-500">{s.val}</p>
                    <p className="text-[11px] text-zinc-500 font-semibold uppercase tracking-wider mt-0.5">
                      {s.label}
                    </p>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            {/* ── PHẢI: HÌNH ẢNH TRỪU TƯỢNG NỔI ── */}
            <div className="relative h-[420px] lg:h-[520px] hidden lg:block">
              {/* Vòng tròn lớn */}
              <motion.div
                animate={floatSlow}
                className="absolute top-8 right-8 w-72 h-72 rounded-full border-2 border-lime-400/15 bg-gradient-to-br from-lime-400/5 to-transparent"
              />

              {/* Hình quả cầu lông */}
              <motion.div
                animate={floatAnimation}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[120px] drop-shadow-[0_0_30px_rgba(163,230,53,0.25)] select-none z-10"
              >
                🏸
              </motion.div>

              {/* Hình học */}
              <motion.div
                animate={{
                  ...floatAnimation,
                  transition: { ...floatAnimation.transition, delay: 0.5 },
                }}
                className="absolute top-16 left-12 w-20 h-20 bg-lime-400/10 rounded-2xl border border-lime-400/30 rotate-12"
              />

              <motion.div
                animate={{
                  ...floatAnimation,
                  transition: { ...floatAnimation.transition, delay: 1.2 },
                }}
                className="absolute bottom-20 right-16 w-16 h-16 bg-teal-400/10 rounded-full border border-teal-400/30"
              />

              <motion.div
                animate={{
                  ...floatAnimation,
                  transition: { ...floatAnimation.transition, delay: 0.8 },
                }}
                className="absolute top-24 right-20 w-24 h-1 bg-gradient-to-r from-lime-400/60 to-transparent rounded-full"
              />

              <motion.div
                animate={{
                  ...floatAnimation,
                  transition: { ...floatAnimation.transition, delay: 1.5 },
                }}
                className="absolute bottom-32 left-20 w-14 h-14 border-2 border-lime-400/15 rounded-xl rotate-45"
              />

              {/* Đường chéo */}
              <div className="absolute top-0 right-0 w-[300px] h-[300px] opacity-10">
                <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_20px,rgba(163,230,53,0.15)_20px,rgba(163,230,53,0.15)_21px)]" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ╔══════════════════════════════════════════════════════╗
                ║  PHẦN TÍNH NĂNG (DẠNG LƯỚI BENTO)                  ║
                ╚══════════════════════════════════════════════════════╝ */}
      <section
        id="utilities"
        className="py-24 scroll-mt-20 border-t border-zinc-700"
      >
        <div className="user-page-container">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <motion.span
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="inline-block px-4 py-1.5 bg-lime-400/10 border border-lime-400/30 text-lime-500 rounded-full text-xs font-bold uppercase tracking-widest mb-4"
            >
              Hệ sinh thái dịch vụ
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight uppercase"
            >
              Tiện Ích Tại <span className="text-lime-500">NH Badminton</span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="mt-4 text-zinc-400 font-medium"
            >
              Đầu tư bài bản từ hệ thống thảm thi đấu, ánh sáng tiêu chuẩn đến
              nền tảng quản lý tự động.
            </motion.p>
          </div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {NH_UTILITIES.map((item, i) => (
              <motion.div
                key={i}
                variants={fadeSlideUp}
                className={`relative overflow-hidden user-card-glass user-card-glass-hover group cursor-default ${item.span ? "md:col-span-2" : ""}`}
              >
                <div className="absolute right-0 top-0 w-56 h-56 bg-lime-400/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-lime-400/10 transition-colors duration-500 pointer-events-none" />
                <div className="relative z-10">
                  <span className="material-symbols-outlined text-[40px] text-lime-500 mb-4 block">
                    {item.icon}
                  </span>
                  <h3 className="text-lg font-extrabold text-white mb-2 tracking-tight">
                    {item.title}
                  </h3>
                  <p className="text-zinc-400 text-sm leading-relaxed max-w-md">
                    {item.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ╔══════════════════════════════════════════════════════╗
                ║  PHẦN ĐẶT SÂN NHANH (SA BÀN)                       ║
                ╚══════════════════════════════════════════════════════╝ */}
      <section
        id="courts"
        className="py-24 scroll-mt-20 border-t border-zinc-700"
      >
        <div className="user-page-container">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <motion.span
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="inline-block px-4 py-1.5 bg-lime-400/10 border border-lime-400/30 text-lime-500 rounded-full text-xs font-bold uppercase tracking-widest mb-4"
            >
              Sơ đồ mặt bằng tổng thể
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight uppercase"
            >
              Sa Bàn <span className="text-lime-500">Cụm Sân Thi Đấu</span>
            </motion.h2>
            <p className="mt-3 text-zinc-400 font-medium text-sm">
              Mô phỏng hướng di chuyển thực tế. Cửa chính bố trí sát Quầy Lễ Tân
              để thuận tiện check-in.
            </p>
            {/* Bộ lọc ngày inline */}
            <div className="mt-6 inline-flex items-center gap-3 bg-zinc-900 border border-zinc-700 shadow-sm rounded-2xl px-5 py-3">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest whitespace-nowrap">
                Ngày thi đấu:
              </label>
              <input
                type="date"
                min={new Date().toLocaleDateString("sv-SE")}
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
                className="user-input py-2 px-3 w-auto"
              />
            </div>
          </div>

          {/* SA BÀN: 2 CỘT - DANH SÁCH SÂN + CHI TIẾT SÂN ĐANG XEM */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto items-start">
            {/* CỘT TRÁI: SƠ ĐỒ / DANH SÁCH SÂN */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="lg:col-span-2 user-card-glass relative overflow-hidden"
            >
              {/* Chú giải */}
              <div className="relative z-20 flex flex-wrap items-center justify-between gap-3 mb-6 bg-zinc-900/85 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-zinc-700/80 text-xs text-zinc-400 shadow-sm">
                <div className="flex items-center gap-2 font-bold text-zinc-300 uppercase tracking-wider">
                  <span className="material-symbols-outlined text-[16px] text-lime-500">
                    map
                  </span>
                  Sơ đồ mặt bằng
                </div>
                <div className="flex items-center gap-5 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-lime-500 block" />{" "}
                    Trống
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-zinc-300 block" />{" "}
                    Đã đặt
                  </span>
                </div>
              </div>

              {/* RENDER COURTS */}
              {isLoadingCourts ? (
                <div className="py-20 text-center text-xs font-bold text-zinc-500 relative z-20">
                  Đang đồng bộ dữ liệu mặt bằng...
                </div>
              ) : publicCourts.length === 0 ? (
                <div className="py-20 text-center bg-zinc-800 rounded-2xl relative z-20">
                  <p className="text-xs font-bold text-zinc-500">
                    Hệ thống chưa có dữ liệu sân.
                  </p>
                </div>
              ) : (
                <div className="relative z-20">
                  <div className="flex items-stretch gap-3 flex-wrap sm:flex-nowrap">
                    {publicCourts.map((court) => {
                      const isSelected = previewCourt?.id === court.id;
                      return (
                        <motion.button
                          key={court.id}
                          type="button"
                          whileHover={{ scale: 1.02, y: -3 }}
                          whileTap={{ scale: 0.98 }}
                          onMouseEnter={() => setPreviewCourt(court)}
                          onClick={() => setPreviewCourt(court)}
                          className={`relative flex-1 basis-[88px] min-w-[88px] h-[220px] rounded-lg flex flex-col items-center justify-between py-4 border-2 transition-all duration-300 overflow-hidden ${
                            isSelected
                              ? "bg-lime-400/10 border-lime-400 shadow-[0_4px_12px_rgba(163,230,53,0.1)]"
                              : "bg-zinc-900 border-zinc-700 hover:border-lime-400/60 hover:bg-zinc-900/60"
                          }`}
                        >
                          {/* Đường biên sân + lưới giữa */}
                          <span
                            className={`pointer-events-none absolute inset-2 rounded border ${isSelected ? "border-lime-400/20" : "border-zinc-700"}`}
                          />
                          <span
                            className={`pointer-events-none absolute left-2 right-2 top-1/2 -translate-y-1/2 border-t-2 border-dashed ${isSelected ? "border-lime-400/30" : "border-zinc-700"}`}
                          />

                          <span
                            className={`relative z-10 text-[9px] font-mono font-bold ${isSelected ? "text-lime-500" : "text-zinc-500"}`}
                          >
                            {court.court_code ||
                              `S${String(court.id).slice(0, 3)}`}
                          </span>

                          <span
                            className={`relative z-10 text-xs font-extrabold tracking-tight rotate-0 px-1 text-center ${isSelected ? "text-white" : "text-zinc-400"}`}
                          >
                            {court.name}
                          </span>

                          <span
                            className={`relative z-10 w-1.5 h-1.5 rounded-full ${isSelected ? "bg-lime-500 animate-pulse" : "bg-lime-400/60"}`}
                          />
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>

            {/* CỘT PHẢI: CHI TIẾT SÂN ĐANG CHỌN */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="user-card-glass p-0 border-lime-400/30 overflow-hidden flex flex-col"
            >
              {previewCourt ? (
                (() => {
                  const imgList =
                    previewCourt.images || previewCourt.image || [];
                  const primaryImg =
                    Array.isArray(imgList) && imgList.length > 0
                      ? imgList[0]
                      : null;
                  const rawUrl = primaryImg
                    ? primaryImg.image_url || primaryImg.url || primaryImg.path
                    : null;
                  const imageUrl =
                    rawUrl && rawUrl.startsWith("/")
                      ? `http://127.0.0.1:8000${rawUrl}`
                      : rawUrl;
                  return (
                    <>
                      <div className="h-40 relative overflow-hidden">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={previewCourt.name}
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-br from-zinc-100 via-zinc-200 to-zinc-300 flex items-center justify-center">
                            {/* Minh họa sân cầu lông cách điệu */}
                            <div className="relative w-24 h-32 rounded-md border-2 border-lime-400/25">
                              <span className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t-2 border-dashed border-lime-400/25" />
                              <span className="absolute inset-2 border border-lime-400/15 rounded-sm" />
                              <span className="material-symbols-outlined absolute inset-0 flex items-center justify-center text-[34px] text-lime-400/40">
                                sports_tennis
                              </span>
                            </div>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/60 to-transparent" />
                        <div className="absolute bottom-3 left-4 right-4">
                          <h3 className="text-xl font-black text-white leading-none mb-1">
                            {previewCourt.name}
                          </h3>
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse" />
                            <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wide">
                              Còn trống hôm nay
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="p-5 flex-grow flex flex-col justify-between gap-4 bg-zinc-900/60">
                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="bg-zinc-900 p-2.5 rounded-lg border border-zinc-700">
                            <span className="block text-[9px] font-bold text-zinc-500 uppercase mb-1">
                              Mặt sân
                            </span>
                            <span className="text-xs text-white font-semibold flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px] text-lime-500">
                                layers
                              </span>
                              {previewCourt.floor_type || "Thảm BWF"}
                            </span>
                          </div>
                          <div className="bg-zinc-900 p-2.5 rounded-lg border border-zinc-700">
                            <span className="block text-[9px] font-bold text-zinc-500 uppercase mb-1">
                              Sức chứa
                            </span>
                            <span className="text-xs text-white font-semibold flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px] text-lime-500">
                                group
                              </span>
                              {previewCourt.capacity || 4} người
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleSelectCourtToBook(previewCourt)}
                          className="user-btn-outline w-full py-3 text-sm"
                        >
                          Xem lịch {"&"} Đặt sân
                          <span className="material-symbols-outlined text-[18px]">
                            arrow_forward
                          </span>
                        </button>
                      </div>
                    </>
                  );
                })()
              ) : (
                <div className="p-10 text-center text-xs text-zinc-500">
                  Chọn 1 sân bên trái để xem chi tiết
                </div>
              )}
            </motion.div>
          </div>

          {/* ĐÁNH GIÁ KHÁCH HÀNG */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-6xl mx-auto mt-12"
          >
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5">
              <div>
                <p className="text-xs font-bold text-lime-500 uppercase tracking-widest mb-1">
                  [ Đánh giá sân ]
                </p>
                <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight uppercase">
                  Khách hàng nói gì
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-amber-500">
                  ★ {reviewSummary.average_rating || 0}/5 ·{" "}
                  {reviewSummary.total_reviews || 0} đánh giá
                </span>
                {publicReviews.length > 3 && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setReviewIndex((i) => Math.max(0, i - 1))}
                      disabled={reviewIndex === 0}
                      className="w-8 h-8 rounded-full border border-zinc-600 flex items-center justify-center text-zinc-500 hover:border-lime-400 hover:text-lime-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      ‹
                    </button>
                    <button
                      onClick={() =>
                        setReviewIndex((i) =>
                          Math.min(publicReviews.length - 3, i + 1),
                        )
                      }
                      disabled={reviewIndex >= publicReviews.length - 3}
                      className="w-8 h-8 rounded-full border border-zinc-600 flex items-center justify-center text-zinc-500 hover:border-lime-400 hover:text-lime-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      ›
                    </button>
                  </div>
                )}
              </div>
            </div>

            {publicReviews.length === 0 ? (
              <div className="rounded-3xl border border-zinc-700 bg-zinc-900 p-8 text-center text-sm font-semibold text-zinc-500">
                Chưa có đánh giá sân.
              </div>
            ) : (
              <div className="overflow-hidden">
                <motion.div
                  className="flex gap-4"
                  animate={{
                    x: `calc(-${reviewIndex * (100 / 3)}% - ${reviewIndex * (16 / 3)}px)`,
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                  {publicReviews.map((review) => (
                    <div
                      key={review.id}
                      className="user-card-glass p-5 flex-shrink-0 w-[calc(33.333%-11px)]"
                    >
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="text-amber-400 text-sm">
                          {"★".repeat(review.rating)}
                          <span className="text-zinc-200">
                            {"★".repeat(5 - review.rating)}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-lime-500 bg-lime-400/10 px-2 py-1 rounded">
                          {review.court?.name || "Sân"}
                        </span>
                      </div>
                      <p className="text-sm leading-6 text-zinc-300 line-clamp-4">
                        {review.comment}
                      </p>
                      <div className="mt-4 flex items-center gap-2">
                        {review.user?.avatar_url ? (
                          <img
                            src={review.user.avatar_url}
                            alt={review.user?.full_name}
                            className="w-7 h-7 rounded-full object-cover border border-zinc-700"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-lime-400/10 text-lime-500 flex items-center justify-center text-[10px] font-bold border border-zinc-700">
                            {(review.user?.full_name || "KH")
                              .trim()
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                        )}
                        <p className="text-xs font-bold text-white">
                          {review.user?.full_name || "Khách hàng"}
                        </p>
                      </div>
                      {review.staff_reply && (
                        <div className="mt-3 rounded-xl bg-lime-400/10 p-3 text-xs leading-5 text-lime-300 border border-lime-400/15">
                          <strong>NH Badminton:</strong> {review.staff_reply}
                        </div>
                      )}
                    </div>
                  ))}
                </motion.div>
              </div>
            )}

            {/* Chấm chuyển trang */}
            {publicReviews.length > 3 && (
              <div className="flex justify-center gap-1.5 mt-4">
                {Array.from({ length: publicReviews.length - 2 }).map(
                  (_, i) => (
                    <button
                      key={i}
                      onClick={() => setReviewIndex(i)}
                      className={`h-1.5 rounded-full transition-all ${reviewIndex === i ? "w-5 bg-lime-500" : "w-1.5 bg-zinc-300"}`}
                    />
                  ),
                )}
              </div>
            )}
          </motion.div>

          {/* BẢNG GIÁ */}
          {(() => {
            const fmtPrice = (p) => Number(p).toLocaleString("vi-VN");
            const FEATURES = ["Thảm BWF tiêu chuẩn", "Ánh sáng tiêu chuẩn", "Miễn phí giữ xe"];
            const DAY_GROUPS = [
              { key: "weekday", label: "Ngày trong tuần", sub: "Thứ 2 – Thứ 6", icon: "calendar_today" },
              { key: "weekend", label: "Cuối tuần",        sub: "Thứ 7 & Chủ nhật", icon: "weekend" },
            ];
            return (
              <div id="pricing" className="max-w-5xl mx-auto mt-12 scroll-mt-24">
                <div className="text-center mb-8">
                  <p className="text-xs font-bold text-lime-500 uppercase tracking-widest mb-1">
                    [ Bảng Niêm Yết Chi Phí ]
                  </p>
                  <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight uppercase">
                    Áp dụng chung tất cả sân
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    Không phụ phí, không phí ẩn. Giá thuê tính theo block tối thiểu 60 phút.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {DAY_GROUPS.map(({ key, label, sub, icon }, gi) => {
                    const slots = pricings[key] || [];
                    const maxPrice = slots.length ? Math.max(...slots.map((s) => s.price)) : 0;
                    return (
                      <motion.div
                        key={key}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: gi * 0.1 }}
                        className="user-card-glass p-6 flex flex-col gap-4"
                      >
                        {/* Header của card lớn */}
                        <div className="flex items-center gap-3 pb-4 border-b border-zinc-800">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-800">
                            <span className="material-symbols-outlined text-[22px] text-lime-400">{icon}</span>
                          </div>
                          <div>
                            <h4 className="text-sm font-extrabold text-white">{label}</h4>
                            <p className="text-[11px] text-zinc-500">{sub}</p>
                          </div>
                          {key === "weekend" && (
                            <span className="ml-auto text-[10px] font-extrabold uppercase bg-lime-500/10 text-lime-400 border border-lime-500/30 px-2.5 py-1 rounded-full">
                              Cao điểm
                            </span>
                          )}
                        </div>

                        {/* Ô nhỏ mỗi khung giờ */}
                        {slots.length === 0 ? (
                          <p className="text-xs text-zinc-600 text-center py-4">Chưa có giá niêm yết</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {slots.map((slot, si) => {
                              const isPeak = slots.length > 1 && si === slots.length - 1;
                              return (
                                <div
                                  key={si}
                                  className={`rounded-xl p-4 border ${isPeak ? "border-lime-500/40 bg-lime-500/5" : "border-zinc-800 bg-zinc-900/60"}`}
                                >
                                  <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isPeak ? "text-lime-500" : "text-zinc-500"}`}>
                                    {isPeak ? "Giờ cao điểm" : "Giờ thường"}
                                  </p>
                                  <p className="text-xs font-mono text-zinc-400 mb-3">
                                    {slot.start_time} – {slot.end_time}
                                  </p>
                                  <p className={`text-2xl font-black ${isPeak ? "text-lime-400" : "text-white"}`}>
                                    {fmtPrice(slot.price)}
                                    <span className="text-sm font-semibold text-zinc-500"> đ/h</span>
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Tiện ích đi kèm */}
                        <ul className="space-y-1.5 pt-1 border-t border-zinc-800">
                          {FEATURES.map((f) => (
                            <li key={f} className="flex items-center gap-2 text-xs text-zinc-400">
                              <span className="material-symbols-outlined text-lime-500 text-[16px]">check</span>
                              {f}
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* ╔══════════════════════════════════════════════════════╗
                ║  PHẦN QUY TRÌNH ĐẶT SÂN (STEPS)                    ║
                ╚══════════════════════════════════════════════════════╝ */}
      <section
        id="steps"
        className="py-24 scroll-mt-20 border-t border-zinc-700 relative"
      >
        <div className="user-page-container relative z-10">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="inline-block px-4 py-1.5 bg-lime-400/10 border border-lime-400/30 text-lime-500 rounded-full text-xs font-bold uppercase tracking-widest mb-4">
              Quy trình vận hành
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white uppercase">
              4 Bước Đặt Sân <span className="text-lime-500">Siêu Tốc</span>
            </h2>
            <p className="mt-3 text-zinc-400 font-medium">
              Phân luồng thông minh cho cả khách lẻ và khách cố định.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            <div className="hidden lg:block absolute top-1/2 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-lime-400/20 to-transparent -translate-y-6 z-0" />
            {STEPS.map((step, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="user-card-glass user-card-glass-hover p-7 relative z-10"
              >
                <div className="w-12 h-12 bg-lime-400/10 border border-lime-400/30 rounded-2xl flex items-center justify-center text-lime-500 font-black text-lg mb-5">
                  {step.number}
                </div>
                <h3 className="text-lg font-extrabold text-white mb-2 tracking-tight">
                  {step.title}
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {step.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ╔══════════════════════════════════════════════════════╗
                ║  SƠ ĐỒ MẶT BẰNG TỔNG THỂ                             ║
                ╚══════════════════════════════════════════════════════╝ */}
      <section
        id="floorplan"
        className="py-24 scroll-mt-20 border-t border-zinc-700"
      >
        <div className="user-page-container">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="inline-block px-4 py-1.5 bg-lime-400/10 border border-lime-400/30 text-lime-500 rounded-full text-xs font-bold uppercase tracking-widest mb-4">
              Toàn cảnh trung tâm
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white uppercase">
              Sơ Đồ <span className="text-lime-500">Mặt Bằng</span>
            </h2>
            <p className="mt-3 text-zinc-400 font-medium">
              Bố trí tổng thể sân thi đấu, khu vực thay đồ, spa và tiện ích đi
              kèm.
            </p>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-5xl mx-auto rounded-3xl border border-zinc-700 bg-zinc-900 shadow-sm overflow-hidden"
          >
            <img
              src="/mapsan.png"
              alt="Sơ đồ tổng thể trung tâm cầu lông NH Badminton"
              className="w-full h-auto"
            />
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
