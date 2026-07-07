import axiosClient from "../axiosClient";

export const adminSettingService = {
  getSettings: () => {
    return axiosClient.get("/admin/settings");
  },

  updateSettings: (settings) => {
    return axiosClient.put("/admin/settings", { settings });
  },
};
