import React, { useState, useEffect, useMemo } from 'react';
import { adminBookingService } from '../../services/admin/bookingService';

const RecurringBookings = () => {
    // STATE DỮ LIỆU
    const [masters, setMasters] = useState([]);
    const [selectedMaster, setSelectedMaster] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [courts, setCourts] = useState([]); // Danh sách sân cho form đổi lịch

    // STATE TRẠNG THÁI
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingSessions, setIsLoadingSessions] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const [searchTerm, setSearchTerm] = useState('');
    const [sessionSearchTerm, setSessionSearchTerm] = useState('');

    // STATE CHO XÁC NHẬN CƠ BẢN
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false, title: '', message: '', actionData: null
    });

    // STATE CHO MODAL ĐỔI LỊCH CA NHỎ
    const [rescheduleModal, setRescheduleModal] = useState({ isOpen: false, detailId: null, booking: null });
    const [rescheduleForm, setRescheduleForm] = useState({ court_id: '', booking_date: '', start_time: '', end_time: '' });

    const [isProcessing, setIsProcessing] = useState(false);

    const DAYS = ['', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

    // --- TẢI DANH SÁCH HỢP ĐỒNG GỐC VÀ DANH SÁCH SÂN ---
    const fetchInitData = async () => {
        setIsLoading(true);
        try {
            const [mastersRes, courtsRes] = await Promise.all([
                adminBookingService.getRecurringMasters(1),
                adminBookingService.getAllCourts() // Tải danh sách sân để dùng cho form đổi lịch
            ]);
            setMasters(mastersRes.data?.data || mastersRes.data || []);
            setCourts(courtsRes.data?.data || courtsRes.data || []);
        } catch (e) {
            setMessage({ type: 'error', text: 'Lỗi tải dữ liệu.' });
        } finally { setIsLoading(false); }
    };

    useEffect(() => { fetchInitData(); }, []);

    // --- TẢI CHI TIẾT TỪNG BUỔI ---
    const handleSelectMaster = async (master) => {
        setSelectedMaster(master);
        setIsLoadingSessions(true);
        setSessionSearchTerm('');
        try {
            const res = await adminBookingService.getRecurringSessions(master.id);
            setSessions(res.data.data || []);
        } catch (e) { console.error(e); }
        finally { setIsLoadingSessions(false); }
    };

    // --- LỌC DỮ LIỆU TRÊN FRONTEND ---
    const filteredMasters = useMemo(() => {
        if (!searchTerm) return masters;
        const lower = searchTerm.toLowerCase();
        return masters.filter(m =>
            m.recurring_code?.toLowerCase().includes(lower) ||
            m.user?.full_name?.toLowerCase().includes(lower) ||
            m.user?.phone?.includes(lower)
        );
    }, [masters, searchTerm]);

    const filteredSessions = useMemo(() => {
        if (!sessionSearchTerm) return sessions;
        const lower = sessionSearchTerm.toLowerCase();
        return sessions.filter(s => s.booking_code?.toLowerCase().includes(lower) || s.customer_name?.toLowerCase().includes(lower));
    }, [sessions, sessionSearchTerm]);

    // --- LOGIC XÁC NHẬN CƠ BẢN ---
    const requestAction = (sessionBooking, type) => {
        let title = '', msg = '', payload = {};
        if (type === 'confirm') {
            title = 'Xác nhận duyệt ca';
            msg = `Xác nhận giữ sân cho ca đá này?`;
            payload = { status: 'confirmed', payment_status: sessionBooking.payment_status };
        } else if (type === 'pay') {
            title = 'Xác nhận đã thu tiền';
            msg = `Xác nhận đã thu đủ tiền cho ca đá này?`;
            payload = { status: sessionBooking.status === 'pending' ? 'confirmed' : sessionBooking.status, payment_status: 'paid' };
        } else if (type === 'cancel') {
            title = 'Hủy ca đá này';
            msg = `Hành động này chỉ hủy duy nhất ca đá này, không ảnh hưởng hợp đồng gốc.`;
            payload = { status: 'cancelled', payment_status: sessionBooking.payment_status };
        }
        setConfirmModal({ isOpen: true, title, message: msg, actionData: { id: sessionBooking.id, payload } });
    };

    const executeAction = async () => {
        if (!confirmModal.actionData) return;
        setIsProcessing(true);
        try {
            await adminBookingService.updateStatus(confirmModal.actionData.id, confirmModal.actionData.payload);
            setMessage({ type: 'success', text: '✓ Thành công!' });
            setConfirmModal({ isOpen: false, title: '', message: '', actionData: null });
            if (selectedMaster) handleSelectMaster(selectedMaster);
        } catch (e) { alert('Lỗi hệ thống!'); }
        finally { setIsProcessing(false); setTimeout(() => setMessage({ type: '', text: '' }), 2000); }
    };

    // --- LOGIC ĐỔI LỊCH (RESCHEDULE) ---
    const openRescheduleModal = (sessionBooking) => {
        const detail = sessionBooking.details?.[0];
        if (!detail) return alert('Không tìm thấy chi tiết ca chơi!');

        setRescheduleForm({
            court_id: detail.court_id,
            booking_date: detail.booking_date,
            start_time: detail.start_time.slice(0, 5),
            end_time: detail.end_time.slice(0, 5)
        });
        setRescheduleModal({ isOpen: true, detailId: detail.id, booking: sessionBooking });
    };

    const handleRescheduleSubmit = async (e) => {
        e.preventDefault();
        setIsProcessing(true);
        try {
            await adminBookingService.rescheduleDetail(rescheduleModal.detailId, rescheduleForm);
            setMessage({ type: 'success', text: '🔄 Đổi lịch thành công! Hệ thống đã tính lại giá.' });

            setRescheduleModal({ isOpen: false, detailId: null, booking: null });
            if (selectedMaster) handleSelectMaster(selectedMaster); // Load lại ca chơi để thấy giờ mới
        } catch (error) {
            const errorMsg = error.response?.data?.message || 'Có lỗi xảy ra khi đổi lịch!';
            alert('❌ ' + errorMsg);
        } finally {
            setIsProcessing(false);
            setTimeout(() => setMessage({ type: '', text: '' }), 4000);
        }
    };

    const renderStatusBadge = (status) => {
        const styles = {
            confirmed: 'bg-blue-50 text-blue-600 border-blue-100',
            completed: 'bg-emerald-50 text-emerald-600 border-emerald-100',
            cancelled: 'bg-zinc-100 text-zinc-400 border-zinc-200',
            pending: 'bg-amber-50 text-amber-600 border-amber-100'
        };
        const labels = { confirmed: '✓ Đã chốt', completed: '📍 Vào sân', cancelled: '✕ Hủy', pending: '⏳ Chờ' };
        return <span className={`px-2 py-0.5 border rounded-full text-[9px] font-black uppercase tracking-tighter ${styles[status] || styles.pending}`}>{labels[status] || 'Chờ'}</span>;
    };

    const formatVN = (dateStr) => {
        if (!dateStr) return '...';
        return dateStr.split('-').reverse().join('/');
    };

    return (
        <div className="max-w-[1600px] mx-auto p-3 gap-3 font-sans h-[100dvh] flex flex-col overflow-hidden bg-zinc-50/50">
            {/* HEADER THU GỌN */}
            <div className="shrink-0 bg-white p-3 px-5 rounded-2xl border border-zinc-200/60 shadow-sm flex justify-between items-center relative overflow-hidden">
                <div className="relative z-10 flex items-center gap-3">
                    <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center text-white shadow-lg">📋</div>
                    <h2 className="text-lg font-black text-zinc-900 tracking-tight">Hợp Đồng Định Kỳ</h2>
                </div>
                {message.text && <div className={`px-3 py-1 rounded-lg text-[10px] font-bold ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-purple-50 text-purple-600'}`}>{message.text}</div>}
            </div>

            <div className="flex-1 grid grid-cols-12 gap-3 min-h-0 pb-2">
                {/* CỘT TRÁI - DANH SÁCH HỢP ĐỒNG */}
                <div className="col-span-4 bg-white p-3 rounded-2xl border border-zinc-200/60 shadow-sm flex flex-col min-h-0">
                    <div className="shrink-0 relative mb-3">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-400 text-xs">🔍</span>
                        <input
                            type="text" placeholder="Tìm tên khách, SĐT, Mã HĐ..." value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold outline-none focus:border-purple-400 transition-all"
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                        {isLoading ? <p className="text-center py-10 text-[10px] font-bold text-zinc-400 uppercase">Đang tải...</p> :
                            filteredMasters.map(m => {
                                const isSelected = selectedMaster?.id === m.id;
                                return (
                                    <button key={m.id} onClick={() => handleSelectMaster(m)}
                                        className={`w-full p-3 rounded-xl border text-left transition-all duration-200 ${isSelected ? 'bg-purple-900 border-purple-900 text-white shadow-lg shadow-purple-900/20 translate-x-1' : 'bg-white border-zinc-100 hover:border-purple-200 text-zinc-800'}`}
                                    >
                                        <div className="flex justify-between items-center mb-1.5">
                                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${isSelected ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-500'}`}>{m.recurring_code}</span>
                                            <span className={`text-[9px] font-bold ${isSelected ? 'text-purple-200' : 'text-zinc-400'}`}>{m.court?.name}</span>
                                        </div>

                                        <h4 className={`text-xs font-black truncate ${isSelected ? 'text-white' : 'text-zinc-900'}`}>{m.user?.full_name?.toUpperCase() || 'KHÁCH VÃNG LAI'}</h4>
                                        <p className={`text-[10px] font-bold mt-0.5 ${isSelected ? 'text-purple-200' : 'text-zinc-500'}`}>📞 {m.user?.phone || 'N/A'}</p>

                                        <div className={`mt-2 pt-2 border-t border-dashed ${isSelected ? 'border-purple-700/50 text-purple-200' : 'border-zinc-200 text-zinc-500'} flex justify-between items-center`}>
                                            <span className="text-[10px] font-bold">🗓️ {DAYS[m.day_of_week]}</span>
                                            <span className="text-[9px] font-semibold bg-black/10 px-1.5 py-0.5 rounded">
                                                {formatVN(m.start_date)} ➔ {formatVN(m.end_date)}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })
                        }
                    </div>
                </div>

                {/* CỘT PHẢI - CHI TIẾT CA ĐÁ */}
                <div className="col-span-8 bg-white rounded-2xl border border-zinc-200/60 shadow-sm flex flex-col min-h-0 overflow-hidden">
                    <div className="shrink-0 p-4 border-b border-zinc-100 bg-zinc-50/30 flex justify-between items-start">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-black text-xs shrink-0">
                                {selectedMaster?.user?.full_name?.charAt(0).toUpperCase() || '?'}
                            </div>
                            <div>
                                <h3 className="font-black text-sm text-zinc-900 leading-tight">{selectedMaster?.user?.full_name || 'Chọn hợp đồng để xem'}</h3>
                                <div className="flex gap-2 items-center mt-0.5">
                                    <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest">{selectedMaster?.user?.phone || '---'}</p>
                                    {selectedMaster && (
                                        <>
                                            <span className="text-[10px] text-zinc-300">•</span>
                                            <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-100 px-1.5 rounded">
                                                Hạn: {formatVN(selectedMaster.start_date)} ➔ {formatVN(selectedMaster.end_date)}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        {selectedMaster && (
                            <div className="relative w-48">
                                <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-zinc-400 text-[10px]">🔍</span>
                                <input type="text" placeholder="Tìm ca..." value={sessionSearchTerm} onChange={(e) => setSessionSearchTerm(e.target.value)}
                                    className="w-full pl-7 pr-2 py-1 bg-white border border-zinc-200 rounded-lg text-[10px] font-semibold outline-none focus:border-purple-400"
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-auto relative custom-scrollbar">
                        <table className="w-full text-left text-xs whitespace-nowrap">
                            <thead className="bg-white sticky top-0 z-10 border-b border-zinc-200">
                                <tr className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                                    <th className="p-3 pl-6">Mã Ca</th>
                                    <th className="p-3 text-center">Ngày đá</th>
                                    <th className="p-3 text-right">Tổng thu</th>
                                    <th className="p-3 text-center">Tình trạng</th>
                                    <th className="p-3 text-right pr-6">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-50 bg-white">
                                {!selectedMaster ? <tr><td colSpan="5" className="py-20 text-center text-[10px] font-black text-zinc-300 uppercase">Vui lòng chọn khách hàng bên trái</td></tr> :
                                    filteredSessions.map(s => (
                                        <tr key={s.id} className="hover:bg-zinc-50/50 transition-colors group">
                                            <td className="p-2.5 pl-6 font-black text-zinc-900 text-[10px]">{s.booking_code}</td>
                                            <td className="p-2.5 text-center font-mono text-[10px] font-black text-blue-600">
                                                {s.details?.[0]?.booking_date ? formatVN(s.details[0].booking_date) : 'N/A'}
                                                <span className="block text-[8px] font-semibold text-zinc-400 mt-0.5">
                                                    {s.details?.[0]?.start_time?.slice(0, 5)} - {s.details?.[0]?.end_time?.slice(0, 5)}
                                                </span>
                                            </td>
                                            <td className="p-2.5 text-right font-black text-zinc-900">
                                                {Number(s.total_price).toLocaleString()} ₫
                                                <span className={`block text-[7px] ${s.payment_status === 'paid' ? 'text-emerald-500' : 'text-red-500'}`}>{s.payment_status === 'paid' ? 'ĐÃ THU' : 'CHƯA THU'}</span>
                                            </td>
                                            <td className="p-2.5 text-center">{renderStatusBadge(s.status)}</td>
                                            <td className="p-2.5 text-right pr-6 space-x-1 opacity-100 sm:opacity-30 sm:group-hover:opacity-100 transition-opacity">
                                                {s.status === 'pending' && <button onClick={() => requestAction(s, 'confirm')} className="px-2 py-1 bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase">Duyệt</button>}
                                                {s.payment_status !== 'paid' && s.status !== 'cancelled' && <button onClick={() => requestAction(s, 'pay')} className="px-2 py-1 bg-amber-500 text-white rounded-lg text-[9px] font-black uppercase">Thu</button>}

                                                {/* NÚT ĐỔI LỊCH CHO CA ĐÁ LẺ */}
                                                {s.status !== 'cancelled' && s.status !== 'completed' && (
                                                    <button onClick={() => openRescheduleModal(s)} className="px-2 py-1 bg-white border border-purple-200 text-purple-600 hover:bg-purple-50 rounded-lg text-[9px] font-black uppercase">
                                                        Đổi lịch
                                                    </button>
                                                )}

                                                {s.status !== 'cancelled' && s.status !== 'completed' && <button onClick={() => requestAction(s, 'cancel')} className="px-2 py-1 bg-white border border-zinc-200 text-zinc-400 rounded-lg text-[9px] font-black uppercase hover:border-red-200 hover:text-red-500">Hủy</button>}
                                            </td>
                                        </tr>
                                    ))
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* MODAL XÁC NHẬN CƠ BẢN */}
            {confirmModal.isOpen && (
                <div className="fixed inset-0 z-50 bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-[280px] rounded-2xl shadow-2xl p-5 text-center">
                        <h3 className="text-sm font-black text-zinc-900 mb-1">{confirmModal.title}</h3>
                        <p className="text-[11px] font-semibold text-zinc-500 mb-4">{confirmModal.message}</p>
                        <div className="flex gap-2">
                            <button onClick={() => setConfirmModal({ isOpen: false })} className="flex-1 py-2 bg-zinc-100 text-zinc-600 font-bold rounded-lg text-[10px]">HỦY</button>
                            <button onClick={executeAction} disabled={isProcessing} className="flex-1 py-2 bg-purple-600 text-white font-bold rounded-lg text-[10px] uppercase shadow-lg shadow-purple-200">{isProcessing ? '...' : 'CHỐT'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL ĐỔI LỊCH (RESCHEDULE) */}
            {rescheduleModal.isOpen && (
                <div className="fixed inset-0 z-50 bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-6 md:p-8 transform transition-all scale-100 opacity-100">
                        <div className="flex items-center gap-4 mb-5">
                            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center text-xl">🔄</div>
                            <div>
                                <h3 className="text-lg font-black text-zinc-900">Đổi lịch giữ sân</h3>
                                <p className="text-xs font-semibold text-zinc-500">Ca đá: <strong className="text-purple-600">{rescheduleModal.booking?.booking_code}</strong></p>
                            </div>
                        </div>

                        <form onSubmit={handleRescheduleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Chọn sân mới</label>
                                <select
                                    required value={rescheduleForm.court_id}
                                    onChange={(e) => setRescheduleForm({ ...rescheduleForm, court_id: e.target.value })}
                                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm font-bold text-zinc-800 outline-none focus:border-purple-500 transition-colors"
                                >
                                    <option value="" disabled>-- Hãy chọn sân --</option>
                                    {courts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Ngày đá mới</label>
                                <input
                                    type="date" required value={rescheduleForm.booking_date}
                                    onChange={(e) => setRescheduleForm({ ...rescheduleForm, booking_date: e.target.value })}
                                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm font-bold text-zinc-800 outline-none focus:border-purple-500 transition-colors"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Giờ bắt đầu</label>
                                    <input
                                        type="time" required value={rescheduleForm.start_time}
                                        onChange={(e) => setRescheduleForm({ ...rescheduleForm, start_time: e.target.value })}
                                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm font-bold text-zinc-800 outline-none focus:border-purple-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Giờ kết thúc</label>
                                    <input
                                        type="time" required value={rescheduleForm.end_time}
                                        onChange={(e) => setRescheduleForm({ ...rescheduleForm, end_time: e.target.value })}
                                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm font-bold text-zinc-800 outline-none focus:border-purple-500 transition-colors"
                                    />
                                </div>
                            </div>

                            <div className="mt-6 flex gap-3 pt-4 border-t border-zinc-100">
                                <button type="button" onClick={() => setRescheduleModal({ isOpen: false, detailId: null, booking: null })} disabled={isProcessing} className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 font-black rounded-xl text-xs uppercase tracking-wider transition-colors">
                                    Hủy bỏ
                                </button>
                                <button type="submit" disabled={isProcessing} className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-md transition-colors flex items-center justify-center">
                                    {isProcessing ? <span className="animate-pulse">Đang xử lý...</span> : 'Lưu lịch mới'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RecurringBookings;