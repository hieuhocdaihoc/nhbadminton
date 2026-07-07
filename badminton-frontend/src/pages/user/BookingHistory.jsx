import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { bookingService } from '../../services/user/bookingService';
import { reviewService } from '../../services/user/reviewService';

// Các trạng thái được phép gửi yêu cầu đổi/hủy
const REQUESTABLE_STATUSES = new Set(['pending', 'confirmed', 'active']);

// ─── COPY MÃ ĐƠN ──────────────────────────────────────────────────────────────
const CopyCodeButton = ({ code }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = async (e) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch (err) {
            console.error('Khong the sao chep:', err);
        }
    };
    return (
        <button onClick={handleCopy} title="Sao chép mã đơn"
            className="text-zinc-600 hover:text-lime-400 transition-colors shrink-0">
            <span className="material-symbols-outlined text-[14px]">{copied ? 'check' : 'content_copy'}</span>
        </button>
    );
};

// ─── HÀM HỖ TRỢ TRẠNG THÁI ────────────────────────────────────────────────────
const BOOKING_STATUS = {
    pending:   { label: 'Chờ xác nhận', dot: 'bg-amber-400',  text: 'text-amber-400',  bg: 'bg-amber-400/10',  border: 'border-amber-400/20' },
    confirmed: { label: 'Đã xác nhận',  dot: 'bg-lime-400',   text: 'text-lime-400',   bg: 'bg-lime-400/10',   border: 'border-lime-400/20'  },
    playing:   { label: 'Đang chơi',    dot: 'bg-sky-400',    text: 'text-sky-400',    bg: 'bg-sky-400/10',    border: 'border-sky-400/20'   },
    completed: { label: 'Hoàn thành',   dot: 'bg-emerald-400',text: 'text-emerald-400',bg: 'bg-emerald-400/10',border: 'border-emerald-400/20'},
    cancelled: { label: 'Đã hủy',       dot: 'bg-red-400',    text: 'text-red-400',    bg: 'bg-red-400/10',    border: 'border-red-400/20'   },
    active:    { label: 'Đang hoạt động',dot:'bg-lime-400',   text: 'text-lime-400',   bg: 'bg-lime-400/10',   border: 'border-lime-400/20'  },
};

const PAYMENT_STATUS = {
    paid:    { label: 'Đã thanh toán',   dot: 'bg-emerald-400', text: 'text-emerald-400' },
    partial: { label: 'Đã đặt cọc',      dot: 'bg-amber-400',   text: 'text-amber-400'  },
    unpaid:  { label: 'Chưa thanh toán', dot: 'bg-zinc-500',    text: 'text-zinc-500'   },
};

const StatusBadge = ({ status, size = 'sm' }) => {
    const s = BOOKING_STATUS[status] ?? BOOKING_STATUS.pending;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-semibold ${s.text} ${s.bg} ${s.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            {s.label}
        </span>
    );
};

const PaymentBadge = ({ paymentStatus }) => {
    const p = PAYMENT_STATUS[paymentStatus] ?? PAYMENT_STATUS.unpaid;
    return (
        <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${p.text}`}>
            <span className={`w-1 h-1 rounded-full ${p.dot}`} />
            {p.label}
        </span>
    );
};

const TypeBadge = ({ typeLabel }) => {
    const styles = {
        'Đặt Lẻ':  'text-sky-400    bg-sky-400/10    border-sky-400/20',
        'Định kỳ': 'text-purple-400 bg-purple-400/10 border-purple-400/20',
        'Dài hạn': 'text-amber-400  bg-amber-400/10  border-amber-400/20',
    };
    return (
        <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold tracking-wide ${styles[typeLabel] ?? styles['Đặt Lẻ']}`}>
            {typeLabel}
        </span>
    );
};

const fmt = (n) => Number(n ?? 0).toLocaleString('vi-VN');

// ─── THẺ ĐẶT SÂN LẺ ───────────────────────────────────────────────────────────
const SingleCard = ({ item, index, onReview, onRebook, onRequest }) => (
    <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04, duration: 0.25 }}
        className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden hover:border-lime-500/30 transition-all duration-300 backdrop-blur-sm">

        {/* Tiêu đề */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/60 bg-zinc-900/80">
            <div className="flex items-center gap-2.5 min-w-0">
                <TypeBadge typeLabel={item.type_label} />
                <span className="text-xs font-mono font-bold text-white truncate">{item.booking_code}</span>
                <CopyCodeButton code={item.booking_code} />
            </div>
            <StatusBadge status={item.status} />
        </div>

        {/* Nội dung */}
        <div className="px-5 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                    <p className="text-[10px] text-zinc-600 font-medium mb-0.5">Ngày thi đấu</p>
                    <p className="text-sm font-semibold text-white">{item.summary?.play_date ?? '—'}</p>
                </div>
                <div>
                    <p className="text-[10px] text-zinc-600 font-medium mb-0.5">Khung giờ</p>
                    <p className="text-sm font-mono text-zinc-300">{item.summary?.time_slot ?? '—'}</p>
                </div>
                <div>
                    <p className="text-[10px] text-zinc-600 font-medium mb-0.5">Sân</p>
                    <p className="text-sm font-semibold text-zinc-300">{item.summary?.court_name ?? '—'}</p>
                </div>
                <div>
                    <p className="text-[10px] text-zinc-600 font-medium mb-0.5">Tổng tiền</p>
                    <p className="text-sm font-bold text-lime-400">{fmt(item.total_price)} <span className="text-zinc-600 text-[10px]">đ</span></p>
                </div>
            </div>
        </div>

        {/* Chân trang */}
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-zinc-800/40 bg-zinc-950/40">
            <div className="flex items-center gap-3">
                <PaymentBadge paymentStatus={item.payment_status} />
                <span className="text-[10px] text-zinc-700">·</span>
                <span className="text-[10px] text-zinc-600">{item.created_at}</span>
            </div>
            <div className="flex items-center gap-2">
                {REQUESTABLE_STATUSES.has(item.status) && (
                    <button
                        onClick={() => onRequest({ booking_code: item.booking_code })}
                        className="flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 border border-amber-500/20 hover:border-amber-500/40 px-3 py-1 rounded-lg transition-colors">
                        <span className="material-symbols-outlined text-[13px]">edit_calendar</span> Yêu cầu đổi/hủy
                    </button>
                )}
                {(item.status === 'completed' || item.status === 'cancelled') && item.summary?.court_id && (
                    <button
                        onClick={() => onRebook(item.summary.court_id)}
                        className="flex items-center gap-1 text-[11px] font-bold text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-600 px-3 py-1 rounded-lg transition-colors">
                        <span className="material-symbols-outlined text-[13px]">replay</span> Đặt lại
                    </button>
                )}
                {item.status === 'completed' && item.payment_status === 'paid' && (
                    item.has_reviewed
                        ? <span className="flex items-center gap-1 text-[10px] text-zinc-600 italic">
                            <span className="material-symbols-outlined text-[13px] text-amber-400">star</span> Đã đánh giá
                        </span>
                        : <button
                            onClick={() => onReview({
                                booking_id: item.booking_id,
                                booking_code: item.booking_code,
                                court_id: item.summary?.court_id,
                            })}
                            className="text-[11px] font-bold text-lime-400 hover:text-lime-300 border border-lime-500/20 hover:border-lime-500/40 px-3 py-1 rounded-lg transition-colors">
                            Đánh giá sân
                        </button>
                )}
            </div>
        </div>
    </motion.div>
);

// ─── DÒNG BUỔI CHƠI (bên trong thẻ nhóm) ──────────────────────────────────────
const SessionRow = ({ session, onReview }) => {
    const s = BOOKING_STATUS[session.status] ?? BOOKING_STATUS.pending;
    return (
        <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800/40 rounded-xl transition-colors group">
            {/* Chấm trạng thái */}
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />

            {/* Ngày + mã đơn nhỏ */}
            <div className="w-20 flex-shrink-0">
                <p className="text-xs font-semibold text-white">{session.play_date}</p>
                {session.booking_code && (
                    <div className="flex items-center gap-0.5 mt-0.5">
                        <span className="text-[10px] font-mono text-zinc-600">{session.booking_code}</span>
                        <CopyCodeButton code={session.booking_code} />
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[11px] font-mono text-zinc-400">{session.time_slot}</p>
            </div>
            <span className={`text-[10px] font-semibold ${s.text} hidden sm:block`}>{s.label}</span>
            <div className="text-right flex-shrink-0 w-24">
                <p className="text-xs font-bold text-zinc-300">{fmt(session.total_price)}<span className="text-zinc-600 ml-0.5">đ</span></p>
            </div>
            {session.status === 'completed' && session.payment_status === 'paid' && (
                session.has_reviewed
                    ? <span className="text-[10px] text-zinc-600 italic w-20 text-right hidden sm:block">Đã đánh giá</span>
                    : <button
                        onClick={() => onReview({
                            booking_id: session.booking_id,
                            booking_code: session.booking_code,
                            court_id: session.court_id,
                        })}
                        className="text-[10px] font-bold text-lime-400 hover:text-lime-300 border border-lime-500/20 px-2 py-0.5 rounded-md transition-colors w-20 text-center hidden sm:block">
                        Đánh giá
                    </button>
            )}
        </div>
    );
};

// ─── THẺ ĐẶT SÂN NHÓM ─────────────────────────────────────────────────────────
const GroupCard = ({ item, index, onReview, onRequest }) => {
    const [expanded, setExpanded] = useState(false);
    const progress = item.total_sessions > 0 ? item.completed_sessions / item.total_sessions : 0;
    const paidProgress = item.total_sessions > 0 ? item.paid_sessions / item.total_sessions : 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04, duration: 0.25 }}
            className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden hover:border-lime-500/30 transition-all duration-300 backdrop-blur-sm">

            {/* Tiêu đề */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/60 bg-zinc-900/80">
                <div className="flex items-center gap-2.5 min-w-0">
                    <TypeBadge typeLabel={item.type_label} />
                    <span className="text-xs font-mono font-bold text-white truncate">{item.recurring_code}</span>
                    <CopyCodeButton code={item.recurring_code} />
                </div>
                <StatusBadge status={item.status} />
            </div>

            {/* Nội dung */}
            <div className="px-5 py-4">
                {/* Lưới thông tin */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                    <div>
                        <p className="text-[10px] text-zinc-600 font-medium mb-0.5">Sân</p>
                        <p className="text-sm font-semibold text-white">{item.court_name}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-zinc-600 font-medium mb-0.5">Khung giờ</p>
                        <p className="text-sm font-mono text-zinc-300">{item.time_slot}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-zinc-600 font-medium mb-0.5">Thời gian</p>
                        <p className="text-xs font-semibold text-zinc-300 leading-tight">{item.start_date}<br /><span className="text-zinc-600">→</span> {item.end_date}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-zinc-600 font-medium mb-0.5">Tổng tiền hợp đồng</p>
                        <p className="text-sm font-bold text-lime-400">{fmt(item.total_price)} <span className="text-zinc-600 text-[10px]">đ</span></p>
                    </div>
                </div>

                {/* Tiến trình */}
                <div className="space-y-2">
                    {/* Tiến trình buổi chơi */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-lime-500 rounded-full transition-all duration-500"
                                style={{ width: `${progress * 100}%` }}
                            />
                        </div>
                        <span className="text-[11px] text-zinc-400 font-medium flex-shrink-0">
                            {item.completed_sessions}/{item.total_sessions} buổi
                        </span>
                    </div>

                    {/* Tiến trình thanh toán */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                style={{ width: `${paidProgress * 100}%` }}
                            />
                        </div>
                        <span className="text-[10px] text-zinc-600 font-medium flex-shrink-0">
                            {item.paid_sessions}/{item.total_sessions} đã thanh toán
                        </span>
                    </div>
                </div>
            </div>

            {/* Chân trang + Nút mở rộng */}
            <div className="border-t border-zinc-800/40 bg-zinc-950/40">
                {REQUESTABLE_STATUSES.has(item.status) && (
                    <div className="px-5 pt-2.5 pb-0">
                        <button
                            onClick={() => onRequest({ booking_code: item.recurring_code })}
                            className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400 hover:text-amber-300 border border-amber-500/20 hover:border-amber-500/40 px-3 py-1.5 rounded-lg transition-colors">
                            <span className="material-symbols-outlined text-[13px]">edit_calendar</span> Yêu cầu đổi/hủy lịch
                        </button>
                    </div>
                )}
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="w-full flex items-center justify-between px-5 py-2.5 hover:bg-zinc-800/20 transition-colors">
                    <span className="text-[11px] text-zinc-500 font-medium">
                        {expanded ? 'Ẩn danh sách buổi' : `Xem ${item.total_sessions} buổi đặt`}
                    </span>
                    <motion.span
                        animate={{ rotate: expanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="material-symbols-outlined text-zinc-600 text-[18px]">
                        expand_more
                    </motion.span>
                </button>

                <AnimatePresence>
                    {expanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: 'easeInOut' }}>
                            <div className="px-3 pb-3 space-y-0.5">
                                {/* Tiêu đề danh sách buổi chơi */}
                                <div className="flex items-center gap-3 px-4 py-1.5 text-[10px] text-zinc-700 font-medium uppercase tracking-wider">
                                    <div className="w-1.5 flex-shrink-0" />
                                    <div className="w-20 flex-shrink-0">Ngày</div>
                                    <div className="flex-1">Giờ</div>
                                    <div className="hidden sm:block flex-shrink-0 w-24 text-right" />
                                    <div className="flex-shrink-0 w-24 text-right">Tiền</div>
                                    <div className="flex-shrink-0 w-20" />
                                </div>
                                {item.sessions.map((session) => (
                                    <SessionRow
                                        key={session.booking_id}
                                        session={session}
                                        onReview={onReview}
                                    />
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};

// ─── CỬA SỔ ĐÁNH GIÁ ──────────────────────────────────────────────────────────
const ReviewModal = ({ modal, setModal, onSubmit }) => {
    if (!modal.isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="user-card-glass max-w-md p-6 shadow-2xl">
                <h3 className="text-base font-extrabold text-white">Đánh giá sân</h3>
                <p className="mt-0.5 text-[11px] text-zinc-500">Mã đơn {modal.booking_code}</p>

                <div className="mt-5">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-600">Số sao</p>
                    <div className="flex gap-1.5">
                        {[1, 2, 3, 4, 5].map((r) => (
                            <button key={r} type="button"
                                onClick={() => setModal((p) => ({ ...p, rating: r }))}
                                className={`transition-transform hover:scale-110 ${r <= modal.rating ? 'text-amber-300' : 'text-zinc-800'}`}>
                                <span className="material-symbols-outlined text-[30px]" style={{ fontVariationSettings: r <= modal.rating ? "'FILL' 1" : "'FILL' 0" }}>
                                    star
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mt-4">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-600">Nhận xét</p>
                    <textarea
                        value={modal.comment}
                        onChange={(e) => setModal((p) => ({ ...p, comment: e.target.value }))}
                        rows={4}
                        placeholder="Cảm nhận về chất lượng sân, ánh sáng, dịch vụ..."
                        className="user-input py-3 resize-none"
                    />
                </div>

                <div className="mt-4 flex justify-end gap-2">
                    <button type="button" onClick={() => setModal((p) => ({ ...p, isOpen: false }))}
                        className="px-4 py-2 text-sm font-semibold text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl transition-colors">
                        Hủy
                    </button>
                    <button type="button" onClick={onSubmit}
                        disabled={modal.isSubmitting || modal.comment.trim().length < 5}
                        className="user-btn-primary py-2 px-5 text-sm">
                        {modal.isSubmitting ? 'Đang gửi...' : 'Gửi đánh giá'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

// ─── CỬA SỔ YÊU CẦU ───────────────────────────────────────────────────────────
const RequestModal = ({ modal, setModal, onSubmit }) => {
    if (!modal.isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="user-card-glass max-w-md p-6 shadow-2xl">

                <div className="flex items-center justify-between mb-1">
                    <h3 className="text-base font-extrabold text-white">Gửi yêu cầu</h3>
                    <button onClick={() => setModal((p) => ({ ...p, isOpen: false }))}
                        className="text-zinc-600 hover:text-white transition-colors">
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>
                <p className="text-[11px] text-zinc-500 mb-5 font-mono">{modal.booking_code}</p>

                {/* Loại yêu cầu */}
                <div className="mb-4">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-600">Loại yêu cầu</p>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { val: 'change', icon: 'edit_calendar', label: 'Đổi lịch' },
                            { val: 'cancel', icon: 'cancel',        label: 'Hủy lịch' },
                        ].map(({ val, icon, label }) => (
                            <button key={val} type="button"
                                onClick={() => setModal((p) => ({ ...p, type: val }))}
                                className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${
                                    modal.type === val
                                        ? val === 'cancel'
                                            ? 'border-red-500/50 bg-red-500/10 text-red-400'
                                            : 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                                        : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                                }`}>
                                <span className="material-symbols-outlined text-[18px]">{icon}</span>
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Lý do / nội dung */}
                <div className="mb-5">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-600">Lý do / chi tiết</p>
                    <textarea
                        value={modal.message}
                        onChange={(e) => setModal((p) => ({ ...p, message: e.target.value }))}
                        rows={4}
                        maxLength={500}
                        placeholder={
                            modal.type === 'cancel'
                                ? 'Vui lòng cho biết lý do hủy lịch...'
                                : 'Vui lòng nêu ngày/giờ bạn muốn đổi sang...'
                        }
                        className="user-input py-3 resize-none"
                    />
                    <div className="flex items-center justify-between mt-1">
                        {modal.message.trim().length > 0 && modal.message.trim().length < 10
                            ? <p className="text-[10px] text-red-400">Nhập ít nhất 10 ký tự ({10 - modal.message.trim().length} ký tự nữa)</p>
                            : <span />
                        }
                        <p className="text-[10px] text-zinc-700 ml-auto">{modal.message.length}/500</p>
                    </div>
                </div>

                <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setModal((p) => ({ ...p, isOpen: false }))}
                        className="px-4 py-2 text-sm font-semibold text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl transition-colors">
                        Đóng
                    </button>
                    <button type="button" onClick={onSubmit}
                        disabled={modal.isSubmitting || modal.message.trim().length < 10}
                        className={`px-5 py-2 text-sm font-extrabold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                            modal.type === 'cancel'
                                ? 'text-white bg-red-600 hover:bg-red-500'
                                : 'text-zinc-950 bg-amber-400 hover:bg-amber-300'
                        }`}>
                        {modal.isSubmitting ? 'Đang gửi...' : 'Gửi yêu cầu'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

// ─── HIỆU ỨNG TẢI TRANG (SKELETON) ────────────────────────────────────────────
const SkeletonCard = () => (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden animate-pulse">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/60">
            <div className="flex gap-2">
                <div className="w-16 h-5 bg-zinc-800 rounded-md" />
                <div className="w-28 h-5 bg-zinc-800 rounded-md" />
            </div>
            <div className="w-24 h-5 bg-zinc-800 rounded-md" />
        </div>
        <div className="px-5 py-4 grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
                <div key={i}>
                    <div className="w-16 h-3 bg-zinc-800 rounded mb-1.5" />
                    <div className="w-20 h-4 bg-zinc-800 rounded" />
                </div>
            ))}
        </div>
    </div>
);

// ─── TRANG CHÍNH ──────────────────────────────────────────────────────────────
const BookingHistory = () => {
    const navigate = useNavigate();
    const [items, setItems]           = useState([]);
    const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 });
    const [isLoading, setIsLoading]   = useState(true);
    const [activeTab, setActiveTab]   = useState('upcoming');
    const [flash, setFlash]           = useState({ type: '', msg: '' });
    const [searchTerm, setSearchTerm] = useState('');
    const [reviewModal, setReviewModal] = useState({
        isOpen: false, booking_id: null, booking_code: '', court_id: null,
        rating: 5, comment: '', isSubmitting: false,
    });
    const [requestModal, setRequestModal] = useState({
        isOpen: false, booking_code: '', type: 'change', message: '', isSubmitting: false,
    });

    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash({ type: '', msg: '' }), 4000);
    };

    const fetchData = async (tab, page) => {
        setIsLoading(true);
        try {
            const res = await bookingService.getUserBookingHistory(tab, page);
            const d = res.data?.data;
            if (d) {
                setItems(d.data || []);
                setPagination({ current_page: d.current_page || 1, last_page: d.last_page || 1, total: d.total || 0 });
            } else {
                setItems([]);
            }
        } catch (err) {
            const msg = err.response?.status === 401
                ? 'Phiên đăng nhập đã hết hạn.'
                : 'Không thể tải dữ liệu. Vui lòng thử lại.';
            showFlash('error', msg);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(activeTab, 1); }, [activeTab]);

    const handlePageChange = (p) => {
        if (p >= 1 && p <= pagination.last_page) fetchData(activeTab, p);
    };

    const openReview = ({ booking_id, booking_code, court_id }) => {
        setReviewModal({ isOpen: true, booking_id, booking_code, court_id, rating: 5, comment: '', isSubmitting: false });
    };

    const handleRebook = (courtId) => {
        navigate(`/booking-page?courtId=${courtId}`);
    };

    const openRequest = ({ booking_code }) => {
        setRequestModal({ isOpen: true, booking_code, type: 'change', message: '', isSubmitting: false });
    };

    const submitRequest = async () => {
        if (requestModal.message.trim().length < 10) return;
        setRequestModal((p) => ({ ...p, isSubmitting: true }));
        try {
            await bookingService.sendRequest({
                booking_code: requestModal.booking_code,
                type: requestModal.type,
                message: requestModal.message,
            });
            setRequestModal((p) => ({ ...p, isOpen: false }));
            showFlash('success', 'Đã gửi yêu cầu. Nhân viên sẽ liên hệ bạn sớm nhất!');
        } catch (err) {
            showFlash('error', err.response?.data?.message || 'Không thể gửi yêu cầu.');
            setRequestModal((p) => ({ ...p, isSubmitting: false }));
        }
    };

    const submitReview = async () => {
        if (!reviewModal.court_id) return;
        setReviewModal((p) => ({ ...p, isSubmitting: true }));
        try {
            await reviewService.createReview({
                target_type: 'court',
                target_id: reviewModal.court_id,
                booking_id: reviewModal.booking_id,
                rating: reviewModal.rating,
                comment: reviewModal.comment,
            });
            setReviewModal((p) => ({ ...p, isOpen: false }));
            showFlash('success', 'Đã gửi đánh giá thành công!');
            // Update has_reviewed in items
            const bid = reviewModal.booking_id;
            setItems((prev) => prev.map((item) => {
                if (item.item_type === 'single' && item.booking_id === bid) {
                    return { ...item, has_reviewed: true };
                }
                if (item.item_type === 'group') {
                    return {
                        ...item,
                        sessions: item.sessions.map((s) =>
                            s.booking_id === bid ? { ...s, has_reviewed: true } : s
                        ),
                    };
                }
                return item;
            }));
        } catch (err) {
            showFlash('error', err.response?.data?.message || 'Không thể gửi đánh giá.');
            setReviewModal((p) => ({ ...p, isSubmitting: false }));
        }
    };

    const tabs = [
        { id: 'upcoming', label: 'Sắp tới',   icon: 'calendar_month' },
        { id: 'history',  label: 'Đã qua',     icon: 'history' },
        { id: 'all',      label: 'Tất cả',     icon: 'list' },
    ];

    const singles = items.filter((i) => i.item_type === 'single');
    const groups  = items.filter((i) => i.item_type === 'group');

    // ─── LỌC NHANH THEO MÃ ĐƠN / TÊN SÂN (trong trang hiện tại) ───
    const filteredItems = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return items;
        return items.filter((item) => {
            if (item.item_type === 'single') {
                return (
                    item.booking_code?.toLowerCase().includes(term) ||
                    item.summary?.court_name?.toLowerCase().includes(term)
                );
            }
            return (
                item.recurring_code?.toLowerCase().includes(term) ||
                item.court_name?.toLowerCase().includes(term)
            );
        });
    }, [items, searchTerm]);

    return (
        <div className="bg-zinc-950 min-h-screen">
            <div className="user-page-container max-w-3xl py-10">

                {/* ─── PHẦN TIÊU ĐỀ ─── */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="text-2xl font-extrabold text-white tracking-tight">Lịch đặt sân</h1>
                            <p className="text-sm text-zinc-500 mt-1">Theo dõi toàn bộ lịch đặt sân của bạn.</p>
                        </div>
                        {!isLoading && pagination.total > 0 && (
                            <div className="text-right">
                                <p className="text-2xl font-extrabold text-white">{pagination.total}</p>
                                <p className="text-[10px] text-zinc-600 font-medium">đơn / hợp đồng</p>
                            </div>
                        )}
                    </div>

                    {/* Stats pills */}
                    {!isLoading && items.length > 0 && (
                        <div className="flex gap-2 mt-4">
                            {singles.length > 0 && (
                                <span className="text-[11px] font-semibold text-sky-400 bg-sky-400/8 border border-sky-400/15 px-3 py-1 rounded-full">
                                    {singles.length} đặt lẻ
                                </span>
                            )}
                            {groups.filter((g) => g.group_type === 'recurring').length > 0 && (
                                <span className="text-[11px] font-semibold text-purple-400 bg-purple-400/8 border border-purple-400/15 px-3 py-1 rounded-full">
                                    {groups.filter((g) => g.group_type === 'recurring').length} định kỳ
                                </span>
                            )}
                            {groups.filter((g) => g.group_type === 'long_term').length > 0 && (
                                <span className="text-[11px] font-semibold text-amber-400 bg-amber-400/8 border border-amber-400/15 px-3 py-1 rounded-full">
                                    {groups.filter((g) => g.group_type === 'long_term').length} dài hạn
                                </span>
                            )}
                        </div>
                    )}
                </motion.div>

                {/* ─── PHẦN ĐIỀU HƯỚNG TAB ─── */}
                <div className="flex items-center justify-between gap-3 mb-6 border-b border-zinc-800/60 flex-wrap">
                    <div className="flex items-center gap-1">
                        {tabs.map((tab) => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition-colors ${activeTab === tab.id ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                                <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                                {tab.label}
                                {activeTab === tab.id && (
                                    <motion.div layoutId="historyUnderline"
                                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-lime-400"
                                        transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Tìm kiếm nhanh theo mã đơn / tên sân */}
                    {!isLoading && items.length > 0 && (
                        <div className="relative mb-2">
                            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[15px] text-zinc-600">search</span>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Tìm mã đơn, tên sân..."
                                className="user-input py-1.5 pl-8 pr-3 w-44 sm:w-56"
                            />
                        </div>
                    )}
                </div>

                {/* ─── PHẦN THÔNG BÁO FLASH ─── */}
                <AnimatePresence>
                    {flash.msg && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className={`mb-5 px-4 py-3 rounded-xl text-sm font-medium border ${
                                flash.type === 'success'
                                    ? 'bg-emerald-500/8 border-emerald-500/15 text-emerald-400'
                                    : 'bg-red-500/8 border-red-500/15 text-red-400'
                            }`}>
                            {flash.msg}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ─── PHẦN NỘI DUNG ─── */}
                <AnimatePresence mode="wait">
                    <motion.div key={activeTab}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}>

                        {isLoading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
                            </div>
                        ) : items.length === 0 ? (
                            <div className="py-24 text-center">
                                <span className="material-symbols-outlined text-6xl text-zinc-800 mb-4 block">sports_tennis</span>
                                <p className="text-sm font-bold text-zinc-400">Không có dữ liệu</p>
                                <p className="text-xs text-zinc-600 mt-1">
                                    {activeTab === 'upcoming'
                                        ? 'Bạn chưa có lịch đặt sân sắp tới.'
                                        : activeTab === 'history'
                                        ? 'Không có lịch sử đặt sân.'
                                        : 'Bạn chưa đặt sân lần nào.'}
                                </p>
                                <a href="/"
                                    className="user-btn-primary py-2 px-5 mt-5">
                                    Đặt sân ngay →
                                </a>
                            </div>
                        ) : filteredItems.length === 0 ? (
                            <div className="py-16 text-center">
                                <span className="material-symbols-outlined text-4xl text-zinc-800 mb-3 block">search_off</span>
                                <p className="text-sm font-bold text-zinc-400">Không tìm thấy kết quả phù hợp</p>
                                <p className="text-xs text-zinc-600 mt-1">Thử lại với mã đơn hoặc tên sân khác.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {filteredItems.map((item, i) =>
                                    item.item_type === 'single'
                                        ? <SingleCard key={item.booking_id} item={item} index={i} onReview={openReview} onRebook={handleRebook} onRequest={openRequest} />
                                        : <GroupCard  key={item.recurring_id} item={item} index={i} onReview={openReview} onRequest={openRequest} />
                                )}
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>

                {/* ─── PHẦN PHÂN TRANG ─── */}
                {!isLoading && pagination.last_page > 1 && (
                    <div className="mt-8 flex items-center justify-center gap-1">
                        <button onClick={() => handlePageChange(pagination.current_page - 1)}
                            disabled={pagination.current_page === 1}
                            className="px-3 py-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:text-zinc-700 disabled:cursor-not-allowed transition-colors">
                            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                        </button>
                        {Array.from({ length: pagination.last_page }, (_, i) => i + 1).map((p) => (
                            <button key={p} onClick={() => handlePageChange(p)}
                                className={`w-9 h-9 rounded-lg text-xs font-semibold transition-all ${
                                    p === pagination.current_page
                                        ? 'bg-lime-500/15 text-lime-400 font-bold border border-lime-500/20'
                                        : 'text-zinc-500 hover:text-white hover:bg-zinc-800/60'
                                }`}>
                                {p}
                            </button>
                        ))}
                        <button onClick={() => handlePageChange(pagination.current_page + 1)}
                            disabled={pagination.current_page === pagination.last_page}
                            className="px-3 py-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:text-zinc-700 disabled:cursor-not-allowed transition-colors">
                            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                        </button>
                    </div>
                )}
            </div>

            {/* ─── CỬA SỔ ĐÁNH GIÁ ─── */}
            <ReviewModal modal={reviewModal} setModal={setReviewModal} onSubmit={submitReview} />

            {/* ─── CỬA SỔ YÊU CẦU ─── */}
            <RequestModal modal={requestModal} setModal={setRequestModal} onSubmit={submitRequest} />
        </div>
    );
};

export default BookingHistory;
