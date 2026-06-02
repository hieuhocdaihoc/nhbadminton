import axiosClient from "../axiosClient";

export const reviewService = {
  getPublicReviews: (params = {}) => axiosClient.get("/reviews", { params }),
  createReview: (payload) => axiosClient.post("/reviews", payload),
};
