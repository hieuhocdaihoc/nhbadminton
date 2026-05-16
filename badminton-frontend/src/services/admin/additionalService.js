import axiosClient from '../axiosClient';

export const adminAdditionalService = {
    // 1. Lấy tất cả dịch vụ
    getServices: () => {
        return axiosClient.get('/admin/services');
    },

    // 2. Thêm mới dịch vụ
    createService: (payload) => {
        return axiosClient.post('/admin/services', payload);
    },

    // 3. Cập nhật thông tin dịch vụ
    updateService: (id, payload) => {
        return axiosClient.put(`/admin/services/${id}`, payload);
    },

    // 4. Xóa mềm (Tạm ẩn) dịch vụ
    deleteService: (id) => {
        return axiosClient.delete(`/admin/services/${id}`);
    }
};