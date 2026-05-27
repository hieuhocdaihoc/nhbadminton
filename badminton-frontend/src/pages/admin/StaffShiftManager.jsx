import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserRoundCheck,
} from "lucide-react";
import { adminUserService } from "../../services/admin/adminUserService";
import { staffShiftService } from "../../services/admin/staffShiftService";

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

const shiftPresets = {
  "Ca sáng": { start_time: "07:00", end_time: "11:00" },
  "Ca chiều": { start_time: "13:00", end_time: "17:00" },
  "Ca tối": { start_time: "18:00", end_time: "22:00" },
};

const statusMap = {
  scheduled: {
    label: "Đã xếp",
    className: "bg-sky-50 text-sky-700 border-sky-100",
  },
  working: {
    label: "Đang làm",
    className: "bg-amber-50 text-amber-700 border-amber-100",
  },
  completed: {
    label: "Hoàn thành",
    className: "bg-emerald-50 text-emerald-700 border-emerald-100",
  },
  cancelled: {
    label: "Đã hủy",
    className: "bg-zinc-100 text-zinc-500 border-zinc-200",
  },
};

const getItems = (response) => response.data?.data?.data || response.data?.data || [];
const getPagination = (response) => response.data?.data || {};

const StaffShiftManager = () => {
  const [shifts, setShifts] = useState([]);
  const [staffs, setStaffs] = useState([]);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1 });
  const [filters, setFilters] = useState({
    keyword: "",
    staff_id: "",
    status: "",
    date_from: new Date().toISOString().slice(0, 10),
    date_to: "",
  });
  const [form, setForm] = useState(defaultForm);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const fetchShifts = useCallback(async (page = 1) => {
    setIsLoading(true);
    try {
      const params = {
        page,
        per_page: 10,
        ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
      };
      const response = await staffShiftService.getShifts(params);
      setShifts(getItems(response));
      setPagination(getPagination(response));
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Không thể tải danh sách ca làm.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    let isMounted = true;

    const loadStaffs = async () => {
      try {
        const response = await adminUserService.getStaffs({ per_page: 100, status: "active" });
        if (isMounted) setStaffs(getItems(response));
      } catch {
        if (isMounted) {
          setMessage({ type: "error", text: "Không thể tải danh sách nhân viên." });
        }
      }
    };

    loadStaffs();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchShifts(1), 350);
    return () => clearTimeout(timer);
  }, [fetchShifts]);

  const stats = useMemo(
    () => ({
      total: shifts.length,
      scheduled: shifts.filter((shift) => shift.status === "scheduled").length,
      working: shifts.filter((shift) => shift.status === "working").length,
      completed: shifts.filter((shift) => shift.status === "completed").length,
    }),
    [shifts],
  );

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 2800);
  };

  const resetForm = () => {
    setForm(defaultForm);
    setIsEditing(false);
  };

  const handlePresetChange = (shiftName) => {
    const preset = shiftPresets[shiftName] || {};
    setForm((current) => ({
      ...current,
      shift_name: shiftName,
      start_time: preset.start_time || current.start_time,
      end_time: preset.end_time || current.end_time,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);

    const payload = {
      staff_id: form.staff_id,
      shift_date: form.shift_date,
      shift_name: form.shift_name || null,
      start_time: form.start_time,
      end_time: form.end_time,
      status: form.status || "scheduled",
      note: form.note || null,
    };

    try {
      if (isEditing) {
        await staffShiftService.updateShift(form.id, payload);
        showMessage("success", "Cập nhật ca làm thành công.");
      } else {
        await staffShiftService.createShift(payload);
        showMessage("success", "Tạo ca làm thành công.");
      }
      resetForm();
      fetchShifts(pagination.current_page || 1);
    } catch (error) {
      showMessage("error", error.response?.data?.message || "Không thể lưu ca làm.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (shift) => {
    setIsEditing(true);
    setForm({
      id: shift.id,
      staff_id: shift.staff_id,
      shift_date: shift.shift_date,
      shift_name: shift.shift_name || "",
      start_time: (shift.start_time || "").slice(0, 5),
      end_time: (shift.end_time || "").slice(0, 5),
      status: shift.status || "scheduled",
      note: shift.note || "",
    });
  };

  const handleDelete = async (shift) => {
    if (!window.confirm(`Xóa ca ${shift.shift_name || ""} của ${shift.staff?.full_name || "nhân viên này"}?`)) {
      return;
    }

    try {
      await staffShiftService.deleteShift(shift.id);
      showMessage("success", "Đã xóa ca làm.");
      fetchShifts(pagination.current_page || 1);
    } catch (error) {
      showMessage("error", error.response?.data?.message || "Không thể xóa ca làm.");
    }
  };

  const handleCheckIn = async (shift) => {
    try {
      await staffShiftService.checkIn(shift.id);
      showMessage("success", "Đã điểm danh vào ca.");
      fetchShifts(pagination.current_page || 1);
    } catch (error) {
      showMessage("error", error.response?.data?.message || "Không thể điểm danh vào ca.");
    }
  };

  const handleCheckOut = async (shift) => {
    const note = window.prompt("Ghi chú bàn giao ca", shift.note || "");
    if (note === null) return;

    try {
      await staffShiftService.checkOut(shift.id, note);
      showMessage("success", "Đã điểm danh ra ca.");
      fetchShifts(pagination.current_page || 1);
    } catch (error) {
      showMessage("error", error.response?.data?.message || "Không thể điểm danh ra ca.");
    }
  };

  const inputClass =
    "w-full rounded-lg border border-zinc-200 bg-[#f8f8fa] px-3.5 py-2.5 text-sm text-zinc-800 outline-none transition-all focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200";

  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-black tracking-tight text-zinc-900">
            Quản lý ca làm nhân viên
          </h2>
          <p className="mt-1 text-xs font-medium text-zinc-500">
            Xếp lịch trực, theo dõi điểm danh và ghi chú bàn giao ca
          </p>
        </div>
      </div>

      <AnimatePresence>
        {message.text && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className={`rounded-lg border p-3 text-xs font-semibold ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-600"
            }`}
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {[
          { label: "Ca trong trang", value: stats.total, icon: CalendarDays },
          { label: "Đã xếp", value: stats.scheduled, icon: Clock3 },
          { label: "Đang làm", value: stats.working, icon: UserRoundCheck },
          { label: "Hoàn thành", value: stats.completed, icon: CheckCircle2 },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-xl border border-zinc-200/70 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">
                    {item.label}
                  </p>
                  <p className="mt-2 text-2xl font-black text-zinc-900">{item.value}</p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-lime-50 text-lime-700">
                  <Icon className="h-5 w-5" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <section className="xl:col-span-8">
          <div className="rounded-xl border border-zinc-200/70 bg-white">
            <div className="border-b border-zinc-100 p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                <div className="relative md:col-span-2">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    value={filters.keyword}
                    onChange={(event) =>
                      setFilters((current) => ({ ...current, keyword: event.target.value }))
                    }
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2.5 pl-10 pr-3 text-xs outline-none focus:border-zinc-300 focus:bg-white"
                    placeholder="Tìm tên nhân viên, SĐT hoặc ghi chú..."
                  />
                </div>
                <select
                  value={filters.staff_id}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, staff_id: event.target.value }))
                  }
                  className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs outline-none focus:border-zinc-300"
                >
                  <option value="">Tất cả nhân viên</option>
                  {staffs.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.full_name}
                    </option>
                  ))}
                </select>
                <select
                  value={filters.status}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, status: event.target.value }))
                  }
                  className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs outline-none focus:border-zinc-300"
                >
                  <option value="">Tất cả trạng thái</option>
                  {Object.entries(statusMap).map(([value, meta]) => (
                    <option key={value} value={value}>
                      {meta.label}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={filters.date_from}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, date_from: event.target.value }))
                  }
                  className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs outline-none focus:border-zinc-300"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b border-zinc-100 bg-zinc-50/70 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  <tr>
                    <th className="px-5 py-3">Nhân viên</th>
                    <th className="px-3 py-3">Ngày / Ca</th>
                    <th className="px-3 py-3">Thời gian</th>
                    <th className="px-3 py-3">Điểm danh</th>
                    <th className="px-3 py-3">Trạng thái</th>
                    <th className="px-5 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan="6" className="py-16 text-center">
                        <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" />
                      </td>
                    </tr>
                  ) : shifts.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-16 text-center text-xs font-medium text-zinc-400">
                        Chưa có ca làm phù hợp với bộ lọc
                      </td>
                    </tr>
                  ) : (
                    shifts.map((shift) => {
                      const status = statusMap[shift.status] || statusMap.scheduled;
                      return (
                        <tr
                          key={shift.id}
                          className="border-b border-zinc-100 transition-colors last:border-b-0 hover:bg-zinc-50/60"
                        >
                          <td className="px-5 py-3.5">
                            <p className="text-sm font-bold text-zinc-900">
                              {shift.staff?.full_name || "Không rõ nhân viên"}
                            </p>
                            <p className="mt-0.5 text-[11px] font-mono text-zinc-500">
                              {shift.staff?.phone || "Chưa có SĐT"}
                            </p>
                          </td>
                          <td className="px-3 py-3.5">
                            <p className="text-xs font-bold text-zinc-800">{shift.shift_date}</p>
                            <p className="mt-1 text-[11px] text-zinc-500">
                              {shift.shift_name || "Ca làm"}
                            </p>
                          </td>
                          <td className="px-3 py-3.5">
                            <p className="text-xs font-bold text-zinc-800">
                              {(shift.start_time || "").slice(0, 5)} - {(shift.end_time || "").slice(0, 5)}
                            </p>
                            <p className="mt-1 max-w-[170px] truncate text-[11px] text-zinc-400">
                              {shift.note || "Không có ghi chú"}
                            </p>
                          </td>
                          <td className="px-3 py-3.5 text-[11px] text-zinc-500">
                            <p>Vào: {shift.check_in_time || "--"}</p>
                            <p className="mt-1">Ra: {shift.check_out_time || "--"}</p>
                          </td>
                          <td className="px-3 py-3.5">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${status.className}`}>
                              {status.label}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex justify-end gap-1.5">
                              {shift.status === "scheduled" && (
                                <button
                                  type="button"
                                  onClick={() => handleCheckIn(shift)}
                                  className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50"
                                  title="Điểm danh vào ca"
                                >
                                  <LogIn className="h-4 w-4" />
                                </button>
                              )}
                              {shift.status === "working" && (
                                <button
                                  type="button"
                                  onClick={() => handleCheckOut(shift)}
                                  className="rounded-lg p-2 text-amber-600 hover:bg-amber-50"
                                  title="Điểm danh ra ca"
                                >
                                  <LogOut className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleEdit(shift)}
                                className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                                title="Sửa ca"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(shift)}
                                className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                                title="Xóa ca"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-zinc-100 px-5 py-3">
              <button
                type="button"
                disabled={(pagination.current_page || 1) <= 1}
                onClick={() => fetchShifts((pagination.current_page || 1) - 1)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-bold text-zinc-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Trước
              </button>
              <span className="text-xs font-semibold text-zinc-400">
                Trang {pagination.current_page || 1}/{pagination.last_page || 1}
              </span>
              <button
                type="button"
                disabled={(pagination.current_page || 1) >= (pagination.last_page || 1)}
                onClick={() => fetchShifts((pagination.current_page || 1) + 1)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-bold text-zinc-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Sau
              </button>
            </div>
          </div>
        </section>

        <aside className="xl:col-span-4">
          <form onSubmit={handleSubmit} className="rounded-xl border border-zinc-200/70 bg-white p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-zinc-900">
                  {isEditing ? "Cập nhật ca" : "Xếp ca mới"}
                </h3>
                <p className="mt-1 text-[11px] font-medium text-zinc-400">
                  Chọn nhân viên và khung giờ trực
                </p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-lime-100 text-lime-700">
                <Plus className="h-5 w-5" />
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-bold text-zinc-500">
                  Nhân viên *
                </label>
                <select
                  required
                  value={form.staff_id}
                  onChange={(event) => setForm({ ...form, staff_id: event.target.value })}
                  className={inputClass}
                >
                  <option value="">Chọn nhân viên</option>
                  {staffs.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.full_name} - {staff.phone}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold text-zinc-500">
                    Ngày trực *
                  </label>
                  <input
                    required
                    type="date"
                    value={form.shift_date}
                    onChange={(event) => setForm({ ...form, shift_date: event.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold text-zinc-500">
                    Tên ca
                  </label>
                  <select
                    value={form.shift_name}
                    onChange={(event) => handlePresetChange(event.target.value)}
                    className={inputClass}
                  >
                    <option value="Ca sáng">Ca sáng</option>
                    <option value="Ca chiều">Ca chiều</option>
                    <option value="Ca tối">Ca tối</option>
                    <option value="Ca linh hoạt">Ca linh hoạt</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold text-zinc-500">
                    Bắt đầu *
                  </label>
                  <input
                    required
                    type="time"
                    value={form.start_time}
                    onChange={(event) => setForm({ ...form, start_time: event.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold text-zinc-500">
                    Kết thúc *
                  </label>
                  <input
                    required
                    type="time"
                    value={form.end_time}
                    onChange={(event) => setForm({ ...form, end_time: event.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-bold text-zinc-500">
                  Trạng thái
                </label>
                <select
                  value={form.status}
                  onChange={(event) => setForm({ ...form, status: event.target.value })}
                  className={inputClass}
                >
                  {Object.entries(statusMap).map(([value, meta]) => (
                    <option key={value} value={value}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-bold text-zinc-500">
                  Ghi chú bàn giao
                </label>
                <textarea
                  value={form.note}
                  onChange={(event) => setForm({ ...form, note: event.target.value })}
                  className={`${inputClass} min-h-[92px] resize-none`}
                  placeholder="Nội dung cần bàn giao, lưu ý trong ca..."
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 py-2.5 text-xs font-black text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Đang lưu..." : isEditing ? "Lưu thay đổi" : "Tạo ca làm"}
                </button>
                {isEditing && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-lg border border-zinc-200 px-4 py-2.5 text-xs font-bold text-zinc-600 hover:bg-zinc-50"
                  >
                    Hủy
                  </button>
                )}
              </div>
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
};

export default StaffShiftManager;
