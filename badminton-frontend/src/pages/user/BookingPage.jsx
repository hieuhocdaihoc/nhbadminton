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
    const todayStr = now.toLocaleDateString('sv-SE'); // Định dạng YYYY-MM-DD
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
            if (!courtIdParam) {
                setErrorMessage('Thiếu mã định danh sân thi đấu.');
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            setErrorMessage('');
            setSelectedSlots([]);

            try {
                const [courtRes, availabilityRes] = await Promise.all([
                    courtService.getPublicCourtById(courtIdParam),
                    courtService.getCourtSlots(courtIdParam, dateParam)
                ]);

                setCourt(courtRes.data?.data || courtRes.data);
                setSlots(availabilityRes.data?.data || []);

                // Tự động điền form nếu người dùng đã đăng nhập
                const storedUser = localStorage.getItem('current_user');
                if (storedUser) {
                    try {
                        const userObj = JSON.parse(storedUser);
                        setCustomerForm(f => ({
                            ...f,
                            fullName: userObj.full_name || '',
                            phone: userObj.phone || ''
                        }));
                    } catch (e) { console.error("Lỗi parse user:", e); }
                }
            } catch (error) {
                console.error("Lỗi API:", error);
                setErrorMessage('Hệ thống bận hoặc API đang được bảo trì. Vui lòng thử lại sau.');
            } finally {
                setIsLoading(false);
            }
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

    // --- KẾT NỐI API CHỐT ĐẶT SÂN (TÍCH HỢP SẴN CỔNG THANH TOÁN ONLINE) ---
    const handleFinalizeBooking = async (e) => {
        e.preventDefault();
        if (selectedSlots.length === 0) return alert('⚠️ Vui lòng chọn ít nhất một khung giờ trống!');

        setIsSubmitting(true);

        try {
            const isPrepaid = bookingType === 'recurring' ? true : !payLater;
            const totalAmount = selectedSlots.reduce((acc, s) => acc + Number(s.price), 0);

            // Chuẩn bị Payload gốc
            let payload = {
                court_id: courtIdParam,
                booking_type: bookingType,
                customer_name: customerForm.fullName,
                customer_phone: customerForm.phone,
                note: customerForm.note || '',
                is_prepaid: isPrepaid,
                total_amount: totalAmount
            };

            // Phân luồng dữ liệu Lẻ / Định kỳ
            if (bookingType === 'single') {
                payload.slots = selectedSlots.map(s => ({
                    date: dateParam,
                    start: s.start_time,
                    end: s.end_time
                }));
            } else {
                const sortedSlots = [...selectedSlots].sort((a, b) => a.start_time.localeCompare(b.start_time));
                payload.start_date = dateParam;
                payload.end_date = recurringRange.endDate;
                payload.start_time = sortedSlots[0].start_time;
                payload.end_time = sortedSlots[sortedSlots.length - 1].end_time;

                // Chuẩn hóa thứ trong tuần cho Laravel (1: Thứ 2 -> 7: Chủ nhật)
                const jsDayOfWeek = new Date(dateParam).getDay();
                payload.day_of_week = jsDayOfWeek === 0 ? 7 : jsDayOfWeek;
            }

            console.log("TIẾN HÀNH BẮN API ĐẶT SÂN:", payload);
            const response = await bookingService.createBooking(payload);

            if (response.status === 201 || response.data?.status === 'success') {
                const responseData = response.data?.data || response.data;

                // KIẾN TRÚC MỞ RỘNG: TỰ ĐỘNG BẮT ĐƯỜNG DẪN THANH TOÁN (PAYMENT URL)
                // Nếu Backend trả về link thanh toán (VNPay/MoMo/PayOS), lập tức điều hướng sang cổng
                if (isPrepaid && responseData?.payment_url) {
                    alert('⏳ Đơn hàng đã khởi tạo thành công! Đang chuyển hướng sang cổng thanh toán trực tuyến...');
                    window.location.href = responseData.payment_url;
                } else {
                    // Nếu là thanh toán tại sân hoặc Backend chưa gắn link -> Về thẳng trang Lịch sử
                    alert('🎉 ' + (response.data?.message || 'Đặt sân thành công!'));
                    navigate('/booking-history');
                }
            }
        } catch (error) {
            console.error("Lỗi xử lý đặt sân:", error);
            const backendErrorMsg = error.response?.data?.message || 'Thao tác thất bại, vui lòng kiểm tra lại kết nối hoặc dải giờ!';
            alert('❌ ' + backendErrorMsg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const morningSlots = slots.filter(s => s.start_time < '12:00');
    const afternoonSlots = slots.filter(s => s.start_time >= '12:00' && s.start_time < '18:00');
    const eveningSlots = slots.filter(s => s.start_time >= '18:00');

    return (
        <div className="min-h-screen bg-[#f8fafc] py-8 font-sans">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

                <button
                    onClick={() => navigate('/#courts')}
                    className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-blue-600 mb-6 transition-colors uppercase tracking-widest"
                >
                    ← Trở về sơ đồ sân
                </button>

                {errorMessage && (
                    <div className="mb-6 p-4 bg-red-50 text-red-700 text-xs font-bold rounded-2xl border border-red-100 shadow-sm">
                        {errorMessage}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* CỘT TRÁI: BẢNG LỊCH TRÌNH */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-6 rounded-[2rem] border border-zinc-200/60 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-xl shadow-lg">🏸</div>
                                <div>
                                    <h1 className="text-2xl font-black text-zinc-900">{court?.name || 'Đang tải thông tin...'}</h1>
                                    <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">
                                        {court?.floor_type || 'Thảm tiêu chuẩn BWF'}
                                    </p>
                                </div>
                            </div>
                            <div className="bg-zinc-50 p-2 rounded-2xl border border-zinc-100 flex items-center gap-3">
                                <span className="text-[10px] font-black text-zinc-400 uppercase ml-2">Ngày thi đấu:</span>
                                <input
                                    type="date" min={todayStr} value={dateParam}
                                    onChange={(e) => setSearchParams({ courtId: courtIdParam, date: e.target.value })}
                                    className="bg-white px-4 py-1.5 rounded-xl border border-zinc-200 text-xs font-black text-blue-600 focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200/60 shadow-sm">
                            <h3 className="font-black text-lg text-zinc-900 mb-8 flex items-center gap-2">
                                <span className="w-2 h-6 bg-blue-600 rounded-full"></span> Lưới Giờ Khai Thác Trực Tuyến
                            </h3>

                            <div className="space-y-12">
                                {[
                                    { label: 'Ca Sáng', slots: morningSlots, icon: '☀️', color: 'text-amber-500' },
                                    { label: 'Ca Chiều', slots: afternoonSlots, icon: '⛅', color: 'text-blue-500' },
                                    { label: 'Ca Tối (Giờ Vàng)', slots: eveningSlots, icon: '🌙', color: 'text-purple-600' }
                                ].map((session, sIdx) => (
                                    <div key={sIdx} className={session.slots.length === 0 ? 'hidden' : ''}>
                                        <div className="flex items-center gap-2 mb-4">
                                            <span className="text-lg">{session.icon}</span>
                                            <span className={`text-xs font-black uppercase tracking-widest ${session.color}`}>{session.label}</span>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            {session.slots.map((slot, idx) => {
                                                const isPassed = dateParam === todayStr && slot.start_time <= currentTimeStr;
                                                const isBusy = !slot.is_available;
                                                const isSelected = selectedSlots.some(s => s.time_slot === slot.time_slot);
                                                const isDisabled = isPassed || isBusy;

                                                return (
                                                    <motion.button
                                                        key={idx} disabled={isDisabled}
                                                        onClick={() => handleToggleSlot(slot)}
                                                        whileHover={!isDisabled ? { scale: 1.02, y: -2 } : {}}
                                                        className={`p-3.5 rounded-2xl border text-left transition-all h-20 flex flex-col justify-between relative ${isDisabled ? 'bg-zinc-50 border-zinc-100 opacity-40 grayscale cursor-not-allowed' :
                                                            isSelected ? 'bg-zinc-900 border-zinc-900 text-white shadow-xl z-10' :
                                                                'bg-white border-zinc-200 hover:border-blue-500 hover:shadow-md'
                                                            }`}
                                                    >
                                                        <span className="font-mono font-black text-xs">{slot.time_slot}</span>
                                                        <div className="flex justify-between items-end mt-2">
                                                            <span className="text-[9px] font-bold uppercase opacity-60">
                                                                {isPassed ? 'Hết giờ' : isBusy ? 'Đã kín' : 'Giá ca'}
                                                            </span>
                                                            <span className="text-xs font-black">
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
                        </div>
                    </div>

                    {/* CỘT PHẢI: HÓA ĐƠN & FORM XÁC NHẬN */}
                    <div className="bg-white rounded-[2.5rem] border-2 border-zinc-900 shadow-2xl overflow-hidden sticky top-8">
                        <div className="grid grid-cols-2 bg-zinc-900 p-1.5">
                            <button
                                type="button"
                                onClick={() => { setBookingType('single'); setPayLater(false); }}
                                className={`py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${bookingType === 'single' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`}
                            >
                                Đặt lẻ 1 ngày
                            </button>
                            <button
                                type="button"
                                onClick={() => { setBookingType('recurring'); setPayLater(false); }}
                                className={`py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${bookingType === 'recurring' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`}
                            >
                                Đặt định kỳ
                            </button>
                        </div>

                        <div className="p-8 space-y-6">
                            <div>
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-3">Khung giờ đã chọn</span>
                                <div className="flex flex-wrap gap-2 min-h-[40px]">
                                    {selectedSlots.length === 0 ? (
                                        <p className="text-xs text-zinc-400 italic font-medium">Chưa có giờ nào được chọn...</p>
                                    ) : (
                                        selectedSlots.map(s => (
                                            <span key={s.time_slot} className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-black rounded-lg border border-blue-100 flex items-center gap-2">
                                                {s.time_slot}
                                            </span>
                                        ))
                                    )}
                                </div>
                            </div>

                            <AnimatePresence>
                                {bookingType === 'recurring' && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-purple-50 p-4 rounded-2xl border border-purple-100 space-y-3">
                                        <p className="text-[10px] font-black text-purple-800 uppercase tracking-widest">Thời hạn hợp đồng</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input type="date" value={recurringRange.startDate} disabled className="bg-white p-2 rounded-xl text-xs font-bold border border-purple-200 opacity-60" />
                                            <input
                                                type="date"
                                                value={recurringRange.endDate}
                                                onChange={e => setRecurringRange(r => ({ ...r, endDate: e.target.value }))}
                                                className="bg-white p-2 rounded-xl text-xs font-bold border border-purple-200 focus:outline-none focus:border-purple-500"
                                            />
                                        </div>
                                        <p className="text-[9px] text-purple-600 italic">* Hệ thống tự động lặp lại khung giờ đã chọn cho các tuần tiếp theo.</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="pt-4 border-t border-dashed border-zinc-200 flex justify-between items-end">
                                <span className="text-xs font-black text-zinc-400 uppercase">Tổng cộng:</span>
                                <span className="text-3xl font-black text-blue-600 tracking-tighter">
                                    {selectedSlots.reduce((acc, s) => acc + Number(s.price), 0).toLocaleString()}đ
                                </span>
                            </div>

                            <form onSubmit={handleFinalizeBooking} className="space-y-4">
                                <input
                                    className="w-full p-4 rounded-2xl bg-zinc-50 border border-zinc-200 focus:border-zinc-900 focus:bg-white outline-none font-bold text-sm transition-all"
                                    placeholder="Họ và tên đại diện *" required
                                    value={customerForm.fullName} onChange={e => setCustomerForm({ ...customerForm, fullName: e.target.value })}
                                />
                                <input
                                    className="w-full p-4 rounded-2xl bg-zinc-50 border border-zinc-200 focus:border-zinc-900 focus:bg-white outline-none font-bold text-sm transition-all"
                                    placeholder="Số điện thoại liên hệ *" required
                                    value={customerForm.phone} onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })}
                                />

                                {bookingType === 'single' ? (
                                    <label className="flex items-center gap-3 p-4 bg-zinc-50 rounded-2xl border border-zinc-200/60 cursor-pointer select-none hover:bg-zinc-100 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={payLater}
                                            onChange={e => setPayLater(e.target.checked)}
                                            className="w-4 h-4 rounded text-zinc-900 focus:ring-0"
                                        />
                                        <span className="text-xs font-black text-zinc-700">Thanh toán sau tại sân (Không cọc)</span>
                                    </label>
                                ) : (
                                    <div className="p-3 bg-purple-100 text-purple-800 text-[10px] font-black text-center rounded-xl uppercase border border-purple-200">
                                        Bắt buộc cọc trước cho lịch định kỳ
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={selectedSlots.length === 0 || isSubmitting}
                                    className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${selectedSlots.length > 0 && !isSubmitting
                                        ? 'bg-zinc-900 text-white shadow-xl hover:bg-black active:scale-[0.98]'
                                        : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                                        }`}
                                >
                                    {isSubmitting ? 'Đang xử lý...' : (bookingType === 'recurring' ? '⚡ Khởi tạo chuỗi cố định' : payLater ? 'Xác nhận giữ chỗ' : 'Thanh toán & Đặt sân')}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BookingPage;