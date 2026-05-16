import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { authService } from '../../services/auth/authService';

const AuthModal = ({ isOpen, onClose, initialMode = 'login', onLoginSuccess }) => {
    const [mode, setMode] = useState(initialMode);

    // Form states
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');

    // State xử lý trạng thái gọi API
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    // XỬ LÝ GỌI API BACKEND THỰC TẾ
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMessage(''); // Xóa lỗi cũ

        if (mode === 'login') {
            try {
                // Gọi sang Laravel: $request->phone và $request->password
                const response = await authService.login(phone, password);

                // Laravel trả về thành công (200 OK)
                const { access_token, user } = response.data;

                // 1. Lưu token vào localStorage để các API sau tự động lấy
                localStorage.setItem('access_token', access_token);
                localStorage.setItem('current_user', JSON.stringify(user));

                console.log('Đăng nhập thành công:', user);

                // 2. KÍCH HOẠT PHÂN LUỒNG (ADMIN vs USER)
                if (user.role === 'admin' || user.role === 'staff') {
                    // Chuyển hướng thẳng sang luồng Dashboard của Admin
                    window.location.href = '/admin';
                } else {
                    // Khách hàng thường: Đóng popup, truyền user thật cho Header
                    onLoginSuccess(user);
                    onClose();
                }

            } catch (error) {
                console.error('Lỗi đăng nhập:', error);
                if (error.response && error.response.data) {
                    setErrorMessage(error.response.data.message || 'Thông tin đăng nhập không chính xác');
                } else {
                    setErrorMessage('Không thể kết nối đến máy chủ. Vui lòng thử lại!');
                }
            } finally {
                setIsLoading(false);
            }

        } else {
            // Xử lý Đăng ký (Register)
            try {
                await authService.register(fullName, phone, email, password);
                console.log('Đăng ký thành công');
                setMode('login');
                setErrorMessage('🎉 Đăng ký thành công! Vui lòng đăng nhập.');
                setPassword(''); // Xóa trắng mật khẩu
            } catch (error) {
                if (error.response && error.response.data && error.response.data.errors) {
                    const firstError = Object.values(error.response.data.errors)[0][0];
                    setErrorMessage(firstError);
                } else {
                    setErrorMessage('Đăng ký thất bại. Vui lòng kiểm tra lại thông tin.');
                }
            } finally {
                setIsLoading(false);
            }
        }
    };

    const backdropVariant = { hidden: { opacity: 0 }, visible: { opacity: 1 } };
    const modalVariant = {
        hidden: { opacity: 0, scale: 0.95, y: 15 },
        visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.2, type: 'spring', stiffness: 300, damping: 25 } },
        exit: { opacity: 0, scale: 0.95, y: 15, transition: { duration: 0.15 } }
    };

    // --- KIỂM TRA AN TOÀN DOM TRƯỚC KHI RENDER PORTAL ---
    if (!isOpen || typeof document === 'undefined' || !document.body) {
        return null;
    }

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    variants={backdropVariant}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                    onClick={onClose}
                    className="fixed top-0 left-0 w-screen h-screen z-[99999] bg-zinc-900/70 backdrop-blur-md flex items-center justify-center p-4 overflow-hidden"
                >
                    <motion.div
                        variants={modalVariant}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-zinc-100 overflow-hidden relative my-auto mx-auto"
                    >
                        {/* Nút đóng */}
                        <button onClick={onClose} className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors z-10 focus:outline-none">
                            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41Z" /></svg>
                        </button>

                        {/* Header Modal */}
                        <div className="px-8 pt-8 pb-6 text-center bg-gradient-to-b from-blue-50/50 to-white">
                            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-xl tracking-tighter mx-auto mb-3 shadow-md shadow-blue-600/20">NH</div>
                            <h3 className="text-2xl font-black text-zinc-900 tracking-tight">
                                {mode === 'login' ? 'Chào mừng trở lại!' : 'Tạo tài khoản NH'}
                            </h3>
                            <p className="text-xs text-zinc-500 mt-1">
                                {mode === 'login' ? 'Đăng nhập bằng số điện thoại đã đăng ký.' : 'Trở thành hội viên để nhận ưu đãi cọc tự động.'}
                            </p>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-4">

                            {/* Hiển thị thông báo lỗi từ Laravel */}
                            {errorMessage && (
                                <div className={`p-3 rounded-xl text-xs font-bold text-center ${errorMessage.includes('thành công') ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                                    {errorMessage}
                                </div>
                            )}

                            {mode === 'register' && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4 overflow-hidden">
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">Họ và tên *</label>
                                        <input type="text" required placeholder="Vợt thủ NH" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">Email *</label>
                                        <input type="email" required placeholder="user@nhbadminton.vn" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium" />
                                    </div>
                                </motion.div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">Số điện thoại *</label>
                                <input
                                    type="tel"
                                    required
                                    placeholder="09xx xxx xxx"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">Mật khẩu *</label>
                                    {mode === 'login' && <a href="#" className="text-xs font-semibold text-blue-600 hover:underline">Quên mật khẩu?</a>}
                                </div>
                                <input
                                    type="password"
                                    required
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                            </div>

                            <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} type="submit" disabled={isLoading} className={`w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all duration-200 mt-2 text-sm flex items-center justify-center gap-2 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}>
                                {isLoading ? (
                                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin block"></span><span>Đang xử lý...</span></>
                                ) : (
                                    mode === 'login' ? 'Đăng nhập vào hệ thống' : 'Đăng ký hội viên'
                                )}
                            </motion.button>

                            <div className="pt-4 border-t border-zinc-100 text-center text-xs text-zinc-500 font-medium">
                                {mode === 'login' ? (
                                    <>Chưa có tài khoản? <button type="button" onClick={() => { setMode('register'); setErrorMessage(''); }} className="font-bold text-blue-600 hover:underline focus:outline-none">Đăng ký ngay</button></>
                                ) : (
                                    <>Đã có tài khoản? <button type="button" onClick={() => { setMode('login'); setErrorMessage(''); }} className="font-bold text-blue-600 hover:underline focus:outline-none">Đăng nhập</button></>
                                )}
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default AuthModal;