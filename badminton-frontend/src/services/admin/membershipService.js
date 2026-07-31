import axiosClient from '../axiosClient';

const base = '/admin/membership';

export const membershipService = {
    // Gói thành viên
    getPackages: () => axiosClient.get(`${base}/packages`),
    createPackage: (data) => axiosClient.post(`${base}/packages`, data),
    updatePackage: (id, data) => axiosClient.put(`${base}/packages/${id}`, data),
    deletePackage: (id) => axiosClient.delete(`${base}/packages/${id}`),

    // Thẻ thành viên
    getCards: (params) => axiosClient.get(`${base}/cards`, { params }),
    getCard: (id) => axiosClient.get(`${base}/cards/${id}`),
    createCard: (data) => axiosClient.post(`${base}/cards`, data),
    activateCard: (id) => axiosClient.patch(`${base}/cards/${id}/activate`),
    cancelCard: (id) => axiosClient.patch(`${base}/cards/${id}/cancel`),
};
