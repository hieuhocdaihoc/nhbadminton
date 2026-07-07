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
  pending: "badge-warning",
  approved: "badge-success",
  hidden: "badge-neutral",
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
          <h2 className="admin-page-title text-2xl">Quản lý đánh giá</h2>
          <p className="admin-page-subtitle text-sm mt-1">
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
              className="admin-input h-10 w-full pl-9 pr-3 text-sm"
            />
          </div>
          <select
            value={filters.status}
            onChange={(event) =>
              setFilters({ ...filters, status: event.target.value })
            }
            className="admin-input h-10 px-3 text-sm"
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
            className="admin-input h-10 px-3 text-sm"
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
            className="admin-input h-10 px-3 text-sm"
          >
            <option value="">Tất cả phản hồi</option>
            <option value="unreplied">Chưa phản hồi</option>
            <option value="replied">Đã phản hồi</option>
          </select>
        </div>
      </div>

      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {message}
        </div>
      )}

      <div className="admin-card overflow-hidden">
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
                      className={`admin-badge px-2 py-1 text-xs ${
                        statusClasses[review.status] || statusClasses.pending
                      }`}
                    >
                      {statusLabels[review.status] || "Chờ duyệt"}
                    </span>
                    <span className="admin-badge badge-neutral px-2 py-1 text-xs">
                      {review.court?.name || "Sân"}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">
                      {review.booking?.booking_code || "Không có mã đơn"}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {review.user?.avatar_url ? (
                        <img
                          src={review.user.avatar_url}
                          alt={review.user?.full_name}
                          className="w-6 h-6 rounded-full object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold">
                          {(review.user?.full_name || "KH").trim().charAt(0).toUpperCase()}
                        </div>
                      )}
                      <p className="text-sm font-black text-slate-900">
                        {review.user?.full_name || "Khách hàng"}
                      </p>
                    </div>
                    <p className="text-sm leading-6 text-slate-600">
                      {review.comment}
                    </p>
                  </div>
                  {review.staff_reply && (
                    <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
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
                    className="admin-input w-full resize-none p-3 text-sm"
                  />
                  <div className="flex flex-wrap justify-end gap-2">
                    {review.status !== "approved" && (
                      <button
                        type="button"
                        onClick={() => handleStatus(review.id, "approved")}
                        className="admin-btn-outline flex items-center gap-2 px-3 py-2 text-xs"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Duyệt
                      </button>
                    )}
                    {review.status !== "hidden" && (
                      <button
                        type="button"
                        onClick={() => handleStatus(review.id, "hidden")}
                        className="admin-btn-outline flex items-center gap-2 px-3 py-2 text-xs"
                      >
                        <EyeOff className="h-4 w-4" />
                        Ẩn
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(review.id)}
                      className="admin-btn-danger flex items-center gap-2 px-3 py-2 text-xs"
                    >
                      <Trash2 className="h-4 w-4" />
                      Xóa
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReply(review.id)}
                      className="admin-btn-secondary flex items-center gap-2 px-3 py-2 text-xs"
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
            className="admin-btn-outline px-3 py-2 text-sm disabled:opacity-40"
          >
            Trước
          </button>
          <span className="px-3 py-2 text-sm font-bold text-slate-500">
            {pagination.current_page}/{pagination.last_page}
          </span>
          <button
            disabled={pagination.current_page === pagination.last_page}
            onClick={() => fetchReviews(pagination.current_page + 1)}
            className="admin-btn-outline px-3 py-2 text-sm disabled:opacity-40"
          >
            Sau
          </button>
        </div>
      )}
    </div>
  );
};

export default ReviewManager;
