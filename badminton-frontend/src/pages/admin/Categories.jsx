import React, { useState, useEffect } from 'react';
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
                setMessage({ type: 'success', text: '✓ Cập nhật thành công!' });
            } else {
                await adminCategoryService.createCategory({
                    name: form.name,
                    description: form.description,
                    status: form.status
                });
                setMessage({ type: 'success', text: '✓ Thêm mới thành công!' });
            }
            resetForm();
            fetchCategories();
        } catch (error) {
            const errorMsg = error.response?.data?.message || 'Có lỗi xảy ra!';
            alert('⚠️ ' + errorMsg);
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
                setMessage({ type: 'success', text: '✓ Đã tạm ẩn danh mục!' });
                fetchCategories();
            } catch (error) {
                alert('❌ Thao tác thất bại!');
            } finally {
                setTimeout(() => setMessage({ type: '', text: '' }), 2500);
            }
        }
    };

    const resetForm = () => {
        setForm({ id: null, name: '', description: '', status: 'active' });
        setIsEditing(false);
    };

    return (
        // Kiểm soát chặt chiều cao h-[100dvh] không sinh scrollbar tổng
        <div className="max-w-[1600px] mx-auto p-3 gap-3 font-sans h-[calc(100vh-7rem)] flex flex-col overflow-hidden bg-zinc-50/50">

            {/* THÀNH PHẦN 1: HEADER CARD (THU GỌN) */}
            <div className="shrink-0 bg-white p-3 px-5 rounded-2xl border border-zinc-200/60 shadow-xs flex justify-between items-center relative overflow-hidden">
                <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-xs">🗂️</div>
                    <div>
                        <h2 className="text-base font-black text-zinc-900 tracking-tight leading-none">Cấu Hình Danh Mục Sản Phẩm</h2>
                        <p className="text-[10px] font-semibold text-zinc-400 mt-1">Phân loại nước uống, hàng hóa, dụng cụ cho quầy Pro-shop</p>
                    </div>
                </div>
                {message.text && (
                    <div className={`px-3 py-1 rounded-lg text-[11px] font-black tracking-tight border ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                        {message.text}
                    </div>
                )}
            </div>

            {/* THÀNH PHẦN 2: THÂN GRID CHÍNH (flex-1 min-h-0) */}
            <div className="flex-1 grid grid-cols-12 gap-3 min-h-0">

                {/* BẢNG DANH SÁCH BÊN TRÁI (CHIẾM 8 CỘT ĐỂ RỘNG RÃI HƠN) */}
                <div className="col-span-8 bg-white rounded-2xl border border-zinc-200/60 shadow-xs flex flex-col min-h-0 overflow-hidden">
                    <div className="flex-1 overflow-auto relative custom-scrollbar">
                        <table className="w-full text-left text-xs whitespace-nowrap">
                            <thead className="bg-zinc-50/80 font-black text-zinc-400 uppercase text-[9px] tracking-widest sticky top-0 z-10 border-b border-zinc-200/60 backdrop-blur-sm">
                                <tr>
                                    <th className="py-3 px-4 pl-6">Tên danh mục</th>
                                    <th className="py-3 px-4">Mô tả chi tiết</th>
                                    <th className="py-3 px-4 text-center">Trạng thái</th>
                                    <th className="py-3 px-4 text-right pr-6">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 bg-white">
                                {isLoading ? (
                                    <tr><td colSpan="4" className="py-12 text-center text-zinc-400 font-bold uppercase text-[10px] tracking-wider">Đang nạp dữ liệu...</td></tr>
                                ) : categories.length === 0 ? (
                                    <tr><td colSpan="4" className="py-12 text-center text-zinc-400 italic">Chưa có danh mục nào trong hệ thống.</td></tr>
                                ) : (
                                    categories.map(c => (
                                        <tr key={c.id} className="hover:bg-zinc-50/50 transition-colors group">
                                            <td className="py-2.5 px-4 pl-6 font-black text-zinc-900 text-xs tracking-tight">{c.name}</td>
                                            <td className="py-2.5 px-4 max-w-[280px] truncate text-zinc-500 font-semibold">{c.description || <span className="text-zinc-300 italic font-normal">Không có mô tả</span>}</td>
                                            <td className="py-2.5 px-4 text-center align-middle">
                                                <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase border ${c.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-zinc-100 text-zinc-400 border-zinc-200'}`}>
                                                    {c.status === 'active' ? 'Kinh doanh' : 'Tạm ẩn'}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-4 text-right pr-6 align-middle">
                                                <div className="flex items-center justify-end gap-1.5 opacity-100 sm:opacity-40 sm:group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleEditClick(c)} className="px-2.5 py-1 bg-zinc-100 hover:bg-blue-600 hover:text-white rounded-md font-black text-[10px] uppercase transition-all shadow-xs">Sửa</button>
                                                    {c.status === 'active' && (
                                                        <button onClick={() => handleDeleteClick(c)} className="px-2.5 py-1 bg-white border border-zinc-200 hover:bg-red-50 hover:text-red-500 hover:border-red-100 text-zinc-400 rounded-md font-black text-[10px] uppercase transition-all">Ẩn</button>
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

                {/* KHU VỰC THÊM / SỬA BÊN PHẢI (CHIẾM 4 CỘT - KIỂM SOÁT CHIỀU CAO TUYỆT ĐỐI) */}
                <div className="col-span-4 bg-white p-4 rounded-2xl border border-zinc-200/60 shadow-xs flex flex-col justify-between min-h-0 overflow-y-auto custom-scrollbar">

                    {/* Cụm Form cuộn nếu tràn */}
                    <form onSubmit={handleSubmit} className="space-y-3.5 w-full">
                        <div className="border-b border-zinc-100 pb-2 flex justify-between items-center">
                            <h3 className="font-black text-xs text-zinc-900 uppercase tracking-wider">{isEditing ? '📝 Cập Nhật Danh Mục' : '✨ Thêm Danh Mục Mới'}</h3>
                            {isEditing && <button type="button" onClick={resetForm} className="text-[10px] font-black text-blue-600 hover:underline">Hủy sửa</button>}
                        </div>

                        <div>
                            <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Tên danh mục *</label>
                            <input
                                type="text" required placeholder="VD: Nước giải khát, Phụ kiện..." value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-zinc-800 outline-none focus:border-blue-500 focus:bg-white transition-all shadow-xs"
                            />
                        </div>

                        <div>
                            <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Mô tả ngắn</label>
                            <textarea
                                rows="3" placeholder="Nhập mô tả ngắn..." value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-700 outline-none focus:border-blue-500 focus:bg-white transition-all shadow-xs resize-none"
                            />
                        </div>

                        <div>
                            <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Trạng thái hiển thị</label>
                            <div className="grid grid-cols-2 gap-2 mt-1">
                                <button
                                    type="button" onClick={() => setForm({ ...form, status: 'active' })}
                                    className={`py-1.5 rounded-xl text-[10px] font-black transition-all border ${form.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-xs' : 'bg-zinc-50 text-zinc-400 border-zinc-100'}`}
                                >
                                    🟢 KINH DOANH
                                </button>
                                <button
                                    type="button" onClick={() => setForm({ ...form, status: 'inactive' })}
                                    className={`py-1.5 rounded-xl text-[10px] font-black transition-all border ${form.status === 'inactive' ? 'bg-zinc-100 text-zinc-500 border-zinc-300 shadow-xs' : 'bg-zinc-50 text-zinc-400 border-zinc-100'}`}
                                >
                                    🔴 TẠM ẨN
                                </button>
                            </div>
                        </div>
                    </form>

                    {/* Nút Submit dán chặt ngay dưới Form chứ không đẩy xa vô căn cứ */}
                    <button
                        onClick={handleSubmit} disabled={isProcessing || !form.name.trim()}
                        className={`w-full py-2.5 mt-4 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-md transition-all shrink-0 ${isEditing ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-100' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'}`}
                    >
                        {isProcessing ? 'Đang lưu dữ liệu...' : isEditing ? '💾 Cập nhật danh mục' : '➕ Tạo danh mục mới'}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default Categories;