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

    preparePayment: (payload) => {
        return axiosClient.post('/bookings/prepare', payload);
    },

    getIntentStatus: (intentCode) => {
        return axiosClient.get(`/booking-intents/${intentCode}/status`);
    },

    cancelUnpaid: (payload) => {
        return axiosClient.delete('/bookings/cancel-unpaid', { data: payload });
    },

    sendRequest: (payload) => {
        return axiosClient.post('/user/booking-request', payload);
    },
};
