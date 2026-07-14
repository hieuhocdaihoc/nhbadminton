// Nhóm & sắp xếp đơn / buổi chơi theo độ gần của ngày diễn ra:
// Hôm nay → Ngày mai → 7 ngày tới → Sắp tới → Đã diễn ra (mới nhất trước).
// Dùng chung cho các trang: Danh sách đặt lẻ, Hợp đồng định kỳ, Hợp đồng dài hạn.

const MS_PER_DAY = 86400000;

/** Số ngày chênh lệch so với hôm nay (0 = hôm nay, 1 = mai, -1 = hôm qua, null = không có ngày) */
export const dayDiffFromToday = (dateStr) => {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr.slice(0, 10) + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((d - today) / MS_PER_DAY);
};

/** Nhãn tương đối ngắn gọn cho 1 ngày: "Hôm nay", "Ngày mai", "Còn 5 ngày", "3 ngày trước"... */
export const relativeDayLabel = (dateStr) => {
  const diff = dayDiffFromToday(dateStr);
  if (diff === null) return "";
  if (diff === 0) return "Hôm nay";
  if (diff === 1) return "Ngày mai";
  if (diff === 2) return "Ngày kia";
  if (diff > 2) return `Còn ${diff} ngày`;
  if (diff === -1) return "Hôm qua";
  return `${-diff} ngày trước`;
};

/** Kiểu hiển thị (màu chip) theo độ gần — càng gần càng nổi bật */
export const relativeDayStyle = (dateStr) => {
  const diff = dayDiffFromToday(dateStr);
  if (diff === null) return "bg-zinc-100 text-zinc-400";
  if (diff === 0) return "bg-emerald-100 text-emerald-700";
  if (diff === 1) return "bg-blue-50 text-blue-700";
  if (diff > 1) return "bg-zinc-100 text-zinc-500";
  return "bg-zinc-50 text-zinc-400";
};

const GROUP_ORDER = [
  { key: "today", label: "Hôm nay" },
  { key: "tomorrow", label: "Ngày mai" },
  { key: "week", label: "7 ngày tới" },
  { key: "upcoming", label: "Sắp tới" },
  { key: "past", label: "Đã diễn ra" },
  { key: "unknown", label: "Chưa có lịch" },
];

const groupKeyOf = (diff) => {
  if (diff === null) return "unknown";
  if (diff < 0) return "past";
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff <= 7) return "week";
  return "upcoming";
};

/**
 * Chia danh sách thành các nhóm theo độ gần của ngày, mỗi nhóm đã sắp xếp:
 * nhóm tương lai xếp ngày gần nhất trước (cùng ngày thì theo giờ bắt đầu),
 * nhóm "Đã diễn ra" xếp ngày mới nhất trước.
 * Trả về mảng [{ key, label, items }] theo đúng thứ tự hiển thị.
 */
export const groupByProximity = (items, getDate, getTime = () => "") => {
  const buckets = new Map();

  items.forEach((item) => {
    const diff = dayDiffFromToday(getDate(item));
    const key = groupKeyOf(diff);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push({ item, diff: diff ?? 0, time: getTime(item) || "" });
  });

  return GROUP_ORDER.filter((g) => buckets.has(g.key)).map((g) => {
    const rows = buckets.get(g.key);
    rows.sort((a, b) => {
      const byDay = g.key === "past" ? b.diff - a.diff : a.diff - b.diff;
      return byDay !== 0 ? byDay : a.time.localeCompare(b.time);
    });
    return { key: g.key, label: g.label, items: rows.map((r) => r.item) };
  });
};
