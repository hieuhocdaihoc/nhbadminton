/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Percent, Plus, Search, TicketPercent } from "lucide-react";
import { adminPromotionService } from "../../services/admin/promotionService";

const emptyForm = {
  id: null,
  code: "",
  name: "",
  discount_type: "fixed",
  discount_value: "",
  per_user_limit: 1,
  min_points_required: 0,
  status: "active",
};

const formatDiscount = (promotion) => {
  if (promotion.discount_type === "percent") {
    return `${Number(promotion.discount_value || 0).toLocaleString("vi-VN")}%`;
  }

  return `${Number(promotion.discount_value || 0).toLocaleString("vi-VN")}đ`;
};

const PromotionManager = () => {
  const [promotions, setPromotions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm] = useState(emptyForm);

  const isEditing = Boolean(form.id);

  const filteredPromotions = useMemo(() => promotions, [promotions]);

  const fetchPromotions = async () => {
    setIsLoading(true);
    try {
      const response = await adminPromotionService.getPromotions({
        keyword,
        status: statusFilter,
      });
      setPromotions(response.data?.data || []);
    } catch {
      setMessage({
        type: "error",
        text: "Không thể tải danh sách mã giảm giá.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPromotions();
  }, []);

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 2500);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsProcessing(true);

    const payload = {
      ...form,
      code: form.code.trim().toUpperCase(),
      discount_value: Number(form.discount_value),
      per_user_limit: Number(form.per_user_limit || 1),
      min_points_required: Number(form.min_points_required || 0),
    };

    try {
      if (isEditing) {
        await adminPromotionService.updatePromotion(form.id, payload);
        showMessage("success", "Cập nhật voucher thành công.");
      } else {
        await adminPromotionService.createPromotion(payload);
        showMessage("success", "Tạo voucher thành công.");
      }

      setForm(emptyForm);
      fetchPromotions();
    } catch (error) {
      showMessage(
        "error",
        error.response?.data?.message || "Thao tác thất bại.",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEdit = (promotion) => {
    setForm({
      id: promotion.id,
      code: promotion.code || "",
      name: promotion.name || "",
      discount_type: promotion.discount_type || "fixed",
      discount_value: promotion.discount_value || "",
      per_user_limit: promotion.per_user_limit || 1,
      min_points_required: promotion.min_points_required || 0,
      status: promotion.status || "active",
    });
  };

  const handleHide = async (promotion) => {
    if (!window.confirm(`Tạm ẩn mã ${promotion.code}?`)) return;

    try {
      await adminPromotionService.deletePromotion(promotion.id);
      showMessage("success", "Đã tạm ẩn voucher.");
      fetchPromotions();
    } catch {
      showMessage("error", "Không thể tạm ẩn voucher.");
    }
  };

  const inputClass = "admin-input w-full px-3.5 py-2.5 text-sm";

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="admin-page-title text-2xl">
            Mã giảm giá
          </h2>
          <p className="admin-page-subtitle text-sm mt-1">
            Tạo voucher cho khách nhập khi đặt sân.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setForm(emptyForm)}
          className="admin-btn-secondary flex items-center gap-2 px-4 py-2.5 text-xs font-bold"
        >
          <Plus className="h-4 w-4" />
          Tạo mã mới
        </button>
      </div>

      <AnimatePresence>
        {message.text && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`rounded-lg border px-4 py-3 text-xs font-semibold ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-600"
            }`}
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        <div className="admin-card overflow-hidden lg:col-span-8">
          <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 p-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                onKeyDown={(event) =>
                  event.key === "Enter" && fetchPromotions()
                }
                placeholder="Tìm theo mã hoặc tên chương trình"
                className="admin-input h-10 w-full pl-9 pr-3 text-sm"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="admin-input h-10 px-3 text-sm"
            >
              <option value="">Tất cả</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Tạm ẩn</option>
            </select>
            <button
              type="button"
              onClick={fetchPromotions}
              className="admin-btn-primary px-4 h-10 text-xs font-black uppercase"
            >
              Lọc
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-slate-100 bg-white text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-3">Voucher</th>
                  <th className="px-3 py-3">Giá trị</th>
                  <th className="px-3 py-3">Điều kiện</th>
                  <th className="px-3 py-3 text-center">Trạng thái</th>
                  <th className="px-5 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan="5" className="py-16 text-center">
                      <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                    </td>
                  </tr>
                ) : filteredPromotions.length === 0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="py-16 text-center text-xs font-semibold text-slate-400"
                    >
                      Chưa có voucher nào
                    </td>
                  </tr>
                ) : (
                  filteredPromotions.map((promotion) => (
                    <tr
                      key={promotion.id}
                      className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                            <TicketPercent className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-mono text-sm font-black text-slate-900">
                              {promotion.code}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {promotion.name}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-sm font-black text-slate-900">
                        {formatDiscount(promotion)}
                      </td>
                      <td className="px-3 py-4 text-xs text-slate-500">
                        <p>{promotion.per_user_limit || 1} lượt / khách</p>
                        <p>
                          Tối thiểu{" "}
                          {Number(
                            promotion.min_points_required || 0,
                          ).toLocaleString("vi-VN")}{" "}
                          điểm
                        </p>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <span
                          className={`admin-badge px-3 py-1 text-[10px] ${
                            promotion.status === "active"
                              ? "badge-success"
                              : "badge-neutral"
                          }`}
                        >
                          {promotion.status === "active"
                            ? "Hoạt động"
                            : "Tạm ẩn"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleEdit(promotion)}
                          className="admin-btn-outline px-2.5 py-1 mr-2 text-[10px]"
                        >
                          Sửa
                        </button>
                        {promotion.status === "active" && (
                          <button
                            type="button"
                            onClick={() => handleHide(promotion)}
                            className="admin-btn-danger px-2.5 py-1 text-[10px]"
                          >
                            Ẩn
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="sticky top-5 admin-card p-5 lg:col-span-4"
        >
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-900">
              {isEditing ? "Sửa voucher" : "Tạo voucher"}
            </h3>
            {isEditing && (
              <button
                type="button"
                onClick={() => setForm(emptyForm)}
                className="text-xs font-bold text-slate-400 hover:text-slate-700"
              >
                Hủy
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold text-slate-500">
                Mã code *
              </label>
              <input
                required
                value={form.code}
                onChange={(event) =>
                  setForm({ ...form, code: event.target.value.toUpperCase() })
                }
                className={`${inputClass} font-mono uppercase`}
                placeholder="VD: GIAM20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-bold text-slate-500">
                Tên chương trình *
              </label>
              <input
                required
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                className={inputClass}
                placeholder="Ưu đãi cuối tuần"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[11px] font-bold text-slate-500">
                  Kiểu giảm
                </label>
                <select
                  value={form.discount_type}
                  onChange={(event) =>
                    setForm({ ...form, discount_type: event.target.value })
                  }
                  className={inputClass}
                >
                  <option value="fixed">Giảm tiền</option>
                  <option value="percent">Giảm %</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-bold text-slate-500">
                  Giá trị *
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  value={form.discount_value}
                  onChange={(event) =>
                    setForm({ ...form, discount_value: event.target.value })
                  }
                  className={inputClass}
                  placeholder={
                    form.discount_type === "percent" ? "20" : "50000"
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[11px] font-bold text-slate-500">
                  Lượt/khách
                </label>
                <input
                  type="number"
                  min="1"
                  value={form.per_user_limit}
                  onChange={(event) =>
                    setForm({ ...form, per_user_limit: event.target.value })
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-bold text-slate-500">
                  Điểm tối thiểu
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.min_points_required}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      min_points_required: event.target.value,
                    })
                  }
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-bold text-slate-500">
                Trạng thái
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["active", "Hoạt động"],
                  ["inactive", "Tạm ẩn"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm({ ...form, status: value })}
                    className={`rounded-lg border py-2 text-xs font-bold ${
                      form.status === value
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-transparent bg-slate-50 text-slate-400"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="submit"
              disabled={isProcessing}
              className="admin-btn-primary flex w-full items-center justify-center gap-2 py-3 text-xs font-black uppercase disabled:opacity-60"
            >
              <Percent className="h-4 w-4" />
              {isProcessing
                ? "Đang lưu..."
                : isEditing
                  ? "Lưu thay đổi"
                  : "Tạo voucher"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PromotionManager;
