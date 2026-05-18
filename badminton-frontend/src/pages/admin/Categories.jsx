import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { adminCategoryService } from '../../services/admin/categoryService';

const Categories = () => {
    const [categories, setCategories] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState({ type: '', text: '' });

    const [form, setForm] = useState({ id: null, name: '', description: '', status: 'active' });
    const [isEditing, setIsEditing] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const fetchCategories = async () => {
        setIsLoading(true);
        try {
            const res = await adminCategoryService.getCategories();
            setCategories(res.data?.data || []);
        } catch (error) {
            setMessage({ type: 'error', text: 'Không thể tải danh sách danh mục.' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchCategories(); }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        setIsProcessing(true);
        setMessage({ type: '', text: '' });

        try {
            if (isEditing) {
                await adminCategoryService.updateCategory(form.id, {
                    name: form.name,
                    description: form.description,
                    status: form.status
                });
                setMessage({ type: 'success', text: 'Cập nhật thành công!' });
            } else {
                await adminCategoryService.createCategory({
                    name: form.name,
                    description: form.description,
                    status: form.status
                });
                setMessage({ type: 'success', text: 'Thêm mới thành công!' });
            }
            resetForm();
            fetchCategories();
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.message || 'Có lỗi xảy ra!' });
        } finally {
            setIsProcessing(false);
            setTimeout(() => setMessage({ type: '', text: '' }), 2500);
        }
    };

    const handleEditClick = (category) => {
        setIsEditing(true);
        setForm({
            id: category.id,
            name: category.name,
            description: category.description || '',
            status: category.status
        });
    };

    const handleDeleteClick = async (category) => {
        if (window.confirm(`Bạn có chắc chắn muốn tạm ẩn danh mục [${category.name}]?`)) {
            try {
                await adminCategoryService.deleteCategory(category.id);
                setMessage({ type: 'success', text: 'Đã tạm ẩn danh mục!' });
                fetchCategories();
            } catch (error) {
                setMessage({ type: 'error', text: 'Thao tác thất bại!' });
            } finally {
                setTimeout(() => setMessage({ type: '', text: '' }), 2500);
            }
        }
    };

    const resetForm = () => {
        setForm({ id: null, name: '', description: '', status: 'active' });
        setIsEditing(false);
    };

    const inputClass = "w-full bg-[#f8f8fa] border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200 transition-all";

    return (
        <div className="max-w-[1400px] mx-auto space-y-5">
            
            {/* HEADER */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-base font-semibold text-zinc-800">Danh mục sản phẩm</h2>
                    <p className="text-xs text-zinc-400 mt-0.5">Phân loại hàng hóa và dịch vụ cho Pro-shop</p>
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
                                    <th className="py-3 px-5" style={{width:'200px'}}>Tên danh mục</th>
                                    <th className="py-3 px-3" style={{width:'300px'}}>Mô tả</th>
                                    <th className="py-3 px-3 text-center" style={{width:'100px'}}>Trạng thái</th>
                                    <th className="py-3 px-5 text-right" style={{width:'100px'}}>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr><td colSpan="4" className="py-16 text-center"><div className="inline-block w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" /></td></tr>
                                ) : categories.length === 0 ? (
                                    <tr><td colSpan="4" className="py-16 text-center text-xs text-zinc-400">Chưa có danh mục nào</td></tr>
                                ) : (
                                    categories.map(c => (
                                        <tr key={c.id} className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50/40 transition-colors group">
                                            <td className="py-3.5 px-5 text-sm font-semibold text-zinc-800">{c.name}</td>
                                            <td className="py-3.5 px-3">
                                                <p className="text-xs text-zinc-500 truncate max-w-[280px]">
                                                    {c.description || <span className="text-zinc-300 italic">Không có mô tả</span>}
                                                </p>
                                            </td>
                                            <td className="py-3.5 px-3 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${c.status === 'active' ? 'text-emerald-700 bg-emerald-50' : 'text-zinc-500 bg-zinc-100'}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${c.status === 'active' ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                                                    {c.status === 'active' ? 'Hoạt động' : 'Tạm ẩn'}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-5 text-right">
                                                <div className="flex items-center justify-end gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleEditClick(c)} className="px-2.5 py-1 border border-zinc-200 text-zinc-500 rounded text-[10px] hover:bg-zinc-50 transition-colors">Sửa</button>
                                                    {c.status === 'active' && (
                                                        <button onClick={() => handleDeleteClick(c)} className="px-2 py-1 text-zinc-400 rounded text-[10px] hover:text-red-500 hover:bg-red-50 transition-colors">Ẩn</button>
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
                        <h3 className="text-sm font-semibold text-zinc-800">{isEditing ? 'Sửa danh mục' : 'Thêm danh mục mới'}</h3>
                        {isEditing && (
                            <button onClick={resetForm} className="text-[10px] font-medium text-zinc-400 hover:text-zinc-600 transition-colors">
                                Hủy sửa
                            </button>
                        )}
                    </div>
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">Tên danh mục *</label>
                            <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="Ví dụ: Nước giải khát" />
                        </div>
                        
                        <div>
                            <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">Mô tả chi tiết</label>
                            <textarea rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${inputClass} resize-none`} placeholder="Ghi chú thêm (không bắt buộc)..." />
                        </div>

                        <div>
                            <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">Trạng thái hiển thị</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button type="button" onClick={() => setForm({ ...form, status: 'active' })} 
                                    className={`py-2 rounded-lg text-xs font-medium transition-colors border ${form.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-zinc-50 text-zinc-400 border-transparent hover:bg-zinc-100'}`}>
                                    Hoạt động
                                </button>
                                <button type="button" onClick={() => setForm({ ...form, status: 'inactive' })} 
                                    className={`py-2 rounded-lg text-xs font-medium transition-colors border ${form.status === 'inactive' ? 'bg-zinc-100 text-zinc-600 border-zinc-300' : 'bg-zinc-50 text-zinc-400 border-transparent hover:bg-zinc-100'}`}>
                                    Tạm ẩn
                                </button>
                            </div>
                        </div>

                        <div className="pt-2">
                            <button type="submit" disabled={isProcessing || !form.name.trim()} 
                                className={`w-full py-2.5 rounded-lg text-xs font-medium text-white transition-colors ${isEditing ? 'bg-zinc-900 hover:bg-zinc-800' : 'bg-lime-600 hover:bg-lime-700'} ${(isProcessing || !form.name.trim()) ? 'opacity-60 cursor-not-allowed' : ''}`}>
                                {isProcessing ? 'Đang lưu...' : isEditing ? 'Lưu thay đổi' : 'Tạo danh mục'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Categories;