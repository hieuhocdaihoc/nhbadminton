import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  Trash2,
  UserRoundCheck,
} from "lucide-react";
import { adminUserService } from "../../services/admin/adminUserService";
import { staffShiftService } from "../../services/admin/staffShiftService";

// ─── HẰNG SỐ ─────────────────────────────────────────────────────────────────
const defaultForm = {
  id: null,
  staff_id: "",
  shift_date: new Date().toISOString().slice(0, 10),
  shift_name: "Ca sáng",
  start_time: "07:00",
  end_time: "11:00",
  status: "scheduled",
  note: "",
};

const SHIFT_PRESETS = {
  "Ca sáng":      { start_time: "07:00", end_time: "11:00" },
  "Ca chiều":     { start_time: "13:00", end_time: "17:00" },
  "Ca tối":       { start_time: "18:00", end_time: "22:00" },
  "Ca linh hoạt": { start_time: "07:00", end_time: "22:00" },
};

// Các hàng trong timetable
const SHIFT_SLOTS = [
  { name: "Ca sáng",      sub: "07:00 – 11:00", headerCls: "bg-sky-50    border-sky-100    text-sky-700"    },
  { name: "Ca chiều",     sub: "13:00 – 17:00", headerCls: "bg-amber-50  border-amber-100  text-amber-700"  },
  { name: "Ca tối",       sub: "18:00 – 22:00", headerCls: "bg-violet-50 border-violet-100 text-violet-700" },
  { name: "Ca linh hoạt", sub: "Giờ linh hoạt", headerCls: "bg-zinc-50   border-zinc-200   text-zinc-500"   },
];

const STATUS_STYLE = {
  scheduled: { label: "Đã xếp",     dot: "bg-sky-500",     badge: "bg-sky-50    text-sky-700    border-sky-200"    },
  working:   { label: "Đang làm",   dot: "bg-amber-500",   badge: "bg-amber-50  text-amber-700  border-amber-200"  },
  completed: { label: "Hoàn thành", dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelled: { label: "Đã hủy",     dot: "bg-zinc-400",    badge: "bg-zinc-100  text-zinc-500   border-zinc-200"   },
};

// ─── HÀM XỬ LÝ NGÀY ──────────────────────────────────────────────────────────
const getWeekStart = (base = new Date()) => {
  const d = new Date(base);
  const dow = d.getDay(); // 0 = CN
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  d.setHours(0, 0, 0, 0);
  return d;
};
const addDays  = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const toYMD    = (d) => d.toISOString().slice(0, 10);
const toDM     = (d) => `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
const toDMY    = (d) => `${toDM(d)}/${d.getFullYear()}`;
const VN_DAY   = ["CN","T2","T3","T4","T5","T6","T7"];

// Xác định shift nào thuộc slot nào
const slotIndex = (shiftName) => {
  if (shiftName === "Ca sáng")  return 0;
  if (shiftName === "Ca chiều") return 1;
  if (shiftName === "Ca tối")   return 2;
  return 3;
};

// Lấy tên cuối (họ/tên đơn giản) để hiển thị gọn trong ô
const shortName = (fullName = "") => {
  const parts = fullName.trim().split(" ");
  return parts[parts.length - 1] || fullName;
};

// ─── COMPONENT CHÍNH ─────────────────────────────────────────────────────────
const StaffShiftManager = () => {
  const [shifts,        setShifts]        = useState([]);
  const [staffs,        setStaffs]        = useState([]);
  const [weekStart,     setWeekStart]     = useState(() => getWeekStart());
  const [filterStaff,   setFilterStaff]   = useState("");
  const [form,          setForm]          = useState(defaultForm);
  const [isEditing,     setIsEditing]     = useState(false);
  const [isLoading,     setIsLoading]     = useState(true);
  const [isSaving,      setIsSaving]      = useState(false);
  const [message,       setMessage]       = useState({ type: "", text: "" });
  const [checkoutModal, setCheckoutModal] = useState({ open: false, shift: null, note: "" });

  const weekEnd  = addDays(weekStart, 6);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const todayYMD = toYMD(new Date());

  // ── Lấy ca làm việc cho tuần hiện tại ────────────────────────────────────────
  const fetchShifts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = {
        date_from: toYMD(weekStart),
        date_to:   toYMD(weekEnd),
        per_page:  200,
        ...(filterStaff ? { staff_id: filterStaff } : {}),
      };
      const res = await staffShiftService.getShifts(params);
      setShifts(res.data?.data?.data || res.data?.data || []);
    } catch {
      showMessage("error", "Không thể tải lịch trực.");
    } finally {
      setIsLoading(false);
    }
  }, [weekStart, filterStaff]);

  useEffect(() => { fetchShifts(); }, [fetchShifts]);

  // ── Tải danh sách nhân viên ──────────────────────────────────────────────────
  useEffect(() => {
    adminUserService.getStaffs({ per_page: 100, status: "active" })
      .then((r) => setStaffs(r.data?.data?.data || r.data?.data || []))
      .catch(() => {});
  }, []);

  // ── Tạo lịch trình ───────────────────────────────────────────────────────────
  const timetable = useMemo(() => {
    const map = {};
    for (const d of weekDays) {
      const ymd = toYMD(d);
      map[ymd] = { 0: [], 1: [], 2: [], 3: [] };
    }
    for (const s of shifts) {
      const ymd = s.shift_date;
      if (map[ymd]) map[ymd][slotIndex(s.shift_name)]?.push(s);
    }
    return map;
  }, [shifts, weekDays]);

  // ── Thống kê ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:     shifts.length,
    scheduled: shifts.filter((s) => s.status === "scheduled").length,
    working:   shifts.filter((s) => s.status === "working").length,
    completed: shifts.filter((s) => s.status === "completed").length,
  }), [shifts]);

  // ── Hàm hỗ trợ ───────────────────────────────────────────────────────────────
  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 2500);
  };

  const resetForm = () => { setForm(defaultForm); setIsEditing(false); };

  const handlePresetChange = (shiftName) => {
    const p = SHIFT_PRESETS[shiftName] || {};
    setForm((f) => ({ ...f, shift_name: shiftName, start_time: p.start_time || f.start_time, end_time: p.end_time || f.end_time }));
  };

  // Bấm vào ô trống → điền sẵn ngày + ca vào form
  const handleCellClick = (date, slotName) => {
    const p = SHIFT_PRESETS[slotName] || {};
    setForm({ ...defaultForm, shift_date: toYMD(date), shift_name: slotName, start_time: p.start_time || "07:00", end_time: p.end_time || "22:00" });
    setIsEditing(false);
    // Scroll to form on mobile
    document.getElementById("shift-form")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const handleEdit = (shift) => {
    setIsEditing(true);
    setForm({
      id:         shift.id,
      staff_id:   shift.staff_id,
      shift_date: shift.shift_date,
      shift_name: shift.shift_name || "Ca sáng",
      start_time: (shift.start_time || "").slice(0, 5),
      end_time:   (shift.end_time   || "").slice(0, 5),
      status:     shift.status || "scheduled",
      note:       shift.note || "",
    });
    document.getElementById("shift-form")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        staff_id:   form.staff_id,
        shift_date: form.shift_date,
        shift_name: form.shift_name || null,
        start_time: form.start_time,
        end_time:   form.end_time,
        status:     form.status || "scheduled",
        note:       form.note || null,
      };
      if (isEditing) {
        await staffShiftService.updateShift(form.id, payload);
        showMessage("success", "Cập nhật ca làm thành công.");
      } else {
        await staffShiftService.createShift(payload);
        showMessage("success", "Đã xếp ca làm thành công.");
      }
      resetForm();
      fetchShifts();
    } catch (err) {
      showMessage("error", err.response?.data?.message || "Không thể lưu ca làm.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (shift) => {
    if (!window.confirm(`Xóa ca ${shift.shift_name || ""} của ${shift.staff?.full_name || "nhân viên này"}?`)) return;
    try {
      await staffShiftService.deleteShift(shift.id);
      showMessage("success", "Đã xóa ca làm.");
      fetchShifts();
    } catch (err) {
      showMessage("error", err.response?.data?.message || "Không thể xóa.");
    }
  };

  const handleCheckIn = async (shift) => {
    try { await staffShiftService.checkIn(shift.id); showMessage("success", "Đã điểm danh vào ca."); fetchShifts(); }
    catch (err) { showMessage("error", err.response?.data?.message || "Không thể điểm danh."); }
  };

  const handleCheckOut = (shift) => {
    setCheckoutModal({ open: true, shift, note: shift.note || "" });
  };

  const confirmCheckOut = async () => {
    const { shift, note } = checkoutModal;
    setCheckoutModal((m) => ({ ...m, open: false }));
    try { await staffShiftService.checkOut(shift.id, note); showMessage("success", "Đã điểm danh ra ca."); fetchShifts(); }
    catch (err) { showMessage("error", err.response?.data?.message || "Không thể điểm danh."); }
  };

  const inputCls = "admin-input";

  return (
    <div className="mx-auto max-w-[1440px] space-y-5">

      {/* ─── TIÊU ĐỀ TRANG ─── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-black tracking-tight text-zinc-900">Lịch trực nhân viên</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Xếp và theo dõi ca làm theo tuần</p>
        </div>

        {/* Week navigation */}
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekStart((w) => addDays(w, -7))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50 transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-[170px] px-3 py-1.5 text-center rounded-lg border border-zinc-200 bg-white text-xs font-bold text-zinc-700">
            {toDMY(weekStart)} – {toDMY(weekEnd)}
          </div>
          <button onClick={() => setWeekStart((w) => addDays(w, 7))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50 transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button onClick={() => setWeekStart(getWeekStart())}
            className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-xs font-bold text-zinc-600 hover:bg-zinc-50 transition-colors">
            Hôm nay
          </button>
        </div>
      </div>

      {/* ─── THÔNG BÁO FLASH ─── */}
      <AnimatePresence>
        {message.text && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`rounded-lg border p-3 text-xs font-semibold ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-600"}`}>
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── THANH THỐNG KÊ ─── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Ca trong tuần",  value: stats.total,     color: "text-zinc-800",   icon: CalendarDays,   bg: "bg-zinc-100"    },
          { label: "Đã xếp lịch",   value: stats.scheduled, color: "text-sky-700",    icon: Clock3,         bg: "bg-sky-50"      },
          { label: "Đang làm việc",  value: stats.working,   color: "text-amber-700",  icon: UserRoundCheck, bg: "bg-amber-50"    },
          { label: "Hoàn thành",     value: stats.completed, color: "text-emerald-700",icon: CheckCircle2,   bg: "bg-emerald-50"  },
        ].map(({ label, value, color, icon: Icon, bg }) => (
          <div key={label} className="flex items-center gap-3 admin-card p-4">
            <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${bg}`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">{label}</p>
              <p className={`text-xl font-black ${color}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ─── NHÂN VIÊN HÔM NAY ─── */}
      {(() => {
        const todayShifts = Object.values(timetable[todayYMD] || {}).flat();
        if (!todayShifts.length) return null;
        return (
          <div className="admin-card px-4 py-3 flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 shrink-0">
              <UserRoundCheck className="h-4 w-4 text-emerald-500" />
              Hôm nay
            </span>
            {todayShifts.map((s) => {
              const style = STATUS_STYLE[s.status] || STATUS_STYLE.scheduled;
              return (
                <span key={s.id} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                  {s.staff?.full_name || "—"}
                  <span className="opacity-60">· {s.shift_name}</span>
                </span>
              );
            })}
          </div>
        );
      })()}

      {/* ─── BỐ CỤC CHÍNH ─── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">

        {/* ══════════════════════════════════════
            TIMETABLE (8/12)
        ══════════════════════════════════════ */}
        <section className="xl:col-span-8">
          <div className="admin-card overflow-hidden">

            {/* Toolbar above timetable */}
            <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 bg-zinc-50/70 px-4 py-2.5">
              <select value={filterStaff} onChange={(e) => setFilterStaff(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 outline-none focus:border-zinc-300">
                <option value="">Tất cả nhân viên</option>
                {staffs.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>

              {/* Legend */}
              <div className="ml-auto flex flex-wrap items-center gap-4">
                {Object.entries(STATUS_STYLE).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${v.dot}`} />
                    <span className="text-[10px] text-zinc-500 font-medium">{v.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Timetable grid */}
            {isLoading ? (
              <div className="py-20 text-center">
                <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-700" />
                <p className="mt-2 text-xs text-zinc-400">Đang tải lịch trực...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ minWidth: 680 }}>

                  {/* ── Tiêu đề cột: các ngày trong tuần ── */}
                  <thead>
                    <tr>
                      {/* Corner cell */}
                      <th className="sticky left-0 z-10 w-28 border-b border-r border-zinc-100 bg-zinc-50 px-3 py-3 text-left">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">Ca / Ngày</span>
                      </th>
                      {weekDays.map((d) => {
                        const ymd     = toYMD(d);
                        const isToday = ymd === todayYMD;
                        return (
                          <th key={ymd}
                            className={`w-[calc((100%-7rem)/7)] border-b border-r border-zinc-100 last:border-r-0 px-2 py-3 text-center transition-colors ${isToday ? "bg-emerald-50" : "bg-zinc-50"}`}>
                            <p className={`text-[10px] font-bold uppercase tracking-wide ${isToday ? "text-emerald-600" : "text-zinc-400"}`}>
                              {VN_DAY[d.getDay()]}
                            </p>
                            <p className={`mt-0.5 text-sm font-black ${isToday ? "text-emerald-700" : "text-zinc-800"}`}>
                              {toDM(d)}
                            </p>
                            {isToday && <span className="mx-auto mt-1 block h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>

                  {/* ── Hàng: các ca làm việc ── */}
                  <tbody>
                    {SHIFT_SLOTS.map((slot, slotIdx) => (
                      <tr key={slot.name}>
                        {/* Slot label */}
                        <td className={`sticky left-0 z-10 border-b border-r border-zinc-100 bg-white px-3 py-3 align-top last:border-b-0 w-28`}>
                          <span className={`inline-flex items-center rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ${slot.headerCls}`}>
                            {slot.name}
                          </span>
                          <p className="mt-1.5 px-0.5 text-[10px] font-medium text-zinc-400">{slot.sub}</p>
                        </td>

                        {/* Day cells */}
                        {weekDays.map((d) => {
                          const ymd        = toYMD(d);
                          const isToday    = ymd === todayYMD;
                          const cellShifts = timetable[ymd]?.[slotIdx] || [];

                          return (
                            <td key={ymd}
                              onClick={() => handleCellClick(d, slot.name)}
                              className={`group border-b border-r border-zinc-100 last:border-r-0 last:last-of-type:border-b-0 px-1.5 py-1.5 align-top cursor-pointer transition-colors ${isToday ? "bg-emerald-50/30" : "hover:bg-zinc-50/80"}`}
                              style={{ minHeight: 80, minWidth: 90 }}>

                              {cellShifts.length === 0 ? (
                                // Empty cell hint
                                <div className="flex h-full min-h-[68px] items-center justify-center">
                                  <Plus className="h-4 w-4 text-zinc-200 group-hover:text-zinc-300 transition-colors" />
                                </div>
                              ) : (
                                <div className="space-y-1.5 min-h-[68px]" onClick={(e) => e.stopPropagation()}>
                                  {cellShifts.map((shift) => {
                                    const st = STATUS_STYLE[shift.status] || STATUS_STYLE.scheduled;
                                    return (
                                      <div key={shift.id}
                                        className={`group/card relative rounded-lg border px-2 py-1.5 select-none ${st.badge}`}>

                                        {/* Staff name */}
                                        <p className="max-w-[88px] truncate text-[11px] font-bold leading-tight">
                                          {shortName(shift.staff?.full_name)}
                                        </p>

                                        {/* Time + status dot */}
                                        <div className="mt-0.5 flex items-center gap-1">
                                          <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${st.dot}`} />
                                          <span className="text-[10px] font-mono opacity-60">
                                            {(shift.start_time || "").slice(0, 5)}–{(shift.end_time || "").slice(0, 5)}
                                          </span>
                                        </div>

                                        {/* Hover action buttons */}
                                        <div className="absolute -top-1.5 -right-1 hidden group-hover/card:flex items-center gap-0.5 shadow-md">
                                          {shift.status === "scheduled" && (
                                            <button type="button" onClick={(e) => { e.stopPropagation(); handleCheckIn(shift); }}
                                              title="Vào ca"
                                              className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm transition-colors">
                                              <LogIn className="h-3 w-3" />
                                            </button>
                                          )}
                                          {shift.status === "working" && (
                                            <button type="button" onClick={(e) => { e.stopPropagation(); handleCheckOut(shift); }}
                                              title="Ra ca"
                                              className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white hover:bg-amber-600 shadow-sm transition-colors">
                                              <LogOut className="h-3 w-3" />
                                            </button>
                                          )}
                                          <button type="button" onClick={(e) => { e.stopPropagation(); handleEdit(shift); }}
                                            title="Sửa"
                                            className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white hover:bg-blue-600 shadow-sm transition-colors">
                                            <Pencil className="h-3 w-3" />
                                          </button>
                                          <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(shift); }}
                                            title="Xóa"
                                            className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 shadow-sm transition-colors">
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer hint */}
            <div className="border-t border-zinc-100 bg-zinc-50/60 px-4 py-2 text-center">
              <p className="text-[10px] text-zinc-400">
                Bấm vào ô trống để xếp ca · Di chuột lên badge nhân viên để sửa / xóa / điểm danh
              </p>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            FORM (4/12)
        ══════════════════════════════════════ */}
        <aside className="xl:col-span-4">
          <form id="shift-form" onSubmit={handleSubmit}
            className="sticky top-4 rounded-xl border border-zinc-200/70 bg-white p-5 shadow-sm">

            <div className="mb-5 flex items-start justify-between">
              <div>
                <h3 className="text-sm font-black text-zinc-900">
                  {isEditing ? "Cập nhật ca làm" : "Xếp ca mới"}
                </h3>
                <p className="mt-0.5 text-[11px] text-zinc-400">
                  {isEditing ? "Chỉnh sửa thông tin ca" : "Điền thông tin để xếp ca trực"}
                </p>
              </div>
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                <Plus className="h-5 w-5 text-emerald-600" />
              </span>
            </div>

            <div className="space-y-4">
              {/* Nhân viên */}
              <div>
                <label className="mb-1.5 block text-[11px] font-bold text-zinc-500">Nhân viên *</label>
                <select required value={form.staff_id}
                  onChange={(e) => setForm({ ...form, staff_id: e.target.value })}
                  className={inputCls}>
                  <option value="">Chọn nhân viên</option>
                  {staffs.map((s) => (
                    <option key={s.id} value={s.id}>{s.full_name} – {s.phone}</option>
                  ))}
                </select>
              </div>

              {/* Ngày + Ca */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold text-zinc-500">Ngày trực *</label>
                  <input required type="date" value={form.shift_date}
                    onChange={(e) => setForm({ ...form, shift_date: e.target.value })}
                    className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold text-zinc-500">Tên ca</label>
                  <select value={form.shift_name} onChange={(e) => handlePresetChange(e.target.value)} className={inputCls}>
                    {Object.keys(SHIFT_PRESETS).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>

              {/* Giờ */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold text-zinc-500">Bắt đầu *</label>
                  <input required type="time" value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                    className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold text-zinc-500">Kết thúc *</label>
                  <input required type="time" value={form.end_time}
                    onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                    className={inputCls} />
                </div>
              </div>

              {/* Trạng thái — chỉ hiện khi sửa */}
              {isEditing && (
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold text-zinc-500">Trạng thái</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputCls}>
                    {Object.entries(STATUS_STYLE).map(([v, m]) => (
                      <option key={v} value={v}>{m.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Ghi chú */}
              <div>
                <label className="mb-1.5 block text-[11px] font-bold text-zinc-500">Ghi chú bàn giao</label>
                <textarea value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  rows={3} placeholder="Nội dung bàn giao, công việc cần lưu ý..."
                  className={`${inputCls} resize-none`} />
              </div>

              {/* Thông tin ca được chọn */}
              {!isEditing && form.shift_date && (
                <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2.5 text-xs text-zinc-500">
                  <span className="font-semibold text-zinc-700">{form.shift_name}</span>
                  {" · "}{form.shift_date}
                  {" · "}{form.start_time} – {form.end_time}
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={isSaving}
                  className={`flex-1 flex items-center justify-center gap-2 ${isEditing ? "admin-btn-secondary" : "admin-btn-primary"} py-2.5 disabled:opacity-60 disabled:shadow-none disabled:hover:translate-y-0`}>
                  {isSaving ? "Đang lưu..." : isEditing ? "Lưu thay đổi" : "Xếp ca"}
                </button>
                {isEditing && (
                  <button type="button" onClick={resetForm}
                    className="admin-btn-outline py-2.5">
                    Hủy
                  </button>
                )}
              </div>
            </div>
          </form>
        </aside>
      </div>

      {/* ─── MODAL BÀN GIAO CA ─── */}
      <AnimatePresence>
        {checkoutModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
                <h3 className="text-sm font-bold text-zinc-800">Bàn giao ca</h3>
                <button onClick={() => setCheckoutModal((m) => ({ ...m, open: false }))}
                  className="text-zinc-400 hover:text-zinc-600">✕</button>
              </div>
              <div className="p-5 space-y-3">
                <p className="text-xs text-zinc-500">
                  Nhân viên: <strong className="text-zinc-800">{checkoutModal.shift?.staff?.full_name}</strong>
                  {" · "}{checkoutModal.shift?.shift_name}
                </p>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold text-zinc-500">Ghi chú bàn giao</label>
                  <textarea
                    rows={3}
                    value={checkoutModal.note}
                    onChange={(e) => setCheckoutModal((m) => ({ ...m, note: e.target.value }))}
                    placeholder="Nội dung bàn giao, công việc cần lưu ý..."
                    className="admin-input resize-none"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={confirmCheckOut} className="admin-btn-primary flex-1 py-2 text-sm">
                    Xác nhận ra ca
                  </button>
                  <button onClick={() => setCheckoutModal((m) => ({ ...m, open: false }))}
                    className="admin-btn-outline flex-1 py-2 text-sm">
                    Hủy
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StaffShiftManager;
