import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { membershipService } from "../../services/admin/membershipService";
import axiosClient from "../../services/axiosClient";
import { toast } from "../../utils/toast";

// ─── Helpers ─────────────────────────────────────────────
const fmt = (n) =>
  n != null ? Number(n).toLocaleString("vi-VN") + "đ" : "—";

const STATUS_LABEL = {
  active: { text: "Đang dùng", cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  pending_payment: { text: "Chờ TT", cls: "bg-amber-50 text-amber-700 border border-amber-200" },
  expired: { text: "Hết hạn", cls: "bg-zinc-100 text-zinc-600 border border-zinc-200" },
  depleted: { text: "Hết ca", cls: "bg-red-50 text-red-700 border border-red-200" },
  cancelled: { text: "Đã hủy", cls: "bg-red-50 text-red-700 border border-red-200" },
};

const Badge = ({ status }) => {
  const s = STATUS_LABEL[status] || { text: status, cls: "bg-zinc-100 text-zinc-600 border border-zinc-200" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${s.cls}`}>
      {s.text}
    </span>
  );
};

// ─── Modal Gói ───────────────────────────────────────────
const PackageModal = ({ pkg, onClose, onSaved }) => {
  const isEdit = !!pkg?.id;
  const [form, setForm] = useState(
    pkg?.id
      ? { ...pkg }
      : {
          name: "",
          description: "",
          total_sessions: "",
          duration_days: "",
          price: "",
          price_per_session: "",
          status: "active",
        }
  );
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await membershipService.updatePackage(pkg.id, form);
        toast.success("Đã cập nhật gói thành viên.");
      } else {
        await membershipService.createPackage(form);
        toast.success("Đã tạo gói thành viên mới.");
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi lưu gói.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-modal-overlay">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="admin-modal-content max-w-lg"
      >
        <div className="p-5 border-b border-zinc-100 flex justify-between items-center">
          <h2 className="text-zinc-900 font-bold text-base">
            {isEdit ? "Sửa gói thành viên" : "Tạo gói thành viên mới"}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 text-lg">✕</button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="admin-form-label">Tên gói</label>
            <input
              required
              value={form.name}
              onChange={set("name")}
              className="admin-input"
              placeholder="VD: Gói 30 ca / 30 ngày"
            />
          </div>

          <div>
            <label className="admin-form-label">Mô tả</label>
            <textarea
              rows={2}
              value={form.description || ""}
              onChange={set("description")}
              className="admin-input resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="admin-form-label">Số ca (giờ)</label>
              <input
                required
                type="number"
                min="1"
                value={form.total_sessions}
                onChange={set("total_sessions")}
                className="admin-input"
              />
            </div>
            <div>
              <label className="admin-form-label">Thời hạn (ngày)</label>
              <input
                required
                type="number"
                min="1"
                value={form.duration_days}
                onChange={set("duration_days")}
                className="admin-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="admin-form-label">Giá gói (đ)</label>
              <input
                required
                type="number"
                min="0"
                placeholder="VD: 1500000"
                value={form.price}
                onChange={set("price")}
                className="admin-input"
              />
            </div>
            <div>
              <label className="admin-form-label">Giá/ca khi dùng thẻ (đ)</label>
              <input
                required
                type="number"
                min="0"
                placeholder="VD: 50000"
                value={form.price_per_session}
                onChange={set("price_per_session")}
                className="admin-input"
              />
            </div>
          </div>

          <div>
            <label className="admin-form-label">Trạng thái</label>
            <select
              value={form.status}
              onChange={set("status")}
              className="admin-input"
            >
              <option value="active">Đang bán</option>
              <option value="inactive">Ngưng bán</option>
            </select>
          </div>

          <div className="flex gap-3 pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              className="admin-btn-secondary flex-1 py-2.5"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="admin-btn-primary flex-1 py-2.5 disabled:opacity-50"
            >
              {saving ? "Đang lưu..." : "Lưu gói"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// ─── Modal Tạo Thẻ ───────────────────────────────────────
export const CreateCardModal = ({ packages, onClose, onSaved }) => {
  const [phoneQuery, setPhoneQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searching, setSearching] = useState(false);
  const [packageId, setPackageId] = useState("");
  const [paymentChannel, setPaymentChannel] = useState("cash");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const searchTimer = useRef(null);
  const selectedPackage = packages.find((pkg) => pkg.id === packageId);

  const searchUsers = (q) => {
    setPhoneQuery(q);
    setSelectedUser(null);
    clearTimeout(searchTimer.current);
    if (q.length < 3) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await axiosClient.get(`/admin/users?search=${encodeURIComponent(q)}&role=customer`);
        setSearchResults(r.data?.data?.data || r.data?.data || []);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 350);
  };

  const selectUser = (u) => {
    setSelectedUser(u);
    setSearchResults([]);
    setPhoneQuery(u.phone);
  };

  const submit = (e) => {
    e.preventDefault();
    if (!selectedUser) { toast.error("Vui lòng chọn khách hàng."); return; }
    if (!packageId) { toast.error("Vui lòng chọn gói."); return; }
    setConfirming(true);
  };

  const confirmCreate = async () => {
    setSaving(true);
    try {
      await membershipService.createCard({
        user_id: selectedUser.id,
        package_id: packageId,
        payment_channel: paymentChannel,
        payment_confirmed: true,
        note,
      });
      toast.success(`Đã tạo và kích hoạt thẻ cho ${selectedUser.full_name}.`);
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi tạo thẻ.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-modal-overlay">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="admin-modal-content max-w-lg"
      >
        <div className="p-5 border-b border-zinc-100 flex justify-between items-center">
          <h2 className="text-zinc-900 font-bold text-base">Tạo thẻ thành viên cho khách</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 text-lg">✕</button>
        </div>

        {confirming ? (
          <div className="p-5 space-y-4">
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 space-y-2">
              <p className="font-bold text-sm text-emerald-900">Xác nhận tạo thẻ</p>
              <p>Khách hàng: <strong>{selectedUser.full_name}</strong> ({selectedUser.phone})</p>
              <p>Gói: <strong>{selectedPackage?.name}</strong></p>
              <p>Tổng số ca: <strong>{selectedPackage?.total_sessions} ca</strong></p>
              <p>Giá gói: <strong>{fmt(selectedPackage?.price)}</strong></p>
              <p>Hình thức thu tiền: <strong>{paymentChannel === "cash" ? "Tiền mặt" : "Chuyển khoản ngoài"}</strong></p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="admin-btn-secondary flex-1 py-2.5"
              >
                Quay lại
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={confirmCreate}
                className="admin-btn-primary flex-1 py-2.5 disabled:opacity-50"
              >
                {saving ? "Đang xử lý..." : "Xác nhận tạo thẻ"}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="p-5 space-y-4">
            <div className="relative">
              <label className="admin-form-label">Tìm khách hàng (SĐT / Tên / Email)</label>
              <input
                required
                value={phoneQuery}
                onChange={(e) => searchUsers(e.target.value)}
                placeholder="Nhập từ 3 ký tự trở lên..."
                className="admin-input"
              />
              {searching && (
                <div className="absolute right-3 top-9 text-xs text-zinc-400">Đang tìm...</div>
              )}
              {searchResults.length > 0 && (
                <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-zinc-200 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-zinc-100">
                  {searchResults.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => selectUser(u)}
                      className="w-full p-2.5 text-left text-xs hover:bg-zinc-50 flex justify-between items-center"
                    >
                      <div>
                        <span className="font-bold text-zinc-800">{u.full_name}</span>
                        <span className="text-zinc-400 ml-2">{u.phone}</span>
                      </div>
                      <span className="text-[10px] text-zinc-400">{u.email}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedUser && (
                <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex justify-between items-center">
                  <span>Khách đã chọn: <strong>{selectedUser.full_name}</strong> ({selectedUser.phone})</span>
                  <button type="button" onClick={() => setSelectedUser(null)} className="text-xs text-red-500 font-bold ml-2">Đổi</button>
                </div>
              )}
            </div>

            <div>
              <label className="admin-form-label">Gói thành viên</label>
              <select
                required
                value={packageId}
                onChange={(e) => setPackageId(e.target.value)}
                className="admin-input"
              >
                <option value="">— Chọn gói —</option>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {fmt(p.price)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="admin-form-label">Hình thức đã nhận tiền</label>
              <select
                value={paymentChannel}
                onChange={(e) => setPaymentChannel(e.target.value)}
                className="admin-input"
              >
                <option value="cash">Tiền mặt</option>
                <option value="bank_transfer">Chuyển khoản ngoài hệ thống</option>
              </select>
            </div>

            <div>
              <label className="admin-form-label">Ghi chú</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="admin-input"
                placeholder="Ghi chú nếu có..."
              />
            </div>

            <div className="flex gap-3 pt-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={onClose}
                className="admin-btn-secondary flex-1 py-2.5"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="admin-btn-primary flex-1 py-2.5"
              >
                Tiếp tục
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
};

// ─── Modal Chi tiết thẻ ──────────────────────────────────
const CardDetailModal = ({ cardId, onClose, onRefresh }) => {
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    membershipService.getCard(cardId).then((r) => {
      setCard(r.data.data);
      setLoading(false);
    });
  }, [cardId]);

  const activate = async () => {
    if (!confirm(`Xác nhận đã nhận được tiền và kích hoạt thẻ ${card.card_code}? Doanh thu ${Number(card.price || 0).toLocaleString("vi-VN")}đ sẽ được ghi nhận.`)) return;
    setActing(true);
    try {
      await membershipService.activateCard(cardId);
      toast.success("Đã kích hoạt thẻ.");
      onRefresh();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi kích hoạt.");
    } finally {
      setActing(false);
    }
  };

  const cancel = async () => {
    if (!confirm(`Hủy thẻ ${card.card_code}? Hành động này không thể hoàn tác.`)) return;
    setActing(true);
    try {
      await membershipService.cancelCard(cardId);
      toast.success("Đã hủy thẻ.");
      onRefresh();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi hủy thẻ.");
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="admin-modal-overlay">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="admin-modal-content max-w-lg max-h-[90vh] flex flex-col"
      >
        <div className="p-5 border-b border-zinc-100 flex justify-between items-center">
          <h2 className="text-zinc-900 font-bold text-base">Chi tiết thẻ thành viên</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 text-lg">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {loading ? (
            <div className="text-zinc-400 text-sm text-center py-8">Đang tải...</div>
          ) : (
            <>
              {/* Thông tin thẻ */}
              <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-200 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-emerald-600 font-extrabold text-lg">{card.card_code}</span>
                  <Badge status={card.status} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-zinc-400">Khách:</span> <strong className="text-zinc-800 ml-1">{card.user_name}</strong></div>
                  <div><span className="text-zinc-400">SĐT:</span> <strong className="text-zinc-800 ml-1">{card.user_phone}</strong></div>
                  <div><span className="text-zinc-400">Gói:</span> <strong className="text-zinc-800 ml-1">{card.package_name}</strong></div>
                  <div><span className="text-zinc-400">Giá thẻ:</span> <strong className="text-zinc-800 ml-1">{fmt(card.price)}</strong></div>
                  <div><span className="text-zinc-400">Hiệu lực:</span> <strong className="text-zinc-800 ml-1">{card.valid_from} – {card.valid_to}</strong></div>
                  <div><span className="text-zinc-400">Giá/ca:</span> <strong className="text-zinc-800 ml-1">{fmt(card.price_per_session)}</strong></div>
                </div>

                {/* Tiến độ ca */}
                <div className="mt-3 pt-3 border-t border-zinc-200">
                  <div className="flex justify-between text-xs font-semibold text-zinc-600 mb-1.5">
                    <span>Ca đã dùng: {card.used_sessions}/{card.total_sessions}</span>
                    <span className="text-emerald-600 font-bold">Còn: {card.remaining_sessions} ca</span>
                  </div>
                  <div className="w-full h-2 bg-zinc-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${(card.used_sessions / card.total_sessions) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Lịch sử sử dụng ca */}
              {card.usages?.length > 0 && (
                <div>
                  <h3 className="text-xs font-extrabold text-zinc-800 mb-2 uppercase tracking-wider">Lịch sử sử dụng ca</h3>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {card.usages.map((u, i) => (
                      <div key={i} className="flex justify-between items-center text-xs p-2 bg-zinc-50 border border-zinc-100 rounded-lg">
                        <span className="text-zinc-700 font-mono">{u.used_at || u.created_at}</span>
                        <span className="text-emerald-700 font-bold">-{u.sessions_deducted} ca</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {card && (
          <div className="p-4 border-t border-zinc-100 flex gap-2">
            {card.status === "pending_payment" && (
              <button
                onClick={activate}
                disabled={acting}
                className="admin-btn-primary flex-1 py-2.5 text-xs disabled:opacity-50"
              >
                Xác nhận đã nhận tiền & kích hoạt
              </button>
            )}
            {card.status !== "cancelled" && card.status !== "expired" && (
              <button
                onClick={cancel}
                disabled={acting}
                className="flex-1 py-2.5 rounded-xl border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                Hủy thẻ
              </button>
            )}
            <button
              onClick={onClose}
              className="admin-btn-secondary flex-1 py-2.5 text-xs"
            >
              Đóng
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

// ─── Tab Gói Thành Viên ──────────────────────────────────
const PackagesTab = () => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalPkg, setModalPkg] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await membershipService.getPackages();
      setPackages(r.data.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const deletePackage = async (pkg) => {
    if (!confirm(`Xóa gói "${pkg.name}"?`)) return;
    try {
      await membershipService.deletePackage(pkg.id);
      toast.success("Đã xóa gói.");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể xóa.");
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-5">
        <p className="text-zinc-500 text-xs font-medium">{packages.length} gói thành viên khả dụng</p>
        <button
          onClick={() => { setModalPkg({}); setShowModal(true); }}
          className="admin-btn-primary px-4 py-2 text-xs font-bold rounded-xl"
        >
          + Tạo gói mới
        </button>
      </div>

      {loading ? (
        <div className="text-zinc-400 text-sm text-center py-12">Đang tải dữ liệu gói...</div>
      ) : packages.length === 0 ? (
        <div className="text-zinc-400 text-sm text-center py-12">Chưa có gói nào. Hãy tạo gói đầu tiên!</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {packages.map((pkg) => (
            <div key={pkg.id} className="admin-card p-5 space-y-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-zinc-900 font-extrabold text-base">{pkg.name}</h3>
                  {pkg.description && (
                    <p className="text-zinc-500 text-xs mt-1 line-clamp-2">{pkg.description}</p>
                  )}
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${pkg.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-zinc-100 text-zinc-500 border-zinc-200"}`}>
                  {pkg.status === "active" ? "Đang bán" : "Ngưng bán"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3.5 text-xs">
                <div className="bg-zinc-50 rounded-xl p-3 text-center border border-zinc-100">
                  <div className="text-emerald-600 font-black text-lg">{pkg.total_sessions}</div>
                  <div className="text-zinc-400 text-[11px] font-medium">ca (giờ)</div>
                </div>
                <div className="bg-zinc-50 rounded-xl p-3 text-center border border-zinc-100">
                  <div className="text-amber-600 font-black text-lg">{pkg.duration_days}</div>
                  <div className="text-zinc-400 text-[11px] font-medium">ngày hiệu lực</div>
                </div>
              </div>

              <div className="space-y-1.5 text-xs pt-1 border-t border-zinc-100">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Giá gói:</span>
                  <span className="text-zinc-900 font-extrabold">{fmt(pkg.price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Giá/ca khi dùng thẻ:</span>
                  <span className="text-emerald-600 font-bold">{fmt(pkg.price_per_session)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Đã bán:</span>
                  <span className="text-zinc-700 font-semibold">{pkg.total_cards_sold || 0} thẻ</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { setModalPkg(pkg); setShowModal(true); }}
                  className="admin-btn-secondary flex-1 py-2 text-xs"
                >
                  Sửa
                </button>
                <button
                  onClick={() => deletePackage(pkg)}
                  className="flex-1 py-2 rounded-xl border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50 transition-colors"
                >
                  Xóa
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <PackageModal
            pkg={modalPkg}
            onClose={() => setShowModal(false)}
            onSaved={() => { setShowModal(false); load(); }}
          />
        )}
      </AnimatePresence>
    </>
  );
};

// ─── Tab Danh Sách Thẻ ───────────────────────────────────
const CardsTab = () => {
  const [cards, setCards] = useState([]);
  const [summary, setSummary] = useState({});
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: "", search: "" });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [detailCardId, setDetailCardId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cardsRes, pkgRes] = await Promise.all([
        membershipService.getCards({ status: filter.status, search: filter.search }),
        membershipService.getPackages(),
      ]);
      setCards(cardsRes.data.data || []);
      setSummary(cardsRes.data.summary || {});
      setPackages((pkgRes.data.data || []).filter((p) => p.status === "active"));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      {/* Tóm tắt */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5 mb-6">
        {[
          { label: "Tổng số thẻ", key: "total", color: "text-zinc-900" },
          { label: "Đang dùng", key: "active", color: "text-emerald-600" },
          { label: "Chờ TT", key: "pending_payment", color: "text-amber-600" },
          { label: "Hết hạn", key: "expired", color: "text-zinc-500" },
          { label: "Hết ca", key: "depleted", color: "text-red-500" },
        ].map((s) => (
          <div key={s.key} className="admin-card p-4 text-center hover:shadow-md transition-shadow">
            <div className={`text-2xl font-black ${s.color}`}>{summary[s.key] ?? 0}</div>
            <div className="text-zinc-500 text-xs font-semibold mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters + Actions */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          placeholder="Tìm mã thẻ / tên / SĐT..."
          value={filter.search}
          onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
          className="admin-input flex-1 min-w-[240px]"
        />
        <select
          value={filter.status}
          onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
          className="admin-input w-auto min-w-[160px]"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="active">Đang dùng</option>
          <option value="pending_payment">Chờ thanh toán</option>
          <option value="expired">Hết hạn</option>
          <option value="depleted">Hết ca</option>
          <option value="cancelled">Đã hủy</option>
        </select>
        <button
          onClick={() => setShowCreateModal(true)}
          className="admin-btn-primary px-4 py-2 text-xs font-bold rounded-xl"
        >
          + Tạo thẻ cho khách
        </button>
      </div>

      {/* Bảng */}
      {loading ? (
        <div className="admin-card p-12 text-center text-zinc-400 text-sm">Đang tải dữ liệu thẻ...</div>
      ) : cards.length === 0 ? (
        <div className="admin-card p-12 text-center text-zinc-400 text-sm">Không có thẻ thành viên nào phù hợp.</div>
      ) : (
        <div className="admin-card overflow-hidden min-w-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[800px]">
              <thead>
                <tr className="bg-zinc-50/80 border-b border-zinc-100 text-[10px] uppercase tracking-wider text-zinc-400">
                  <th className="py-3.5 px-4 font-semibold">Mã thẻ</th>
                  <th className="py-3.5 px-4 font-semibold">Khách hàng</th>
                  <th className="py-3.5 px-4 font-semibold">Gói</th>
                  <th className="py-3.5 px-4 text-center font-semibold">Ca còn</th>
                  <th className="py-3.5 px-4 font-semibold">Hết hạn</th>
                  <th className="py-3.5 px-4 font-semibold">Trạng thái</th>
                  <th className="py-3.5 px-4 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {cards.map((c) => (
                  <tr key={c.id} className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-extrabold text-emerald-600 text-xs">{c.card_code}</td>
                    <td className="py-3.5 px-4">
                      <div className="text-zinc-800 text-xs font-bold">{c.user_name}</div>
                      <div className="text-zinc-400 text-[11px] font-mono">{c.user_phone}</div>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-600 text-xs font-medium">{c.package_name}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`font-extrabold ${c.remaining_sessions > 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {c.remaining_sessions}
                      </span>
                      <span className="text-zinc-400 font-medium">/{c.total_sessions}</span>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-500 font-mono text-xs">{c.valid_to}</td>
                    <td className="py-3.5 px-4"><Badge status={c.status} /></td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setDetailCardId(c.id)}
                        className="admin-btn-secondary px-3 py-1 text-xs font-bold"
                      >
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showCreateModal && (
          <CreateCardModal
            packages={packages}
            onClose={() => setShowCreateModal(false)}
            onSaved={(keepOpen) => { if (!keepOpen) setShowCreateModal(false); load(); }}
          />
        )}
        {detailCardId && (
          <CardDetailModal
            cardId={detailCardId}
            onClose={() => setDetailCardId(null)}
            onRefresh={load}
          />
        )}
      </AnimatePresence>
    </>
  );
};

// ─── Trang chính ─────────────────────────────────────────
const MembershipManager = () => {
  const [tab, setTab] = useState("cards");

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header & Tabs Nav */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-zinc-900">Gói thành viên</h1>
          <p className="text-xs text-zinc-500 mt-1">Quản lý gói và thẻ thành viên, tra cứu lịch sử sử dụng ca.</p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-zinc-100 rounded-xl border border-zinc-200 self-start md:self-auto">
          {[
            { key: "cards", label: "Danh sách thẻ" },
            { key: "packages", label: "Quản lý gói" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-xs font-extrabold transition-all ${
                tab === t.key
                  ? "bg-white text-zinc-900 shadow-sm border border-zinc-200/80"
                  : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {tab === "cards" ? <CardsTab /> : <PackagesTab />}
    </div>
  );
};

export default MembershipManager;
