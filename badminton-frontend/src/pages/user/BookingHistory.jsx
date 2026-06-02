import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { bookingService } from '../../services/user/bookingService';
import { reviewService } from '../../services/user/reviewService';

const BookingHistory = () => {
    const [bookings, setBookings] = useState([]);
    const [pagination, setPagination] = useState({ current_page: 1, last_page: 1 });
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('upcoming');
    const [errorMessage, setErrorMessage] = useState('');
    const [reviewModal, setReviewModal] = useState({
        isOpen: false,
        booking: null,
        rating: 5,
        comment: '',
        isSubmitting: false,
    });

    const fetchHistoryData = async (tab, page) => {
        setIsLoading(true);
        setErrorMessage('');
        try {
            const response = await bookingService.getUserBookingHistory(tab, page);
            const responseData = response.data?.data;
            if (responseData) {
                setBookings(responseData.data || []);
                setPagination({ current_page: responseData.current_page || 1, last_page: responseData.last_page || 1 });
            } else { setBookings([]); }
        } catch (error) {
            console.error('Lỗi tải lịch sử:', error);
            setErrorMessage(error.response?.status === 401 ? 'Phiên đăng nhập đã hết hạn.' : 'Không thể tải dữ liệu.');
        } finally { setIsLoading(false); }
    };

    useEffect(() => {
        const timer = setTimeout(() => fetchHistoryData(activeTab, 1), 0);
        return () => clearTimeout(timer);
    }, [activeTab]);

    const handlePageChange = (p) => {
        if (p >= 1 && p <= pagination.last_page) fetchHistoryData(activeTab, p);
    };

    const openReviewModal = (booking) => {
        setReviewModal({
            isOpen: true,
            booking,
            rating: 5,
            comment: '',
            isSubmitting: false,
        });
    };

    const closeReviewModal = () => {
        setReviewModal({ isOpen: false, booking: null, rating: 5, comment: '', isSubmitting: false });
    };

    const submitReview = async () => {
        if (!reviewModal.booking?.summary?.court_id) return;

        setReviewModal((prev) => ({ ...prev, isSubmitting: true }));
        try {
            await reviewService.createReview({
                target_type: 'court',
                target_id: reviewModal.booking.summary.court_id,
                booking_id: reviewModal.booking.booking_id,
                rating: reviewModal.rating,
                comment: reviewModal.comment,
            });
            closeReviewModal();
            setErrorMessage('Đã gửi đánh giá sân.');
        } catch (error) {
            console.error('Lỗi gửi đánh giá:', error);
            setErrorMessage(error.response?.data?.message || 'Không thể gửi đánh giá.');
            setReviewModal((prev) => ({ ...prev, isSubmitting: false }));
        }
    };

    const getStatusStyle = (status, paymentStatus) => {
        if (status === 'cancelled') return { label: 'Đã hủy', dot: 'bg-red-400', text: 'text-red-400', bg: 'bg-red-500/8' };
        if (paymentStatus === 'paid') return { label: 'Đã thanh toán', dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/8' };
        return { label: 'Chờ thanh toán', dot: 'bg-amber-400', text: 'text-amber-400', bg: 'bg-amber-500/8' };
    };

    const tabs = [
        { id: 'upcoming', label: 'Sắp tới' },
        { id: 'history', label: 'Đã qua' },
        { id: 'all', label: 'Tất cả' },
    ];

    return (
        <div className="bg-zinc-950 min-h-screen">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

                {/* ═══ HEADER ═══ */}
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                    <h1 className="text-2xl font-extrabold text-white tracking-tight">Lịch sử đặt sân</h1>
                    <p className="text-sm text-zinc-500 mt-1">Theo dõi trạng thái và thông tin thanh toán.</p>
                </motion.div>

                {/* ═══ TAB BAR ═══ */}
                <div className="flex items-center gap-1 mb-8 border-b border-zinc-800/60">
                    {tabs.map((tab) => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            className={`relative px-5 py-3 text-sm font-semibold transition-colors ${activeTab === tab.id ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                            {tab.label}
                            {activeTab === tab.id && (
                                <motion.div layoutId="historyUnderline"
                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-lime-400"
                                    transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                            )}
                        </button>
                    ))}
                </div>

                {/* Error */}
                {errorMessage && (
                    <div className="mb-6 p-4 bg-red-500/8 border border-red-500/15 text-red-400 text-sm font-medium rounded-xl">{errorMessage}</div>
                )}

                {/* ═══ CONTENT ═══ */}
                <AnimatePresence mode="wait">
                    <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>

                        {isLoading ? (
                            <div className="py-28 text-center">
                                <div className="w-6 h-6 border-2 border-zinc-700 border-t-lime-400 rounded-full animate-spin mx-auto mb-4" />
                                <p className="text-sm text-zinc-500">Đang tải...</p>
                            </div>
                        ) : bookings.length === 0 ? (
                            <div className="py-28 text-center">
                                <p className="text-4xl mb-3 opacity-20">🏸</p>
                                <p className="text-sm font-semibold text-zinc-400">Không có dữ liệu</p>
                                <p className="text-xs text-zinc-600 mt-1">Không tìm thấy đơn nào trong danh mục này.</p>
                                <a href="/" className="inline-block mt-5 text-xs font-semibold text-lime-400 hover:text-lime-300 transition-colors">← Quay lại đặt sân</a>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {bookings.map((item, i) => {
                                    const st = getStatusStyle(item.status, item.payment_status);
                                    return (
                                        <motion.div key={item.booking_id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.03 }}
                                            className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-5 hover:bg-zinc-900/80 hover:border-zinc-700/60 transition-all duration-200 group">

                                            {/* Row 1: Code + Status */}
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm font-mono font-bold text-white">{item.booking_code}</span>
                                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${item.type === 'recurring_session'
                                                        ? 'text-purple-400 bg-purple-500/8 border-purple-500/15'
                                                        : 'text-sky-400 bg-sky-500/8 border-sky-500/15'}`}>
                                                        {item.type_label}
                                                    </span>
                                                </div>
                                                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${st.text} ${st.bg}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                                                    {st.label}
                                                </div>
                                            </div>

                                            {/* Row 2: Details grid */}
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                                {/* Ngày */}
                                                <div>
                                                    <p className="text-[10px] text-zinc-600 font-medium mb-1">Ngày thi đấu</p>
                                                    <p className="text-sm font-semibold text-white">{item.summary?.play_date || '—'}</p>
                                                </div>
                                                {/* Giờ */}
                                                <div>
                                                    <p className="text-[10px] text-zinc-600 font-medium mb-1">Khung giờ</p>
                                                    <p className="text-sm font-mono font-semibold text-zinc-300">{item.summary?.time_slot || '—'}</p>
                                                </div>
                                                {/* Sân */}
                                                <div>
                                                    <p className="text-[10px] text-zinc-600 font-medium mb-1">Sân</p>
                                                    <p className="text-sm font-semibold text-zinc-300">#{item.summary?.court_id || '—'}</p>
                                                </div>
                                                {/* Tổng tiền */}
                                                <div className="text-right sm:text-left">
                                                    <p className="text-[10px] text-zinc-600 font-medium mb-1">Tổng tiền</p>
                                                    <p className="text-sm font-bold text-lime-400">{Number(item.total_price).toLocaleString()} <span className="text-zinc-500 text-[10px] font-medium">đ</span></p>
                                                </div>
                                            </div>

                                            {/* Row 3: Meta */}
                                            <div className="mt-3 pt-3 border-t border-zinc-800/40 flex items-center justify-between">
                                                <span className="text-[10px] text-zinc-600">{item.details_count || 1} block · Đặt lúc {item.created_at}</span>
                                                {item.status === 'completed' && item.payment_status === 'paid' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => openReviewModal(item)}
                                                        className="rounded-lg border border-lime-500/20 px-3 py-1.5 text-[11px] font-bold text-lime-400 hover:bg-lime-500/10"
                                                    >
                                                        Đánh giá sân
                                                    </button>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>

                {/* ═══ PAGINATION ═══ */}
                {pagination.last_page > 1 && (
                    <div className="mt-8 flex items-center justify-center gap-1">
                        <button disabled={pagination.current_page === 1}
                            onClick={() => handlePageChange(pagination.current_page - 1)}
                            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${pagination.current_page === 1 ? 'text-zinc-700 cursor-not-allowed' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}>
                            ←
                        </button>
                        {Array.from({ length: pagination.last_page }, (_, i) => i + 1).map(page => (
                            <button key={page} onClick={() => handlePageChange(page)}
                                className={`w-9 h-9 rounded-lg text-xs font-semibold transition-all ${page === pagination.current_page
                                    ? 'bg-lime-500/15 text-lime-400 font-bold'
                                    : 'text-zinc-500 hover:text-white hover:bg-zinc-800/60'}`}>
                                {page}
                            </button>
                        ))}
                        <button disabled={pagination.current_page === pagination.last_page}
                            onClick={() => handlePageChange(pagination.current_page + 1)}
                            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${pagination.current_page === pagination.last_page ? 'text-zinc-700 cursor-not-allowed' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}>
                            →
                        </button>
                    </div>
                )}

                {reviewModal.isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
                        <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
                            <h3 className="text-lg font-extrabold text-white">Đánh giá sân</h3>
                            <p className="mt-1 text-xs text-zinc-500">
                                Mã đơn {reviewModal.booking?.booking_code}
                            </p>

                            <div className="mt-5">
                                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-zinc-500">Số sao</p>
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4, 5].map((rating) => (
                                        <button
                                            key={rating}
                                            type="button"
                                            onClick={() => setReviewModal((prev) => ({ ...prev, rating }))}
                                            className={`text-3xl ${rating <= reviewModal.rating ? 'text-amber-300' : 'text-zinc-700'}`}
                                        >
                                            ★
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-5">
                                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-zinc-500">Nội dung</p>
                                <textarea
                                    value={reviewModal.comment}
                                    onChange={(event) => setReviewModal((prev) => ({ ...prev, comment: event.target.value }))}
                                    rows={4}
                                    placeholder="Cảm nhận về chất lượng sân, ánh sáng, dịch vụ..."
                                    className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm text-white outline-none focus:border-lime-400"
                                />
                            </div>

                            <div className="mt-5 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={closeReviewModal}
                                    className="rounded-xl px-4 py-2 text-sm font-bold text-zinc-400 hover:bg-zinc-900"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="button"
                                    disabled={reviewModal.isSubmitting || reviewModal.comment.trim().length < 5}
                                    onClick={submitReview}
                                    className="rounded-xl bg-lime-500 px-4 py-2 text-sm font-extrabold text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Gửi đánh giá
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BookingHistory;
