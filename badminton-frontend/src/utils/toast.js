// Toast utility — gọi từ bất kỳ đâu, không cần context/hook
// Ví dụ: toast("Lỗi rồi!", "error") hoặc toast.success("OK")

const listeners = new Set();
let nextId = 1;

export function toast(message, type = "info", duration = 4000) {
  const id = nextId++;
  listeners.forEach((fn) => fn({ id, message, type, duration }));
  return id;
}

toast.success = (msg, dur) => toast(msg, "success", dur);
toast.error   = (msg, dur) => toast(msg, "error",   dur);
toast.warn    = (msg, dur) => toast(msg, "warning",  dur);
toast.info    = (msg, dur) => toast(msg, "info",     dur);

// Nội bộ — ToastContainer đăng ký lắng nghe
export function _subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
