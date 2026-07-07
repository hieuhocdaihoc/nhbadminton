import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { adminUserService } from "../../services/admin/adminUserService";

const StaffManager = () => {
  const [staffs, setStaffs] = useState([]);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [form, setForm] = useState({
    id: null,
    full_name: "",
    email: "",
    phone: "",
    password: "",
    gender: "",
    date_of_birth: "",
    status: "active",
  });
  const [isEditing, setIsEditing] = useState(false);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailUser, setDetailUser] = useState(null);

  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetUser, setResetUser] = useState(null);
  const [resetForm, setResetForm] = useState({
    password: "",
    password_confirmation: "",
  });

  const fetchStaffs = async (
    page = 1,
    customSearch = search,
    customStatus = statusFilter,
  ) => {
    setIsLoading(true);

    try {
      const params = {
        page,
        per_page: 10,
      };

      if (customSearch.trim() !== "") {
        params.search = customSearch.trim();
      }

      if (customStatus !== "") {
        params.status = customStatus;
      }

      const response = await adminUserService.getStaffs(params);

      setStaffs(response.data?.data?.data || []);
      setPagination({
        current_page: response.data?.data?.current_page || 1,
        last_page: response.data?.data?.last_page || 1,
      });
    } catch (error) {
      setMessage({ type: "error", text: "Không thể tải danh sách nhân viên." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStaffs(1, search, statusFilter);
    }, 500);
    return () => clearTimeout(timer);
  }, [search, statusFilter]);

  const handleEditClick = (user) => {
    setIsEditing(true);
    setForm({
      id: user.id,
      full_name: user.full_name || "",
      email: user.email || "",
      phone: user.phone || "",
      password: "",
      gender: user.gender || "",
      date_of_birth: user.date_of_birth || "",
      status: user.status || "active",
    });
  };

  const resetFormState = () => {
    setIsEditing(false);
    setForm({
      id: null,
      full_name: "",
      email: "",
      phone: "",
      password: "",
      gender: "",
      date_of_birth: "",
      status: "active",
    });
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage({ type: "", text: "" });

    try {
      if (!isEditing) {
        const payload = { ...form, role: "staff" };
        await adminUserService.createUser(payload);
        setMessage({ type: "success", text: "Thêm nhân viên mới thành công!" });
      } else {
        const payload = {
          full_name: form.full_name,
          email: form.email || null,
          phone: form.phone,
          gender: form.gender || null,
          date_of_birth: form.date_of_birth || null,
          status: form.status,
        };
        await adminUserService.updateUser(form.id, payload);
        setMessage({ type: "success", text: "Cập nhật thông tin thành công!" });
      }
      resetFormState();
      fetchStaffs(pagination.current_page);
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Lưu dữ liệu thất bại.",
      });
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage({ type: "", text: "" }), 2500);
    }
  };

  const handleViewDetail = async (id) => {
    try {
      const response = await adminUserService.getUserDetail(id);
      setDetailUser(response.data?.data);
      setIsDetailOpen(true);
    } catch (error) {
      alert("Không thể lấy chi tiết tài khoản.");
    }
  };

  const handleToggleStatus = async (user) => {
    const newStatus = user.status === "active" ? "blocked" : "active";
    if (
      !window.confirm(
        `Bạn có chắc muốn ${newStatus === "blocked" ? "khóa" : "mở khóa"} nhân viên "${user.full_name}"?`,
      )
    )
      return;
    try {
      await adminUserService.updateStatus(user.id, newStatus);
      setMessage({ type: "success", text: "Cập nhật trạng thái thành công!" });
      fetchStaffs(pagination.current_page);
    } catch (error) {
      alert(error.response?.data?.message || "Thao tác thất bại.");
    } finally {
      setTimeout(() => setMessage({ type: "", text: "" }), 2500);
    }
  };

  const handleOpenReset = (user) => {
    setResetUser(user);
    setResetForm({ password: "", password_confirmation: "" });
    setIsResetOpen(true);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage({ type: "", text: "" });
    try {
      await adminUserService.resetPassword(resetUser.id, resetForm);
      setMessage({ type: "success", text: "Đặt lại mật khẩu thành công!" });
      setIsResetOpen(false);
      setResetUser(null);
    } catch (error) {
      alert(error.response?.data?.message || "Reset mật khẩu thất bại.");
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage({ type: "", text: "" }), 2500);
    }
  };

  const totalStaffs = staffs.length;
  const activeStaffs = staffs.filter((user) => user.status === "active").length;

  const inputClass =
    "w-full bg-[#f8f8fa] border border-zinc-200 rounded-lg px-3.5 py-2 text-sm text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200 transition-all";

  return (
    <div className="admin-page-container">
      {/* TIÊU ĐỀ */}
      <div className="admin-page-header">
        <div>
          <h2 className="admin-page-title">
            Quản lý nhân viên
          </h2>
          <p className="admin-page-subtitle">
            Tài khoản nhân sự, phân quyền và mật khẩu
          </p>
        </div>
        <div className="flex gap-2.5">
          <div className="admin-stat-badge badge-default">
            <p className="admin-stat-value val-default">{totalStaffs}</p>
            <p className="admin-stat-label lbl-default">Tổng</p>
          </div>
          <div className="admin-stat-badge badge-success">
            <p className="admin-stat-value val-success">{activeStaffs}</p>
            <p className="admin-stat-label lbl-success">Hoạt động</p>
          </div>
        </div>
      </div>

      {/* THÔNG BÁO (TOAST) */}
      <AnimatePresence>
        {message.text && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`p-3 rounded-lg text-xs font-medium ${message.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-600 border border-red-200"}`}
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* THANH CÔNG CỤ */}
      <div className="admin-card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 sm:max-w-md">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              placeholder="Tìm tên, email, SĐT..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#f8f8fa] border border-zinc-200 rounded-lg text-sm text-zinc-700 outline-none focus:border-zinc-400 transition-all"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#f8f8fa] border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-700 outline-none focus:border-zinc-400"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="active">Hoạt động</option>
            <option value="blocked">Bị khóa</option>
          </select>
        </div>
      </div>

      {/* NỘI DUNG CHÍNH: LƯỚI 8-4 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* BẢNG (TRÁI) */}
        <div className="lg:col-span-8 admin-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-zinc-50/60 border-b border-zinc-100 text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-5" style={{ width: "240px" }}>
                    Nhân viên
                  </th>
                  <th className="py-3 px-3" style={{ width: "120px" }}>
                    SĐT
                  </th>
                  <th className="py-3 px-3" style={{ width: "100px" }}>
                    Giới tính
                  </th>
                  <th
                    className="py-3 px-3 text-center"
                    style={{ width: "100px" }}
                  >
                    Trạng thái
                  </th>
                  <th
                    className="py-3 px-5 text-right"
                    style={{ width: "160px" }}
                  >
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan="5" className="py-16 text-center">
                      <div className="inline-block w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
                    </td>
                  </tr>
                ) : staffs.length === 0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="py-16 text-center text-xs text-zinc-400"
                    >
                      Không tìm thấy nhân viên nào
                    </td>
                  </tr>
                ) : (
                  staffs.map((user) => {
                    const isActive = user.status === "active";
                    return (
                      <tr
                        key={user.id}
                        className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50/40 transition-colors group"
                      >
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-500 font-semibold shrink-0">
                              {user.full_name?.charAt(0)?.toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p
                                className={`text-sm font-semibold truncate ${isActive ? "text-zinc-800" : "text-zinc-400 line-through"}`}
                              >
                                {user.full_name}
                              </p>
                              <p className="text-[11px] text-zinc-400 truncate">
                                {user.email || "Chưa có email"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="text-xs font-mono text-zinc-600">
                            {user.phone}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="text-xs text-zinc-500">
                            {user.gender === "male"
                              ? "Nam"
                              : user.gender === "female"
                                ? "Nữ"
                                : "Khác"}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${isActive ? "text-emerald-700 bg-emerald-50" : "text-red-600 bg-red-50"}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-red-400"}`}
                            />
                            {isActive ? "Hoạt động" : "Bị khóa"}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleViewDetail(user.id)}
                              className="admin-btn-outline px-2 py-1 text-[10px]"
                              title="Chi tiết"
                            >
                              Chi tiết
                            </button>
                            <button
                              onClick={() => handleOpenReset(user)}
                              className="admin-btn-outline px-2 py-1 text-[10px] text-amber-600 border-amber-200 hover:bg-amber-50"
                              title="Reset MK"
                            >
                              Key
                            </button>
                            <button
                              onClick={() => handleEditClick(user)}
                              className="admin-btn-outline px-2 py-1 text-[10px] text-blue-600 border-blue-200 hover:bg-blue-50"
                              title="Sửa"
                            >
                              Sửa
                            </button>
                            <button
                              onClick={() => handleToggleStatus(user)}
                              className={`admin-btn-outline px-2 py-1 text-[10px] ${isActive ? "text-red-500 border-red-200 hover:bg-red-50" : "text-emerald-600 border-emerald-200 hover:bg-emerald-50"}`}
                              title={isActive ? "Khóa" : "Mở khóa"}
                            >
                              {isActive ? "Khóa" : "Mở"}
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
          {pagination.last_page > 1 && (
            <div className="px-5 py-3 border-t border-zinc-100 flex justify-between items-center bg-zinc-50/50">
              <span className="text-xs text-zinc-500">
                Trang {pagination.current_page} / {pagination.last_page}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={pagination.current_page === 1}
                  onClick={() => fetchStaffs(pagination.current_page - 1)}
                  className="admin-btn-outline"
                >
                  Trước
                </button>
                <button
                  disabled={pagination.current_page === pagination.last_page}
                  onClick={() => fetchStaffs(pagination.current_page + 1)}
                  className="admin-btn-outline"
                >
                  Tiếp
                </button>
              </div>
            </div>
          )}
        </div>

        {/* BIỂU MẪU (PHẢI) */}
        <div className="lg:col-span-4 admin-card p-5 sticky top-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-100">
            <h3 className="text-sm font-semibold text-zinc-800">
              {isEditing ? "Sửa nhân viên" : "Thêm nhân viên"}
            </h3>
            {isEditing && (
              <button
                onClick={resetFormState}
                className="text-[10px] font-medium text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                Hủy sửa
              </button>
            )}
          </div>

          <form onSubmit={handleSubmitForm} className="space-y-4">
            <div>
              <label className="admin-form-label">
                Họ tên *
              </label>
              <input
                type="text"
                required
                value={form.full_name}
                onChange={(e) =>
                  setForm({ ...form, full_name: e.target.value })
                }
                className={inputClass}
                placeholder="Nguyễn Văn A"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="admin-form-label">
                  SĐT *
                </label>
                <input
                  type="text"
                  required
                  pattern="0[35789][0-9]{8}"
                  title="Số điện thoại Việt Nam 10 số, bắt đầu bằng 03, 05, 07, 08 hoặc 09"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={inputClass}
                  placeholder="0987..."
                />
              </div>
              <div>
                <label className="admin-form-label">
                  Trạng thái
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className={inputClass}
                >
                  <option value="active">Hoạt động</option>
                  <option value="blocked">Khóa</option>
                </select>
              </div>
            </div>

            <div>
              <label className="admin-form-label">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputClass}
                placeholder="nhanvien@domain.com"
              />
            </div>

            {!isEditing && (
              <div>
                <label className="admin-form-label">
                  Mật khẩu cấp phát *
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  className={inputClass}
                  placeholder="••••••••"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="admin-form-label">
                  Giới tính
                </label>
                <select
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Chưa rõ</option>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                  <option value="other">Khác</option>
                </select>
              </div>
              <div>
                <label className="admin-form-label">
                  Ngày sinh
                </label>
                <input
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) =>
                    setForm({ ...form, date_of_birth: e.target.value })
                  }
                  className={inputClass}
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSaving || !form.full_name.trim()}
                className={`w-full py-2.5 ${isEditing ? "admin-btn-secondary" : "admin-btn-primary"} ${isSaving || !form.full_name.trim() ? "opacity-60 cursor-not-allowed shadow-none hover:translate-y-0" : ""}`}
              >
                {isSaving
                  ? "Đang xử lý..."
                  : isEditing
                    ? "Lưu thay đổi"
                    : "Tạo nhân viên"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* CÁC CỬA SỔ (MODALS) */}
      <AnimatePresence>
        {/* CỬA SỔ CHI TIẾT */}
        {isDetailOpen && detailUser && (
          <div className="admin-modal-overlay">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="admin-modal-content max-w-sm"
            >
              <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-800">
                  Hồ sơ nhân viên
                </h3>
                <button
                  onClick={() => setIsDetailOpen(false)}
                  className="text-zinc-400 hover:text-zinc-600"
                >
                  ✕
                </button>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-500 text-xl font-bold">
                    {detailUser.full_name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-zinc-800">
                      {detailUser.full_name}
                    </h4>
                    <p className="text-xs text-zinc-500">
                      {detailUser.role === "staff"
                        ? "Nhân viên hệ thống"
                        : "Quản trị viên"}
                    </p>
                  </div>
                </div>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between border-b border-zinc-50 pb-2">
                    <span className="text-zinc-500">Email</span>
                    <span className="font-medium text-zinc-800">
                      {detailUser.email || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-50 pb-2">
                    <span className="text-zinc-500">SĐT</span>
                    <span className="font-medium text-zinc-800 font-mono">
                      {detailUser.phone}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-50 pb-2">
                    <span className="text-zinc-500">Giới tính</span>
                    <span className="font-medium text-zinc-800">
                      {detailUser.gender === "male"
                        ? "Nam"
                        : detailUser.gender === "female"
                          ? "Nữ"
                          : "Khác"}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-50 pb-2">
                    <span className="text-zinc-500">Ngày sinh</span>
                    <span className="font-medium text-zinc-800">
                      {detailUser.date_of_birth
                        ? new Date(detailUser.date_of_birth).toLocaleDateString(
                            "vi-VN",
                          )
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* CỬA SỔ ĐẶT LẠI MẬT KHẨU */}
        {isResetOpen && resetUser && (
          <div className="admin-modal-overlay">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="admin-modal-content max-w-sm"
            >
              <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-800">
                  Cấp lại mật khẩu
                </h3>
                <button
                  onClick={() => setIsResetOpen(false)}
                  className="text-zinc-400 hover:text-zinc-600"
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleResetPassword} className="p-6 space-y-4">
                <div className="bg-amber-50 text-amber-700 text-[11px] p-3 rounded-lg border border-amber-100 mb-2">
                  Đang đổi mật khẩu cho tài khoản:{" "}
                  <strong>{resetUser.full_name}</strong>
                </div>
                <div>
                  <label className="admin-form-label">
                    Mật khẩu mới *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={resetForm.password}
                    onChange={(e) =>
                      setResetForm({ ...resetForm, password: e.target.value })
                    }
                    className={inputClass}
                    placeholder="Nhập ít nhất 6 ký tự"
                  />
                </div>
                <div>
                  <label className="admin-form-label">
                    Xác nhận mật khẩu *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={resetForm.password_confirmation}
                    onChange={(e) =>
                      setResetForm({
                        ...resetForm,
                        password_confirmation: e.target.value,
                      })
                    }
                    className={inputClass}
                    placeholder="Nhập lại mật khẩu"
                  />
                </div>
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={
                      isSaving ||
                      resetForm.password !== resetForm.password_confirmation
                    }
                    className={`w-full py-2.5 admin-btn-primary bg-amber-500 hover:bg-amber-600 border-amber-600 ${isSaving || resetForm.password !== resetForm.password_confirmation ? "opacity-60 cursor-not-allowed shadow-none hover:translate-y-0" : ""}`}
                  >
                    {isSaving ? "Đang xử lý..." : "Xác nhận cấp lại"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StaffManager;
