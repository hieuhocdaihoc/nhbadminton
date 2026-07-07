import axiosClient from "./axiosClient";

// Service công khai - không cần đăng nhập, dùng cho Footer/Trang chủ
export const settingService = {
  getPublicSettings: () => {
    return axiosClient.get("/settings");
  },
};
