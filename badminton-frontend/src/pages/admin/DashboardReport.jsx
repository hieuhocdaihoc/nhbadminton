// src/pages/admin/DashboardReport.jsx
import React from "react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
    BarChart,
    Bar,
} from "recharts";

const stats = [
    {
        label: "Tổng doanh thu tháng",
        value: "45.800.000",
        unit: "VNĐ",
        sub: "↑ 12% so với tháng trước",
        color: "#18181b",
        icon: "💰",
    },
    {
        label: "Lượt đặt sân",
        value: "342",
        unit: "Lượt",
        sub: "85% từ khung giờ vàng",
        color: "#2563eb",
        icon: "📅",
    },
    {
        label: "Khách hàng mới",
        value: "48",
        unit: "Người",
        sub: "Đã đăng ký hệ thống",
        color: "#6366f1",
        icon: "👤",
    },
    {
        label: "Tỷ lệ lấp đầy",
        value: "76%",
        unit: "TB",
        sub: "Sân 02 hoạt động tốt nhất",
        color: "#10b981",
        icon: "📊",
    },
];

const weeklyRevenue = [
    { day: "T2", revenue: 5200000 },
    { day: "T3", revenue: 6800000 },
    { day: "T4", revenue: 5900000 },
    { day: "T5", revenue: 7400000 },
    { day: "T6", revenue: 8300000 },
    { day: "T7", revenue: 9200000 },
    { day: "CN", revenue: 6500000 },
];

const courtPerformance = [
    { name: "Sân số 02", value: "14.2M đ", pct: 85 },
    { name: "Sân số 01", value: "12.5M đ", pct: 75 },
    { name: "Sân số 03", value: "10.1M đ", pct: 60 },
    { name: "Sân số 04", value: "9.0M đ", pct: 50 },
];

const recentBookings = [
    { customer: "Nguyễn Văn An", court: "Sân 02", time: "18:00 - 19:30", price: "180.000đ", status: "Đã thanh toán" },
    { customer: "Trần Minh Huy", court: "Sân 01", time: "19:30 - 21:00", price: "200.000đ", status: "Chờ xác nhận" },
    { customer: "Lê Quốc Bảo", court: "Sân 03", time: "16:00 - 17:30", price: "150.000đ", status: "Đã thanh toán" },
    { customer: "Phạm Hoàng Nam", court: "Sân 04", time: "20:00 - 21:30", price: "220.000đ", status: "Đã hủy" },
];

const StatCard = ({ item }) => {
    return (
        <div className="bg-white p-5 rounded-2xl border border-zinc-100 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                        {item.label}
                    </p>

                    <h4 className="text-2xl font-extrabold mt-2" style={{ color: item.color }}>
                        {item.value}
                        <span className="ml-1 text-xs font-medium text-zinc-400">{item.unit}</span>
                    </h4>

                    <p className="text-[11px] font-medium mt-2 text-zinc-500">{item.sub}</p>
                </div>

                <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl"
                    style={{
                        backgroundColor: `${item.color}12`,
                        color: item.color,
                    }}
                >
                    {item.icon}
                </div>
            </div>
        </div>
    );
};

const DashboardReport = () => {
    return (
        <div className="space-y-6 max-w-[1600px] mx-auto">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-extrabold text-zinc-900">
                        Báo cáo tổng quan
                    </h1>
                    <p className="text-sm text-zinc-500 mt-1">
                        Theo dõi doanh thu, lịch đặt sân và hiệu suất khai thác sân cầu lông.
                    </p>
                </div>

                <div className="flex gap-2">
                    <button className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-semibold text-zinc-700 hover:bg-zinc-50">
                        Tháng 5/2026
                    </button>
                    <button className="px-4 py-2 rounded-xl bg-lime-500 text-sm font-bold text-white hover:bg-lime-600">
                        Xuất báo cáo
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {stats.map((item, index) => (
                    <StatCard key={index} item={item} />
                ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                <div className="xl:col-span-2 bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h3 className="font-bold text-zinc-800 text-base">
                                Doanh thu theo tuần
                            </h3>
                            <p className="text-xs text-zinc-400 mt-1">
                                Dữ liệu mẫu, sau này lấy từ API.
                            </p>
                        </div>

                        <span className="text-[11px] font-semibold text-lime-700 bg-lime-50 px-3 py-1 rounded-lg border border-lime-100">
                            +12.4%
                        </span>
                    </div>

                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={weeklyRevenue}>
                                <defs>
                                    <linearGradient id="revenueColor" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#84cc16" stopOpacity={0.35} />
                                        <stop offset="95%" stopColor="#84cc16" stopOpacity={0} />
                                    </linearGradient>
                                </defs>

                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="day" tickLine={false} axisLine={false} />
                                <YAxis
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `${value / 1000000}M`}
                                />
                                <Tooltip
                                    formatter={(value) =>
                                        new Intl.NumberFormat("vi-VN").format(value) + " VNĐ"
                                    }
                                />
                                <Area
                                    type="monotone"
                                    dataKey="revenue"
                                    stroke="#65a30d"
                                    strokeWidth={3}
                                    fill="url(#revenueColor)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm">
                    <h3 className="font-bold text-zinc-800 text-base mb-5">
                        Hiệu suất khai thác sân
                    </h3>

                    <div className="space-y-5">
                        {courtPerformance.map((court, index) => (
                            <div key={index}>
                                <div className="flex justify-between text-xs font-semibold mb-2">
                                    <span className="text-zinc-600">{court.name}</span>
                                    <span className="text-zinc-900">{court.value}</span>
                                </div>

                                <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-lime-500 to-emerald-500"
                                        style={{ width: `${court.pct}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 pt-4 border-t border-zinc-100 text-xs text-zinc-400">
                        Cập nhật theo các đơn đặt sân đã hoàn tất.
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm">
                    <h3 className="font-bold text-zinc-800 text-base mb-5">
                        Lượt đặt theo khung giờ
                    </h3>

                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={[
                                    { time: "6-9h", booking: 35 },
                                    { time: "9-12h", booking: 22 },
                                    { time: "14-17h", booking: 48 },
                                    { time: "17-20h", booking: 86 },
                                    { time: "20-22h", booking: 64 },
                                ]}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="time" tickLine={false} axisLine={false} />
                                <YAxis tickLine={false} axisLine={false} />
                                <Tooltip />
                                <Bar dataKey="booking" radius={[8, 8, 0, 0]} fill="#84cc16" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="xl:col-span-2 bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="font-bold text-zinc-800 text-base">
                            Đơn đặt sân gần đây
                        </h3>

                        <button className="text-xs font-bold text-lime-600 hover:text-lime-700">
                            Xem tất cả
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-zinc-400 border-b">
                                    <th className="pb-3 font-bold">Khách hàng</th>
                                    <th className="pb-3 font-bold">Sân</th>
                                    <th className="pb-3 font-bold">Thời gian</th>
                                    <th className="pb-3 font-bold">Giá</th>
                                    <th className="pb-3 font-bold">Trạng thái</th>
                                </tr>
                            </thead>

                            <tbody>
                                {recentBookings.map((booking, index) => (
                                    <tr key={index} className="border-b last:border-none">
                                        <td className="py-4 font-semibold text-zinc-800">
                                            {booking.customer}
                                        </td>
                                        <td className="py-4 text-zinc-500">{booking.court}</td>
                                        <td className="py-4 text-zinc-500">{booking.time}</td>
                                        <td className="py-4 font-semibold text-zinc-800">
                                            {booking.price}
                                        </td>
                                        <td className="py-4">
                                            <span
                                                className={`px-3 py-1 rounded-full text-[11px] font-bold ${booking.status === "Đã thanh toán"
                                                    ? "bg-emerald-50 text-emerald-600"
                                                    : booking.status === "Chờ xác nhận"
                                                        ? "bg-amber-50 text-amber-600"
                                                        : "bg-red-50 text-red-600"
                                                    }`}
                                            >
                                                {booking.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardReport;