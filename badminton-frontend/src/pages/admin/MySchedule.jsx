import { LogOut } from "lucide-react";
import { authService } from "../../services/auth/authService";

const STATUS_LABEL = {
  scheduled: { label: "Đã xếp", color: "bg-blue-100 text-blue-700" },
  working: { label: "Đang làm", color: "bg-emerald-100 text-emerald-700" },
};

const formatTime = (t) => (t ? t.slice(0, 5) : "--:--");

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const isToday = (dateStr) =>
  new Date(dateStr).toDateString() === new Date().toDateString();

const MySchedule = ({ upcomingShifts = [], staffName = "" }) => {
  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch {
      // Phiên cục bộ vẫn phải được xóa nếu API thu hồi token không phản hồi.
    }
    localStorage.removeItem("access_token");
    localStorage.removeItem("current_user");
    localStorage.removeItem("current_role");
    localStorage.removeItem("permissions");
    window.location.href = "/";
  };

  const nextShift = upcomingShifts[0] ?? null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f4f6f8] px-4 py-10">
      {/* Card chính */}
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white shadow-xl shadow-slate-200/60">
        {/* TIÊU ĐỀ */}
        <div className="rounded-t-2xl bg-slate-950 px-6 py-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400">
            <span className="material-symbols-outlined text-3xl text-slate-950">
              schedule
            </span>
          </div>
          <h1 className="text-xl font-black text-white">Ngoài ca làm việc</h1>
          <p className="mt-1.5 text-sm text-slate-400">
            {staffName ? `Xin chào, ${staffName}` : "Xin chào"}
          </p>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Thông báo */}
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3.5">
            <p className="text-sm font-semibold text-amber-800">
              Bạn chưa trong ca làm hoặc chưa tới giờ ca.
            </p>
            <p className="mt-1 text-xs text-amber-600">
              Hệ thống chỉ cho phép thực hiện các chức năng khi đang trong giờ
              ca được phân công.
            </p>
          </div>

          {/* Ca tiếp theo */}
          {nextShift ? (
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Ca tiếp theo của bạn
              </p>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      {nextShift.shift_name || "Ca làm việc"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatDate(nextShift.shift_date)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${STATUS_LABEL[nextShift.status]?.color ?? "bg-zinc-100 text-zinc-500"}`}
                  >
                    {STATUS_LABEL[nextShift.status]?.label ?? nextShift.status}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-slate-400">
                    timer
                  </span>
                  <span className="text-sm font-semibold text-slate-700">
                    {formatTime(nextShift.start_time)} –{" "}
                    {formatTime(nextShift.end_time)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-300 px-4 py-5 text-center">
              <p className="text-sm font-semibold text-zinc-400">
                Chưa có ca nào được xếp tiếp theo
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                Liên hệ quản lý để được xếp ca.
              </p>
            </div>
          )}

          {/* Danh sách lịch sắp tới */}
          {upcomingShifts.length > 1 && (
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Lịch làm sắp tới
              </p>
              <div className="space-y-2">
                {upcomingShifts.slice(1, 6).map((shift) => (
                  <div
                    key={shift.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 px-3.5 py-2.5"
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-700">
                        {shift.shift_name || "Ca làm việc"}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {formatDate(shift.shift_date)}
                        {isToday(shift.shift_date) && (
                          <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                            Hôm nay
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-slate-500">
                      {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Đăng xuất */}
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600 transition-colors hover:bg-red-100"
          >
            <LogOut className="h-4 w-4" />
            Đăng xuất
          </button>
        </div>
      </div>
    </div>
  );
};

export default MySchedule;
