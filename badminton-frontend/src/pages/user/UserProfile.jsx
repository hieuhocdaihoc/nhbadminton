import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { authService } from '../../services/auth/authService';

const UserProfile = () => {
    // 1. STATE THÔNG TIN USER
    const [user, setUser] = useState({
        full_name: '',
        phone: '',
        email: '',
        role: 'customer'
    });

    // 2. STATES ĐỔI MẬT KHẨU
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // 3. STATES THÔNG BÁO
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileMessage, setProfileMessage] = useState({ type: '', text: '' });

    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        const storedUser = localStorage.getItem('current_user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);

    // HÀM CẬP NHẬT THÔNG TIN
    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setProfileLoading(true);
        setProfileMessage({ type: '', text: '' });

        try {
            const updateData = {
                fullName: user.full_name,
                email: user.email,
                phone: user.phone,
            };

            const response = await authService.updateProfile(updateData);
            const updatedUser = response.data.user;

            localStorage.setItem('current_user', JSON.stringify(updatedUser));
            setUser(updatedUser);

            setProfileMessage({
                type: 'success',
                text: '✓ Cập nhật thông tin thành công!'
            });

            setTimeout(() => { window.location.reload(); }, 1000);
        } catch (error) {
            console.error('Lỗi cập nhật:', error);
            if (error.response && error.response.data && error.response.data.errors) {
                const firstError = Object.values(error.response.data.errors)[0][0];
                setProfileMessage({ type: 'error', text: firstError });
            } else {
                setProfileMessage({ type: 'error', text: 'Cập nhật thất bại. Vui lòng thử lại.' });
            }
        } finally {
            setProfileLoading(false);
        }
    };

    // HÀM ĐỔI MẬT KHẨU
    const handleChangePassword = async (e) => {
        e.preventDefault();
        setPasswordLoading(true);
        setPasswordMessage({ type: '', text: '' });

        if (newPassword !== confirmPassword) {
            setPasswordMessage({ type: 'error', text: 'Mật khẩu xác nhận không khớp!' });
            setPasswordLoading(false);
            return;
        }

        try {
            await authService.changePassword(oldPassword, newPassword, confirmPassword);
            setPasswordMessage({ type: 'success', text: '✓ Đổi mật khẩu thành công!' });
            setOldPassword(''); setNewPassword(''); setConfirmPassword('');
        } catch (error) {
            if (error.response && error.response.data) {
                setPasswordMessage({ type: 'error', text: error.response.data.message || 'Mật khẩu cũ không đúng.' });
            } else {
                setPasswordMessage({ type: 'error', text: 'Đổi mật khẩu thất bại.' });
            }
        } finally {
            setPasswordLoading(false);
        }
    };

    const getInitials = (name) => {
        if (!name) return 'VT';
        const words = name.trim().split(' ');
        if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase();
        return name.substring(0, 2).toUpperCase();
    };

    const handleLogoutClick = async () => {
        try { await authService.logout(); } catch (err) { console.error(err); }
        finally {
            localStorage.removeItem('access_token'); localStorage.removeItem('current_user');
            window.location.href = '/';
        }
    };

    return (
        <div className="bg-zinc-50/50 min-h-[calc(100vh-160px)] py-12 border-b border-zinc-100">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="mb-8">
                    <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">Hồ Sơ Cá Nhân</h1>
                    <p className="text-xs text-zinc-500 mt-1">Quản lý thông tin bảo mật và danh sách liên hệ.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                    {/* Cột trái: Avatar */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-6 rounded-3xl border border-zinc-200/80 shadow-sm text-center flex flex-col justify-between">
                        <div>
                            <div className="w-24 h-24 bg-gradient-to-tr from-blue-600 to-blue-500 rounded-full flex items-center justify-center text-white font-black text-3xl mx-auto mb-4 shadow-md shadow-blue-600/20">
                                {getInitials(user.full_name)}
                            </div>
                            <h3 className="text-lg font-bold text-zinc-900 truncate">{user.full_name || 'Vợt thủ NH'}</h3>
                            <p className="text-xs text-zinc-400 mt-0.5 font-mono">{user.phone}</p>
                            <span className="inline-block bg-blue-50 text-blue-600 text-[10px] font-bold px-3 py-1 rounded-full border border-blue-100 mt-3 uppercase tracking-wider">Hội viên {user.role}</span>
                        </div>
                        <div className="mt-8 pt-6 border-t border-zinc-100">
                            <button onClick={handleLogoutClick} className="w-full py-2.5 bg-red-50 hover:bg-red-600 hover:text-white text-red-600 font-bold rounded-xl transition-colors text-xs flex items-center justify-center gap-1.5">
                                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M17 7L15.59 8.41L18.17 11H8V13H18.17L15.59 15.59L17 17L22 12L17 7ZM4 5H12V3H4C2.9 3 2 3.9 2 5V19C2 20.1 2.9 21 4 21H12V19H4V5Z" /></svg>
                                <span>Đăng xuất khỏi thiết bị</span>
                            </button>
                        </div>
                    </motion.div>

                    {/* Cột phải: Form */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="md:col-span-2 bg-white p-6 sm:p-8 rounded-3xl border border-zinc-200/80 shadow-sm space-y-8">
                        {/* Cập nhật thông tin */}
                        <div>
                            <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-wider mb-4 pb-2 border-b border-zinc-100">Thông tin liên hệ</h4>
                            <form onSubmit={handleUpdateProfile}>
                                {profileMessage.text && <div className={`mb-4 p-2.5 rounded-xl text-xs font-bold ${profileMessage.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{profileMessage.text}</div>}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Họ và tên *</label>
                                        <input type="text" required value={user.full_name} onChange={(e) => setUser({ ...user, full_name: e.target.value })} className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-800 focus:outline-none focus:border-blue-500" />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Số điện thoại (Khóa)</label>
                                        <input type="text" disabled value={user.phone} className="w-full px-3 py-2 bg-zinc-100 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-500 cursor-not-allowed" />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Email *</label>
                                        <input type="email" required value={user.email} onChange={(e) => setUser({ ...user, email: e.target.value })} className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-800 focus:outline-none focus:border-blue-500" />
                                    </div>
                                </div>
                                <button type="submit" disabled={profileLoading} className={`mt-5 px-5 py-2.5 bg-zinc-900 hover:bg-blue-600 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-2 ${profileLoading ? 'opacity-70 cursor-not-allowed' : ''}`}>
                                    {profileLoading ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin block"></span> : null}
                                    <span>{profileLoading ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
                                </button>
                            </form>
                        </div>

                        {/* Đổi mật khẩu */}
                        <div>
                            <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-wider mb-4 pb-2 border-b border-zinc-100 flex items-center gap-1"><span>🔒</span> Đổi mật khẩu</h4>
                            <form onSubmit={handleChangePassword} className="space-y-4">
                                {passwordMessage.text && <div className={`p-2.5 rounded-xl text-xs font-bold ${passwordMessage.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{passwordMessage.text}</div>}
                                <div>
                                    <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Mật khẩu cũ *</label>
                                    <input type="password" required placeholder="••••••••" value={oldPassword} onChange={e => setOldPassword(e.target.value)} className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 font-medium" />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Mật khẩu mới *</label>
                                        <input type="password" required minLength="6" placeholder="Tối thiểu 6 ký tự" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 font-medium" />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-zinc-500 uppercase mb-1">Xác nhận mật khẩu mới *</label>
                                        <input type="password" required minLength="6" placeholder="Nhập lại mật khẩu mới" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 font-medium" />
                                    </div>
                                </div>
                                <button type="submit" disabled={passwordLoading} className={`px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm flex items-center gap-2 ${passwordLoading ? 'opacity-70 cursor-not-allowed' : ''}`}>
                                    {passwordLoading ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin block"></span> : null}
                                    <span>{passwordLoading ? 'Đang xác thực...' : 'Cập nhật mật khẩu'}</span>
                                </button>
                            </form>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default UserProfile;