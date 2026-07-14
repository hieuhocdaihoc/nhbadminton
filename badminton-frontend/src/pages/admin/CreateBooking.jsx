import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { adminBookingService } from '../../services/admin/bookingService';
import { bookingService } from '../../services/user/bookingService';
import { adminUserService } from '../../services/admin/adminUserService';
import axiosClient from '../../services/axiosClient';

const STEPS = ['Chọn sân & lịch', 'Thông tin khách', 'Xác nhận'];
const fmt = (n) => Number(n).toLocaleString('vi-VN');

const TIME_OPTIONS = Array.from({ length: 33 }, (_, i) => {
    const m = 6 * 60 + i * 30;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
});

const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

const todayStr = new Date().toISOString().slice(0, 10);
const in30Days = () => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); };

const CreateBooking = () => {
    const navigate = useNavigate();
    const [bookingType, setBookingType] = useState('single');
    const [step, setStep] = useState(0);

    // Shared
    const [courts, setCourts] = useState([]);
    const [selectedCourt, setSelectedCourt] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Single
    const [bookingDate, setBookingDate] = useState(todayStr);
    const [slots, setSlots] = useState([]);
    const [selectedSlots, setSelectedSlots] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);

    // Recurring
    const [rcStartDate, setRcStartDate] = useState(todayStr);
    const [rcEndDate, setRcEndDate] = useState(in30Days);
    const [rcStartTime, setRcStartTime] = useState('08:00');
    const [rcEndTime, setRcEndTime] = useState('09:00');
    const [rcDaysOfWeek, setRcDaysOfWeek] = useState([]);

    // Long term
    const [ltStartDate, setLtStartDate] = useState(todayStr);
    const [ltEndDate, setLtEndDate] = useState(in30Days);
    const [ltStartTime, setLtStartTime] = useState('08:00');
    const [ltEndTime, setLtEndTime] = useState('09:00');
    const [ltSelectedDates, setLtSelectedDates] = useState([]);

    // Customer (step 1)
    const [hasAccount, setHasAccount] = useState(false);
    const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
    const [customerSearch, setCustomerSearch] = useState('');
    const [customerResults, setCustomerResults] = useState([]);
    const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const pickerRef = useRef(null);
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [note, setNote] = useState('');

    // Single promo + prepaid
    const [promoCode, setPromoCode] = useState('');
    const [promoPreview, setPromoPreview] = useState(null);
    const [promoError, setPromoError] = useState('');
    const [prepaidAmount, setPrepaidAmount] = useState('');

    // Recurring/long_term payment
    const [staffPaymentConfirmed, setStaffPaymentConfirmed] = useState(false);

    const resetCustomer = () => {
        setSelectedCustomer(null);
        setCustomerName('');
        setCustomerPhone('');
        setCustomerSearch('');
        setCustomerResults([]);
        setCustomerPickerOpen(false);
    };

    // Close picker when clicking outside
    useEffect(() => {
        const handler = (e) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target)) {
                setCustomerPickerOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleChangeBookingType = (type) => {
        setBookingType(type);
        setStep(0);
        setSelectedSlots([]);
        setHasAccount(false);
        resetCustomer();
        setNote('');
        setPromoCode('');
        setPromoPreview(null);
        setPromoError('');
        setPrepaidAmount('');
        setStaffPaymentConfirmed(false);
        setError('');
    };

    // Computed — single
    const totalPrice = selectedSlots.reduce((s, sl) => s + Number(sl.price || 0), 0);
    const discount = promoPreview?.discount_amount || 0;
    const finalPrice = Math.max(0, totalPrice - discount);
    const prepaidValue = Math.min(Math.max(0, Number(prepaidAmount) || 0), finalPrice);
    const remainingAtCheckout = Math.max(0, finalPrice - prepaidValue);
    // Chính sách "không giữ sân 0 đồng": đơn lẻ tại quầy phải thu trước tối thiểu 20%
    const minPrepaid = Math.ceil(finalPrice * 0.2);

    // Computed — recurring
    const rcSessionCount = useMemo(() => {
        if (!rcStartDate || !rcEndDate || rcDaysOfWeek.length === 0) return 0;
        const start = new Date(rcStartDate), end = new Date(rcEndDate);
        if (start > end) return 0;
        let count = 0;
        const cur = new Date(start);
        while (cur <= end) { if (rcDaysOfWeek.includes(cur.getDay())) count++; cur.setDate(cur.getDate() + 1); }
        return count;
    }, [rcStartDate, rcEndDate, rcDaysOfWeek]);

    // Computed — long_term
    const ltAllDates = useMemo(() => {
        if (!ltStartDate || !ltEndDate) return [];
        const start = new Date(ltStartDate), end = new Date(ltEndDate);
        if (start > end) return [];
        const dates = [];
        const cur = new Date(start);
        while (cur <= end) { dates.push(cur.toISOString().slice(0, 10)); cur.setDate(cur.getDate() + 1); }
        return dates;
    }, [ltStartDate, ltEndDate]);

    // Load courts
    useEffect(() => {
        adminBookingService.getAllCourts().then((res) => {
            const arr = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
            setCourts(arr);
            if (arr.length > 0) setSelectedCourt(arr[0]);
        }).catch(() => {});
    }, []);

    // Load single slots
    const loadSlots = useCallback(async () => {
        if (bookingType !== 'single' || !selectedCourt || !bookingDate) return;
        setLoadingSlots(true);
        setSelectedSlots([]);
        try {
            const res = await axiosClient.get(`/courts/${selectedCourt.id}/availability`, { params: { date: bookingDate, mode: 'grid' } });
            setSlots(Array.isArray(res.data?.data) ? res.data.data : []);
        } catch { setSlots([]); }
        finally { setLoadingSlots(false); }
    }, [bookingType, selectedCourt, bookingDate]);
    useEffect(() => { loadSlots(); }, [loadSlots]);

    // Customer search
    useEffect(() => {
        const needSearch = bookingType !== 'single' || hasAccount;
        if (!needSearch || !customerSearch.trim()) { setCustomerResults([]); return; }
        const t = setTimeout(async () => {
            setIsSearchingCustomer(true);
            try {
                const res = await adminUserService.getCustomers({ search: customerSearch.trim(), per_page: 8 });
                setCustomerResults(res.data?.data?.data || []);
            } catch { setCustomerResults([]); }
            finally { setIsSearchingCustomer(false); }
        }, 350);
        return () => clearTimeout(t);
    }, [customerSearch, hasAccount, bookingType]);

    const handleSelectCustomer = (c) => {
        setSelectedCustomer(c);
        setCustomerName(c.full_name || '');
        setCustomerPhone(c.phone || '');
        setCustomerResults([]);
        setCustomerSearch('');
    };

    const validatePromo = async () => {
        if (!promoCode.trim()) return;
        setPromoError('');
        try {
            const res = await bookingService.validatePromotion({ promotion_code: promoCode.trim(), total_amount: totalPrice });
            setPromoPreview(res.data?.data || null);
        } catch (err) { setPromoPreview(null); setPromoError(err.response?.data?.message || 'Mã không hợp lệ'); }
    };

    const toggleSlot = (slot) => {
        if (!slot.is_available) return;
        setSelectedSlots((prev) =>
            prev.some((s) => s.start_time === slot.start_time)
                ? prev.filter((s) => s.start_time !== slot.start_time)
                : [...prev, slot]
        );
    };

    const toggleRcDay = (day) => setRcDaysOfWeek((p) => p.includes(day) ? p.filter((d) => d !== day) : [...p, day]);
    const toggleLtDate = (date) => setLtSelectedDates((p) => p.includes(date) ? p.filter((d) => d !== date) : [...p, date]);

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setError('');
        let payload;
        try {
            if (bookingType === 'single') {
                const sorted = [...selectedSlots].sort((a, b) => a.start_time.localeCompare(b.start_time));
                payload = {
                    court_id: selectedCourt.id,
                    booking_type: 'single',
                    customer_name: customerName.trim(),
                    customer_phone: customerPhone.trim(),
                    note: note.trim() || undefined,
                    is_prepaid: false,
                    total_amount: finalPrice,
                    promotion_code: promoCode.trim() || undefined,
                    prepaid_amount: prepaidValue > 0 ? prepaidValue : undefined,
                    on_behalf_of_user_id: selectedCustomer ? selectedCustomer.id : undefined,
                    slots: sorted.map((s) => ({ date: bookingDate, start: s.start_time, end: s.end_time })),
                };
            } else if (bookingType === 'recurring') {
                payload = {
                    court_id: selectedCourt.id,
                    booking_type: 'recurring',
                    customer_name: customerName.trim(),
                    customer_phone: customerPhone.trim(),
                    note: note.trim() || undefined,
                    on_behalf_of_user_id: selectedCustomer.id,
                    staff_payment_confirmed: staffPaymentConfirmed,
                    start_date: rcStartDate,
                    end_date: rcEndDate,
                    start_time: rcStartTime,
                    end_time: rcEndTime,
                    days_of_week: rcDaysOfWeek,
                };
            } else {
                payload = {
                    court_id: selectedCourt.id,
                    booking_type: 'long_term',
                    customer_name: customerName.trim(),
                    customer_phone: customerPhone.trim(),
                    note: note.trim() || undefined,
                    on_behalf_of_user_id: selectedCustomer.id,
                    staff_payment_confirmed: staffPaymentConfirmed,
                    lt_start_date: ltStartDate,
                    lt_end_date: ltEndDate,
                    lt_start_time: ltStartTime,
                    lt_end_time: ltEndTime,
                    specific_dates: ltSelectedDates,
                };
            }
            await bookingService.createBooking(payload);
            navigate('/admin/bookings/today');
        } catch (err) {
            // 409: một số buổi trùng lịch — backend đề xuất đổi sân / bỏ buổi, cần xác nhận
            if (err.response?.status === 409 && err.response.data?.data) {
                const { moved = [], unavailable = [], playable_count: playableCount = 0 } = err.response.data.data;
                const lines = [];
                if (moved.length > 0) {
                    lines.push('Các buổi sau bị trùng lịch, sẽ ĐỔI sang sân khác còn trống:');
                    moved.forEach((m) => lines.push(`  • ${m.date} → ${m.court_name}`));
                }
                if (unavailable.length > 0) {
                    lines.push('Các ngày sau KHÔNG còn sân nào trống, sẽ KHÔNG đặt:');
                    unavailable.forEach((d) => lines.push(`  • ${d}`));
                }
                lines.push('', `Tổng cộng sẽ đặt ${playableCount} buổi. Tiếp tục?`);
                if (window.confirm(lines.join('\n'))) {
                    try {
                        await bookingService.createBooking({ ...payload, accept_adjustments: true });
                        navigate('/admin/bookings/today');
                        return;
                    } catch (err2) {
                        setError(err2.response?.data?.message || 'Tạo đơn thất bại, vui lòng thử lại.');
                    }
                }
            } else {
                setError(err.response?.data?.message || 'Tạo đơn thất bại, vui lòng thử lại.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const step0Valid =
        bookingType === 'single' ? selectedSlots.length > 0
        : bookingType === 'recurring' ? (selectedCourt && rcStartDate && rcEndDate && rcDaysOfWeek.length > 0 && rcSessionCount > 0)
        : (selectedCourt && ltStartDate && ltEndDate && ltSelectedDates.length > 0);

    const step1Valid =
        bookingType === 'single'
            ? (customerName.trim() && customerPhone.trim() && !(hasAccount && !selectedCustomer))
            : (!!selectedCustomer);

    const step2Valid = bookingType === 'single'
        ? (finalPrice <= 0 || prepaidValue >= minPrepaid)
        : staffPaymentConfirmed;

    // ─── RENDER ───────────────────────────────────────────────────

    return (
        <div className="mx-auto max-w-3xl">
            {/* Booking type selector */}
            <div className="mb-6 flex gap-1.5 rounded-2xl bg-slate-100 p-1.5">
                {[
                    { type: 'single', label: 'Vãng lai' },
                    { type: 'recurring', label: 'Định kỳ' },
                    { type: 'long_term', label: 'Dài hạn' },
                ].map((t) => (
                    <button
                        key={t.type}
                        type="button"
                        onClick={() => handleChangeBookingType(t.type)}
                        disabled={step > 0}
                        className={`flex-1 rounded-xl py-2 text-sm font-black transition disabled:pointer-events-none ${
                            bookingType === t.type ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Step indicator */}
            <div className="mb-8 flex items-center gap-0">
                {STEPS.map((label, i) => (
                    <div key={i} className="flex flex-1 items-center">
                        <div className={`admin-step-circle ${i < step ? 'admin-step-completed' : i === step ? 'admin-step-active' : 'admin-step-pending'}`}>
                            {i < step ? '✓' : i + 1}
                        </div>
                        <span className={`ml-2 text-sm font-semibold ${i === step ? 'text-zinc-900' : 'text-zinc-400'}`}>{label}</span>
                        {i < STEPS.length - 1 && <div className="mx-4 flex-1 h-px bg-zinc-200" />}
                    </div>
                ))}
            </div>

            <motion.div key={`${bookingType}-${step}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>

                {/* ── STEP 0 ── */}
                {step === 0 && (
                    <div className="space-y-6">

                        {/* SINGLE */}
                        {bookingType === 'single' && (
                            <>
                                <div className="admin-card p-6">
                                    <h2 className="mb-5 text-base font-black text-slate-950">Chọn sân và ngày</h2>
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <div>
                                            <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Sân</label>
                                            <select value={selectedCourt?.id || ''} onChange={(e) => setSelectedCourt(courts.find((c) => c.id === e.target.value) || null)} className="admin-input w-full px-3 py-2.5 text-sm">
                                                <option value="">-- Chọn sân --</option>
                                                {courts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Ngày</label>
                                            <input type="date" value={bookingDate} min={todayStr} onChange={(e) => setBookingDate(e.target.value)} className="admin-input w-full px-3 py-2.5 text-sm" />
                                        </div>
                                    </div>
                                </div>

                                {selectedCourt && bookingDate && (
                                    <div className="admin-card p-6">
                                        <h2 className="mb-5 text-base font-black text-slate-950">
                                            Chọn khung giờ
                                            {selectedSlots.length > 0 && <span className="ml-2 text-sm font-semibold text-emerald-600">({selectedSlots.length} giờ · {fmt(totalPrice)} đ)</span>}
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
                                                    const sel = selectedSlots.some((s) => s.start_time === slot.start_time);
                                                    return (
                                                        <button key={slot.start_time} type="button" disabled={!slot.is_available} onClick={() => toggleSlot(slot)}
                                                            className={`admin-slot-btn ${!slot.is_available ? 'slot-unavailable' : sel ? 'slot-selected' : 'slot-available'}`}>
                                                            <p className={`text-xs font-black ${sel ? 'text-emerald-700' : 'text-slate-800'}`}>{slot.start_time}</p>
                                                            <p className={`mt-0.5 text-[10px] font-semibold ${sel ? 'text-emerald-600' : 'text-slate-400'}`}>{fmt(slot.price)} đ</p>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}

                        {/* RECURRING */}
                        {bookingType === 'recurring' && (
                            <>
                                <div className="admin-card p-6">
                                    <h2 className="mb-5 text-base font-black text-slate-950">Chọn sân và khung giờ</h2>
                                    <div className="mb-4">
                                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Sân</label>
                                        <select value={selectedCourt?.id || ''} onChange={(e) => setSelectedCourt(courts.find((c) => c.id === e.target.value) || null)} className="admin-input w-full px-3 py-2.5 text-sm">
                                            <option value="">-- Chọn sân --</option>
                                            {courts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Giờ bắt đầu</label>
                                            <select value={rcStartTime} onChange={(e) => { setRcStartTime(e.target.value); if (rcEndTime <= e.target.value) setRcEndTime(TIME_OPTIONS.find((t) => t > e.target.value) || '22:00'); }} className="admin-input w-full px-3 py-2.5 text-sm">
                                                {TIME_OPTIONS.slice(0, -1).map((t) => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Giờ kết thúc</label>
                                            <select value={rcEndTime} onChange={(e) => setRcEndTime(e.target.value)} className="admin-input w-full px-3 py-2.5 text-sm">
                                                {TIME_OPTIONS.filter((t) => t > rcStartTime).map((t) => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="admin-card p-6">
                                    <h2 className="mb-5 text-base font-black text-slate-950">Khoảng thời gian và lịch lặp</h2>
                                    <div className="grid grid-cols-2 gap-4 mb-5">
                                        <div>
                                            <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Ngày bắt đầu</label>
                                            <input type="date" value={rcStartDate} min={todayStr} onChange={(e) => setRcStartDate(e.target.value)} className="admin-input w-full px-3 py-2.5 text-sm" />
                                        </div>
                                        <div>
                                            <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Ngày kết thúc</label>
                                            <input type="date" value={rcEndDate} min={rcStartDate} onChange={(e) => setRcEndDate(e.target.value)} className="admin-input w-full px-3 py-2.5 text-sm" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="mb-3 block text-xs font-bold uppercase tracking-widest text-slate-500">Các thứ trong tuần <span className="text-red-400">*</span></label>
                                        <div className="flex gap-1.5">
                                            {DAY_LABELS.map((label, day) => (
                                                <button key={day} type="button" onClick={() => toggleRcDay(day)}
                                                    className={`flex-1 rounded-xl py-2 text-xs font-black transition ${rcDaysOfWeek.includes(day) ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {rcSessionCount > 0 && (
                                        <div className="mt-4 rounded-xl bg-blue-50 border border-blue-200 px-3 py-2.5">
                                            <p className="text-xs font-bold text-blue-700">Tổng {rcSessionCount} buổi trong hợp đồng · {rcStartTime}–{rcEndTime}</p>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* LONG TERM */}
                        {bookingType === 'long_term' && (
                            <>
                                <div className="admin-card p-6">
                                    <h2 className="mb-5 text-base font-black text-slate-950">Chọn sân và khung giờ</h2>
                                    <div className="mb-4">
                                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Sân</label>
                                        <select value={selectedCourt?.id || ''} onChange={(e) => setSelectedCourt(courts.find((c) => c.id === e.target.value) || null)} className="admin-input w-full px-3 py-2.5 text-sm">
                                            <option value="">-- Chọn sân --</option>
                                            {courts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Giờ bắt đầu</label>
                                            <select value={ltStartTime} onChange={(e) => { setLtStartTime(e.target.value); if (ltEndTime <= e.target.value) setLtEndTime(TIME_OPTIONS.find((t) => t > e.target.value) || '22:00'); }} className="admin-input w-full px-3 py-2.5 text-sm">
                                                {TIME_OPTIONS.slice(0, -1).map((t) => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Giờ kết thúc</label>
                                            <select value={ltEndTime} onChange={(e) => setLtEndTime(e.target.value)} className="admin-input w-full px-3 py-2.5 text-sm">
                                                {TIME_OPTIONS.filter((t) => t > ltStartTime).map((t) => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="admin-card p-6">
                                    <h2 className="mb-5 text-base font-black text-slate-950">Khoảng ngày và chọn ngày cụ thể</h2>
                                    <div className="grid grid-cols-2 gap-4 mb-5">
                                        <div>
                                            <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Ngày bắt đầu</label>
                                            <input type="date" value={ltStartDate} min={todayStr} onChange={(e) => { setLtStartDate(e.target.value); setLtSelectedDates([]); }} className="admin-input w-full px-3 py-2.5 text-sm" />
                                        </div>
                                        <div>
                                            <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Ngày kết thúc</label>
                                            <input type="date" value={ltEndDate} min={ltStartDate} onChange={(e) => { setLtEndDate(e.target.value); setLtSelectedDates([]); }} className="admin-input w-full px-3 py-2.5 text-sm" />
                                        </div>
                                    </div>
                                    {ltAllDates.length > 0 && (
                                        <div>
                                            <div className="mb-3 flex items-center justify-between">
                                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Chọn ngày chơi <span className="text-red-400">*</span></label>
                                                <div className="flex gap-2">
                                                    <button type="button" onClick={() => setLtSelectedDates([...ltAllDates])} className="text-xs font-bold text-emerald-600 underline">Chọn tất cả</button>
                                                    <span className="text-slate-300">|</span>
                                                    <button type="button" onClick={() => setLtSelectedDates([])} className="text-xs font-bold text-slate-400 underline">Bỏ tất cả</button>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 max-h-60 overflow-y-auto pr-1">
                                                {ltAllDates.map((date) => {
                                                    const sel = ltSelectedDates.includes(date);
                                                    const dayName = DAY_LABELS[new Date(date + 'T00:00:00').getDay()];
                                                    return (
                                                        <button key={date} type="button" onClick={() => toggleLtDate(date)}
                                                            className={`rounded-xl px-2.5 py-1.5 text-xs font-bold transition ${sel ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                                                            <span className="opacity-60">{dayName} </span>{date.slice(5)}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            {ltSelectedDates.length > 0 && (
                                                <p className="mt-3 text-xs font-bold text-emerald-700">Đã chọn {ltSelectedDates.length} ngày · {ltStartTime}–{ltEndTime}</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        <div className="flex justify-end">
                            <button type="button" disabled={!step0Valid} onClick={() => setStep(1)} className="admin-btn-secondary px-6 py-2.5 text-sm font-black disabled:opacity-40">
                                Tiếp theo →
                            </button>
                        </div>
                    </div>
                )}

                {/* ── STEP 1: Thông tin khách ── */}
                {step === 1 && (
                    <div className="space-y-6">
                        <div className="admin-card p-6">
                            <h2 className="mb-5 text-base font-black text-slate-950">Thông tin khách hàng</h2>

                            {bookingType === 'single' && (
                                <div className="mb-4 flex gap-2">
                                    <button type="button" onClick={() => { setHasAccount(false); resetCustomer(); }}
                                        className={`flex-1 rounded-xl px-3 py-2 text-xs font-black uppercase tracking-widest transition ${!hasAccount ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                        Khách vãng lai
                                    </button>
                                    <button type="button" onClick={() => { setHasAccount(true); resetCustomer(); }}
                                        className={`flex-1 rounded-xl px-3 py-2 text-xs font-black uppercase tracking-widest transition ${hasAccount ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                        Khách đã có tài khoản
                                    </button>
                                </div>
                            )}

                            {bookingType !== 'single' && (
                                <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
                                    <p className="text-xs font-bold text-amber-700">Hợp đồng định kỳ/dài hạn yêu cầu chọn tài khoản khách hàng.</p>
                                </div>
                            )}

                            {(bookingType !== 'single' || hasAccount) && (
                                <div className="mb-4" ref={pickerRef}>
                                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Tài khoản khách hàng <span className="text-red-400">*</span></label>

                                    {/* Trigger button */}
                                    {!selectedCustomer ? (
                                        <button
                                            type="button"
                                            onClick={() => setCustomerPickerOpen((v) => !v)}
                                            className="admin-input flex w-full items-center justify-between px-3 py-2.5 text-sm text-slate-400"
                                        >
                                            <span>Chọn khách hàng...</span>
                                            <svg className={`h-4 w-4 transition-transform ${customerPickerOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </button>
                                    ) : (
                                        <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5">
                                            <div>
                                                <p className="text-sm font-bold text-emerald-800">{selectedCustomer.full_name}</p>
                                                <p className="text-xs text-emerald-600">{selectedCustomer.phone}{selectedCustomer.customer_code ? ` · ${selectedCustomer.customer_code}` : ''}</p>
                                            </div>
                                            <button type="button" onClick={() => { resetCustomer(); setCustomerPickerOpen(true); }} className="text-xs font-bold text-emerald-700 underline">Đổi</button>
                                        </div>
                                    )}

                                    {/* Dropdown panel */}
                                    {customerPickerOpen && !selectedCustomer && (
                                        <div className="relative z-20 mt-1">
                                            <div className="absolute w-full rounded-xl border border-slate-200 bg-white shadow-lg">
                                                <div className="p-2 border-b border-slate-100">
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        placeholder="Nhập số điện thoại hoặc tên..."
                                                        value={customerSearch}
                                                        onChange={(e) => setCustomerSearch(e.target.value)}
                                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                                                    />
                                                </div>
                                                <div className="max-h-52 overflow-y-auto">
                                                    {isSearchingCustomer && (
                                                        <p className="py-4 text-center text-xs text-slate-400">Đang tìm...</p>
                                                    )}
                                                    {!isSearchingCustomer && customerResults.length > 0 && customerResults.map((c) => (
                                                        <button type="button" key={c.id}
                                                            onClick={() => { handleSelectCustomer(c); setCustomerPickerOpen(false); }}
                                                            className="flex w-full flex-col items-start px-3 py-2.5 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0">
                                                            <span className="text-sm font-bold text-slate-900">{c.full_name}</span>
                                                            <span className="text-xs text-slate-500">{c.phone}{c.customer_code ? ` · ${c.customer_code}` : ''}</span>
                                                        </button>
                                                    ))}
                                                    {!isSearchingCustomer && customerSearch.trim() && customerResults.length === 0 && (
                                                        <p className="py-4 text-center text-xs text-slate-400">Không tìm thấy khách hàng phù hợp.</p>
                                                    )}
                                                    {!isSearchingCustomer && !customerSearch.trim() && customerResults.length === 0 && (
                                                        <p className="py-4 text-center text-xs text-slate-400">Nhập SĐT hoặc tên để tìm kiếm.</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="space-y-4">
                                <div>
                                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Họ tên <span className="text-red-400">*</span></label>
                                    <input type="text" placeholder="Nguyễn Văn A" value={customerName} disabled={!!selectedCustomer} onChange={(e) => setCustomerName(e.target.value)} className="admin-input w-full px-3 py-2.5 text-sm disabled:bg-slate-50 disabled:text-slate-500" />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Số điện thoại <span className="text-red-400">*</span></label>
                                    <input type="tel" placeholder="0912345678" value={customerPhone} disabled={!!selectedCustomer} onChange={(e) => setCustomerPhone(e.target.value)} className="admin-input w-full px-3 py-2.5 text-sm disabled:bg-slate-50 disabled:text-slate-500" />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Ghi chú</label>
                                    <textarea rows={2} placeholder="Ghi chú thêm nếu có..." value={note} onChange={(e) => setNote(e.target.value)} className="admin-input w-full resize-none px-3 py-2.5 text-sm" />
                                </div>
                            </div>
                        </div>

                        {bookingType === 'single' && (
                            <div className="admin-card p-6">
                                <h2 className="mb-4 text-base font-black text-slate-950">Mã khuyến mãi (tuỳ chọn)</h2>
                                <div className="flex gap-2">
                                    <input type="text" placeholder="Nhập mã giảm giá..." value={promoCode}
                                        onChange={(e) => { setPromoCode(e.target.value); setPromoPreview(null); setPromoError(''); }}
                                        onKeyDown={(e) => e.key === 'Enter' && validatePromo()}
                                        className="admin-input flex-1 px-3 py-2.5 text-sm" />
                                    <button type="button" onClick={validatePromo} className="admin-btn-outline px-4 py-2.5 text-sm font-bold">Áp dụng</button>
                                </div>
                                {promoError && <p className="mt-2 text-xs font-semibold text-red-500">{promoError}</p>}
                                {promoPreview && (
                                    <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5">
                                        <p className="text-xs font-bold text-emerald-700">✓ Giảm {fmt(promoPreview.discount_amount)} đ — {promoPreview.promotion_name}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex justify-between">
                            <button type="button" onClick={() => setStep(0)} className="admin-btn-outline px-5 py-2.5 text-sm font-bold">← Quay lại</button>
                            <button type="button" disabled={!step1Valid} onClick={() => setStep(2)} className="admin-btn-secondary px-6 py-2.5 text-sm font-black disabled:opacity-40">Tiếp theo →</button>
                        </div>
                    </div>
                )}

                {/* ── STEP 2: Xác nhận ── */}
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
                                    <span className="font-semibold text-slate-500">Loại</span>
                                    <span className="font-bold text-slate-900">{{ single: 'Vãng lai', recurring: 'Định kỳ', long_term: 'Dài hạn' }[bookingType]}</span>
                                </div>

                                {bookingType === 'single' && (
                                    <>
                                        <div className="flex justify-between border-b border-slate-100 pb-3">
                                            <span className="font-semibold text-slate-500">Ngày</span>
                                            <span className="font-bold text-slate-900">{bookingDate}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-slate-100 pb-3">
                                            <span className="font-semibold text-slate-500">Khung giờ</span>
                                            <div className="text-right">
                                                {[...selectedSlots].sort((a, b) => a.start_time.localeCompare(b.start_time)).map((s) => (
                                                    <p key={s.start_time} className="font-bold text-slate-900">{s.start_time} – {s.end_time}</p>
                                                ))}
                                            </div>
                                        </div>
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
                                        <div className="flex justify-between pt-1 pb-3">
                                            <span className="text-base font-black text-slate-950">Tổng cộng</span>
                                            <span className="text-base font-black text-emerald-600">{fmt(finalPrice)} đ</span>
                                        </div>
                                    </>
                                )}

                                {bookingType === 'recurring' && (
                                    <>
                                        <div className="flex justify-between border-b border-slate-100 pb-3">
                                            <span className="font-semibold text-slate-500">Khung giờ</span>
                                            <span className="font-bold text-slate-900">{rcStartTime} – {rcEndTime}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-slate-100 pb-3">
                                            <span className="font-semibold text-slate-500">Từ – Đến</span>
                                            <span className="font-bold text-slate-900">{rcStartDate} → {rcEndDate}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-slate-100 pb-3">
                                            <span className="font-semibold text-slate-500">Các thứ</span>
                                            <span className="font-bold text-slate-900">{[...rcDaysOfWeek].sort().map((d) => DAY_LABELS[d]).join(', ')}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-slate-100 pb-3">
                                            <span className="font-semibold text-slate-500">Tổng buổi</span>
                                            <span className="font-bold text-slate-900">{rcSessionCount} buổi</span>
                                        </div>
                                    </>
                                )}

                                {bookingType === 'long_term' && (
                                    <>
                                        <div className="flex justify-between border-b border-slate-100 pb-3">
                                            <span className="font-semibold text-slate-500">Khung giờ</span>
                                            <span className="font-bold text-slate-900">{ltStartTime} – {ltEndTime}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-slate-100 pb-3">
                                            <span className="font-semibold text-slate-500">Khoảng ngày</span>
                                            <span className="font-bold text-slate-900">{ltStartDate} → {ltEndDate}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-slate-100 pb-3">
                                            <span className="font-semibold text-slate-500">Tổng ngày</span>
                                            <span className="font-bold text-slate-900">{ltSelectedDates.length} ngày</span>
                                        </div>
                                    </>
                                )}

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
                            </div>

                            {/* Single: prepaid — bắt buộc thu tối thiểu 20% (không giữ sân 0 đồng) */}
                            {bookingType === 'single' && (
                                <>
                                    <div className="mt-5 border-t border-slate-100 pt-5">
                                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Khách trả trước tại quầy *</label>
                                        <div className="relative">
                                            <input type="number" min={minPrepaid} max={finalPrice} step="1000" placeholder={String(minPrepaid)} value={prepaidAmount} onChange={(e) => setPrepaidAmount(e.target.value)} className="admin-input w-full px-3 py-2.5 text-sm" />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">đ</span>
                                        </div>
                                        <p className="mt-1.5 text-[11px] text-slate-400">
                                            Tối thiểu <strong>{fmt(minPrepaid)} đ (20%)</strong> — tối đa {fmt(finalPrice)} đ. Hệ thống chỉ ghi nhận, không xử lý thanh toán.
                                        </p>
                                        <div className="mt-2 flex gap-2">
                                            <button type="button" onClick={() => setPrepaidAmount(String(minPrepaid))} className="admin-btn-outline px-2.5 py-1 text-[10px]">Thu 20% ({fmt(minPrepaid)} đ)</button>
                                            <button type="button" onClick={() => setPrepaidAmount(String(finalPrice))} className="admin-btn-outline px-2.5 py-1 text-[10px]">Thu đủ 100%</button>
                                        </div>
                                    </div>
                                    <div className={`mt-4 rounded-xl border px-4 py-3 ${prepaidValue >= minPrepaid ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                                        {prepaidValue >= minPrepaid ? (
                                            <p className="text-xs font-bold text-emerald-700">
                                                Đơn sẽ được tạo với trạng thái <strong>Đã xác nhận</strong>, ghi nhận trả trước {fmt(prepaidValue)} đ.
                                                {remainingAtCheckout > 0 ? ` Còn lại ${fmt(remainingAtCheckout)} đ thu cuối giờ.` : ' Đơn đã thanh toán đủ.'}
                                            </p>
                                        ) : (
                                            <p className="text-xs font-bold text-red-600">Chưa đạt mức thu tối thiểu 20% ({fmt(minPrepaid)} đ) — không thể tạo đơn giữ sân 0 đồng.</p>
                                        )}
                                    </div>
                                </>
                            )}

                            {/* Recurring/LongTerm: 100% confirmation */}
                            {bookingType !== 'single' && (
                                <div className="mt-5 border-t border-slate-100 pt-5">
                                    <label className="flex cursor-pointer items-start gap-3">
                                        <input type="checkbox" checked={staffPaymentConfirmed} onChange={(e) => setStaffPaymentConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
                                        <div>
                                            <p className="text-sm font-bold text-slate-900">Đã thu đủ 100% tại quầy</p>
                                            <p className="text-xs text-slate-400 mt-0.5">Xác nhận khách đã thanh toán toàn bộ giá trị hợp đồng bằng tiền mặt hoặc chuyển khoản riêng.</p>
                                        </div>
                                    </label>
                                    {!staffPaymentConfirmed && (
                                        <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
                                            <p className="text-xs font-bold text-amber-700">Hợp đồng định kỳ/dài hạn bắt buộc thanh toán 100%. Vui lòng xác nhận đã thu tiền trước khi tạo.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {error && (
                            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                                <p className="text-sm font-bold text-red-600">{error}</p>
                            </div>
                        )}

                        <div className="flex justify-between">
                            <button type="button" onClick={() => setStep(1)} className="admin-btn-outline px-5 py-2.5 text-sm font-bold">← Quay lại</button>
                            <button type="button" disabled={isSubmitting || !step2Valid} onClick={handleSubmit} className="admin-btn-primary px-8 py-2.5 text-sm font-black disabled:opacity-50">
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
