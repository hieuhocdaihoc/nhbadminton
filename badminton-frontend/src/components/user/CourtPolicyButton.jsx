import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  BadgeCheck,
  CalendarClock,
  Clock3,
  CreditCard,
  Headphones,
  ShieldCheck,
  Sparkles,
  TimerReset,
  X,
} from "lucide-react";
import { settingService } from "../../services/settingService";

const DEFAULT_SETTINGS = {
  club_name: "NH Badminton",
  hotline: "0394.421.192",
  weekday_hours: "05:00 - 23:00",
  weekend_hours: "06:00 - 23:00",
  holiday_hours: "07:00 - 22:00",
  deposit_percent: "20",
  cancel_request_min_hours: "24",
  overtime_grace_minutes: "15",
};

const asPositiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const CourtPolicyButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const closeButtonRef = useRef(null);
  const titleId = useId();
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    let isMounted = true;

    settingService
      .getPublicSettings()
      .then((response) => {
        if (!isMounted) return;
        setSettings((current) => ({
          ...current,
          ...(response.data?.data || {}),
        }));
      })
      .catch(() => {
        // Giữ cấu hình mặc định để chính sách vẫn luôn đọc được khi API tạm gián đoạn.
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (typeof document === "undefined" || !document.body) return null;

  const depositPercent = asPositiveNumber(settings.deposit_percent, 20);
  const cancelHours = asPositiveNumber(settings.cancel_request_min_hours, 24);
  const overtimeGrace = asPositiveNumber(settings.overtime_grace_minutes, 15);

  const policyItems = [
    {
      icon: Clock3,
      title: "Giờ hoạt động",
      content: (
        <div className="grid gap-1 text-sm">
          <p>Thứ 2 - Thứ 6: {settings.weekday_hours}</p>
          <p>Thứ 7 - Chủ nhật: {settings.weekend_hours}</p>
          <p>Ngày lễ / Tết: {settings.holiday_hours}</p>
        </div>
      ),
    },
    {
      icon: CreditCard,
      title: "Đặt sân và giữ lịch",
      content: (
        <p>
          Với đơn cần thanh toán, khách hoàn tất khoản hệ thống yêu cầu để giữ
          lịch. Mức cọc mặc định là {depositPercent}% tổng tiền; hãy giữ lại mã
          đơn để đối chiếu.
        </p>
      ),
    },
    {
      icon: BadgeCheck,
      title: "Nhận sân và check-in",
      content: (
        <p>
          Cung cấp đúng số điện thoại và mã đơn. Có thể check-in từ 30 phút
          trước giờ chơi đến trước giờ kết thúc ca, nên có mặt sớm 10 phút.
        </p>
      ),
    },
    {
      icon: CalendarClock,
      title: "Đổi hoặc hủy lịch",
      content: (
        <p>
          Gửi yêu cầu trước giờ chơi ít nhất {cancelHours} giờ để nhân viên xử
          lý. Tiền cọc giữ sân không hoàn lại khi khách tự hủy hoặc không đến.
        </p>
      ),
    },
    {
      icon: TimerReset,
      title: "Thời gian chơi và quá giờ",
      content: (
        <p>
          Khách sử dụng đúng sân và đúng khung giờ đã đặt. Sau {overtimeGrace}{" "}
          phút ân hạn, thời gian vượt sẽ được tính thêm theo đơn giá của ca
          chơi.
        </p>
      ),
    },
    {
      icon: Sparkles,
      title: "Thẻ thành viên và dịch vụ",
      content: (
        <p>
          Chỉ thẻ đang hoạt động mới được trừ ca. Phần ca vượt quyền lợi cùng
          sản phẩm hoặc dịch vụ phát sinh sẽ được cộng vào hóa đơn.
        </p>
      ),
    },
    {
      icon: ShieldCheck,
      title: "An toàn và tài sản",
      content: (
        <p>
          Mang giày phù hợp, giữ vệ sinh, không hút thuốc trong khu vực sân và
          tự bảo quản tư trang. Báo ngay cho nhân viên khi có sự cố hoặc hư hỏng
          thiết bị.
        </p>
      ),
    },
  ];

  return createPortal(
    <>
      <motion.button
        type="button"
        aria-label="Mở chính sách hoạt động của sân"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title="Chính sách sân"
        onClick={() => setIsOpen(true)}
        initial={prefersReducedMotion ? false : { opacity: 0, x: -24 }}
        animate={
          prefersReducedMotion
            ? { opacity: 1 }
            : {
                opacity: 1,
                x: 0,
                y: [0, -4, 0],
                boxShadow: [
                  "0 10px 30px rgba(0,0,0,0.28)",
                  "0 12px 36px rgba(163,230,53,0.38)",
                  "0 10px 30px rgba(0,0,0,0.28)",
                ],
              }
        }
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : {
                opacity: { duration: 0.3 },
                x: { type: "spring", stiffness: 260, damping: 22 },
                y: { duration: 1.4, repeat: Infinity, repeatDelay: 4 },
                boxShadow: {
                  duration: 1.4,
                  repeat: Infinity,
                  repeatDelay: 4,
                },
              }
        }
        whileHover={prefersReducedMotion ? undefined : { y: -3, scale: 1.02 }}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
        className="fixed bottom-4 left-4 z-[70] flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-xl border border-lime-300/70 bg-zinc-950 p-2.5 text-sm font-extrabold text-white shadow-xl transition-colors hover:bg-zinc-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-lime-400/40 sm:bottom-6 sm:left-6 sm:px-4 sm:py-3"
      >
        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-lime-400 text-zinc-950">
          <ShieldCheck aria-hidden="true" className="h-5 w-5" />
          {!prefersReducedMotion && (
            <motion.span
              aria-hidden="true"
              className="absolute inset-0 rounded-lg border border-lime-300"
              animate={{ scale: [1, 1.55], opacity: [0.65, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
            />
          )}
        </span>
        <span className="hidden sm:inline">Chính sách sân</span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setIsOpen(false);
            }}
          >
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              initial={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 32, scale: 0.97 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 24, scale: 0.98 }
              }
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="max-h-[92vh] w-full overflow-hidden rounded-t-2xl border border-zinc-700 bg-zinc-950 text-zinc-100 shadow-2xl sm:max-w-3xl sm:rounded-2xl"
            >
              <header className="relative border-b border-zinc-800 bg-zinc-900 px-5 py-5 pr-16 sm:px-7 sm:py-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-lime-400 text-zinc-950">
                    <ShieldCheck aria-hidden="true" className="h-6 w-6" />
                  </span>
                  <div>
                    <h2
                      id={titleId}
                      className="text-lg font-black text-white sm:text-xl"
                    >
                      Chính sách hoạt động
                    </h2>
                    <p className="mt-0.5 text-xs font-medium text-zinc-400">
                      {settings.club_name} · Cập nhật theo cấu hình hiện hành
                    </p>
                  </div>
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Đóng chính sách"
                  title="Đóng"
                  className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 transition-colors hover:border-zinc-500 hover:bg-zinc-700 hover:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-lime-400/30"
                >
                  <X aria-hidden="true" className="h-5 w-5" />
                </button>
              </header>

              <div className="max-h-[calc(92vh-104px)] overflow-y-auto px-5 py-2 sm:px-7">
                <div className="divide-y divide-zinc-800">
                  {policyItems.map(({ icon: Icon, title, content }, index) => (
                    <motion.div
                      key={title}
                      initial={
                        prefersReducedMotion ? false : { opacity: 0, x: -12 }
                      }
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: prefersReducedMotion ? 0 : index * 0.04,
                      }}
                      className="grid grid-cols-[36px_1fr] gap-3 py-4 sm:grid-cols-[40px_170px_1fr] sm:items-start sm:gap-4"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-lime-400/10 text-lime-300 sm:h-10 sm:w-10">
                        <Icon aria-hidden="true" className="h-5 w-5" />
                      </span>
                      <h3 className="self-center text-sm font-extrabold text-white sm:self-start sm:pt-2.5">
                        {title}
                      </h3>
                      <div className="col-start-2 text-sm leading-6 text-zinc-400 sm:col-start-3">
                        {content}
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="mb-5 mt-2 flex items-center gap-3 rounded-xl border border-lime-400/20 bg-lime-400/10 px-4 py-3 text-sm text-lime-100">
                  <Headphones
                    aria-hidden="true"
                    className="h-5 w-5 shrink-0 text-lime-300"
                  />
                  <p>
                    Cần hỗ trợ, vui lòng liên hệ{" "}
                    <a
                      className="font-black text-lime-300 hover:text-lime-200"
                      href={`tel:${String(settings.hotline).replace(/\D/g, "")}`}
                    >
                      {settings.hotline}
                    </a>
                    .
                  </p>
                </div>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body,
  );
};

export default CourtPolicyButton;
