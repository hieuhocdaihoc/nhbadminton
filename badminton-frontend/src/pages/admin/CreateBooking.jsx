import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { adminBookingService } from '../../services/admin/bookingService';
import { bookingService } from '../../services/user/bookingService';
import axiosClient from '../../services/axiosClient';

const STEPS = ['Chọn sân & giờ', 'Thông tin khách', 'Xác nhận'];

const fmt = (n) => Number(n).toLocaleString('vi-VN');

const CreateBooking = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(0);

    // Step 0
    const [courts, setCourts] = useState([]);
    const [selectedCourt, setSelectedCourt] = useState(null);
    const [bookingDate, setBookingDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [slots, setSlots] = useState([]);
    const [selectedSlots, setSelectedSlots] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);

    // Step 1
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [note, setNote] = useState('');
    const [promoCode, setPromoCode] = useState('');
    const [promoPreview, setPromoPreview] = useState(null);
    const [promoError, setPromoError] = useState('');

    // Submit
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Load courts, auto-select first
    useEffect(() => {
        adminBookingService.getAllCourts().then((res) => {
            const list = res.data?.data || res.data || [];
            const arr = Array.isArray(list) ? list : [];
            setCourts(arr);
            if (arr.length > 0) setSelectedCourt(arr[0]);
        }).catch(() => {});
    }, []);

    // Load slots when court + date change
    const loadSlots = useCallback(async () => {
        if (!selectedCourt || !bookingDate) return;
        setLoadingSlots(true);
        setSelectedSlots([]);
        try {
            const res = await axiosClient.get(`/courts/${selectedCourt.id}/availability`, {
                params: { date: bookingDate, mode: 'grid' },
            });
            const data = res.data?.data || [];
            setSlots(Array.isArray(data) ? data : []);
        } catch {
            setSlots([]);
        } finally {
            setLoadingSlots(false);
        }
    }, [selectedCourt, bookingDate]);

    useEffect(() => { loadSlots(); }, [loadSlots]);

    const toggleSlot = (slot) => {
        if (!slot.is_available) return;
        setSelectedSlots((prev) =>
            prev.some((s) => s.start_time === slot.start_time)
                ? prev.filter((s) => s.start_time !== slot.start_time)
                : [...prev, slot],
        );
    };

    const totalPrice = selectedSlots.reduce((sum, s) => sum + Number(s.price || 0), 0);
    const discount = promoPreview?.discount_amount || 0;
    const finalPrice = Math.max(0, totalPrice - discount);

    const validatePromo = async () => {
        if (!promoCode.trim()) return;
        setPromoError('');
        try {
            const res = await bookingService.validatePromotion({
                promotion_code: promoCode.trim(),
                total_amount: totalPrice,
            });
            setPromoPreview(res.data?.data || null);
        } catch (err) {
            setPromoPreview(null);
            setPromoError(err.response?.data?.message || 'Mã không hợp lệ');
        }
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setError('');
        try {
            const sortedSlots = [...selectedSlots].sort((a, b) =>
                a.start_time.localeCompare(b.start_time),
            );
            const payload = {
                court_id: selectedCourt.id,
                booking_type: 'single',
                customer_name: customerName.trim(),
                customer_phone: customerPhone.trim(),
                note: note.trim() || undefined,
                is_prepaid: false,
                total_amount: finalPrice,
                promotion_code: promoCode.trim() || undefined,
                slots: sortedSlots.map((s) => ({
                    date: bookingDate,
                    start: s.start_time,
                    end: s.end_time,
                })),
            };
            await bookingService.createBooking(payload);
            navigate('/admin/bookings/today');
        } catch (err) {
            setError(err.response?.data?.message || 'Tạo đơn thất bại, vui lòng thử lại.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // ─── HIỂN THỊ GIAO DIỆN ───────────────────────────────────────────────────

    return (
        <div className="mx-auto max-w-3xl">
            {/* Thanh tiến trình */}
            <div className="mb-8 flex items-center gap-0">
                {STEPS.map((label, i) => (
                    <div key={i} className="flex flex-1 items-center">
                        <div className={`admin-step-circle ${
                            i < step ? 'admin-step-completed'
                            : i === step ? 'admin-step-active'
                            : 'admin-step-pending'
                        }`}>
                            {i < step ? '✓' : i + 1}
                        </div>
                        <span className={`ml-2 text-sm font-semibold ${i === step ? 'text-zinc-900' : 'text-zinc-400'}`}>
                            {label}
                        </span>
                        {i < STEPS.length - 1 && <div className="mx-4 flex-1 h-px bg-zinc-200" />}
                    </div>
                ))}
            </div>

            <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>

                {/* ── BƯỚC 0: Chọn sân & giờ ── */}
                {step === 0 && (
                    <div className="space-y-6">
                        <div className="admin-card p-6">
                            <h2 className="mb-5 text-base font-black text-slate-950">Chọn sân và ngày</h2>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Sân</label>
                                    <select
                                        value={selectedCourt?.id || ''}
                                        onChange={(e) => {
                                            const c = courts.find((x) => x.id === e.target.value);
                                            setSelectedCourt(c || null);
                                        }}
                                        className="admin-input w-full px-3 py-2.5 text-sm"
                                    >
                                        <option value="">-- Chọn sân --</option>
                                        {courts.map((c) => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Ngày</label>
                                    <input
                                        type="date"
                                        value={bookingDate}
                                        min={new Date().toISOString().slice(0, 10)}
                                        onChange={(e) => setBookingDate(e.target.value)}
                                        className="admin-input w-full px-3 py-2.5 text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        {selectedCourt && bookingDate && (
                            <div className="admin-card p-6">
                                <h2 className="mb-5 text-base font-black text-slate-950">
                                    Chọn khung giờ
                                    {selectedSlots.length > 0 && (
                                        <span className="ml-2 text-sm font-semibold text-emerald-600">
                                            ({selectedSlots.length} giờ · {fmt(totalPrice)} đ)
                                        </span>
                                    )}
                                </h2>

                                {loadingSlots ? (
                                    <div className="py-10 text-center">
                                        <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" />
                                        <p className="mt-3 text-xs text-slate-400">Đang tải lịch trống...</p>
                                    </div>
                                ) : slots.length === 0 ? (
                                    <p className="py-10 text-center text-sm text-slate-400">Không có khung giờ trống trong ngày này.</p>
                                ) : (
                                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                                        {slots.map((slot) => {
                                            const isSelected = selectedSlots.some((s) => s.start_time === slot.start_time);
                                            const unavailable = !slot.is_available;
                                            return (
                                                <button
                                                    key={slot.start_time}
                                                    type="button"
                                                    disabled={unavailable}
                                                    onClick={() => toggleSlot(slot)}
                                                    className={`admin-slot-btn ${
                                                        unavailable
                                                            ? 'slot-unavailable'
                                                            : isSelected
                                                            ? 'slot-selected'
                                                            : 'slot-available'
                                                    }`}
                                                >
                                                    <p className={`text-xs font-black ${isSelected ? 'text-emerald-700' : 'text-slate-800'}`}>
                                                        {slot.start_time}
                                                    </p>
                                                    <p className={`mt-0.5 text-[10px] font-semibold ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                        {fmt(slot.price)} đ
                                                    </p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex justify-end">
                            <button
                                type="button"
                                disabled={selectedSlots.length === 0}
                                onClick={() => setStep(1)}
                                className="admin-btn-secondary px-6 py-2.5 text-sm font-black disabled:opacity-40"
                            >
                                Tiếp theo →
                            </button>
                        </div>
                    </div>
                )}

                {/* ── BƯỚC 1: Thông tin khách ── */}
                {step === 1 && (
                    <div className="space-y-6">
                        <div className="admin-card p-6">
                            <h2 className="mb-5 text-base font-black text-slate-950">Thông tin khách hàng</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">
                                        Họ tên <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Nguyễn Văn A"
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                        className="admin-input w-full px-3 py-2.5 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">
                                        Số điện thoại <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="tel"
                                        placeholder="0912345678"
                                        value={customerPhone}
                                        onChange={(e) => setCustomerPhone(e.target.value)}
                                        className="admin-input w-full px-3 py-2.5 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Ghi chú</label>
                                    <textarea
                                        rows={2}
                                        placeholder="Ghi chú thêm nếu có..."
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                        className="admin-input w-full resize-none px-3 py-2.5 text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="admin-card p-6">
                            <h2 className="mb-4 text-base font-black text-slate-950">Mã khuyến mãi (tuỳ chọn)</h2>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Nhập mã giảm giá..."
                                    value={promoCode}
                                    onChange={(e) => { setPromoCode(e.target.value); setPromoPreview(null); setPromoError(''); }}
                                    onKeyDown={(e) => e.key === 'Enter' && validatePromo()}
                                    className="admin-input flex-1 px-3 py-2.5 text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={validatePromo}
                                    className="admin-btn-outline px-4 py-2.5 text-sm font-bold"
                                >
                                    Áp dụng
                                </button>
                            </div>
                            {promoError && <p className="mt-2 text-xs font-semibold text-red-500">{promoError}</p>}
                            {promoPreview && (
                                <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5">
                                    <p className="text-xs font-bold text-emerald-700">
                                        ✓ Giảm {fmt(promoPreview.discount_amount)} đ — {promoPreview.promotion_name}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-between">
                            <button type="button" onClick={() => setStep(0)} className="admin-btn-outline px-5 py-2.5 text-sm font-bold">
                                ← Quay lại
                            </button>
                            <button
                                type="button"
                                disabled={!customerName.trim() || !customerPhone.trim()}
                                onClick={() => setStep(2)}
                                className="admin-btn-secondary px-6 py-2.5 text-sm font-black disabled:opacity-40"
                            >
                                Tiếp theo →
                            </button>
                        </div>
                    </div>
                )}

                {/* ── BƯỚC 2: Xác nhận ── */}
                {step === 2 && (
                    <div className="space-y-6">
                        <div className="admin-card p-6">
                            <h2 className="mb-5 text-base font-black text-slate-950">Xác nhận đơn đặt sân</h2>

                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between border-b border-slate-100 pb-3">
                                    <span className="font-semibold text-slate-500">Sân</span>
                                    <span className="font-bold text-slate-900">{selectedCourt?.name}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-100 pb-3">
                                    <span className="font-semibold text-slate-500">Ngày</span>
                                    <span className="font-bold text-slate-900">{bookingDate}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-100 pb-3">
                                    <span className="font-semibold text-slate-500">Khung giờ</span>
                                    <div className="text-right">
                                        {[...selectedSlots]
                                            .sort((a, b) => a.start_time.localeCompare(b.start_time))
                                            .map((s) => (
                                                <p key={s.start_time} className="font-bold text-slate-900">
                                                    {s.start_time} – {s.end_time}
                                                </p>
                                            ))}
                                    </div>
                                </div>
                                <div className="flex justify-between border-b border-slate-100 pb-3">
                                    <span className="font-semibold text-slate-500">Khách hàng</span>
                                    <span className="font-bold text-slate-900">{customerName}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-100 pb-3">
                                    <span className="font-semibold text-slate-500">Số điện thoại</span>
                                    <span className="font-bold text-slate-900">{customerPhone}</span>
                                </div>
                                {note && (
                                    <div className="flex justify-between border-b border-slate-100 pb-3">
                                        <span className="font-semibold text-slate-500">Ghi chú</span>
                                        <span className="font-bold text-slate-900">{note}</span>
                                    </div>
                                )}
                                <div className="flex justify-between border-b border-slate-100 pb-3">
                                    <span className="font-semibold text-slate-500">Tiền sân</span>
                                    <span className="font-bold text-slate-900">{fmt(totalPrice)} đ</span>
                                </div>
                                {discount > 0 && (
                                    <div className="flex justify-between border-b border-slate-100 pb-3">
                                        <span className="font-semibold text-emerald-600">Giảm giá</span>
                                        <span className="font-bold text-emerald-600">− {fmt(discount)} đ</span>
                                    </div>
                                )}
                                <div className="flex justify-between pt-1">
                                    <span className="text-base font-black text-slate-950">Tổng cộng</span>
                                    <span className="text-base font-black text-emerald-600">{fmt(finalPrice)} đ</span>
                                </div>
                            </div>

                            <div className="mt-5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                                <p className="text-xs font-bold text-amber-700">
                                    Đơn sẽ được tạo với trạng thái <strong>Chờ thanh toán</strong>.
                                    Thu tiền mặt vào cuối giờ chơi qua nút "Thu tiền".
                                </p>
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                                <p className="text-sm font-bold text-red-600">{error}</p>
                            </div>
                        )}

                        <div className="flex justify-between">
                            <button type="button" onClick={() => setStep(1)} className="admin-btn-outline px-5 py-2.5 text-sm font-bold">
                                ← Quay lại
                            </button>
                            <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={handleSubmit}
                                className="admin-btn-primary px-8 py-2.5 text-sm font-black disabled:opacity-50"
                            >
                                {isSubmitting ? 'Đang tạo...' : 'Tạo đơn'}
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default CreateBooking;
