import { useState, useEffect, useCallback } from "react";
import { adminDashboardService } from "../../services/admin/dashboardService";

const fmt = (n) => Number(n ?? 0).toLocaleString("vi-VN");

// Khoảng thời gian nhanh
const PRESETS = [
  { key: "day",   label: "Hôm nay" },
  { key: "week",  label: "Tuần này" },
  { key: "month", label: "Tháng này" },
  { key: "custom", label: "Tùy chọn" },
];

const presetRange = (key) => {
  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  if (key === "day") return { from: iso(today), to: iso(today) };
  if (key === "week") {
    const start = new Date(today);
    start.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return { from: iso(start), to: iso(today) };
  }
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  return { from: iso(start), to: iso(today) };
};

const CourtPerformance = ({ embedded = false }) => {
  const [preset, setPreset] = useState("month");
  const [range, setRange] = useState(presetRange("month"));
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminDashboardService.getCourtPerformance({
        from_date: range.from,
        to_date: range.to,
      });
      const raw = res.data.data;
      setRows(Array.isArray(raw) ? raw : []);
    } catch (err) {
      console.error("Loi tai bao cao hieu suat san:", err);
    } finally {
      setIsLoading(false);
    }
  }, [range]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const handlePreset = (key) => {
    setPreset(key);
    if (key !== "custom") setRange(presetRange(key));
  };

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalBookings = rows.reduce((s, r) => s + r.bookings, 0);
  const maxRevenue = Math.max(1, ...rows.map((r) => r.revenue));

  return (
    <div className={embedded ? "space-y-5" : "admin-page-container"}>
      {!embedded && (
        <div className="admin-page-header">
          <div>
            <h1 className="admin-page-title">Hiệu suất & doanh thu từng sân</h1>
            <p className="admin-page-subtitle">Lượt đặt, giờ khai thác, hiệu suất sử dụng và doanh thu theo thời gian.</p>
          </div>
        </div>
      )}

      {/* Bộ lọc thời gian */}
      <div className="admin-card p-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => handlePreset(p.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                preset === p.key ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <input type="date" value={range.from} disabled={preset !== "custom"}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            className="admin-input w-auto px-2.5 py-1.5" />
          <span className="text-zinc-400">→</span>
          <input type="date" value={range.to} disabled={preset !== "custom"}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            className="admin-input w-auto px-2.5 py-1.5" />
        </div>
      </div>

      {/* Thống kê riêng của trang */}
      <div className="admin-stat-group flex-wrap">
        <div className="admin-stat-badge badge-default px-4 py-2">
          <div className="admin-stat-value val-default">{rows.length}</div>
          <div className="admin-stat-label lbl-default">Sân</div>
        </div>
        <div className="admin-stat-badge badge-default px-4 py-2">
          <div className="admin-stat-value val-default">{totalBookings}</div>
          <div className="admin-stat-label lbl-default">Lượt đặt</div>
        </div>
        <div className="admin-stat-badge badge-success px-4 py-2">
          <div className="admin-stat-value val-success">{fmt(totalRevenue)}đ</div>
          <div className="admin-stat-label lbl-success">Tổng doanh thu</div>
        </div>
      </div>

      <div className="admin-card overflow-x-auto">
        {isLoading ? (
          <div className="py-20 text-center text-sm text-zinc-400">Đang tải báo cáo...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th className="text-left">Sân</th>
                <th className="text-center">Lượt đặt</th>
                <th className="text-center">Giờ đã đặt</th>
                <th className="text-left w-56">Hiệu suất sử dụng</th>
                <th className="text-right">Doanh thu</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.court_id}>
                  <td className="font-semibold text-sm">{r.court_name}</td>
                  <td className="text-center text-sm">{r.bookings}</td>
                  <td className="text-center text-sm">{r.booked_hours}h</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${r.utilization >= 60 ? "bg-emerald-500" : r.utilization >= 30 ? "bg-amber-400" : "bg-zinc-300"}`}
                          style={{ width: `${Math.min(100, r.utilization)}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-zinc-600 w-12 text-right">{r.utilization}%</span>
                    </div>
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-24 h-1.5 bg-zinc-100 rounded-full overflow-hidden hidden sm:block">
                        <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${(r.revenue / maxRevenue) * 100}%` }} />
                      </div>
                      <span className="text-sm font-bold text-emerald-600">{fmt(r.revenue)}đ</span>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="py-14 text-center text-sm text-zinc-400">Không có dữ liệu trong khoảng thời gian này.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default CourtPerformance;
