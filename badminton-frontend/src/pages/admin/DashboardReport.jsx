// src/pages/admin/DashboardReport.jsx
import React, { useEffect, useMemo, useState } from "react";
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
import { adminDashboardService } from "../../services/admin/dashboardService";

const getToday = () => new Date().toLocaleDateString("sv-SE");

const getFirstDayOfMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString(
    "sv-SE",
  );
};

const formatMoney = (value) => {
  return Number(value || 0).toLocaleString("vi-VN") + "đ";
};

const formatNumber = (value) => {
  return Number(value || 0).toLocaleString("vi-VN");
};

const formatDate = (value) => {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("vi-VN");
};

const getPaymentStatusLabel = (status) => {
  const labels = {
    unpaid: "Chưa thanh toán",
    partially_paid: "Thanh toán một phần",
    paid: "Đã thanh toán",
  };

  return labels[status] || status || "—";
};

const getBookingStatusLabel = (status) => {
  const labels = {
    pending: "Chờ xác nhận",
    confirmed: "Đã xác nhận",
    completed: "Hoàn thành",
    cancelled: "Đã hủy",
  };

  return labels[status] || status || "—";
};

const getStatusClass = (status) => {
  if (status === "paid" || status === "confirmed" || status === "completed") {
    return "bg-emerald-50 text-emerald-600";
  }

  if (status === "pending" || status === "partially_paid") {
    return "bg-amber-50 text-amber-600";
  }

  if (status === "cancelled") {
    return "bg-red-50 text-red-600";
  }

  return "bg-zinc-50 text-zinc-600";
};

const StatCard = ({ item }) => {
  return (
    <div className="bg-white p-5 rounded-2xl border border-zinc-100 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
            {item.label}
          </p>

          <h4
            className="text-2xl font-extrabold mt-2 truncate"
            style={{ color: item.color }}
          >
            {item.value}
            {item.unit && (
              <span className="ml-1 text-xs font-medium text-zinc-400">
                {item.unit}
              </span>
            )}
          </h4>

          <p className="text-[11px] font-medium mt-2 text-zinc-500">
            {item.sub}
          </p>
        </div>

        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0"
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
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [filters, setFilters] = useState({
    from_date: getFirstDayOfMonth(),
    to_date: getToday(),
  });

  const fetchDashboardReport = async () => {
    setIsLoading(true);
    setMessage("");

    try {
      const res = await adminDashboardService.getDashboardReport(filters);
      setReport(res.data?.data || null);
    } catch (error) {
      console.error("Lỗi tải dashboard:", error);
      setMessage(
        error.response?.data?.message ||
          "Không thể tải dữ liệu báo cáo thống kê.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = report?.summary || {};
  const charts = report?.charts || {};
  const revenueChart = charts?.revenue_chart || [];
  const timeSlotStats = charts?.time_slot_stats || [];
  const courtPerformance = report?.court_performance || [];
  const recentBookings = report?.recent_bookings || [];

  const bestCourt = useMemo(() => {
    if (!courtPerformance.length) return "Chưa có dữ liệu";

    return courtPerformance[0]?.court_name || "Chưa có dữ liệu";
  }, [courtPerformance]);

  const stats = [
    {
      label: "Tổng doanh thu đã thu",
      value: formatMoney(summary.total_revenue),
      unit: "",
      sub: `Tiền mặt ${formatMoney(summary.cash_revenue)} · Chuyển khoản ${formatMoney(summary.bank_revenue)}`,
      color: "#18181b",
      icon: "💰",
    },
    {
      label: "Lượt đặt sân",
      value: formatNumber(summary.total_bookings),
      unit: "Lượt",
      sub: "Tính theo số hóa đơn đặt sân",
      color: "#2563eb",
      icon: "📅",
    },
    {
      label: "Khách hàng mới",
      value: formatNumber(summary.new_customers),
      unit: "Khách",
      sub: "Tính theo số điện thoại lần đầu đặt",
      color: "#6366f1",
      icon: "👤",
    },
    {
      label: "Tỷ lệ lấp đầy",
      value: `${Number(summary.occupancy_rate || 0)}%`,
      unit: "TB",
      sub: `Sân hiệu suất tốt: ${bestCourt}`,
      color: "#10b981",
      icon: "📊",
    },
    {
      label: "Doanh thu tiền sân",
      value: formatMoney(summary.court_revenue),
      unit: "",
      sub: "Tổng tiền thuê sân theo hóa đơn",
      color: "#65a30d",
      icon: "🏸",
    },
    {
      label: "Doanh thu dịch vụ",
      value: formatMoney(summary.service_revenue),
      unit: "",
      sub: "Dịch vụ / Pro-shop phát sinh",
      color: "#7c3aed",
      icon: "🧃",
    },
    {
      label: "Tổng tiền nhập hàng",
      value: formatMoney(summary.purchase_amount),
      unit: "",
      sub: "Chi phí nhập sản phẩm trong kỳ",
      color: "#dc2626",
      icon: "📦",
    },
    {
      label: "Lợi nhuận tạm tính",
      value: formatMoney(
        Number(summary.total_revenue || 0) -
          Number(summary.purchase_amount || 0),
      ),
      unit: "",
      sub: "Doanh thu đã thu - tiền nhập hàng",
      color:
        Number(summary.total_revenue || 0) -
          Number(summary.purchase_amount || 0) >=
        0
          ? "#059669"
          : "#dc2626",
      icon: "📈",
    },
  ];

  const handleApplyFilter = () => {
    fetchDashboardReport();
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-100 p-16 text-center">
        <div className="inline-block w-7 h-7 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin mb-3" />
        <p className="text-sm font-semibold text-zinc-500">
          Đang tải báo cáo thống kê...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-900">
            Báo cáo tổng quan
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Theo dõi doanh thu, lịch đặt sân, chi phí nhập hàng và hiệu suất
            khai thác sân.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="date"
            value={filters.from_date}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                from_date: e.target.value,
              }))
            }
            className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-semibold text-zinc-700 outline-none focus:border-lime-400"
          />

          <input
            type="date"
            value={filters.to_date}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                to_date: e.target.value,
              }))
            }
            className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-semibold text-zinc-700 outline-none focus:border-lime-400"
          />

          <button
            onClick={handleApplyFilter}
            className="px-4 py-2 rounded-xl bg-lime-500 text-sm font-bold text-zinc-950 hover:bg-lime-400"
          >
            Lọc báo cáo
          </button>
        </div>
      </div>

      {message && (
        <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs font-semibold text-red-600">
          {message}
        </div>
      )}

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
                Doanh thu theo thời gian
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Tính theo các giao dịch thanh toán thành công.
              </p>
            </div>

            <span className="text-[11px] font-semibold text-lime-700 bg-lime-50 px-3 py-1 rounded-lg border border-lime-100">
              {filters.from_date} → {filters.to_date}
            </span>
          </div>

          <div className="h-72">
            {revenueChart.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-zinc-400 bg-zinc-50 rounded-2xl">
                Chưa có dữ liệu doanh thu trong khoảng thời gian này.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueChart}>
                  <defs>
                    <linearGradient
                      id="revenueColor"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#84cc16"
                        stopOpacity={0.35}
                      />
                      <stop offset="95%" stopColor="#84cc16" stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} />
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
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm">
          <h3 className="font-bold text-zinc-800 text-base mb-5">
            Hiệu suất khai thác sân
          </h3>

          {courtPerformance.length === 0 ? (
            <div className="py-12 text-center text-sm text-zinc-400">
              Chưa có dữ liệu sân.
            </div>
          ) : (
            <div className="space-y-5">
              {courtPerformance.map((court) => (
                <div key={court.court_id}>
                  <div className="flex justify-between text-xs font-semibold mb-2">
                    <span className="text-zinc-600">{court.court_name}</span>
                    <span className="text-zinc-900">
                      {court.booked_hours} giờ · {court.occupancy_rate}%
                    </span>
                  </div>

                  <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-lime-500 to-emerald-500"
                      style={{
                        width: `${Math.min(Number(court.occupancy_rate || 0), 100)}%`,
                      }}
                    />
                  </div>

                  <p className="text-[10px] text-zinc-400 mt-1">
                    {court.booking_count} lượt đặt
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-zinc-100 text-xs text-zinc-400">
            Tỷ lệ dựa trên tổng số giờ đặt / giờ khai thác dự kiến.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm">
          <h3 className="font-bold text-zinc-800 text-base mb-5">
            Lượt đặt theo khung giờ
          </h3>

          <div className="h-64">
            {timeSlotStats.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-zinc-400 bg-zinc-50 rounded-2xl">
                Chưa có dữ liệu khung giờ.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timeSlotStats}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar
                    dataKey="booking_count"
                    radius={[8, 8, 0, 0]}
                    fill="#84cc16"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="xl:col-span-2 bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-zinc-800 text-base">
              Đơn đặt sân gần đây
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="text-left text-xs text-zinc-400 border-b">
                  <th className="pb-3 font-bold">Mã đơn</th>
                  <th className="pb-3 font-bold">Khách hàng</th>
                  <th className="pb-3 font-bold">Sân</th>
                  <th className="pb-3 font-bold">Ngày chơi</th>
                  <th className="pb-3 font-bold">Thời gian</th>
                  <th className="pb-3 font-bold">Giá</th>
                  <th className="pb-3 font-bold">Thanh toán</th>
                  <th className="pb-3 font-bold">Trạng thái</th>
                </tr>
              </thead>

              <tbody>
                {recentBookings.length === 0 ? (
                  <tr>
                    <td
                      colSpan="8"
                      className="py-12 text-center text-sm text-zinc-400"
                    >
                      Chưa có đơn đặt sân gần đây.
                    </td>
                  </tr>
                ) : (
                  recentBookings.map((booking) => (
                    <tr
                      key={booking.booking_id}
                      className="border-b last:border-none"
                    >
                      <td className="py-4 font-semibold text-zinc-800">
                        {booking.booking_code}
                      </td>

                      <td className="py-4">
                        <p className="font-semibold text-zinc-800">
                          {booking.customer_name || "Khách vãng lai"}
                        </p>
                        <p className="text-[11px] text-zinc-400">
                          {booking.customer_phone || "—"}
                        </p>
                      </td>

                      <td className="py-4 text-zinc-500">
                        {booking.court_name || "—"}
                      </td>

                      <td className="py-4 text-zinc-500">
                        {formatDate(booking.play_date)}
                      </td>

                      <td className="py-4 text-zinc-500">
                        {booking.time_slot || "—"}
                      </td>

                      <td className="py-4 font-semibold text-zinc-800">
                        {formatMoney(booking.total_price)}
                      </td>

                      <td className="py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-[11px] font-bold ${getStatusClass(
                            booking.payment_status,
                          )}`}
                        >
                          {getPaymentStatusLabel(booking.payment_status)}
                        </span>
                      </td>

                      <td className="py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-[11px] font-bold ${getStatusClass(
                            booking.status,
                          )}`}
                        >
                          {getBookingStatusLabel(booking.status)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardReport;
