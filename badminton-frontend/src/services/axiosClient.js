import axios from 'axios';

const axiosClient = axios.create({
    baseURL: 'http://127.0.0.1:8000/api',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
});

axiosClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        // Chỉ đính kèm Token nếu nó thực sự tồn tại
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

axiosClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response) {
            const { status, data } = error.response;

            if (status === 401 && localStorage.getItem('access_token')) {
                localStorage.removeItem('access_token');
                localStorage.removeItem('current_user');
                localStorage.removeItem('current_role');
                window.location.href = '/';
            }

            if (status === 403 && data?.error_code === 'ACCOUNT_BLOCKED') {
                localStorage.removeItem('access_token');
                localStorage.removeItem('current_user');
                localStorage.removeItem('current_role');
                window.location.href = '/?blocked=1';
            }
        }
        return Promise.reject(error);
    }
);

export default axiosClient;