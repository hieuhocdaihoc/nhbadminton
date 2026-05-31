import axiosClient from '../axiosClient';

export const bookingService = {
    createBooking: (payload) => {
        return axiosClient.post('/bookings', payload);
    },

    getUserBookingHistory: (tab = 'all', page = 1) => {
        return axiosClient.get(`/user/bookings?tab=${tab}&page=${page}`);
    },

    lookupGuestBooking: (payload) => {
        return axiosClient.post('/bookings/guest-lookup', payload);
    },

    validatePromotion: (payload) => {
        return axiosClient.post('/bookings/validate-promotion', payload);
    },

    getPaymentInfo: (bookingId) => {
        return axiosClient.get(`/bookings/${bookingId}/payment-info`);
    },
};
