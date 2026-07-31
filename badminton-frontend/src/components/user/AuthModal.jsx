import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { authService } from "../../services/auth/authService";

const AuthModal = ({
  isOpen,
  onClose,
  initialMode = "login",
  onLoginSuccess,
}) => {
  const [mode, setMode] = useState(initialMode);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const pwChecks = {
    length: password.length >= 8,
    special: /[^A-Za-z0-9\s]/.test(password),
  };
  const pwScore = Object.values(pwChecks).filter(Boolean).length; // 0,1,2
  const pwStrength = pwScore === 0 ? null : pwScore === 1 ? "weak" : "strong";

  // Validate SĐT Việt Nam: 10 số, bắt đầu 03/05/08
  const isValidPhone = (p) =>
    /^0[35789][0-9]{8}$/.test(p.replace(/[\s-]/g, ""));

  // XỬ LÝ GỌI API BACKEND THỰC TẾ
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    if (mode === "login") {
      try {
        const response = await authService.login(phone, password);
        const { access_token, redirect_to } = response.data;
        const user = {
          ...response.data.user,
          role: response.data.user?.role || response.data.role,
        };
        localStorage.setItem("access_token", access_token);
        localStorage.setItem("current_user", JSON.stringify(user));
        localStorage.setItem("current_role", user.role);
        localStorage.setItem(
          "permissions",
          JSON.stringify(response.data.permissions || []),
        );

        if (user.role === "admin" || user.role === "staff") {
          window.location.href =
            redirect_to ||
            (user.role === "staff"
              ? "/admin/bookings/today"
              : "/admin/dashboard");
        } else {
          onLoginSuccess(user);
          onClose();
        }
      } catch (error) {
        console.error("Lỗi đăng nhập:", error);
        setErrorMessage(
          error.response?.data?.message || "Không thể kết nối đến máy chủ.",
        );
      } finally {
        setIsLoading(false);
      }
    } else {
      // Validate trước khi gọi API
      if (fullName.trim().length < 2) {
        setErrorMessage("Họ và tên phải có ít nhất 2 ký tự.");
        setIsLoading(false);
        return;
      }
      if (!isValidPhone(phone)) {
        setErrorMessage(
          "Số điện thoại không hợp lệ. Vui lòng nhập số Việt Nam 10 số (bắt đầu bằng 03, 05, 07, 08 hoặc 09).",
        );
        setIsLoading(false);
        return;
      }
      if (!pwChecks.length) {
        setErrorMessage("Mật khẩu phải có ít nhất 8 ký tự.");
        setIsLoading(false);
        return;
      }
      if (!pwChecks.special) {
        setErrorMessage(
          "Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt (!@#$%...).",
        );
        setIsLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage("Mật khẩu xác nhận không khớp.");
        setIsLoading(false);
        return;
      }
      try {
        await authService.register(
          fullName,
          phone.replace(/[\s-]/g, ""),
          email,
          password,
        );
        setMode("login");
        setErrorMessage("🎉 Đăng ký thành công! Vui lòng đăng nhập.");
        setPassword("");
        setConfirmPassword("");
      } catch (error) {
        if (error.response?.data?.errors) {
          setErrorMessage(Object.values(error.response.data.errors)[0][0]);
        } else {
          setErrorMessage("Đăng ký thất bại. Vui lòng kiểm tra lại thông tin.");
        }
      } finally {
        setIsLoading(false);
      }
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setErrorMessage("");
    setPassword("");
    setConfirmPassword("");
  };

  const inputClass =
    "w-full px-4 py-3 bg-zinc-900/60 border border-zinc-700 rounded-xl text-sm font-medium text-white placeholder-zinc-400 focus:outline-none focus:border-lime-400 focus:shadow-[0_0_12px_rgba(163,230,53,0.1)] transition-all duration-300";
  const labelClass =
    "block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2";

  if (!isOpen || typeof document === "undefined" || !document.body) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[99999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              transition: { type: "spring", stiffness: 300, damping: 25 },
            }}
            exit={{
              opacity: 0,
              scale: 0.95,
              y: 20,
              transition: { duration: 0.15 },
            }}
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-900 w-full max-w-md rounded-3xl border border-zinc-700 shadow-2xl shadow-zinc-900/10 relative overflow-hidden"
          >
            {/* Decorative top line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-lime-500/30 to-transparent" />

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-xl bg-zinc-800 hover:bg-zinc-200 text-zinc-500 hover:text-white transition-colors z-10"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41Z" />
              </svg>
            </button>

            {/* Header */}
            <div className="px-8 pt-8 pb-5 text-center">
              <motion.div
                whileHover={{ rotate: 3, scale: 1.05 }}
                className="w-12 h-12 bg-lime-500 rounded-xl flex items-center justify-center text-white font-black text-xl tracking-tighter mx-auto mb-4 shadow-lg shadow-lime-500/20"
              >
                NH
              </motion.div>
              <h3 className="text-xl font-extrabold text-white tracking-tight">
                {mode === "login" ? "Chào mừng trở lại" : "Tạo tài khoản"}
              </h3>
              <p className="text-xs text-zinc-500 mt-1.5">
                {mode === "login"
                  ? "Đăng nhập bằng số điện thoại đã đăng ký."
                  : "Trở thành hội viên để nhận ưu đãi đặt sân."}
              </p>
            </div>

            {/* Mode tabs */}
            <div className="mx-8 mb-5 grid grid-cols-2 bg-zinc-800 p-1 rounded-xl">
              {["login", "register"].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  className={`relative py-2.5 rounded-lg text-xs font-bold transition-all duration-300
                                        ${mode === m ? "text-white" : "text-zinc-500 hover:text-white"}`}
                >
                  {mode === m && (
                    <motion.div
                      layoutId="authModeTab"
                      className="absolute inset-0 bg-lime-500 rounded-lg"
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 30,
                      }}
                    />
                  )}
                  <span className="relative z-10">
                    {m === "login" ? "Đăng nhập" : "Đăng ký"}
                  </span>
                </button>
              ))}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-4">
              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3 rounded-xl text-xs font-semibold text-center border ${
                    errorMessage.includes("thành công")
                      ? "bg-lime-400/10 text-lime-300 border-lime-400/30"
                      : "bg-red-400/10 text-red-300 border-red-400/30"
                  }`}
                >
                  {errorMessage}
                </motion.div>
              )}

              <AnimatePresence>
                {mode === "register" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 overflow-hidden"
                  >
                    <div>
                      <label className={labelClass}>Họ và tên *</label>
                      <input
                        type="text"
                        required
                        placeholder="Nhập họ tên"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Email *</label>
                      <input
                        type="email"
                        required
                        placeholder="email@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div>
                <label className={labelClass}>Số điện thoại *</label>
                <input
                  type="tel"
                  required
                  placeholder="Số diện thoại"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={10}
                  className={inputClass}
                />
                {mode === "register" && phone && !isValidPhone(phone) && (
                  <p className="mt-1.5 text-[10px] text-red-500 font-medium">
                    Số điện thoại phải là 10 số, bắt đầu bằng 03, 05, 07, 08
                    hoặc 09.
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={labelClass + " mb-0"}>Mật khẩu *</label>
                  {mode === "login" && (
                    <a
                      href="#"
                      className="text-[10px] font-semibold text-lime-500/80 hover:text-lime-500 transition-colors"
                    >
                      Quên mật khẩu?
                    </a>
                  )}
                </div>
                <input
                  type="password"
                  required
                  placeholder="Điền mật khẩu"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />

                {/* Thanh độ mạnh mật khẩu — chỉ hiện khi đăng ký và đã nhập */}
                {mode === "register" && password.length > 0 && (
                  <div className="mt-2.5 space-y-1.5">
                    {/* Thanh màu */}
                    <div className="flex gap-1">
                      {[0, 1].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                            i < pwScore
                              ? pwStrength === "strong"
                                ? "bg-lime-500"
                                : "bg-amber-400"
                              : "bg-zinc-700"
                          }`}
                        />
                      ))}
                    </div>
                    {/* Nhãn + tiêu chí */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-bold ${
                          pwStrength === "strong"
                            ? "text-lime-400"
                            : pwStrength === "weak"
                              ? "text-amber-400"
                              : "text-zinc-500"
                        }`}
                      >
                        {pwStrength === "strong"
                          ? "Mạnh"
                          : pwStrength === "weak"
                            ? "Yếu"
                            : ""}
                      </span>
                    </div>
                    <div className="flex gap-3">
                      <span
                        className={`flex items-center gap-1 text-[10px] font-medium ${pwChecks.length ? "text-lime-400" : "text-zinc-500"}`}
                      >
                        <span>{pwChecks.length ? "✓" : "○"}</span> Ít nhất 8 ký
                        tự
                      </span>
                      <span
                        className={`flex items-center gap-1 text-[10px] font-medium ${pwChecks.special ? "text-lime-400" : "text-zinc-500"}`}
                      >
                        <span>{pwChecks.special ? "✓" : "○"}</span> 1 ký tự đặc
                        biệt
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Ô xác nhận mật khẩu — chỉ hiện khi đăng ký */}
              {mode === "register" && (
                <div>
                  <label className={labelClass}>Xác nhận mật khẩu *</label>
                  <input
                    type="password"
                    required
                    placeholder="Xác nhận mật khẩu"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`${inputClass} ${
                      confirmPassword.length > 0
                        ? confirmPassword === password
                          ? "border-lime-500/50 focus:border-lime-400"
                          : "border-red-500/50 focus:border-red-400"
                        : ""
                    }`}
                  />
                  {confirmPassword.length > 0 &&
                    confirmPassword !== password && (
                      <p className="mt-1.5 text-[10px] text-red-400 font-medium">
                        Mật khẩu xác nhận không khớp.
                      </p>
                    )}
                  {confirmPassword.length > 0 &&
                    confirmPassword === password && (
                      <p className="mt-1.5 text-[10px] text-lime-400 font-medium">
                        ✓ Mật khẩu khớp.
                      </p>
                    )}
                </div>
              )}

              <motion.button
                type="submit"
                disabled={isLoading}
                whileHover={!isLoading ? { scale: 1.01 } : {}}
                whileTap={!isLoading ? { scale: 0.99 } : {}}
                className={`w-full py-3.5 bg-lime-500 hover:bg-lime-400 text-white font-extrabold rounded-xl text-sm uppercase tracking-wider transition-all shadow-lg shadow-lime-500/15 flex items-center justify-center gap-2 mt-2 ${isLoading ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                    Đang xử lý...
                  </>
                ) : mode === "login" ? (
                  "Đăng nhập"
                ) : (
                  "Đăng ký hội viên"
                )}
              </motion.button>

              <p className="text-center text-[11px] text-zinc-500 pt-2">
                {mode === "login" ? "Chưa có tài khoản? " : "Đã có tài khoản? "}
                <button
                  type="button"
                  onClick={() =>
                    switchMode(mode === "login" ? "register" : "login")
                  }
                  className="font-bold text-lime-500 hover:text-lime-300 transition-colors"
                >
                  {mode === "login" ? "Đăng ký ngay" : "Đăng nhập"}
                </button>
              </p>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default AuthModal;
