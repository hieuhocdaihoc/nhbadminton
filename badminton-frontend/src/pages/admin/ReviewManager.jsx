import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  EyeOff,
  MessageSquareReply,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { adminReviewService } from "../../services/admin/reviewService";

const statusLabels = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  hidden: "Đã ẩn",
};

const statusClasses = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  hidden: "bg-slate-100 text-slate-600 border-slate-200",
};

const ReviewManager = () => {
  const [reviews, setReviews] = useState([]);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1 });
  const [filters, setFilters] = useState({
    keyword: "",
    rating: "",
    reply_status: "",
    status: "",
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [replyDrafts, setReplyDrafts] = useState({});

  const fetchReviews = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await adminReviewService.getReviews({
        page,
        ...Object.fromEntries(
          Object.entries(filters).filter(([, value]) => value !== ""),
        ),
      });
      const payload = res.data?.data;
      setReviews(payload?.data || []);
      setPagination({
        current_page: payload?.current_page || 1,
        last_page: payload?.last_page || 1,
      });
      setReplyDrafts(
        Object.fromEntries(
          (payload?.data || []).map((review) => [
            review.id,
            review.staff_reply || "",
          ]),
        ),
      );
    } catch (error) {
      console.error(error);
      setMessage("Không thể tải danh sách đánh giá.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(() => fetchReviews(1), 300);
    return () => clearTimeout(timer);
  }, [fetchReviews]);

  const handleReply = async (reviewId) => {
    try {
      await adminReviewService.replyReview(reviewId, replyDrafts[reviewId] || "");
      setMessage("Đã lưu phản hồi.");
      fetchReviews(pagination.current_page);
    } catch (error) {
      console.error(error);
      setMessage("Không thể lưu phản hồi.");
    }
  };

  const handleStatus = async (reviewId, status) => {
    try {
      await adminReviewService.updateReviewStatus(reviewId, status);
      setMessage(`Đã chuyển đánh giá sang trạng thái "${statusLabels[status]}".`);
      fetchReviews(pagination.current_page);
    } catch (error) {
      console.error(error);
      setMessage("Không thể cập nhật trạng thái đánh giá.");
    }
  };

  const handleDelete = async (reviewId) => {
    if (!window.confirm("Xóa đánh giá này khỏi hệ thống?")) return;

    try {
      await adminReviewService.deleteReview(reviewId);
      setMessage("Đã xóa đánh giá.");
      fetchReviews(pagination.current_page);
    } catch (error) {
      console.error(error);
      setMessage("Không thể xóa đánh giá.");
    }
  };

  const renderStars = (rating) =>
    Array.from({ length: 5 }, (_, index) => (
      <Star
        key={index}
        className={`h-4 w-4 ${
          index < rating ? "fill-amber-400 text-amber-400" : "text-slate-300"
        }`}
      />
    ));

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-950">Quản lý đánh giá</h2>
          <p className="text-xs font-semibold text-slate-400">
            Theo dõi phản hồi khách hàng, duyệt nội dung và xử lý đánh giá không phù hợp
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={filters.keyword}
              onChange={(event) =>
                setFilters({ ...filters, keyword: event.target.value })
              }
              placeholder="Tên, SĐT, mã đơn..."
              className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-lime-400"
            />
          </div>
          <select
            value={filters.status}
            onChange={(event) =>
              setFilters({ ...filters, status: event.target.value })
            }
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-lime-400"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="pending">Chờ duyệt</option>
            <option value="approved">Đã duyệt</option>
            <option value="hidden">Đã ẩn</option>
          </select>
          <select
            value={filters.rating}
            onChange={(event) =>
              setFilters({ ...filters, rating: event.target.value })
            }
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-lime-400"
          >
            <option value="">Tất cả sao</option>
            {[5, 4, 3, 2, 1].map((rating) => (
              <option key={rating} value={rating}>
                {rating} sao
              </option>
            ))}
          </select>
          <select
            value={filters.reply_status}
            onChange={(event) =>
              setFilters({ ...filters, reply_status: event.target.value })
            }
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-lime-400"
          >
            <option value="">Tất cả phản hồi</option>
            <option value="unreplied">Chưa phản hồi</option>
            <option value="replied">Đã phản hồi</option>
          </select>
        </div>
      </div>

      {message && (
        <div className="rounded-lg border border-lime-200 bg-lime-50 px-4 py-3 text-sm font-bold text-lime-700">
          {message}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="p-12 text-center text-sm font-bold text-slate-400">
            Đang tải đánh giá...
          </div>
        ) : reviews.length === 0 ? (
          <div className="p-12 text-center text-sm font-bold text-slate-400">
            Chưa có đánh giá phù hợp
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {reviews.map((review) => (
              <div key={review.id} className="grid gap-4 p-4 lg:grid-cols-[1fr_360px]">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex">{renderStars(review.rating)}</div>
                    <span
                      className={`rounded-md border px-2 py-1 text-xs font-black ${
                        statusClasses[review.status] || statusClasses.pending
                      }`}
                    >
                      {statusLabels[review.status] || "Chờ duyệt"}
                    </span>
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">
                      {review.court?.name || "Sân"}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">
                      {review.booking?.booking_code || "Không có mã đơn"}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900">
                      {review.user?.full_name || "Khách hàng"}
                    </p>
                    <p className="text-sm leading-6 text-slate-600">
                      {review.comment}
                    </p>
                  </div>
                  {review.staff_reply && (
                    <div className="rounded-lg bg-lime-50 p-3 text-sm text-lime-800">
                      <strong>Phản hồi:</strong> {review.staff_reply}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <textarea
                    value={replyDrafts[review.id] || ""}
                    onChange={(event) =>
                      setReplyDrafts({
                        ...replyDrafts,
                        [review.id]: event.target.value,
                      })
                    }
                    rows={4}
                    placeholder="Nhập phản hồi của trung tâm..."
                    className="w-full resize-none rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-lime-400"
                  />
                  <div className="flex flex-wrap justify-end gap-2">
                    {review.status !== "approved" && (
                      <button
                        type="button"
                        onClick={() => handleStatus(review.id, "approved")}
                        className="inline-flex items-center gap-2 rounded-lg border border-emerald-100 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Duyệt
                      </button>
                    )}
                    {review.status !== "hidden" && (
                      <button
                        type="button"
                        onClick={() => handleStatus(review.id, "hidden")}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                      >
                        <EyeOff className="h-4 w-4" />
                        Ẩn
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(review.id)}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-100 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Xóa
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReply(review.id)}
                      className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
                    >
                      <MessageSquareReply className="h-4 w-4" />
                      Lưu phản hồi
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {pagination.last_page > 1 && (
        <div className="flex justify-center gap-2">
          <button
            disabled={pagination.current_page === 1}
            onClick={() => fetchReviews(pagination.current_page - 1)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold disabled:opacity-40"
          >
            Trước
          </button>
          <span className="px-3 py-2 text-sm font-bold text-slate-500">
            {pagination.current_page}/{pagination.last_page}
          </span>
          <button
            disabled={pagination.current_page === pagination.last_page}
            onClick={() => fetchReviews(pagination.current_page + 1)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold disabled:opacity-40"
          >
            Sau
          </button>
        </div>
      )}
    </div>
  );
};

export default ReviewManager;
