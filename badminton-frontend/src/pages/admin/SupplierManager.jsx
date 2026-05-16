import React, { useState, useEffect } from 'react';
import { adminSupplierService } from '../../services/admin/supplierService';

const SupplierManager = () => {
    // STATE DỮ LIỆU CỐT LÕI
    const [suppliers, setSuppliers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState({ type: '', text: '' });

    // STATE BỘ LỌC TÌM KIẾM
    const [searchKeyword, setSearchKeyword] = useState('');

    // STATE BAN ĐIỀU HÀNH FORM (THÊM / SỬA)
    const [form, setForm] = useState({
        id: null, name: '', phone: '', email: '', address: '', contact_person: ''
    });
    const [isEditing, setIsEditing] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // --- TẢI DANH SÁCH NHÀ CUNG CẤP ---
    const fetchSuppliers = async () => {
        setIsLoading(true);
        try {
            const res = await adminSupplierService.getSuppliers(searchKeyword);
            setSuppliers(res.data?.data || []);
        } catch (error) {
            setMessage({ type: 'error', text: 'Không thể kết nối dữ liệu đối tác.' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSuppliers();
    }, []);

    // Xử lý khi Lễ tân nhấn tìm kiếm
    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchSuppliers();
    };

    // --- XỬ LÝ SUBMIT: THÊM MỚI HOẶC CẬP NHẬT ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return alert('Tên nhà cung cấp là trường bắt buộc!');

        setIsProcessing(true);
        setMessage({ type: '', text: '' });

        const payload = {
            name: form.name,
            phone: form.phone || null,
            email: form.email || null,
            address: form.address || null,
            contact_person: form.contact_person || null
        };

        try {
            if (isEditing) {
                await adminSupplierService.updateSupplier(form.id, payload);
                setMessage({ type: 'success', text: '🎉 Cập nhật thông tin đối tác thành công!' });
            } else {
                await adminSupplierService.createSupplier(payload);
                setMessage({ type: 'success', text: '🚀 Khai báo nhà cung cấp mới thành công!' });
            }
            resetForm();
            fetchSuppliers();
        } catch (error) {
            const errorMsg = error.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại!';
            alert('⚠️ ' + errorMsg);
        } finally {
            setIsProcessing(false);
            setTimeout(() => setMessage({ type: '', text: '' }), 2500);
        }
    };

    const handleEditClick = (supplier) => {
        setIsEditing(true);
        setForm({
            id: supplier.id,
            name: supplier.name,
            phone: supplier.phone || '',
            email: supplier.email || '',
            address: supplier.address || '',
            contact_person: supplier.contact_person || ''
        });
    };

    // XÓA ĐỐI TÁC (Có xử lý hiển thị lỗi ràng buộc từ try-catch Laravel)
    const handleDeleteClick = async (supplier) => {
        if (window.confirm(`Bạn chắc chắn muốn xóa vĩnh viễn nhà cung cấp [${supplier.name}]? Hành động này không thể hoàn tác.`)) {
            try {
                await adminSupplierService.deleteSupplier(supplier.id);
                setMessage({ type: 'success', text: '✓ Xóa nhà cung cấp thành công!' });
                fetchSuppliers();
            } catch (error) {
                // Đọc chính xác câu thông báo từ khối catch (\Exception $e) ở Backend trả về
                const errorMsg = error.response?.data?.message || 'Không thể xóa nhà cung cấp!';
                alert('❌ Lỗi hệ thống: ' + errorMsg);
            } finally {
                setTimeout(() => setMessage({ type: '', text: '' }), 3000);
            }
        }
    };

    const resetForm = () => {
        setForm({ id: null, name: '', phone: '', email: '', address: '', contact_person: '' });
        setIsEditing(false);
    };

    return (
        <div className="max-w-[1600px] mx-auto p-3 gap-3 font-sans h-[calc(100vh-7rem)] flex flex-col overflow-hidden bg-zinc-50/50">

            {/* HEADER TIÊU ĐỀ */}
            <div className="shrink-0 bg-white p-3 px-5 rounded-2xl border border-zinc-200/60 shadow-xs flex justify-between items-center relative overflow-hidden">
                <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-xs">🏢</div>
                    <div>
                        <h2 className="text-base font-black text-zinc-900 tracking-tight leading-none">Quản Lý Nhà Cung Cấp (Suppliers)</h2>
                        <p className="text-[10px] font-semibold text-zinc-400 mt-1">Quản lý thông tin đầu mối đại lý cung cấp vợt, quả cầu lông và nước giải khát</p>
                    </div>
                </div>
                {message.text && (
                    <div className={`px-3 py-1 rounded-lg text-[11px] font-black tracking-tight border ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                        {message.text}
                    </div>
                )}
            </div>

            {/* THANH CÔNG CỤ TÌM KIẾM NHANH */}
            <div className="shrink-0 bg-white p-2 px-4 rounded-xl border border-zinc-200/60 flex justify-between items-center">
                <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-400 text-xs">🔍</span>
                    <input
                        type="text" placeholder="Gõ tên hoặc số điện thoại đối tác..." value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                        className="w-full pl-8 pr-16 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-xs"
                    />
                    <button type="submit" className="absolute right-1 top-1 bottom-1 px-3 bg-zinc-900 hover:bg-indigo-600 text-white font-bold text-[10px] rounded-lg uppercase transition-all">Lọc</button>
                </form>
                <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest hidden sm:inline">Tổng số: {suppliers.length} đối tác</span>
            </div>

            {/* VÙNG GRID BẢNG & FORM (TỶ LỆ RỘNG RÃI 8-4) */}
            <div className="flex-1 grid grid-cols-12 gap-3 min-h-0">

                {/* BẢNG HIỂN THỊ DANH SÁCH BÊN TRÁI (8 CỘT) */}
                <div className="col-span-8 bg-white rounded-2xl border border-zinc-200/60 shadow-xs flex flex-col min-h-0 overflow-hidden">
                    <div className="flex-1 overflow-auto relative custom-scrollbar">
                        <table className="w-full text-left text-xs whitespace-nowrap">
                            <thead className="bg-zinc-50/80 font-black text-zinc-400 uppercase text-[9px] tracking-widest sticky top-0 z-10 border-b border-zinc-200/60 backdrop-blur-sm">
                                <tr>
                                    <th className="py-3 px-4 pl-6">Nhà cung cấp / Đại diện</th>
                                    <th className="py-3 px-4">Số điện thoại</th>
                                    <th className="py-3 px-4">Hòm thư (Email)</th>
                                    <th className="py-3 px-4">Địa chỉ kho hàng</th>
                                    <th className="py-3 px-4 text-right pr-6">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 bg-white">
                                {isLoading ? (
                                    <tr><td colSpan="5" className="py-12 text-center text-zinc-400 font-bold uppercase text-[10px] tracking-wider">Đang nạp dữ liệu đối tác...</td></tr>
                                ) : suppliers.length === 0 ? (
                                    <tr><td colSpan="5" className="py-12 text-center text-zinc-400 italic font-medium">Không tìm thấy thông tin nhà cung cấp nào.</td></tr>
                                ) : (
                                    suppliers.map(s => (
                                        <tr key={s.id} className="hover:bg-zinc-50/50 transition-colors group">
                                            <td className="py-2.5 px-4 pl-6">
                                                <strong className="block text-zinc-900 text-xs tracking-tight">{s.name}</strong>
                                                <span className="text-[10px] font-semibold text-zinc-400">{s.contact_person ? `👤 ĐD: ${s.contact_person}` : '-- Không rõ người đại diện --'}</span>
                                            </td>
                                            <td className="py-2.5 px-4 font-mono font-bold text-zinc-700 text-[11px]">{s.phone || <span className="text-zinc-300 italic font-normal">Chưa có</span>}</td>
                                            <td className="py-2.5 px-4 font-semibold text-zinc-500 text-[11px]">{s.email || <span className="text-zinc-300 italic font-normal">Chưa có</span>}</td>
                                            <td className="py-2.5 px-4 max-w-[200px] truncate font-medium text-zinc-500">{s.address || <span className="text-zinc-300 italic font-normal">Chưa có</span>}</td>
                                            <td className="py-2.5 px-4 text-right pr-6 align-middle">
                                                <div className="flex items-center justify-end gap-1.5 opacity-100 sm:opacity-40 sm:group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleEditClick(s)} className="px-2.5 py-1 bg-zinc-100 hover:bg-indigo-600 hover:text-white rounded-md font-black text-[10px] uppercase transition-all shadow-xs">Sửa</button>
                                                    <button onClick={() => handleDeleteClick(s)} className="px-2.5 py-1 bg-white border border-zinc-200 hover:bg-red-50 hover:text-red-500 hover:border-red-100 text-zinc-400 rounded-md font-black text-[10px] uppercase transition-all">Xóa</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* FORM TẠO MỚI / CẬP NHẬT BÊN PHẢI (4 CỘT) */}
                <div className="col-span-4 bg-white p-4 rounded-2xl border border-zinc-200/60 shadow-xs flex flex-col justify-between min-h-0 overflow-y-auto custom-scrollbar">
                    <form onSubmit={handleSubmit} className="space-y-3 w-full">
                        <div className="border-b border-zinc-100 pb-2 flex justify-between items-center">
                            <h3 className="font-black text-xs text-zinc-900 uppercase tracking-wider">{isEditing ? '📝 Sửa Thông Tin Đối Tác' : '✨ Khai Báo Nhà Cung Cấp'}</h3>
                            {isEditing && <button type="button" onClick={resetForm} className="text-[10px] font-black text-indigo-600 hover:underline">Hủy sửa</button>}
                        </div>

                        <div>
                            <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Tên nhà cung cấp / Công ty *</label>
                            <input type="text" required placeholder="VD: Công ty TNHH Hải Yến Sport..." value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-zinc-800 outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-xs" />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Số điện thoại</label>
                                <input type="text" placeholder="VD: 0987xxxxxx" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-zinc-800 outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-xs" />
                            </div>
                            <div>
                                <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Người đại diện liên hệ</label>
                                <input type="text" placeholder="VD: Anh Tuấn Kinh Doanh" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-zinc-800 outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-xs" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Hòm thư điện tử (Email)</label>
                            <input type="email" placeholder="VD: contact@haiyensport.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-800 outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-xs" />
                        </div>

                        <div>
                            <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Địa chỉ văn phòng / Kho hàng</label>
                            <textarea rows="3" placeholder="Nhập địa chỉ cụ thể để làm phiếu xuất nhập kho..." value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-700 outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-xs resize-none" />
                        </div>
                    </form>

                    {/* NÚT SUBMIT DÁN CHẶT ĐÁY FORM CHỐNG TRÀN BẤT KỂ ĐỘ PHÂN GIẢI */}
                    <button
                        onClick={handleSubmit} disabled={isProcessing || !form.name.trim()}
                        className={`w-full py-2.5 mt-4 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-md transition-all shrink-0 ${isEditing ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-100' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'}`}
                    >
                        {isProcessing ? 'Hệ thống đang lưu...' : isEditing ? '💾 Lưu thay đổi đối tác' : '➕ Thêm nhà cung cấp'}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default SupplierManager;