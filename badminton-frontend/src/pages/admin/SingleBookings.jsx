import React, { useState, useEffect, useMemo } from 'react';
import { adminBookingService } from '../../services/admin/bookingService';

const SingleBookings = () => {
    const [bookings, setBookings] = useState([]);
    const [courts, setCourts] = useState([]); // Chứa danh sách sân để đổi lịch
    const [pagination, setPagination] = useState({ current_page: 1, last_page: 1 });
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [searchTerm, setSearchTerm] = useState('');

    // MODAL XÁC NHẬN CƠ BẢN (Duyệt, Thu tiền, Hủy)
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', actionData: null });
    const [isProcessing, setIsProcessing] = useState(false);

    // ==========================================
    // STATE CHO MODAL ĐỔI LỊCH (MỚI)
    // ==========================================
    const [rescheduleModal, setRescheduleModal] = useState({ isOpen: false, detailId: null, booking: null });
    const [rescheduleForm, setRescheduleForm] = useState({ court_id: '', booking_date: '', start_time: '', end_time: '' });

    // --- TẢI DỮ LIỆU ---
    const fetchData = async (page) => {
        setIsLoading(true);
        try {
            // Lấy danh sách booking
            const res = await adminBookingService.getSingleBookings(page);
            setBookings(res.data?.data || []);
            setPagination({ current_page: res.data?.current_page || 1, last_page: res.data?.last_page || 1 });

            // Lấy danh sách sân (để bỏ vào Dropdown đổi lịch)
            const courtRes = await adminBookingService.getAllCourts();
            setCourts(courtRes.data?.data || courtRes.data || []);
        } catch (error) {
            setMessage({ type: 'error', text: 'Lỗi tải dữ liệu. Vui lòng kiểm tra API.' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(1); }, []);

    // --- LỌC TÌM KIẾM ---
    const filteredBookings = useMemo(() => {
        if (!searchTerm) return bookings;
        const lowerTerm = searchTerm.toLowerCase();
        return bookings.filter(b =>
            b.customer_name?.toLowerCase().includes(lowerTerm) ||
            b.customer_phone?.includes(lowerTerm) ||
            b.booking_code?.toLowerCase().includes(lowerTerm)
        );
    }, [bookings, searchTerm]);

    // --- LOGIC XÁC NHẬN CƠ BẢN ---
    const requestAction = (booking, type) => {
        let title = '', msg = '', payload = {};
        if (type === 'confirm') {
            title = 'Xác nhận duyệt đơn';
            msg = `Xác nhận giữ sân cho khách hàng ${booking.customer_name}?`;
            payload = { status: 'confirmed', payment_status: booking.payment_status };
        } else if (type === 'pay') {
            title = 'Xác nhận đã thu tiền';
            msg = `Xác nhận ${booking.customer_name} đã thanh toán đủ tiền sân?`;
            payload = { status: booking.status === 'pending' ? 'confirmed' : booking.status, payment_status: 'paid' };
        } else if (type === 'cancel') {
            title = 'Hủy đơn đặt sân';
            msg = `Hủy lịch đá của ${booking.customer_name}. Bạn có chắc chắn?`;
            payload = { status: 'cancelled', payment_status: booking.payment_status };
        }
        setConfirmModal({ isOpen: true, title, message: msg, actionData: { id: booking.id, payload } });
    };

    const executeAction = async () => {
        if (!confirmModal.actionData) return;
        setIsProcessing(true);
        try {
            await adminBookingService.updateStatus(confirmModal.actionData.id, confirmModal.actionData.payload);
            setMessage({ type: 'success', text: '✓ Thao tác thành công!' });
            setConfirmModal({ isOpen: false, title: '', message: '', actionData: null });
            fetchData(pagination.current_page);
        } catch (error) {
            alert('❌ Có lỗi xảy ra trong quá trình xử lý!');
        } finally {
            setIsProcessing(false);
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        }
    };

    // ==========================================
    // LOGIC ĐỔI LỊCH CA CHƠI
    // ==========================================
    const openRescheduleModal = (booking) => {
        const detail = booking.details?.[0];
        if (!detail) return alert('Không tìm thấy chi tiết ca chơi!');

        // Gán dữ liệu cũ vào Form để Lễ tân sửa
        setRescheduleForm({
            court_id: detail.court_id,
            booking_date: detail.booking_date,
            start_time: detail.start_time.slice(0, 5), // Cắt lấy HH:mm
            end_time: detail.end_time.slice(0, 5)
        });
        setRescheduleModal({ isOpen: true, detailId: detail.id, booking: booking });
    };

    const handleRescheduleSubmit = async (e) => {
        e.preventDefault();
        setIsProcessing(true);
        try {
            // Gọi API đổi lịch mà bạn đã viết ở Backend
            await adminBookingService.rescheduleDetail(rescheduleModal.detailId, rescheduleForm);
            setMessage({ type: 'success', text: '🔄 Đổi lịch thành công! Hệ thống đã tự động tính lại giá.' });

            setRescheduleModal({ isOpen: false, detailId: null, booking: null });
            fetchData(pagination.current_page); // Tải lại bảng để cập nhật giá và giờ
        } catch (error) {
            // Bắt lỗi từ Backend (trùng lịch, lỗi validate...)
            const errorMsg = error.response?.data?.message || 'Có lỗi xảy ra khi đổi lịch!';
            alert('❌ ' + errorMsg);
        } finally {
            setIsProcessing(false);
            setTimeout(() => setMessage({ type: '', text: '' }), 4000);
        }
    };

    // --- TIỆN ÍCH ---
    const getInitials = (name) => name ? name.charAt(0).toUpperCase() : '?';
    const renderStatusBadge = (status) => {
        switch (status) {
            case 'confirmed': return <span className="px-3 py-1 bg-blue-50 text-blue-600 border border-blue-100 text-[10px] font-black rounded-full uppercase tracking-wider">✓ Đã chốt</span>;
            case 'completed': return <span className="px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-black rounded-full uppercase tracking-wider">📍 Đã chơi</span>;
            case 'cancelled': return <span className="px-3 py-1 bg-zinc-100 text-zinc-500 border border-zinc-200 text-[10px] font-black rounded-full uppercase tracking-wider">✕ Đã hủy</span>;
            default: return <span className="px-3 py-1 bg-amber-50 text-amber-600 border border-amber-100 text-[10px] font-black rounded-full uppercase tracking-wider">⏳ Chờ duyệt</span>;
        }
    };

    return (
        <div className="max-w-[1600px] mx-auto space-y-6 font-sans pb-12">

            {/* HEADER */}
            <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-zinc-200/60 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-60 -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Hệ thống Quản lý</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">Danh Sách Đơn Đặt Lẻ</h2>
                </div>
            </div>

            {message.text && (
                <div className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                    <span>{message.type === 'success' ? '🎉' : '⚠️'}</span> {message.text}
                </div>
            )}

            {/* BẢNG DỮ LIỆU */}
            <div className="bg-white rounded-[2rem] border border-zinc-200/60 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 sm:p-5 border-b border-zinc-100 bg-zinc-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="relative w-full sm:w-80">
                        <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-zinc-400">🔍</span>
                        <input type="text" placeholder="Tìm tên, SĐT hoặc Mã đơn..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white border border-zinc-200 focus:border-indigo-500 rounded-xl text-xs font-semibold text-zinc-700 outline-none transition-all shadow-sm" />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm min-w-[1100px]">
                        <thead className="bg-zinc-50/50 text-zinc-400 text-[10px] uppercase font-black tracking-widest border-b border-zinc-200/80">
                            <tr>
                                <th className="p-5 pl-8">Mã / Khách hàng</th>
                                <th className="p-5">Thời gian đá</th>
                                <th className="p-5">Sân thi đấu</th>
                                <th className="p-5 text-right">Tài chính</th>
                                <th className="p-5 text-center">Trạng thái</th>
                                <th className="p-5 text-right pr-8">Quản lý duyệt đơn</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 bg-white">
                            {isLoading ? (
                                <tr><td colSpan="6" className="py-16 text-center text-xs text-zinc-400 font-bold">Đang tải dữ liệu...</td></tr>
                            ) : filteredBookings.length === 0 ? (
                                <tr><td colSpan="6" className="py-16 text-center text-xs text-zinc-400 font-bold">Không có dữ liệu.</td></tr>
                            ) : (
                                filteredBookings.map(b => {
                                    const detail = b.details?.[0];
                                    const courtName = detail?.court?.name || `Sân số ${detail?.court_id?.slice(-2) || '...'}`;
                                    const dateStr = detail?.booking_date ? new Date(detail.booking_date).toLocaleDateString('vi-VN') : 'N/A';

                                    return (
                                        <tr key={b.id} className="hover:bg-zinc-50/80 transition-colors group">
                                            <td className="p-5 pl-8">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs shrink-0">{getInitials(b.customer_name)}</div>
                                                    <div>
                                                        <strong className="block text-xs font-black text-zinc-900 tracking-tight">{b.booking_code}</strong>
                                                        <span className="text-[11px] font-semibold text-zinc-600 block mt-0.5">{b.customer_name}</span>
                                                        <span className="text-[10px] font-mono text-zinc-400">{b.customer_phone}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <strong className="block text-xs text-zinc-800 mb-1">{dateStr}</strong>
                                                <div className="bg-zinc-100 text-zinc-800 font-mono font-black text-[10px] px-2.5 py-1 rounded-md w-max border border-zinc-200/80">
                                                    {detail ? `${detail.start_time.slice(0, 5)} ➔ ${detail.end_time.slice(0, 5)}` : '--:--'}
                                                </div>
                                            </td>
                                            <td className="p-5 align-middle">
                                                <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 font-black text-xs rounded-lg border border-indigo-100 block w-max">{courtName}</span>
                                            </td>
                                            <td className="p-5 text-right">
                                                <span className="font-black text-zinc-900 text-sm block tracking-tight">{Number(b.total_price).toLocaleString()} ₫</span>
                                                <div className="mt-1 flex justify-end">
                                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${b.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                                        {b.payment_status === 'paid' ? 'Đã thanh toán' : 'Chưa thu tiền'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-5 text-center align-middle"><div className="flex justify-center">{renderStatusBadge(b.status)}</div></td>
                                            <td className="p-5 text-right pr-8 align-middle">
                                                <div className="flex flex-wrap items-center justify-end gap-2 opacity-100 sm:opacity-40 sm:group-hover:opacity-100 transition-opacity">

                                                    {b.status === 'pending' && (
                                                        <button onClick={() => requestAction(b, 'confirm')} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-[10px] font-black uppercase tracking-wider transition-all shadow-md shadow-blue-600/20">Duyệt đơn</button>
                                                    )}
                                                    {b.payment_status !== 'paid' && b.status !== 'cancelled' && (
                                                        <button onClick={() => requestAction(b, 'pay')} className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-full text-[10px] font-black uppercase tracking-wider transition-all shadow-md shadow-amber-500/20">Thu tiền</button>
                                                    )}

                                                    {/* NÚT ĐỔI LỊCH (Chỉ hiện khi đơn chưa hủy hoặc chưa hoàn thành) */}
                                                    {b.status !== 'cancelled' && b.status !== 'completed' && (
                                                        <button
                                                            onClick={() => openRescheduleModal(b)}
                                                            className="px-3 py-1.5 bg-white border-2 border-indigo-200 hover:bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-wider transition-all"
                                                        >
                                                            🔄 Đổi lịch
                                                        </button>
                                                    )}

                                                    {b.status !== 'cancelled' && b.status !== 'completed' && (
                                                        <button onClick={() => requestAction(b, 'cancel')} className="px-3 py-1.5 bg-white border border-zinc-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-zinc-500 rounded-full text-[10px] font-black uppercase tracking-wider transition-all">Hủy</button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* PHÂN TRANG */}
                {pagination.last_page > 1 && (
                    <div className="p-5 border-t border-zinc-100 flex justify-between items-center bg-zinc-50/50">
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest hidden sm:block">Trang {pagination.current_page} trên {pagination.last_page}</span>
                        <div className="flex gap-2">
                            <button disabled={pagination.current_page === 1} onClick={() => fetchData(pagination.current_page - 1)} className="px-5 py-2 bg-white border border-zinc-200 hover:bg-zinc-50 disabled:opacity-50 rounded-xl text-xs font-black text-zinc-600 transition-all">← Quay lại</button>
                            <button disabled={pagination.current_page === pagination.last_page} onClick={() => fetchData(pagination.current_page + 1)} className="px-5 py-2 bg-white border border-zinc-200 hover:bg-zinc-50 disabled:opacity-50 rounded-xl text-xs font-black text-zinc-600 transition-all">Trang tiếp →</button>
                        </div>
                    </div>
                )}
            </div>

            {/* ======================================================= */}
            {/* MODAL ĐỔI LỊCH CA CHƠI (GIAO DIỆN MỚI) */}
            {/* ======================================================= */}
            {rescheduleModal.isOpen && (
                <div className="fixed inset-0 z-50 bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl p-6 md:p-8 transform transition-all scale-100 opacity-100">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center text-xl">🔄</div>
                            <div>
                                <h3 className="text-lg font-black text-zinc-900">Đổi lịch giữ sân</h3>
                                <p className="text-xs font-semibold text-zinc-500">Khách hàng: <strong className="text-indigo-600">{rescheduleModal.booking?.customer_name}</strong></p>
                            </div>
                        </div>

                        <form onSubmit={handleRescheduleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Chọn sân mới</label>
                                <select
                                    required value={rescheduleForm.court_id}
                                    onChange={(e) => setRescheduleForm({ ...rescheduleForm, court_id: e.target.value })}
                                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-bold text-zinc-800 outline-none focus:border-indigo-500 transition-colors"
                                >
                                    <option value="" disabled>-- Hãy chọn sân --</option>
                                    {courts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Ngày đá</label>
                                <input
                                    type="date" required value={rescheduleForm.booking_date}
                                    onChange={(e) => setRescheduleForm({ ...rescheduleForm, booking_date: e.target.value })}
                                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-bold text-zinc-800 outline-none focus:border-indigo-500 transition-colors"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Giờ bắt đầu</label>
                                    <input
                                        type="time" required value={rescheduleForm.start_time}
                                        onChange={(e) => setRescheduleForm({ ...rescheduleForm, start_time: e.target.value })}
                                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-bold text-zinc-800 outline-none focus:border-indigo-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Giờ kết thúc</label>
                                    <input
                                        type="time" required value={rescheduleForm.end_time}
                                        onChange={(e) => setRescheduleForm({ ...rescheduleForm, end_time: e.target.value })}
                                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-bold text-zinc-800 outline-none focus:border-indigo-500 transition-colors"
                                    />
                                </div>
                            </div>

                            <div className="mt-8 flex gap-3 pt-4 border-t border-zinc-100">
                                <button type="button" onClick={() => setRescheduleModal({ isOpen: false, detailId: null, booking: null })} disabled={isProcessing} className="flex-1 py-3.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 font-black rounded-xl text-xs uppercase tracking-wider transition-colors">
                                    Hủy bỏ
                                </button>
                                <button type="submit" disabled={isProcessing} className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-md transition-colors flex items-center justify-center">
                                    {isProcessing ? <span className="animate-pulse">Đang kiểm tra...</span> : 'Lưu lịch mới'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL XÁC NHẬN CƠ BẢN */}
            {confirmModal.isOpen && (
                <div className="fixed inset-0 z-50 bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-6 md:p-8 transform transition-all scale-100 opacity-100 text-center">
                        <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center text-2xl mx-auto mb-4">⚠️</div>
                        <h3 className="text-lg font-black text-zinc-900 mb-2">{confirmModal.title}</h3>
                        <p className="text-sm font-semibold text-zinc-500 leading-relaxed mb-8">{confirmModal.message}</p>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmModal({ isOpen: false, title: '', message: '', actionData: null })} disabled={isProcessing} className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors">Hủy bỏ</button>
                            <button onClick={executeAction} disabled={isProcessing} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-md transition-colors flex items-center justify-center">
                                {isProcessing ? <span className="animate-pulse">Đang xử lý...</span> : 'Xác nhận'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default SingleBookings;