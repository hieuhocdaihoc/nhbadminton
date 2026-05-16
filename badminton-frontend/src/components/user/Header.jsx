import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AuthModal from './AuthModal';
import { authService } from '../../services/auth/authService'; // <-- Đảm bảo import service để gọi logout

const Header = () => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [activeLink, setActiveLink] = useState('Trang chủ');

    // STATE LƯU TRỮ THÔNG TIN USER ĐỘNG
    const [currentUser, setCurrentUser] = useState(null);
    const [userDropdownOpen, setUserDropdownOpen] = useState(false);

    const [authModalOpen, setAuthModalOpen] = useState(false);
    const [authMode, setAuthMode] = useState('login');

    // TỰ ĐỘNG ĐỌC BỘ NHỚ KHI TẢI LẠI TRANG (PERSIST SESSION)
    useEffect(() => {
        const storedUser = localStorage.getItem('current_user');
        if (storedUser) {
            try {
                setCurrentUser(JSON.parse(storedUser));
            } catch (error) {
                console.error('Lỗi đọc dữ liệu user:', error);
            }
        }
    }, []);

    // HÀM XỬ LÝ ĐĂNG XUẤT THỰC TẾ (GỌI API LARAVEL)
    const handleLogout = async () => {
        try {
            // Bắn API lên Laravel để xóa token trong DB
            await authService.logout();
        } catch (error) {
            console.error('Lỗi thu hồi token backend:', error);
        } finally {
            // Dù backend thành công hay lỗi, vẫn phải dọn dẹp bộ nhớ Frontend
            localStorage.removeItem('access_token');
            localStorage.removeItem('current_user');
            setCurrentUser(null);
            setUserDropdownOpen(false);
            // Chuyển về trang chủ
            window.location.href = '/';
        }
    };

    // HÀM TRÍCH XUẤT 2 KÝ TỰ ĐẦU TỪ TÊN THẬT (Ví dụ: "Minh Tuấn" -> "MT")
    const getInitials = (name) => {
        if (!name) return 'VT';
        const words = name.trim().split(' ');
        if (words.length >= 2) {
            return (words[0][0] + words[words.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    const navLinks = [
        { name: 'Trang chủ', href: '/' }, // Đổi '#' thành '/' cho chuẩn SPA
        { name: 'Tiện ích', href: '/#utilities' },
        { name: 'Sơ đồ sân', href: '/#courts' },
        { name: 'Quy trình', href: '/#steps' },
        { name: 'Liên hệ', href: '/#contact' },
    ];

    const mobileMenuVariant = {
        hidden: { opacity: 0, height: 0 },
        visible: { opacity: 1, height: 'auto', transition: { duration: 0.3, ease: 'easeInOut', staggerChildren: 0.05 } },
        exit: { opacity: 0, height: 0, transition: { duration: 0.2, ease: 'easeInOut' } }
    };

    const itemVariant = { hidden: { opacity: 0, x: -15 }, visible: { opacity: 1, x: 0 } };
    const dropdownVariant = {
        hidden: { opacity: 0, y: 10, scale: 0.95 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.15, ease: 'easeOut' } },
        exit: { opacity: 0, y: 10, scale: 0.95, transition: { duration: 0.1, ease: 'easeIn' } }
    };

    return (
        <motion.header
            initial={{ y: -80 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.5, type: 'spring', stiffness: 100 }}
            className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-zinc-100 shadow-sm shadow-blue-500/5"
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
                {/* Logo */}
                <a href="/" className="flex items-center gap-2 group focus:outline-none">
                    <motion.div whileHover={{ rotate: 5, scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xl tracking-tighter shadow-md shadow-blue-600/20">
                        NH
                    </motion.div>
                    <span className="font-extrabold text-xl tracking-tight text-zinc-900 transition-colors duration-300">
                        Badminton<span className="text-blue-600">.</span>
                    </span>
                </a>

                {/* Desktop Menu */}
                <nav className="hidden md:flex items-center gap-8 font-medium text-zinc-500">
                    {navLinks.map((link) => {
                        const isActive = activeLink === link.name;
                        return (
                            <a key={link.name} href={link.href} onClick={() => setActiveLink(link.name)} className={`relative py-1 text-base transition-colors duration-200 ${isActive ? 'text-blue-600 font-bold' : 'hover:text-blue-600'}`}>
                                {link.name}
                                {isActive && <motion.div layoutId="activeHeaderIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" transition={{ type: 'spring', stiffness: 300, damping: 30 }} />}
                            </a>
                        );
                    })}
                </nav>

                {/* Auth Section Desktop */}
                <div className="hidden md:flex items-center gap-3">
                    {!currentUser ? (
                        <>
                            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => { setAuthMode('register'); setAuthModalOpen(true); }} className="inline-flex items-center justify-center px-5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-semibold rounded-xl border border-blue-200/60 transition-all duration-200">
                                Đăng nhập
                            </motion.button>
                            <motion.a href="/#courts" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="inline-flex items-center justify-center px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-600/20 transition-all duration-200">
                                Đặt sân
                            </motion.a>
                        </>
                    ) : (
                        <div className="flex items-center gap-3">
                            <motion.a href="/#courts" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="inline-flex items-center justify-center px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-600/10 transition-all duration-200">
                                🏸 Đặt sân
                            </motion.a>
                            <div className="relative">
                                {/* HIỂN THỊ TÊN THẬT & AVATAR ĐỘNG */}
                                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setUserDropdownOpen(!userDropdownOpen)} className="flex items-center gap-2 p-1 pl-3 bg-zinc-50 border border-zinc-200/80 rounded-full focus:outline-none hover:border-blue-200 transition-colors">
                                    <span className="text-sm font-bold text-zinc-700 max-w-[120px] truncate">
                                        {currentUser.full_name || 'Vợt thủ'}
                                    </span>
                                    <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-inner">
                                        {getInitials(currentUser.full_name)}
                                    </div>
                                </motion.button>

                                <AnimatePresence>
                                    {userDropdownOpen && (
                                        <motion.div variants={dropdownVariant} initial="hidden" animate="visible" exit="exit" className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-zinc-100 py-2 z-50">

                                            {/* HIỂN THỊ PHONE HOẶC EMAIL THẬT */}
                                            <div className="px-4 py-2.5 border-b border-zinc-50 mb-1">
                                                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Tài khoản của bạn</p>
                                                <p className="text-sm font-bold text-zinc-800 truncate">{currentUser.phone}</p>
                                                {currentUser.email && <p className="text-xs text-zinc-500 truncate">{currentUser.email}</p>}
                                            </div>

                                            {/* ĐÃ FIX: ĐỔI href="#" THÀNH href="/profile" */}
                                            <a href="/profile" className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-600 hover:bg-blue-50 hover:text-blue-600 font-medium transition-colors">
                                                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" /></svg> Thông tin cá nhân
                                            </a>
                                            <a href="booking-history" className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-600 hover:bg-blue-50 hover:text-blue-600 font-medium transition-colors">
                                                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M19 3H5C3.895 3 3 3.895 3 5V19C3 20.105 3.895 21 5 21H19C20.105 21 21 20.105 21 19V5C21 3.895 20.105 3 19 3ZM10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z" /></svg> Lịch sử đặt sân
                                            </a>

                                            <div className="border-t border-zinc-50 mt-1 pt-1">
                                                <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-semibold transition-colors text-left">
                                                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M17 7L15.59 8.41L18.17 11H8V13H18.17L15.59 15.59L17 17L22 12L17 7ZM4 5H12V3H4C2.9 3 2 3.9 2 5V19C2 20.1 2.9 21 4 21H12V19H4V5Z" /></svg> Đăng xuất
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    )}
                </div>

                {/* Hamburger Mobile */}
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-zinc-600 hover:text-blue-600 hover:bg-blue-50/50 rounded-xl md:hidden focus:outline-none transition-colors">
                    {mobileMenuOpen ? <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41Z" /></svg> : <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M3 18H21V16H3V18ZM3 13H21V11H3V13ZM3 6V8H21V6H3Z" /></svg>}
                </motion.button>
            </div>

            {/* Mobile Menu Dropdown */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div variants={mobileMenuVariant} initial="hidden" animate="visible" exit="exit" className="md:hidden bg-white border-b border-blue-50 px-6 py-6 space-y-4 shadow-xl shadow-blue-900/5 overflow-hidden">
                        {navLinks.map((link) => (
                            <motion.a key={link.name} variants={itemVariant} href={link.href} onClick={() => { setActiveLink(link.name); setMobileMenuOpen(false); }} className={`block text-lg py-1.5 transition-colors ${activeLink === link.name ? 'text-blue-600 font-bold' : 'text-zinc-600 font-medium hover:text-blue-600'}`}>
                                {link.name}
                            </motion.a>
                        ))}
                        <motion.div variants={itemVariant} className="pt-6 border-t border-zinc-100 flex flex-col gap-3">
                            {!currentUser ? (
                                <>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button onClick={() => { setAuthMode('login'); setAuthModalOpen(true); setMobileMenuOpen(false); }} className="py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold rounded-xl transition-colors text-center text-sm">Đăng nhập</button>
                                        <button onClick={() => { setAuthMode('register'); setAuthModalOpen(true); setMobileMenuOpen(false); }} className="py-2.5 bg-blue-50 text-blue-700 font-bold rounded-xl transition-colors text-center text-sm border border-blue-100">Đăng ký</button>
                                    </div>
                                    <a href="/#courts" onClick={() => setMobileMenuOpen(false)} className="block w-full text-center py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-colors text-base">Đặt sân ngay</a>
                                </>
                            ) : (
                                <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-200/60">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                            {getInitials(currentUser.full_name)}
                                        </div>
                                        <div className="overflow-hidden">
                                            <p className="text-sm font-bold text-zinc-800 truncate">{currentUser.full_name}</p>
                                            <p className="text-xs text-zinc-500 truncate">{currentUser.phone}</p>
                                        </div>
                                    </div>
                                    <a href="/#courts" onClick={() => setMobileMenuOpen(false)} className="block w-full text-center py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-sm mb-2 text-sm">🏸 Đặt sân ngay</a>

                                    <div className="grid grid-cols-2 gap-2 border-t border-zinc-200/60 pt-2">
                                        {/* ĐÃ FIX CHO MOBILE: ĐỔI href="#" THÀNH href="/profile" */}
                                        <a href="/profile" className="text-center py-2 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg">Hồ sơ</a>
                                        <button onClick={handleLogout} className="text-center py-2 text-xs font-semibold text-red-600 bg-red-50 rounded-lg">Đăng xuất</button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* NHÚNG MODAL + LƯU USER KHI ĐĂNG NHẬP THÀNH CÔNG */}
            <AuthModal
                isOpen={authModalOpen}
                onClose={() => setAuthModalOpen(false)}
                initialMode={authMode}
                onLoginSuccess={(userData) => setCurrentUser(userData)}
            />
        </motion.header>
    );
};

export default Header;