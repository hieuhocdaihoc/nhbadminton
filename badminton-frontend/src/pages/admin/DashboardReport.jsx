import React from 'react';

const StatCard = ({ label, value, unit, sub, color, icon }) => (
    <div className="bg-white p-5 rounded-2xl border border-zinc-100 flex items-center justify-between group hover:shadow-md transition-shadow">
        <div>
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">{label}</p>
            <h4 className="text-2xl font-extrabold mt-1" style={{ color }}>{value} <span className="text-xs font-medium text-zinc-400">{unit}</span></h4>
            <p className="text-[10px] font-medium mt-1" style={{ color: sub?.color || '#a1a1aa' }}>{sub?.text}</p>
        </div>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ backgroundColor: color + '10', color }}>{icon}</div>
    </div>
);

const DashboardReport = () => {
    return (
        <div className="space-y-6 max-w-[1600px] mx-auto">
            {/* THỐNG KÊ TỔNG QUAN */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Tổng Doanh Thu Tháng" value="45.800.000" unit="VNĐ" sub={{ text: '↑ 12% so với tháng trước', color: '#10b981' }} color="#18181b" icon="💰" />
                <StatCard label="Lượt Đặt Sân" value="342" unit="Lượt" sub={{ text: '85% từ khung giờ vàng' }} color="#3b82f6" icon="📅" />
                <StatCard label="Khách Hàng Mới" value="48" unit="Vợt thủ" sub={{ text: 'Đã đăng ký hệ thống', color: '#6366f1' }} color="#6366f1" icon="👤" />
                <StatCard label="Tỷ Lệ Lấp Đầy" value="76%" unit="TB" sub={{ text: 'Sân 02 chuộng nhất', color: '#10b981' }} color="#10b981" icon="📊" />
            </div>

            {/* BIỂU ĐỒ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-zinc-100">
                    <div className="flex justify-between items-center mb-5">
                        <h3 className="font-bold text-zinc-800 text-sm">Biểu Đồ Doanh Thu Theo Tuần</h3>
                        <span className="text-[11px] font-semibold text-lime-600 bg-lime-50 px-2.5 py-1 rounded-lg border border-lime-100">Tháng 5/2026</span>
                    </div>
                    <div className="h-64 bg-zinc-50 border border-zinc-100 rounded-xl flex flex-col items-center justify-center text-zinc-400 text-xs">
                        <span className="text-3xl mb-2 opacity-30">📊</span>
                        <span className="font-semibold">Tích hợp Chart.js / Recharts</span>
                        <span className="text-[10px] text-zinc-400 mt-1">Trục tung: Doanh thu (VNĐ) · Trục hoành: Ngày trong tuần</span>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-zinc-100 flex flex-col justify-between">
                    <div>
                        <h3 className="font-bold text-zinc-800 text-sm mb-5">Hiệu Suất Khai Thác Sân</h3>
                        <div className="space-y-4">
                            {[
                                { name: 'Sân số 02 (Trung tâm)', value: '14.2M đ', pct: 85 },
                                { name: 'Sân số 01 (Lễ tân)', value: '12.5M đ', pct: 75 },
                                { name: 'Sân số 03 (Góc trong)', value: '10.1M đ', pct: 60 },
                                { name: 'Sân số 04 (Tập luyện)', value: '9.0M đ', pct: 50 },
                            ].map((court, i) => (
                                <div key={i}>
                                    <div className="flex justify-between text-xs font-semibold mb-1.5">
                                        <span className="text-zinc-600">{court.name}</span>
                                        <span className="text-zinc-800">{court.value}</span>
                                    </div>
                                    <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full bg-gradient-to-r from-lime-500 to-emerald-500 transition-all duration-500" style={{ width: `${court.pct}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="pt-4 mt-4 border-t border-zinc-100 text-center text-[10px] text-zinc-400">
                        Cập nhật theo giao dịch hoàn tất.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardReport;