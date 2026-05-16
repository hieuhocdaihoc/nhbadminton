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
        // Chỉ xử lý lỗi 401 nếu API đó không phải là API Public
        // Hoặc đơn giản là xóa token cũ nếu Server bảo nó không hợp lệ
        if (error.response && error.response.status === 401) {
            console.warn('Lưu ý: Token hết hạn hoặc không hợp lệ.');
            // localStorage.removeItem('access_token'); // Tùy chọn xóa để lần sau gửi request sạch
        }
        return Promise.reject(error);
    }
);

export default axiosClient;