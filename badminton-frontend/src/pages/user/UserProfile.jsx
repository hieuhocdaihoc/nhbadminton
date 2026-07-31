import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { authService } from "../../services/auth/authService";
import axiosClient from "../../services/axiosClient";
import { toast } from "../../utils/toast";
import { getMembershipTier } from "../../utils/membershipTier";

const UserProfile = () => {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem("current_user");
    if (!storedUser)
      return { full_name: "", phone: "", email: "", role: "customer" };

    try {
      return JSON.parse(storedUser);
    } catch (error) {
      console.error("Loi doc du lieu user:", error);
      return { full_name: "", phone: "", email: "", role: "customer" };
    }
  });
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState({ type: "", text: "" });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState({
    type: "",
    text: "",
  });
  const [activeTab, setActiveTab] = useState("profile");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef(null);

  useEffect(() => {
    authService
      .getProfile()
      .then((response) => {
        const freshUser = response.data?.user;
        if (freshUser) {
          localStorage.setItem("current_user", JSON.stringify(freshUser));
          setUser(freshUser);
        }
      })
      .catch((error) => console.error("Khong the tai diem thanh vien:", error));
  }, []);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMessage({ type: "", text: "" });
    try {
      const response = await authService.updateProfile({
        fullName: user.full_name,
        email: user.email,
        phone: user.phone,
      });
      const updatedUser = response.data.user;
      localStorage.setItem("current_user", JSON.stringify(updatedUser));
      setUser(updatedUser);
      setProfileMessage({
        type: "success",
        text: "✓ Cập nhật thông tin thành công!",
      });
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("Loi cap nhat profile:", error);
      setProfileMessage({
        type: "error",
        text:
          error.response?.data?.message || "Có lỗi xảy ra, vui lòng thử lại.",
      });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMessage({
        type: "error",
        text: "Mật khẩu mới và xác nhận mật khẩu không trùng khớp.",
      });
      return;
    }
    setPasswordLoading(true);
    setPasswordMessage({ type: "", text: "" });
    try {
      await authService.changePassword(
        oldPassword,
        newPassword,
        confirmPassword,
      );
      setPasswordMessage({
        type: "success",
        text: "✓ Đổi mật khẩu thành công!",
      });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Loi doi mat khau:", error);
      setPasswordMessage({
        type: "error",
        text:
          error.response?.data?.message || "Có lỗi xảy ra, vui lòng thử lại.",
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleAvatarClick = () => {
    if (avatarInputRef.current) {
      avatarInputRef.current.click();
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarUploading(true);
    setProfileMessage({ type: "", text: "" });

    try {
      const response = await authService.uploadAvatar(file);
      const avatarUrl = response.data.avatar_url;
      const updatedUser = { ...user, avatar_url: avatarUrl };
      localStorage.setItem("current_user", JSON.stringify(updatedUser));
      setUser(updatedUser);
      setProfileMessage({
        type: "success",
        text: "✓ Cập nhật ảnh đại diện thành công!",
      });
    } catch (error) {
      console.error("Loi upload avatar:", error);
      setProfileMessage({
        type: "error",
        text: error.response?.data?.message || "Không thể upload ảnh đại diện.",
      });
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleLogoutClick = () => {
    authService.logout();
    localStorage.removeItem("current_user");
    localStorage.removeItem("access_token");
    window.location.href = "/";
  };

  const getInitials = (name) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const tabs = [
    { id: "profile", label: "Thông tin", icon: "contact_mail" },
    { id: "card", label: "Thẻ thành viên", icon: "credit_card" },
    { id: "security", label: "Mật khẩu", icon: "lock" },
  ];

  const [memberCard, setMemberCard] = useState(undefined); // undefined=loading, null=chưa có
  const [packages, setPackages] = useState([]);
  const [buying, setBuying] = useState(null); // package_id đang xử lý mua
  const [purchaseQr, setPurchaseQr] = useState(null); // { qr..., intent_code } khi chờ thanh toán
  const pollRef = useRef(null);

  const loadCard = () =>
    axiosClient
      .get("/membership/my-card")
      .then((r) => setMemberCard(r.data.data))
      .catch(() => setMemberCard(null));

  useEffect(() => {
    loadCard();
    axiosClient
      .get("/membership/packages")
      .then((r) => setPackages(r.data.data || []))
      .catch(() => setPackages([]));
    return () => clearInterval(pollRef.current);
  }, []);

  // Khách chọn mua gói → tạo intent + hiện QR; chỉ cấp thẻ sau khi tiền vào.
  const handleBuyPackage = async (pkg) => {
    setBuying(pkg.id);
    try {
      const r = await axiosClient.post("/membership/purchase", {
        package_id: pkg.id,
      });
      const purchase = r.data.data;
      const payment = r.data.payment;
      setPurchaseQr({ ...payment, intent_code: purchase.intent_code });
      startPolling(purchase.intent_code);
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể mua gói lúc này.");
    } finally {
      setBuying(null);
    }
  };

  const startPolling = (intentCode) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const r = await axiosClient.get(
          `/membership/purchase/${intentCode}/status`,
        );
        if (r.data.data?.paid) {
          clearInterval(pollRef.current);
          setPurchaseQr(null);
          await loadCard();
        } else if (
          ["cancelled", "expired", "failed"].includes(r.data.data?.status)
        ) {
          clearInterval(pollRef.current);
          setPurchaseQr(null);
        }
      } catch {
        /* intent có thể đã bị hủy hoặc hết hạn */
      }
    }, 3000);
  };

  const cancelPurchase = async () => {
    if (purchaseQr?.intent_code) {
      axiosClient
        .delete(`/membership/purchase/${purchaseQr.intent_code}`)
        .catch(() => {});
    }
    clearInterval(pollRef.current);
    setPurchaseQr(null);
  };

  const labelClass =
    "block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2";
  const inputClass = "user-input";

  const points = user.points || 0;
  const membershipTier = getMembershipTier(points);
  const tierBenefit =
    membershipTier.hourlyDiscount > 0
      ? `Giảm ${membershipTier.hourlyDiscount.toLocaleString("vi-VN")}đ/giờ`
      : null;
  const cardTotalSessions = Number(memberCard?.total_sessions || 0);
  const cardUsedSessions = Number(memberCard?.used_sessions || 0);
  const cardRemainingSessions = Number(memberCard?.remaining_sessions || 0);
  const cardCommittedSessions = Number(memberCard?.committed_sessions || 0);
  const cardAvailableSessions = Number(
    memberCard?.available_sessions ?? cardRemainingSessions,
  );
  const cardAllocatedSessions = cardUsedSessions + cardCommittedSessions;
  const cardUsagePercent =
    cardTotalSessions > 0
      ? Math.min(
          100,
          Math.round((cardAllocatedSessions / cardTotalSessions) * 100),
        )
      : 0;

  return (
    <div className="bg-zinc-950 min-h-[calc(100vh-160px)] relative overflow-hidden">
      {/* Nền trang trí */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-lime-400/[0.02] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-teal-400/[0.02] rounded-full blur-3xl pointer-events-none" />

      <div className="user-page-container max-w-5xl py-16 relative z-10">
        {/* ═══ THẺ THÔNG TIN CHÍNH (HERO) ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative user-card-glass mb-8 p-5 sm:p-6 bg-zinc-900 border border-zinc-700 shadow-sm rounded-3xl"
        >
          {/* Role badge - góc trên phải */}
          <span className="absolute top-5 right-5 text-[10px] font-extrabold text-lime-500 bg-lime-400/10 px-3 py-1 rounded-lg border border-lime-400/30 uppercase tracking-widest">
            {user.role === "customer" ? "Vợt thủ" : user.role}
          </span>

          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            {/* Ảnh đại diện */}
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0 mx-auto sm:mx-0">
              <motion.div
                whileHover={{ scale: 1.04 }}
                transition={{ type: "spring", stiffness: 300 }}
                onClick={handleAvatarClick}
                className="relative w-full h-full rounded-xl overflow-hidden flex items-center justify-center border-2 border-zinc-700 cursor-pointer shadow-sm group/avatar"
              >
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.full_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-lime-400 to-teal-500 flex items-center justify-center text-white font-black text-3xl">
                    {getInitials(user.full_name)}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center">
                  {avatarUploading ? (
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="material-symbols-outlined text-white text-xl">
                      photo_camera
                    </span>
                  )}
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </motion.div>
              {/* Badge bút chì sửa ảnh */}
              <button
                onClick={handleAvatarClick}
                className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-lime-500 hover:bg-lime-400 rounded-full flex items-center justify-center border-2 border-white transition-colors"
              >
                <span className="material-symbols-outlined text-white text-[14px]">
                  edit
                </span>
              </button>
            </div>

            {/* Thông tin */}
            <div className="flex-1 text-center sm:text-left min-w-0">
              <h1 className="text-xl font-extrabold text-white tracking-tight truncate">
                {user.full_name || "Vợt Thủ NH"}
              </h1>
              <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                ID:{" "}
                {(user.customer_code || user.id || "").toString().slice(0, 12)}
              </p>

              <div className="flex items-center gap-2 mt-3 justify-center sm:justify-start">
                <a
                  href="/booking-history"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-200 text-zinc-300 text-[11px] font-bold rounded-lg transition-all border border-zinc-700"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    history
                  </span>{" "}
                  Lịch sử
                </a>
                <button
                  onClick={handleLogoutClick}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-400/10 hover:bg-red-100 text-red-300 text-[11px] font-bold rounded-lg transition-all border border-red-400/30"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    logout
                  </span>{" "}
                  Đăng xuất
                </button>
              </div>
            </div>

            {/* Hạng + điểm */}
            <div className="shrink-0 flex flex-col items-center sm:items-end gap-1">
              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-amber-300 bg-amber-400/10 border border-amber-400/30 px-3 py-1.5 rounded-lg">
                <span className="material-symbols-outlined text-[16px]">
                  emoji_events
                </span>
                Hạng {membershipTier.label}
              </span>
              <div className="text-right">
                <p className="text-2xl font-black text-lime-500 leading-none">
                  {points}
                </p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mt-0.5">
                  Điểm tích lũy
                </p>
              </div>
            </div>
          </div>

          {/* Thanh tiến trình lên hạng */}
          <div className="mt-5 pt-4 border-t border-zinc-700">
            <div className="flex items-center justify-between mb-1.5 text-[10px] font-semibold">
              <span className="text-zinc-500">
                {membershipTier.nextTarget
                  ? `${tierBenefit ? `${tierBenefit} • ` : ""}Còn ${membershipTier.pointsToNext} điểm để lên hạng ${membershipTier.nextLabel}`
                  : `Đã đạt hạng cao nhất • ${tierBenefit}`}
              </span>
              <span className="text-lime-500 font-bold">
                {membershipTier.progress}%
              </span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${membershipTier.progress}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-lime-400 to-teal-500 rounded-full"
              />
            </div>
          </div>
        </motion.div>

        {/* ═══ ĐIỀU HƯỚNG TAB ═══ */}
        <div className="flex items-center gap-2 mb-8 bg-zinc-900 border border-zinc-800 rounded-2xl p-1.5 w-full max-w-md sm:max-w-xl shadow-inner overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex-1 min-w-[110px] sm:min-w-[130px] px-3 py-2.5 sm:px-5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 whitespace-nowrap
                ${activeTab === tab.id ? "text-white font-extrabold" : "text-zinc-400 hover:text-white"}`}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeProfileTab"
                  className="absolute inset-0 bg-lime-500 rounded-xl shadow-sm"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              <span className="material-symbols-outlined relative z-10 text-[18px]">
                {tab.icon}
              </span>
              <span className="relative z-10">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ═══ NỘI DUNG TAB ═══ */}
        <AnimatePresence mode="wait">
          {activeTab === "profile" && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25 }}
              className="user-card-glass bg-zinc-900 border border-zinc-700 shadow-sm p-6 sm:p-8 rounded-3xl"
            >
              <div className="flex items-center gap-3 mb-8 pb-5 border-b border-zinc-700">
                <div className="w-10 h-10 bg-lime-400/10 rounded-xl flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-lime-500 text-xl">
                    contact_mail
                  </span>
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-extrabold text-white uppercase tracking-wide">
                    Thông tin liên hệ
                  </h2>
                  <div className="flex flex-wrap items-center gap-2.5 mt-1">
                    <p className="text-xs text-zinc-400">
                      Cập nhật thông tin liên hệ chính xác của bạn.
                    </p>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-400/10 px-2.5 py-0.5 rounded-md border border-amber-400/30">
                      <span className="material-symbols-outlined text-[14px] text-amber-400">info</span>
                      Lưu ý: Ảnh đại diện phải dưới 2MB
                    </span>
                  </div>
                </div>
              </div>

              {profileMessage.text && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`mb-6 p-4 rounded-2xl text-sm font-bold flex items-center gap-2 ${profileMessage.type === "success" ? "bg-lime-400/10 border border-lime-400/30 text-lime-300" : "bg-red-400/10 text-red-300 border border-red-400/30"}`}
                >
                  {profileMessage.text}
                </motion.div>
              )}

              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className={labelClass}>Họ và tên *</label>
                    <input
                      type="text"
                      required
                      value={user.full_name}
                      onChange={(e) =>
                        setUser({ ...user, full_name: e.target.value })
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>
                      Số điện thoại
                      <span className="ml-2 text-[9px] text-amber-300 normal-case tracking-normal inline-flex items-center gap-0.5 font-bold">
                        <span className="material-symbols-outlined text-[11px]">
                          lock
                        </span>{" "}
                        Không thể thay đổi
                      </span>
                    </label>
                    <input
                      type="text"
                      disabled
                      value={user.phone}
                      className="w-full px-4 py-3.5 bg-zinc-800 border border-zinc-700 rounded-2xl text-sm font-semibold text-zinc-500 cursor-not-allowed"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Địa chỉ email *</label>
                    <input
                      type="email"
                      required
                      value={user.email}
                      onChange={(e) =>
                        setUser({ ...user, email: e.target.value })
                      }
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-2">
                  <motion.button
                    type="submit"
                    disabled={profileLoading}
                    whileHover={!profileLoading ? { scale: 1.02 } : {}}
                    whileTap={!profileLoading ? { scale: 0.98 } : {}}
                    className={`user-btn-primary ${profileLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {profileLoading && (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    )}
                    {profileLoading ? "Đang lưu..." : "Lưu thay đổi"}
                  </motion.button>
                  <a
                    href="/"
                    className="text-xs text-zinc-500 hover:text-zinc-300 font-semibold transition-colors inline-flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      arrow_back
                    </span>{" "}
                    Quay lại trang chủ
                  </a>
                </div>
              </form>
            </motion.div>
          )}

          {activeTab === "card" && (
            <motion.div
              key="card"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="user-card-glass bg-zinc-900 border border-zinc-700 shadow-sm p-6 sm:p-8 rounded-3xl"
            >
              <div className="flex items-center gap-3 mb-8 pb-5 border-b border-zinc-700">
                <div className="w-10 h-10 bg-lime-400/10 rounded-xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-lime-400 text-xl">
                    credit_card
                  </span>
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-white uppercase tracking-wide">
                    Thẻ thành viên
                  </h2>
                  <p className="text-[11px] text-zinc-500">
                    Thông tin thẻ và lịch sử sử dụng ca chơi.
                  </p>
                </div>
              </div>

              {memberCard === undefined ? (
                <div className="text-zinc-500 text-sm text-center py-10">
                  Đang tải...
                </div>
              ) : memberCard === null ? (
                <div className="space-y-5">
                  <div className="text-center space-y-1">
                    <p className="text-zinc-300 text-sm font-semibold">
                      Chọn gói thành viên để hưởng giá ưu đãi mỗi giờ chơi
                    </p>
                    <p className="text-zinc-600 text-xs">
                      Thanh toán trước một lần, mỗi lần đặt sân tự trừ ca —
                      không phải trả thêm.
                    </p>
                  </div>
                  {packages.length === 0 ? (
                    <p className="text-zinc-500 text-sm text-center py-6">
                      Chưa có gói nào được mở bán.
                    </p>
                  ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {packages.map((pkg, i) => {
                        const featured = i === 0;
                        return (
                          <div
                            key={pkg.id}
                            className={`relative flex flex-col rounded-2xl border p-5 transition-all ${
                              featured
                                ? "border-lime-500 bg-lime-500/5 shadow-lg shadow-lime-500/10"
                                : "border-zinc-700 bg-zinc-800/40 hover:border-zinc-600"
                            }`}
                          >
                            {featured && (
                              <span className="absolute -top-2.5 left-5 bg-lime-500 text-zinc-950 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                                Phổ biến
                              </span>
                            )}
                            <p className="text-white font-bold text-base">
                              {pkg.name}
                            </p>
                            {pkg.description && (
                              <p className="text-zinc-500 text-[11px] mt-1 leading-relaxed min-h-[32px]">
                                {pkg.description}
                              </p>
                            )}
                            <div className="mt-3 mb-1">
                              <span className="text-2xl font-black text-lime-400">
                                {Number(pkg.price).toLocaleString("vi-VN")}
                              </span>
                              <span className="text-zinc-500 text-xs font-bold ml-1">
                                đ
                              </span>
                            </div>
                            <ul className="mt-3 space-y-2 text-xs text-zinc-400 flex-1">
                              <li className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-lime-500 text-sm">
                                  check_circle
                                </span>
                                <span>
                                  <b className="text-white">
                                    {pkg.total_sessions} ca
                                  </b>{" "}
                                  chơi (giờ)
                                </span>
                              </li>
                              <li className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-lime-500 text-sm">
                                  check_circle
                                </span>
                                <span>
                                  Dùng trong{" "}
                                  <b className="text-white">
                                    {pkg.duration_days} ngày
                                  </b>
                                </span>
                              </li>
                              <li className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-lime-500 text-sm">
                                  check_circle
                                </span>
                                <span>
                                  Chỉ{" "}
                                  <b className="text-lime-400">
                                    {Number(
                                      pkg.price_per_session,
                                    ).toLocaleString("vi-VN")}
                                    đ
                                  </b>
                                  /ca
                                </span>
                              </li>
                              <li className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-lime-500 text-sm">
                                  check_circle
                                </span>
                                <span>Mở khóa sân dành riêng hội viên</span>
                              </li>
                            </ul>
                            <button
                              onClick={() => handleBuyPackage(pkg)}
                              disabled={buying === pkg.id}
                              className={`mt-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-60 ${
                                featured
                                  ? "bg-lime-500 text-zinc-950 hover:bg-lime-400"
                                  : "bg-zinc-700 text-white hover:bg-zinc-600"
                              }`}
                            >
                              {buying === pkg.id
                                ? "Đang xử lý..."
                                : "Mua gói này"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Cảnh báo sắp hết ca / sắp hết hạn */}
                  {(memberCard.near_depletion || memberCard.near_expiry) && (
                    <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3">
                      <span className="material-symbols-outlined text-amber-400 text-base mt-0.5">
                        warning
                      </span>
                      <div className="text-[11px] text-amber-200 leading-relaxed">
                        {memberCard.near_depletion && (
                          <p>
                            Thẻ chỉ còn{" "}
                            <b className="text-amber-300">
                              {memberCard.remaining_sessions} ca
                            </b>{" "}
                            — cân nhắc mua gói mới khi dùng hết.
                          </p>
                        )}
                        {memberCard.near_expiry && (
                          <p>
                            Thẻ sẽ hết hạn sau{" "}
                            <b className="text-amber-300">
                              {memberCard.days_left} ngày
                            </b>{" "}
                            ({memberCard.valid_to}). Ca chưa dùng sẽ mất khi hết
                            hạn.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Card visual */}
                  <div className="relative bg-gradient-to-br from-lime-600 to-lime-800 rounded-2xl p-5 text-white overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-10 translate-x-10" />
                    <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-8 -translate-x-8" />
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <p className="text-lime-200 text-[10px] uppercase tracking-widest font-bold">
                            NH Badminton
                          </p>
                          <p className="text-white font-bold text-sm mt-0.5">
                            {memberCard.package_name}
                          </p>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            memberCard.status === "active"
                              ? "bg-white/20 text-white"
                              : "bg-black/30 text-white/70"
                          }`}
                        >
                          {memberCard.status === "active"
                            ? "Đang dùng"
                            : memberCard.status === "pending_payment"
                              ? "Chờ thanh toán"
                              : memberCard.status}
                        </span>
                      </div>
                      <p className="font-mono text-xl font-bold tracking-widest mb-4">
                        {memberCard.card_code}
                      </p>
                      <div className="flex justify-between items-end text-xs">
                        <div>
                          <p className="text-lime-200 text-[9px] uppercase">
                            Hiệu lực
                          </p>
                          <p className="font-semibold">
                            {memberCard.valid_from} – {memberCard.valid_to}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lime-200 text-[9px] uppercase">
                            Giá/ca
                          </p>
                          <p className="font-semibold">
                            {Number(
                              memberCard.price_per_session,
                            ).toLocaleString("vi-VN")}
                            đ
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tiến độ ca */}
                  <div className="bg-zinc-800 rounded-2xl p-4 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="rounded-xl bg-zinc-900/70 border border-zinc-700/70 px-3 py-2">
                        <p className="text-[10px] text-zinc-500 font-bold uppercase">
                          Tổng ca
                        </p>
                        <p className="text-white font-black text-lg">
                          {cardTotalSessions}
                        </p>
                      </div>
                      <div className="rounded-xl bg-zinc-900/70 border border-zinc-700/70 px-3 py-2">
                        <p className="text-[10px] text-zinc-500 font-bold uppercase">
                          Đã hoàn thành
                        </p>
                        <p className="text-amber-300 font-black text-lg">
                          {cardUsedSessions}
                        </p>
                      </div>
                      <div className="rounded-xl bg-zinc-900/70 border border-zinc-700/70 px-3 py-2">
                        <p className="text-[10px] text-zinc-500 font-bold uppercase">
                          Đang giữ
                        </p>
                        <p className="text-sky-300 font-black text-lg">
                          {cardCommittedSessions}
                        </p>
                      </div>
                      <div className="rounded-xl bg-lime-400/10 border border-lime-400/30 px-3 py-2">
                        <p className="text-[10px] text-lime-200/80 font-bold uppercase">
                          Khả dụng
                        </p>
                        <p className="text-lime-400 font-black text-lg">
                          {cardAvailableSessions}
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">Ca đã phân bổ</span>
                      <span className="text-white font-bold">
                        {cardAllocatedSessions} / {cardTotalSessions} ca
                      </span>
                    </div>
                    <div className="w-full h-3 bg-zinc-700 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${cardUsagePercent}%`,
                        }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="h-full bg-lime-500 rounded-full"
                      />
                    </div>
                    <div className="flex justify-between text-xs text-zinc-500">
                      <span>
                        Còn trong thẻ:{" "}
                        <span className="text-lime-400 font-bold">
                          {cardRemainingSessions} ca
                        </span>
                      </span>
                      <span>{cardUsagePercent}% đã phân bổ</span>
                    </div>
                    {cardCommittedSessions > 0 && (
                      <p className="text-[11px] text-sky-200/80">
                        {cardCommittedSessions} ca đang giữ cho các đơn đã đặt
                        nhưng chưa hoàn thành.
                      </p>
                    )}
                  </div>

                  {/* Thông tin giá */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-zinc-800 rounded-xl p-3 text-center">
                      <p className="text-lime-400 font-bold text-base">
                        {Number(memberCard.price_per_session).toLocaleString(
                          "vi-VN",
                        )}
                        đ
                      </p>
                      <p className="text-zinc-500 text-[10px] mt-0.5">
                        Giá ưu đãi / ca
                      </p>
                    </div>
                    <div className="bg-zinc-800 rounded-xl p-3 text-center">
                      <p className="text-white font-bold text-base">
                        {Number(memberCard.price).toLocaleString("vi-VN")}đ
                      </p>
                      <p className="text-zinc-500 text-[10px] mt-0.5">
                        Tổng tiền đã trả
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "security" && (
            <motion.div
              key="security"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="user-card-glass bg-zinc-900 border border-zinc-700 shadow-sm p-6 sm:p-8 rounded-3xl"
            >
              <div className="flex items-center gap-3 mb-8 pb-5 border-b border-zinc-700">
                <div className="w-10 h-10 bg-amber-400/10 rounded-xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-amber-300 text-xl">
                    lock
                  </span>
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-white uppercase tracking-wide">
                    Đổi mật khẩu
                  </h2>
                  <p className="text-[11px] text-zinc-500">
                    Sử dụng mật khẩu mạnh để bảo vệ tài khoản.
                  </p>
                </div>
              </div>

              {passwordMessage.text && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`mb-6 p-4 rounded-2xl text-sm font-bold flex items-center gap-2 ${passwordMessage.type === "success" ? "bg-lime-400/10 border border-lime-400/30 text-lime-300" : "bg-red-400/10 text-red-300 border border-red-400/30"}`}
                >
                  {passwordMessage.text}
                </motion.div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-6">
                <div>
                  <label className={labelClass}>Mật khẩu hiện tại *</label>
                  <input
                    type="password"
                    required
                    placeholder="Nhập mật khẩu đang sử dụng"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className={labelClass}>Mật khẩu mới *</label>
                    <input
                      type="password"
                      required
                      minLength="6"
                      placeholder="Tối thiểu 6 ký tự"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Xác nhận mật khẩu *</label>
                    <input
                      type="password"
                      required
                      minLength="6"
                      placeholder="Nhập lại mật khẩu mới"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
                {/* Gợi ý độ mạnh mật khẩu */}
                <div className="bg-zinc-900/60 rounded-2xl p-4 border border-zinc-700">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
                    Yêu cầu mật khẩu
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-500">
                    <span
                      className={
                        newPassword.length >= 6
                          ? "text-lime-500 font-bold"
                          : "text-zinc-500"
                      }
                    >
                      ✓ Ít nhất 6 ký tự
                    </span>
                    <span
                      className={
                        /[A-Z]/.test(newPassword)
                          ? "text-lime-500 font-bold"
                          : "text-zinc-500"
                      }
                    >
                      ✓ Có chữ hoa
                    </span>
                    <span
                      className={
                        /[0-9]/.test(newPassword)
                          ? "text-lime-500 font-bold"
                          : "text-zinc-500"
                      }
                    >
                      ✓ Có chữ số
                    </span>
                    <span
                      className={
                        newPassword && newPassword === confirmPassword
                          ? "text-lime-500 font-bold"
                          : "text-zinc-500"
                      }
                    >
                      ✓ Khớp xác nhận
                    </span>
                  </div>
                </div>

                <motion.button
                  type="submit"
                  disabled={passwordLoading}
                  whileHover={!passwordLoading ? { scale: 1.02 } : {}}
                  whileTap={!passwordLoading ? { scale: 0.98 } : {}}
                  className={`user-btn-secondary ${passwordLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {passwordLoading && (
                    <span className="w-4 h-4 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
                  )}
                  {passwordLoading ? "Đang xác thực..." : "Cập nhật mật khẩu"}
                </motion.button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modal QR thanh toán mua gói */}
      <AnimatePresence>
        {purchaseQr && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={cancelPurchase}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-900 border border-zinc-700 rounded-3xl w-full max-w-sm p-6 text-center space-y-4"
            >
              <div>
                <h3 className="text-white font-extrabold text-base">
                  Quét mã QR để thanh toán
                </h3>
                <p className="text-zinc-500 text-xs mt-1">
                  Thẻ chỉ được cấp sau khi hệ thống xác nhận tiền đã vào.
                </p>
              </div>
              <img
                src={purchaseQr.qr_url}
                alt="QR thanh toán"
                className="w-52 h-52 mx-auto rounded-2xl bg-white p-2"
              />
              <div className="text-left bg-zinc-800 rounded-xl p-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Số tiền</span>
                  <span className="text-lime-400 font-bold">
                    {Number(purchaseQr.amount).toLocaleString("vi-VN")}đ
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Ngân hàng</span>
                  <span className="text-white">{purchaseQr.bank_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Số TK</span>
                  <span className="text-white font-mono">
                    {purchaseQr.bank_account}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Nội dung</span>
                  <span className="text-lime-400 font-mono font-bold">
                    {purchaseQr.transfer_content}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 text-amber-300 text-[11px]">
                <span className="w-3.5 h-3.5 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
                Đang chờ thanh toán...
              </div>
              <button
                onClick={cancelPurchase}
                className="w-full py-2.5 rounded-xl bg-zinc-700 text-white text-xs font-bold hover:bg-zinc-600 transition-colors"
              >
                Hủy
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserProfile;
