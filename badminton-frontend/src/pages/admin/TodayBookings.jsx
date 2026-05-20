import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { adminBookingService } from '../../services/admin/bookingService';
import { adminProductService } from '../../services/admin/productService';
import { adminAdditionalService } from '../../services/admin/additionalService';
import { adminCourtService } from '../../services/admin/courtService';


const emptyItemRow = {
    selected_val: '',
    quantity: 1,
    note: ''
};

const TodayBookings = () => {
    const [bookings, setBookings] = useState([]);
    const [products, setProducts] = useState([]);
    const [services, setServices] = useState([]);
    const [courts, setCourts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState({ type: '', text: '' });

    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterCourt, setFilterCourt] = useState('all');

    const [isBillModalOpen, setIsBillModalOpen] = useState(false);
    const [selectedBill, setSelectedBill] = useState(null);

    const [addItemModal, setAddItemModal] = useState({ isOpen: false, booking: null });
    const [itemRows, setItemRows] = useState([{ ...emptyItemRow }]);
    const [isAddingItem, setIsAddingItem] = useState(false);

    const todayFormatted = new Date().toLocaleDateString('vi-VN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // -------------------------------------------------------------
    // GỘP CÁC KHUNG GIỜ LIỀN NHAU
    // Nếu 17:00-18:00 và 18:00-19:00 => 17:00-19:00
    // Nếu 08:00-10:00 và 14:00-16:00 => tách thành 2 dòng
    // -------------------------------------------------------------
    const buildDisplayRows = (bookingList) => {
        const rows = [];

        bookingList.forEach((booking) => {
            const details = [...(booking.details || [])].sort((a, b) => {
                const dateCompare = String(a.booking_date).localeCompare(String(b.booking_date));
                if (dateCompare !== 0) return dateCompare;

                const courtCompare = String(a.court_id).localeCompare(String(b.court_id));
                if (courtCompare !== 0) return courtCompare;

                return String(a.start_time).localeCompare(String(b.start_time));
            });

            if (details.length === 0) {
                rows.push({
                    ...booking,
                    _displayKey: booking.id,
                    _groupDetails: [],
                    _groupStart: null,
                    _groupEnd: null,
                    _groupCourtName: '—',
                    _groupPrice: Number(booking.subtotal_court || booking.total_price || 0),
                });

                return;
            }

            let currentGroup = [details[0]];

            for (let i = 1; i < details.length; i++) {
                const previous = currentGroup[currentGroup.length - 1];
                const current = details[i];

                const isSameDate = previous.booking_date === current.booking_date;
                const isSameCourt = previous.court_id === current.court_id;
                const isContinuous = previous.end_time === current.start_time;

                if (isSameDate && isSameCourt && isContinuous) {
                    currentGroup.push(current);
                } else {
                    rows.push(createDisplayRow(booking, currentGroup));
                    currentGroup = [current];
                }
            }

            rows.push(createDisplayRow(booking, currentGroup));
        });

        return rows;
    };

    const createDisplayRow = (booking, groupDetails) => {
        const firstDetail = groupDetails[0];
        const lastDetail = groupDetails[groupDetails.length - 1];

        return {
            ...booking,
            _displayKey: `${booking.id}_${firstDetail?.id || Math.random()}`,
            _groupDetails: groupDetails,
            _groupStart: firstDetail?.start_time,
            _groupEnd: lastDetail?.end_time,
            _groupCourtName: firstDetail?.court?.name || `Sân ${firstDetail?.court_id?.slice(-2) || '...'}`,
            _groupPrice: groupDetails.reduce((sum, detail) => sum + Number(detail.price || 0), 0),
        };
    };

    // --- FETCH ---
    const fetchTodayData = async () => {
        setIsLoading(true);

        try {
            const [bookingRes, prodRes, servRes, courtRes] = await Promise.all([
                adminBookingService.getTodayBookings(),
                adminProductService.getProducts(1, '', ''),
                adminAdditionalService.getServices(),
                adminCourtService.getCourts()
            ]);

            setBookings(bookingRes.data?.data || []);
            setProducts(prodRes.data?.data?.data || []);
            setServices(servRes.data?.data || []);

            const courtData = courtRes.data?.data?.data || courtRes.data?.data || [];
            setCourts(courtData);
        } catch (error) {
            console.error('Lỗi tải dữ liệu hôm nay:', error);
            setMessage({ type: 'error', text: 'Không thể tải dữ liệu.' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTodayData();
    }, []);

    // --- ACTIONS ---
    const handleAction = async (id, status, payment_status) => {
        try {
            setMessage({ type: '', text: '' });

            await adminBookingService.updateStatus(id, { status, payment_status });

            setMessage({ type: 'success', text: '✓ Cập nhật thanh toán thành công!' });
            fetchTodayData();
        } catch (error) {
            alert(error.response?.data?.message || 'Thao tác thất bại!');
        }
    };

    const openAddItemModal = (booking) => {
        setAddItemModal({ isOpen: true, booking });
        setItemRows([{ ...emptyItemRow }]);
    };

    const handleAddItemRow = () => {
        setItemRows(prev => [...prev, { ...emptyItemRow }]);
    };

    const handleRemoveItemRow = (index) => {
        setItemRows(prev => prev.filter((_, i) => i !== index));
    };

    const handleItemRowChange = (index, field, value) => {
        const updatedRows = [...itemRows];
        updatedRows[index][field] = value;
        setItemRows(updatedRows);
    };

    const handleCloseAddItemModal = () => {
        setAddItemModal({ isOpen: false, booking: null });
        setItemRows([{ ...emptyItemRow }]);
    };

    const handleAddItemSubmit = async (e) => {
        e.preventDefault();

        const hasInvalidRow = itemRows.some(item =>
            !item.selected_val || !item.quantity || Number(item.quantity) < 1
        );

        if (hasInvalidRow) {
            return alert('Vui lòng chọn đầy đủ mặt hàng/dịch vụ và số lượng hợp lệ!');
        }

        const items = itemRows.map(item => {
            const [type, item_id] = item.selected_val.split('|');

            return {
                type,
                item_id,
                quantity: Number(item.quantity),
                note: item.note || null,
            };
        });

        setIsAddingItem(true);

        try {
            await adminBookingService.addItemsToBooking(addItemModal.booking.id, {
                items,
            });

            setMessage({
                type: 'success',
                text: `Thêm ${items.length} món vào bill thành công!`
            });

            handleCloseAddItemModal();
            fetchTodayData();
        } catch (error) {
            alert(error.response?.data?.message || 'Có lỗi xảy ra khi thêm món!');
        } finally {
            setIsAddingItem(false);
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        }
    };

    const handleOpenBill = (booking) => {
        setSelectedBill(booking);
        setIsBillModalOpen(true);
    };

    // --- FILTER ---
    const displayBookings = useMemo(() => {
        return buildDisplayRows(bookings);
    }, [bookings]);

    const activeCourts = useMemo(() => {
        return courts
            .filter(court => court.status !== 'inactive')
            .sort((a, b) => String(a.name).localeCompare(String(b.name)));
    }, [courts]);

    const filteredBookings = useMemo(() => {
        return displayBookings.filter(b => {
            const matchSearch =
                !searchTerm ||
                b.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                b.customer_phone?.includes(searchTerm);

            const matchFilter =
                filterStatus === 'all' ||
                (filterStatus === 'unpaid' && b.payment_status === 'unpaid' && b.status !== 'cancelled') ||
                (filterStatus === 'partial' && b.payment_status === 'partially_paid' && b.status !== 'cancelled') ||
                (filterStatus === 'paid' && b.payment_status === 'paid');

            const matchCourt =
                filterCourt === 'all' ||
                b._groupDetails?.some(detail => detail.court_id === filterCourt);

            return matchSearch && matchFilter && matchCourt;
        });
    }, [displayBookings, searchTerm, filterStatus, filterCourt]);

    const statusConfig = {
        pending: { dot: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50', label: 'Chờ duyệt' },
        confirmed: { dot: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50', label: 'Đã chốt' },
        completed: { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', label: 'Check-in' },
        cancelled: { dot: 'bg-zinc-400', text: 'text-zinc-500', bg: 'bg-zinc-100', label: 'Đã hủy' },
    };

    const unpaidCount = filteredBookings.filter(b => b.payment_status === 'unpaid' && b.status !== 'cancelled').length;
    const partialCount = filteredBookings.filter(b => b.payment_status === 'partially_paid' && b.status !== 'cancelled').length;
    const paidCount = filteredBookings.filter(b => b.payment_status === 'paid').length;

    const inputClass = "w-full bg-[#f8f8fa] border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200 transition-all";

    const filterTabs = [
        { key: 'all', label: 'Tất cả', count: filteredBookings.length },
        { key: 'unpaid', label: 'Chưa thu', count: unpaidCount },
        { key: 'partial', label: 'Nợ Pro-shop', count: partialCount },
        { key: 'paid', label: 'Đã thu', count: paidCount },
    ];

    return (
        <div className="max-w-[1400px] mx-auto space-y-5">

            {/* HEADER */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-base font-semibold text-zinc-800">Ca đấu hôm nay</h2>
                    <p className="text-xs text-zinc-400 mt-0.5">{todayFormatted}</p>
                </div>

                <div className="flex gap-2.5">
                    <div className="bg-white border border-zinc-200/60 px-4 py-2 rounded-lg text-center min-w-[70px]">
                        <p className="text-lg font-bold text-zinc-800">{filteredBookings.length}</p>
                        <p className="text-[10px] text-zinc-400 uppercase">Đang xem</p>
                    </div>

                    {(unpaidCount > 0 || partialCount > 0) && (
                        <div className="bg-amber-50 border border-amber-200/60 px-4 py-2 rounded-lg text-center min-w-[70px]">
                            <p className="text-lg font-bold text-amber-600">{unpaidCount + partialCount}</p>
                            <p className="text-[10px] text-amber-500 uppercase">Cần thu</p>
                        </div>
                    )}
                </div>
            </div>

            {/* TOAST */}
            <AnimatePresence>
                {message.text && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className={`p-3 rounded-lg text-xs font-medium ${
                            message.type === 'success'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-red-50 text-red-600 border border-red-200'
                        }`}
                    >
                        {message.text}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* TOOLBAR */}
            <div className="bg-white rounded-xl border border-zinc-200/60 p-4">
                <div className="flex flex-col xl:flex-row gap-3 justify-between items-start xl:items-center">
                    <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
                        <div className="relative w-full sm:w-72">
                            <svg
                                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <circle cx="11" cy="11" r="8" />
                                <path d="m21 21-4.3-4.3" />
                            </svg>

                            <input
                                type="text"
                                placeholder="Tìm tên hoặc SĐT..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-700 outline-none focus:border-zinc-300 focus:bg-white transition-all"
                            />
                        </div>

                        <select
                            value={filterCourt}
                            onChange={(e) => setFilterCourt(e.target.value)}
                            className="w-full sm:w-44 px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-700 outline-none focus:border-zinc-300 focus:bg-white transition-all"
                        >
                            <option value="all">Tất cả sân</option>

                            {activeCourts.map(court => (
                                <option key={court.id} value={court.id}>
                                    {court.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg overflow-x-auto max-w-full">
                        {filterTabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setFilterStatus(tab.key)}
                                className={`px-3 py-1.5 rounded-md text-[11px] font-medium whitespace-nowrap transition-all ${
                                    filterStatus === tab.key
                                        ? 'bg-white text-zinc-800 shadow-sm'
                                        : 'text-zinc-500 hover:text-zinc-700'
                                }`}
                            >
                                {tab.label}

                                {tab.count > 0 && (
                                    <span
                                        className={`ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full ${
                                            filterStatus === tab.key
                                                ? 'bg-zinc-900 text-white'
                                                : 'bg-zinc-200 text-zinc-500'
                                        }`}
                                    >
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* TABLE */}
            {isLoading ? (
                <div className="bg-white rounded-xl border border-zinc-200/60 p-16 text-center">
                    <div className="inline-block w-6 h-6 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin mb-3" />
                    <p className="text-xs text-zinc-400">Đang tải...</p>
                </div>
            ) : filteredBookings.length === 0 ? (
                <div className="bg-white rounded-xl border border-zinc-200/60 p-16 text-center">
                    <p className="text-3xl mb-2 opacity-30">📭</p>
                    <p className="text-sm text-zinc-400">Không tìm thấy ca đấu nào</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-zinc-200/60 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1100px]">
                            <thead>
                                <tr className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider bg-zinc-50/60 border-b border-zinc-100">
                                    <th className="text-left py-3 px-5" style={{ width: '220px' }}>Khách hàng</th>
                                    <th className="text-left py-3 px-3" style={{ width: '130px' }}>Khung giờ</th>
                                    <th className="text-left py-3 px-3" style={{ width: '90px' }}>Sân</th>
                                    <th className="text-left py-3 px-3" style={{ width: '100px' }}>Pro-shop</th>
                                    <th className="text-right py-3 px-3" style={{ width: '160px' }}>Thanh toán</th>
                                    <th className="text-center py-3 px-3" style={{ width: '90px' }}>Trạng thái</th>
                                    <th className="text-right py-3 px-5" style={{ width: '210px' }}>Thao tác</th>
                                </tr>
                            </thead>

                            <tbody>
                                {filteredBookings.map(b => {
                                    const timeStr = b._groupStart && b._groupEnd
                                        ? `${b._groupStart.slice(0, 5)} – ${b._groupEnd.slice(0, 5)}`
                                        : '—';

                                    const sc = statusConfig[b.status] || statusConfig.pending;
                                    const isCancelled = b.status === 'cancelled';

                                    const courtAmount = Number(b._groupPrice || b.subtotal_court || 0);
                                    const serviceAmount = Number(b.subtotal_service || 0);
                                    const totalAmount = Number(b.total_price || 0);
                                    const paidAmount = Number(b.deposit_amount || 0);
                                    const remainingAmount = Number(b.remaining_amount || 0);

                                    const isOnlyProshopDebt =
                                        serviceAmount > 0 &&
                                        remainingAmount > 0 &&
                                        paidAmount >= Number(b.subtotal_court || 0);

                                    return (
                                        <tr
                                            key={b._displayKey}
                                            className={`border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50/40 transition-colors group ${
                                                isCancelled ? 'opacity-45' : ''
                                            }`}
                                        >
                                            <td className="py-3.5 px-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-500 font-medium text-xs shrink-0">
                                                        {b.customer_name?.charAt(0)?.toUpperCase() || '?'}
                                                    </div>

                                                    <div className="min-w-0">
                                                        <p className="text-[13px] font-medium text-zinc-800 truncate">
                                                            {b.customer_name}
                                                        </p>
                                                        <p className="text-[11px] text-zinc-400 font-mono truncate">
                                                            {b.customer_phone}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="py-3.5 px-3">
                                                <span className="text-xs font-mono text-zinc-600">
                                                    {timeStr}
                                                </span>

                                                {b._groupDetails?.length > 1 && (
                                                    <p className="text-[10px] text-lime-600 font-semibold mt-0.5">
                                                        Gộp {b._groupDetails.length} khung liền nhau
                                                    </p>
                                                )}
                                            </td>

                                            <td className="py-3.5 px-3 text-xs text-zinc-600">
                                                {b._groupCourtName}
                                            </td>

                                            <td className="py-3.5 px-3">
                                                {!isCancelled && (
                                                    <button
                                                        onClick={() => openAddItemModal(b)}
                                                        className="px-2.5 py-1 text-zinc-500 border border-dashed border-zinc-300 rounded text-[10px] hover:bg-zinc-50 hover:border-zinc-400 transition-colors"
                                                    >
                                                        + Thêm dịch vụ sử dụng
                                                    </button>
                                                )}

                                                {serviceAmount > 0 && (
                                                    <p className="mt-1 text-[10px] font-semibold text-violet-600">
                                                        Pro-shop: {serviceAmount.toLocaleString()}₫
                                                    </p>
                                                )}
                                            </td>

                                            <td className="py-3.5 px-3 text-right">
                                                <div className="space-y-0.5">
                                                    <p className="text-[11px] text-zinc-500">
                                                        Sân:{' '}
                                                        <span className="font-semibold text-zinc-800">
                                                            {courtAmount.toLocaleString()}₫
                                                        </span>
                                                    </p>

                                                    <p className="text-[11px] text-zinc-500">
                                                        Pro-shop:{' '}
                                                        <span className="font-semibold text-violet-600">
                                                            {serviceAmount.toLocaleString()}₫
                                                        </span>
                                                    </p>

                                                    <p className="text-[11px] text-zinc-500">
                                                        Đã thu:{' '}
                                                        <span className="font-semibold text-emerald-600">
                                                            {paidAmount.toLocaleString()}₫
                                                        </span>
                                                    </p>

                                                    <p className="text-[11px] text-zinc-500">
                                                        Còn thu:{' '}
                                                        <span className={`font-bold ${
                                                            remainingAmount > 0 ? 'text-amber-600' : 'text-zinc-400'
                                                        }`}>
                                                            {remainingAmount.toLocaleString()}₫
                                                        </span>
                                                    </p>

                                                    <p className="pt-0.5 text-xs font-bold text-zinc-900">
                                                        Tổng: {totalAmount.toLocaleString()}₫
                                                    </p>

                                                    {b.payment_status === 'paid' ? (
                                                        <p className="text-[10px] text-emerald-600">✓ Đã thu đủ</p>
                                                    ) : isOnlyProshopDebt ? (
                                                        <p className="text-[10px] font-bold text-violet-600">
                                                            Còn thu Pro-shop
                                                        </p>
                                                    ) : b.payment_status === 'partially_paid' ? (
                                                        <p className="text-[10px] font-bold text-amber-600">
                                                            ⚠ Thanh toán một phần
                                                        </p>
                                                    ) : (
                                                        <p className="text-[10px] text-amber-500">○ Chưa thu</p>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="py-3.5 px-3 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${sc.bg} ${sc.text}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                                    {sc.label}
                                                </span>
                                            </td>

                                            <td className="py-3.5 px-5 text-right">
                                                <div className="flex items-center justify-end gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleOpenBill(b)}
                                                        className="px-2.5 py-1 border border-zinc-200 text-zinc-500 rounded text-[10px] hover:bg-zinc-50 transition-colors"
                                                        title="Xem Bill"
                                                    >
                                                        🧾 Bill
                                                    </button>

                                                    {b.status === 'pending' && (
                                                        <button
                                                            onClick={() => handleAction(b.id, 'confirmed', b.payment_status)}
                                                            className="px-2.5 py-1 bg-zinc-900 text-white rounded text-[10px] font-medium hover:bg-zinc-800 transition-colors"
                                                        >
                                                            Duyệt
                                                        </button>
                                                    )}

                                                    {b.payment_status !== 'paid' && !isCancelled && (
                                                        <button
                                                            onClick={() =>
                                                                handleAction(
                                                                    b.id,
                                                                    b.status === 'pending' ? 'confirmed' : b.status,
                                                                    'paid'
                                                                )
                                                            }
                                                            className="px-2.5 py-1 bg-lime-600 text-white rounded text-[10px] font-medium hover:bg-lime-700 transition-colors"
                                                        >
                                                            {isOnlyProshopDebt
                                                                ? 'Thu Pro-shop'
                                                                : b.payment_status === 'partially_paid'
                                                                ? 'Thu phần còn lại'
                                                                : 'Thu tiền'}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* MODAL THÊM MÓN */}
            <AnimatePresence>
                {addItemModal.isOpen && (
                    <div
                        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={handleCloseAddItemModal}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden"
                        >
                            <div className="px-6 py-5 border-b border-zinc-100">
                                <h3 className="text-sm font-semibold text-zinc-800">
                                    Bán thêm dịch vụ / sản phẩm
                                </h3>

                                <p className="text-xs text-zinc-400 mt-0.5">
                                    Khách:{' '}
                                    <span className="text-zinc-600">
                                        {addItemModal.booking?.customer_name}
                                    </span>
                                </p>
                            </div>

                            <form onSubmit={handleAddItemSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="block text-[11px] font-medium text-zinc-500">
                                            Danh sách mặt hàng / dịch vụ
                                        </label>

                                        <button
                                            type="button"
                                            onClick={handleAddItemRow}
                                            className="text-[11px] font-medium text-lime-600 hover:text-lime-700"
                                        >
                                            + Thêm dòng
                                        </button>
                                    </div>

                                    {itemRows.map((item, index) => (
                                        <div
                                            key={index}
                                            className="border border-zinc-100 rounded-xl p-3 space-y-3 bg-zinc-50/40"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-semibold text-zinc-500">
                                                    Món #{index + 1}
                                                </span>

                                                {itemRows.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveItemRow(index)}
                                                        className="text-[11px] text-red-500 hover:text-red-600"
                                                    >
                                                        Xóa
                                                    </button>
                                                )}
                                            </div>

                                            <div>
                                                <select
                                                    required
                                                    value={item.selected_val}
                                                    onChange={(e) =>
                                                        handleItemRowChange(index, 'selected_val', e.target.value)
                                                    }
                                                    className={inputClass}
                                                >
                                                    <option value="" disabled>— Vui lòng chọn —</option>

                                                    {products.length > 0 && (
                                                        <optgroup label="🥤 Sản phẩm">
                                                            {products.map(p => (
                                                                <option
                                                                    key={`p_${p.id}`}
                                                                    value={`product|${p.id}`}
                                                                    disabled={p.stock_quantity <= 0}
                                                                >
                                                                    {p.name} - {Number(p.selling_price).toLocaleString()}đ {p.stock_quantity <= 0 ? '(Hết)' : `(${p.stock_quantity})`}
                                                                </option>
                                                            ))}
                                                        </optgroup>
                                                    )}

                                                    {services.length > 0 && (
                                                        <optgroup label="🏸 Dịch vụ">
                                                            {services.map(s => (
                                                                <option
                                                                    key={`s_${s.id}`}
                                                                    value={`service|${s.id}`}
                                                                    disabled={s.status === 'inactive'}
                                                                >
                                                                    {s.name} - {Number(s.price).toLocaleString()}đ
                                                                </option>
                                                            ))}
                                                        </optgroup>
                                                    )}
                                                </select>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">
                                                        Số lượng
                                                    </label>

                                                    <input
                                                        type="number"
                                                        min="1"
                                                        required
                                                        value={item.quantity}
                                                        onChange={(e) =>
                                                            handleItemRowChange(index, 'quantity', e.target.value)
                                                        }
                                                        className={inputClass}
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">
                                                        Ghi chú
                                                    </label>

                                                    <input
                                                        type="text"
                                                        placeholder="Tùy chọn..."
                                                        value={item.note}
                                                        onChange={(e) =>
                                                            handleItemRowChange(index, 'note', e.target.value)
                                                        }
                                                        className={inputClass}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex gap-2 pt-3 border-t border-zinc-100">
                                    <button
                                        type="button"
                                        onClick={handleCloseAddItemModal}
                                        className="flex-1 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-lg text-xs font-medium transition-colors"
                                    >
                                        Hủy
                                    </button>

                                    <button
                                        type="submit"
                                        disabled={isAddingItem}
                                        className="flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-60"
                                    >
                                        {isAddingItem
                                            ? 'Đang thêm...'
                                            : `Thêm ${itemRows.length} món vào Bill`}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* MODAL BILL IN NHIỆT */}
            <AnimatePresence>
                {isBillModalOpen && selectedBill && (
                    <div
                        onClick={() => setIsBillModalOpen(false)}
                        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-white w-full max-w-[360px] shadow-xl rounded-2xl p-6 relative font-mono text-zinc-900"
                        >
                            <div className="text-center mb-5">
                                <h2 className="text-lg font-black tracking-tight uppercase leading-none mb-1">
                                    NH BADMINTON
                                </h2>

                                <p className="text-[10px] text-zinc-400">
                                    Sân cầu lông · SĐT: 0987.654.321
                                </p>

                                <div className="mt-4 pt-3 border-t border-dashed border-zinc-300">
                                    <p className="text-xs font-semibold uppercase text-zinc-600">
                                        Hóa đơn thanh toán
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-1.5 text-xs mb-4">
                                <div className="flex justify-between">
                                    <span className="text-zinc-500">Mã GD:</span>
                                    <strong>
                                        #{selectedBill.booking_code?.split('_')[1] || selectedBill.id?.slice(0, 6)}
                                    </strong>
                                </div>

                                <div className="flex justify-between">
                                    <span className="text-zinc-500">Ngày:</span>
                                    <span>{new Date().toLocaleString('vi-VN')}</span>
                                </div>

                                <div className="flex justify-between">
                                    <span className="text-zinc-500">Khách:</span>
                                    <strong className="truncate max-w-[140px] text-right">
                                        {selectedBill.customer_name}
                                    </strong>
                                </div>
                            </div>

                            <table className="w-full text-[11px] mb-4 text-left">
                                <thead className="border-y border-dashed border-zinc-300">
                                    <tr>
                                        <th className="py-1.5 font-semibold w-1/2">Mô tả</th>
                                        <th className="py-1.5 font-semibold text-center">SL</th>
                                        <th className="py-1.5 font-semibold text-right">Thành tiền</th>
                                    </tr>
                                </thead>

                                <tbody className="border-b border-dashed border-zinc-300">
                                    {selectedBill.details?.map((detail) => (
                                        <tr key={detail.id}>
                                            <td className="py-2 pr-2">
                                                <strong className="block text-xs">
                                                    {detail.court?.name || 'Sân thuê'}
                                                </strong>

                                                <span className="text-[10px] text-zinc-400">
                                                    {detail.start_time?.slice(0, 5)} – {detail.end_time?.slice(0, 5)}
                                                </span>
                                            </td>

                                            <td className="py-2 text-center align-top text-xs">1</td>

                                            <td className="py-2 text-right align-top font-semibold text-xs">
                                                {Number(detail.price || 0).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}

                                    {selectedBill.service_details?.map((item) => (
                                        <tr key={item.id} className="border-t border-dotted border-zinc-200">
                                            <td className="py-2 pr-2">
                                                <strong className="block text-[11px]">
                                                    {item.product?.name || item.service?.name || 'Dịch vụ'}
                                                </strong>

                                                {item.note && (
                                                    <span className="text-[9px] text-zinc-400 block">
                                                        *{item.note}
                                                    </span>
                                                )}
                                            </td>

                                            <td className="py-2 text-center align-top text-zinc-600">
                                                {item.quantity}
                                            </td>

                                            <td className="py-2 text-right align-top font-semibold">
                                                {Number(item.total_price).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <div className="space-y-1 text-xs mb-5">
                                <div className="flex justify-between text-zinc-500">
                                    <span>Tiền sân:</span>
                                    <span>{Number(selectedBill.subtotal_court || 0).toLocaleString()}đ</span>
                                </div>

                                <div className="flex justify-between text-zinc-500">
                                    <span>Pro-shop:</span>
                                    <span>{Number(selectedBill.subtotal_service || 0).toLocaleString()}đ</span>
                                </div>

                                <div className="flex justify-between text-zinc-500">
                                    <span>Đã thu:</span>
                                    <span>{Number(selectedBill.deposit_amount || 0).toLocaleString()}đ</span>
                                </div>

                                <div className="flex justify-between text-zinc-500">
                                    <span>Còn thu:</span>
                                    <span className={Number(selectedBill.remaining_amount || 0) > 0 ? 'text-amber-600 font-bold' : ''}>
                                        {Number(selectedBill.remaining_amount || 0).toLocaleString()}đ
                                    </span>
                                </div>

                                <div className="flex justify-between text-sm mt-2 pt-2 border-t-2 border-zinc-800 font-bold">
                                    <span>TỔNG BILL:</span>
                                    <span>{Number(selectedBill.total_price || 0).toLocaleString()}đ</span>
                                </div>
                            </div>

                            <p className="text-center text-[10px] text-zinc-400 mb-6">
                                Cảm ơn quý khách!
                                <br />
                                Wifi: NH_Badminton · Pass: 88888888
                            </p>

                            <div className="flex gap-2 font-sans print:hidden">
                                <button
                                    onClick={() => setIsBillModalOpen(false)}
                                    className="flex-1 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-lg text-xs font-medium transition-colors"
                                >
                                    Đóng
                                </button>

                                <button
                                    onClick={() => alert('Kết nối máy in...')}
                                    className="flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-medium transition-colors"
                                >
                                    🖨️ In Bill
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default TodayBookings;