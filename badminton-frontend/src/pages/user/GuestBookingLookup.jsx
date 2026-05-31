import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  CalendarDays,
  Clock3,
  CreditCard,
  FileSearch,
  Loader2,
  Phone,
  ReceiptText,
  Search,
  WalletCards,
} from "lucide-react";
import { bookingService } from "../../services/user/bookingService";

const currency = (value) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;

const statusMap = {
  pending: {
    label: "Chờ xác nhận",
    className: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  },
  confirmed: {
    label: "Đã xác nhận",
    className: "bg-sky-500/10 text-sky-300 border-sky-500/20",
  },
  completed: {
    label: "Hoàn thành",
    className: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  },
  cancelled: {
    label: "Đã hủy",
    className: "bg-red-500/10 text-red-300 border-red-500/20",
  },
};

const paymentMap = {
  unpaid: {
    label: "Chưa thanh toán",
    className: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  },
  partially_paid: {
    label: "Thanh toán một phần",
    className: "bg-sky-500/10 text-sky-300 border-sky-500/20",
  },
  paid: {
    label: "Đã thanh toán",
    className: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  },
};

const Pill = ({ item }) => (
  <span
    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${item.className}`}
  >
    {item.label}
  </span>
);

const GuestBookingLookup = () => {
  const [form, setForm] = useState({ booking_code: "", customer_phone: "" });
  const [booking, setBooking] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const totalServices = useMemo(
    () =>
      booking?.services?.reduce(
        (sum, item) => sum + Number(item.total_price || 0),
        0,
      ) || 0,
    [booking],
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage("");
    setBooking(null);

    try {
      const response = await bookingService.lookupGuestBooking({
        booking_code: form.booking_code.trim(),
        customer_phone: form.customer_phone.trim(),
      });
      setBooking(response.data?.data || null);
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message ||
          "Không tìm thấy đơn phù hợp. Bạn kiểm tra lại mã đơn và số điện thoại nhé.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <section className="border-b border-zinc-800/70 bg-[radial-gradient(circle_at_top_left,rgba(132,204,22,0.18),transparent_34%),linear-gradient(135deg,#09090b_0%,#18181b_55%,#0f172a_100%)]">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:py-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col justify-center"
          >
            <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-lime-400/20 bg-lime-400/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-lime-300">
              <FileSearch className="h-4 w-4" />
              Tra cứu nhanh
            </div>
            <h1 className="max-w-xl text-3xl font-black tracking-tight sm:text-4xl">
              Xem tình trạng đơn đặt sân
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-400">
              Dành cho khách đặt sân không đăng nhập. Nhập đúng mã đơn và số
              điện thoại đã đặt để xem lịch chơi, trạng thái xác nhận và thanh
              toán.
            </p>
          </motion.div>

          <motion.form
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            onSubmit={handleSubmit}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-2xl shadow-black/30 backdrop-blur"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-zinc-500">
                  <ReceiptText className="h-4 w-4" />
                  Mã đơn
                </span>
                <input
                  name="booking_code"
                  value={form.booking_code}
                  onChange={handleChange}
                  placeholder="VD: BILL_AB12CD"
                  className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-sm font-bold text-white outline-none transition focus:border-lime-400"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-zinc-500">
                  <Phone className="h-4 w-4" />
                  Số điện thoại
                </span>
                <input
                  name="customer_phone"
                  value={form.customer_phone}
                  onChange={handleChange}
                  placeholder="VD: 0901234567"
                  className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-sm font-bold text-white outline-none transition focus:border-lime-400"
                  required
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-lime-500 px-5 text-sm font-black uppercase tracking-wide text-zinc-950 transition hover:bg-lime-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Search className="h-5 w-5" />
              )}
              Tra cứu đơn
            </button>
            {errorMessage && (
              <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">
                {errorMessage}
              </p>
            )}
          </motion.form>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {!booking ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/35 px-6 py-16 text-center">
            <FileSearch className="mx-auto h-10 w-10 text-zinc-700" />
            <p className="mt-4 text-sm font-bold text-zinc-400">
              Thông tin đơn sẽ hiển thị tại đây sau khi tra cứu.
            </p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]"
          >
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/55 p-5">
              <div className="flex flex-col gap-3 border-b border-zinc-800 pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                    Mã đơn
                  </p>
                  <h2 className="mt-1 font-mono text-2xl font-black text-white">
                    {booking.booking_code}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    {booking.customer_name} · {booking.customer_phone}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Pill
                    item={
                      statusMap[booking.status] || {
                        label: booking.status,
                        className: "bg-zinc-800 text-zinc-300 border-zinc-700",
                      }
                    }
                  />
                  <Pill
                    item={
                      paymentMap[booking.payment_status] || {
                        label: booking.payment_status,
                        className: "bg-zinc-800 text-zinc-300 border-zinc-700",
                      }
                    }
                  />
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-zinc-950/70 p-4">
                  <CalendarDays className="mb-3 h-5 w-5 text-lime-300" />
                  <p className="text-xs font-bold uppercase text-zinc-500">
                    Ngày chơi
                  </p>
                  <p className="mt-1 text-sm font-bold text-white">
                    {booking.summary?.play_date || "-"}
                  </p>
                </div>
                <div className="rounded-xl bg-zinc-950/70 p-4">
                  <Clock3 className="mb-3 h-5 w-5 text-sky-300" />
                  <p className="text-xs font-bold uppercase text-zinc-500">
                    Khung giờ
                  </p>
                  <p className="mt-1 text-sm font-bold text-white">
                    {booking.summary?.time_slot || "-"}
                  </p>
                </div>
                <div className="rounded-xl bg-zinc-950/70 p-4">
                  <BadgeCheck className="mb-3 h-5 w-5 text-emerald-300" />
                  <p className="text-xs font-bold uppercase text-zinc-500">
                    Loại đơn
                  </p>
                  <p className="mt-1 text-sm font-bold text-white">
                    {booking.type_label}
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-black uppercase tracking-wide text-zinc-300">
                  Chi tiết sân
                </h3>
                <div className="mt-3 overflow-hidden rounded-xl border border-zinc-800">
                  {booking.details?.map((detail) => (
                    <div
                      key={detail.id}
                      className="grid gap-3 border-b border-zinc-800 bg-zinc-950/40 p-4 last:border-b-0 sm:grid-cols-[1.1fr_1fr_0.8fr]"
                    >
                      <div>
                        <p className="text-sm font-bold text-white">
                          {detail.court_name || detail.court_code || "Sân"}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {detail.booking_date}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-zinc-300">
                        {detail.start_time} - {detail.end_time}
                      </p>
                      <p className="text-sm font-black text-lime-300 sm:text-right">
                        {currency(detail.price)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {booking.services?.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-black uppercase tracking-wide text-zinc-300">
                    Dịch vụ / hàng hóa
                  </h3>
                  <div className="mt-3 overflow-hidden rounded-xl border border-zinc-800">
                    {booking.services.map((item) => (
                      <div
                        key={item.id}
                        className="grid gap-3 border-b border-zinc-800 bg-zinc-950/40 p-4 last:border-b-0 sm:grid-cols-[1.2fr_0.4fr_0.8fr]"
                      >
                        <p className="text-sm font-bold text-white">
                          {item.name}
                        </p>
                        <p className="text-sm font-semibold text-zinc-400">
                          x{item.quantity}
                        </p>
                        <p className="text-sm font-black text-lime-300 sm:text-right">
                          {currency(item.total_price)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <aside className="rounded-2xl border border-zinc-800 bg-zinc-900/55 p-5">
              <div className="mb-5 flex items-center gap-2">
                <WalletCards className="h-5 w-5 text-lime-300" />
                <h3 className="text-sm font-black uppercase tracking-wide text-zinc-300">
                  Thanh toán
                </h3>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-zinc-400">
                  <span>Tiền sân</span>
                  <strong className="text-white">
                    {currency(booking.subtotal_court)}
                  </strong>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Dịch vụ</span>
                  <strong className="text-white">
                    {currency(totalServices || booking.subtotal_service)}
                  </strong>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Giảm giá</span>
                  <strong className="text-emerald-300">
                    -{currency(booking.discount_amount)}
                  </strong>
                </div>
                <div className="border-t border-zinc-800 pt-3">
                  <div className="flex justify-between">
                    <span className="font-bold text-zinc-300">Tổng tiền</span>
                    <strong className="text-xl text-lime-300">
                      {currency(booking.total_price)}
                    </strong>
                  </div>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Đã thanh toán</span>
                  <strong className="text-white">
                    {currency(booking.deposit_amount)}
                  </strong>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Còn lại</span>
                  <strong className="text-white">
                    {currency(booking.remaining_amount)}
                  </strong>
                </div>
              </div>
              <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <div className="flex items-start gap-3">
                  <CreditCard className="mt-0.5 h-5 w-5 text-sky-300" />
                  <p className="text-xs leading-5 text-zinc-400">
                    Khi đến sân, bạn chỉ cần đọc mã đơn này cho nhân viên để
                    check-in hoặc thanh toán phần còn lại.
                  </p>
                </div>
              </div>
            </aside>
          </motion.div>
        )}
      </section>
    </div>
  );
};

export default GuestBookingLookup;
