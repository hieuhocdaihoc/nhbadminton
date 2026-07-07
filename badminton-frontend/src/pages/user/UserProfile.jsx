import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { authService } from '../../services/auth/authService';

const UserProfile = () => {
    const [user, setUser] = useState(() => {
        const storedUser = localStorage.getItem('current_user');
        if (!storedUser) return { full_name: '', phone: '', email: '', role: 'customer' };

        try {
            return JSON.parse(storedUser);
        } catch (error) {
            console.error('Loi doc du lieu user:', error);
            return { full_name: '', phone: '', email: '', role: 'customer' };
        }
    });
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileMessage, setProfileMessage] = useState({ type: '', text: '' });
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });
    const [activeTab, setActiveTab] = useState('profile');
    const [avatarUploading, setAvatarUploading] = useState(false);
    const avatarInputRef = useRef(null);

    useEffect(() => {
        authService.getProfile()
            .then((response) => {
                const freshUser = response.data?.user;
                if (freshUser) {
                    localStorage.setItem('current_user', JSON.stringify(freshUser));
                    setUser(freshUser);
                }
            })
            .catch((error) => console.error('Khong the tai diem thanh vien:', error));
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

    const handleAvatarClick = () => {
        avatarInputRef.current?.click();
    };

    const handleAvatarChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setProfileMessage({ type: 'error', text: 'Vui lòng chọn một tệp hình ảnh.' });
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            setProfileMessage({ type: 'error', text: 'Ảnh không được vượt quá 2MB.' });
            return;
        }
        setAvatarUploading(true);
        try {
            const response = await authService.uploadAvatar(file);
            const newAvatarUrl = response.data?.avatar_url;
            const updatedUser = { ...user, avatar_url: newAvatarUrl };
            localStorage.setItem('current_user', JSON.stringify(updatedUser));
            setUser(updatedUser);
            setProfileMessage({ type: 'success', text: '✓ Cập nhật ảnh đại diện thành công!' });
            // Reload để Header và các nơi khác đồng bộ avatar mới
            setTimeout(() => { window.location.reload(); }, 800);
        } catch (error) {
            setProfileMessage({ type: 'error', text: error.response?.data?.message || 'Tải ảnh thất bại. Vui lòng thử lại.' });
        } finally {
            setAvatarUploading(false);
            e.target.value = '';
        }
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

    const inputClass = "user-input";
    const labelClass = "user-form-label";

    const tabs = [
        { id: 'profile', label: 'Thông tin', icon: 'person' },
        { id: 'security', label: 'Bảo mật', icon: 'lock' },
    ];

    const points = user.points || 0;
    const nextTierTarget = 1000;
    const tierProgress = Math.min(100, Math.round((points / nextTierTarget) * 100));

    return (
        <div className="bg-zinc-950 min-h-[calc(100vh-160px)] relative overflow-hidden">
            {/* Nền trang trí */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-lime-500/[0.03] rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-500/[0.03] rounded-full blur-3xl pointer-events-none" />

            <div className="user-page-container max-w-5xl py-16 relative z-10">

                {/* ═══ THẺ THÔNG TIN CHÍNH (HERO) ═══ */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    className="relative user-card-glass mb-8 p-5 sm:p-6">

                    {/* Role badge - góc trên phải */}
                    <span className="absolute top-5 right-5 text-[10px] font-extrabold text-lime-400 bg-lime-500/10 px-3 py-1 rounded-lg border border-lime-500/20 uppercase tracking-widest">
                        {user.role === 'customer' ? 'Vợt thủ' : user.role}
                    </span>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                        {/* Ảnh đại diện */}
                        <div className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0 mx-auto sm:mx-0">
                            <motion.div whileHover={{ scale: 1.04 }} transition={{ type: 'spring', stiffness: 300 }}
                                onClick={handleAvatarClick}
                                className="relative w-full h-full rounded-xl overflow-hidden flex items-center justify-center shadow-xl shadow-lime-500/10 border-2 border-zinc-800 cursor-pointer group/avatar"
                            >
                                {user.avatar_url ? (
                                    <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-lime-400 via-lime-500 to-emerald-500 flex items-center justify-center text-zinc-950 font-black text-3xl">
                                        {getInitials(user.full_name)}
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center">
                                    {avatarUploading
                                        ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        : <span className="material-symbols-outlined text-white text-xl">photo_camera</span>}
                                </div>
                                <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatarChange} className="hidden" />
                            </motion.div>
                            {/* Badge bút chì sửa ảnh */}
                            <button onClick={handleAvatarClick}
                                className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-lime-500 hover:bg-lime-400 rounded-full flex items-center justify-center border-2 border-zinc-900 transition-colors">
                                <span className="material-symbols-outlined text-zinc-950 text-[14px]">edit</span>
                            </button>
                        </div>

                        {/* Thông tin */}
                        <div className="flex-1 text-center sm:text-left min-w-0">
                            <h1 className="text-xl font-extrabold text-white tracking-tight truncate">{user.full_name || 'Vợt Thủ NH'}</h1>
                            <p className="text-[11px] text-zinc-500 font-mono mt-0.5">ID: {(user.customer_code || user.id || '').toString().slice(0, 12)}</p>

                            <div className="flex items-center gap-2 mt-3 justify-center sm:justify-start">
                                <a href="/booking-history"
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[11px] font-bold rounded-lg transition-all border border-zinc-700/50">
                                    <span className="material-symbols-outlined text-[14px]">history</span> Lịch sử
                                </a>
                                <button onClick={handleLogoutClick}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white text-[11px] font-bold rounded-lg transition-all border border-red-500/20">
                                    <span className="material-symbols-outlined text-[14px]">logout</span> Đăng xuất
                                </button>
                            </div>
                        </div>

                        {/* Hạng + điểm */}
                        <div className="shrink-0 flex flex-col items-center sm:items-end gap-1">
                            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg">
                                <span className="material-symbols-outlined text-[16px]">emoji_events</span>
                                Hạng {user.membership_level || 'Đồng'}
                            </span>
                            <div className="text-right">
                                <p className="text-2xl font-black text-lime-400 leading-none">{points}</p>
                                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mt-0.5">Điểm tích lũy</p>
                            </div>
                        </div>
                    </div>

                    {/* Thanh tiến trình lên hạng */}
                    <div className="mt-5 pt-4 border-t border-zinc-800">
                        <div className="flex items-center justify-between mb-1.5 text-[10px] font-semibold">
                            <span className="text-zinc-500">
                                {points >= nextTierTarget
                                    ? 'Đã mở ưu đãi giảm 5.000đ/giờ chơi'
                                    : `Còn ${nextTierTarget - points} điểm để lên hạng tiếp theo`}
                            </span>
                            <span className="text-lime-400 font-bold">{tierProgress}%</span>
                        </div>
                        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${tierProgress}%` }} transition={{ duration: 0.8, ease: 'easeOut' }}
                                className="h-full bg-gradient-to-r from-lime-500 to-emerald-400 rounded-full" />
                        </div>
                    </div>
                </motion.div>

                {/* ═══ ĐIỀU HƯỚNG TAB ═══ */}
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
                            <span className="material-symbols-outlined relative z-10 text-[16px]">{tab.icon}</span>
                            <span className="relative z-10">{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* ═══ NỘI DUNG TAB ═══ */}
                <AnimatePresence mode="wait">
                    {activeTab === 'profile' && (
                        <motion.div key="profile" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.25 }}
                            className="user-card-glass">
                            <div className="flex items-center gap-3 mb-8 pb-5 border-b border-zinc-800">
                                <div className="w-10 h-10 bg-lime-500/10 rounded-xl flex items-center justify-center">
                                    <span className="material-symbols-outlined text-lime-400 text-xl">contact_mail</span>
                                </div>
                                <div>
                                    <h2 className="text-base font-extrabold text-white uppercase tracking-wide">Thông tin liên hệ</h2>
                                    <p className="text-[11px] text-zinc-500">Cập nhật thông tin liên hệ chính xác của bạn.</p>
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
                                            <span className="ml-2 text-[9px] text-amber-400/70 normal-case tracking-normal inline-flex items-center gap-0.5">
                                                <span className="material-symbols-outlined text-[11px]">lock</span> Không thể thay đổi
                                            </span>
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
                                        className={`user-btn-primary ${profileLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                        {profileLoading && <span className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />}
                                        {profileLoading ? 'Đang lưu...' : 'Lưu thay đổi'}
                                    </motion.button>
                                    <a href="/" className="text-xs text-zinc-500 hover:text-zinc-300 font-semibold transition-colors inline-flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px]">arrow_back</span> Quay lại trang chủ
                                    </a>
                                </div>
                            </form>
                        </motion.div>
                    )}

                    {activeTab === 'security' && (
                        <motion.div key="security" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}
                            className="user-card-glass">
                            <div className="flex items-center gap-3 mb-8 pb-5 border-b border-zinc-800">
                                <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
                                    <span className="material-symbols-outlined text-amber-400 text-xl">lock</span>
                                </div>
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
                                {/* Gợi ý độ mạnh mật khẩu */}
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
                                    className={`user-btn-secondary ${passwordLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
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
