import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { adminSupplierService } from '../../services/admin/supplierService';

const SupplierManager = () => {
    const [suppliers, setSuppliers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [searchKeyword, setSearchKeyword] = useState('');

    const [form, setForm] = useState({ id: null, name: '', phone: '', email: '', address: '', contact_person: '' });
    const [isEditing, setIsEditing] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const fetchSuppliers = async () => {
        setIsLoading(true);
        try {
            const res = await adminSupplierService.getSuppliers(searchKeyword);
            setSuppliers(res.data?.data || []);
        } catch (error) {
            setMessage({ type: 'error', text: 'Không thể tải danh sách nhà cung cấp.' });
        } finally { setIsLoading(false); }
    };

    useEffect(() => { fetchSuppliers(); }, []);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchSuppliers();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;

        setIsProcessing(true);
        setMessage({ type: '', text: '' });

        const payload = {
            name: form.name, phone: form.phone || null,
            email: form.email || null, address: form.address || null,
            contact_person: form.contact_person || null
        };

        try {
            if (isEditing) {
                await adminSupplierService.updateSupplier(form.id, payload);
                setMessage({ type: 'success', text: 'Cập nhật đối tác thành công!' });
            } else {
                await adminSupplierService.createSupplier(payload);
                setMessage({ type: 'success', text: 'Thêm nhà cung cấp thành công!' });
            }
            resetForm();
            fetchSuppliers();
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.message || 'Có lỗi xảy ra!' });
        } finally {
            setIsProcessing(false);
            setTimeout(() => setMessage({ type: '', text: '' }), 2500);
        }
    };

    const handleEditClick = (supplier) => {
        setIsEditing(true);
        setForm({
            id: supplier.id, name: supplier.name, phone: supplier.phone || '',
            email: supplier.email || '', address: supplier.address || '',
            contact_person: supplier.contact_person || ''
        });
    };

    const handleDeleteClick = async (supplier) => {
        if (window.confirm(`Xóa vĩnh viễn nhà cung cấp [${supplier.name}]?`)) {
            try {
                await adminSupplierService.deleteSupplier(supplier.id);
                setMessage({ type: 'success', text: 'Đã xóa nhà cung cấp!' });
                fetchSuppliers();
            } catch (error) {
                setMessage({ type: 'error', text: error.response?.data?.message || 'Không thể xóa nhà cung cấp!' });
            } finally { setTimeout(() => setMessage({ type: '', text: '' }), 3000); }
        }
    };

    const resetForm = () => {
        setForm({ id: null, name: '', phone: '', email: '', address: '', contact_person: '' });
        setIsEditing(false);
    };

    const inputClass = "w-full bg-[#f8f8fa] border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200 transition-all";

    return (
        <div className="max-w-[1400px] mx-auto space-y-5">
            
            {/* HEADER */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-base font-semibold text-zinc-800">Nhà cung cấp</h2>
                    <p className="text-xs text-zinc-400 mt-0.5">Quản lý đối tác phân phối hàng hóa và dịch vụ</p>
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

            {/* TOOLBAR */}
            <div className="bg-white rounded-xl border border-zinc-200/60 p-4">
                <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
                    <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                        <input type="text" placeholder="Tìm tên hoặc số điện thoại..." value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-700 outline-none focus:border-zinc-300 focus:bg-white transition-all" />
                        <button type="submit" className="hidden"></button>
                    </form>
                    <span className="text-[11px] text-zinc-400 font-medium">Tổng: {suppliers.length} đối tác</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                
                {/* LIST TABLE (LEFT) */}
                <div className="lg:col-span-8 bg-white rounded-xl border border-zinc-200/60 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-zinc-50/60 border-b border-zinc-100 text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                                <tr>
                                    <th className="py-3 px-5" style={{width:'220px'}}>Công ty / Đại diện</th>
                                    <th className="py-3 px-3" style={{width:'120px'}}>Liên hệ</th>
                                    <th className="py-3 px-3" style={{width:'180px'}}>Địa chỉ</th>
                                    <th className="py-3 px-5 text-right" style={{width:'100px'}}>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr><td colSpan="4" className="py-16 text-center"><div className="inline-block w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" /></td></tr>
                                ) : suppliers.length === 0 ? (
                                    <tr><td colSpan="4" className="py-16 text-center text-xs text-zinc-400">Không tìm thấy nhà cung cấp nào</td></tr>
                                ) : (
                                    suppliers.map(s => (
                                        <tr key={s.id} className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50/40 transition-colors group">
                                            <td className="py-3.5 px-5">
                                                <p className="text-sm font-semibold text-zinc-800">{s.name}</p>
                                                <p className="text-[11px] text-zinc-500 mt-0.5">{s.contact_person || <span className="italic text-zinc-400">Không rõ đại diện</span>}</p>
                                            </td>
                                            <td className="py-3.5 px-3">
                                                <p className="text-xs font-mono text-zinc-700">{s.phone || <span className="italic text-zinc-400">Trống</span>}</p>
                                                {s.email && <p className="text-[10px] text-zinc-500 mt-0.5">{s.email}</p>}
                                            </td>
                                            <td className="py-3.5 px-3">
                                                <p className="text-xs text-zinc-600 max-w-[200px] truncate">{s.address || <span className="italic text-zinc-400">Chưa có</span>}</p>
                                            </td>
                                            <td className="py-3.5 px-5 text-right">
                                                <div className="flex items-center justify-end gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleEditClick(s)} className="px-2.5 py-1 border border-zinc-200 text-zinc-500 rounded text-[10px] hover:bg-zinc-50 transition-colors">Sửa</button>
                                                    <button onClick={() => handleDeleteClick(s)} className="px-2 py-1 text-zinc-400 rounded text-[10px] hover:text-red-500 hover:bg-red-50 transition-colors">Xóa</button>
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
                        <h3 className="text-sm font-semibold text-zinc-800">{isEditing ? 'Sửa nhà cung cấp' : 'Thêm nhà cung cấp'}</h3>
                        {isEditing && (
                            <button onClick={resetForm} className="text-[10px] font-medium text-zinc-400 hover:text-zinc-600 transition-colors">
                                Hủy sửa
                            </button>
                        )}
                    </div>
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">Tên công ty / Đối tác *</label>
                            <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="VD: Công ty TNHH ABC" />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">Số điện thoại</label>
                                <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} placeholder="0987..." />
                            </div>
                            <div>
                                <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">Người đại diện</label>
                                <input type="text" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} className={inputClass} placeholder="Nguyễn Văn A" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">Email liên hệ</label>
                            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} placeholder="contact@example.com" />
                        </div>

                        <div>
                            <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">Địa chỉ</label>
                            <textarea rows="2" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={`${inputClass} resize-none`} placeholder="Địa chỉ kho / văn phòng" />
                        </div>

                        <div className="pt-2">
                            <button type="submit" disabled={isProcessing || !form.name.trim()} 
                                className={`w-full py-2.5 rounded-lg text-xs font-medium text-white transition-colors ${isEditing ? 'bg-zinc-900 hover:bg-zinc-800' : 'bg-lime-600 hover:bg-lime-700'} ${(isProcessing || !form.name.trim()) ? 'opacity-60 cursor-not-allowed' : ''}`}>
                                {isProcessing ? 'Đang lưu...' : isEditing ? 'Lưu thay đổi' : 'Tạo nhà cung cấp'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default SupplierManager;