import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { bookingService } from '../../services/user/bookingService';
import { reviewService } from '../../services/user/reviewService';

// Các trạng thái được phép gửi yêu cầu đổi/hủy
const REQUESTABLE_STATUSES = new Set(['confirmed', 'active']);

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
            className="text-zinc-500 hover:text-lime-500 transition-colors shrink-0">
            <span className="material-symbols-outlined text-[14px]">{copied ? 'check' : 'content_copy'}</span>
        </button>
    );
};

// ─── HÀM HỖ TRỢ TRẠNG THÁI ────────────────────────────────────────────────────
const BOOKING_STATUS = {
    confirmed: { label: 'Đã xác nhận',  dot: 'bg-lime-400',   text: 'text-lime-300',   bg: 'bg-lime-400/10',   border: 'border-lime-400/30'  },
    playing:   { label: 'Đang chơi',    dot: 'bg-sky-400',    text: 'text-sky-300',    bg: 'bg-sky-400/10',    border: 'border-sky-400/30'   },
    completed: { label: 'Hoàn thành',   dot: 'bg-teal-400',text: 'text-teal-300',bg: 'bg-teal-400/10',border: 'border-teal-400/30'},
    cancelled: { label: 'Đã hủy',       dot: 'bg-red-400',    text: 'text-red-300',    bg: 'bg-red-400/10',    border: 'border-red-400/30'   },
    active:    { label: 'Đang hoạt động',dot:'bg-lime-400',   text: 'text-lime-300',   bg: 'bg-lime-400/10',   border: 'border-lime-400/30'  },
};

const PAYMENT_STATUS = {
    paid:    { label: 'Đã thanh toán',   dot: 'bg-lime-400', text: 'text-lime-300' },
    partially_paid: { label: 'Đã đặt cọc', dot: 'bg-amber-400', text: 'text-amber-300' },
    unpaid:  { label: 'Chưa thanh toán', dot: 'bg-zinc-300',    text: 'text-zinc-500'   },
};

const StatusBadge = ({ status }) => {
    const s = BOOKING_STATUS[status] ?? BOOKING_STATUS.confirmed;
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
        'Đặt Lẻ':  'text-sky-300    bg-sky-400/10    border-sky-400/30',
        'Định kỳ': 'text-purple-300 bg-purple-400/10 border-purple-400/30',
        'Dài hạn': 'text-amber-300  bg-amber-400/10  border-amber-400/30',
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
        className="bg-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden hover:border-lime-400/30 transition-all duration-300 shadow-sm">

        {/* Tiêu đề */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-700 bg-zinc-900/60">
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
                    <p className="text-[10px] text-zinc-500 font-medium mb-0.5">Ngày thi đấu</p>
                    <p className="text-sm font-semibold text-white">{item.summary?.play_date ?? '—'}</p>
                </div>
                <div>
                    <p className="text-[10px] text-zinc-500 font-medium mb-0.5">Khung giờ</p>
                    <p className="text-sm font-mono text-zinc-400">{item.summary?.time_slot ?? '—'}</p>
                </div>
                <div>
                    <p className="text-[10px] text-zinc-500 font-medium mb-0.5">Sân</p>
                    <p className="text-sm font-semibold text-zinc-400">{item.summary?.court_name ?? '—'}</p>
                </div>
                <div>
                    <p className="text-[10px] text-zinc-500 font-medium mb-0.5">Tổng tiền</p>
                    <p className="text-sm font-bold text-lime-500">{fmt(item.total_price)} <span className="text-zinc-500 text-[10px]">đ</span></p>
                </div>
            </div>
        </div>

        {/* Chân trang */}
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-zinc-700 bg-zinc-900/60">
            <div className="flex items-center gap-3">
                <PaymentBadge paymentStatus={item.payment_status} />
                <span className="text-[10px] text-zinc-500">·</span>
                <span className="text-[10px] text-zinc-500">{item.created_at}</span>
            </div>
            <div className="flex items-center gap-2">
                {REQUESTABLE_STATUSES.has(item.status) && (
                    item.request_locked_by_time ? (
                        <span
                            title="Chỉ được yêu cầu hủy/đổi trước giờ chơi ít nhất 1 ngày."
                            className="flex items-center gap-1 text-[10px] italic text-zinc-500 border border-zinc-700 px-3 py-1 rounded-lg cursor-not-allowed max-w-[210px] leading-tight">
                            <span className="material-symbols-outlined text-[13px]">lock_clock</span>
                            Chỉ được yêu cầu hủy/đổi trước giờ chơi ít nhất 1 ngày
                        </span>
                    ) : (
                        <button
                            onClick={() => onRequest({ booking_code: item.booking_code })}
                            className="flex items-center gap-1 text-[11px] font-bold text-amber-300 hover:text-amber-300 border border-amber-400/30 hover:border-amber-300 px-3 py-1 rounded-lg transition-colors">
                            <span className="material-symbols-outlined text-[13px]">edit_calendar</span> Yêu cầu đổi/hủy
                        </button>
                    )
                )}
                {(item.status === 'completed' || item.status === 'cancelled') && item.summary?.court_id && (
                    <button
                        onClick={() => onRebook(item.summary.court_id)}
                        className="flex items-center gap-1 text-[11px] font-bold text-zinc-400 hover:text-white border border-zinc-600 hover:border-zinc-400 px-3 py-1 rounded-lg transition-colors">
                        <span className="material-symbols-outlined text-[13px]">replay</span> Đặt lại
                    </button>
                )}
                {item.status === 'completed' && item.payment_status === 'paid' && (
                    item.has_reviewed
                        ? <span className="flex items-center gap-1 text-[10px] text-zinc-500 italic">
                            <span className="material-symbols-outlined text-[13px] text-amber-500">star</span> Đã đánh giá
                        </span>
                        : <button
                            onClick={() => onReview({
                                booking_id: item.booking_id,
                                booking_code: item.booking_code,
                                court_id: item.summary?.court_id,
                            })}
                            className="text-[11px] font-bold text-lime-500 hover:text-lime-300 border border-lime-400/30 hover:border-lime-300 px-3 py-1 rounded-lg transition-colors">
                            Đánh giá sân
                        </button>
                )}
            </div>
        </div>
    </motion.div>
);

// ─── DÒNG BUỔI CHƠI (bên trong thẻ nhóm) ──────────────────────────────────────
const SessionRow = ({ session, onReview, onRequest }) => {
    const s = BOOKING_STATUS[session.status] ?? BOOKING_STATUS.confirmed;
    const canRequest = REQUESTABLE_STATUSES.has(session.status) && session.booking_code;
    return (
        <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-900/60 rounded-xl transition-colors group">
            {/* Chấm trạng thái */}
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />

            {/* Ngày + mã đơn nhỏ */}
            <div className="w-20 flex-shrink-0">
                <p className="text-xs font-semibold text-white">{session.play_date}</p>
                {session.booking_code && (
                    <div className="flex items-center gap-0.5 mt-0.5">
                        <span className="text-[10px] font-mono text-zinc-500">{session.booking_code}</span>
                        <CopyCodeButton code={session.booking_code} />
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[11px] font-mono text-zinc-400">{session.time_slot}</p>
            </div>
            <span className={`text-[10px] font-semibold ${s.text} hidden sm:block`}>{s.label}</span>
            <div className="text-right flex-shrink-0 w-24">
                <p className="text-xs font-bold text-white">{fmt(session.total_price)}<span className="text-zinc-500 ml-0.5">đ</span></p>
            </div>

            {/* Cột thao tác: đổi lịch cho riêng buổi này, hoặc đánh giá */}
            <div className="w-24 flex-shrink-0 flex justify-end">
                {canRequest ? (
                    <button
                        onClick={() => onRequest({ booking_code: session.booking_code })}
                        className="flex items-center gap-1 text-[10px] font-bold text-amber-300 hover:text-amber-300 border border-amber-400/30 hover:border-amber-300 px-2 py-0.5 rounded-md transition-colors">
                        <span className="material-symbols-outlined text-[12px]">edit_calendar</span> Đổi lịch
                    </button>
                ) : session.status === 'completed' && session.payment_status === 'paid' ? (
                    session.has_reviewed
                        ? <span className="text-[10px] text-zinc-500 italic hidden sm:block">Đã đánh giá</span>
                        : <button
                            onClick={() => onReview({
                                booking_id: session.booking_id,
                                booking_code: session.booking_code,
                                court_id: session.court_id,
                            })}
                            className="text-[10px] font-bold text-lime-500 hover:text-lime-300 border border-lime-400/30 px-2 py-0.5 rounded-md transition-colors">
                            Đánh giá
                        </button>
                ) : null}
            </div>
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
            className="bg-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden hover:border-lime-400/30 transition-all duration-300 shadow-sm">

            {/* Tiêu đề */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-700 bg-zinc-900/60">
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
                        <p className="text-[10px] text-zinc-500 font-medium mb-0.5">Sân</p>
                        <p className="text-sm font-semibold text-white">{item.court_name}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-zinc-500 font-medium mb-0.5">Khung giờ</p>
                        <p className="text-sm font-mono text-zinc-400">{item.time_slot}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-zinc-500 font-medium mb-0.5">Thời gian</p>
                        <p className="text-xs font-semibold text-zinc-400 leading-tight">{item.start_date}<br /><span className="text-zinc-500">→</span> {item.end_date}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-zinc-500 font-medium mb-0.5">Tổng tiền hợp đồng</p>
                        <p className="text-sm font-bold text-lime-500">{fmt(item.total_price)} <span className="text-zinc-500 text-[10px]">đ</span></p>
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
                        <span className="text-[11px] text-zinc-500 font-medium flex-shrink-0">
                            {item.completed_sessions}/{item.total_sessions} buổi
                        </span>
                    </div>

                    {/* Tiến trình thanh toán */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-lime-500 rounded-full transition-all duration-500"
                                style={{ width: `${paidProgress * 100}%` }}
                            />
                        </div>
                        <span className="text-[10px] text-zinc-500 font-medium flex-shrink-0">
                            {item.paid_sessions}/{item.total_sessions} đã thanh toán
                        </span>
                    </div>
                </div>
            </div>

            {/* Chân trang + Nút mở rộng */}
            <div className="border-t border-zinc-700 bg-zinc-900/60">
                {REQUESTABLE_STATUSES.has(item.status) && (
                    <div className="px-5 pt-2.5 pb-0">
                        {item.request_locked_by_time ? (
                            <span
                                title="Chỉ được yêu cầu hủy/đổi trước giờ chơi ít nhất 1 ngày."
                                className="flex items-center gap-1.5 text-[10px] italic text-zinc-500 border border-zinc-700 px-3 py-1.5 rounded-lg cursor-not-allowed leading-tight">
                                <span className="material-symbols-outlined text-[13px]">lock_clock</span>
                                Chỉ được yêu cầu hủy/đổi trước giờ chơi ít nhất 1 ngày
                            </span>
                        ) : (
                            <button
                                onClick={() => onRequest({ booking_code: item.recurring_code, isContract: true })}
                                className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300 hover:text-amber-300 border border-amber-400/30 hover:border-amber-300 px-3 py-1.5 rounded-lg transition-colors">
                                <span className="material-symbols-outlined text-[13px]">edit_calendar</span> Yêu cầu đổi/hủy cả hợp đồng
                            </button>
                        )}
                    </div>
                )}
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="w-full flex items-center justify-between px-5 py-2.5 hover:bg-zinc-800 transition-colors">
                    <span className="text-[11px] text-zinc-500 font-medium">
                        {expanded ? 'Ẩn danh sách buổi' : `Xem ${item.total_sessions} buổi đặt`}
                    </span>
                    <motion.span
                        animate={{ rotate: expanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="material-symbols-outlined text-zinc-500 text-[18px]">
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
                                <div className="flex items-center gap-3 px-4 py-1.5 text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
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
                                        onRequest={onRequest}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-zinc-900 border border-zinc-700 w-full max-w-md p-6 rounded-3xl shadow-xl">
                <h3 className="text-base font-extrabold text-white">Đánh giá sân</h3>
                <p className="mt-0.5 text-[11px] text-zinc-500 font-mono">{modal.booking_code}</p>

                <div className="mt-5">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Số sao</p>
                    <div className="flex gap-1.5">
                        {[1, 2, 3, 4, 5].map((r) => (
                            <button key={r} type="button"
                                onClick={() => setModal((p) => ({ ...p, rating: r }))}
                                className={`transition-transform hover:scale-110 ${r <= modal.rating ? 'text-amber-500 animate-pulse' : 'text-zinc-200'}`}>
                                <span className="material-symbols-outlined text-[30px]" style={{ fontVariationSettings: r <= modal.rating ? "'FILL' 1" : "'FILL' 0" }}>
                                    star
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mt-4">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Nhận xét</p>
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
                        className="px-4 py-2 text-sm font-semibold text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors">
                        Hủy
                    </button>
                    <button type="button" onClick={onSubmit}
                        disabled={modal.isSubmitting || modal.comment.trim().length < 5}
                        className="user-btn-primary py-2 px-5 text-sm font-bold">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-zinc-900 border border-zinc-700 w-full max-w-md p-6 rounded-3xl shadow-xl">

                <div className="flex items-center justify-between mb-1">
                    <h3 className="text-base font-extrabold text-white">Gửi yêu cầu</h3>
                    <button onClick={() => setModal((p) => ({ ...p, isOpen: false }))}
                        className="text-zinc-500 hover:text-white transition-colors">
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>
                <p className="text-[11px] text-zinc-500 mb-1 font-mono">{modal.booking_code}</p>
                {modal.isContract && (
                    <p className="text-[10px] text-amber-300 mb-4 font-semibold leading-relaxed">
                        Yêu cầu cho cả hợp đồng sẽ được gửi tới nhân viên hỗ trợ để xử lý.
                        Bạn cũng có thể mở danh sách buổi để gửi yêu cầu cho riêng một buổi.
                    </p>
                )}
                {!modal.isContract && <div className="mb-4" />}

                {/* Loại yêu cầu */}
                <div className="mb-4">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Loại yêu cầu</p>
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
                                            ? 'border-red-400/30 bg-red-400/10 text-red-300'
                                            : 'border-amber-400/30 bg-amber-400/10 text-amber-300'
                                        : 'border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-white'
                                }`}>
                                <span className="material-symbols-outlined text-[18px]">{icon}</span>
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {(
                    <div className="mb-5">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Lý do / chi tiết</p>
                        <textarea
                            value={modal.message}
                            onChange={(e) => setModal((p) => ({ ...p, message: e.target.value }))}
                            rows={4}
                            maxLength={500}
                            placeholder={
                                modal.type === 'cancel'
                                    ? 'Vui lòng cho biết lý do hủy lịch...'
                                    : 'Nêu buổi/ngày muốn đổi và mong muốn của bạn để nhân viên hỗ trợ...'
                            }
                            className="user-input py-3 resize-none"
                        />
                        <div className="flex items-center justify-between mt-1">
                            {modal.message.trim().length > 0 && modal.message.trim().length < 10
                                ? <p className="text-[10px] text-red-300 font-semibold">Nhập ít nhất 10 ký tự ({10 - modal.message.trim().length} ký tự nữa)</p>
                                : <span />
                            }
                            <p className="text-[10px] text-zinc-500 ml-auto">{modal.message.length}/500</p>
                        </div>
                    </div>
                )}

                {modal.error && (
                    <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-400/40 text-red-300 text-xs font-medium flex items-start gap-1.5">
                        <span className="material-symbols-outlined text-[14px] mt-0.5">error</span>
                        <span>{modal.error}</span>
                    </div>
                )}

                <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setModal((p) => ({ ...p, isOpen: false }))}
                        className="px-4 py-2 text-sm font-semibold text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors">
                        Đóng
                    </button>
                    <button type="button" onClick={onSubmit}
                        disabled={modal.isSubmitting || modal.message.trim().length < 10}
                        className={`px-5 py-2 text-sm font-extrabold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                            modal.type === 'cancel'
                                ? 'text-white bg-red-600 hover:bg-red-400 shadow-sm'
                                : 'text-white bg-amber-600 hover:bg-amber-400 shadow-sm'
                        }`}>
                        {modal.isSubmitting ? 'Đang xử lý...' : 'Gửi yêu cầu'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

// ─── HIỆU ỨNG TẢI TRANG (SKELETON) ────────────────────────────────────────────
const SkeletonCard = () => (
    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden animate-pulse shadow-sm">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
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
        new_date: '', new_start: '', new_end: '', freeSlots: null, isContract: false, error: '',
    });
    const [myStats, setMyStats] = useState(null);

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

    // fetchData nhận tab hiện tại trực tiếp và không phụ thuộc state khác.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { fetchData(activeTab, 1); }, [activeTab]);

    // Thống kê số buổi của tài khoản (đã đặt / đã chơi / sắp tới / điểm)
    useEffect(() => {
        bookingService.getMyBookingStats()
            .then((res) => setMyStats(res.data?.data ?? null))
            .catch(() => {});
    }, []);

    const handlePageChange = (p) => {
        if (p >= 1 && p <= pagination.last_page) fetchData(activeTab, p);
    };

    const openReview = ({ booking_id, booking_code, court_id }) => {
        setReviewModal({ isOpen: true, booking_id, booking_code, court_id, rating: 5, comment: '', isSubmitting: false });
    };

    const handleRebook = (courtId) => {
        navigate(`/booking-page?courtId=${courtId}`);
    };

    const openRequest = ({ booking_code, isContract = false }) => {
        setRequestModal({
            isOpen: true, booking_code, type: isContract ? 'cancel' : 'change', message: '', isSubmitting: false,
            new_date: '', new_start: '', new_end: '', freeSlots: null, isContract, error: '',
        });
    };

    const submitRequest = async () => {
        if (requestModal.message.trim().length < 10) return;
        setRequestModal((p) => ({ ...p, isSubmitting: true, error: '' }));
        try {
            // Mọi yêu cầu (đổi hoặc hủy, đơn lẻ hoặc hợp đồng) đều GỬI TỚI NHÂN VIÊN
            // duyệt — khách không tự sửa lịch trực tiếp để bên quản lý kiểm soát được.
            await bookingService.sendRequest({
                booking_code: requestModal.booking_code,
                type: requestModal.type,
                message: requestModal.message,
            });
            setRequestModal((p) => ({ ...p, isOpen: false }));
            showFlash('success', 'Đã gửi yêu cầu. Nhân viên sẽ liên hệ bạn sớm nhất!');
        } catch (err) {
            const data = err.response?.data;
            // Lỗi (đơn trong vòng 24h, đã hủy/hoàn thành, không tìm thấy...) → hiện ngay trong modal
            setRequestModal((p) => ({ ...p, isSubmitting: false, error: data?.message || 'Không thể gửi yêu cầu.' }));
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
            <div className="user-page-container max-w-5xl py-10">

                {/* ─── PHẦN TIÊU ĐỀ ─── */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                    {/* Hero header */}
                    <div className="relative rounded-3xl border border-zinc-700 bg-zinc-900 px-8 py-7 mb-6 overflow-hidden shadow-sm">
                        {/* Subtle lime glow top-left */}
                        <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full bg-lime-400/[0.02] blur-3xl pointer-events-none" />
                        <div className="relative flex items-start justify-between gap-6">
                            <div className="flex-1">
                                <h1 className="text-3xl font-extrabold text-white tracking-tight">Lịch đặt sân</h1>
                                <p className="text-sm text-zinc-500 mt-1.5">Theo dõi toàn bộ lịch đặt sân của bạn.</p>
                                {/* Stats pills */}
                                {!isLoading && items.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-4">
                                        {singles.length > 0 && (
                                            <span className="text-[11px] font-semibold text-sky-300 bg-sky-400/10 border border-sky-400/30 px-3 py-1 rounded-full">
                                                {singles.length} đặt lẻ
                                            </span>
                                        )}
                                        {groups.filter((g) => g.group_type === 'recurring').length > 0 && (
                                            <span className="text-[11px] font-semibold text-purple-300 bg-purple-400/10 border border-purple-400/30 px-3 py-1 rounded-full">
                                                {groups.filter((g) => g.group_type === 'recurring').length} định kỳ
                                            </span>
                                        )}
                                        {groups.filter((g) => g.group_type === 'long_term').length > 0 && (
                                            <span className="text-[11px] font-semibold text-amber-300 bg-amber-400/10 border border-amber-400/30 px-3 py-1 rounded-full">
                                                {groups.filter((g) => g.group_type === 'long_term').length} dài hạn
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                            {!isLoading && pagination.total > 0 && (
                                <div className="text-right shrink-0 bg-zinc-900/60 border border-zinc-700 rounded-2xl px-5 py-3 shadow-sm">
                                    <p className="text-3xl font-extrabold text-white">{pagination.total}</p>
                                    <p className="text-[10px] text-zinc-500 font-medium mt-0.5">đơn / hợp đồng</p>
                                </div>
                            )}
                        </div>

                        {/* Thống kê số buổi của tài khoản */}
                        {myStats && (
                            <div className="relative grid grid-cols-2 sm:grid-cols-5 gap-2 mt-5 pt-5 border-t border-zinc-700">
                                {[
                                    { label: 'Tổng số buổi', value: myStats.total_sessions,     color: 'text-white' },
                                    { label: 'Đã chơi',      value: myStats.played_sessions,    color: 'text-lime-500' },
                                    { label: 'Sắp tới',      value: myStats.upcoming_sessions,  color: 'text-lime-500' },
                                    { label: 'Đã hủy',       value: myStats.cancelled_sessions, color: 'text-red-300' },
                                    { label: 'Điểm tích lũy', value: myStats.points,            color: 'text-amber-300' },
                                ].map((s) => (
                                    <div key={s.label} className="bg-zinc-900/60 border border-zinc-700 rounded-xl px-3 py-2.5 text-center shadow-sm">
                                        <p className={`text-xl font-extrabold ${s.color}`}>{s.value}</p>
                                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">{s.label}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* ─── PHẦN ĐIỀU HƯỚNG TAB ─── */}
                <div className="flex items-center justify-between gap-3 mb-6 border-b border-zinc-700 flex-wrap">
                    <div className="flex items-center gap-1">
                        {tabs.map((tab) => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition-colors ${activeTab === tab.id ? 'text-white font-extrabold' : 'text-zinc-500 hover:text-zinc-300'}`}>
                                <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                                {tab.label}
                                {activeTab === tab.id && (
                                    <motion.div layoutId="historyUnderline"
                                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-lime-500"
                                        transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Tìm kiếm nhanh theo mã đơn / tên sân */}
                    {!isLoading && items.length > 0 && (
                        <div className="relative mb-2">
                            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[15px] text-zinc-500">search</span>
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
                                    ? 'bg-lime-400/10 border-lime-400/30 text-lime-300'
                                    : 'bg-red-400/10 border-red-400/30 text-red-300'
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
                                <span className="material-symbols-outlined text-6xl text-zinc-300 mb-4 block">sports_tennis</span>
                                <p className="text-sm font-bold text-zinc-500">Không có dữ liệu</p>
                                <p className="text-xs text-zinc-500 mt-1">
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
                                <span className="material-symbols-outlined text-4xl text-zinc-300 mb-3 block">search_off</span>
                                <p className="text-sm font-bold text-zinc-500">Không tìm thấy kết quả phù hợp</p>
                                <p className="text-xs text-zinc-500 mt-1">Thử lại với mã đơn hoặc tên sân khác.</p>
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
                            className="px-3 py-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 disabled:text-zinc-300 disabled:cursor-not-allowed transition-colors">
                            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                        </button>
                        {Array.from({ length: pagination.last_page }, (_, i) => i + 1).map((p) => (
                            <button key={p} onClick={() => handlePageChange(p)}
                                className={`w-9 h-9 rounded-lg text-xs font-semibold transition-all ${
                                    p === pagination.current_page
                                        ? 'bg-lime-400/10 text-lime-500 font-bold border border-lime-400/30'
                                        : 'text-zinc-500 hover:text-white hover:bg-zinc-800'
                                }`}>
                                {p}
                            </button>
                        ))}
                        <button onClick={() => handlePageChange(pagination.current_page + 1)}
                            disabled={pagination.current_page === pagination.last_page}
                            className="px-3 py-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 disabled:text-zinc-300 disabled:cursor-not-allowed transition-colors">
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
