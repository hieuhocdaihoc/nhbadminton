import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { authService } from '../../services/auth/authService';

const UserProfile = () => {
    const [user, setUser] = useState({ full_name: '', phone: '', email: '', role: 'customer' });
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileMessage, setProfileMessage] = useState({ type: '', text: '' });
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });
    const [activeTab, setActiveTab] = useState('profile');

    useEffect(() => {
        const storedUser = localStorage.getItem('current_user');
        if (storedUser) { setUser(JSON.parse(storedUser)); }
    }, []);

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setProfileLoading(true);
        setProfileMessage({ type: '', text: '' });
        try {
            const response = await authService.updateProfile({ fullName: user.full_name, email: user.email, phone: user.phone });
            const updatedUser = response.data.user;
            localStorage.setItem('current_user', JSON.stringify(updatedUser));
            setUser(updatedUser);
            setProfileMessage({ type: 'success', text: '✓ Cập nhật thông tin thành công!' });
            setTimeout(() => { window.location.reload(); }, 1000);
        } catch (error) {
            console.error('Lỗi cập nhật:', error);
            if (error.response?.data?.errors) {
                setProfileMessage({ type: 'error', text: Object.values(error.response.data.errors)[0][0] });
            } else {
                setProfileMessage({ type: 'error', text: 'Cập nhật thất bại. Vui lòng thử lại.' });
            }
        } finally { setProfileLoading(false); }
    };

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
            setPasswordMessage({ type: 'error', text: error.response?.data?.message || 'Đổi mật khẩu thất bại.' });
        } finally { setPasswordLoading(false); }
    };

    const getInitials = (name) => {
        if (!name) return 'VT';
        const w = name.trim().split(' ');
        return w.length >= 2 ? (w[0][0] + w[w.length - 1][0]).toUpperCase() : name.substring(0, 2).toUpperCase();
    };

    const handleLogoutClick = async () => {
        try { await authService.logout(); } catch (err) { console.error(err); }
        finally { localStorage.removeItem('access_token'); localStorage.removeItem('current_user'); window.location.href = '/'; }
    };

    const inputClass = "w-full px-4 py-3.5 bg-zinc-800/60 border border-zinc-700/60 rounded-2xl text-sm font-medium text-white placeholder-zinc-600 focus:outline-none focus:border-lime-400 focus:shadow-[0_0_15px_rgba(163,230,53,0.2)] focus:bg-zinc-800 transition-all duration-300";
    const labelClass = "block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2";

    const tabs = [
        { id: 'profile', label: 'Thông tin', icon: '👤' },
        { id: 'security', label: 'Bảo mật', icon: '🔒' },
    ];

    return (
        <div className="bg-zinc-950 min-h-[calc(100vh-160px)] relative overflow-hidden">
            {/* BG Decorations */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-lime-500/[0.03] rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-500/[0.03] rounded-full blur-3xl pointer-events-none" />

            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative z-10">

                {/* ═══ HERO BANNER ═══ */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    className="relative rounded-3xl overflow-hidden mb-10">
                    {/* Gradient Banner */}
                    <div className="h-40 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 relative">
                        <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_25px,rgba(163,230,53,0.03)_25px,rgba(163,230,53,0.03)_26px)]" />
                        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-lime-500/30 to-transparent" />
                    </div>

                    {/* Profile Card overlapping banner */}
                    <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 mx-6 -mt-16 rounded-2xl p-6 relative z-10">
                        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5">
                            {/* Avatar */}
                            <motion.div whileHover={{ scale: 1.05, rotate: 2 }} transition={{ type: 'spring', stiffness: 300 }}
                                className="w-24 h-24 sm:w-28 sm:h-28 bg-gradient-to-br from-lime-400 via-lime-500 to-emerald-500 rounded-2xl flex items-center justify-center text-zinc-950 font-black text-4xl shadow-2xl shadow-lime-500/20 -mt-16 sm:-mt-20 border-4 border-zinc-900 shrink-0">
                                {getInitials(user.full_name)}
                            </motion.div>

                            {/* Info */}
                            <div className="flex-1 text-center sm:text-left">
                                <h1 className="text-2xl font-extrabold text-white tracking-tight">{user.full_name || 'Vợt Thủ NH'}</h1>
                                <div className="flex flex-wrap items-center gap-3 mt-2 justify-center sm:justify-start">
                                    <span className="text-xs text-zinc-500 font-mono bg-zinc-800 px-3 py-1 rounded-lg">{user.phone}</span>
                                    <span className="text-[10px] font-extrabold text-lime-400 bg-lime-500/10 px-3 py-1 rounded-lg border border-lime-500/20 uppercase tracking-widest">
                                        {user.role === 'customer' ? '🏸 Hội viên' : user.role}
                                    </span>
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div className="flex items-center gap-2 shrink-0">
                                <a href="/booking-history" className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-bold rounded-xl transition-all border border-zinc-700/50 hover:border-zinc-600">
                                    📋 Lịch sử
                                </a>
                                <button onClick={handleLogoutClick}
                                    className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white text-xs font-bold rounded-xl transition-all border border-red-500/20 hover:border-red-500">
                                    Đăng xuất
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* ═══ TAB NAVIGATION ═══ */}
                <div className="flex items-center gap-2 mb-8 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-1.5 max-w-xs">
                    {tabs.map((tab) => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            className={`relative flex-1 px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 flex items-center justify-center gap-1.5
                                ${activeTab === tab.id ? 'text-zinc-950' : 'text-zinc-500 hover:text-zinc-300'}`}>
                            {activeTab === tab.id && (
                                <motion.div layoutId="activeProfileTab"
                                    className="absolute inset-0 bg-lime-500 rounded-xl shadow-lg shadow-lime-500/20"
                                    transition={{ type: 'spring', stiffness: 350, damping: 30 }} />
                            )}
                            <span className="relative z-10">{tab.icon}</span>
                            <span className="relative z-10">{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* ═══ TAB CONTENT ═══ */}
                <AnimatePresence mode="wait">
                    {activeTab === 'profile' && (
                        <motion.div key="profile" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.25 }}
                            className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-8 sm:p-10">
                            <div className="flex items-center gap-3 mb-8 pb-5 border-b border-zinc-800">
                                <div className="w-10 h-10 bg-lime-500/10 rounded-xl flex items-center justify-center text-lg">👤</div>
                                <div>
                                    <h2 className="text-base font-extrabold text-white uppercase tracking-wide">Thông tin liên hệ</h2>
                                    <p className="text-[11px] text-zinc-500">Cập nhật tên, email để nhận xác nhận đặt sân.</p>
                                </div>
                            </div>

                            {profileMessage.text && (
                                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                                    className={`mb-6 p-4 rounded-2xl text-sm font-bold flex items-center gap-2 ${profileMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                    {profileMessage.text}
                                </motion.div>
                            )}

                            <form onSubmit={handleUpdateProfile} className="space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div>
                                        <label className={labelClass}>Họ và tên *</label>
                                        <input type="text" required value={user.full_name} onChange={(e) => setUser({ ...user, full_name: e.target.value })} className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Số điện thoại
                                            <span className="ml-2 text-[9px] text-amber-400/70 normal-case tracking-normal">🔒 Không thể thay đổi</span>
                                        </label>
                                        <input type="text" disabled value={user.phone}
                                            className="w-full px-4 py-3.5 bg-zinc-800/30 border border-zinc-800 rounded-2xl text-sm font-semibold text-zinc-600 cursor-not-allowed" />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className={labelClass}>Địa chỉ email *</label>
                                        <input type="email" required value={user.email} onChange={(e) => setUser({ ...user, email: e.target.value })} className={inputClass} />
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 pt-2">
                                    <motion.button type="submit" disabled={profileLoading}
                                        whileHover={!profileLoading ? { scale: 1.02, boxShadow: '0 0 25px rgba(163,230,53,0.3)' } : {}}
                                        whileTap={!profileLoading ? { scale: 0.98 } : {}}
                                        className={`px-8 py-3.5 bg-lime-500 hover:bg-lime-400 text-zinc-950 font-extrabold rounded-2xl text-sm uppercase tracking-wider transition-all shadow-lg shadow-lime-500/15 flex items-center gap-2 ${profileLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                        {profileLoading && <span className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />}
                                        {profileLoading ? 'Đang lưu...' : 'Lưu thay đổi'}
                                    </motion.button>
                                    <a href="/" className="text-xs text-zinc-500 hover:text-zinc-300 font-semibold transition-colors">← Quay lại trang chủ</a>
                                </div>
                            </form>
                        </motion.div>
                    )}

                    {activeTab === 'security' && (
                        <motion.div key="security" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}
                            className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-8 sm:p-10">
                            <div className="flex items-center gap-3 mb-8 pb-5 border-b border-zinc-800">
                                <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-lg">🔒</div>
                                <div>
                                    <h2 className="text-base font-extrabold text-white uppercase tracking-wide">Đổi mật khẩu</h2>
                                    <p className="text-[11px] text-zinc-500">Sử dụng mật khẩu mạnh để bảo vệ tài khoản.</p>
                                </div>
                            </div>

                            {passwordMessage.text && (
                                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                                    className={`mb-6 p-4 rounded-2xl text-sm font-bold flex items-center gap-2 ${passwordMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                    {passwordMessage.text}
                                </motion.div>
                            )}

                            <form onSubmit={handleChangePassword} className="space-y-6">
                                <div>
                                    <label className={labelClass}>Mật khẩu hiện tại *</label>
                                    <input type="password" required placeholder="Nhập mật khẩu đang sử dụng" value={oldPassword} onChange={e => setOldPassword(e.target.value)} className={inputClass} />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div>
                                        <label className={labelClass}>Mật khẩu mới *</label>
                                        <input type="password" required minLength="6" placeholder="Tối thiểu 6 ký tự" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Xác nhận mật khẩu *</label>
                                        <input type="password" required minLength="6" placeholder="Nhập lại mật khẩu mới" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputClass} />
                                    </div>
                                </div>
                                {/* Strength hints */}
                                <div className="bg-zinc-800/40 rounded-2xl p-4 border border-zinc-800/60">
                                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Yêu cầu mật khẩu</p>
                                    <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-500">
                                        <span className={newPassword.length >= 6 ? 'text-lime-400' : ''}>✓ Ít nhất 6 ký tự</span>
                                        <span className={/[A-Z]/.test(newPassword) ? 'text-lime-400' : ''}>✓ Có chữ hoa</span>
                                        <span className={/[0-9]/.test(newPassword) ? 'text-lime-400' : ''}>✓ Có chữ số</span>
                                        <span className={newPassword && newPassword === confirmPassword ? 'text-lime-400' : ''}>✓ Khớp xác nhận</span>
                                    </div>
                                </div>

                                <motion.button type="submit" disabled={passwordLoading}
                                    whileHover={!passwordLoading ? { scale: 1.02 } : {}}
                                    whileTap={!passwordLoading ? { scale: 0.98 } : {}}
                                    className={`px-8 py-3.5 bg-zinc-800 hover:bg-zinc-700 text-white font-extrabold rounded-2xl text-sm uppercase tracking-wider transition-all border border-zinc-700 hover:border-lime-500/30 hover:shadow-[0_0_15px_rgba(163,230,53,0.1)] flex items-center gap-2 ${passwordLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    {passwordLoading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                                    {passwordLoading ? 'Đang xác thực...' : 'Cập nhật mật khẩu'}
                                </motion.button>
                            </form>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default UserProfile;