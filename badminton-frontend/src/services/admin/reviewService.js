import axiosClient from "../axiosClient";

export const adminReviewService = {
  getReviews: (params = {}) => axiosClient.get("/admin/reviews", { params }),
  replyReview: (id, staff_reply) =>
    axiosClient.patch(`/admin/reviews/${id}/reply`, { staff_reply }),
  updateReviewStatus: (id, status) =>
    axiosClient.patch(`/admin/reviews/${id}/status`, { status }),
  deleteReview: (id) => axiosClient.delete(`/admin/reviews/${id}`),
};
