import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';
export const API_ORIGIN = new URL(API_BASE_URL, window.location.origin).origin;

const axiosClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
});

export const attachAuthToken = (config, storage = localStorage) => {
    const token = storage.getItem('access_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
};

export const clearStoredSession = (storage = localStorage) => {
    storage.removeItem('access_token');
    storage.removeItem('current_user');
    storage.removeItem('current_role');
};

export const handleAuthError = (
    error,
    storage = localStorage,
    redirect = (url) => { window.location.href = url; },
) => {
    if (error.response) {
        const { status, data } = error.response;

        if (status === 401 && storage.getItem('access_token')) {
            clearStoredSession(storage);
            redirect('/');
        }

        if (status === 403 && data?.error_code === 'ACCOUNT_BLOCKED') {
            clearStoredSession(storage);
            redirect('/?blocked=1');
        }
    }

    return Promise.reject(error);
};

axiosClient.interceptors.request.use(
    attachAuthToken,
    (error) => Promise.reject(error)
);

axiosClient.interceptors.response.use(
    (response) => response,
    handleAuthError
);

export default axiosClient;
