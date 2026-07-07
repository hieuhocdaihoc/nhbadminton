import axiosClient from "../axiosClient";

export const imageService = {
  upload: (file, targetType, targetId, isPrimary = true) => {
    const formData = new FormData();
    formData.append("image", file);
    formData.append("target_type", targetType);
    formData.append("target_id", targetId);
    formData.append("is_primary", isPrimary ? 1 : 0);
    return axiosClient.post("/admin/images", formData, {
      // Bỏ Content-Type mặc định (application/json) để trình duyệt tự thêm boundary cho multipart
      headers: { "Content-Type": undefined },
    });
  },

  remove: (id) => {
    return axiosClient.delete(`/admin/images/${id}`);
  },
};
