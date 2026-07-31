import axiosClient from '../axiosClient';

export const authService = {
    // ==========================================
    // 1. NHÓM AUTHENTICATION
    // ==========================================
    login: (phone, password) => {
        return axiosClient.post('/login', { phone, password });
    },

    register: (fullName, phone, email, password) => {
        return axiosClient.post('/register', {
            full_name: fullName,
            phone: phone,
            email: email,
            password: password
        });
    },

    logout: () => {
        return axiosClient.post('/logout');
    },

    // ==========================================
    // 2. NHÓM PROFILE & BẢO MẬT
    // ==========================================

    getProfile: () => {
        return axiosClient.get('/profile');
    },

    // --- ĐÃ FIX: ĐỔI TỪ PUT('/profile') SANG POST('/update-profile') ---
    updateProfile: (profileData) => {
        return axiosClient.put('/update-profile', {
            full_name: profileData.fullName,
            email: profileData.email,
            phone: profileData.phone,
            gender: profileData.gender,
            date_of_birth: profileData.dateOfBirth
        });
    },

    changePassword: (oldPassword, newPassword, newPasswordConfirmation) => {
        return axiosClient.post('/change-password', {
            old_password: oldPassword,
            new_password: newPassword,
            new_password_confirmation: newPasswordConfirmation
        });
    },

    uploadAvatar: (file) => {
        const formData = new FormData();
        formData.append('image', file);
        return axiosClient.post('/avatar', formData, {
            // Bỏ Content-Type mặc định (application/json) để trình duyệt tự thêm boundary cho multipart
            headers: { 'Content-Type': undefined }
        });
    }
};
