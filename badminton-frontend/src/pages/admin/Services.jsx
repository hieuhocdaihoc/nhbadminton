import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { adminAdditionalService } from '../../services/admin/additionalService';

const Services = () => {
    const [services, setServices] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState({ type: '', text: '' });

    const [form, setForm] = useState({ id: null, name: '', service_type: 'drink', price: '', unit: 'Lượt', description: '', status: 'active' });
    const [isEditing, setIsEditing] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const TYPE_LABELS = {
        drink: 'Nước uống',
        rental: 'Thuê dụng cụ',
        coaching: 'Huấn luyện',
        shuttlecock: 'Quả cầu',
        other: 'Khác'
    };

    const fetchServices = async () => {
        setIsLoading(true);
        try {
            const res = await adminAdditionalService.getServices();
            setServices(res.data?.data || []);
        } catch (error) {
            setMessage({ type: 'error', text: 'Không thể tải danh sách dịch vụ.' });
        } finally { setIsLoading(false); }
    };

    useEffect(() => { fetchServices(); }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim() || form.price === '') return;
        setIsProcessing(true);
        setMessage({ type: '', text: '' });

        const payload = {
            name: form.name, service_type: form.service_type,
            price: Number(form.price), unit: form.unit,
            description: form.description, status: form.status
        };

        try {
            if (isEditing) {
                await adminAdditionalService.updateService(form.id, payload);
                setMessage({ type: 'success', text: 'Cập nhật dịch vụ thành công!' });
            } else {
                await adminAdditionalService.createService(payload);
                setMessage({ type: 'success', text: 'Thêm dịch vụ mới thành công!' });
            }
            resetForm();
            fetchServices();
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.message || 'Có lỗi xảy ra!' });
        } finally {
            setIsProcessing(false);
            setTimeout(() => setMessage({ type: '', text: '' }), 2500);
        }
    };

    const handleEditClick = (service) => {
        setIsEditing(true);
        setForm({
            id: service.id, name: service.name, service_type: service.service_type,
            price: service.price, unit: service.unit || 'Lượt',
            description: service.description || '', status: service.status
        });
    };

    const handleDeleteClick = async (service) => {
        if (window.confirm(`Bạn có chắc chắn muốn ngưng kinh doanh dịch vụ [${service.name}]?`)) {
            try {
                await adminAdditionalService.deleteService(service.id);
                setMessage({ type: 'success', text: 'Đã chuyển sang tạm ẩn!' });
                fetchServices();
            } catch (error) { setMessage({ type: 'error', text: 'Thao tác thất bại!' }); }
            finally { setTimeout(() => setMessage({ type: '', text: '' }), 2500); }
        }
    };

    const resetForm = () => {
        setForm({ id: null, name: '', service_type: 'drink', price: '', unit: 'Lượt', description: '', status: 'active' });
        setIsEditing(false);
    };

    const inputClass = "w-full bg-[#f8f8fa] border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200 transition-all";

    return (
        <div className="max-w-[1400px] mx-auto space-y-5">
            
            {/* HEADER */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-base font-semibold text-zinc-800">Dịch vụ bổ sung</h2>
                    <p className="text-xs text-zinc-400 mt-0.5">Quản lý giá thuê vợt, huấn luyện viên, dịch vụ ngoài</p>
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

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                
                {/* LIST TABLE (LEFT) */}
                <div className="lg:col-span-8 bg-white rounded-xl border border-zinc-200/60 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-zinc-50/60 border-b border-zinc-100 text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                                <tr>
                                    <th className="py-3 px-5" style={{width:'220px'}}>Dịch vụ</th>
                                    <th className="py-3 px-3" style={{width:'110px'}}>Phân loại</th>
                                    <th className="py-3 px-3 text-right" style={{width:'100px'}}>Đơn giá</th>
                                    <th className="py-3 px-3 text-center" style={{width:'80px'}}>Đơn vị</th>
                                    <th className="py-3 px-3 text-center" style={{width:'100px'}}>Trạng thái</th>
                                    <th className="py-3 px-5 text-right" style={{width:'100px'}}>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr><td colSpan="6" className="py-16 text-center"><div className="inline-block w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" /></td></tr>
                                ) : services.length === 0 ? (
                                    <tr><td colSpan="6" className="py-16 text-center text-xs text-zinc-400">Chưa cấu hình dịch vụ nào</td></tr>
                                ) : (
                                    services.map(s => (
                                        <tr key={s.id} className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50/40 transition-colors group">
                                            <td className="py-3.5 px-5">
                                                <p className="text-sm font-semibold text-zinc-800">{s.name}</p>
                                                <p className="text-xs text-zinc-500 mt-0.5 max-w-[200px] truncate">{s.description || <span className="italic text-zinc-400">Không có mô tả</span>}</p>
                                            </td>
                                            <td className="py-3.5 px-3 text-xs text-zinc-600">{TYPE_LABELS[s.service_type] || s.service_type}</td>
                                            <td className="py-3.5 px-3 text-right">
                                                <span className="text-sm font-semibold text-zinc-800">{Number(s.price).toLocaleString()}₫</span>
                                            </td>
                                            <td className="py-3.5 px-3 text-center">
                                                <span className="text-xs text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded">{s.unit || 'Lượt'}</span>
                                            </td>
                                            <td className="py-3.5 px-3 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${s.status === 'active' ? 'text-emerald-700 bg-emerald-50' : 'text-zinc-500 bg-zinc-100'}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${s.status === 'active' ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                                                    {s.status === 'active' ? 'Kinh doanh' : 'Tạm dừng'}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-5 text-right">
                                                <div className="flex items-center justify-end gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleEditClick(s)} className="px-2.5 py-1 border border-zinc-200 text-zinc-500 rounded text-[10px] hover:bg-zinc-50 transition-colors">Sửa</button>
                                                    {s.status === 'active' && (
                                                        <button onClick={() => handleDeleteClick(s)} className="px-2 py-1 text-zinc-400 rounded text-[10px] hover:text-red-500 hover:bg-red-50 transition-colors">Dừng</button>
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

                {/* FORM (RIGHT) */}
                <div className="lg:col-span-4 bg-white rounded-xl border border-zinc-200/60 p-5 sticky top-5">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-100">
                        <h3 className="text-sm font-semibold text-zinc-800">{isEditing ? 'Sửa dịch vụ' : 'Thêm dịch vụ mới'}</h3>
                        {isEditing && (
                            <button onClick={resetForm} className="text-[10px] font-medium text-zinc-400 hover:text-zinc-600 transition-colors">
                                Hủy sửa
                            </button>
                        )}
                    </div>
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">Tên dịch vụ *</label>
                            <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="VD: Thuê vợt Yonex" />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">Phân loại *</label>
                                <select required value={form.service_type} onChange={(e) => setForm({ ...form, service_type: e.target.value })} className={inputClass}>
                                    <option value="drink">Nước uống</option>
                                    <option value="rental">Thuê dụng cụ</option>
                                    <option value="coaching">Huấn luyện</option>
                                    <option value="shuttlecock">Quả cầu</option>
                                    <option value="other">Khác</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">Đơn vị tính</label>
                                <input type="text" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={inputClass} placeholder="VD: Lượt, Giờ..." />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">Đơn giá (₫) *</label>
                            <input type="number" min="0" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={inputClass} placeholder="15000" />
                        </div>

                        <div>
                            <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">Mô tả chi tiết</label>
                            <textarea rows="2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${inputClass} resize-none`} placeholder="Mô tả đặc tính dịch vụ..." />
                        </div>

                        <div>
                            <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">Trạng thái hiển thị</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button type="button" onClick={() => setForm({ ...form, status: 'active' })} 
                                    className={`py-2 rounded-lg text-xs font-medium transition-colors border ${form.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-zinc-50 text-zinc-400 border-transparent hover:bg-zinc-100'}`}>
                                    Kinh doanh
                                </button>
                                <button type="button" onClick={() => setForm({ ...form, status: 'inactive' })} 
                                    className={`py-2 rounded-lg text-xs font-medium transition-colors border ${form.status === 'inactive' ? 'bg-zinc-100 text-zinc-600 border-zinc-300' : 'bg-zinc-50 text-zinc-400 border-transparent hover:bg-zinc-100'}`}>
                                    Tạm dừng
                                </button>
                            </div>
                        </div>

                        <div className="pt-2">
                            <button type="submit" disabled={isProcessing || !form.name.trim() || form.price === ''} 
                                className={`w-full py-2.5 rounded-lg text-xs font-medium text-white transition-colors ${isEditing ? 'bg-zinc-900 hover:bg-zinc-800' : 'bg-lime-600 hover:bg-lime-700'} ${(isProcessing || !form.name.trim() || form.price === '') ? 'opacity-60 cursor-not-allowed' : ''}`}>
                                {isProcessing ? 'Đang lưu...' : isEditing ? 'Lưu thay đổi' : 'Tạo dịch vụ'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Services;