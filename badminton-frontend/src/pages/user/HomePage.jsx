import { Fragment, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { courtService } from '../../services/user/courtService';
import { reviewService } from '../../services/user/reviewService';

/* ═══════════════════════════════════════════════════════════
   DỮ LIỆU TĨNH - GIỮ NGUYÊN TỪ BẢN GỐC
   ═══════════════════════════════════════════════════════════ */
const NH_UTILITIES = [
    { icon: '🔒', title: "Giữ chỗ tự động 100%", desc: "Hệ thống xử lý thời gian thực. Sân của bạn được khóa lịch ngay lập tức khi hoàn tất thanh toán cọc." },
    { icon: '🛡️', title: "Thảm Tiêu Chuẩn BWF", desc: "100% mặt sân sử dụng thảm chất lượng cao, độ bám tốt, hỗ trợ tối đa các pha di chuyển cường độ cao." },
    { icon: '⚡', title: "Thanh toán QR siêu tốc", desc: "Tích hợp cổng thanh toán trực tuyến qua mã QR tự động. Tiện lợi, an toàn và minh bạch tuyệt đối." },
    { icon: '🏪', title: "Tiện ích Pro-shop trọn gói", desc: "Cung cấp đầy đủ nước giải khát, cho thuê vợt, đan lưới kỹ thuật số ngay tại quầy lễ tân trung tâm." }
];

const STEPS = [
    { number: "01", title: "Chọn vị trí sân", desc: "Quan sát sa bàn trực quan của NH Badminton và click vào vị trí sân thi đấu mà bạn muốn chơi." },
    { number: "02", title: "Chọn khung giờ", desc: "Hệ thống hiển thị lưới giờ trống thực tế. Bạn có thể chọn đặt lẻ 1 ngày hoặc chọn đặt cố định theo tháng." },
    { number: "03", title: "Xác nhận & Cọc", desc: "Phân luồng thanh toán thông minh giữa khách chơi lẻ và khách đặt lịch cố định dài hạn." },
    { number: "04", title: "Check-in vào sân", desc: "Nhận mã đặt sân. Đến trung tâm, đưa mã cho lễ tân để nhận thảm và bắt đầu trận đấu!" }
];

/* ═══════════════════════════════════════════════════════════
   FRAMER MOTION VARIANTS
   ═══════════════════════════════════════════════════════════ */
const staggerContainer = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.2 } }
};
const fadeSlideUp = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } }
};
const floatAnimation = {
    y: [0, -12, 0],
    rotate: [0, 3, -3, 0],
    transition: { duration: 5, repeat: Infinity, ease: 'easeInOut' }
};
const floatSlow = {
    y: [0, -18, 0],
    transition: { duration: 7, repeat: Infinity, ease: 'easeInOut' }
};

/* ═══════════════════════════════════════════════════════════
   HOMEPAGE COMPONENT
   ═══════════════════════════════════════════════════════════ */
const HomePage = () => {
    const navigate = useNavigate();
    // ─── STATES GIỮ NGUYÊN ───
    const [publicCourts, setPublicCourts] = useState([]);
    const [publicReviews, setPublicReviews] = useState([]);
    const [reviewSummary, setReviewSummary] = useState({ average_rating: 0, total_reviews: 0 });
    const [isLoadingCourts, setIsLoadingCourts] = useState(false);
    const [searchDate, setSearchDate] = useState(new Date().toLocaleDateString('sv-SE'));

    // ─── FETCH COURTS TỪ API ───
    useEffect(() => {
        const fetchCourts = async () => {
            setIsLoadingCourts(true);
            try {
                const response = await courtService.getPublicCourts();
                const courtsData = response.data?.data || response.data || [];
                setPublicCourts(Array.isArray(courtsData) ? courtsData : []);
            } catch (error) {
                console.error('Lỗi tải danh sách sân trang chủ:', error);
            } finally {
                setIsLoadingCourts(false);
            }
        };
        fetchCourts();
    }, []);

    useEffect(() => {
        const fetchReviews = async () => {
            try {
                const response = await reviewService.getPublicReviews({ target_type: 'court', limit: 6 });
                const payload = response.data?.data || {};
                setPublicReviews(payload.reviews || []);
                setReviewSummary(payload.summary || { average_rating: 0, total_reviews: 0 });
            } catch (error) {
                console.error('Lỗi tải đánh giá trang chủ:', error);
            }
        };

        fetchReviews();
    }, []);

    // ─── ĐIỀU HƯỚNG CHỌN SÂN ───
    const handleSelectCourtToBook = (court) => {
        if (!searchDate) { alert('Vui lòng chọn ngày thi đấu trước!'); return; }
        navigate(`/booking-page?courtId=${court.id}&date=${searchDate}`);
    };

    return (
        <div className="bg-zinc-950 font-sans text-zinc-300 selection:bg-lime-500 selection:text-zinc-950 overflow-x-hidden">

            {/* ╔══════════════════════════════════════════════════════╗
                ║  HERO SECTION - DARK SPORTY WITH FLOATING VISUALS  ║
                ╚══════════════════════════════════════════════════════╝ */}
            <section className="relative min-h-[92vh] flex items-center pt-24 pb-20 overflow-hidden">
                {/* ── BG DECORATIONS ── */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-20 left-10 w-72 h-72 bg-lime-500/5 rounded-full blur-3xl" />
                    <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
                    <div className="absolute top-1/3 right-1/4 w-px h-40 bg-gradient-to-b from-lime-500/20 to-transparent rotate-12" />
                    <div className="absolute bottom-1/4 left-1/3 w-px h-32 bg-gradient-to-b from-lime-500/10 to-transparent -rotate-12" />
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-10">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

                        {/* ── LEFT: TEXT CONTENT (Stagger Fade-in) ── */}
                        <motion.div
                            variants={staggerContainer}
                            initial="hidden"
                            animate="visible"
                            className="text-center lg:text-left"
                        >
                            {/* Badge */}
                            <motion.div variants={fadeSlideUp}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-lime-500/10 border border-lime-500/20 text-lime-400 font-bold text-xs uppercase tracking-widest mb-8">
                                <span className="w-2 h-2 rounded-full bg-lime-400 animate-pulse" />
                                Trung tâm Cầu lông Tiêu chuẩn BWF
                            </motion.div>

                            {/* Slogan */}
                            <motion.h1 variants={fadeSlideUp}
                                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.05] uppercase">
                                Bứt Phá
                                <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-lime-400 via-emerald-400 to-lime-300">
                                    Giới Hạn
                                </span>
                                <br />
                                <span className="text-zinc-400 text-3xl sm:text-4xl md:text-5xl block mt-2">
                                    Làm Chủ Sân Đấu
                                </span>
                            </motion.h1>

                            {/* Sub text */}
                            <motion.p variants={fadeSlideUp}
                                className="mt-6 text-base md:text-lg text-zinc-500 max-w-lg mx-auto lg:mx-0 leading-relaxed">
                                Trải nghiệm hệ thống mặt sân thảm cao cấp chuẩn quốc tế. Chủ động kiểm tra giờ trống và đặt lịch tự động, không cần chờ đợi.
                            </motion.p>

                            {/* CTA Buttons */}
                            <motion.div variants={fadeSlideUp} className="mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                                <motion.a href="/#courts"
                                    whileHover={{ scale: 1.04, boxShadow: '0 0 30px rgba(163,230,53,0.45)' }}
                                    whileTap={{ scale: 0.97 }}
                                    className="px-8 py-4 bg-lime-500 hover:bg-lime-400 text-zinc-950 font-extrabold rounded-2xl shadow-lg shadow-lime-500/25 text-base uppercase tracking-wider text-center transition-colors duration-300 animate-neon-pulse">
                                    🏸 Đặt Sân Ngay
                                </motion.a>
                                <motion.a href="/#steps"
                                    whileHover={{ scale: 1.04 }}
                                    whileTap={{ scale: 0.97 }}
                                    className="px-8 py-4 border border-zinc-700 hover:border-lime-500/40 text-zinc-300 hover:text-lime-400 font-bold rounded-2xl text-base text-center transition-all duration-300">
                                    Tìm hiểu quy trình →
                                </motion.a>
                            </motion.div>

                            {/* Stats mini */}
                            <motion.div variants={fadeSlideUp}
                                className="mt-12 flex items-center gap-8 justify-center lg:justify-start">
                                {[
                                    { val: '5+', label: 'Sân thi đấu' },
                                    { val: '18h', label: 'Hoạt động/ngày' },
                                    { val: '100%', label: 'Thảm BWF' },
                                ].map((s) => (
                                    <div key={s.label} className="text-center">
                                        <p className="text-2xl font-black text-lime-400">{s.val}</p>
                                        <p className="text-[11px] text-zinc-500 font-semibold uppercase tracking-wider mt-0.5">{s.label}</p>
                                    </div>
                                ))}
                            </motion.div>
                        </motion.div>

                        {/* ── RIGHT: FLOATING ABSTRACT VISUALS ── */}
                        <div className="relative h-[420px] lg:h-[520px] hidden lg:block">
                            {/* Large circle */}
                            <motion.div animate={floatSlow}
                                className="absolute top-8 right-8 w-72 h-72 rounded-full border-2 border-lime-500/15 bg-gradient-to-br from-lime-500/5 to-transparent" />

                            {/* Shuttlecock visual */}
                            <motion.div animate={floatAnimation}
                                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[120px] drop-shadow-[0_0_30px_rgba(163,230,53,0.3)] select-none z-10">
                                🏸
                            </motion.div>

                            {/* Geometric shapes */}
                            <motion.div animate={{ ...floatAnimation, transition: { ...floatAnimation.transition, delay: 0.5 } }}
                                className="absolute top-16 left-12 w-20 h-20 bg-lime-500/10 rounded-2xl border border-lime-500/20 backdrop-blur-sm rotate-12" />

                            <motion.div animate={{ ...floatAnimation, transition: { ...floatAnimation.transition, delay: 1.2 } }}
                                className="absolute bottom-20 right-16 w-16 h-16 bg-emerald-500/10 rounded-full border border-emerald-500/20 backdrop-blur-sm" />

                            <motion.div animate={{ ...floatAnimation, transition: { ...floatAnimation.transition, delay: 0.8 } }}
                                className="absolute top-24 right-20 w-24 h-1 bg-gradient-to-r from-lime-400/60 to-transparent rounded-full" />

                            <motion.div animate={{ ...floatAnimation, transition: { ...floatAnimation.transition, delay: 1.5 } }}
                                className="absolute bottom-32 left-20 w-14 h-14 border-2 border-lime-500/15 rounded-xl rotate-45" />

                            {/* Diagonal slash lines */}
                            <div className="absolute top-0 right-0 w-[300px] h-[300px] opacity-10">
                                <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_20px,rgba(163,230,53,0.15)_20px,rgba(163,230,53,0.15)_21px)]" />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ╔══════════════════════════════════════════════════════╗
                ║  FEATURES / UTILITIES SECTION                        ║
                ╚══════════════════════════════════════════════════════╝ */}
            <section id="utilities" className="py-24 scroll-mt-20 border-t border-zinc-800/40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-2xl mx-auto mb-16">
                        <motion.span initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
                            className="inline-block px-4 py-1.5 bg-lime-500/10 border border-lime-500/20 text-lime-400 rounded-full text-xs font-bold uppercase tracking-widest mb-4">
                            Hệ sinh thái dịch vụ
                        </motion.span>
                        <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                            className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight uppercase">
                            Tiện Ích Tại <span className="text-lime-400">NH Badminton</span>
                        </motion.h2>
                        <motion.p initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
                            className="mt-4 text-zinc-500 font-medium">
                            Đầu tư bài bản từ hệ thống thảm thi đấu, ánh sáng tiêu chuẩn đến nền tảng quản lý tự động.
                        </motion.p>
                    </div>

                    <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {NH_UTILITIES.map((item, i) => (
                            <motion.div key={i} variants={fadeSlideUp}
                                whileHover={{ scale: 1.04, boxShadow: '0 0 30px rgba(163,230,53,0.12)' }}
                                className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-7 group hover:border-lime-500/30 transition-all duration-300 cursor-default">
                                <div className="w-14 h-14 bg-zinc-800 group-hover:bg-lime-500/15 rounded-2xl flex items-center justify-center mb-5 transition-colors duration-300 text-2xl">
                                    {item.icon}
                                </div>
                                <h3 className="text-lg font-extrabold text-white mb-2 tracking-tight">{item.title}</h3>
                                <p className="text-zinc-500 text-sm leading-relaxed">{item.desc}</p>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* ╔══════════════════════════════════════════════════════╗
                ║  COURT SHOWCASE GRID                                 ║
                ╚══════════════════════════════════════════════════════╝ */}
            <section id="courts" className="py-24 scroll-mt-20 border-t border-zinc-800/40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-3xl mx-auto mb-12">
                        <motion.span initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
                            className="inline-block px-4 py-1.5 bg-lime-500/10 border border-lime-500/20 text-lime-400 rounded-full text-xs font-bold uppercase tracking-widest mb-4">
                            Sơ đồ mặt bằng tổng thể
                        </motion.span>
                        <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                            className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight uppercase">
                            Sa Bàn <span className="text-lime-400">Cụm Sân Thi Đấu</span>
                        </motion.h2>
                        <p className="mt-3 text-zinc-500 font-medium text-sm">
                            Mô phỏng hướng di chuyển thực tế. Cửa chính bố trí sát Quầy Lễ Tân để thuận tiện check-in.
                        </p>
                        {/* Bộ lọc ngày inline */}
                        <div className="mt-6 inline-flex items-center gap-3 bg-zinc-900/80 border border-zinc-800 rounded-2xl px-5 py-3">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest whitespace-nowrap">Ngày thi đấu:</label>
                            <input type="date" min={new Date().toLocaleDateString('sv-SE')} value={searchDate} onChange={e => setSearchDate(e.target.value)}
                                className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl font-semibold text-white text-sm focus:outline-none focus:border-lime-400 focus:shadow-[0_0_12px_rgba(163,230,53,0.2)] transition-all" />
                        </div>
                    </div>

                    {/* SA BÀN CHÍNH */}
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                        className="bg-zinc-900/60 p-6 sm:p-10 rounded-3xl border border-zinc-800 relative overflow-hidden max-w-6xl mx-auto">

                        {/* Chú giải */}
                        <div className="relative z-20 flex flex-wrap items-center justify-between gap-4 mb-8 bg-zinc-800/50 backdrop-blur-md px-5 py-3 rounded-2xl border border-zinc-700/50 text-xs text-zinc-400">
                            <div className="flex items-center gap-2 font-bold text-amber-400 uppercase tracking-wider">
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                                <span>🚪 Lối vào {'&'} Cửa chính — hướng Tây Nam</span>
                            </div>
                            <div className="flex items-center gap-6 font-semibold">
                                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-lime-500 block" /> Khả dụng</span>
                                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-zinc-600 block" /> Bảo trì</span>
                            </div>
                        </div>

                        {/* RENDER COURTS */}
                        {isLoadingCourts ? (
                            <div className="py-24 text-center text-xs font-bold text-zinc-500 relative z-20">Đang đồng bộ dữ liệu mặt bằng...</div>
                        ) : publicCourts.length === 0 ? (
                            <div className="py-24 text-center bg-zinc-800/30 rounded-2xl relative z-20">
                                <p className="text-xs font-bold text-zinc-500">Hệ thống chưa có dữ liệu sân.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-20">
                                {publicCourts.map((court, index) => {
                                    const imgList = court.images || court.image || [];
                                    const primaryImg = Array.isArray(imgList) && imgList.length > 0 ? imgList[0] : null;
                                    const rawUrl = primaryImg ? (primaryImg.image_url || primaryImg.url || primaryImg.path) : null;
                                    const imageUrl = rawUrl && rawUrl.startsWith('/') ? `http://127.0.0.1:8000${rawUrl}` : rawUrl;
                                    const isCenterHub = publicCourts.length === 5 && index === 4;

                                    return (
                                        <Fragment key={court.id}>
                                            {isCenterHub && (
                                                <div className="hidden lg:flex flex-col justify-between border border-zinc-700/40 rounded-2xl p-4 text-center bg-zinc-800/30 overflow-hidden relative">
                                                    <div className="pb-3 border-b border-zinc-700/30">
                                                        <span className="text-xl block mb-1">🛎️</span>
                                                        <h5 className="font-extrabold text-white text-xs uppercase tracking-wider">Quầy Lễ Tân</h5>
                                                        <p className="text-[9px] text-lime-400 mt-0.5 font-medium">Khu vực Check-in</p>
                                                    </div>
                                                    <div className="pt-2 my-auto">
                                                        <div className="flex justify-center gap-2 text-base mb-1.5 opacity-50">🪑 🛋️ 🥤</div>
                                                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Sảnh Nghỉ Ngơi</span>
                                                    </div>
                                                    <div className="absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r from-lime-500/30 to-transparent" />
                                                </div>
                                            )}
                                            <motion.div
                                                whileHover={{ scale: 1.03, y: -4 }}
                                                whileTap={{ scale: 0.98 }}
                                                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                                                onClick={() => handleSelectCourtToBook(court)}
                                                className={`bg-gradient-to-b from-zinc-800/70 to-zinc-900/90 backdrop-blur-sm border-2 border-lime-500/15 rounded-2xl p-5 relative flex flex-col justify-between h-[300px] cursor-pointer group hover:border-lime-400/60 hover:shadow-[0_0_35px_rgba(163,230,53,0.15)] transition-all duration-300 overflow-hidden ${isCenterHub ? 'lg:col-start-3' : ''}`}>
                                                {/* Decorative court lines */}
                                                <div className="absolute inset-x-4 top-12 bottom-12 border border-dashed border-white/[0.04] rounded-lg pointer-events-none group-hover:border-lime-500/10 transition-colors duration-500" />
                                                <div className="absolute left-1/2 top-12 bottom-12 w-px bg-white/[0.03] pointer-events-none group-hover:bg-lime-500/10 transition-colors duration-500" />
                                                {/* Image */}
                                                {imageUrl ? (
                                                    <>
                                                        <img src={imageUrl} alt={court.name || 'Sân'} className="absolute inset-0 w-full h-full object-cover opacity-10 group-hover:opacity-20 transition-opacity duration-500" />
                                                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-900/80 to-zinc-900/40" />
                                                    </>
                                                ) : (
                                                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-800/50 to-zinc-900" />
                                                )}
                                                {/* Header */}
                                                <div className="relative z-10 flex items-center justify-between pb-3 border-b border-zinc-700/40">
                                                    <div>
                                                        <span className="text-[10px] font-mono font-bold text-lime-500/70 block mb-0.5">{court.court_code || `COURT-${String(court.id).padStart(2, '0')}`}</span>
                                                        <h4 className="text-lg font-extrabold text-white tracking-tight group-hover:text-lime-300 transition-colors duration-300">{court.name}</h4>
                                                    </div>
                                                    <span className="px-2.5 py-1 bg-lime-500/15 border border-lime-500/30 text-lime-400 font-extrabold text-[10px] rounded-lg uppercase animate-pulse shadow-[0_0_10px_rgba(163,230,53,0.15)]">Còn trống</span>
                                                </div>
                                                {/* Specs */}
                                                <div className="relative z-10 my-auto space-y-2 text-xs text-zinc-400 bg-black/20 p-3.5 rounded-xl border border-zinc-700/30 pointer-events-none">
                                                    <p className="flex justify-between items-center"><span className="text-zinc-500 text-[11px]">Bề mặt</span><strong className="text-lime-400 font-mono text-[11px] bg-lime-500/10 px-2 py-0.5 rounded">{court.floor_type || 'Thảm BWF'}</strong></p>
                                                    <p className="flex justify-between items-center"><span className="text-zinc-500 text-[11px]">Sức chứa</span><span className="text-[11px] font-semibold">{court.capacity || 4} Vợt thủ</span></p>
                                                    {court.location_note && <p className="text-[10px] text-amber-400/70 italic truncate pt-1 text-right">📍 {court.location_note}</p>}
                                                </div>
                                                {/* CTA footer */}
                                                <div className="relative z-10 pt-3 border-t border-zinc-700/30 text-center">
                                                    <span className="text-[11px] font-bold text-lime-400/70 group-hover:text-lime-400 transition-colors inline-flex items-center gap-1.5">
                                                        Xem lịch trống {'&'} Đặt sân <span className="group-hover:translate-x-1.5 transition-transform duration-300">→</span>
                                                    </span>
                                                </div>
                                            </motion.div>
                                        </Fragment>
                                    );
                                })}
                            </div>
                        )}
                    </motion.div>

                    {/* ĐÁNH GIÁ KHÁCH HÀNG */}
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-6xl mx-auto mt-12">
                        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5">
                            <div>
                                <p className="text-xs font-bold text-lime-400 uppercase tracking-widest mb-1">[ Đánh giá sân ]</p>
                                <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight uppercase">Khách hàng nói gì</h3>
                            </div>
                            <div className="text-sm font-bold text-amber-300">
                                ★ {reviewSummary.average_rating || 0}/5 · {reviewSummary.total_reviews || 0} đánh giá
                            </div>
                        </div>

                        {publicReviews.length === 0 ? (
                            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-8 text-center text-sm font-semibold text-zinc-500">
                                Chưa có đánh giá sân.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {publicReviews.map((review) => (
                                    <div key={review.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
                                        <div className="flex items-center justify-between gap-3 mb-3">
                                            <div className="text-amber-300 text-sm">
                                                {'★'.repeat(review.rating)}<span className="text-zinc-700">{'★'.repeat(5 - review.rating)}</span>
                                            </div>
                                            <span className="text-[10px] font-bold text-lime-400 bg-lime-500/10 px-2 py-1 rounded">
                                                {review.court?.name || 'Sân'}
                                            </span>
                                        </div>
                                        <p className="text-sm leading-6 text-zinc-300 line-clamp-4">{review.comment}</p>
                                        <p className="mt-4 text-xs font-bold text-white">{review.user?.full_name || 'Khách hàng'}</p>
                                        {review.staff_reply && (
                                            <div className="mt-3 rounded-xl bg-lime-500/10 p-3 text-xs leading-5 text-lime-200">
                                                <strong>NH Badminton:</strong> {review.staff_reply}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>

                    {/* BẢNG GIÁ */}
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-3xl mx-auto mt-12">
                        <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-6 sm:p-10">
                            <div className="text-center pb-6 border-b border-zinc-800">
                                <p className="text-xs font-bold text-lime-400 uppercase tracking-widest mb-1">[ Bảng Niêm Yết Chi Phí ]</p>
                                <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight uppercase">Áp dụng chung tất cả sân</h3>
                                <p className="text-xs text-zinc-500 mt-1">Giá thuê tính theo block tối thiểu 60 phút.</p>
                            </div>
                            <div className="divide-y divide-zinc-800 my-2">
                                <div className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 rounded-xl">
                                    <div className="flex items-start gap-3">
                                        <span className="text-lg mt-0.5">☀️</span>
                                        <div>
                                            <div className="flex items-center gap-2 font-bold text-white text-base"><span>Khung Giờ Thường</span><span className="text-[10px] font-semibold bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">05:00 - 17:00</span></div>
                                            <p className="text-xs text-zinc-500 mt-0.5">Thích hợp tập luyện tự do, sinh viên.</p>
                                        </div>
                                    </div>
                                    <span className="text-2xl font-black text-white tracking-tight shrink-0">100.000 <span className="text-xs font-semibold text-zinc-500">VNĐ/h</span></span>
                                </div>
                                <div className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-lime-500/5 px-3 rounded-xl border border-lime-500/10">
                                    <div className="flex items-start gap-3">
                                        <span className="text-lg mt-0.5 animate-pulse">🔥</span>
                                        <div>
                                            <div className="flex items-center gap-2 font-bold text-white text-base"><span>Khung Giờ Vàng</span><span className="text-[10px] font-bold bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">17:00 - 23:00</span></div>
                                            <p className="text-xs text-lime-400/70 mt-0.5">Giờ cao điểm thi đấu phong trào.</p>
                                        </div>
                                    </div>
                                    <span className="text-2xl font-black text-lime-400 tracking-tight shrink-0">120.000 <span className="text-xs font-semibold text-zinc-500">VNĐ/h</span></span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ╔══════════════════════════════════════════════════════╗
                ║  STEPS SECTION                                       ║
                ╚══════════════════════════════════════════════════════╝ */}
            <section id="steps" className="py-24 scroll-mt-20 border-t border-zinc-800/40 relative">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="text-center max-w-2xl mx-auto mb-16">
                        <span className="inline-block px-4 py-1.5 bg-lime-500/10 border border-lime-500/20 text-lime-400 rounded-full text-xs font-bold uppercase tracking-widest mb-4">Quy trình vận hành</span>
                        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white uppercase">4 Bước Đặt Sân <span className="text-lime-400">Siêu Tốc</span></h2>
                        <p className="mt-3 text-zinc-500 font-medium">Phân luồng thông minh cho cả khách lẻ và khách cố định.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
                        <div className="hidden lg:block absolute top-1/2 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-lime-500/20 to-transparent -translate-y-6 z-0" />
                        {STEPS.map((step, idx) => (
                            <motion.div key={idx} initial={{ opacity: 0, y: 25 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: idx * 0.1 }}
                                className="bg-zinc-900/60 border border-zinc-800 p-7 rounded-2xl hover:border-lime-500/30 hover:shadow-[0_0_20px_rgba(163,230,53,0.08)] transition-all relative z-10">
                                <div className="w-12 h-12 bg-lime-500/10 border border-lime-500/25 rounded-2xl flex items-center justify-center text-lime-400 font-black text-lg mb-5">{step.number}</div>
                                <h3 className="text-lg font-extrabold text-white mb-2 tracking-tight">{step.title}</h3>
                                <p className="text-xs text-zinc-500 leading-relaxed">{step.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ╔══════════════════════════════════════════════════════╗
                ║  CONTACT SECTION                                     ║
                ╚══════════════════════════════════════════════════════╝ */}
            <section id="contact" className="py-24 scroll-mt-20 border-t border-zinc-800/40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-2xl mx-auto mb-16">
                        <span className="inline-block px-4 py-1.5 bg-lime-500/10 border border-lime-500/20 text-lime-400 rounded-full text-xs font-bold uppercase tracking-widest mb-4">Hỗ trợ 24/7</span>
                        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white uppercase">Liên Hệ <span className="text-lime-400">NH Badminton</span></h2>
                        <p className="mt-3 text-zinc-500 font-medium">Xuất hóa đơn, hợp tác giải đấu, hoặc bất kỳ thắc mắc nào — để lại lời nhắn cho chúng tôi.</p>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-stretch">
                        <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                            className="lg:col-span-2 bg-zinc-900/60 border border-zinc-800 p-8 rounded-3xl flex flex-col justify-between">
                            <div>
                                <h3 className="text-xl font-extrabold text-white mb-6 tracking-tight uppercase">Thông tin trung tâm</h3>
                                <div className="space-y-5 text-sm text-zinc-400">
                                    <div><p className="font-bold text-zinc-500 text-xs uppercase tracking-wider mb-1">Địa chỉ</p><p>1000 ấp 3 xã phước kiển huyện nhà bè </p></div>
                                    <div><p className="font-bold text-zinc-500 text-xs uppercase tracking-wider mb-1">Hotline</p><p className="font-semibold text-lime-400 text-base">0394.421.192</p></div>
                                    <div><p className="font-bold text-zinc-500 text-xs uppercase tracking-wider mb-1">Email</p><p>ngochieu21192@gmail.com</p></div>
                                </div>
                            </div>
                        </motion.div>
                        <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                            className="lg:col-span-3 bg-zinc-900/60 border border-zinc-800 p-8 rounded-3xl">
                            <form onSubmit={(e) => e.preventDefault()} className="space-y-5">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <div><label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Họ và tên *</label><input type="text" required placeholder="Nhập tên" className="w-full px-4 py-3 bg-zinc-800/80 border border-zinc-700 rounded-2xl text-white text-sm font-medium focus:outline-none focus:border-lime-400 focus:shadow-[0_0_12px_rgba(163,230,53,0.2)] transition-all" /></div>
                                    <div><label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Số điện thoại *</label><input type="tel" required placeholder="09xx xxx xxx" className="w-full px-4 py-3 bg-zinc-800/80 border border-zinc-700 rounded-2xl text-white text-sm font-medium focus:outline-none focus:border-lime-400 focus:shadow-[0_0_12px_rgba(163,230,53,0.2)] transition-all" /></div>
                                </div>
                                <div><label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Nội dung *</label><textarea rows="4" required placeholder="Chi tiết..." className="w-full px-4 py-3 bg-zinc-800/80 border border-zinc-700 rounded-2xl text-white text-sm font-medium resize-none focus:outline-none focus:border-lime-400 focus:shadow-[0_0_12px_rgba(163,230,53,0.2)] transition-all" /></div>
                                <motion.button type="submit" whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(163,230,53,0.3)' }} whileTap={{ scale: 0.98 }}
                                    className="w-full py-4 bg-lime-500 hover:bg-lime-400 text-zinc-950 font-extrabold rounded-2xl shadow-lg shadow-lime-500/20 uppercase tracking-wider transition-colors">
                                    ✉️ Gửi yêu cầu hỗ trợ
                                </motion.button>
                            </form>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* ╔══════════════════════════════════════════════════════╗
                ║  FINAL CTA                                           ║
                ╚══════════════════════════════════════════════════════╝ */}
            <section className="py-16 mx-4 sm:mx-6 lg:mx-8 max-w-7xl lg:mx-auto mb-20 bg-gradient-to-r from-lime-500 to-emerald-500 rounded-3xl shadow-2xl shadow-lime-500/10 relative mt-8 overflow-hidden">
                <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_30px,rgba(0,0,0,0.03)_30px,rgba(0,0,0,0.03)_31px)]" />
                <div className="px-8 py-12 md:py-16 text-center relative z-10 max-w-3xl mx-auto">
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight text-zinc-950 uppercase">Sẵn Sàng Bứt Phá?</h2>
                    <p className="mt-4 text-zinc-800 text-lg max-w-xl mx-auto font-medium">Đặt lịch ngay hôm nay để giữ khung giờ vàng cho nhóm của bạn.</p>
                    <div className="mt-10">
                        <a href="#courts" className="px-8 py-4 bg-zinc-950 hover:bg-zinc-900 text-lime-400 font-extrabold rounded-2xl shadow-xl inline-block text-lg uppercase tracking-wider transition-colors">Chọn Giờ &amp; Đặt Sân →</a>
                    </div>
                </div>
            </section>

        </div>
    );
};

export default HomePage;
