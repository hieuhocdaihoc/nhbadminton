import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { courtService } from '../../services/user/courtService';
import { bookingService } from '../../services/user/bookingService';

const BookingPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    // --- 1. LOGIC THỜI GIAN VIỆT NAM (KHÓA GIỜ QUÁ KHỨ) ---
    const now = new Date();
    const todayStr = now.toLocaleDateString('sv-SE');
    const currentHour = now.getHours().toString().padStart(2, '0');
    const currentMinute = now.getMinutes().toString().padStart(2, '0');
    const currentTimeStr = `${currentHour}:${currentMinute}`;

    const courtIdParam = searchParams.get('courtId');
    const rawDateParam = searchParams.get('date') || todayStr;
    const dateParam = rawDateParam < todayStr ? todayStr : rawDateParam;

    // --- 2. STATES DỮ LIỆU ---
    const [court, setCourt] = useState(null);
    const [slots, setSlots] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedSlots, setSelectedSlots] = useState([]);

    // --- 3. STATES NGHIỆP VỤ & BILLING ---
    const [bookingType, setBookingType] = useState('single');
    const [payLater, setPayLater] = useState(false);
    const [recurringRange, setRecurringRange] = useState({
        startDate: dateParam,
        endDate: new Date(new Date(dateParam).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    });
    const [customerForm, setCustomerForm] = useState({ fullName: '', phone: '', note: '' });
    const [errorMessage, setErrorMessage] = useState('');

    // --- TẢI DỮ LIỆU SÂN & LỊCH TRỐNG ---
    useEffect(() => {
        const fetchSystemConfig = async () => {
            if (!courtIdParam) { setErrorMessage('Thiếu mã định danh sân thi đấu.'); setIsLoading(false); return; }
            setIsLoading(true); setErrorMessage(''); setSelectedSlots([]);
            try {
                const [courtRes, availabilityRes] = await Promise.all([
                    courtService.getPublicCourtById(courtIdParam),
                    courtService.getCourtSlots(courtIdParam, dateParam)
                ]);
                setCourt(courtRes.data?.data || courtRes.data);
                setSlots(availabilityRes.data?.data || []);
                const storedUser = localStorage.getItem('current_user');
                if (storedUser) {
                    try {
                        const userObj = JSON.parse(storedUser);
                        setCustomerForm(f => ({ ...f, fullName: userObj.full_name || '', phone: userObj.phone || '' }));
                    } catch (e) { console.error("Lỗi parse user:", e); }
                }
            } catch (error) {
                console.error("Lỗi API:", error);
                setErrorMessage('Hệ thống bận hoặc API đang được bảo trì. Vui lòng thử lại sau.');
            } finally { setIsLoading(false); }
        };
        fetchSystemConfig();
    }, [courtIdParam, dateParam]);

    // --- THAO TÁC CHỌN/HỦY NHIỀU GIỜ ---
    const handleToggleSlot = (slot) => {
        setSelectedSlots(prev => {
            const exists = prev.some(s => s.time_slot === slot.time_slot);
            if (exists) return prev.filter(s => s.time_slot !== slot.time_slot);
            return [...prev, slot].sort((a, b) => a.start_time.localeCompare(b.start_time));
        });
    };

    // --- KẾT NỐI API CHỐT ĐẶT SÂN ---
    const handleFinalizeBooking = async (e) => {
        e.preventDefault();
        if (selectedSlots.length === 0) return alert('⚠️ Vui lòng chọn ít nhất một khung giờ trống!');
        setIsSubmitting(true);
        try {
            const isPrepaid = bookingType === 'recurring' ? true : !payLater;
            const totalAmount = selectedSlots.reduce((acc, s) => acc + Number(s.price), 0);
            let payload = {
                court_id: courtIdParam, booking_type: bookingType,
                customer_name: customerForm.fullName, customer_phone: customerForm.phone,
                note: customerForm.note || '', is_prepaid: isPrepaid, total_amount: totalAmount
            };
            if (bookingType === 'single') {
                payload.slots = selectedSlots.map(s => ({ date: dateParam, start: s.start_time, end: s.end_time }));
            } else {
                const sortedSlots = [...selectedSlots].sort((a, b) => a.start_time.localeCompare(b.start_time));
                payload.start_date = dateParam;
                payload.end_date = recurringRange.endDate;
                payload.start_time = sortedSlots[0].start_time;
                payload.end_time = sortedSlots[sortedSlots.length - 1].end_time;
                const jsDayOfWeek = new Date(dateParam).getDay();
                payload.day_of_week = jsDayOfWeek === 0 ? 7 : jsDayOfWeek;
            }
            const response = await bookingService.createBooking(payload);
            if (response.status === 201 || response.data?.status === 'success') {
                const responseData = response.data?.data || response.data;
                if (isPrepaid && responseData?.payment_url) {
                    alert('⏳ Đơn hàng đã khởi tạo thành công! Đang chuyển hướng sang cổng thanh toán...');
                    window.location.href = responseData.payment_url;
                } else {
                    alert('🎉 ' + (response.data?.message || 'Đặt sân thành công!'));
                    navigate('/booking-history');
                }
            }
        } catch (error) {
            console.error("Lỗi xử lý đặt sân:", error);
            alert('❌ ' + (error.response?.data?.message || 'Thao tác thất bại, vui lòng kiểm tra lại!'));
        } finally { setIsSubmitting(false); }
    };

    const morningSlots = slots.filter(s => s.start_time < '12:00');
    const afternoonSlots = slots.filter(s => s.start_time >= '12:00' && s.start_time < '18:00');
    const eveningSlots = slots.filter(s => s.start_time >= '18:00');
    const totalPrice = selectedSlots.reduce((acc, s) => acc + Number(s.price), 0);

    const inputClass = "w-full px-4 py-3.5 bg-zinc-800/60 border border-zinc-700/60 rounded-2xl text-sm font-medium text-white placeholder-zinc-500 focus:outline-none focus:border-lime-400 focus:shadow-[0_0_12px_rgba(163,230,53,0.2)] transition-all duration-300";

    return (
        <div className="bg-zinc-950 min-h-screen py-10 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-lime-500/[0.03] rounded-full blur-3xl pointer-events-none" />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

                {/* Back */}
                <button onClick={() => navigate('/#courts')}
                    className="inline-flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-lime-400 mb-8 transition-colors uppercase tracking-widest">
                    ← Trở về sơ đồ sân
                </button>

                {errorMessage && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                        className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold rounded-2xl">{errorMessage}</motion.div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* ═══ CỘT TRÁI: BẢNG LỊCH TRÌNH ═══ */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Court Info + Date Picker */}
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                            className="bg-zinc-900/60 border border-zinc-800 p-6 rounded-3xl flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-lime-500 to-emerald-500 text-zinc-950 flex items-center justify-center font-black text-xl shadow-lg shadow-lime-500/20">🏸</div>
                                <div>
                                    <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">{court?.name || 'Đang tải...'}</h1>
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{court?.floor_type || 'Thảm tiêu chuẩn BWF'}</p>
                                </div>
                            </div>
                            <div className="bg-zinc-800/80 p-2 rounded-2xl border border-zinc-700/50 flex items-center gap-3">
                                <span className="text-[10px] font-bold text-zinc-500 uppercase ml-2 whitespace-nowrap">Ngày:</span>
                                <input type="date" min={todayStr} value={dateParam}
                                    onChange={(e) => setSearchParams({ courtId: courtIdParam, date: e.target.value })}
                                    className="bg-zinc-900 px-4 py-2 rounded-xl border border-zinc-700 text-sm font-bold text-lime-400 focus:outline-none focus:border-lime-400 transition-colors" />
                            </div>
                        </motion.div>

                        {/* Slot Grid */}
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                            className="bg-zinc-900/60 border border-zinc-800 p-6 sm:p-8 rounded-3xl">
                            <h3 className="font-extrabold text-base text-white mb-8 flex items-center gap-2 uppercase tracking-wide">
                                <span className="w-1.5 h-5 bg-lime-500 rounded-full" /> Lưới Giờ Khai Thác
                            </h3>

                            {isLoading ? (
                                <div className="py-20 text-center">
                                    <span className="w-7 h-7 border-3 border-lime-500 border-t-transparent rounded-full animate-spin inline-block mb-3" />
                                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Đang tải lịch...</p>
                                </div>
                            ) : (
                                <div className="space-y-10">
                                    {[
                                        { label: 'Ca Sáng', slots: morningSlots, icon: '☀️' },
                                        { label: 'Ca Chiều', slots: afternoonSlots, icon: '⛅' },
                                        { label: 'Ca Tối · Giờ Vàng', slots: eveningSlots, icon: '🌙' }
                                    ].map((session, sIdx) => (
                                        <div key={sIdx} className={session.slots.length === 0 ? 'hidden' : ''}>
                                            <div className="flex items-center gap-2 mb-4">
                                                <span className="text-lg">{session.icon}</span>
                                                <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400">{session.label}</span>
                                                <span className="text-[10px] text-zinc-600 font-semibold ml-auto">{session.slots.filter(s => s.is_available).length} trống</span>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                {session.slots.map((slot, idx) => {
                                                    const isPassed = dateParam === todayStr && slot.start_time <= currentTimeStr;
                                                    const isBusy = !slot.is_available;
                                                    const isSelected = selectedSlots.some(s => s.time_slot === slot.time_slot);
                                                    const isDisabled = isPassed || isBusy;

                                                    return (
                                                        <motion.button key={idx} disabled={isDisabled}
                                                            onClick={() => handleToggleSlot(slot)}
                                                            whileHover={!isDisabled ? { scale: 1.03, y: -3 } : {}}
                                                            whileTap={!isDisabled ? { scale: 0.97 } : {}}
                                                            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                                                            className={`p-4 rounded-2xl border-2 text-left transition-all duration-300 h-[85px] flex flex-col justify-between relative overflow-hidden
                                                                ${isDisabled ? 'bg-zinc-800/30 border-zinc-800/50 opacity-40 cursor-not-allowed text-zinc-500' :
                                                                    isSelected ? 'bg-lime-500 border-lime-400 text-zinc-950 shadow-xl shadow-lime-500/25' :
                                                                        'bg-zinc-800/70 border-zinc-700/60 text-white hover:border-lime-500/40 hover:bg-zinc-800 hover:shadow-[0_0_20px_rgba(163,230,53,0.08)]'}`}>
                                                            {isSelected && <div className="absolute top-2 right-2 w-5 h-5 bg-zinc-950 rounded-full flex items-center justify-center text-lime-400 text-[10px] font-black">✓</div>}
                                                            <span className={`font-mono font-extrabold text-sm ${isDisabled ? 'text-zinc-600' : isSelected ? 'text-zinc-950' : 'text-white'}`}>{slot.time_slot}</span>
                                                            <div className="flex justify-between items-end">
                                                                <span className={`text-[9px] font-bold uppercase ${isDisabled ? 'text-zinc-600' : isSelected ? 'text-zinc-800' : 'text-zinc-400'}`}>
                                                                    {isPassed ? 'Hết giờ' : isBusy ? 'Đã kín' : 'Giá ca'}
                                                                </span>
                                                                <span className={`text-sm font-extrabold ${isDisabled ? 'text-zinc-600' : isSelected ? 'text-zinc-950' : 'text-lime-400'}`}>
                                                                    {isPassed ? '--' : `${(slot.price / 1000)}k`}
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

                    {/* ═══ CỘT PHẢI: HÓA ĐƠN & FORM ═══ */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                        className="bg-zinc-900/80 backdrop-blur-xl rounded-3xl border border-zinc-800 overflow-hidden sticky top-8 shadow-2xl shadow-black/30">

                        {/* Tab Đặt lẻ / Định kỳ */}
                        <div className="grid grid-cols-2 bg-zinc-800/80 p-1.5 m-3 rounded-2xl">
                            {[
                                { type: 'single', label: 'Đặt lẻ 1 ngày' },
                                { type: 'recurring', label: 'Đặt định kỳ' }
                            ].map(t => (
                                <button key={t.type} type="button"
                                    onClick={() => { setBookingType(t.type); setPayLater(false); }}
                                    className={`relative py-3 rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all duration-300
                                        ${bookingType === t.type ? 'text-zinc-950' : 'text-zinc-500 hover:text-zinc-300'}`}>
                                    {bookingType === t.type && (
                                        <motion.div layoutId="bookingTypeTab"
                                            className="absolute inset-0 bg-lime-500 rounded-xl shadow-lg shadow-lime-500/20"
                                            transition={{ type: 'spring', stiffness: 350, damping: 30 }} />
                                    )}
                                    <span className="relative z-10">{t.label}</span>
                                </button>
                            ))}
                        </div>

                        <div className="p-6 sm:p-8 space-y-6">
                            {/* Selected slots */}
                            <div>
                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-3">Khung giờ đã chọn</span>
                                <div className="flex flex-wrap gap-2 min-h-[40px]">
                                    {selectedSlots.length === 0 ? (
                                        <p className="text-xs text-zinc-600 italic">Chưa chọn giờ nào...</p>
                                    ) : selectedSlots.map(s => (
                                        <motion.span key={s.time_slot} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                            className="px-3 py-1.5 bg-lime-500/15 text-lime-400 text-xs font-bold rounded-xl border border-lime-500/25">
                                            {s.time_slot}
                                        </motion.span>
                                    ))}
                                </div>
                            </div>

                            {/* Recurring range */}
                            <AnimatePresence>
                                {bookingType === 'recurring' && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                        className="bg-purple-500/10 p-4 rounded-2xl border border-purple-500/20 space-y-3 overflow-hidden">
                                        <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Thời hạn hợp đồng</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input type="date" value={recurringRange.startDate} disabled
                                                className="bg-zinc-800 p-2.5 rounded-xl text-xs font-bold text-zinc-500 border border-zinc-700 opacity-60" />
                                            <input type="date" value={recurringRange.endDate}
                                                onChange={e => setRecurringRange(r => ({ ...r, endDate: e.target.value }))}
                                                className="bg-zinc-800 p-2.5 rounded-xl text-xs font-bold text-white border border-zinc-700 focus:outline-none focus:border-purple-400 transition-colors" />
                                        </div>
                                        <p className="text-[9px] text-purple-400/70 italic">* Tự động lặp khung giờ đã chọn cho các tuần tiếp theo.</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Total */}
                            <div className="pt-5 border-t border-dashed border-zinc-700/50 flex justify-between items-end">
                                <span className="text-xs font-bold text-zinc-500 uppercase">Tổng cộng:</span>
                                <div className="text-right">
                                    <span className="text-3xl font-black text-lime-400 tracking-tighter">{totalPrice.toLocaleString()}</span>
                                    <span className="text-xs text-zinc-500 font-semibold ml-1">VNĐ</span>
                                </div>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleFinalizeBooking} className="space-y-4">
                                <input className={inputClass} placeholder="Họ và tên đại diện *" required
                                    value={customerForm.fullName} onChange={e => setCustomerForm({ ...customerForm, fullName: e.target.value })} />
                                <input className={inputClass} placeholder="Số điện thoại liên hệ *" required
                                    value={customerForm.phone} onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })} />

                                {bookingType === 'single' ? (
                                    <label className="flex items-center gap-3 p-4 bg-zinc-800/50 rounded-2xl border border-zinc-700/50 cursor-pointer select-none hover:border-lime-500/30 transition-all">
                                        <input type="checkbox" checked={payLater} onChange={e => setPayLater(e.target.checked)}
                                            className="w-4 h-4 rounded bg-zinc-700 border-zinc-600 text-lime-500 focus:ring-0 focus:ring-offset-0" />
                                        <span className="text-xs font-bold text-zinc-300">Thanh toán sau tại sân (Không cọc)</span>
                                    </label>
                                ) : (
                                    <div className="p-3 bg-purple-500/10 text-purple-400 text-[10px] font-bold text-center rounded-xl uppercase border border-purple-500/20 tracking-wider">
                                        Bắt buộc cọc trước cho lịch định kỳ
                                    </div>
                                )}

                                <motion.button type="submit" disabled={selectedSlots.length === 0 || isSubmitting}
                                    whileHover={selectedSlots.length > 0 && !isSubmitting ? { scale: 1.02, boxShadow: '0 0 25px rgba(163,230,53,0.3)' } : {}}
                                    whileTap={selectedSlots.length > 0 && !isSubmitting ? { scale: 0.98 } : {}}
                                    className={`w-full py-4 rounded-2xl font-extrabold text-sm uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2
                                        ${selectedSlots.length > 0 && !isSubmitting
                                            ? 'bg-lime-500 hover:bg-lime-400 text-zinc-950 shadow-xl shadow-lime-500/20'
                                            : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'}`}>
                                    {isSubmitting && <span className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />}
                                    {isSubmitting ? 'Đang xử lý...' : (bookingType === 'recurring' ? '⚡ Khởi tạo chuỗi cố định' : payLater ? 'Xác nhận giữ chỗ' : `Thanh toán ${totalPrice > 0 ? totalPrice.toLocaleString() + 'đ' : ''}`)}
                                </motion.button>
                            </form>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default BookingPage;