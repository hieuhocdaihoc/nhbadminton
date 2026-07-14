// src/pages/admin/DashboardReport.jsx
import { useEffect, useMemo, useState } from "react";
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
import ExcelJS from "exceljs";
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
    confirmed: "Đã xác nhận",
    completed: "Hoàn thành",
    cancelled: "Đã hủy",
  };

  return labels[status] || status || "—";
};



  const StatCard = ({ item }) => {
    return (
      <div className="admin-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="admin-stat-label">
              {item.label}
            </p>
  
            <h4
              className="admin-stat-value mt-2 truncate"
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
    let active = true;
    adminDashboardService.getDashboardReport(filters)
      .then((res) => {
        if (!active) return;
        setReport(res.data?.data || null);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error("Lỗi tải dashboard:", error);
        if (active) {
          setMessage(
            error.response?.data?.message ||
              "Không thể tải dữ liệu báo cáo thống kê.",
          );
          setIsLoading(false);
        }
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = report?.summary || {};
  const charts = report?.charts || {};
  const revenueChart = charts?.revenue_chart || [];
  const timeSlotStats = charts?.time_slot_stats || [];
  const courtPerformance = useMemo(() => report?.court_performance || [], [report]);
  const recentBookings = useMemo(() => report?.recent_bookings || [], [report]);

  const bestCourt = useMemo(() => {
    if (!courtPerformance.length) return "Chưa có dữ liệu";

    return courtPerformance[0]?.court_name || "Chưa có dữ liệu";
  }, [courtPerformance]);

  // --- XUẤT FILE EXCEL ĐỊNH DẠNG ĐẸP THEO KHOẢNG NGÀY ĐANG CHỌN ---
  const handleExportExcel = async () => {
    if (!report) return;

    const BRAND_GREEN = "FF65A30D";
    const HEADER_FONT = { color: { argb: "FFFFFFFF" }, bold: true, size: 11 };
    const THIN_BORDER = {
      top: { style: "thin", color: { argb: "FFE4E4E7" } },
      bottom: { style: "thin", color: { argb: "FFE4E4E7" } },
      left: { style: "thin", color: { argb: "FFE4E4E7" } },
      right: { style: "thin", color: { argb: "FFE4E4E7" } },
    };
    const CURRENCY_FMT = '#,##0 "đ"';

    const styleHeaderRow = (row) => {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_GREEN } };
        cell.font = HEADER_FONT;
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = THIN_BORDER;
      });
      row.height = 22;
    };

    const styleDataRow = (row, evenIndex) => {
      row.eachCell((cell) => {
        cell.border = THIN_BORDER;
        cell.alignment = { vertical: "middle" };
        if (evenIndex) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7FAF0" } };
        }
      });
    };

    const wb = new ExcelJS.Workbook();
    wb.creator = "NH Badminton";
    wb.created = new Date();

    // ── Trang 1: Tổng quan ──
    const wsOverview = wb.addWorksheet("Tổng quan", { views: [{ state: "frozen", ySplit: 3 }] });
    wsOverview.mergeCells("A1:B1");
    wsOverview.getCell("A1").value = `BÁO CÁO THỐNG KÊ (${filters.from_date} → ${filters.to_date})`;
    wsOverview.getCell("A1").font = { bold: true, size: 14, color: { argb: BRAND_GREEN } };
    wsOverview.getCell("A1").alignment = { vertical: "middle" };
    wsOverview.getRow(1).height = 28;

    wsOverview.columns = [{ width: 30 }, { width: 22 }];
    const overviewHeaderRow = wsOverview.addRow(["Chỉ tiêu", "Giá trị"]);
    styleHeaderRow(overviewHeaderRow);

    const overviewData = [
      ["Tổng doanh thu đã thu", Number(summary.total_revenue || 0), CURRENCY_FMT],
      ["   - Tiền mặt", Number(summary.cash_revenue || 0), CURRENCY_FMT],
      ["   - Chuyển khoản", Number(summary.bank_revenue || 0), CURRENCY_FMT],
      ["Lượt đặt sân", Number(summary.total_bookings || 0), "#,##0"],
      ["Khách hàng mới", Number(summary.new_customers || 0), "#,##0"],
      ["Tỷ lệ lấp đầy", Number(summary.occupancy_rate || 0) / 100, "0.0%"],
      ["Doanh thu tiền sân", Number(summary.court_revenue || 0), CURRENCY_FMT],
      ["Doanh thu dịch vụ", Number(summary.service_revenue || 0), CURRENCY_FMT],
      ["Tổng tiền nhập hàng", Number(summary.purchase_amount || 0), CURRENCY_FMT],
      [
        "Lợi nhuận tạm tính",
        Number(summary.total_revenue || 0) - Number(summary.purchase_amount || 0),
        CURRENCY_FMT,
      ],
      ["Sân hiệu suất tốt nhất", bestCourt, null],
    ];
    overviewData.forEach(([label, value, fmt], i) => {
      const row = wsOverview.addRow([label, value]);
      if (fmt) row.getCell(2).numFmt = fmt;
      row.getCell(1).font = { bold: true };
      styleDataRow(row, i % 2 === 1);
    });

    // ── Trang 2: Doanh thu theo ngày ──
    const wsRevenue = wb.addWorksheet("Doanh thu theo ngày", { views: [{ state: "frozen", ySplit: 1 }] });
    wsRevenue.columns = [
      { header: "Ngày", key: "date", width: 14 },
      { header: "Doanh thu", key: "revenue", width: 20 },
    ];
    styleHeaderRow(wsRevenue.getRow(1));
    revenueChart.forEach((r, i) => {
      const row = wsRevenue.addRow({ date: r.date, revenue: Number(r.revenue || 0) });
      row.getCell(2).numFmt = CURRENCY_FMT;
      styleDataRow(row, i % 2 === 1);
    });
    if (revenueChart.length) {
      wsRevenue.autoFilter = { from: "A1", to: "B1" };
    }

    // ── Trang 3: Hiệu suất khai thác sân ──
    const wsCourts = wb.addWorksheet("Hiệu suất sân", { views: [{ state: "frozen", ySplit: 1 }] });
    wsCourts.columns = [
      { header: "Sân", key: "court", width: 20 },
      { header: "Số giờ đã đặt", key: "hours", width: 16 },
      { header: "Tỷ lệ lấp đầy", key: "rate", width: 16 },
    ];
    styleHeaderRow(wsCourts.getRow(1));
    courtPerformance.forEach((c, i) => {
      const row = wsCourts.addRow({
        court: c.court_name,
        hours: Number(c.booked_hours || 0),
        rate: Number(c.occupancy_rate || 0) / 100,
      });
      row.getCell(3).numFmt = "0.0%";
      styleDataRow(row, i % 2 === 1);
    });

    // ── Trang 4: Danh sách đơn gần đây ──
    const wsBookings = wb.addWorksheet("Đơn đặt sân", { views: [{ state: "frozen", ySplit: 1 }] });
    wsBookings.columns = [
      { header: "Mã đơn", key: "code", width: 16 },
      { header: "Khách hàng", key: "customer", width: 20 },
      { header: "SĐT", key: "phone", width: 14 },
      { header: "Sân", key: "court", width: 12 },
      { header: "Ngày chơi", key: "date", width: 12 },
      { header: "Khung giờ", key: "slot", width: 14 },
      { header: "Giá", key: "price", width: 16 },
      { header: "Thanh toán", key: "payment", width: 18 },
      { header: "Trạng thái", key: "status", width: 14 },
    ];
    styleHeaderRow(wsBookings.getRow(1));
    recentBookings.forEach((b, i) => {
      const row = wsBookings.addRow({
        code: b.booking_code,
        customer: b.customer_name || "Khách vãng lai",
        phone: b.customer_phone || "",
        court: b.court_name || "",
        date: formatDate(b.play_date),
        slot: b.time_slot || "",
        price: Number(b.total_price || 0),
        payment: getPaymentStatusLabel(b.payment_status),
        status: getBookingStatusLabel(b.status),
      });
      row.getCell(7).numFmt = CURRENCY_FMT;
      styleDataRow(row, i % 2 === 1);
    });
    if (recentBookings.length) {
      wsBookings.autoFilter = { from: "A1", to: "I1" };
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bao-cao-thong-ke_${filters.from_date}_${filters.to_date}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
      <div className="admin-card p-16 text-center">
        <div className="inline-block w-7 h-7 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin mb-3" />
        <p className="text-sm font-semibold text-zinc-500">
          Đang tải báo cáo thống kê...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <div>
          <h1 className="admin-page-title text-2xl">
            Báo cáo tổng quan
          </h1>
          <p className="admin-page-subtitle text-sm mt-1">
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
            className="admin-input px-3.5 py-2 w-full sm:w-auto"
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
            className="admin-input px-3.5 py-2 w-full sm:w-auto"
          />

          <button
            onClick={handleApplyFilter}
            className="admin-btn-primary px-4 py-2 text-sm rounded-xl font-bold"
          >
            Lọc báo cáo
          </button>

          <button
            onClick={handleExportExcel}
            disabled={!report || isLoading}
            className="admin-btn-secondary px-4 py-2 text-sm rounded-xl flex items-center gap-2 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2-9.5V8a1 1 0 001 1h3.5M7 21h10a2 2 0 002-2V8.414a1 1 0 00-.293-.707l-4.414-4.414A1 1 0 0013.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Xuất Excel
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="admin-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-zinc-800 text-base">
                Doanh thu theo thời gian
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Tính theo các giao dịch thanh toán thành công.
              </p>
            </div>

            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">
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
                        stopColor="#10b981"
                        stopOpacity={0.35}
                      />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
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
                      [new Intl.NumberFormat("vi-VN").format(value) + " VNĐ", "Doanh thu"]
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Doanh thu"
                    stroke="#059669"
                    strokeWidth={3}
                    fill="url(#revenueColor)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="admin-card p-6">
          <h3 className="font-bold text-zinc-800 text-base mb-5">
            Lượt đặt theo khung giờ
          </h3>

          <div className="h-72">
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
                    fill="#10b981"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardReport;
