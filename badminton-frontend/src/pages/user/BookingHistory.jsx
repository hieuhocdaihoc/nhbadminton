import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { bookingService } from '../../services/user/bookingService';

const BookingHistory = () => {
    // 1. STATES QUẢN LÝ DỮ LIỆU TỪ API
    const [bookings, setBookings] = useState([]);
    const [pagination, setPagination] = useState({ current_page: 1, last_page: 1 });
    const [isLoading, setIsLoading] = useState(true);

    // 2. STATES ĐIỀU KHIỂN BỘ LỌC & LỖI
    const [activeTab, setActiveTab] = useState('upcoming'); // Mặc định mở tab 'Lịch sắp tới'
    const [errorMessage, setErrorMessage] = useState('');

    // --- HÀM ĐỒNG BỘ DỮ LIỆU TỪ SERVER ---
    const fetchHistoryData = async (tab, page) => {
        setIsLoading(true);
        setErrorMessage('');
        try {
            const response = await bookingService.getUserBookingHistory(tab, page);
            const responseData = response.data?.data;

            if (responseData) {
                // Hứng dữ liệu danh sách đơn
                setBookings(responseData.data || []);
                // Hứng dữ liệu phân trang từ Laravel paginate()
                setPagination({
                    current_page: responseData.current_page || 1,
                    last_page: responseData.last_page || 1
                });
            } else {
                setBookings([]);
            }
        } catch (error) {
            console.error('Lỗi tải lịch sử:', error);
            if (error.response?.status === 401) {
                setErrorMessage('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
            } else {
                setErrorMessage('Không thể tải dữ liệu. Vui lòng kiểm tra lại đường truyền.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Tải lại dữ liệu mỗi khi người dùng đổi Tab hoặc bấm sang Trang khác
    useEffect(() => {
        fetchHistoryData(activeTab, 1); // Đổi tab thì reset về trang 1
    }, [activeTab]);

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.last_page) {
            fetchHistoryData(activeTab, newPage);
        }
    };

    // --- HÀM MAP HUY HIỆU TRẠNG THÁI BILL ---
    const renderStatusBadge = (status, paymentStatus) => {
        if (status === 'cancelled') {
            return <span className="px-2.5 py-1 bg-red-50 text-red-600 border border-red-200 text-[11px] font-bold rounded-lg block text-center">✕ Đã hủy</span>;
        }
        if (paymentStatus === 'paid') {
            return <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold rounded-lg block text-center">✓ Đã thanh toán</span>;
        }
        return <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold rounded-lg block text-center">⏳ Chưa thanh toán</span>;
    };

    return (
        <div className="min-h-screen bg-zinc-50/60 py-10">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

                {/* HEADER & TABS LỌC */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">Lịch Sử Đặt Sân</h1>
                        <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">Kiểm tra thông tin chi tiết các ca đấu và trạng thái thanh toán.</p>
                    </div>

                    {/* Dải Tab chuyển đổi khớp với Query Params của API */}
                    <div className="flex bg-white p-1 rounded-xl border border-zinc-200 shadow-xs self-start md:self-auto">
                        <button
                            onClick={() => setActiveTab('upcoming')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'upcoming' ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
                        >
                            Lịch sắp tới
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'history' ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
                        >
                            Đã qua / Đã hủy
                        </button>
                        <button
                            onClick={() => setActiveTab('all')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'all' ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
                        >
                            Tất cả
                        </button>
                    </div>
                </div>

                {errorMessage && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl">
                        {errorMessage}
                    </div>
                )}

                {/* BẢNG DANH SÁCH ĐƠN */}
                <div className="bg-white rounded-3xl border border-zinc-200/80 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                                <tr className="bg-zinc-50/50 border-b border-zinc-100 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                                    <th className="p-4 pl-6">Mã Đơn / Loại</th>
                                    <th className="p-4">Thời Gian & Sân Đấu</th>
                                    <th className="p-4 text-center">Số Ca</th>
                                    <th className="p-4 text-right">Tổng Tiền</th>
                                    <th className="p-4 text-center w-36">Trạng Thái</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 text-sm">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan="5" className="py-16 text-center text-xs font-bold text-zinc-400">
                                            <span className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin inline-block align-middle mr-2"></span>
                                            Đang tải dữ liệu từ máy chủ...
                                        </td>
                                    </tr>
                                ) : bookings.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="py-16 text-center text-zinc-400">
                                            <p className="text-sm font-bold text-zinc-500">Danh sách trống.</p>
                                            <p className="text-xs mt-1">Không tìm thấy ca đặt sân nào thuộc danh mục này.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    bookings.map((item) => (
                                        <tr key={item.booking_id} className="hover:bg-zinc-50/40 transition-colors">

                                            {/* Cột 1: Mã Đơn */}
                                            <td className="p-4 pl-6 align-middle">
                                                <span className="text-xs font-mono font-black text-zinc-900 block">
                                                    {item.booking_code}
                                                </span>
                                                <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-bold border ${item.type === 'recurring_session' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                                                    }`}>
                                                    {item.type_label}
                                                </span>
                                                <span className="block text-[10px] text-zinc-400 mt-1">
                                                    Đặt lúc: {item.created_at}
                                                </span>
                                            </td>

                                            {/* Cột 2: Thời gian & Sân (Trích xuất từ mảng summary) */}
                                            <td className="p-4 align-middle">
                                                {item.summary ? (
                                                    <div>
                                                        <p className="text-xs font-bold text-zinc-800">
                                                            📅 Ngày: <span className="text-blue-600">{item.summary.play_date}</span>
                                                        </p>
                                                        <p className="text-xs font-mono text-zinc-600 mt-0.5">
                                                            ⏰ Khung: {item.summary.time_slot}
                                                        </p>
                                                        <p className="text-[11px] text-zinc-500 mt-0.5 font-medium">
                                                            📍 Hướng dẫn: Sân thi đấu số {item.summary.court_id}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-zinc-400 italic">Chi tiết đang cập nhật</span>
                                                )}
                                            </td>

                                            {/* Cột 3: Số lượng ca */}
                                            <td className="p-4 text-center align-middle font-bold text-zinc-700">
                                                {item.details_count || 1} block
                                            </td>

                                            {/* Cột 4: Tổng chi phí */}
                                            <td className="p-4 text-right align-middle font-black text-blue-600 text-base">
                                                {Number(item.total_price).toLocaleString()} đ
                                            </td>

                                            {/* Cột 5: Trạng thái thanh toán */}
                                            <td className="p-4 pr-6 align-middle">
                                                {renderStatusBadge(item.status, item.payment_status)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* KHU VỰC PHÂN TRANG (PAGINATION) */}
                    {pagination.last_page > 1 && (
                        <div className="p-4 bg-zinc-50/50 border-t border-zinc-100 flex items-center justify-between">
                            <button
                                disabled={pagination.current_page === 1}
                                onClick={() => handlePageChange(pagination.current_page - 1)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${pagination.current_page === 1 ? 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed' : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'}`}
                            >
                                ← Trang trước
                            </button>
                            <span className="text-xs font-bold text-zinc-600">
                                Trang {pagination.current_page} / {pagination.last_page}
                            </span>
                            <button
                                disabled={pagination.current_page === pagination.last_page}
                                onClick={() => handlePageChange(pagination.current_page + 1)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${pagination.current_page === pagination.last_page ? 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed' : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'}`}
                            >
                                Trang sau →
                            </button>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default BookingHistory;