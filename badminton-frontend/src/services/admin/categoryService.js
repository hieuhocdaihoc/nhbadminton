import axiosClient from '../axiosClient';

export const adminCategoryService = {
    // 1. Lấy tất cả danh mục
    getCategories: () => {
        return axiosClient.get('/admin/categories');
    },

    // 2. Thêm mới danh mục
    createCategory: (payload) => {
        return axiosClient.post('/admin/categories', payload);
    },

    // 3. Cập nhật thông tin danh mục
    updateCategory: (id, payload) => {
        return axiosClient.put(`/admin/categories/${id}`, payload);
    },

    // 4. Xóa mềm (Tạm ẩn) danh mục
    deleteCategory: (id) => {
        return axiosClient.delete(`/admin/categories/${id}`);
    }
};