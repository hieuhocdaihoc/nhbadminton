import React from "react";

// Spinner chuẩn dùng chung cho toàn bộ trang admin — thay thế các biến thể
// border-t-zinc-600/zinc-800/amber-500/lime-600 rải rác trước đây.
const LoadingSpinner = ({ label = "Đang tải...", className = "py-16" }) => (
  <div className={`text-center ${className}`}>
    <div className="inline-block w-6 h-6 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin mb-3" />
    {label && <p className="text-xs text-zinc-400">{label}</p>}
  </div>
);

export default LoadingSpinner;
