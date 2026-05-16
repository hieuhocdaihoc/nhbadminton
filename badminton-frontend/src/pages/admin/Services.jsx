import React, { useState, useEffect } from 'react';
import { adminAdditionalService } from '../../services/admin/additionalService';

const Services = () => {
    // STATE DỮ LIỆU
    const [services, setServices] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState({ type: '', text: '' });

    // STATE FORM
    const [form, setForm] = useState({ id: null, name: '', service_type: 'drink', price: '', unit: 'Lượt', description: '', status: 'active' });
    const [isEditing, setIsEditing] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // MAPPING TYPE SANG TIẾNG VIỆT ĐỂ HIỂN THỊ
    const TYPE_LABELS = {
        drink: '🥤 Nước uống',
        rental: '🏸 Thuê dụng cụ',
        coaching: '🎓 Huấn luyện',
        shuttlecock: '📦 Quả cầu',
        other: '⚙️ Khác'
    };

    const fetchServices = async () => {
        setIsLoading(true);
        try {
            const res = await adminAdditionalService.getServices();
            setServices(res.data?.data || []);
        } catch (error) {
            setMessage({ type: 'error', text: 'Không thể tải danh sách dịch vụ.' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchServices(); }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim() || form.price === '') return;
        setIsProcessing(true);
        setMessage({ type: '', text: '' });

        const payload = {
            name: form.name,
            service_type: form.service_type,
            price: Number(form.price),
            unit: form.unit,
            description: form.description,
            status: form.status
        };

        try {
            if (isEditing) {
                await adminAdditionalService.updateService(form.id, payload);
                setMessage({ type: 'success', text: '✓ Cập nhật dịch vụ thành công!' });
            } else {
                await adminAdditionalService.createService(payload);
                setMessage({ type: 'success', text: '✓ Thêm dịch vụ mới thành công!' });
            }
            resetForm();
            fetchServices();
        } catch (error) {
            const errorMsg = error.response?.data?.message || 'Có lỗi xảy ra, vui lòng kiểm tra lại!';
            alert('⚠️ ' + errorMsg);
        } finally {
            setIsProcessing(false);
            setTimeout(() => setMessage({ type: '', text: '' }), 2500);
        }
    };

    const handleEditClick = (service) => {
        setIsEditing(true);
        setForm({
            id: service.id,
            name: service.name,
            service_type: service.service_type,
            price: service.price,
            unit: service.unit || 'Lượt',
            description: service.description || '',
            status: service.status
        });
    };

    const handleDeleteClick = async (service) => {
        if (window.confirm(`Bạn có chắc chắn muốn ngưng kinh doanh dịch vụ [${service.name}]?`)) {
            try {
                await adminAdditionalService.deleteService(service.id);
                setMessage({ type: 'success', text: '✓ Đã chuyển dịch vụ sang trạng thái tạm ẩn!' });
                fetchServices();
            } catch (error) {
                const errorMsg = error.response?.data?.message || 'Thao tác thất bại!';
                alert('❌ ' + errorMsg);
            } finally {
                setTimeout(() => setMessage({ type: '', text: '' }), 2500);
            }
        }
    };

    const resetForm = () => {
        setForm({ id: null, name: '', service_type: 'drink', price: '', unit: 'Lượt', description: '', status: 'active' });
        setIsEditing(false);
    };

    return (
        <div className="max-w-[1600px] mx-auto p-3 gap-3 font-sans h-[calc(100vh-7rem)] flex flex-col overflow-hidden bg-zinc-50/50">

            {/* HEADER */}
            <div className="shrink-0 bg-white p-3 px-5 rounded-2xl border border-zinc-200/60 shadow-xs flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 bg-purple-600 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-xs">🏸</div>
                    <div>
                        <h2 className="text-base font-black text-zinc-900 tracking-tight leading-none">Quản Lý Dịch Vụ Bổ Sung</h2>
                        <p className="text-[10px] font-semibold text-zinc-400 mt-1">Cấu hình giá thuê vợt, huấn luyện viên, nước uống giải khát tại quầy</p>
                    </div>
                </div>
                {message.text && (
                    <div className={`px-3 py-1 rounded-lg text-[11px] font-black tracking-tight border ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                        {message.text}
                    </div>
                )}
            </div>

            {/* THÂN GRID CHÍNH */}
            <div className="flex-1 grid grid-cols-12 gap-3 min-h-0">

                {/* BẢNG DANH SÁCH BÊN TRÁI (8 CỘT) */}
                <div className="col-span-8 bg-white rounded-2xl border border-zinc-200/60 shadow-xs flex flex-col min-h-0 overflow-hidden">
                    <div className="flex-1 overflow-auto relative custom-scrollbar">
                        <table className="w-full text-left text-xs whitespace-nowrap">
                            <thead className="bg-zinc-50/80 font-black text-zinc-400 uppercase text-[9px] tracking-widest sticky top-0 z-10 border-b border-zinc-200/60 backdrop-blur-sm">
                                <tr>
                                    <th className="py-3 px-4 pl-6">Tên dịch vụ</th>
                                    <th className="py-3 px-4">Phân loại</th>
                                    <th className="py-3 px-4 text-right">Đơn giá</th>
                                    <th className="py-3 px-4 text-center">Đơn vị</th>
                                    <th className="py-3 px-4 text-center">Trạng thái</th>
                                    <th className="py-3 px-4 text-right pr-6">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 bg-white">
                                {isLoading ? (
                                    <tr><td colSpan="6" className="py-12 text-center text-zinc-400 font-bold uppercase text-[10px] tracking-wider">Đang nạp dữ liệu...</td></tr>
                                ) : services.length === 0 ? (
                                    <tr><td colSpan="6" className="py-12 text-center text-zinc-400 italic">Chưa cấu hình dịch vụ bổ sung nào.</td></tr>
                                ) : (
                                    services.map(s => (
                                        <tr key={s.id} className="hover:bg-zinc-50/80 transition-colors group">
                                            <td className="py-2.5 px-4 pl-6 font-black text-zinc-900 text-xs tracking-tight">
                                                {s.name}
                                                <span className="block font-normal text-zinc-400 text-[10px] max-w-[200px] truncate">{s.description || 'Không có mô tả'}</span>
                                            </td>
                                            <td className="py-2.5 px-4 font-bold text-zinc-600 text-[11px]">{TYPE_LABELS[s.service_type] || s.service_type}</td>
                                            <td className="py-2.5 px-4 text-right font-black text-zinc-900 text-xs tracking-tight">{Number(s.price).toLocaleString()} ₫</td>
                                            <td className="py-2.5 px-4 text-center font-bold text-zinc-500 text-[11px]"><span className="bg-zinc-100 px-2 py-0.5 rounded">{s.unit || 'Lượt'}</span></td>
                                            <td className="py-2.5 px-4 text-center align-middle">
                                                <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase border ${s.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-zinc-100 text-zinc-400 border-zinc-200'}`}>
                                                    {s.status === 'active' ? 'Kinh doanh' : 'Tạm dừng'}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-4 text-right pr-6 align-middle">
                                                <div className="flex items-center justify-end gap-1.5 opacity-100 sm:opacity-40 sm:group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleEditClick(s)} className="px-2.5 py-1 bg-zinc-100 hover:bg-purple-600 hover:text-white rounded-md font-black text-[10px] uppercase transition-all shadow-xs">Sửa</button>
                                                    {s.status === 'active' && (
                                                        <button onClick={() => handleDeleteClick(s)} className="px-2.5 py-1 bg-white border border-zinc-200 hover:bg-red-50 hover:text-red-500 hover:border-red-100 text-zinc-400 rounded-md font-black text-[10px] uppercase transition-all">Dừng</button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* FORM NHẬP LIỆU BÊN PHẢI (4 CỘT) */}
                <div className="col-span-4 bg-white p-4 rounded-2xl border border-zinc-200/60 shadow-xs flex flex-col justify-between min-h-0 overflow-y-auto custom-scrollbar">
                    <form onSubmit={handleSubmit} className="space-y-3 w-full">
                        <div className="border-b border-zinc-100 pb-2 flex justify-between items-center">
                            <h3 className="font-black text-xs text-zinc-900 uppercase tracking-wider">{isEditing ? '📝 Cập Nhật Dịch Vụ' : '✨ Thêm Dịch Vụ Mới'}</h3>
                            {isEditing && <button type="button" onClick={resetForm} className="text-[10px] font-black text-purple-600 hover:underline">Hủy sửa</button>}
                        </div>

                        <div>
                            <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Tên dịch vụ / hàng hóa *</label>
                            <input type="text" required placeholder="VD: Thuê vợt Yonex, Nước suối Aquafina..." value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-zinc-800 outline-none focus:border-purple-500 focus:bg-white transition-all shadow-xs" />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Phân loại *</label>
                                <select required value={form.service_type} onChange={(e) => setForm({ ...form, service_type: e.target.value })} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-2 text-xs font-bold text-zinc-800 outline-none focus:border-purple-500 transition-all cursor-pointer">
                                    <option value="drink">🥤 Nước uống</option>
                                    <option value="rental">🏸 Thuê dụng cụ</option>
                                    <option value="coaching">🎓 Huấn luyện</option>
                                    <option value="shuttlecock">📦 Quả cầu</option>
                                    <option value="other">⚙️ Khác</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Đơn vị tính</label>
                                <input type="text" placeholder="VD: Chai, Lượt, Giờ..." value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-zinc-800 outline-none focus:border-purple-500 focus:bg-white transition-all shadow-xs" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Đơn giá (VND) *</label>
                            <input type="number" min="0" required placeholder="VD: 15000" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-black text-zinc-800 outline-none focus:border-purple-500 focus:bg-white transition-all shadow-xs" />
                        </div>

                        <div>
                            <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Mô tả chi tiết</label>
                            <textarea rows="2" placeholder="Nhập mô tả dịch vụ..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-700 outline-none focus:border-purple-500 focus:bg-white transition-all shadow-xs resize-none" />
                        </div>

                        <div>
                            <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Trạng thái hoạt động</label>
                            <div className="grid grid-cols-2 gap-2 mt-1">
                                <button type="button" onClick={() => setForm({ ...form, status: 'active' })} className={`py-1.5 rounded-xl text-[10px] font-black transition-all border ${form.status === 'active' ? 'bg-purple-50 text-purple-600 border-purple-200 shadow-xs' : 'bg-zinc-50 text-zinc-400 border-zinc-100'}`}>🟢 KINH DOANH</button>
                                <button type="button" onClick={() => setForm({ ...form, status: 'inactive' })} className={`py-1.5 rounded-xl text-[10px] font-black transition-all border ${form.status === 'inactive' ? 'bg-zinc-100 text-zinc-500 border-zinc-300 shadow-xs' : 'bg-zinc-50 text-zinc-400 border-zinc-100'}`}>🔴 TẠM DỪNG</button>
                            </div>
                        </div>
                    </form>

                    <button onClick={handleSubmit} disabled={isProcessing || !form.name.trim() || form.price === ''} className={`w-full py-2.5 mt-4 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-md transition-all shrink-0 ${isEditing ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-100' : 'bg-purple-600 hover:bg-purple-700 shadow-purple-100'}`}>
                        {isProcessing ? 'Đang lưu dữ liệu...' : isEditing ? '💾 Cập nhật dịch vụ' : '➕ Tạo dịch vụ'}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default Services;