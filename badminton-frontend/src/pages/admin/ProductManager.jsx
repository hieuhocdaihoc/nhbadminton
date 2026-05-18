import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { adminProductService } from '../../services/admin/productService';
import { adminCategoryService } from '../../services/admin/categoryService';

const ProductManager = () => {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState({ type: '', text: '' });

    const [pagination, setPagination] = useState({ current_page: 1, last_page: 1 });
    const [searchKeyword, setSearchKeyword] = useState('');
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');

    const [form, setForm] = useState({
        id: null, category_id: '', name: '', sku: '', brand: '',
        selling_price: '', low_stock_threshold: 5, description: ''
    });
    const [isEditing, setIsEditing] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const loadInitData = async () => {
        try {
            const catRes = await adminCategoryService.getCategories();
            const activeCats = (catRes.data?.data || []).filter(c => c.status === 'active');
            setCategories(activeCats);
        } catch (e) { console.error("Lỗi đồng bộ danh mục hệ thống:", e); }
    };

    const fetchProducts = async (page = 1) => {
        setIsLoading(true);
        try {
            const res = await adminProductService.getProducts(page, searchKeyword, selectedCategoryFilter);
            const serverData = res.data?.data;
            setProducts(serverData?.data || []);
            setPagination({ current_page: serverData?.current_page || 1, last_page: serverData?.last_page || 1 });
        } catch (error) {
            setMessage({ type: 'error', text: 'Không thể tải danh sách sản phẩm.' });
        } finally { setIsLoading(false); }
    };

    useEffect(() => { loadInitData(); }, []);
    useEffect(() => { fetchProducts(1); }, [selectedCategoryFilter]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchProducts(1);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.category_id || !form.name.trim() || !form.sku.trim() || form.selling_price === '') return;
        setIsProcessing(true);
        setMessage({ type: '', text: '' });

        const payload = {
            category_id: form.category_id, name: form.name, sku: form.sku, brand: form.brand,
            selling_price: Number(form.selling_price), low_stock_threshold: Number(form.low_stock_threshold || 5),
            description: form.description
        };

        try {
            if (isEditing) {
                await adminProductService.updateProduct(form.id, payload);
                setMessage({ type: 'success', text: 'Cập nhật thành công!' });
            } else {
                await adminProductService.createProduct(payload);
                setMessage({ type: 'success', text: 'Thêm mới thành công!' });
            }
            resetForm();
            fetchProducts(pagination.current_page);
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.message || 'Có lỗi xảy ra!' });
        } finally {
            setIsProcessing(false);
            setTimeout(() => setMessage({ type: '', text: '' }), 2500);
        }
    };

    const handleEditClick = (product) => {
        setIsEditing(true);
        setForm({
            id: product.id, category_id: product.category_id, name: product.name, sku: product.sku,
            brand: product.brand || '', selling_price: product.selling_price,
            low_stock_threshold: product.low_stock_threshold, description: product.description || ''
        });
    };

    const handleDeleteClick = async (product) => {
        if (window.confirm(`Bạn có chắc muốn tạm dừng bán [${product.name}]?`)) {
            try {
                await adminProductService.deleteProduct(product.id);
                setMessage({ type: 'success', text: 'Đã tạm dừng kinh doanh!' });
                fetchProducts(pagination.current_page);
            } catch (e) { setMessage({ type: 'error', text: 'Thao tác thất bại!' }); }
            finally { setTimeout(() => setMessage({ type: '', text: '' }), 2500); }
        }
    };

    const handleRestoreClick = async (product) => {
        if (window.confirm(`Kích hoạt mở bán lại cho sản phẩm [${product.name}]?`)) {
            try {
                await adminProductService.restoreProduct(product.id);
                setMessage({ type: 'success', text: 'Đã khôi phục hoạt động!' });
                fetchProducts(pagination.current_page);
            } catch (e) { setMessage({ type: 'error', text: 'Kích hoạt lại thất bại!' }); }
            finally { setTimeout(() => setMessage({ type: '', text: '' }), 2500); }
        }
    };

    const resetForm = () => {
        setForm({ id: null, category_id: '', name: '', sku: '', brand: '', selling_price: '', low_stock_threshold: 5, description: '' });
        setIsEditing(false);
    };

    const inputClass = "w-full bg-[#f8f8fa] border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200 transition-all";

    return (
        <div className="max-w-[1400px] mx-auto space-y-5">
            
            {/* HEADER */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-base font-semibold text-zinc-800">Quản lý sản phẩm</h2>
                    <p className="text-xs text-zinc-400 mt-0.5">Thiết lập giá bán lẻ và theo dõi tồn kho</p>
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
                    <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-72">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                        <input type="text" placeholder="Tìm tên hoặc SKU..." value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-700 outline-none focus:border-zinc-300 focus:bg-white transition-all" />
                        <button type="submit" className="hidden"></button>
                    </form>
                    <div className="w-full sm:w-auto flex items-center gap-2">
                        <span className="text-xs text-zinc-500">Danh mục:</span>
                        <select value={selectedCategoryFilter} onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                            className="bg-[#f8f8fa] border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-700 outline-none focus:border-zinc-400 transition-colors cursor-pointer">
                            <option value="">Tất cả</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                
                {/* LIST TABLE (LEFT) */}
                <div className="lg:col-span-8 bg-white rounded-xl border border-zinc-200/60 overflow-hidden flex flex-col">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-zinc-50/60 border-b border-zinc-100 text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                                <tr>
                                    <th className="py-3 px-5" style={{width:'240px'}}>Sản phẩm / SKU</th>
                                    <th className="py-3 px-3" style={{width:'120px'}}>Danh mục</th>
                                    <th className="py-3 px-3 text-right" style={{width:'100px'}}>Giá bán</th>
                                    <th className="py-3 px-3 text-center" style={{width:'80px'}}>Tồn kho</th>
                                    <th className="py-3 px-3 text-center" style={{width:'100px'}}>Trạng thái</th>
                                    <th className="py-3 px-5 text-right" style={{width:'120px'}}>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr><td colSpan="6" className="py-16 text-center"><div className="inline-block w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" /></td></tr>
                                ) : products.length === 0 ? (
                                    <tr><td colSpan="6" className="py-16 text-center text-xs text-zinc-400">Không tìm thấy sản phẩm nào</td></tr>
                                ) : (
                                    products.map(p => {
                                        const isLowStock = p.stock_quantity <= p.low_stock_threshold;
                                        return (
                                            <tr key={p.id} className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50/40 transition-colors group">
                                                <td className="py-3.5 px-5">
                                                    <p className="text-sm font-semibold text-zinc-800">{p.name}</p>
                                                    <p className="text-[10px] font-mono text-zinc-500 mt-0.5">{p.sku} {p.brand && `· ${p.brand}`}</p>
                                                </td>
                                                <td className="py-3.5 px-3">
                                                    <span className="text-xs text-zinc-600">{p.category?.name || <span className="italic text-zinc-400">Chưa rõ</span>}</span>
                                                </td>
                                                <td className="py-3.5 px-3 text-right">
                                                    <span className="text-sm font-semibold text-zinc-800">{Number(p.selling_price).toLocaleString()}₫</span>
                                                </td>
                                                <td className="py-3.5 px-3 text-center">
                                                    <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-medium ${isLowStock ? 'bg-red-50 text-red-600' : 'bg-zinc-100 text-zinc-700'}`}>
                                                        {p.stock_quantity}
                                                    </span>
                                                </td>
                                                <td className="py-3.5 px-3 text-center">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${p.status === 'active' ? 'text-emerald-700 bg-emerald-50' : 'text-zinc-500 bg-zinc-100'}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${p.status === 'active' ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                                                        {p.status === 'active' ? 'Kinh doanh' : 'Tạm dừng'}
                                                    </span>
                                                </td>
                                                <td className="py-3.5 px-5 text-right">
                                                    <div className="flex items-center justify-end gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => handleEditClick(p)} className="px-2.5 py-1 border border-zinc-200 text-zinc-500 rounded text-[10px] hover:bg-zinc-50 transition-colors">Sửa</button>
                                                        {p.status === 'active' ? (
                                                            <button onClick={() => handleDeleteClick(p)} className="px-2.5 py-1 text-zinc-400 rounded text-[10px] hover:text-red-500 hover:bg-red-50 transition-colors">Dừng</button>
                                                        ) : (
                                                            <button onClick={() => handleRestoreClick(p)} className="px-2.5 py-1 text-emerald-600 bg-emerald-50 rounded text-[10px] font-medium hover:bg-emerald-100 transition-colors">Bật</button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    
                    {/* PAGINATION */}
                    {pagination.last_page > 1 && (
                        <div className="shrink-0 px-5 py-3 border-t border-zinc-100 flex justify-between items-center bg-zinc-50/50">
                            <span className="text-xs text-zinc-500">Trang {pagination.current_page} / {pagination.last_page}</span>
                            <div className="flex gap-2">
                                <button disabled={pagination.current_page === 1} onClick={() => fetchProducts(pagination.current_page - 1)} className="px-3 py-1.5 bg-white border border-zinc-200 hover:bg-zinc-50 disabled:opacity-50 rounded-lg text-xs font-medium text-zinc-600 transition-colors">Trước</button>
                                <button disabled={pagination.current_page === pagination.last_page} onClick={() => fetchProducts(pagination.current_page + 1)} className="px-3 py-1.5 bg-white border border-zinc-200 hover:bg-zinc-50 disabled:opacity-50 rounded-lg text-xs font-medium text-zinc-600 transition-colors">Tiếp</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* FORM (RIGHT) */}
                <div className="lg:col-span-4 bg-white rounded-xl border border-zinc-200/60 p-5 sticky top-5">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-100">
                        <h3 className="text-sm font-semibold text-zinc-800">{isEditing ? 'Sửa thông tin hàng hóa' : 'Thêm sản phẩm mới'}</h3>
                        {isEditing && (
                            <button onClick={resetForm} className="text-[10px] font-medium text-zinc-400 hover:text-zinc-600 transition-colors">
                                Hủy sửa
                            </button>
                        )}
                    </div>
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">Danh mục *</label>
                                <select required value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className={inputClass}>
                                    <option value="" disabled>Chọn danh mục</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">Mã SKU *</label>
                                <input type="text" required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className={`${inputClass} font-mono`} placeholder="VD: STING_LON" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">Tên sản phẩm *</label>
                            <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="VD: Nước tăng lực Sting" />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">Giá bán lẻ (₫) *</label>
                                <input type="number" min="0" required value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} className={inputClass} placeholder="12000" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">Mức báo yếu tồn kho</label>
                                <input type="number" min="0" required value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} className={inputClass} />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">Thương hiệu</label>
                            <input type="text" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className={inputClass} placeholder="VD: Pepsico" />
                        </div>

                        <div>
                            <label className="block text-[11px] font-medium text-zinc-500 mb-1.5">Ghi chú / Mô tả</label>
                            <textarea rows="2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${inputClass} resize-none`} placeholder="Mô tả thêm..." />
                        </div>

                        <div className="pt-2">
                            <button type="submit" disabled={isProcessing || !form.name.trim() || !form.sku.trim() || form.selling_price === '' || !form.category_id} 
                                className={`w-full py-2.5 rounded-lg text-xs font-medium text-white transition-colors ${isEditing ? 'bg-zinc-900 hover:bg-zinc-800' : 'bg-lime-600 hover:bg-lime-700'} ${(isProcessing || !form.name.trim() || !form.sku.trim() || form.selling_price === '' || !form.category_id) ? 'opacity-60 cursor-not-allowed' : ''}`}>
                                {isProcessing ? 'Đang lưu...' : isEditing ? 'Lưu thay đổi' : 'Tạo sản phẩm'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ProductManager;