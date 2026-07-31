import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { _subscribe } from "../utils/toast";

const ICONS = {
  success: "✓",
  error:   "✕",
  warning: "⚠",
  info:    "ℹ",
};

const STYLES = {
  success: "bg-emerald-600 text-white",
  error:   "bg-red-600 text-white",
  warning: "bg-amber-500 text-white",
  info:    "bg-zinc-800 text-white",
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    return _subscribe(({ id, message, type, duration }) => {
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    });
  }, []);

  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 360 }}>
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 60, scale: 0.95 }}
            animate={{ opacity: 1, x: 0,  scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium ${STYLES[t.type] ?? STYLES.info}`}
          >
            <span className="mt-0.5 text-base leading-none font-bold">{ICONS[t.type] ?? ICONS.info}</span>
            <span className="leading-snug">{t.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
