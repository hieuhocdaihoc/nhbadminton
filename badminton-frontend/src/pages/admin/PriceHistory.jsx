import { useState, useEffect, useCallback } from "react";
import { pricingService } from "../../services/admin/pricingService";
import { adminBookingService } from "../../services/admin/bookingService";

const fmt = (n) => Number(n ?? 0).toLocaleString("vi-VN");

const ACTION_LABELS = {
  create: { label: "Tạo mới",  cls: "badge-success" },
  update: { label: "Sửa giá",  cls: "badge-warning" },
  delete: { label: "Xóa",      cls: "badge-danger" },
};

const PriceHistory = ({ embedded = false }) => {
  const [histories, setHistories] = useState([]);
  const [summary, setSummary] = useState([]);
  const [courts, setCourts] = useState([]);
  const [courtId, setCourtId] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await pricingService.getPriceHistory(courtId);
      setHistories(res.data.data ?? []);
      setSummary(res.data.summary ?? []);
    } catch (err) {
      console.error("Loi tai lich su gia:", err);
    } finally {
      setIsLoading(false);
    }
  }, [courtId]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  useEffect(() => {
    adminBookingService.getAllCourts()
      .then((res) => setCourts(res.data.data ?? res.data ?? []))
      .catch(() => {});
  }, []);

  return (
    <div className={embedded ? "space-y-5" : "admin-page-container"}>
      <div className="admin-page-header">
        {!embedded && (
          <div>
            <h1 className="admin-page-title">Lịch sử sửa giá sân</h1>
            <p className="admin-page-subtitle">Số lần cập nhật giá, chênh lệch giá cũ và giá mới, người thực hiện.</p>
          </div>
        )}
        <select value={courtId} onChange={(e) => setCourtId(e.target.value)} className="admin-input w-auto px-3 py-2 ml-auto">
          <option value="">Tất cả sân</option>
          {courts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Thống kê riêng: số lần sửa giá theo sân */}
      <div className="admin-stat-group flex-wrap">
        <div className="admin-stat-badge badge-default px-4 py-2">
          <div className="admin-stat-value val-default">{histories.length}</div>
          <div className="admin-stat-label lbl-default">Bản ghi</div>
        </div>
        {summary.map((s) => (
          <div key={s.court_name} className="admin-stat-badge badge-default px-4 py-2">
            <div className="admin-stat-value val-default">{s.change_count}</div>
            <div className="admin-stat-label lbl-default">{s.court_name}</div>
          </div>
        ))}
      </div>

      <div className="admin-card overflow-x-auto">
        {isLoading ? (
          <div className="py-20 text-center text-sm text-zinc-400">Đang tải lịch sử...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th className="text-left">Thời điểm</th>
                <th className="text-left">Sân</th>
                <th className="text-left">Khung giá</th>
                <th className="text-center">Thao tác</th>
                <th className="text-right">Giá cũ</th>
                <th className="text-right">Giá mới</th>
                <th className="text-right">Chênh lệch</th>
                <th className="text-left">Người sửa</th>
              </tr>
            </thead>
            <tbody>
              {histories.map((h) => {
                const act = ACTION_LABELS[h.action] ?? ACTION_LABELS.update;
                return (
                  <tr key={h.id}>
                    <td className="text-xs text-zinc-500 whitespace-nowrap">{h.created_at}</td>
                    <td className="font-semibold text-sm">{h.court_name}</td>
                    <td className="text-xs text-zinc-500">{h.note}</td>
                    <td className="text-center">
                      <span className={`admin-badge px-2 py-0.5 text-[10px] ${act.cls}`}>{act.label}</span>
                    </td>
                    <td className="text-right text-sm text-zinc-500">{h.old_price !== null ? `${fmt(h.old_price)}đ` : "—"}</td>
                    <td className="text-right text-sm font-semibold">{h.new_price !== null ? `${fmt(h.new_price)}đ` : "—"}</td>
                    <td className={`text-right text-sm font-bold ${
                      h.diff > 0 ? "text-red-500" : h.diff < 0 ? "text-emerald-600" : "text-zinc-400"
                    }`}>
                      {h.diff !== null ? `${h.diff > 0 ? "+" : ""}${fmt(h.diff)}đ` : "—"}
                    </td>
                    <td className="text-sm">{h.changed_by}</td>
                  </tr>
                );
              })}
              {histories.length === 0 && (
                <tr><td colSpan={8} className="py-14 text-center text-sm text-zinc-400">Chưa có lịch sử sửa giá nào. Lịch sử sẽ được ghi lại từ lần sửa giá tiếp theo.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default PriceHistory;
