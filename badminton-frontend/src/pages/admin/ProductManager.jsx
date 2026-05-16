import React, { useState, useEffect } from 'react';
import { adminProductService } from '../../services/admin/productService';
import { adminCategoryService } from '../../services/admin/categoryService';

const ProductManager = () => {
    // STATE DỮ LIỆU CỐT LÕI
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState({ type: '', text: '' });

    // STATE PHÂN TRANG & BỘ LỌC TÌM KIẾM
    const [pagination, setPagination] = useState({ current_page: 1, last_page: 1 });
    const [searchKeyword, setSearchKeyword] = useState('');
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');

    // STATE BAN ĐIỀU HÀNH FORM (THÊM / SỬA)
    const [form, setForm] = useState({
        id: null, category_id: '', name: '', sku: '', brand: '',
        selling_price: '', low_stock_threshold: 5, description: ''
    });
    const [isEditing, setIsEditing] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // --- TẢI DANH MỤC ĐỂ ĐỔ VÀO MENUS MÀN HÌNH ---
    const loadInitData = async () => {
        try {
            const catRes = await adminCategoryService.getCategories();
            const activeCats = (catRes.data?.data || []).filter(c => c.status === 'active');
            setCategories(activeCats);
        } catch (e) {
            console.error("Lỗi đồng bộ danh mục hệ thống:", e);
        }
    };

    // --- TẢI DANH SÁCH SẢN PHẨM PHÂN TRANG ---
    const fetchProducts = async (page = 1) => {
        setIsLoading(true);
        try {
            const res = await adminProductService.getProducts(page, searchKeyword, selectedCategoryFilter);
            const serverData = res.data?.data;

            setProducts(serverData?.data || []);
            setPagination({
                current_page: serverData?.current_page || 1,
                last_page: serverData?.last_page || 1
            });
        } catch (error) {
            setMessage({ type: 'error', text: 'Không thể tải danh sách sản phẩm.' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadInitData();
    }, []);

    useEffect(() => {
        fetchProducts(1);
    }, [selectedCategoryFilter]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchProducts(1);
    };

    // --- XỬ LÝ SUBMIT: THÊM MỚI HOẶC CẬP NHẬT ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.category_id || !form.name.trim() || !form.sku.trim() || form.selling_price === '') {
            return alert('Vui lòng điền đầy đủ các trường thông tin bắt buộc (*)!');
        }
        setIsProcessing(true);
        setMessage({ type: '', text: '' });

        const payload = {
            category_id: form.category_id,
            name: form.name,
            sku: form.sku,
            brand: form.brand,
            selling_price: Number(form.selling_price),
            low_stock_threshold: Number(form.low_stock_threshold || 5),
            description: form.description
        };

        try {
            if (isEditing) {
                await adminProductService.updateProduct(form.id, payload);
                setMessage({ type: 'success', text: '🎉 Cập nhật thông tin hàng hóa thành công!' });
            } else {
                await adminProductService.createProduct(payload);
                setMessage({ type: 'success', text: '🚀 Khai báo sản phẩm mới thành công!' });
            }
            resetForm();
            fetchProducts(pagination.current_page);
        } catch (error) {
            const errorMsg = error.response?.data?.message || 'Có lỗi xảy ra (Vui lòng kiểm tra lại mã SKU)!';
            alert('⚠️ ' + errorMsg);
        } finally {
            setIsProcessing(false);
            setTimeout(() => setMessage({ type: '', text: '' }), 2500);
        }
    };

    const handleEditClick = (product) => {
        setIsEditing(true);
        setForm({
            id: product.id,
            category_id: product.category_id,
            name: product.name,
            sku: product.sku,
            brand: product.brand || '',
            selling_price: product.selling_price,
            low_stock_threshold: product.low_stock_threshold,
            description: product.description || ''
        });
    };

    // THAO TÁC 1: TẠM DỪNG HOẠT ĐỘNG (DESTROY - INACTIVE)
    const handleDeleteClick = async (product) => {
        if (window.confirm(`Bạn có chắc muốn tạm dừng bán [${product.name}]? Ca chơi hôm nay của quầy lễ tân sẽ không chọn được món này.`)) {
            try {
                await adminProductService.deleteProduct(product.id);
                setMessage({ type: 'success', text: '✓ Đã tạm dừng kinh doanh sản phẩm!' });
                fetchProducts(pagination.current_page);
            } catch (e) {
                alert('❌ Thao tác thất bại!');
            } finally {
                setTimeout(() => setMessage({ type: '', text: '' }), 2500);
            }
        }
    };

    // THAO TÁC 2: KÍCH HOẠT MỞ BÁN LẠI (RESTORE - ACTIVE)
    const handleRestoreClick = async (product) => {
        if (window.confirm(`Kích hoạt mở bán lại cho sản phẩm [${product.name}]?`)) {
            try {
                // ĐẢM BẢO DÒNG NÀY GỌI ĐÚNG TÊN HÀM TRONG FILE productService.js CỦA BẠN 👇
                await adminProductService.restoreProduct(product.id);

                setMessage({ type: 'success', text: '✓ Đã khôi phục hoạt động cho sản phẩm!' });
                fetchProducts(pagination.current_page);
            } catch (e) {
                alert('❌ Kích hoạt lại sản phẩm thất bại!');
            } finally {
                setTimeout(() => setMessage({ type: '', text: '' }), 2500);
            }
        }
    };

    const resetForm = () => {
        setForm({ id: null, category_id: '', name: '', sku: '', brand: '', selling_price: '', low_stock_threshold: 5, description: '' });
        setIsEditing(false);
    };

    return (
        <div className="max-w-[1600px] mx-auto p-3 gap-3 font-sans h-[calc(100vh-7rem)] flex flex-col overflow-hidden bg-zinc-50/50">

            {/* HEADER CARD */}
            <div className="shrink-0 bg-white p-3 px-5 rounded-2xl border border-zinc-200/60 shadow-xs flex justify-between items-center relative overflow-hidden">
                <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-xs">📦</div>
                    <div>
                        <h2 className="text-base font-black text-zinc-900 tracking-tight leading-none">Quản Lý Sản Phẩm & Kho Hàng</h2>
                        <p className="text-[10px] font-semibold text-zinc-400 mt-1">Thiết lập giá bán lẻ nước uống, phụ kiện và theo dõi cảnh báo tồn kho tối thiểu</p>
                    </div>
                </div>
                {message.text && (
                    <div className={`px-3 py-1 rounded-lg text-[11px] font-black tracking-tight border ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                        {message.text}
                    </div>
                )}
            </div>

            {/* THANH BỘ LỌC TÌM KIẾM NHANH */}
            <div className="shrink-0 bg-white p-2.5 px-4 rounded-xl border border-zinc-200/60 flex flex-col sm:flex-row justify-between items-center gap-3">
                <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-400 text-xs">🔍</span>
                    <input
                        type="text" placeholder="Tìm theo tên sản phẩm hoặc mã SKU..." value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                        className="w-full pl-8 pr-16 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all shadow-xs"
                    />
                    <button type="submit" className="absolute right-1 top-1 bottom-1 px-2.5 bg-zinc-900 hover:bg-blue-600 text-white font-bold text-[10px] rounded-lg uppercase transition-all">Lọc</button>
                </form>

                <div className="w-full sm:w-auto flex items-center gap-2">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Nhóm hàng hóa:</span>
                    <select
                        value={selectedCategoryFilter} onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                        className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-1.5 text-xs font-bold text-zinc-700 outline-none cursor-pointer hover:border-zinc-300 transition-all"
                    >
                        <option value="">-- Tất cả mặt hàng --</option>
                        {categories.map(c => <option key={`filter_${c.id}`} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
            </div>

            {/* VÙNG HIỂN THỊ CHÍNH (GRID LAYOUT: 7-5) */}
            <div className="flex-1 grid grid-cols-12 gap-3 min-h-0">

                {/* CỘT BẢNG SẢN PHẨM BÊN TRÁI (CHIẾM 7 CỘT) */}
                <div className="col-span-7 bg-white rounded-2xl border border-zinc-200/60 shadow-xs flex flex-col min-h-0 overflow-hidden justify-between">
                    <div className="flex-1 overflow-auto relative custom-scrollbar">
                        <table className="w-full text-left text-xs whitespace-nowrap">
                            <thead className="bg-zinc-50/80 font-black text-zinc-400 uppercase text-[9px] tracking-widest sticky top-0 z-10 border-b border-zinc-200/60 backdrop-blur-sm">
                                <tr>
                                    <th className="py-3 px-4 pl-6">Mặt hàng / SKU</th>
                                    <th className="py-3 px-4">Danh mục</th>
                                    <th className="py-3 px-4 text-right">Giá bán lẻ</th>
                                    <th className="py-3 px-4 text-center">Tồn kho</th>
                                    <th className="py-3 px-4 text-center">Trạng thái</th>
                                    <th className="py-3 px-4 text-right pr-6">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 bg-white">
                                {isLoading ? (
                                    <tr><td colSpan="6" className="py-12 text-center text-zinc-400 font-bold uppercase text-[10px] tracking-wider">Đang nạp dữ liệu kho hàng...</td></tr>
                                ) : products.length === 0 ? (
                                    <tr><td colSpan="6" className="py-12 text-center text-zinc-400 italic font-medium">Không tìm thấy sản phẩm nào phù hợp.</td></tr>
                                ) : (
                                    products.map(p => {
                                        const isLowStock = p.stock_quantity <= p.low_stock_threshold;
                                        return (
                                            <tr key={p.id} className="hover:bg-zinc-50/80 transition-colors group">
                                                <td className="py-2.5 px-4 pl-6">
                                                    <strong className="block text-zinc-900 text-xs tracking-tight">{p.name}</strong>
                                                    <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase">{p.sku} {p.brand && `• ${p.brand}`}</span>
                                                </td>
                                                <td className="py-2.5 px-4 font-bold text-zinc-500 text-[11px]">{p.category?.name || <span className="text-zinc-300 italic font-normal">Chưa rõ</span>}</td>
                                                <td className="py-2.5 px-4 text-right font-black text-zinc-900 text-xs tracking-tight">{Number(p.selling_price).toLocaleString()} ₫</td>
                                                <td className="py-2.5 px-4 text-center align-middle">
                                                    <span className={`px-2 py-0.5 rounded font-mono font-black text-xs border ${isLowStock ? 'bg-red-50 text-red-600 border-red-100' : 'bg-zinc-100 text-zinc-700 border-zinc-200'}`}>
                                                        {p.stock_quantity}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-4 text-center align-middle">
                                                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase border ${p.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-zinc-100 text-zinc-400 border-zinc-200'}`}>
                                                        {p.status === 'active' ? 'Kinh doanh' : 'Tạm dừng'}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-4 text-right pr-6 align-middle">
                                                    <div className="flex items-center justify-end gap-1.5 opacity-100 sm:opacity-40 sm:group-hover:opacity-100 transition-opacity">
                                                        {/* Nút sửa luôn sáng */}
                                                        <button onClick={() => handleEditClick(p)} className="px-2.5 py-1 bg-zinc-100 hover:bg-blue-600 hover:text-white rounded-md font-black text-[10px] uppercase transition-all shadow-xs">Sửa</button>

                                                        {/* ĐA LUỒNG XỬ LÝ: CHUYỂN ĐỔI NÚT ĐỘNG THEO STATUS TRẢ VỀ TỪ LARAVEL */}
                                                        {p.status === 'active' ? (
                                                            <button
                                                                onClick={() => handleDeleteClick(p)}
                                                                className="px-2.5 py-1 bg-white border border-zinc-200 hover:bg-red-50 hover:text-red-500 hover:border-red-100 text-zinc-400 rounded-md font-black text-[10px] uppercase transition-all"
                                                            >
                                                                Dừng
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleRestoreClick(p)}
                                                                className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-md font-black text-[10px] uppercase transition-all shadow-xs"
                                                            >
                                                                Bật
                                                            </button>
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

                    {/* HỆ THỐNG PHÂN TRANG */}
                    {pagination.last_page > 1 && (
                        <div className="shrink-0 p-2.5 border-t border-zinc-100 flex justify-between items-center bg-zinc-50/50">
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-2">Trang {pagination.current_page} / {pagination.last_page}</span>
                            <div className="flex gap-1.5">
                                <button disabled={pagination.current_page === 1} onClick={() => fetchProducts(pagination.current_page - 1)} className="px-3 py-1 bg-white border border-zinc-200 hover:bg-zinc-100 disabled:opacity-40 rounded-lg text-[10px] font-black text-zinc-600 transition-all shadow-xs">← Trước</button>
                                <button disabled={pagination.current_page === pagination.last_page} onClick={() => fetchProducts(pagination.current_page + 1)} className="px-3 py-1 bg-white border border-zinc-200 hover:bg-zinc-100 disabled:opacity-40 rounded-lg text-[10px] font-black text-zinc-600 transition-all shadow-xs">Tiếp →</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* CỘT FORM KHAI BÁO HÀNG HÓA BÊN PHẢI (CHIẾM 5 CỘT) */}
                <div className="col-span-5 bg-white p-4 rounded-2xl border border-zinc-200/60 shadow-xs flex flex-col justify-between min-h-0 overflow-y-auto custom-scrollbar">
                    <form onSubmit={handleSubmit} className="space-y-3 w-full">
                        <div className="border-b border-zinc-100 pb-2 flex justify-between items-center">
                            <h3 className="font-black text-xs text-zinc-900 uppercase tracking-wider">{isEditing ? '📝 Sửa Thông Tin Hàng Hóa' : '✨ Khai Báo Hàng Hóa Mới'}</h3>
                            {isEditing && <button type="button" onClick={resetForm} className="text-[10px] font-black text-blue-600 hover:underline">Hủy sửa</button>}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Nhóm danh mục *</label>
                                <select required value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-2 text-xs font-bold text-zinc-800 outline-none focus:border-blue-500 cursor-pointer hover:border-zinc-300">
                                    <option value="" disabled>-- Chọn nhóm --</option>
                                    {categories.map(c => <option key={`form_cat_${c.id}`} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Mã kho (SKU) *</label>
                                <input type="text" required placeholder="VD: STING_LON" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-zinc-800 outline-none focus:border-blue-500 focus:bg-white transition-all shadow-xs" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Tên sản phẩm bán lẻ *</label>
                            <input type="text" required placeholder="VD: Nước tăng lực Sting dâu lon" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-zinc-800 outline-none focus:border-blue-500 focus:bg-white transition-all shadow-xs" />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Giá bán lẻ (VND) *</label>
                                <input type="number" min="0" required placeholder="VD: 12000" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-black text-zinc-800 outline-none focus:border-blue-500 focus:bg-white transition-all shadow-xs" />
                            </div>
                            <div>
                                <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Hạn mức báo yếu</label>
                                <input type="number" min="0" required value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-zinc-800 outline-none focus:border-blue-500 focus:bg-white transition-all shadow-xs" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Thương hiệu / Nhãn hàng</label>
                            <input type="text" placeholder="VD: Pepsico, Yonex, Hải Yến..." value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-zinc-800 outline-none focus:border-blue-500 focus:bg-white transition-all shadow-xs" />
                        </div>

                        <div>
                            <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Ghi chú mô tả sản phẩm</label>
                            <textarea rows="2" placeholder="Nhập ghi chú đặc tính hàng hóa..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-700 outline-none focus:border-blue-500 focus:bg-white transition-all shadow-xs resize-none" />
                        </div>
                    </form>

                    <button
                        onClick={handleSubmit} disabled={isProcessing || !form.name.trim() || !form.sku.trim() || form.selling_price === '' || !form.category_id}
                        className={`w-full py-2.5 mt-4 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-md transition-all shrink-0 ${isEditing ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-100' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'}`}
                    >
                        {isProcessing ? 'Hệ thống đang lưu dữ liệu...' : isEditing ? '💾 Lưu thay đổi sản phẩm' : '➕ Tạo sản phẩm mới'}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default ProductManager;