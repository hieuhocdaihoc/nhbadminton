import React, { useState, useEffect, useMemo } from 'react';
import { adminBookingService } from '../../services/admin/bookingService';
import { adminProductService } from '../../services/admin/productService';
import { adminAdditionalService } from '../../services/admin/additionalService';

const TodayBookings = () => {
    // STATE DỮ LIỆU CỐT LÕI
    const [bookings, setBookings] = useState([]);
    const [products, setProducts] = useState([]);
    const [services, setServices] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState({ type: '', text: '' });

    // STATE BỘ LỌC TÌM KIẾM
    const [searchTerm, setSearchTerm] = useState('');
    const [filterPayment, setFilterPayment] = useState('all');

    // STATE HÓA ĐƠN IN NHIỆT
    const [isBillModalOpen, setIsBillModalOpen] = useState(false);
    const [selectedBill, setSelectedBill] = useState(null);

    // STATE POPUP THÊM MÓN (PRO-SHOP)
    const [addItemModal, setAddItemModal] = useState({ isOpen: false, booking: null });
    const [itemForm, setItemForm] = useState({ selected_val: '', quantity: 1, note: '' });
    const [isAddingItem, setIsAddingItem] = useState(false);

    const todayFormatted = new Date().toLocaleDateString('vi-VN', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    // --- ĐỒNG BỘ DỮ LIỆU TỪ BACKEND ---
    const fetchTodayData = async () => {
        setIsLoading(true);
        try {
            // 1. Tải danh sách ca đấu hôm nay
            const res = await adminBookingService.getTodayBookings();
            setBookings(res.data?.data || []);

            // 2. Tải danh sách hàng hóa và dịch vụ bổ sung phục vụ cho menu thêm món
            const [prodRes, servRes] = await Promise.all([
                adminProductService.getProducts(1, '', ''),
                adminAdditionalService.getServices()
            ]);
            setProducts(prodRes.data?.data?.data || []);
            setServices(servRes.data?.data || []);
        } catch (error) {
            setMessage({ type: 'error', text: 'Không thể đồng bộ sa bàn dữ liệu.' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTodayData();
    }, []);

    // --- THAO TÁC DUYỆT ĐƠN / THU TIỀN ---
    const handleAction = async (id, status, payment_status) => {
        try {
            setMessage({ type: '', text: '' });
            await adminBookingService.updateStatus(id, { status, payment_status });
            setMessage({ type: 'success', text: '✓ Cập nhật trạng thái ca đấu thành công!' });
            fetchTodayData();
        } catch (error) {
            alert('❌ Thao tác thất bại, vui lòng kiểm tra lại kết nối!');
        }
    };

    // =========================================================================
    // LUỒNG XỬ LÝ: TIẾP NHẬN THÊM MÓN (GỌI API ĐA BẢNG CỦA BẠN)
    // =========================================================================
    const openAddItemModal = (booking) => {
        setAddItemModal({ isOpen: true, booking });
        setItemForm({ selected_val: '', quantity: 1, note: '' });
    };

    const handleAddItemSubmit = async (e) => {
        e.preventDefault();
        if (!itemForm.selected_val) return alert("Vui lòng chọn một mặt hàng hoặc dịch vụ!");

        // Bóc tách chuỗi giá trị "product|id" hoặc "service|id"
        const [type, item_id] = itemForm.selected_val.split('|');

        setIsAddingItem(true);
        try {
            await adminBookingService.addItemToBooking(addItemModal.booking.id, {
                type: type,
                item_id: item_id,
                quantity: Number(itemForm.quantity),
                note: itemForm.note
            });
            setMessage({ type: 'success', text: '🛒 Thêm món thành công! Tổng tiền hóa đơn đã tự động tăng.' });
            setAddItemModal({ isOpen: false, booking: null });
            fetchTodayData(); // Reload sa bàn để nhận diện dòng tài chính mới
        } catch (error) {
            const errorMsg = error.response?.data?.message || 'Có lỗi xảy ra khi thêm món!';
            alert('❌ ' + errorMsg);
        } finally {
            setIsAddingItem(false);
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        }
    };

    const handleOpenBill = (booking) => {
        setSelectedBill(booking);
        setIsBillModalOpen(true);
    };

    // --- BỘ LỌC DỮ LIỆU FRONTEND ---
    const filteredBookings = useMemo(() => {
        return bookings.filter(b => {
            const matchSearch = b.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                b.customer_phone?.includes(searchTerm);
            const matchPayment = filterPayment === 'all' ||
                (filterPayment === 'paid' && b.payment_status === 'paid') ||
                (filterPayment === 'unpaid' && b.payment_status !== 'paid');
            return matchSearch && matchPayment;
        });
    }, [bookings, searchTerm, filterPayment]);

    const getInitials = (name) => name ? name.charAt(0).toUpperCase() : '?';

    const renderStatusBadge = (status) => {
        switch (status) {
            case 'confirmed': return <span className="px-3 py-1 bg-blue-50 text-blue-600 border border-blue-100 text-[10px] font-black rounded-full uppercase tracking-wider">✓ Đã chốt</span>;
            case 'completed': return <span className="px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-black rounded-full uppercase tracking-wider">📍 Check-in</span>;
            case 'cancelled': return <span className="px-3 py-1 bg-zinc-100 text-zinc-500 border border-zinc-200 text-[10px] font-black rounded-full uppercase tracking-wider">✕ Đã hủy</span>;
            default: return <span className="px-3 py-1 bg-amber-50 text-amber-600 border border-amber-100 text-[10px] font-black rounded-full uppercase tracking-wider">⏳ Chờ duyệt</span>;
        }
    };

    return (
        <div className="max-w-[1600px] mx-auto space-y-6 font-sans pb-12">

            {/* HEADER DASHBOARD */}
            <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-zinc-200/60 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                        </span>
                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Trạm Điều Phối Lễ Tân</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">Ca Đấu Hôm Nay</h2>
                    <p className="text-sm font-semibold text-blue-600 mt-1">{todayFormatted}</p>
                </div>

                <div className="flex gap-4 relative z-10 w-full md:w-auto">
                    <div className="flex-1 md:flex-none bg-zinc-50 border border-zinc-200/60 px-5 py-3 rounded-2xl flex flex-col justify-center">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Tổng số ca</span>
                        <span className="text-2xl font-black text-zinc-900">{bookings.length}</span>
                    </div>
                    <div className="flex-1 md:flex-none bg-blue-50 border border-blue-100 px-5 py-3 rounded-2xl flex flex-col justify-center">
                        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Chưa thu tiền</span>
                        <span className="text-2xl font-black text-blue-700">
                            {bookings.filter(b => b.payment_status !== 'paid' && b.status !== 'cancelled').length}
                        </span>
                    </div>
                </div>
            </div>

            {message.text && (
                <div className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                    <span>{message.type === 'success' ? '🎉' : '⚠️'}</span> {message.text}
                </div>
            )}

            {/* BẢNG DỮ LIỆU CHÍNH */}
            <div className="bg-white rounded-[2rem] border border-zinc-200/60 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 sm:p-6 border-b border-zinc-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-zinc-50/30">
                    <div className="relative w-full sm:w-72">
                        <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-zinc-400 font-bold">🔍</span>
                        <input type="text" placeholder="Tìm tên hoặc SĐT khách..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700 outline-none focus:border-blue-500 shadow-sm transition-all" />
                    </div>
                    <div className="w-full sm:w-auto flex items-center gap-2">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Lọc:</span>
                        <select value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)} className="w-full sm:w-auto bg-white border border-zinc-200 rounded-xl px-4 py-2.5 text-xs font-bold text-zinc-700 outline-none cursor-pointer hover:border-zinc-300 shadow-sm transition-all">
                            <option value="all">Tất cả trạng thái</option>
                            <option value="unpaid">⚠️ Chưa thu tiền</option>
                            <option value="paid">✓ Đã thu đủ</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm min-w-[1100px]">
                        <thead className="bg-white text-zinc-400 text-[10px] uppercase font-black tracking-widest border-b border-zinc-200/80">
                            <tr>
                                <th className="p-5 pl-8">Khách hàng</th>
                                <th className="p-5">Khung giờ</th>
                                <th className="p-5">Sân thi đấu</th>
                                <th className="p-5">Dịch vụ (Pro-shop)</th>
                                <th className="p-5 text-right">Tài chính</th>
                                <th className="p-5 text-center">Tình trạng</th>
                                <th className="p-5 text-right pr-8">Thao tác quầy</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 bg-white">
                            {isLoading ? (
                                <tr><td colSpan="7" className="py-16 text-center text-xs text-zinc-400 font-bold">Đang tải danh sách ca đấu...</td></tr>
                            ) : filteredBookings.length === 0 ? (
                                <tr><td colSpan="7" className="py-16 text-center"><div className="text-4xl mb-3">📭</div><p className="text-xs text-zinc-400 font-bold">Không tìm thấy ca đấu nào phù hợp.</p></td></tr>
                            ) : (
                                filteredBookings.map(b => {
                                    const detail = b.details?.[0];
                                    const courtName = detail?.court?.name || `Sân ${detail?.court_id?.slice(-2) || '...'}`;

                                    return (
                                        <tr key={b.id} className="hover:bg-zinc-50/80 transition-colors group">
                                            <td className="p-5 pl-8">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 flex items-center justify-center font-black text-xs shadow-inner shrink-0">{getInitials(b.customer_name)}</div>
                                                    <div>
                                                        <strong className="block text-xs font-black text-zinc-900 tracking-tight">{b.customer_name}</strong>
                                                        <span className="text-[10px] font-mono font-semibold text-zinc-500">{b.customer_phone}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <div className="bg-zinc-100 text-zinc-800 font-mono font-black text-[11px] px-3 py-1.5 rounded-lg w-max border border-zinc-200/80 shadow-xs">
                                                    {detail ? `${detail.start_time.slice(0, 5)} ➔ ${detail.end_time.slice(0, 5)}` : '--:--'}
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <span className="font-black text-xs text-zinc-900 block">{courtName}</span>
                                                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Tiêu chuẩn</span>
                                            </td>

                                            {/* CỘT THÊM MÓN: Nút bấm gọi hàm mở Popup Modal */}
                                            <td className="p-5">
                                                <button onClick={() => openAddItemModal(b)} className="px-3 py-1.5 bg-white hover:bg-zinc-50 text-zinc-600 border border-dashed border-zinc-300 rounded-xl text-[10px] font-bold transition-all shadow-xs">
                                                    <span className="text-blue-500 mr-1">+</span> Thêm món
                                                </button>
                                            </td>

                                            <td className="p-5 text-right">
                                                <span className="font-black text-zinc-900 text-sm block tracking-tight">{Number(b.total_price).toLocaleString()} ₫</span>
                                                <div className="mt-1 flex justify-end">
                                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${b.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                                        {b.payment_status === 'paid' ? 'Đã thu tiền' : 'Chưa thanh toán'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-5 text-center"><div className="flex justify-center">{renderStatusBadge(b.status)}</div></td>
                                            <td className="p-5 text-right pr-8">
                                                <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleOpenBill(b)} className="w-8 h-8 flex items-center justify-center bg-white border border-zinc-200 text-zinc-600 hover:text-blue-600 hover:border-blue-200 rounded-full transition-all shadow-xs" title="Xem Bill">🧾</button>
                                                    {b.status === 'pending' && <button onClick={() => handleAction(b.id, 'confirmed', b.payment_status)} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-[10px] font-black uppercase tracking-wider transition-all shadow-md">Duyệt</button>}
                                                    {b.payment_status !== 'paid' && b.status !== 'cancelled' && <button onClick={() => handleAction(b.id, b.status === 'pending' ? 'confirmed' : b.status, 'paid')} className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-full text-[10px] font-black uppercase tracking-wider transition-all shadow-md">Thu tiền</button>}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ======================================================== */}
            {/* POPUP MODAL: LỰA CHỌN SẢN PHẨM / DỊCH VỤ ĐỂ THÊM VÀO HÓA ĐƠN */}
            {/* ======================================================== */}
            {addItemModal.isOpen && (
                <div className="fixed inset-0 z-50 bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-6 md:p-8 transform transition-all text-left">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-xl">🛒</div>
                            <div>
                                <h3 className="text-lg font-black text-zinc-900">Bán thêm dịch vụ</h3>
                                <p className="text-xs font-semibold text-zinc-500">Khách hàng: <strong className="text-blue-600">{addItemModal.booking?.customer_name}</strong></p>
                            </div>
                        </div>

                        <form onSubmit={handleAddItemSubmit} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">Chọn mặt hàng / Dịch vụ</label>
                                <select
                                    required value={itemForm.selected_val}
                                    onChange={(e) => setItemForm({ ...itemForm, selected_val: e.target.value })}
                                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-bold text-zinc-800 outline-none focus:border-blue-500 transition-colors cursor-pointer"
                                >
                                    <option value="" disabled>-- Vui lòng chọn --</option>
                                    {products.length > 0 && (
                                        <optgroup label="🥤 SẢN PHẨM (NƯỚC, CẦU...)" className="font-black text-zinc-400">
                                            {products.map(p => (
                                                <option key={`p_${p.id}`} value={`product|${p.id}`} className="font-bold text-zinc-800" disabled={p.stock_quantity <= 0}>
                                                    {p.name} - {Number(p.selling_price).toLocaleString()}đ {p.stock_quantity <= 0 ? '(HẾT HÀNG)' : `(Còn ${p.stock_quantity})`}
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                    {services.length > 0 && (
                                        <optgroup label="🏸 DỊCH VỤ BỔ SUNG" className="font-black text-zinc-400 mt-2">
                                            {services.map(s => (
                                                <option key={`s_${s.id}`} value={`service|${s.id}`} className="font-bold text-zinc-800" disabled={s.status === 'inactive'}>
                                                    {s.name} - {Number(s.price).toLocaleString()}đ
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">Số lượng</label>
                                <input type="number" min="1" required value={itemForm.quantity} onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-bold text-zinc-800 outline-none focus:border-blue-500 transition-colors" />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">Ghi chú (Tùy chọn)</label>
                                <input type="text" placeholder="VD: Đá lạnh, lấy vợt căng 11kg..." value={itemForm.note} onChange={(e) => setItemForm({ ...itemForm, note: e.target.value })} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-bold text-zinc-800 outline-none focus:border-blue-500 transition-colors" />
                            </div>

                            <div className="mt-8 flex gap-3 pt-4 border-t border-zinc-100">
                                <button type="button" onClick={() => setAddItemModal({ isOpen: false, booking: null })} disabled={isAddingItem} className="flex-1 py-3.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 font-black rounded-xl text-xs uppercase tracking-wider transition-colors">Hủy</button>
                                <button type="submit" disabled={isAddingItem} className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-md flex items-center justify-center">{isAddingItem ? <span className="animate-pulse">Đang thêm...</span> : '🛒 Thêm vào Bill'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ======================================================== */}
            {/* POPUP: HÓA ĐƠN IN NHIỆT (HIỂN THỊ ĐỦ TIỀN SÂN + TIỀN MÓN THÊM) */}
            {/* ======================================================== */}
            {isBillModalOpen && selectedBill && (
                <div onClick={() => setIsBillModalOpen(false)} className="fixed inset-0 z-50 bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div
                        onClick={e => e.stopPropagation()}
                        className="bg-white w-full max-w-[340px] shadow-2xl p-6 relative font-mono text-zinc-900"
                        style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 8px), calc(100% - 4px) 100%, calc(100% - 8px) calc(100% - 8px), calc(100% - 12px) 100%, calc(100% - 16px) calc(100% - 8px), calc(100% - 20px) 100%, calc(100% - 24px) calc(100% - 8px), calc(100% - 28px) 100%, calc(100% - 32px) calc(100% - 8px), calc(100% - 36px) 100%, calc(100% - 40px) calc(100% - 8px), calc(100% - 44px) 100%, calc(100% - 48px) calc(100% - 8px), calc(100% - 52px) 100%, calc(100% - 56px) calc(100% - 8px), calc(100% - 60px) 100%, calc(100% - 64px) calc(100% - 8px), calc(100% - 68px) 100%, calc(100% - 72px) calc(100% - 8px), calc(100% - 76px) 100%, calc(100% - 80px) calc(100% - 8px), calc(100% - 84px) 100%, calc(100% - 88px) calc(100% - 8px), calc(100% - 92px) 100%, calc(100% - 96px) calc(100% - 8px), calc(100% - 100px) 100%, calc(100% - 104px) calc(100% - 8px), calc(100% - 108px) 100%, calc(100% - 112px) calc(100% - 8px), calc(100% - 116px) 100%, calc(100% - 120px) calc(100% - 8px), calc(100% - 124px) 100%, calc(100% - 128px) calc(100% - 8px), calc(100% - 132px) 100%, calc(100% - 136px) calc(100% - 8px), calc(100% - 140px) 100%, calc(100% - 144px) calc(100% - 8px), calc(100% - 148px) 100%, calc(100% - 152px) calc(100% - 8px), calc(100% - 156px) 100%, calc(100% - 160px) calc(100% - 8px), calc(100% - 164px) 100%, calc(100% - 168px) calc(100% - 8px), calc(100% - 172px) 100%, calc(100% - 176px) calc(100% - 8px), calc(100% - 180px) 100%, calc(100% - 184px) calc(100% - 8px), calc(100% - 188px) 100%, calc(100% - 192px) calc(100% - 8px), calc(100% - 196px) 100%, calc(100% - 200px) calc(100% - 8px), calc(100% - 204px) 100%, calc(100% - 208px) calc(100% - 8px), calc(100% - 212px) 100%, calc(100% - 216px) calc(100% - 8px), calc(100% - 220px) 100%, calc(100% - 224px) calc(100% - 8px), calc(100% - 228px) 100%, calc(100% - 232px) calc(100% - 8px), calc(100% - 236px) 100%, calc(100% - 240px) calc(100% - 8px), calc(100% - 244px) 100%, calc(100% - 248px) calc(100% - 8px), calc(100% - 252px) 100%, calc(100% - 256px) calc(100% - 8px), calc(100% - 260px) 100%, calc(100% - 264px) calc(100% - 8px), calc(100% - 268px) 100%, calc(100% - 272px) calc(100% - 8px), calc(100% - 276px) 100%, calc(100% - 280px) calc(100% - 8px), calc(100% - 284px) 100%, calc(100% - 288px) calc(100% - 8px), calc(100% - 292px) 100%, calc(100% - 296px) calc(100% - 8px), calc(100% - 300px) 100%, calc(100% - 304px) calc(100% - 8px), calc(100% - 308px) 100%, calc(100% - 312px) calc(100% - 8px), calc(100% - 316px) 100%, calc(100% - 320px) calc(100% - 8px), calc(100% - 324px) 100%, calc(100% - 328px) calc(100% - 8px), calc(100% - 332px) 100%, calc(100% - 336px) calc(100% - 8px), 0 100%)' }}
                    >
                        <div className="text-center mb-5">
                            <h2 className="text-[22px] font-black tracking-tighter uppercase leading-none mb-1.5">NH BADMINTON</h2>
                            <p className="text-[10px] text-zinc-500 leading-relaxed">Sân chơi cầu lông đẳng cấp<br />SĐT: 0987.654.321</p>
                            <h3 className="text-sm font-bold uppercase mt-5 pb-3 border-b border-dashed border-zinc-400">Hóa Đơn Thanh Toán</h3>
                        </div>

                        <div className="space-y-1.5 text-xs mb-5">
                            <div className="flex justify-between"><span>Mã GD:</span> <strong className="uppercase">#{selectedBill.booking_code?.split('_')[1] || selectedBill.id?.slice(0, 6)}</strong></div>
                            <div className="flex justify-between"><span>Ngày in:</span> <span>{new Date().toLocaleString('vi-VN')}</span></div>
                            <div className="flex justify-between"><span>Khách hàng:</span> <strong className="truncate max-w-[120px] text-right">{selectedBill.customer_name}</strong></div>
                        </div>

                        <table className="w-full text-[11px] mb-5 text-left">
                            <thead className="border-y border-dashed border-zinc-400">
                                <tr>
                                    <th className="py-1.5 font-bold w-1/2">MÔ TẢ</th>
                                    <th className="py-1.5 font-bold text-center">SL</th>
                                    <th className="py-1.5 font-bold text-right">THÀNH TIỀN</th>
                                </tr>
                            </thead>
                            <tbody className="border-b border-dashed border-zinc-400">
                                {/* DÒNG 1: TIỀN GIỮ SÂN GỐC */}
                                <tr>
                                    <td className="py-2 pr-2">
                                        <strong className="block text-xs">{selectedBill.details?.[0]?.court?.name || 'Sân thuê'}</strong>
                                        <span className="text-[10px] text-zinc-500 tracking-tighter">
                                            {selectedBill.details?.[0]?.start_time?.slice(0, 5)} ➔ {selectedBill.details?.[0]?.end_time?.slice(0, 5)}
                                        </span>
                                    </td>
                                    <td className="py-2 text-center align-top font-bold text-xs">1</td>
                                    <td className="py-2 text-right align-top font-bold text-xs">{Number(selectedBill.subtotal_court || selectedBill.total_price).toLocaleString()}</td>
                                </tr>

                                {/* DÒNG 2+: DUYỆT QUA CÁC SẢN PHẨM/DỊCH VỤ GỌI THÊM ĐỂ HIỂN THỊ LÊN BILL */}
                                {selectedBill.service_details?.map((item) => (
                                    <tr key={item.id} className="border-t border-dotted border-zinc-200">
                                        <td className="py-2 pr-2">
                                            <strong className="block text-[11px] text-zinc-800">{item.product?.name || item.service?.name || 'Dịch vụ thêm'}</strong>
                                            {item.note && <span className="text-[9px] text-zinc-400 block font-semibold">*{item.note}</span>}
                                        </td>
                                        <td className="py-2 text-center align-top text-zinc-600">{item.quantity}</td>
                                        <td className="py-2 text-right align-top font-bold text-zinc-800">{Number(item.total_price).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="space-y-1.5 text-xs mb-6">
                            <div className="flex justify-between text-zinc-600"><span>Tiền sân gốc:</span> <span>{Number(selectedBill.subtotal_court || selectedBill.total_price).toLocaleString()}đ</span></div>
                            <div className="flex justify-between text-zinc-600"><span>Tiền dịch vụ thêm:</span> <span>{Number(selectedBill.subtotal_service || 0).toLocaleString()}đ</span></div>
                            <div className="flex justify-between text-base mt-3 pt-3 border-t-2 border-zinc-900 font-black tracking-tight">
                                <span>TỔNG THU:</span>
                                <span>{Number(selectedBill.total_price).toLocaleString()}đ</span>
                            </div>
                        </div>

                        <div className="text-center text-[10px] font-semibold text-zinc-500 mb-8 pb-4">
                            Cảm ơn quý khách và hẹn gặp lại! <br />
                            Wifi: NH_Badminton - Pass: 88888888
                        </div>

                        <div className="flex gap-2 font-sans relative z-10 print:hidden mt-4">
                            <button onClick={() => setIsBillModalOpen(false)} className="flex-1 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 font-bold rounded-xl text-xs transition-colors">Đóng</button>
                            <button onClick={() => alert('Đang kích hoạt lệnh kết nối máy in hóa đơn nhiệt...')} className="flex-1 py-2.5 bg-zinc-900 hover:bg-black text-white font-bold rounded-xl text-xs shadow-md transition-all">🖨️ IN BILL</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TodayBookings;