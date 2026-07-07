import React from "react";

// Empty-state chuẩn dùng chung cho toàn bộ trang admin — thay thế text trơn
// "Chưa có dữ liệu" hoặc emoji rải rác trước đây. Nhận 1 icon component từ lucide-react.
const EmptyState = ({ icon: Icon, title = "Chưa có dữ liệu", description, action }) => (
  <div className="py-16 text-center">
    {Icon && (
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-zinc-100 text-zinc-400 mb-3">
        <Icon className="w-6 h-6" strokeWidth={1.75} />
      </div>
    )}
    <p className="text-sm font-semibold text-zinc-500">{title}</p>
    {description && <p className="text-xs text-zinc-400 mt-1">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export default EmptyState;
