import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { pricingService } from '../../services/admin/pricingService';
import { adminCourtService } from '../../services/admin/courtService';

const PricingManager = () => {
    const [courts, setCourts] = useState([]);
    const [pricings, setPricings] = useState([]);
    const [selectedCourt, setSelectedCourt] = useState(null);

    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [selectedPricingId, setSelectedPricingId] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    const [calculator, setCalculator] = useState({
        court_id: '', date: new Date().toISOString().split('T')[0],
        start_time: '17:00', end_time: '19:00', result: null, loading: false
    });

    const [formData, setFormData] = useState({
        court_id: '', day_type: 'weekday', start_time: '05:00', end_time: '17:00',
        price: '', effective_from: '', effective_to: '', min_booking_minutes: 60
    });

    // --- FETCH ---
    const fetchSystemData = async () => {
        setIsLoading(true);
        try {
            const [courtRes, pricingRes] = await Promise.all([
                adminCourtService.getAllCourts(), pricingService.getAllPricings()
            ]);
            const fetchedCourts = courtRes.data.data || [];
            const fetchedPricings = pricingRes.data.data || [];
            setCourts(fetchedCourts);
            setPricings(fetchedPricings);
            if (fetchedCourts.length > 0 && !selectedCourt) {
                setSelectedCourt(fetchedCourts[0]);
                setCalculator(prev => ({ ...prev, court_id: fetchedCourts[0].id }));
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Không thể tải dữ liệu.' });
        } finally { setIsLoading(false); }
    };

    useEffect(() => { fetchSystemData(); }, []);

    // --- ACTIONS ---
    const handleOpenCreate = () => {
        if (!selectedCourt) return alert('Chọn sân trước khi thêm giá!');
        setModalMode('create');
        setSelectedPricingId(null);
        setFormData({
            court_id: selectedCourt.id, day_type: 'weekday', start_time: '05:00', end_time: '17:00',
            price: '', effective_from: '', effective_to: '', min_booking_minutes: 60
        });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (item) => {
        setModalMode('edit');
        setSelectedPricingId(item.id);
        setFormData({
            court_id: item.court_id, day_type: item.day_type,
            start_time: item.start_time.substring(0, 5), end_time: item.end_time.substring(0, 5),
            price: item.price, effective_from: item.effective_from || '',
            effective_to: item.effective_to || '', min_booking_minutes: item.min_booking_minutes || 60
        });
        setIsModalOpen(true);
    };

    const handleSubmitForm = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        setMessage({ type: '', text: '' });
        const payload = { ...formData, effective_from: formData.effective_from || null, effective_to: formData.effective_to || null };
        try {
            if (modalMode === 'create') {
                await pricingService.createPricing(payload);
                setMessage({ type: 'success', text: `Đã cấu hình giá cho "${selectedCourt.name}"!` });
            } else {
                await pricingService.updatePricing(selectedPricingId, payload);
                setMessage({ type: 'success', text: 'Cập nhật giá thành công!' });
            }
            setIsModalOpen(false);
            fetchSystemData();
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.message || 'Thao tác thất bại.' });
        } finally { setIsSaving(false); }
    };

    const handleDeletePricing = async (id) => {
        if (!window.confirm('Xóa mốc giá này?')) return;
        try {
            await pricingService.deletePricing(id);
            setMessage({ type: 'success', text: 'Đã xóa mốc giá.' });
            fetchSystemData();
        } catch (error) { setMessage({ type: 'error', text: 'Xóa thất bại.' }); }
    };

    const handleRunCalculator = async (e) => {
        e.preventDefault();
        setCalculator(prev => ({ ...prev, loading: true, result: null }));
        try {
            const res = await pricingService.calculatePrice({
                court_id: calculator.court_id, date: calculator.date,
                start_time: calculator.start_time, end_time: calculator.end_time
            });
            setCalculator(prev => ({ ...prev, loading: false, result: res.data }));
        } catch (error) {
            alert(error.response?.data?.message || 'Khung giờ không hợp lệ.');
            setCalculator(prev => ({ ...prev, loading: false }));
        }
    };

    const currentCourtPricings = selectedCourt
        ? pricings.filter(p => p.court_id.toString() === selectedCourt.id.toString())
        : [];

    const inputClass = "w-full bg-[#f8f8fa] border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200 transition-all";
    const calcInputClass = "w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-700 outline-none focus:border-zinc-400 transition-all";

    const dayTypeConfig = {
        weekday: { label: 'Ngày thường', bg: 'bg-blue-50', text: 'text-blue-700' },
        weekend: { label: 'Cuối tuần', bg: 'bg-violet-50', text: 'text-violet-700' },
        holiday: { label: 'Ngày lễ', bg: 'bg-red-50', text: 'text-red-700' },
    };

    return (
        <div className="max-w-[1400px] mx-auto space-y-5">

            {/* HEADER */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-base font-semibold text-zinc-800">Cấu hình bảng giá</h2>
                    <p className="text-xs text-zinc-400 mt-0.5">Quản lý đơn giá theo khung giờ, loại ngày và thời vụ</p>
                </div>
            </div>

            {/* TOAST */}
            <AnimatePresence>
                {message.text && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                        className={`p-3 rounded-lg text-xs font-medium ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                        {message.text}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* CALCULATOR */}
            <div className="bg-white rounded-xl border border-zinc-200/60 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center gap-2">
                    <span className="w-5 h-5 bg-zinc-100 rounded flex items-center justify-center text-[10px]">⚡</span>
                    <h3 className="text-xs font-medium text-zinc-700">Kiểm tra giá cộng dồn</h3>
                </div>
                <form onSubmit={handleRunCalculator} className="p-5 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
                    <div>
                        <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">Sân</label>
                        <select value={calculator.court_id} onChange={e => setCalculator({ ...calculator, court_id: e.target.value })} className={calcInputClass}>
                            {courts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">Ngày</label>
                        <input type="date" value={calculator.date} onChange={e => setCalculator({ ...calculator, date: e.target.value })} className={calcInputClass} />
                    </div>
                    <div>
                        <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">Bắt đầu</label>
                        <input type="time" value={calculator.start_time} onChange={e => setCalculator({ ...calculator, start_time: e.target.value })} className={calcInputClass} />
                    </div>
                    <div>
                        <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">Kết thúc</label>
                        <input type="time" value={calculator.end_time} onChange={e => setCalculator({ ...calculator, end_time: e.target.value })} className={calcInputClass} />
                    </div>
                    <button type="submit" disabled={calculator.loading} className="py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-medium transition-colors">
                        {calculator.loading ? 'Đang tính...' : 'Kiểm tra'}
                    </button>
                </form>

                <AnimatePresence>
                    {calculator.result && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                            className="px-5 pb-5">
                            <div className="bg-zinc-50 rounded-lg border border-zinc-100 p-4 flex flex-wrap items-center justify-between gap-4">
                                <div>
                                    <p className="text-[10px] text-zinc-400 mb-1.5 uppercase font-medium">Chi tiết block</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {calculator.result.details.map((d, i) => (
                                            <span key={i} className="text-[11px] bg-white text-zinc-600 px-2.5 py-1 rounded border border-zinc-200">
                                                {d.khung_gia}: <strong className="text-zinc-800">{d.thanh_tien.toLocaleString()}₫</strong>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-zinc-400 uppercase">Tổng dự kiến</p>
                                    <p className="text-lg font-bold text-zinc-800">{calculator.result.total_price.toLocaleString()}₫</p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* MASTER-DETAIL */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">

                {/* LEFT — COURT LIST */}
                <div className="bg-white rounded-xl border border-zinc-200/60 overflow-hidden">
                    <div className="px-4 py-3 border-b border-zinc-100">
                        <h4 className="text-xs font-medium text-zinc-700">Chọn sân</h4>
                        <p className="text-[10px] text-zinc-400 mt-0.5">Click để xem bảng giá</p>
                    </div>
                    <div className="p-3 space-y-1.5 max-h-[450px] overflow-y-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-10">
                                <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
                            </div>
                        ) : courts.map(court => {
                            const isSelected = selectedCourt?.id === court.id;
                            const cnt = pricings.filter(p => p.court_id === court.id).length;
                            return (
                                <button key={court.id}
                                    onClick={() => { setSelectedCourt(court); setCalculator(prev => ({ ...prev, court_id: court.id })); }}
                                    className={`w-full p-3 rounded-lg border text-left transition-all duration-150 flex items-center justify-between ${isSelected ? 'bg-zinc-900 border-zinc-900 text-white' : 'bg-white border-zinc-100 hover:border-zinc-200'}`}>
                                    <div className="min-w-0">
                                        <span className={`text-[10px] font-mono ${isSelected ? 'text-zinc-400' : 'text-zinc-400'}`}>{court.court_code}</span>
                                        <p className={`text-xs font-medium truncate ${isSelected ? 'text-white' : 'text-zinc-800'}`}>{court.name}</p>
                                    </div>
                                    <span className={`text-[10px] px-2 py-0.5 rounded shrink-0 ${isSelected ? 'bg-white/15 text-zinc-300' : cnt > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-400'}`}>
                                        {cnt} mốc
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* RIGHT — PRICING TABLE */}
                <div className="lg:col-span-3 bg-white rounded-xl border border-zinc-200/60 overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-zinc-100 flex justify-between items-center">
                        <div>
                            <h3 className="text-sm font-medium text-zinc-800">
                                {selectedCourt ? selectedCourt.name : 'Chưa chọn sân'}
                            </h3>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                                {currentCourtPricings.length} mốc giá đang cấu hình
                            </p>
                        </div>
                        <button onClick={handleOpenCreate} disabled={!selectedCourt}
                            className={`px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-medium transition-colors ${!selectedCourt ? 'opacity-40 cursor-not-allowed' : ''}`}>
                            + Thêm mốc giá
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[700px]">
                            <thead>
                                <tr className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider bg-zinc-50/60 border-b border-zinc-100">
                                    <th className="text-left py-3 px-5" style={{ width: '120px' }}>Loại ngày</th>
                                    <th className="text-left py-3 px-3" style={{ width: '130px' }}>Khung giờ</th>
                                    <th className="text-right py-3 px-3" style={{ width: '110px' }}>Đơn giá/h</th>
                                    <th className="text-left py-3 px-3" style={{ width: '160px' }}>Hiệu lực</th>
                                    <th className="text-right py-3 px-5" style={{ width: '100px' }}>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr><td colSpan="5" className="py-16 text-center"><div className="inline-block w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" /></td></tr>
                                ) : !selectedCourt ? (
                                    <tr><td colSpan="5" className="py-16 text-center text-xs text-zinc-300">← Chọn sân bên trái</td></tr>
                                ) : currentCourtPricings.length === 0 ? (
                                    <tr><td colSpan="5" className="py-16 text-center text-xs text-zinc-400">Chưa cấu hình giá cho sân này</td></tr>
                                ) : currentCourtPricings.map(item => {
                                    const dtc = dayTypeConfig[item.day_type] || dayTypeConfig.weekday;
                                    const isSeason = item.effective_from;
                                    return (
                                        <tr key={item.id} className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50/40 transition-colors group">
                                            <td className="py-3 px-5">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${dtc.bg} ${dtc.text}`}>
                                                    {dtc.label}
                                                </span>
                                            </td>
                                            <td className="py-3 px-3">
                                                <span className="text-xs font-mono text-zinc-600">{item.start_time.substring(0, 5)} – {item.end_time.substring(0, 5)}</span>
                                            </td>
                                            <td className="py-3 px-3 text-right">
                                                <span className="text-sm font-semibold text-zinc-800">{Number(item.price).toLocaleString()}₫</span>
                                            </td>
                                            <td className="py-3 px-3">
                                                {isSeason ? (
                                                    <span className="text-[11px] text-amber-600">
                                                        {item.effective_from} → {item.effective_to || '∞'}
                                                    </span>
                                                ) : (
                                                    <span className="text-[11px] text-zinc-400">Cố định</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-5 text-right">
                                                <div className="flex items-center justify-end gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleOpenEdit(item)} className="px-2.5 py-1 border border-zinc-200 text-zinc-500 rounded text-[10px] hover:bg-zinc-50 transition-colors">Sửa</button>
                                                    <button onClick={() => handleDeletePricing(item.id)} className="px-2 py-1 text-zinc-400 rounded text-[10px] hover:text-red-500 hover:bg-red-50 transition-colors">Xóa</button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* MODAL */}
            <AnimatePresence>
                {isModalOpen && (
                    <div onClick={() => setIsModalOpen(false)} className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            onClick={e => e.stopPropagation()} className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
                            <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-semibold text-zinc-800">
                                        {modalMode === 'create' ? 'Tạo mốc giá' : 'Cập nhật giá'}
                                    </h4>
                                    <p className="text-[11px] text-zinc-400 mt-0.5">Sân: {selectedCourt?.name}</p>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors text-sm">✕</button>
                            </div>
                            <form onSubmit={handleSubmitForm} className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">Loại ngày *</label>
                                        <select value={formData.day_type} onChange={e => setFormData({ ...formData, day_type: e.target.value })} className={inputClass}>
                                            <option value="weekday">Ngày thường</option>
                                            <option value="weekend">Cuối tuần</option>
                                            <option value="holiday">Ngày lễ</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">Đơn giá (VNĐ/h) *</label>
                                        <input type="number" required placeholder="100000" min="0" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} className={inputClass} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">Giờ bắt đầu *</label>
                                        <input type="time" required value={formData.start_time} onChange={e => setFormData({ ...formData, start_time: e.target.value })} className={inputClass} />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">Giờ kết thúc *</label>
                                        <input type="time" required value={formData.end_time} onChange={e => setFormData({ ...formData, end_time: e.target.value })} className={inputClass} />
                                    </div>
                                </div>
                                <div className="bg-zinc-50 rounded-lg border border-zinc-100 p-4 space-y-3">
                                    <p className="text-[11px] font-medium text-zinc-600">Thời vụ (tùy chọn)</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] text-zinc-400 mb-1">Từ ngày</label>
                                            <input type="date" value={formData.effective_from} onChange={e => setFormData({ ...formData, effective_from: e.target.value })} className={inputClass} />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-zinc-400 mb-1">Đến ngày</label>
                                            <input type="date" value={formData.effective_to} onChange={e => setFormData({ ...formData, effective_to: e.target.value })} className={inputClass} />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2 pt-3 border-t border-zinc-100">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-lg text-xs font-medium transition-colors">Hủy</button>
                                    <button type="submit" disabled={isSaving} className={`flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-medium transition-colors ${isSaving ? 'opacity-60' : ''}`}>
                                        {isSaving ? 'Đang lưu...' : 'Xác nhận'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default PricingManager;