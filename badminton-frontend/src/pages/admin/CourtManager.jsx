import React, { useState, useEffect } from 'react';
// SỬA: Import đúng tên biến đã export từ file admin/courtService
import { adminCourtService } from '../../services/admin/courtService';

const CourtManager = () => {
    const [courts, setCourts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [selectedCourtId, setSelectedCourtId] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        court_code: '',
        floor_type: 'Thảm BWF Tiêu chuẩn',
        has_lighting: true,
        capacity: 4,
        location_note: '',
        status: 'active'
    });

    const fetchCourts = async () => {
        setIsLoading(true);
        try {
            // SỬA: Thay courtService thành adminCourtService
            const response = await adminCourtService.getAllCourts();
            setCourts(response.data.data || []);
        } catch (error) {
            console.error('Lỗi tải danh sách sân:', error);
            setMessage({ type: 'error', text: 'Không thể tải dữ liệu sân từ máy chủ.' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCourts();
    }, []);

    const handleOpenCreate = () => {
        setModalMode('create');
        setSelectedCourtId(null);
        setFormData({
            name: '',
            court_code: `SAN_${Date.now().toString().slice(-4)}`,
            floor_type: 'Thảm BWF Tiêu chuẩn',
            has_lighting: true,
            capacity: 4,
            location_note: 'Khu vực cụm chính',
            status: 'active'
        });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (court) => {
        setModalMode('edit');
        setSelectedCourtId(court.id);
        setFormData({
            name: court.name,
            court_code: court.court_code,
            floor_type: court.floor_type || 'Thảm BWF Tiêu chuẩn',
            has_lighting: court.has_lighting ? true : false,
            capacity: court.capacity || 4,
            location_note: court.location_note || '',
            status: court.status || 'active'
        });
        setIsModalOpen(true);
    };

    const handleSubmitForm = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        setMessage({ type: '', text: '' });

        const payload = {
            ...formData,
            has_lighting: formData.has_lighting ? 1 : 0,
            capacity: formData.capacity ? parseInt(formData.capacity) : null
        };

        try {
            if (modalMode === 'create') {
                // SỬA: Thay courtService thành adminCourtService
                await adminCourtService.createCourt(payload);
                setMessage({ type: 'success', text: '✓ Đã cấu hình thêm sân mới thành công!' });
            } else {
                // SỬA: Thay courtService thành adminCourtService
                await adminCourtService.updateCourt(selectedCourtId, payload);
                setMessage({ type: 'success', text: '✓ Đã cập nhật thông số sân thành công!' });
            }
            setIsModalOpen(false);
            fetchCourts();
        } catch (error) {
            console.error('Lỗi lưu sân:', error);
            if (error.response && error.response.data && error.response.data.message) {
                setMessage({ type: 'error', text: error.response.data.message });
            } else {
                setMessage({ type: 'error', text: 'Lưu dữ liệu thất bại. Vui lòng thử lại sau.' });
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteCourt = async (id, name) => {
        if (!window.confirm(`⚠️ Bạn có chắc chắn muốn xóa vĩnh viễn "${name}" khỏi hệ thống không?`)) return;
        try {
            // SỬA: Thay courtService thành adminCourtService
            await adminCourtService.deleteCourt(id);
            setMessage({ type: 'success', text: `✓ Đã xóa ${name} thành công.` });
            fetchCourts();
        } catch (error) {
            console.error('Lỗi xóa sân:', error);
            setMessage({ type: 'error', text: 'Không thể xóa sân. Khả năng cao sân này đang vướng dữ liệu Booking.' });
        }
    };

    const totalCourts = courts.length;
    const activeCourts = courts.filter(c => c.status === 'active').length;
    const maintenanceCourts = totalCourts - activeCourts;

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto">
            {/* THẺ THỐNG KÊ */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Tổng Sân Hệ Thống</p>
                        <h4 className="text-2xl font-black text-zinc-900 mt-1">{totalCourts} <span className="text-xs font-semibold text-zinc-500">Sân</span></h4>
                    </div>
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 font-bold text-lg">🏸</div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Đang Sẵn Sàng</p>
                        <h4 className="text-2xl font-black text-emerald-600 mt-1">{activeCourts} <span className="text-xs font-semibold text-zinc-500">Sân</span></h4>
                    </div>
                    <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 font-bold text-lg">●</div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Khóa / Bảo Trì</p>
                        <h4 className="text-2xl font-black text-red-600 mt-1">{maintenanceCourts} <span className="text-xs font-semibold text-zinc-500">Sân</span></h4>
                    </div>
                    <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center text-red-600 font-bold text-lg">🔒</div>
                </div>
            </div>

            {/* KHUNG NỘI DUNG CHÍNH */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-zinc-200/80 shadow-sm relative">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-zinc-100">
                    <div>
                        <h3 className="text-lg font-black text-zinc-900 tracking-tight">Danh Sách Cụm Sân Khai Thác</h3>
                        <p className="text-xs text-zinc-500 mt-0.5">Quản lý cơ sở vật chất, hệ thống thảm trải và đèn chiếu sáng kỹ thuật.</p>
                    </div>
                    <button onClick={handleOpenCreate} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-600/10 transition-all shrink-0">
                        + Cấu Hình Sân Mới
                    </button>
                </div>

                {message.text && (
                    <div className={`mb-6 p-3 rounded-xl text-xs font-bold ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                        {message.text}
                    </div>
                )}

                {isLoading ? (
                    <div className="py-16 text-center text-xs font-bold text-zinc-400">Đang đồng bộ dữ liệu từ máy chủ...</div>
                ) : courts.length === 0 ? (
                    <div className="py-16 text-center bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-2xl">
                        <p className="text-xs font-bold text-zinc-500">Hệ thống chưa có dữ liệu sân thi đấu nào.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {courts.map((court) => {
                            const isActive = court.status === 'active';
                            return (
                                <div key={court.id} className={`p-6 rounded-2xl border transition-all flex flex-col justify-between group relative overflow-hidden ${isActive ? 'bg-white border-zinc-200/80 hover:border-blue-200 hover:shadow-md' : 'bg-zinc-50/60 border-zinc-200 opacity-75'}`}>
                                    <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${isActive ? 'bg-emerald-500' : 'bg-red-400'}`}></div>
                                    <div>
                                        <div className="flex items-start justify-between gap-2 pl-2">
                                            <div>
                                                <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{court.court_code}</span>
                                                <h4 className="text-lg font-black text-zinc-900 tracking-tight mt-1.5">{court.name}</h4>
                                            </div>
                                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase shrink-0 border ${isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{isActive ? 'Hoạt động' : 'Bảo trì'}</span>
                                        </div>
                                        <div className="mt-4 pl-2 space-y-2 text-xs text-zinc-600 pt-3 border-t border-zinc-100">
                                            <div className="flex items-center justify-between"><span>Bề mặt thảm:</span><strong className="text-zinc-800">{court.floor_type || 'Tiêu chuẩn'}</strong></div>
                                            <div className="flex items-center justify-between"><span>Đèn chuyên dụng:</span><strong className="text-zinc-800">{court.has_lighting ? 'Có hỗ trợ' : 'Không'}</strong></div>
                                            <div className="flex items-center justify-between"><span>Sức chứa:</span><strong className="text-zinc-800">{court.capacity || 4} Vợt thủ</strong></div>
                                        </div>
                                    </div>
                                    <div className="mt-5 pt-3 border-t border-zinc-100 flex items-center justify-end gap-2">
                                        <button onClick={() => handleOpenEdit(court)} className="px-3 py-1.5 bg-zinc-100 hover:bg-blue-50 hover:text-blue-600 text-zinc-700 text-xs font-bold rounded-xl transition-colors">Chỉnh sửa</button>
                                        <button onClick={() => handleDeleteCourt(court.id, court.name)} className="px-3 py-1.5 bg-zinc-100 hover:bg-red-50 hover:text-red-600 text-zinc-400 hover:text-zinc-700 text-xs font-bold rounded-xl transition-colors">Xóa</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* MODAL */}
                {isModalOpen && (
                    <div onClick={() => setIsModalOpen(false)} className="fixed inset-0 z-50 bg-zinc-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                        <div onClick={e => e.stopPropagation()} className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-zinc-100 p-6 sm:p-8">
                            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 mb-5">
                                <div>
                                    <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded uppercase">Hệ thống quản trị</span>
                                    <h4 className="text-base font-black text-zinc-900 mt-1">{modalMode === 'create' ? 'Cấu Hình Sân Mới' : 'Cập Nhật Thông Số Sân'}</h4>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 font-bold">✕</button>
                            </div>
                            <form onSubmit={handleSubmitForm} className="space-y-4">
                                <div>
                                    <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Tên sân hiển thị *</label>
                                    <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-800 outline-none focus:border-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Mã tra cứu hệ thống *</label>
                                    <input type="text" required value={formData.court_code} onChange={e => setFormData({ ...formData, court_code: e.target.value })} className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono font-bold text-blue-600 outline-none focus:border-blue-500" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Loại thảm</label>
                                        <input type="text" value={formData.floor_type} onChange={e => setFormData({ ...formData, floor_type: e.target.value })} className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-800 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Sức chứa tối đa</label>
                                        <input type="number" value={formData.capacity} onChange={e => setFormData({ ...formData, capacity: e.target.value })} className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-800 outline-none" />
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pb-2">
                                    <span className="text-xs font-bold text-zinc-700">Trạng thái vận hành</span>
                                    <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} className="bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold px-3 py-1.5 text-zinc-800 outline-none">
                                        <option value="active">● Đang hoạt động</option>
                                        <option value="inactive">🔒 Khóa bảo trì</option>
                                    </select>
                                </div>
                                <div className="flex gap-2 pt-3">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold rounded-xl text-xs">Hủy</button>
                                    <button type="submit" disabled={isSaving} className={`flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}>
                                        {isSaving ? 'Đang xử lý...' : 'Lưu dữ liệu'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CourtManager;