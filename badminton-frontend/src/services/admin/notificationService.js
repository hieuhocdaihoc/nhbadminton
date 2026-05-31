import axiosClient from "../axiosClient";

export const adminNotificationService = {
  getNotifications: (limit = 10) => {
    return axiosClient.get("/admin/notifications", {
      params: { limit, _t: Date.now() },
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });
  },

  markAsRead: (id) => {
    return axiosClient.patch(`/admin/notifications/${id}/read`);
  },

  markAllAsRead: () => {
    return axiosClient.patch("/admin/notifications/read-all");
  },
};
