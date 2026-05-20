import axiosClient from '../axiosClient';

export const adminCourtService = {
    // Luôn luôn có tiền tố /admin và yêu cầu Token
    getAllCourts: () => axiosClient.get('/admin/courts'),
    getCourtById: (id) => axiosClient.get(`/admin/courts/${id}`),
    createCourt: (data) => axiosClient.post('/admin/courts', data),
    updateCourt: (id, data) => axiosClient.put(`/admin/courts/${id}`, data),
    deleteCourt: (id) => axiosClient.delete(`/admin/courts/${id}`),// Lấy danh sách sân
    getCourts: () =>  axiosClient.get('/admin/courts'),
};