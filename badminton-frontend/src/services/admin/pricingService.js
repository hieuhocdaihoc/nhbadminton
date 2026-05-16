import axiosClient from '../axiosClient';

export const pricingService = {
    // 1. Lấy toàn bộ danh sách cấu hình giá
    getAllPricings: () => {
        return axiosClient.get('/admin/court-pricing');
    },

    // 2. Thêm cấu hình giá mới
    createPricing: (pricingData) => {
        return axiosClient.post('/admin/court-pricing', pricingData);
    },

    // 3. Xem chi tiết 1 cấu hình
    getPricingById: (id) => {
        return axiosClient.get(`/admin/court-pricing/${id}`);
    },

    // 4. Cập nhật cấu hình giá
    updatePricing: (id, pricingData) => {
        return axiosClient.put(`/admin/court-pricing/${id}`, pricingData);
    },

    // 5. Xóa cấu hình giá
    deletePricing: (id) => {
        return axiosClient.delete(`/admin/court-pricing/${id}`);
    },

    // 6. Test công cụ tính tiền tự động
    calculatePrice: (payload) => {
        return axiosClient.post('/admin/court-pricing/calculate', payload);
    }
};