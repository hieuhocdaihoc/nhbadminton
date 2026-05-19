import axiosClient from '../axiosClient';

export const adminUserService = {
    /**
     * -------------------------------------------------------------
     * LẤY TẤT CẢ TÀI KHOẢN
     * -------------------------------------------------------------
     */
    getUsers: (params = {}) => {
        return axiosClient.get('/admin/users', { params });
    },

    /**
     * -------------------------------------------------------------
     * LẤY DANH SÁCH KHÁCH HÀNG
     * -------------------------------------------------------------
     */
    getCustomers: (params = {}) => {
        return axiosClient.get('/admin/users', {
            params: {
                role: 'customer',
                ...params,
            },
        });
    },

    /**
     * -------------------------------------------------------------
     * LẤY DANH SÁCH NHÂN VIÊN
     * -------------------------------------------------------------
     */
    getStaffs: (params = {}) => {
        return axiosClient.get('/admin/users', {
            params: {
                role: 'staff',
                ...params,
            },
        });
    },

    /**
     * -------------------------------------------------------------
     * TẠO TÀI KHOẢN MỚI
     * -------------------------------------------------------------
     */
    createUser: (payload) => {
        return axiosClient.post('/admin/users', payload);
    },

    /**
     * -------------------------------------------------------------
     * CẬP NHẬT TÀI KHOẢN
     * -------------------------------------------------------------
     */
    updateUser: (id, payload) => {
        return axiosClient.put(`/admin/users/${id}`, payload);
    },

    /**
     * -------------------------------------------------------------
     * KHÓA / MỞ KHÓA TÀI KHOẢN
     * -------------------------------------------------------------
     */
    updateStatus: (id, status) => {
        return axiosClient.patch(`/admin/users/${id}/status`, { status });
    },

    /**
     * -------------------------------------------------------------
     * RESET MẬT KHẨU
     * -------------------------------------------------------------
     */
    resetPassword: (id, payload) => {
        return axiosClient.patch(`/admin/users/${id}/reset-password`, payload);
    },

    /**
     * -------------------------------------------------------------
     * LẤY CHI TIẾT TÀI KHOẢN
     * -------------------------------------------------------------
     */
    getUserDetail: (id) => {
        return axiosClient.get(`/admin/users/${id}`);
    },
    /**
     * -------------------------------------------------------------
     * THỐNG KÊ ĐƠN ĐẶT SÂN CỦA TÀI KHOẢN
     * -------------------------------------------------------------
     */
    getBookingStats: (id) => {
        return axiosClient.get(`/admin/users/${id}/booking-stats`);
    },
};