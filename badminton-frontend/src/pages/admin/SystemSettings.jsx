import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { adminSettingService } from "../../services/admin/settingService";
import LocationPicker from "../../components/admin/LocationPicker";

const SIMPLE_GROUPS = [
  {
    title: "Thông tin chung",
    fields: [
      { key: "club_name", label: "Tên trung tâm", placeholder: "NH Badminton" },
      {
        key: "description",
        label: "Mô tả ngắn",
        type: "textarea",
        placeholder: "Hệ thống đặt lịch và quản lý sân cầu lông chuyên nghiệp...",
      },
    ],
  },
  {
    title: "Giờ hoạt động",
    fields: [
      { key: "weekday_hours", label: "Thứ 2 - Thứ 6", placeholder: "05:00 - 23:00" },
      { key: "weekend_hours", label: "Thứ 7 - Chủ nhật", placeholder: "06:00 - 23:00" },
      { key: "holiday_hours", label: "Ngày lễ / Tết", placeholder: "07:00 - 22:00" },
    ],
  },
  {
    title: "Mạng xã hội",
    fields: [
      { key: "facebook_url", label: "Facebook", placeholder: "https://facebook.com/..." },
      { key: "instagram_url", label: "Instagram", placeholder: "https://instagram.com/..." },
      { key: "youtube_url", label: "YouTube", placeholder: "https://youtube.com/..." },
    ],
  },
];

const SystemSettings = () => {
  const [settings, setSettings] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const res = await adminSettingService.getSettings();
      setSettings(res.data?.data || {});
    } catch (error) {
      setMessage({ type: "error", text: "Không thể tải cấu hình hệ thống." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage({ type: "", text: "" });
    try {
      // map_url không còn ô nhập riêng, luôn để trống -> Footer/HomePage tự tạo link từ địa chỉ
      await adminSettingService.updateSettings({ ...settings, map_url: "" });
      setMessage({ type: "success", text: "Đã lưu cấu hình hệ thống thành công!" });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Lưu cấu hình thất bại.",
      });
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage({ type: "", text: "" }), 2500);
    }
  };

  const inputClass =
    "admin-input";

  if (isLoading) {
    return (
      <div className="max-w-[1000px] mx-auto py-24 text-center">
        <div className="inline-block w-6 h-6 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin mb-3" />
        <p className="text-xs text-zinc-400">Đang tải cấu hình...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1000px] mx-auto space-y-5">
      <div>
        <h2 className="admin-page-title">
          Cấu hình hệ thống
        </h2>
        <p className="admin-page-subtitle">
          Thông tin liên hệ, giờ hoạt động hiển thị ở trang chủ và footer.
          Thay đổi ở đây sẽ tự động cập nhật ngoài website, không cần sửa code.
        </p>
      </div>

      <AnimatePresence>
        {message.text && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`p-3 rounded-lg text-xs font-medium ${message.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-600 border border-red-200"}`}
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ═══ KHỐI RIÊNG: ĐỊA CHỈ + BẢN ĐỒ ═══ */}
        <div className="admin-card p-5">
          <h3 className="text-sm font-semibold text-zinc-800 mb-1">
            Địa chỉ & Bản đồ
          </h3>
          <p className="text-[11px] text-zinc-400 mb-4">
            Click hoặc kéo ghim trên bản đồ bên dưới để chọn đúng vị trí.
            Hệ thống sẽ thử dò địa chỉ tự động, nhưng bạn nên kiểm tra và sửa
            lại ô địa chỉ bên dưới cho chính xác (bản đồ miễn phí OpenStreetMap
            không có dữ liệu chi tiết đến từng ấp/xã ở khu vực nông thôn).
          </p>

          <LocationPicker
            lat={settings.map_lat}
            lng={settings.map_lng}
            onPick={({ lat, lng, address }) => {
              setSettings((prev) => ({
                ...prev,
                map_lat: String(lat),
                map_lng: String(lng),
                address: address || prev.address,
              }));
            }}
          />

          <div className="mt-4">
            <label className="admin-form-label">
              Địa chỉ trung tâm (tự điền sau khi chọn trên bản đồ, có thể sửa lại)
            </label>
            <input
              type="text"
              value={settings.address || ""}
              onChange={(e) => handleChange("address", e.target.value)}
              placeholder="Chọn vị trí trên bản đồ ở trên để tự điền"
              className={inputClass}
            />
          </div>
        </div>

        {/* ═══ KHỐI RIÊNG: ĐẶT CỌC & THANH TOÁN ═══ */}
        <div className="admin-card p-5">
          <h3 className="text-sm font-semibold text-zinc-800 mb-1">
            Đặt cọc & thanh toán
          </h3>
          <p className="text-[11px] text-zinc-400 mb-4">
            Tỷ lệ % tổng tiền đơn mà khách cần chuyển khoản trước để giữ chỗ khi đặt
            sân lẻ (phần còn lại thanh toán tại sân). Không hoàn lại tiền cọc nếu
            khách hủy hoặc không đến.
          </p>
          <div className="max-w-[200px]">
            <label className="admin-form-label">
              Tỷ lệ đặt cọc (%)
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                max="100"
                step="1"
                value={settings.deposit_percent || ""}
                onChange={(e) => handleChange("deposit_percent", e.target.value)}
                placeholder="20"
                className={inputClass}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-bold">%</span>
            </div>
          </div>

          <p className="text-[11px] text-zinc-400 mt-5 mb-4">
            Khách chỉ được gửi yêu cầu hủy/đổi lịch khi còn cách giờ chơi của buổi
            sớm nhất ít nhất số giờ dưới đây.
          </p>
          <div className="max-w-[200px]">
            <label className="admin-form-label">
              Hạn gửi yêu cầu hủy/đổi (giờ)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="1"
                value={settings.cancel_request_min_hours || ""}
                onChange={(e) => handleChange("cancel_request_min_hours", e.target.value)}
                placeholder="24"
                className={inputClass}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-bold">giờ</span>
            </div>
          </div>

          <p className="text-[11px] text-zinc-400 mt-5 mb-4">
            Khi khách chơi quá giờ đã đặt, hệ thống miễn phí số phút dưới đây; quá mức
            này mới tính phụ trội theo giá/giờ của buổi.
          </p>
          <div className="max-w-[200px]">
            <label className="admin-form-label">
              Ân hạn quá giờ (phút)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="1"
                value={settings.overtime_grace_minutes || ""}
                onChange={(e) => handleChange("overtime_grace_minutes", e.target.value)}
                placeholder="15"
                className={inputClass}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-bold">phút</span>
            </div>
          </div>
        </div>

        {/* ═══ KHỐI RIÊNG: HOTLINE + EMAIL ═══ */}
        <div className="admin-card p-5">
          <h3 className="text-sm font-semibold text-zinc-800 mb-4 pb-3 border-b border-zinc-100">
            Liên hệ
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="admin-form-label">
                Hotline
              </label>
              <input
                type="text"
                value={settings.hotline || ""}
                onChange={(e) => handleChange("hotline", e.target.value)}
                placeholder="0901234567"
                className={inputClass}
              />
            </div>
            <div>
              <label className="admin-form-label">
                Email
              </label>
              <input
                type="text"
                value={settings.email || ""}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="lienhe@nhbadminton.vn"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {SIMPLE_GROUPS.map((group) => (
          <div
            key={group.title}
            className="admin-card p-5"
          >
            <h3 className="text-sm font-semibold text-zinc-800 mb-4 pb-3 border-b border-zinc-100">
              {group.title}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {group.fields.map((field) => (
                <div
                  key={field.key}
                  className={field.type === "textarea" ? "sm:col-span-2" : ""}
                >
                  <label className="admin-form-label">
                    {field.label}
                  </label>
                  {field.type === "textarea" ? (
                    <textarea
                      rows="3"
                      value={settings[field.key] || ""}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className={`${inputClass} resize-none`}
                    />
                  ) : (
                    <input
                      type="text"
                      value={settings[field.key] || ""}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className={inputClass}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="flex justify-end pb-10">
          <button
            type="submit"
            disabled={isSaving}
            className={`admin-btn-primary px-6 py-2.5 ${isSaving ? "opacity-60 cursor-not-allowed shadow-none hover:translate-y-0" : ""}`}
          >
            {isSaving ? "Đang lưu..." : "Lưu cấu hình"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SystemSettings;
