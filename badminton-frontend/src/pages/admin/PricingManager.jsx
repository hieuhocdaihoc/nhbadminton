import React, { useState, useEffect } from 'react';
import { pricingService } from '../../services/admin/pricingService';
import { adminCourtService } from '../../services/admin/courtService';

const PricingManager = () => {
    // 1. STATES DỮ LIỆU HỆ THỐNG
    const [courts, setCourts] = useState([]);
    const [pricings, setPricings] = useState([]);
    const [selectedCourt, setSelectedCourt] = useState(null); // Sân đang được chọn (Master)

    // 2. STATES TRẠNG THÁI & THÔNG BÁO
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // 3. STATES MODAL CẤU HÌNH GIÁ
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [selectedPricingId, setSelectedPricingId] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // 4. STATES BỘ TEST GIÁ TỰ ĐỘNG (CALCULATOR SIMULATOR)
    const [calculator, setCalculator] = useState({
        court_id: '',
        date: new Date().toISOString().split('T')[0],
        start_time: '17:00',
        end_time: '19:00',
        result: null,
        loading: false
    });

    // Form dữ liệu chuẩn hóa
    const [formData, setFormData] = useState({
        court_id: '',
        day_type: 'weekday',
        start_time: '05:00',
        end_time: '17:00',
        price: '',
        effective_from: '',
        effective_to: '',
        min_booking_minutes: 60
    });

    // --- HÀM TẢI ĐỒNG THỜI DỮ LIỆU SÂN & GIÁ ---
    const fetchSystemData = async () => {
        setIsLoading(true);
        try {
            const [courtRes, pricingRes] = await Promise.all([
                adminCourtService.getAllCourts(),
                pricingService.getAllPricings()
            ]);

            const fetchedCourts = courtRes.data.data || [];
            const fetchedPricings = pricingRes.data.data || [];

            setCourts(fetchedCourts);
            setPricings(fetchedPricings);

            // Mặc định ghim sân đầu tiên làm Master
            if (fetchedCourts.length > 0 && !selectedCourt) {
                setSelectedCourt(fetchedCourts[0]);
                setCalculator(prev => ({ ...prev, court_id: fetchedCourts[0].id }));
            }
        } catch (error) {
            console.error('Lỗi đồng bộ dữ liệu:', error);
            setMessage({ type: 'error', text: 'Không thể tải cấu hình Sân và Bảng giá từ máy chủ.' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSystemData();
    }, []);

    // --- MỞ MODAL THÊM GIÁ MỚI ---
    const handleOpenCreate = () => {
        if (!selectedCourt) {
            alert('Vui lòng chọn một sân thi đấu ở cột trái trước khi thêm giá!');
            return;
        }
        setModalMode('create');
        setSelectedPricingId(null);
        setFormData({
            court_id: selectedCourt.id, // Khóa chặt ID sân đang chọn
            day_type: 'weekday',
            start_time: '05:00',
            end_time: '17:00',
            price: '',
            effective_from: '',
            effective_to: '',
            min_booking_minutes: 60
        });
        setIsModalOpen(true);
    };

    // --- MỞ MODAL CẬP NHẬT ---
    const handleOpenEdit = (item) => {
        setModalMode('edit');
        setSelectedPricingId(item.id);
        setFormData({
            court_id: item.court_id,
            day_type: item.day_type,
            start_time: item.start_time.substring(0, 5),
            end_time: item.end_time.substring(0, 5),
            price: item.price,
            effective_from: item.effective_from || '',
            effective_to: item.effective_to || '',
            min_booking_minutes: item.min_booking_minutes || 60
        });
        setIsModalOpen(true);
    };

    // --- XỬ LÝ LƯU DỮ LIỆU ---
    const handleSubmitForm = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        setMessage({ type: '', text: '' });

        const payload = {
            ...formData,
            effective_from: formData.effective_from || null,
            effective_to: formData.effective_to || null,
        };

        try {
            if (modalMode === 'create') {
                await pricingService.createPricing(payload);
                setMessage({ type: 'success', text: `✓ Đã cấu hình giá mới cho "${selectedCourt.name}"!` });
            } else {
                await pricingService.updatePricing(selectedPricingId, payload);
                setMessage({ type: 'success', text: '✓ Cập nhật thông số giá thành công!' });
            }
            setIsModalOpen(false);
            fetchSystemData();
        } catch (error) {
            console.error('Lỗi lưu giá:', error);
            if (error.response && error.response.data && error.response.data.message) {
                setMessage({ type: 'error', text: error.response.data.message });
            } else {
                setMessage({ type: 'error', text: 'Thao tác thất bại. Vui lòng kiểm tra lại khung giờ.' });
            }
        } finally {
            setIsSaving(false);
        }
    };

    // --- XÓA MỐC GIÁ ---
    const handleDeletePricing = async (id) => {
        if (!window.confirm('⚠️ Bạn có chắc chắn muốn xóa mốc giá này ra khỏi hệ thống?')) return;
        try {
            await pricingService.deletePricing(id);
            setMessage({ type: 'success', text: '✓ Đã gỡ bỏ khung giá thành công.' });
            fetchSystemData();
        } catch (error) {
            setMessage({ type: 'error', text: 'Xóa thất bại. Đang có lỗi kết nối.' });
        }
    };

    // --- CHẠY THỬ MÔ PHỎNG GIÁ ---
    const handleRunCalculator = async (e) => {
        e.preventDefault();
        setCalculator(prev => ({ ...prev, loading: true, result: null }));
        try {
            const res = await pricingService.calculatePrice({
                court_id: calculator.court_id,
                date: calculator.date,
                start_time: calculator.start_time,
                end_time: calculator.end_time
            });
            setCalculator(prev => ({ ...prev, loading: false, result: res.data }));
        } catch (error) {
            alert(error.response?.data?.message || 'Lỗi mô phỏng: Khung giờ gửi lên không hợp lệ.');
            setCalculator(prev => ({ ...prev, loading: false }));
        }
    };

    // Chi tiết các mốc giá của riêng sân đang chọn
    const currentCourtPricings = selectedCourt
        ? pricings.filter(p => p.court_id.toString() === selectedCourt.id.toString())
        : [];

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto pb-12">

            {/* KHUNG SIMULATOR TEST GIÁ */}
            <div className="bg-[#121212] text-white p-6 rounded-3xl border border-zinc-800 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <span className="text-blue-500 font-bold">⚡</span>
                    <h3 className="font-black text-sm tracking-tight uppercase text-zinc-300">Bộ Công Cụ Kiểm Tra Thuật Toán Giá Cộng Dồn</h3>
                </div>
                <form onSubmit={handleRunCalculator} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
                    <div>
                        <label className="block text-[11px] font-bold text-zinc-400 mb-1">Trỏ Sân Thi Đấu</label>
                        <select
                            value={calculator.court_id} onChange={e => setCalculator({ ...calculator, court_id: e.target.value })}
                            className="w-full p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-bold text-white focus:outline-none"
                        >
                            {courts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-zinc-400 mb-1">Ngày dự kiến</label>
                        <input
                            type="date" value={calculator.date} onChange={e => setCalculator({ ...calculator, date: e.target.value })}
                            className="w-full p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-bold text-white focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-zinc-400 mb-1">Giờ bắt đầu</label>
                        <input
                            type="time" value={calculator.start_time} onChange={e => setCalculator({ ...calculator, start_time: e.target.value })}
                            className="w-full p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-bold text-white focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-zinc-400 mb-1">Giờ kết thúc</label>
                        <input
                            type="time" value={calculator.end_time} onChange={e => setCalculator({ ...calculator, end_time: e.target.value })}
                            className="w-full p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-bold text-white focus:outline-none"
                        />
                    </div>
                    <button type="submit" disabled={calculator.loading} className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 font-bold rounded-xl text-xs transition-colors">
                        {calculator.loading ? 'Đang phân tích...' : 'Kiểm thử giá'}
                    </button>
                </form>

                {calculator.result && (
                    <div className="mt-4 pt-4 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-4 bg-zinc-900/50 p-3 rounded-xl">
                        <div className="space-y-1">
                            <span className="text-[10px] text-zinc-400 font-bold block uppercase">Chi tiết bóc tách block:</span>
                            <div className="flex flex-wrap gap-2">
                                {calculator.result.details.map((d, i) => (
                                    <span key={i} className="text-xs bg-zinc-800 text-zinc-300 px-2.5 py-1 rounded-md border border-zinc-700">
                                        {d.khung_gia} : <strong className="text-emerald-400">{d.thanh_tien.toLocaleString()} đ</strong>
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] text-zinc-400 block">Tổng cộng dự kiến</span>
                            <span className="text-lg font-black text-blue-400">{calculator.result.total_price.toLocaleString()} VNĐ</span>
                        </div>
                    </div>
                )}
            </div>

            {message.text && (
                <div className={`p-3 rounded-xl text-xs font-bold ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                    {message.text}
                </div>
            )}

            {/* BỐ CỤC MASTER - DETAIL */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">

                {/* CỘT TRÁI (MASTER): DANH SÁCH SÂN */}
                <div className="bg-white p-5 rounded-3xl border border-zinc-200/80 shadow-sm space-y-3">
                    <div className="pb-3 border-b border-zinc-100">
                        <h4 className="font-black text-sm text-zinc-900 uppercase tracking-wider">1. Chọn Sân Cấu Hình</h4>
                        <p className="text-[11px] text-zinc-500 mt-0.5">Click để xem/sửa giá của từng sân</p>
                    </div>

                    {isLoading ? (
                        <div className="py-8 text-center text-xs text-zinc-400">Đang nạp dữ liệu...</div>
                    ) : courts.length === 0 ? (
                        <div className="py-8 text-center text-xs text-zinc-400 italic">Chưa có sân thi đấu.</div>
                    ) : (
                        <div className="space-y-1.5 max-h-[450px] overflow-y-auto pr-1">
                            {courts.map(court => {
                                const isSelected = selectedCourt?.id === court.id;
                                const pricingCount = pricings.filter(p => p.court_id === court.id).length;

                                return (
                                    <button
                                        key={court.id}
                                        onClick={() => {
                                            setSelectedCourt(court);
                                            setCalculator(prev => ({ ...prev, court_id: court.id }));
                                        }}
                                        className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between ${isSelected ? 'bg-blue-50/80 border-blue-300 ring-2 ring-blue-600/10' : 'bg-zinc-50/50 border-zinc-200/60 hover:bg-zinc-50'
                                            }`}
                                    >
                                        <div className="overflow-hidden pr-2">
                                            <span className="text-[10px] font-mono text-blue-600 font-bold block">{court.court_code}</span>
                                            <span className="text-xs font-black text-zinc-900 truncate block mt-0.5">{court.name}</span>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${pricingCount > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-200 text-zinc-600'
                                            }`}>
                                            {pricingCount} mốc
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* CỘT PHẢI (DETAIL): BẢNG GIÁ CỦA SÂN ĐANG CHỌN */}
                <div className="lg:col-span-3 bg-white p-6 sm:p-8 rounded-3xl border border-zinc-200/80 shadow-sm space-y-4">

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-zinc-100">
                        <div>
                            <h3 className="text-base font-black text-zinc-900 tracking-tight">
                                2. Bảng Giá Chi Tiết: <span className="text-blue-600">{selectedCourt?.name || 'Chưa chọn sân'}</span>
                            </h3>
                            <p className="text-xs text-zinc-500 mt-0.5">Các mốc đơn giá áp dụng tự động khi khách đặt lịch thi đấu.</p>
                        </div>

                        <button
                            onClick={handleOpenCreate}
                            disabled={!selectedCourt}
                            className={`px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md transition-all shrink-0 ${!selectedCourt ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            + Thêm Mốc Giá Mới
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-sm min-w-[700px]">
                            <thead>
                                <tr className="border-b border-zinc-200 bg-zinc-50/50 text-[11px] text-zinc-400 uppercase font-bold tracking-wider">
                                    <th className="p-3">Áp dụng ngày</th>
                                    <th className="p-3 text-center">Khung giờ hoạt động</th>
                                    <th className="p-3 text-right">Đơn giá (VNĐ/h)</th>
                                    <th className="p-3">Hiệu lực thời vụ</th>
                                    <th className="p-3 text-right">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 text-zinc-700">
                                {isLoading ? (
                                    <tr><td colSpan="5" className="py-12 text-center text-xs font-bold text-zinc-400">Đang tải cấu hình...</td></tr>
                                ) : !selectedCourt ? (
                                    <tr><td colSpan="5" className="py-12 text-center text-xs font-bold text-zinc-400 italic">Hãy chọn một Sân ở cột trái để xem bảng giá.</td></tr>
                                ) : currentCourtPricings.length === 0 ? (
                                    <tr><td colSpan="5" className="py-12 text-center text-xs font-bold text-zinc-400">Sân này chưa cấu hình đơn giá.</td></tr>
                                ) : (
                                    currentCourtPricings.map(item => {
                                        const isSeason = item.effective_from;
                                        return (
                                            <tr key={item.id} className={`hover:bg-zinc-50/30 transition-colors ${isSeason ? 'bg-amber-50/20' : ''}`}>
                                                <td className="p-3">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${item.day_type === 'weekday' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                        item.day_type === 'weekend' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                            'bg-red-50 text-red-700 border-red-200'
                                                        }`}>
                                                        {item.day_type === 'weekday' ? 'Ngày thường' : item.day_type === 'weekend' ? 'Cuối tuần' : 'Ngày lễ'}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-center font-mono font-black text-zinc-800">
                                                    {item.start_time.substring(0, 5)} - {item.end_time.substring(0, 5)}
                                                </td>
                                                <td className="p-3 text-right font-black text-blue-600 text-base">
                                                    {Number(item.price).toLocaleString()} đ
                                                </td>
                                                <td className="p-3">
                                                    {isSeason ? (
                                                        <span className="text-xs font-bold text-amber-700 block">
                                                            Ghim từ {item.effective_from} {item.effective_to ? `đến ${item.effective_to}` : ''}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-zinc-400 font-medium">Cố định mặc định</span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-right shrink-0">
                                                    <button onClick={() => handleOpenEdit(item)} className="text-xs font-bold text-blue-600 hover:underline">Sửa</button>
                                                    <span className="text-zinc-200 mx-1.5">|</span>
                                                    <button onClick={() => handleDeletePricing(item.id)} className="text-xs font-bold text-red-600 hover:underline">Xóa</button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

            {/* HỘP THOẠI MODAL CẤU HÌNH GIÁ */}
            {isModalOpen && (
                <div onClick={() => setIsModalOpen(false)} className="fixed inset-0 z-50 bg-zinc-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div onClick={e => e.stopPropagation()} className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-zinc-100 p-6 sm:p-8">

                        <div className="pb-4 border-b border-zinc-100 mb-4 flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-bold bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded uppercase">
                                    Sân: {selectedCourt?.name}
                                </span>
                                <h4 className="text-base font-black text-zinc-900 mt-1">
                                    {modalMode === 'create' ? 'Tạo Mốc Giá Thuê Sân' : 'Cập Nhật Bảng Giá'}
                                </h4>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 font-bold">✕</button>
                        </div>

                        <form onSubmit={handleSubmitForm} className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Loại ngày *</label>
                                    <select
                                        value={formData.day_type} onChange={e => setFormData({ ...formData, day_type: e.target.value })}
                                        className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-800 focus:outline-none"
                                    >
                                        <option value="weekday">Ngày thường</option>
                                        <option value="weekend">Cuối tuần</option>
                                        <option value="holiday">Ngày lễ</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Đơn giá (VNĐ/h) *</label>
                                    <input
                                        type="number" required placeholder="100000" min="0" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })}
                                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-blue-600 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Giờ bắt đầu *</label>
                                    <input
                                        type="time" required value={formData.start_time} onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                                        className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-800 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Giờ kết thúc *</label>
                                    <input
                                        type="time" required value={formData.end_time} onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                                        className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-800 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/60 space-y-2">
                                <span className="text-xs font-bold text-amber-700 block">⚡ Cấu hình Thời vụ (Tùy chọn)</span>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <span className="text-[10px] text-zinc-400 block mb-1">Có hiệu lực từ:</span>
                                        <input
                                            type="date" value={formData.effective_from} onChange={e => setFormData({ ...formData, effective_from: e.target.value })}
                                            className="w-full p-1 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-800"
                                        />
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-zinc-400 block mb-1">Hết hạn ngày:</span>
                                        <input
                                            type="date" value={formData.effective_to} onChange={e => setFormData({ ...formData, effective_to: e.target.value })}
                                            className="w-full p-1 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-800"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2 pt-2 border-t border-zinc-100">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 bg-zinc-100 text-zinc-700 font-bold rounded-xl text-xs">Hủy</button>
                                <button type="submit" disabled={isSaving} className={`flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-xl text-xs shadow-md ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}>
                                    {isSaving ? 'Đang ghi...' : 'Xác nhận áp dụng'}
                                </button>
                            </div>
                        </form>

                    </div>
                </div>
            )}

        </div>
    );
};

export default PricingManager;