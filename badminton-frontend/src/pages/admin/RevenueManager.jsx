import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { adminPaymentService } from "../../services/admin/paymentService";

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

const formatDateTime = (value) => {
  if (!value) return "—";

  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getPaymentMethodLabel = (method) => {
  const labels = {
    cash: "Tiền mặt",
    bank_transfer: "Chuyển khoản",
    sepay: "SePay",
    online: "Online",
  };

  return labels[method] || method || "Không rõ";
};

const getPaymentMethodStyle = (method) => {
  if (method === "cash") {
    return "badge-warning";
  }

  if (["bank_transfer", "sepay", "online"].includes(method)) {
    return "badge-success";
  }

  return "badge-neutral";
};

const getStatusStyle = (status) => {
  if (status === "success") {
    return "badge-success";
  }

  if (status === "failed") {
    return "badge-error";
  }

  return "badge-neutral";
};

const StatCard = ({ label, value, sub, icon, color = "text-zinc-900" }) => (
  <div className="admin-card p-5">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="admin-stat-label">
          {label}
        </p>

        <h3 className={`admin-stat-value mt-1 ${color}`}>{value}</h3>

        {sub && (
          <p className="text-[10px] font-medium text-zinc-400 mt-1">{sub}</p>
        )}
      </div>

      <div className="w-11 h-11 rounded-xl bg-zinc-50 flex items-center justify-center text-xl">
        {icon}
      </div>
    </div>
  </div>
);

const RevenueManager = () => {
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState(null);

  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    per_page: 10,
    total: 0,
    from: 0,
    to: 0,
  });

  const [filters, setFilters] = useState({
    keyword: "",
    payment_method: "",
    status: "success",
    from_date: getFirstDayOfMonth(),
    to_date: getToday(),
  });

  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [selectedPayment, setSelectedPayment] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const fetchRevenueData = async () => {
    setIsLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const [paymentRes, summaryRes] = await Promise.all([
        adminPaymentService.getPayments({
          page,
          per_page: pagination.per_page,
          ...filters,
        }),
        adminPaymentService.getRevenueSummary({
          from_date: filters.from_date,
          to_date: filters.to_date,
        }),
      ]);

      const paymentData = paymentRes.data?.data || {};
      const summaryData = summaryRes.data?.data || {};

      setPayments(paymentData.data || []);
      setPagination({
        current_page: paymentData.current_page || 1,
        last_page: paymentData.last_page || 1,
        per_page: paymentData.per_page || 10,
        total: paymentData.total || 0,
        from: paymentData.from || 0,
        to: paymentData.to || 0,
      });

      setSummary(summaryData);
    } catch (error) {
      console.error("Lỗi tải doanh thu:", error);
      setMessage({
        type: "error",
        text:
          error.response?.data?.message || "Không thể tải dữ liệu doanh thu.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRevenueData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleApplyFilter = () => {
    setPage(1);

    if (page === 1) {
      fetchRevenueData();
    }
  };

  const handleResetFilter = () => {
    setFilters({
      keyword: "",
      payment_method: "",
      status: "success",
      from_date: getFirstDayOfMonth(),
      to_date: getToday(),
    });

    setPage(1);

    setTimeout(() => {
      fetchRevenueData();
    }, 0);
  };

  const handleOpenDetail = async (paymentId) => {
    setIsDetailOpen(true);
    setIsDetailLoading(true);
    setSelectedPayment(null);

    try {
      const res = await adminPaymentService.getPaymentDetail(paymentId);
      setSelectedPayment(res.data?.data || null);
    } catch (error) {
      alert(
        error.response?.data?.message || "Không thể tải chi tiết giao dịch.",
      );
      setIsDetailOpen(false);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const revenueByMethod = useMemo(() => {
    return summary?.revenue_by_method || [];
  }, [summary]);

  const maxMethodRevenue = useMemo(() => {
    if (revenueByMethod.length === 0) return 0;

    return Math.max(
      ...revenueByMethod.map((item) => Number(item.total_amount || 0)),
    );
  }, [revenueByMethod]);

  return (
    <div className="max-w-[1500px] mx-auto space-y-6">
      {/* TIÊU ĐỀ */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="admin-page-title text-2xl">
            Quản lý doanh thu
          </h2>
          <p className="admin-page-subtitle text-sm mt-1">
            Theo dõi giao dịch thanh toán, doanh thu tiền mặt và chuyển khoản.
          </p>
        </div>

        <button
          onClick={fetchRevenueData}
          className="admin-btn-secondary px-4 py-2.5 rounded-xl text-xs"
        >
          Làm mới dữ liệu
        </button>
      </div>

      {/* THÔNG BÁO (TOAST) */}
      <AnimatePresence>
        {message.text && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`p-3 rounded-xl text-xs font-semibold ${
              message.type === "error"
                ? "bg-red-50 text-red-600 border border-red-100"
                : "bg-emerald-50 text-emerald-700 border border-emerald-100"
            }`}
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* FILTER */}
      <div className="admin-card p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
          <div className="xl:col-span-2">
            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1.5">
              Tìm kiếm
            </label>
            <input
              type="text"
              value={filters.keyword}
              onChange={(e) => handleFilterChange("keyword", e.target.value)}
              placeholder="Mã thanh toán, mã đơn, tên, SĐT..."
              className="admin-input w-full px-3.5 py-2.5 text-xs rounded-xl"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1.5">
              Từ ngày
            </label>
            <input
              type="date"
              value={filters.from_date}
              onChange={(e) => handleFilterChange("from_date", e.target.value)}
              className="admin-input w-full px-3.5 py-2.5 text-xs rounded-xl"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1.5">
              Đến ngày
            </label>
            <input
              type="date"
              value={filters.to_date}
              onChange={(e) => handleFilterChange("to_date", e.target.value)}
              className="admin-input w-full px-3.5 py-2.5 text-xs rounded-xl"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1.5">
              Phương thức
            </label>
            <select
              value={filters.payment_method}
              onChange={(e) =>
                handleFilterChange("payment_method", e.target.value)
              }
              className="admin-input w-full px-3.5 py-2.5 text-xs rounded-xl"
            >
              <option value="">Tất cả</option>
              <option value="cash">Tiền mặt</option>
              <option value="bank_transfer">Chuyển khoản</option>
              <option value="sepay">SePay</option>
              <option value="online">Online</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1.5">
              Trạng thái
            </label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange("status", e.target.value)}
              className="admin-input w-full px-3.5 py-2.5 text-xs rounded-xl"
            >
              <option value="">Tất cả</option>
              <option value="success">Thành công</option>
              <option value="failed">Thất bại</option>
              <option value="pending">Đang xử lý</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-2 mt-4">
          <button
            onClick={handleResetFilter}
            className="admin-btn-outline px-4 py-2.5 rounded-xl text-xs font-bold"
          >
            Đặt lại
          </button>

          <button
            onClick={handleApplyFilter}
            className="admin-btn-primary px-4 py-2.5 rounded-xl text-xs font-extrabold"
          >
            Lọc doanh thu
          </button>
        </div>

        <p className="text-[10px] text-zinc-400 mt-3">
          Ghi chú: phần thống kê tổng hiện tính theo khoảng ngày và các giao
          dịch có trạng thái thành công.
        </p>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Tổng doanh thu"
          value={formatMoney(summary?.total_revenue)}
          sub={`Từ ${filters.from_date || "—"} đến ${filters.to_date || "—"}`}
          icon="💰"
          color="text-zinc-900"
        />

        <StatCard
          label="Số giao dịch"
          value={Number(summary?.total_transactions || 0).toLocaleString(
            "vi-VN",
          )}
          sub="Giao dịch thành công"
          icon="🧾"
          color="text-blue-600"
        />

        <StatCard
          label="Tiền mặt"
          value={formatMoney(summary?.cash_revenue)}
          sub="Lễ tân xác nhận tại quầy"
          icon="💵"
          color="text-amber-600"
        />

        <StatCard
          label="Chuyển khoản"
          value={formatMoney(summary?.bank_revenue)}
          sub="SePay / chuyển khoản / online"
          icon="🏦"
          color="text-emerald-600"
        />
      </div>

      {/* METHOD SUMMARY + TABLE */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* BIỂU ĐỒ ĐƠN GIẢN */}
        <div className="admin-card p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-extrabold text-zinc-900">
                Doanh thu theo phương thức
              </h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Dựa trên bảng payments.
              </p>
            </div>
          </div>

          {revenueByMethod.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-400">
              Chưa có dữ liệu doanh thu.
            </div>
          ) : (
            <div className="space-y-4">
              {revenueByMethod.map((item) => {
                const amount = Number(item.total_amount || 0);
                const percent =
                  maxMethodRevenue > 0
                    ? Math.max((amount / maxMethodRevenue) * 100, 5)
                    : 0;

                return (
                  <div key={item.payment_method}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-bold text-zinc-600">
                        {getPaymentMethodLabel(item.payment_method)}
                      </span>

                      <span className="text-xs font-extrabold text-zinc-900">
                        {formatMoney(amount)}
                      </span>
                    </div>

                    <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-500 rounded-full"
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    <p className="text-[10px] text-zinc-400 mt-1">
                      {Number(item.total_transactions || 0)} giao dịch
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* TABLE */}
        <div className="xl:col-span-2 admin-card overflow-hidden">
          <div className="p-5 border-b border-zinc-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-zinc-900">
                Lịch sử giao dịch
              </h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Hiển thị {pagination.from || 0} - {pagination.to || 0} trên{" "}
                {pagination.total || 0} giao dịch.
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="p-16 text-center">
              <div className="inline-block w-6 h-6 border-2 border-zinc-300 border-t-zinc-800 rounded-full animate-spin mb-3" />
              <p className="text-xs text-zinc-400">
                Đang tải dữ liệu doanh thu...
              </p>
            </div>
          ) : payments.length === 0 ? (
            <div className="p-16 text-center">
              <p className="text-3xl mb-2 opacity-30">📭</p>
              <p className="text-sm text-zinc-400">
                Không có giao dịch nào phù hợp.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[950px]">
                  <thead>
                    <tr className="bg-zinc-50/80 border-b border-zinc-100 text-[10px] uppercase tracking-wider text-zinc-400">
                      <th className="text-left py-3 px-5">Giao dịch</th>
                      <th className="text-left py-3 px-3">Đơn sân</th>
                      <th className="text-left py-3 px-3">Khách hàng</th>
                      <th className="text-right py-3 px-3">Số tiền</th>
                      <th className="text-center py-3 px-3">Phương thức</th>
                      <th className="text-center py-3 px-3">Trạng thái</th>
                      <th className="text-right py-3 px-5">Thao tác</th>
                    </tr>
                  </thead>

                  <tbody>
                    {payments.map((payment) => (
                      <tr
                        key={payment.id}
                        className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50/50 transition-colors"
                      >
                        <td className="py-3.5 px-5">
                          <p className="text-xs font-extrabold text-zinc-900">
                            {payment.payment_code}
                          </p>
                          <p className="text-[11px] text-zinc-400 mt-0.5">
                            {formatDateTime(payment.paid_at)}
                          </p>
                          {payment.reference_code && (
                            <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                              REF: {payment.reference_code}
                            </p>
                          )}
                        </td>

                        <td className="py-3.5 px-3">
                          <p className="text-xs font-bold text-zinc-800">
                            {payment.booking?.booking_code || "—"}
                          </p>
                          <p className="text-[10px] text-zinc-400 mt-0.5">
                            Bill: {formatMoney(payment.booking?.total_price)}
                          </p>
                        </td>

                        <td className="py-3.5 px-3">
                          <p className="text-xs font-bold text-zinc-800">
                            {payment.user?.full_name || "Khách vãng lai"}
                          </p>
                          <p className="text-[11px] text-zinc-400">
                            {payment.user?.phone || payment.user?.email || "—"}
                          </p>
                        </td>

                        <td className="py-3.5 px-3 text-right">
                          <p className="text-sm font-extrabold text-emerald-600">
                            {formatMoney(payment.amount)}
                          </p>
                        </td>

                        <td className="py-3.5 px-3 text-center">
                          <span
                            className={`admin-badge px-3 py-1 text-[10px] ${getPaymentMethodStyle(payment.payment_method)}`}
                          >
                            {getPaymentMethodLabel(payment.payment_method)}
                          </span>
                        </td>

                        <td className="py-3.5 px-3 text-center">
                          <span
                            className={`admin-badge px-3 py-1 text-[10px] ${getStatusStyle(payment.status)}`}
                          >
                            {payment.status === "success"
                              ? "Thành công"
                              : payment.status}
                          </span>
                        </td>

                        <td className="py-3.5 px-5 text-right">
                          <button
                            onClick={() => handleOpenDetail(payment.id)}
                            className="px-3 py-1.5 border border-zinc-200 text-zinc-600 rounded-lg text-[11px] font-bold hover:bg-zinc-50"
                          >
                            Chi tiết
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* PAGINATION */}
              <div className="p-4 border-t border-zinc-100 flex flex-col sm:flex-row justify-between items-center gap-3">
                <p className="text-[11px] text-zinc-400">
                  Trang {pagination.current_page} / {pagination.last_page}
                </p>

                <div className="flex gap-2">
                  <button
                    disabled={pagination.current_page <= 1}
                    onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                    className="px-3 py-2 rounded-lg border border-zinc-200 text-xs font-bold text-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50"
                  >
                    Trước
                  </button>

                  <button
                    disabled={pagination.current_page >= pagination.last_page}
                    onClick={() => setPage((prev) => prev + 1)}
                    className="px-3 py-2 rounded-lg border border-zinc-200 text-xs font-bold text-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50"
                  >
                    Sau
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* CỬA SỔ CHI TIẾT */}
      <AnimatePresence>
        {isDetailOpen && (
          <div
            className="admin-modal-overlay"
            onClick={() => setIsDetailOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="admin-modal-content max-w-2xl"
            >
              <div className="admin-modal-header p-5">
                <div>
                  <h3 className="text-base font-extrabold text-zinc-900">
                    Chi tiết giao dịch
                  </h3>
                  <p className="admin-page-subtitle">
                    Thông tin thanh toán và đơn đặt sân liên quan.
                  </p>
                </div>

                <button
                  onClick={() => setIsDetailOpen(false)}
                  className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                >
                  ✕
                </button>
              </div>

              {isDetailLoading ? (
                <div className="p-12 text-center">
                  <div className="inline-block w-6 h-6 border-2 border-zinc-300 border-t-zinc-800 rounded-full animate-spin mb-3" />
                  <p className="text-xs text-zinc-400">Đang tải chi tiết...</p>
                </div>
              ) : selectedPayment ? (
                <div className="p-5 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-zinc-50 rounded-xl p-4">
                      <p className="text-[11px] font-bold text-zinc-400 uppercase mb-1">
                        Mã thanh toán
                      </p>
                      <p className="text-sm font-extrabold text-zinc-900">
                        {selectedPayment.payment_code}
                      </p>
                    </div>

                    <div className="bg-zinc-50 rounded-xl p-4">
                      <p className="text-[11px] font-bold text-zinc-400 uppercase mb-1">
                        Số tiền
                      </p>
                      <p className="text-sm font-extrabold text-emerald-600">
                        {formatMoney(selectedPayment.amount)}
                      </p>
                    </div>

                    <div className="bg-zinc-50 rounded-xl p-4">
                      <p className="text-[11px] font-bold text-zinc-400 uppercase mb-1">
                        Phương thức
                      </p>
                      <p className="text-sm font-bold text-zinc-800">
                        {getPaymentMethodLabel(selectedPayment.payment_method)}
                      </p>
                    </div>

                    <div className="bg-zinc-50 rounded-xl p-4">
                      <p className="text-[11px] font-bold text-zinc-400 uppercase mb-1">
                        Thời gian thanh toán
                      </p>
                      <p className="text-sm font-bold text-zinc-800">
                        {formatDateTime(selectedPayment.paid_at)}
                      </p>
                    </div>
                  </div>

                  <div className="border border-zinc-100 rounded-xl p-4">
                    <p className="text-[11px] font-bold text-zinc-400 uppercase mb-3">
                      Đơn đặt sân
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-zinc-400">Mã đơn: </span>
                        <strong>
                          {selectedPayment.booking?.booking_code || "—"}
                        </strong>
                      </div>

                      <div>
                        <span className="text-zinc-400">Tổng bill: </span>
                        <strong>
                          {formatMoney(selectedPayment.booking?.total_price)}
                        </strong>
                      </div>

                      <div>
                        <span className="text-zinc-400">Đã thu: </span>
                        <strong>
                          {formatMoney(selectedPayment.booking?.deposit_amount)}
                        </strong>
                      </div>

                      <div>
                        <span className="text-zinc-400">Còn lại: </span>
                        <strong>
                          {formatMoney(
                            selectedPayment.booking?.remaining_amount,
                          )}
                        </strong>
                      </div>

                      <div>
                        <span className="text-zinc-400">Trạng thái đơn: </span>
                        <strong>
                          {selectedPayment.booking?.status || "—"}
                        </strong>
                      </div>

                      <div>
                        <span className="text-zinc-400">Thanh toán: </span>
                        <strong>
                          {selectedPayment.booking?.payment_status || "—"}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="border border-zinc-100 rounded-xl p-4">
                    <p className="text-[11px] font-bold text-zinc-400 uppercase mb-3">
                      Người thanh toán
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-zinc-400">Tên: </span>
                        <strong>
                          {selectedPayment.user?.full_name || "Khách vãng lai"}
                        </strong>
                      </div>

                      <div>
                        <span className="text-zinc-400">SĐT: </span>
                        <strong>{selectedPayment.user?.phone || "—"}</strong>
                      </div>

                      <div className="sm:col-span-2">
                        <span className="text-zinc-400">Email: </span>
                        <strong>{selectedPayment.user?.email || "—"}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="border border-zinc-100 rounded-xl p-4">
                    <p className="text-[11px] font-bold text-zinc-400 uppercase mb-3">
                      Thông tin đối soát
                    </p>

                    <div className="space-y-2 text-xs">
                      <p>
                        <span className="text-zinc-400">
                          Ngân hàng / cổng:{" "}
                        </span>
                        <strong>{selectedPayment.bank_gateway || "—"}</strong>
                      </p>

                      <p>
                        <span className="text-zinc-400">Mã tham chiếu: </span>
                        <strong>{selectedPayment.reference_code || "—"}</strong>
                      </p>

                      <p>
                        <span className="text-zinc-400">
                          SePay transaction ID:{" "}
                        </span>
                        <strong>
                          {selectedPayment.sepay_transaction_id || "—"}
                        </strong>
                      </p>

                      <div>
                        <p className="text-zinc-400 mb-1">
                          Nội dung thanh toán:
                        </p>
                        <div className="bg-zinc-50 rounded-lg p-3 text-[11px] font-mono text-zinc-600 break-all">
                          {selectedPayment.payment_content || "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center text-sm text-zinc-400">
                  Không có dữ liệu chi tiết.
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RevenueManager;
