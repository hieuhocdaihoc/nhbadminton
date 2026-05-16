import React from 'react';

const DashboardReport = () => {
    return (
        <div className="space-y-6 max-w-[1600px] mx-auto">
            {/* THỐNG KÊ TỔNG QUAN */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-sm">
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Tổng Doanh Thu Tháng</p>
                    <h4 className="text-2xl font-black text-zinc-900 mt-1">45.800.000 <span className="text-xs font-semibold text-zinc-500">VNĐ</span></h4>
                    <p className="text-[10px] text-emerald-600 font-bold mt-1">↑ 12% so với tháng trước</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-sm">
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Lượt Đặt Sân Thành Công</p>
                    <h4 className="text-2xl font-black text-blue-600 mt-1">342 <span className="text-xs font-semibold text-zinc-500">Lượt</span></h4>
                    <p className="text-[10px] text-zinc-500 font-medium mt-1">85% từ khung giờ vàng</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-sm">
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Khách Hàng Mới</p>
                    <h4 className="text-2xl font-black text-indigo-600 mt-1">48 <span className="text-xs font-semibold text-zinc-500">Vợt thủ</span></h4>
                    <p className="text-[10px] text-indigo-600 font-bold mt-1">Đã đăng ký tài khoản hệ thống</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-sm">
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Tỷ Lệ Lấp Đầy Sân</p>
                    <h4 className="text-2xl font-black text-emerald-600 mt-1">76% <span className="text-xs font-semibold text-zinc-500">Trung bình</span></h4>
                    <p className="text-[10px] text-emerald-600 font-bold mt-1">Sân số 02 được chuộng nhất</p>
                </div>
            </div>

            {/* KHUNG MÔ PHỎNG BIỂU ĐỒ TRỰC QUAN */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Biểu đồ chính */}
                <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-zinc-200/80 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-black text-zinc-900 text-base">Biểu Đồ Doanh Thu Theo Tuần</h3>
                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">Tháng 5/2026</span>
                    </div>
                    {/* Khung giả lập chart */}
                    <div className="h-72 bg-zinc-50 border border-zinc-100 rounded-2xl flex flex-col items-center justify-center text-zinc-400 text-xs font-bold">
                        <span>📊 [ Tích hợp mượt mà dữ liệu động từ Chart.js / Recharts ]</span>
                        <span className="text-[10px] text-zinc-400 font-normal mt-1">Trục tung: Doanh thu (VNĐ) - Trục hoành: Các ngày trong tuần</span>
                    </div>
                </div>

                {/* Danh sách sân đóng góp cao */}
                <div className="bg-white p-6 rounded-3xl border border-zinc-200/80 shadow-sm flex flex-col justify-between">
                    <div>
                        <h3 className="font-black text-zinc-900 text-base mb-4">Hiệu Suất Khai Thác Sân</h3>
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-xs font-bold mb-1"><span>Sân số 02 (Trung tâm)</span><span className="text-blue-600">14.2M đ</span></div>
                                <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden"><div className="bg-blue-600 h-full rounded-full" style={{ width: '85%' }}></div></div>
                            </div>
                            <div>
                                <div className="flex justify-between text-xs font-bold mb-1"><span>Sân số 01 (Lễ tân)</span><span className="text-blue-600">12.5M đ</span></div>
                                <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden"><div className="bg-blue-600 h-full rounded-full" style={{ width: '75%' }}></div></div>
                            </div>
                            <div>
                                <div className="flex justify-between text-xs font-bold mb-1"><span>Sân số 03 (Góc trong)</span><span className="text-blue-600">10.1M đ</span></div>
                                <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden"><div className="bg-blue-600 h-full rounded-full" style={{ width: '60%' }}></div></div>
                            </div>
                            <div>
                                <div className="flex justify-between text-xs font-bold mb-1"><span>Sân số 04 (Tập luyện)</span><span className="text-blue-600">9.0M đ</span></div>
                                <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden"><div className="bg-blue-600 h-full rounded-full" style={{ width: '50%' }}></div></div>
                            </div>
                        </div>
                    </div>
                    <div className="pt-4 border-t border-zinc-100 text-center text-[11px] text-zinc-400">
                        Dữ liệu cập nhật tự động theo các giao dịch hoàn tất.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardReport;