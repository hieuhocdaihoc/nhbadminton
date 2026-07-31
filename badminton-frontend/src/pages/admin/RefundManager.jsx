import { useEffect, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { adminPaymentService } from "../../services/admin/paymentService";
import { toast } from "../../utils/toast";

const STATUS_META = {
  recorded:  { label: "Chờ hoàn",  cls: "bg-amber-50 text-amber-600 border-amber-200" },
  pending:   { label: "Đang xử lý", cls: "bg-blue-50 text-blue-600 border-blue-200" },
  completed: { label: "Đã hoàn",   cls: "bg-emerald-50 text-emerald-600 border-emerald-200" },
  rejected:  { label: "Từ chối",   cls: "bg-zinc-100 text-zinc-500 border-zinc-200" },
};

const METHOD_LABEL = { cash: "Tiền mặt", bank_transfer: "Chuyển khoản" };

const fmt = (n) => Number(n || 0).toLocaleString("vi-VN");

const RefundManager = () => {
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminPaymentService.getRefunds();
      setRefunds(res.data?.data || []);
    } catch {
      toast.error("Không tải được danh sách hoàn tiền.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const changeStatus = async (id, status) => {
    setBusyId(id);
    try {
      await adminPaymentService.updateRefundStatus(id, status);
      toast.success(status === "completed" ? "Đã đánh dấu hoàn tiền xong." : "Đã cập nhật phiếu.");
      setRefunds((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    } catch (err) {
      toast.error(err.response?.data?.message || "Không cập nhật được phiếu.");
    } finally {
      setBusyId(null);
    }
  };

  const filtered = refunds;

  const totalPending = useMemo(
    () => refunds.filter((r) => r.status === "recorded" || r.status === "pending").reduce((s, r) => s + Number(r.amount || 0), 0),
    [refunds]
  );
  const totalCompleted = useMemo(
    () => refunds.filter((r) => r.status === "completed").reduce((s, r) => s + Number(r.amount || 0), 0),
    [refunds]
  );

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center gap-2">
        <RotateCcw className="w-5 h-5 text-emerald-600" />
        <h1 className="text-lg font-bold text-zinc-800">Quản lý hoàn tiền</h1>
      </div>
      <p className="text-xs text-zinc-500 -mt-3">
        Hệ thống chỉ ghi nhận phiếu. Nhân viên hoàn tiền mặt cho khách ngoài đời rồi
        bấm "Đã hoàn" để hệ thống trừ vào báo cáo doanh thu.
      </p>

      {/* Thống kê nhanh */}
      <div className="max-w-xs">
        <div className="admin-card p-4">
          <p className="text-[11px] text-zinc-400 font-medium">Đã hoàn trong hệ thống</p>
          <p className="text-xl font-bold text-emerald-600">{fmt(totalCompleted)}₫</p>
        </div>
      </div>

      {/* Danh sách */}
      {loading ? (
        <p className="text-sm text-zinc-400">Đang tải…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-zinc-400">Không có phiếu hoàn tiền nào.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const meta = STATUS_META[r.status] || STATUS_META.recorded;
            const canAct = r.status === "recorded" || r.status === "pending";
            return (
              <div key={r.id} className="admin-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-bold text-zinc-800">{fmt(r.amount)}₫</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${meta.cls}`}>{meta.label}</span>
                    <span className="text-[11px] text-zinc-400">{METHOD_LABEL[r.refund_method] || r.refund_method}</span>
                  </div>
                  <p className="text-xs text-zinc-600 mt-1">{r.reason || "—"}</p>
                  {r.refund_info && (
                    <p className="text-[11px] font-medium text-zinc-500 mt-1">
                      Thông tin nhận: {r.refund_info}
                    </p>
                  )}
                  <p className="text-[10px] text-zinc-400 mt-1">
                    {r.payment?.payment_code ? `Giao dịch ${r.payment.payment_code} · ` : ""}
                    {r.processed_by?.full_name ? `Xử lý: ${r.processed_by.full_name} · ` : ""}
                    {r.created_at ? new Date(r.created_at).toLocaleString("vi-VN") : ""}
                  </p>
                </div>
                {canAct && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      disabled={busyId === r.id}
                      onClick={() => changeStatus(r.id, "completed")}
                      className="admin-btn-primary px-3 py-1.5 text-xs disabled:opacity-40">
                      Đã hoàn
                    </button>
                    <button
                      disabled={busyId === r.id}
                      onClick={() => changeStatus(r.id, "rejected")}
                      className="admin-btn-outline px-3 py-1.5 text-xs hover:text-red-500 hover:border-red-200 disabled:opacity-40">
                      Từ chối
                    </button>
                  </div>
                )}
                {r.status === "rejected" && (
                  <button
                    disabled={busyId === r.id}
                    onClick={() => changeStatus(r.id, "recorded")}
                    className="admin-btn-outline px-3 py-1.5 text-xs flex-shrink-0 disabled:opacity-40">
                    Mở lại
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RefundManager;
