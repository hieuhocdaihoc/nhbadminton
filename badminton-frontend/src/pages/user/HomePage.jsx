import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
// QUAN TRỌNG: Sử dụng service của user để gọi API Public không cần Token
import { courtService } from '../../services/user/courtService';

const NH_UTILITIES = [
    {
        icon: () => <svg className="w-7 h-7 fill-current text-blue-600" viewBox="0 0 24 24"><path d="M19 3H5C3.895 3 3 3.895 3 5V19C3 20.105 3.895 21 5 21H19C20.105 21 21 20.105 21 19V5C21 3.895 20.105 3 19 3ZM10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z" /></svg>,
        title: "Giữ chỗ tự động 100%", desc: "Hệ thống xử lý thời gian thực. Sân của bạn được khóa lịch ngay lập tức khi hoàn tất thanh toán cọc."
    },
    {
        icon: () => <svg className="w-7 h-7 fill-current text-blue-600" viewBox="0 0 24 24"><path d="M12 2L4 5V11.09C4 16.14 7.41 20.85 12 22C16.59 20.85 20 16.14 20 11.09V5L12 2ZM10 17L6 13L7.41 11.59L10 14.17L16.59 7.58L18 9L10 17Z" /></svg>,
        title: "Thảm Tiêu Chuẩn BWF", desc: "100% mặt sân sử dụng thảm chất lượng cao, độ bám tốt, hỗ trợ tối đa các pha di chuyển cường độ cao."
    },
    {
        icon: () => <svg className="w-7 h-7 fill-current text-blue-600" viewBox="0 0 24 24"><path d="M20 4H4C2.895 4 2 4.895 2 6V18C2 19.105 2.895 20 4 20H20C21.105 20 22 19.105 22 18V6C22 4.895 21.105 4 20 4ZM20 18H4V12H20V18ZM20 8H4V6H20V8Z" /></svg>,
        title: "Thanh toán QR siêu tốc", desc: "Tích hợp cổng thanh toán trực tuyến qua mã QR tự động. Tiện lợi, an toàn và minh bạch tuyệt đối."
    },
    {
        icon: () => <svg className="w-7 h-7 fill-current text-blue-600" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 16H11V10H13V16ZM13 8H11V6H13V8Z" /></svg>,
        title: "Tiện ích Pro-shop trọn gói", desc: "Cung cấp đầy đủ nước giải khát, cho thuê vợt, đan lưới kỹ thuật số ngay tại quầy lễ tân trung tâm."
    }
];

const STEPS = [
    { number: "01", title: "Chọn vị trí sân", desc: "Quan sát sa bàn trực quan của NH Badminton và click vào vị trí sân thi đấu mà bạn muốn chơi." },
    { number: "02", title: "Chọn khung giờ", desc: "Hệ thống hiển thị lưới giờ trống thực tế. Bạn có thể chọn đặt lẻ 1 ngày hoặc chọn đặt cố định theo tháng." },
    { number: "03", title: "Xác nhận & Cọc", desc: "Phân luồng thanh toán thông minh giữa khách chơi lẻ và khách đặt lịch cố định dài hạn." },
    { number: "04", title: "Check-in vào sân", desc: "Nhận mã đặt sân. Đến trung tâm, đưa mã cho lễ tân để nhận thảm và bắt đầu trận đấu!" }
];

const HomePage = () => {
    // 1. STATES TRÍCH XUẤT DANH SÁCH SÂN
    const [publicCourts, setPublicCourts] = useState([]);
    const [isLoadingCourts, setIsLoadingCourts] = useState(false);
    // Mặc định lấy ngày hôm nay
    const [searchDate, setSearchDate] = useState(new Date().toLocaleDateString('sv-SE'));

    const fadeInUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6 } } };
    const staggerContainer = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.2 } } };

    // --- ĐỒNG BỘ DANH SÁCH SÂN PUBLIC TỪ BACKEND ---
    useEffect(() => {
        const fetchCourts = async () => {
            setIsLoadingCourts(true);
            try {
                // Gọi API Public thông qua user courtService
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

    // --- ĐIỀU HƯỚNG CHỌN SÂN (Chuyển sang trang đặt lịch riêng biệt) ---
    const handleSelectCourtToBook = (court) => {
        if (!searchDate) {
            alert('Vui lòng chọn ngày thi đấu trước!');
            return;
        }
        // Điều hướng sang trang chuyên biệt kèm tham số
        window.location.href = `/booking-page?courtId=${court.id}&date=${searchDate}`;
    };

    return (
        <div className="bg-white font-sans text-zinc-900 selection:bg-blue-600 selection:text-white overflow-x-hidden">

            {/* HERO SECTION */}
            <section className="relative pt-12 pb-20 md:pt-20 md:pb-32 bg-gradient-to-b from-blue-50/60 via-white to-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                        <motion.div initial="hidden" animate="visible" variants={fadeInUp} className="text-center lg:text-left z-10">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100/80 text-blue-800 font-semibold text-xs uppercase tracking-wider mb-6">
                                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span> Trung tâm Cầu lông Tiêu chuẩn BWF
                            </div>
                            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-zinc-900 leading-[1.1]">
                                Đặt sân trực tuyến <br /> tại <span className="text-blue-600">NH Badminton</span>
                            </h1>
                            <p className="mt-6 text-lg md:text-xl text-zinc-600 max-w-lg mx-auto lg:mx-0 leading-relaxed">
                                Trải nghiệm hệ thống mặt sân thảm cao cấp. Chủ động kiểm tra giờ trống và đặt lịch hoàn toàn tự động, không cần chờ đợi.
                            </p>
                            <div className="mt-10 bg-white p-4 rounded-2xl shadow-xl shadow-blue-900/5 border border-blue-50 max-w-md mx-auto lg:mx-0 text-left">
                                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Tìm khung giờ trống nhanh</p>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <input
                                        type="date"
                                        min={new Date().toLocaleDateString('sv-SE')}
                                        value={searchDate}
                                        onChange={e => setSearchDate(e.target.value)}
                                        className="flex-1 px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl font-medium text-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                    />
                                    <a href="#courts" className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 text-center transition-all flex items-center justify-center whitespace-nowrap">Xem lịch sân</a>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div initial={{ opacity: 0, scale: 0.95, x: 20 }} animate={{ opacity: 1, scale: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.2 }} className="relative z-10">
                            <div className="relative mx-auto max-w-md lg:max-w-none rounded-3xl overflow-hidden shadow-2xl shadow-blue-600/10 border border-zinc-100">
                                <img src="https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&q=80&w=1000" alt="Sân cầu lông NH" className="w-full h-[400px] lg:h-[520px] object-cover hover:scale-105 transition-transform duration-700" />
                                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/80 via-transparent to-transparent"></div>
                                <div className="absolute bottom-6 left-6 right-6 bg-white/95 backdrop-blur-md p-5 rounded-2xl shadow-lg border border-white flex items-center justify-between">
                                    <div><p className="font-bold text-zinc-900 text-base">Địa chỉ trung tâm</p><p className="text-xs text-zinc-500 mt-0.5">Khu Công nghệ cao, Quận 9, TP. HCM</p></div>
                                    <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full font-bold text-xs border border-blue-100">Đang hoạt động</span>
                                </div>
                            </div>
                            <div className="absolute -inset-4 bg-blue-500/10 rounded-3xl filter blur-2xl -z-10 transform -rotate-3"></div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* UTILITIES SECTION */}
            <section id="utilities" className="py-20 bg-zinc-50/50 border-y border-zinc-100 scroll-mt-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-2xl mx-auto mb-16">
                        <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-3xl sm:text-4xl font-black text-zinc-900 tracking-tight">
                            Tiện ích tại <span className="text-blue-600">NH Badminton</span>
                        </motion.h2>
                        <p className="mt-4 text-zinc-600 font-medium">Đầu tư bài bản từ hệ thống thảm thi đấu, ánh sáng tiêu chuẩn đến nền tảng quản lý tự động.</p>
                    </div>

                    <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {NH_UTILITIES.map((item, index) => {
                            const RenderIcon = item.icon;
                            return (
                                <motion.div key={index} variants={fadeInUp} className="bg-white p-8 rounded-3xl border border-zinc-100 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 hover:-translate-y-1 transition-all duration-300 group">
                                    <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-600 transition-colors duration-300">
                                        <div className="group-hover:text-white transition-colors duration-300 flex items-center justify-center w-full h-full"><RenderIcon /></div>
                                    </div>
                                    <h3 className="text-xl font-bold text-zinc-900 mb-3">{item.title}</h3>
                                    <p className="text-zinc-600 leading-relaxed text-sm">{item.desc}</p>
                                </motion.div>
                            );
                        })}
                    </motion.div>
                </div>
            </section>

            {/* TACTICAL FLOOR MAP SECTION */}
            <section id="courts" className="py-20 bg-zinc-50 scroll-mt-20 border-b border-zinc-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

                    {/* Header */}
                    <div className="text-center max-w-3xl mx-auto mb-12">
                        <span className="px-3 py-1 bg-blue-100/80 text-blue-800 rounded-full text-xs font-bold uppercase tracking-wider">
                            Sơ đồ mặt bằng tổng thể
                        </span>
                        <h2 className="text-3xl sm:text-4xl font-black text-zinc-900 tracking-tight mt-2">
                            Sa Bàn <span className="text-blue-600">Cụm Sân Thi Đấu</span>
                        </h2>
                        <p className="mt-2 text-zinc-600 font-medium text-sm sm:text-base">
                            Mô phỏng hướng di chuyển thực tế: Cửa chính ra vào được bố trí sát Quầy Lễ Tân trung tâm để thuận tiện cho việc check-in nhận sân.
                        </p>
                    </div>

                    {/* KHUNG SA BÀN CHÍNH */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="bg-[#0b1329] p-6 sm:p-10 rounded-[2.5rem] shadow-2xl border-[6px] border-[#1e2947] relative overflow-hidden max-w-6xl mx-auto"
                    >
                        {/* THANH CHÚ GIẢI: LỐI VÀO SÁT BÊN TRÁI (CẠNH LỄ TÂN) */}
                        <div className="relative z-20 flex flex-wrap items-center justify-between gap-4 mb-10 bg-white/5 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10 text-xs text-zinc-300">
                            <div className="flex items-center gap-2 font-bold text-amber-400 uppercase tracking-wider">
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
                                <span>🚪 Lối vào & Cửa chính nằm ở hướng Tây Nam (Góc trái)</span>
                            </div>
                            <div className="flex items-center gap-6 font-semibold">
                                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-emerald-500 block"></span> Khả dụng</span>
                                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-zinc-600 block"></span> Bảo trì</span>
                            </div>
                        </div>

                        {/* RENDER DANH SÁCH SÂN */}
                        {isLoadingCourts ? (
                            <div className="py-24 text-center text-xs font-bold text-zinc-400 relative z-20">
                                Đang đồng bộ dữ liệu mặt bằng...
                            </div>
                        ) : publicCourts.length === 0 ? (
                            <div className="py-24 text-center bg-white/5 rounded-2xl relative z-20">
                                <p className="text-xs font-bold text-zinc-500">Hệ thống chưa có dữ liệu sân.</p>
                            </div>
                        ) : (
                            /* HỆ THỐNG LƯỚI 3 CỘT: Các sân bằng nhau tuyệt đối */
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-20">

                                {publicCourts.map((court, index) => {
                                    const imgList = court.images || court.image || [];
                                    const primaryImg = Array.isArray(imgList) && imgList.length > 0 ? imgList[0] : null;
                                    const rawUrl = primaryImg ? (primaryImg.image_url || primaryImg.url || primaryImg.path) : null;
                                    const imageUrl = rawUrl && rawUrl.startsWith('/') ? `http://127.0.0.1:8000${rawUrl}` : rawUrl;

                                    // THUẬT TOÁN ĐỊNH VỊ KHÔNG GIAN (Dành cho Cụm 5 Sân)
                                    // Sân thứ 5 (index 4) được bẻ lái sang cột số 3
                                    // Để lại cột số 2 (giữa hàng dưới) làm Trung tâm Lễ tân sát cửa ra vào
                                    const isCenterHubIn5CourtsLayout = publicCourts.length === 5 && index === 4;

                                    return (
                                        <React.Fragment key={court.id}>

                                            {/* KHU VỰC TRUNG TÂM: QUẦY LỄ TÂN & SẢNH NGHỈ NGƠI */}
                                            {isCenterHubIn5CourtsLayout && (
                                                <div className="hidden lg:flex flex-col justify-between border-2 border-blue-500/20 rounded-2xl p-4 text-center bg-gradient-to-b from-blue-950/20 to-white/[0.02] backdrop-blur-xs overflow-hidden relative group">
                                                    <div className="pb-3 border-b border-white/5">
                                                        <span className="text-xl block mb-1">🛎️</span>
                                                        <h5 className="font-black text-white text-xs uppercase tracking-wider">
                                                            Quầy Lễ Tân Trung Tâm
                                                        </h5>
                                                        <p className="text-[9px] text-blue-400 mt-0.5 font-medium">
                                                            Khu vực Check-in & Hỗ trợ vợt thủ
                                                        </p>
                                                    </div>

                                                    <div className="pt-2 my-auto">
                                                        <div className="flex justify-center gap-2 text-base mb-1.5 opacity-60">
                                                            <span>🪑</span><span>🛋️</span><span>🥤</span>
                                                        </div>
                                                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">
                                                            Sảnh Nghỉ Ngơi
                                                        </span>
                                                        <p className="text-[9px] text-zinc-500 mt-0.5">
                                                            Hàng ghế chờ & Tủ nước tự động
                                                        </p>
                                                    </div>

                                                    <div className="absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500/40 to-transparent"></div>
                                                </div>
                                            )}

                                            {/* CARD MẶT SÂN THI ĐẤU (BẤM VÀO ĐỂ SANG TRANG CHUYÊN BIỆT) */}
                                            <motion.div
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={() => handleSelectCourtToBook(court)}
                                                className={`bg-[#121f3d]/90 backdrop-blur-sm border-2 border-emerald-500/40 rounded-2xl p-4 relative flex flex-col justify-between h-[280px] cursor-pointer group hover:border-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-all overflow-hidden ${isCenterHubIn5CourtsLayout ? 'lg:col-start-3' : ''
                                                    }`}
                                            >
                                                {/* Vạch kẻ sân */}
                                                <div className="absolute inset-x-3 top-10 bottom-10 border border-white/5 rounded pointer-events-none group-hover:border-emerald-500/20 transition-colors"></div>

                                                {/* Ảnh nền */}
                                                {imageUrl && (
                                                    <>
                                                        <img src={imageUrl} alt={court.name} className="absolute inset-0 w-full h-full object-cover opacity-20 group-hover:opacity-35 transition-opacity duration-300" />
                                                        <div className="absolute inset-0 bg-gradient-to-t from-[#0b1329] via-[#121f3d]/70 to-transparent"></div>
                                                    </>
                                                )}

                                                {/* Header Sân */}
                                                <div className="relative z-10 flex items-center justify-between pb-2 border-b border-white/10">
                                                    <div>
                                                        <span className="text-[9px] font-mono font-bold text-emerald-400 block">
                                                            {court.court_code || `SAN_${court.id}`}
                                                        </span>
                                                        <h4 className="text-base font-black text-white tracking-tight group-hover:text-emerald-300 transition-colors">
                                                            {court.name}
                                                        </h4>
                                                    </div>
                                                    <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-[9px] rounded uppercase shrink-0">
                                                        Đang mở
                                                    </span>
                                                </div>

                                                {/* Thông số kỹ thuật */}
                                                <div className="relative z-10 my-auto space-y-1 text-xs text-zinc-300 bg-[#0b1329]/50 p-2.5 rounded-xl border border-white/5 pointer-events-none">
                                                    <p className="flex justify-between text-[11px]">
                                                        <span className="text-zinc-500">Bề mặt:</span>
                                                        <strong className="text-emerald-400 font-mono">{court.floor_type || 'Thảm BWF'}</strong>
                                                    </p>
                                                    <p className="flex justify-between text-[11px]">
                                                        <span className="text-zinc-500">Sức chứa:</span>
                                                        <span>{court.capacity || 4} Vợt thủ</span>
                                                    </p>
                                                    {court.location_note && (
                                                        <p className="text-[10px] text-amber-400/90 italic truncate pt-1 text-right">
                                                            📍 {court.location_note}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Dải thông báo chuyển trang dưới cùng */}
                                                <div className="relative z-10 pt-2 border-t border-white/10 text-center pointer-events-none">
                                                    <span className="text-[10px] font-bold text-emerald-400/90 group-hover:text-emerald-400 transition-colors inline-flex items-center gap-1">
                                                        Nhấp kiểm tra giờ trống <span className="group-hover:translate-x-1 transition-transform">→</span>
                                                    </span>
                                                </div>
                                            </motion.div>

                                        </React.Fragment>
                                    );
                                })}

                            </div>
                        )}
                    </motion.div>

                    {/* BẢNG THÔNG BÁO GIÁ */}
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-3xl mx-auto mt-12">
                        <div className="bg-zinc-50 border border-zinc-200/80 rounded-3xl p-6 sm:p-10 shadow-sm">
                            <div className="text-center pb-6 border-b border-zinc-200">
                                <p className="text-xs font-bold text-blue-600 uppercase tracking-widest block mb-1">[ Bảng Niêm Yết Chi Phí Dịch Vụ ]</p>
                                <h3 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight">Áp dụng chung cho tất cả các sân trực thuộc</h3>
                                <p className="text-xs text-zinc-500 mt-1">Giá thuê tính theo block tối thiểu 60 phút. Hỗ trợ thanh toán QR tự động.</p>
                            </div>

                            <div className="divide-y divide-zinc-200/60 my-2">
                                <div className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-white transition-colors px-3 rounded-xl">
                                    <div className="flex items-start gap-3">
                                        <span className="text-lg block mt-0.5">☀️</span>
                                        <div>
                                            <div className="flex items-center gap-2 font-bold text-zinc-900 text-base"><span>Khung Giờ Thường</span><span className="text-[10px] font-semibold bg-zinc-200/70 text-zinc-600 px-2 py-0.5 rounded">05:00 - 17:00</span></div>
                                            <p className="text-xs text-zinc-500 mt-0.5">Thích hợp tập luyện tự do, sinh viên hoặc người làm tự do.</p>
                                        </div>
                                    </div>
                                    <div className="sm:text-right shrink-0 pl-7 sm:pl-0">
                                        <span className="text-2xl font-black text-zinc-900 tracking-tight">100.000 <span className="text-xs font-semibold text-zinc-500">VNĐ/h</span></span>
                                    </div>
                                </div>

                                <div className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-blue-50/50 hover:bg-blue-50 transition-colors px-3 rounded-xl border border-blue-100/50">
                                    <div className="flex items-start gap-3">
                                        <span className="text-lg block mt-0.5 animate-pulse">🔥</span>
                                        <div>
                                            <div className="flex items-center gap-2 font-bold text-blue-900 text-base"><span>Khung Giờ Vàng</span><span className="text-[10px] font-bold bg-amber-300 text-blue-900 px-2 py-0.5 rounded shadow-sm">17:00 - 23:00</span></div>
                                            <p className="text-xs text-blue-700 mt-0.5">Giờ cao điểm thi đấu phong trào, các CLB và hội nhóm.</p>
                                        </div>
                                    </div>
                                    <div className="sm:text-right shrink-0 pl-7 sm:pl-0">
                                        <span className="text-2xl font-black text-blue-600 tracking-tight">120.000 <span className="text-xs font-semibold text-zinc-500">VNĐ/h</span></span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* STEPS SECTION */}
            <section id="steps" className="py-20 bg-zinc-50/60 border-b border-zinc-100 scroll-mt-20 relative">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="text-center max-w-2xl mx-auto mb-16">
                        <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold uppercase tracking-wider border border-blue-100">Quy trình vận hành</span>
                        <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-900 mt-2">4 Bước Đặt Sân <span className="text-blue-600">Nhanh Chóng</span></h2>
                        <p className="mt-3 text-zinc-600 font-medium">Hệ thống phân luồng thông minh, linh hoạt cho cả khách chơi lẻ và khách đặt lịch cố định.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
                        <div className="hidden lg:block absolute top-1/2 left-[15%] right-[15%] h-0.5 bg-zinc-200 border-t-2 border-dashed border-zinc-300 -translate-y-6 z-0"></div>

                        {STEPS.map((step, idx) => (
                            <motion.div key={idx} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: idx * 0.1 }} className="bg-white p-6 sm:p-8 rounded-3xl border border-zinc-200/80 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all relative z-10 flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 font-black text-lg border border-blue-100">{step.number}</div>
                                    </div>
                                    <h3 className="text-lg font-bold text-zinc-900 mb-2">{step.title}</h3>
                                    <p className="text-xs text-zinc-500 leading-relaxed">{step.desc}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CONTACT SECTION */}
            <section id="contact" className="py-20 bg-white border-b border-zinc-100 scroll-mt-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-2xl mx-auto mb-16">
                        <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold uppercase tracking-wider border border-blue-100">Hỗ trợ 24/7</span>
                        <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-900 mt-2">Liên Hệ <span className="text-blue-600">NH Badminton</span></h2>
                        <p className="mt-3 text-zinc-600 font-medium">Bạn cần giải đáp thắc mắc, xuất hóa đơn VAT hoặc hợp tác tổ chức giải đấu? Hãy để lại lời nhắn cho chúng tôi.</p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-stretch">
                        <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="lg:col-span-2 bg-zinc-50 p-8 sm:p-10 rounded-3xl border border-zinc-200/80 flex flex-col justify-between h-full">
                            <div>
                                <h3 className="text-xl font-bold text-zinc-900 mb-6 tracking-tight">Thông tin trung tâm</h3>
                                <div className="space-y-6 text-sm text-zinc-600">
                                    <div className="flex items-start gap-3">
                                        <div><p className="font-bold text-zinc-900 text-xs uppercase tracking-wider mb-1">Địa chỉ</p><p>Khu Công nghệ cao, Quận 9, TP. HCM</p></div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div><p className="font-bold text-zinc-900 text-xs uppercase tracking-wider mb-1">Hotline hỗ trợ</p><p className="font-semibold text-blue-600 text-base">0123.456.789</p></div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div><p className="font-bold text-zinc-900 text-xs uppercase tracking-wider mb-1">Email tiếp nhận</p><p>support@nhbadminton.vn</p></div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="lg:col-span-3 bg-white p-8 sm:p-10 rounded-3xl border border-zinc-200/80 shadow-lg h-full flex flex-col justify-between">
                            <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div><label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-2">Họ và tên *</label><input type="text" required placeholder="Nhập tên của bạn" className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl font-medium text-zinc-800" /></div>
                                    <div><label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-2">Số điện thoại *</label><input type="tel" required placeholder="09xx xxx xxx" className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl font-medium text-zinc-800" /></div>
                                </div>
                                <div><label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-2">Nội dung cần hỗ trợ *</label><textarea rows="4" required placeholder="Nội dung chi tiết..." className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl font-medium text-zinc-800 resize-none"></textarea></div>
                                <button type="submit" className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl shadow-lg">✉️ Gửi yêu cầu hỗ trợ ngay</button>
                            </form>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* CTA SECTION */}
            <section className="py-16 mx-4 sm:mx-6 lg:mx-8 max-w-7xl lg:mx-auto mb-20 bg-gradient-to-r from-blue-600 to-blue-700 rounded-3xl text-white shadow-2xl relative mt-12">
                <div className="px-8 py-12 md:py-16 text-center relative z-10 max-w-3xl mx-auto">
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight">Sẵn sàng trải nghiệm sân chơi đỉnh cao?</h2>
                    <p className="mt-4 text-blue-100 text-lg max-w-xl mx-auto">Hệ thống sân NH Badminton luôn sẵn sàng phục vụ. Đặt lịch ngay hôm nay để giữ các khung giờ vàng thi đấu cho nhóm của bạn.</p>
                    <div className="mt-10"><a href="#courts" className="px-8 py-4 bg-zinc-900 text-white font-black rounded-xl shadow-xl inline-block text-lg">Chọn giờ & Đặt sân ngay</a></div>
                </div>
            </section>

        </div>
    );
};

export default HomePage;