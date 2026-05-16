import React, { useState, useEffect } from 'react';
import { adminInventoryService } from '../../services/admin/inventoryService';
import { adminProductService } from '../../services/admin/productService';
import { adminSupplierService } from '../../services/admin/supplierService';

const InventoryManager = () => {
    // STATE QUẢN LÝ TAB: 'movement' (Biến động số lượng) hoặc 'purchase' (Dòng tiền nhập hàng)
    const [activeTab, setActiveTab] = useState('movement');

    // STATE DỮ LIỆU CHUNG
    const [products, setProducts] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState({ type: '', text: '' });

    // STATE TAB 1: BIẾN ĐỘNG KHO
    const [transactions, setTransactions] = useState([]);
    const [txPagination, setTxPagination] = useState({ current_page: 1, last_page: 1 });
    const [filterType, setFilterType] = useState('');
    const [filterProduct, setFilterProduct] = useState('');
    const [adjustForm, setAdjustForm] = useState({ product_id: '', transaction_type: 'export', quantity: '', note: '' });

    // STATE TAB 2: PHIẾU NHẬP HÀNG
    const [purchaseOrders, setPurchaseOrders] = useState([]);
    const [poPagination, setPoPagination] = useState({ current_page: 1, last_page: 1 });
    const [selectedPO, setSelectedPO] = useState(null); // Để xem chi tiết phiếu nhập
    const [isPoDetailOpen, setIsPoDetailOpen] = useState(false);

    // STATE MODAL TẠO PHIẾU NHẬP MỚI HÀNG LOẠT
    const [isNewPoOpen, setIsNewPoOpen] = useState(false);
    const [newPoSupplier, setNewPoSupplier] = useState('');
    const [newPoItems, setNewPoItems] = useState([{ product_id: '', quantity: 1, import_price: '' }]);

    const [isProcessing, setIsProcessing] = useState(false);

    // --- NẠP DỮ LIỆU NỀN (PRODUCTS & SUPPLIERS) ---
    const loadBaseData = async () => {
        try {
            const [prodRes, supRes] = await Promise.all([
                adminProductService.getProducts(1, '', ''), // Lấy danh sách hàng hóa
                adminSupplierService.getSuppliers('')       // Lấy danh sách nhà cung cấp
            ]);
            setProducts(prodRes.data?.data?.data || []);
            setSuppliers(supRes.data?.data || []);
        } catch (e) { console.error("Lỗi nạp dữ liệu nền:", e); }
    };

    // --- TẢI DỮ LIỆU THEO TAB ---
    const fetchTabData = async (page = 1) => {
        setIsLoading(true);
        try {
            if (activeTab === 'movement') {
                const res = await adminInventoryService.getTransactions(page, filterType, filterProduct);
                setTransactions(res.data?.data?.data || []);
                setTxPagination({ current_page: res.data?.data?.current_page || 1, last_page: res.data?.data?.last_page || 1 });
            } else {
                const res = await adminInventoryService.getPurchaseOrders(page);
                setPurchaseOrders(res.data?.data?.data || []);
                setPoPagination({ current_page: res.data?.data?.current_page || 1, last_page: res.data?.data?.last_page || 1 });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Đồng bộ sổ cái kho thất bại!' });
        } finally { setIsLoading(false); }
    };

    useEffect(() => { loadBaseData(); }, []);
    useEffect(() => { fetchTabData(1); }, [activeTab, filterType, filterProduct]);

    // --- LOGIC XỬ LÝ ĐIỀU CHỈNH KHO THỦ CÔNG (TAB 1) ---
    const handleAdjustSubmit = async (e) => {
        e.preventDefault();
        if (!adjustForm.product_id || adjustForm.quantity === '' || !adjustForm.note.trim()) return alert('Vui lòng điền đủ thông tin kiểm kho!');
        setIsProcessing(true);
        try {
            await adminInventoryService.adjustInventory({
                product_id: adjustForm.product_id,
                transaction_type: adjustForm.transaction_type,
                quantity: Number(adjustForm.quantity),
                note: adjustForm.note
            });
            setMessage({ type: 'success', text: '✓ Đã cân bằng số lượng kho thành công!' });
            setAdjustForm({ product_id: '', transaction_type: 'export', quantity: '', note: '' });
            fetchTabData(txPagination.current_page);
        } catch (err) { alert('⚠️ ' + (err.response?.data?.message || 'Lỗi kiểm kho!')); }
        finally { setIsProcessing(false); setTimeout(() => setMessage({ type: '', text: '' }), 2500); }
    };

    // --- LOGIC XỬ LÝ TẠO PHIẾU NHẬP HÀNG (TAB 2) ---
    const handleAddPoItemRow = () => setNewPoItems([...newPoItems, { product_id: '', quantity: 1, import_price: '' }]);
    const handleRemovePoItemRow = (index) => setNewPoItems(newPoItems.filter((_, i) => i !== index));
    const handlePoItemChange = (index, field, value) => {
        const updated = [...newPoItems];
        updated[index][field] = value;
        setNewPoItems(updated);
    };

    const handleCreatePoSubmit = async (e) => {
        e.preventDefault();
        if (!newPoSupplier) return alert('Vui lòng chọn nhà cung cấp!');
        if (newPoItems.some(i => !i.product_id || !i.quantity || !i.import_price)) return alert('Vui lòng điền đủ thông tin các món nhập!');

        setIsProcessing(true);
        try {
            await adminInventoryService.createPurchaseOrder({
                supplier_id: newPoSupplier,
                items: newPoItems.map(i => ({ product_id: i.product_id, quantity: Number(i.quantity), import_price: Number(i.import_price) }))
            });
            setMessage({ type: 'success', text: '📥 Nhập hàng và tăng tồn kho thành công!' });
            setIsNewPoOpen(false);
            setNewPoItems([{ product_id: '', quantity: 1, import_price: '' }]);
            setNewPoSupplier('');
            fetchTabData(1);
        } catch (err) { alert('❌ Nhập kho thất bại!'); }
        finally { setIsProcessing(false); setTimeout(() => setMessage({ type: '', text: '' }), 2500); }
    };

    const handleViewPoDetail = async (id) => {
        try {
            const res = await adminInventoryService.getPurchaseOrderDetail(id);
            setSelectedPO(res.data?.data);
            setIsPoDetailOpen(true);
        } catch (e) { alert('Không thể lấy chi tiết hóa đơn!'); }
    };

    return (
        <div className="max-w-[1600px] mx-auto p-3 gap-3 font-sans h-[calc(100vh-7rem)] flex flex-col overflow-hidden bg-zinc-50/50">

            {/* 1. HEADER CHỨA TAB SWITCHER THÔNG MINH */}
            <div className="shrink-0 bg-white p-3 px-5 rounded-2xl border border-zinc-200/60 shadow-xs flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="flex items-center gap-4 w-full sm:w-auto">
                    {/* Switcher */}
                    <div className="bg-zinc-100 p-1 rounded-xl flex gap-1 shadow-inner shrink-0">
                        <button onClick={() => setActiveTab('movement')} className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-tight transition-all ${activeTab === 'movement' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-400 hover:text-zinc-600'}`}>
                            ⚖️ Kiểm Kho & Nhật Ký
                        </button>
                        <button onClick={() => setActiveTab('purchase')} className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-tight transition-all ${activeTab === 'purchase' ? 'bg-zinc-900 text-white shadow-xs' : 'text-zinc-400 hover:text-zinc-600'}`}>
                            💰 Quản Lý Nhập Hàng
                        </button>
                    </div>
                </div>
                {message.text && <div className={`px-3 py-1 rounded-lg text-[11px] font-black border ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>{message.text}</div>}
            </div>

            {/* 2. NỘI DUNG HIỂN THỊ ĐỘNG THEO TAB */}
            {activeTab === 'movement' ? (
                /* =========================================================================
                   TAB 1: KIỂM KHO & NHẬT KÝ BIẾN ĐỘNG SỐ LƯỢNG SẢN PHẨM
                   ========================================================================= */
                <>
                    <div className="shrink-0 bg-white p-2 px-4 rounded-xl border border-zinc-200/60 flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Mặt hàng:</span>
                            <select value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)} className="bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-zinc-700 outline-none cursor-pointer">
                                <option value="">-- Tất cả sản phẩm --</option>
                                {products.map(p => <option key={`f_p_${p.id}`} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Hình thức:</span>
                            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-zinc-700 outline-none cursor-pointer">
                                <option value="">-- Tất cả các luồng --</option>
                                <option value="import">📥 Nhập kho từ PO</option>
                                <option value="sale">🛒 Khách mua lẻ</option>
                                <option value="export">🗑️ Xuất hủy thủ công</option>
                                <option value="adjustment">⚖️ Điều chỉnh cân bằng</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex-1 grid grid-cols-12 gap-3 min-h-0">
                        {/* Bảng biến động */}
                        <div className="col-span-8 bg-white rounded-2xl border border-zinc-200/60 shadow-xs flex flex-col min-h-0 overflow-hidden justify-between">
                            <div className="flex-1 overflow-auto relative custom-scrollbar">
                                <table className="w-full text-left text-xs whitespace-nowrap">
                                    <thead className="bg-zinc-50/80 font-black text-zinc-400 uppercase text-[9px] tracking-widest sticky top-0 z-10 border-b border-zinc-200/60 backdrop-blur-sm">
                                        <tr>
                                            <th className="py-3 px-4 pl-6">Thời gian</th>
                                            <th className="py-3 px-4">Sản phẩm / SKU</th>
                                            <th className="py-3 px-4 text-center">Hình thức</th>
                                            <th className="py-3 px-4 text-right">Biến động</th>
                                            <th className="py-3 px-4 text-center">Kho (Trước ➔ Sau)</th>
                                            <th className="py-3 px-4 pl-4">Lý do điều kho</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 bg-white">
                                        {isLoading ? <tr><td colSpan="6" className="py-12 text-center text-zinc-400 font-bold uppercase text-[10px]">Đang trích xuất sổ kho...</td></tr> :
                                            transactions.length === 0 ? <tr><td colSpan="6" className="py-12 text-center text-zinc-400 italic">Chưa ghi nhận lịch sử kho.</td></tr> :
                                                transactions.map(t => (
                                                    <tr key={t.id} className="hover:bg-zinc-50/50 transition-colors">
                                                        <td className="py-2.5 px-4 pl-6 font-mono text-[11px] text-zinc-500">{new Date(t.created_at).toLocaleString('vi-VN')}</td>
                                                        <td className="py-2.5 px-4"><strong className="block text-zinc-900 text-xs tracking-tight">{t.product?.name || 'Sản phẩm đã xóa'}</strong><span className="text-[10px] font-mono text-zinc-400 uppercase">{t.product?.sku}</span></td>
                                                        <td className="py-2.5 px-4 text-center"><span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase border">{(t.transaction_type).toUpperCase()}</span></td>
                                                        <td className={`py-2.5 px-4 text-right font-mono font-black text-xs ${t.quantity > 0 ? 'text-emerald-600' : 'text-red-500'}`}>{t.quantity > 0 ? `+${t.quantity}` : t.quantity}</td>
                                                        <td className="py-2.5 px-4 text-center font-mono font-bold text-zinc-500">{t.before_quantity} ➔ <strong className="text-zinc-800">{t.after_quantity}</strong></td>
                                                        <td className="py-2.5 px-4 pl-4 max-w-[200px] truncate text-zinc-500 font-semibold italic">{t.note}</td>
                                                    </tr>
                                                ))}
                                    </tbody>
                                </table>
                            </div>
                            {/* Phân trang */}
                            {txPagination.last_page > 1 && (
                                <div className="shrink-0 p-2 border-t flex justify-between bg-zinc-50/50 items-center">
                                    <span className="text-[10px] font-black text-zinc-400 pl-2">Trang {txPagination.current_page}/{txPagination.last_page}</span>
                                    <div className="flex gap-1">
                                        <button disabled={txPagination.current_page === 1} onClick={() => fetchTabData(txPagination.current_page - 1)} className="px-3 py-1 bg-white border text-[10px] font-black rounded-lg">← Trước</button>
                                        <button disabled={txPagination.current_page === txPagination.last_page} onClick={() => fetchTabData(txPagination.current_page + 1)} className="px-3 py-1 bg-white border text-[10px] font-black rounded-lg">Tiếp →</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Form lệch kho bên phải */}
                        <div className="col-span-4 bg-white p-4 rounded-2xl border border-zinc-200/60 shadow-xs flex flex-col justify-between min-h-0">
                            <form onSubmit={handleAdjustSubmit} className="space-y-3.5 w-full">
                                <div className="border-b pb-2"><h3 className="font-black text-xs text-zinc-900 uppercase">🛠️ Phiếu cân kho thủ công</h3></div>
                                <div>
                                    <label className="block text-[9px] font-black text-zinc-400 uppercase mb-1">Sản phẩm kiểm kho *</label>
                                    <select required value={adjustForm.product_id} onChange={(e) => setAdjustForm({ ...adjustForm, product_id: e.target.value })} className="w-full bg-zinc-50 border rounded-xl px-2.5 py-2 text-xs font-bold text-zinc-800">
                                        <option value="" disabled>-- Chọn hàng cân tồn --</option>
                                        {products.map(p => <option key={`adj_${p.id}`} value={p.id}>{p.name} (Tồn: {p.stock_quantity})</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black text-zinc-400 uppercase mb-1">Phương thức xử lý *</label>
                                    <select required value={adjustForm.transaction_type} onChange={(e) => setAdjustForm({ ...adjustForm, transaction_type: e.target.value })} className="w-full bg-zinc-50 border rounded-xl px-2.5 py-2 text-xs font-bold text-zinc-800">
                                        <option value="export">🗑️ Xuất hủy / Hao hụt / Hỏng hóc</option>
                                        <option value="adjustment">⚖️ Cân bằng / Phát hiện dư thừa</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black text-zinc-400 uppercase mb-1">Số lượng thay đổi *</label>
                                    <input type="number" required placeholder="VD: -2 hoặc 5" value={adjustForm.quantity} onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })} className="w-full bg-zinc-50 border rounded-xl px-3 py-2 text-xs font-black" />
                                    <span className="text-[9px] text-zinc-400 mt-1 block font-medium italic">Gõ số âm (-) nếu mất mát, số dương (+) nếu thừa hàng.</span>
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black text-zinc-400 uppercase mb-1">Lý do điều chỉnh *</label>
                                    <textarea rows="3" required placeholder="Ghi cụ thể lý do..." value={adjustForm.note} onChange={(e) => setAdjustForm({ ...adjustForm, note: e.target.value })} className="w-full bg-zinc-50 border rounded-xl px-3 py-2 text-xs resize-none font-semibold text-zinc-700" />
                                </div>
                            </form>
                            <button onClick={handleAdjustSubmit} disabled={isProcessing} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl text-xs uppercase shadow-md">{isProcessing ? 'Đang cân tồn...' : '⚖️ Chốt số liệu kiểm kho'}</button>
                        </div>
                    </div>
                </>
            ) : (
                /* =========================================================================
                   TAB 2: QUẢN LÝ DÒNG TIỀN CHI & ĐƠN NHẬP HÀNG (PURCHASE ORDERS)
                   ========================================================================= */
                <>
                    <div className="shrink-0 bg-white p-2 px-4 rounded-xl border border-zinc-200/60 flex justify-between items-center">
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Sổ cái kế toán mua hàng</span>
                        <button onClick={() => setIsNewPoOpen(true)} className="px-4 py-1.5 bg-zinc-950 hover:bg-blue-600 text-white font-black text-xs rounded-xl uppercase tracking-wider shadow-md transition-all">
                            ➕ Nhập hàng vào kho (Hàng loạt)
                        </button>
                    </div>

                    <div className="flex-1 bg-white rounded-2xl border border-zinc-200/60 shadow-xs flex flex-col min-h-0 overflow-hidden justify-between">
                        <div className="flex-1 overflow-auto relative custom-scrollbar">
                            <table className="w-full text-left text-xs whitespace-nowrap">
                                <thead className="bg-zinc-50/80 font-black text-zinc-400 uppercase text-[9px] tracking-widest sticky top-0 z-10 border-b border-zinc-200/60">
                                    <tr>
                                        <th className="py-3 px-5 pl-8">Mã đơn nhập</th>
                                        <th className="py-3 px-5">Nhà cung cấp</th>
                                        <th className="py-3 px-5 text-right">Tổng chi phí tiền nhập</th>
                                        <th className="py-3 px-5 text-center">Ngày chốt đơn</th>
                                        <th className="py-3 px-5 text-center">Trạng thái</th>
                                        <th className="py-3 px-5 text-right pr-8">Chứng từ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 bg-white">
                                    {isLoading ? <tr><td colSpan="6" className="py-12 text-center text-zinc-400 font-bold uppercase text-[10px]">Đang kết xuất phiếu chi...</td></tr> :
                                        purchaseOrders.length === 0 ? <tr><td colSpan="6" className="py-12 text-center text-zinc-400 italic">Chưa có phiếu nhập hàng nào.</td></tr> :
                                            purchaseOrders.map(po => (
                                                <tr key={po.id} className="hover:bg-zinc-50/50 transition-colors group">
                                                    <td className="py-3 px-5 pl-8 font-mono font-black text-blue-600 text-[11px]">{po.purchase_code}</td>
                                                    <td className="py-3 px-5 font-black text-zinc-800 text-xs">{po.supplier?.name || 'Đối tác vãng lai'}</td>
                                                    <td className="py-3 px-5 text-right font-mono font-black text-zinc-900 text-xs">{Number(po.total_amount).toLocaleString()} ₫</td>
                                                    <td className="py-3 px-5 text-center font-semibold text-zinc-500">{new Date(po.created_at).toLocaleDateString('vi-VN')}</td>
                                                    <td className="py-3 px-5 text-center"><span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full font-black text-[9px] uppercase">✓ Hoàn tất</span></td>
                                                    <td className="py-3 px-5 text-right pr-8"><button onClick={() => handleViewPoDetail(po.id)} className="px-2.5 py-1 bg-zinc-100 group-hover:bg-zinc-900 group-hover:text-white rounded-md font-black text-[10px] uppercase transition-colors">Xem chi tiết</button></td>
                                                </tr>
                                            ))}
                                </tbody>
                            </table>
                        </div>
                        {/* Phân trang PO */}
                        {poPagination.last_page > 1 && (
                            <div className="shrink-0 p-2.5 border-t flex justify-between bg-zinc-50/50 items-center">
                                <span className="text-[10px] font-black text-zinc-400 pl-2">Trang {poPagination.current_page}/{poPagination.last_page}</span>
                                <div className="flex gap-1.5">
                                    <button disabled={poPagination.current_page === 1} onClick={() => fetchTemplateData(poPagination.current_page - 1)} className="px-3 py-1 bg-white border text-[10px] font-black rounded-lg">← Trước</button>
                                    <button disabled={poPagination.current_page === poPagination.last_page} onClick={() => fetchTemplateData(poPagination.current_page + 1)} className="px-3 py-1 bg-white border text-[10px] font-black rounded-lg">Tiếp →</button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* =========================================================================
               MODAL FULL-SIZE: TẠO PHIẾU NHẬP HÀNG HÀNG LOẠT (Core Logic đa bảng)
               ========================================================================= */}
            {isNewPoOpen && (
                <div className="fixed inset-0 z-50 bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl p-6 flex flex-col max-h-[85vh]">
                        <div className="shrink-0 border-b pb-3 mb-4 flex justify-between items-center">
                            <h3 className="text-base font-black text-zinc-900 uppercase">📝 Lập phiếu mua hàng nhập kho</h3>
                            <button onClick={() => setIsNewPoOpen(false)} className="text-zinc-400 hover:text-zinc-600 font-bold text-sm">✕ Đóng</button>
                        </div>

                        <form onSubmit={handleCreatePoSubmit} className="flex-1 overflow-y-auto pr-1 space-y-4 text-left custom-scrollbar">
                            <div>
                                <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Chọn nhà cung cấp phân phối đơn hàng *</label>
                                <select required value={newPoSupplier} onChange={(e) => setNewPoSupplier(e.target.value)} className="w-full bg-zinc-50 border rounded-xl px-3 py-2.5 text-xs font-bold text-zinc-800">
                                    <option value="" disabled>-- Chọn đối tác đại lý --</option>
                                    {suppliers.map(s => <option key={`po_s_${s.id}`} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>

                            <div className="border-t pt-3">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Danh sách các mặt hàng nhập khẩu</label>
                                    <button type="button" onClick={handleAddPoItemRow} className="px-2.5 py-1 border border-dashed border-blue-400 text-blue-600 rounded-lg text-[10px] font-black uppercase hover:bg-blue-50">+ Thêm dòng</button>
                                </div>

                                <div className="space-y-2">
                                    {newPoItems.map((item, index) => (
                                        <div key={index} className="grid grid-cols-12 gap-2 bg-zinc-50 p-2 rounded-xl items-center border border-zinc-100">
                                            <div className="col-span-5">
                                                <select required value={item.product_id} onChange={(e) => handlePoItemChange(index, 'product_id', e.target.value)} className="w-full bg-white border rounded-lg p-1.5 text-xs font-bold">
                                                    <option value="" disabled>-- Chọn món --</option>
                                                    {products.map(p => <option key={`po_p_${p.id}`} value={p.id}>{p.name} ({p.sku})</option>)}
                                                </select>
                                            </div>
                                            <div className="col-span-3">
                                                <input type="number" min="1" required placeholder="SL" value={item.quantity} onChange={(e) => handlePoItemChange(index, 'quantity', e.target.value)} className="w-full bg-white border rounded-lg p-1.5 text-xs font-black text-center" />
                                            </div>
                                            <div className="col-span-3">
                                                <input type="number" min="0" required placeholder="Giá nhập lẻ" value={item.import_price} onChange={(e) => handlePoItemChange(index, 'import_price', e.target.value)} className="w-full bg-white border rounded-lg p-1.5 text-xs font-black text-right" />
                                            </div>
                                            <div className="col-span-1 text-center">
                                                {newPoItems.length > 1 && <button type="button" onClick={() => handleRemovePoItemRow(index)} className="text-red-400 hover:text-red-600 font-bold text-xs">✕</button>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </form>

                        <div className="shrink-0 border-t pt-3 flex gap-3 mt-4">
                            <button type="button" onClick={() => setIsNewPoOpen(false)} className="flex-1 py-3 bg-zinc-100 text-zinc-600 font-black rounded-xl text-xs uppercase tracking-wider">Hủy đơn</button>
                            <button onClick={handleCreatePoSubmit} disabled={isProcessing} className="flex-1 py-3 bg-zinc-900 hover:bg-blue-600 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-md">{isProcessing ? 'Đang tạo phiếu...' : '📥 Duyệt nhập kho & trả tiền'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================================================
               MODAL: XEM CHI TIẾT CHỨNG TỪ PHIẾU NHẬP (POPUP XEM CHI TIẾT)
               ========================================================================= */}
            {isPoDetailOpen && selectedPO && (
                <div className="fixed inset-0 z-50 bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 text-left">
                        <div className="border-b pb-2 mb-4 flex justify-between items-center">
                            <div>
                                <h3 className="text-sm font-black text-zinc-900 uppercase">Chứng từ: {selectedPO.purchase_code}</h3>
                                <p className="text-[10px] font-semibold text-zinc-400 mt-0.5">Ngày lập: {new Date(selectedPO.created_at).toLocaleString('vi-VN')}</p>
                            </div>
                            <button onClick={() => setIsPoDetailOpen(false)} className="text-zinc-400 text-sm font-bold">✕</button>
                        </div>

                        <div className="space-y-2 text-xs mb-4">
                            <p className="font-bold text-zinc-700">🏢 Nhà cung cấp: <span className="text-zinc-900 font-black">{selectedPO.supplier?.name}</span></p>
                            <p className="font-bold text-zinc-700">📞 Số điện thoại: <span className="text-zinc-900 font-mono">{selectedPO.supplier?.phone || 'N/A'}</span></p>
                        </div>

                        <div className="border rounded-xl overflow-hidden mb-4 bg-zinc-50/50">
                            <div className="grid grid-cols-12 bg-zinc-100 px-3 py-1.5 font-black text-[9px] text-zinc-500 uppercase tracking-wider border-b">
                                <div className="col-span-6">Mặt hàng</div>
                                <div className="col-span-2 text-center">SL</div>
                                <div className="col-span-4 text-right">Thành tiền</div>
                            </div>
                            <div className="divide-y divide-zinc-100 max-h-48 overflow-y-auto">
                                {selectedPO.details?.map(d => (
                                    <div key={d.id} className="grid grid-cols-12 px-3 py-2 text-xs font-semibold text-zinc-700">
                                        <div className="col-span-6 font-bold text-zinc-900 truncate">{d.product?.name}</div>
                                        <div className="col-span-2 text-center font-bold">{d.quantity}</div>
                                        <div className="col-span-4 text-right font-black text-zinc-900">{Number(d.total_price).toLocaleString()}đ</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="border-t pt-3 flex justify-between items-center mb-4">
                            <span className="text-xs font-black text-zinc-500 uppercase">Tổng chi ngân sách:</span>
                            <span className="text-base font-black text-red-600 tracking-tight">{Number(selectedPO.total_amount).toLocaleString()} ₫</span>
                        </div>

                        <button onClick={() => setIsPoDetailOpen(false)} className="w-full py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 font-black rounded-xl text-xs uppercase tracking-wider">Đóng chứng từ</button>
                    </div>
                </div>
            )}

        </div>
    );
};

export default InventoryManager;