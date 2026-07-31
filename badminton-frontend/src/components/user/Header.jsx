import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AuthModal from './AuthModal';
import { authService } from '../../services/auth/authService';
import { getMembershipTier } from '../../utils/membershipTier';

const Header = () => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [activeLink, setActiveLink] = useState('Sân Cầu');
    const [currentUser, setCurrentUser] = useState(() => {
        const storedUser = localStorage.getItem('current_user');
        if (!storedUser) return null;

        try {
            return JSON.parse(storedUser);
        } catch (error) {
            console.error('Loi doc du lieu user:', error);
            return null;
        }
    });
    const [userDropdownOpen, setUserDropdownOpen] = useState(false);
    const [authModalOpen, setAuthModalOpen] = useState(false);
    const [authMode, setAuthMode] = useState('login');
    const membershipTier = getMembershipTier(currentUser?.points);

    // PERSIST SESSION
    useEffect(() => {
        if (localStorage.getItem('access_token')) {
            authService.getProfile()
                .then((response) => {
                    const freshUser = response.data?.user;
                    if (freshUser) {
                        localStorage.setItem('current_user', JSON.stringify(freshUser));
                        setCurrentUser(freshUser);
                    }
                })
                .catch((error) => console.error('Khong the dong bo diem thanh vien:', error));
        }
    }, []);

    // ĐĂNG XUẤT (GỌI API LARAVEL)
    const handleLogout = async () => {
        try { await authService.logout(); }
        catch (e) { console.error('Lỗi thu hồi token:', e); }
        finally {
            localStorage.removeItem('access_token');
            localStorage.removeItem('current_user');
            setCurrentUser(null);
            setUserDropdownOpen(false);
            window.location.href = '/';
        }
    };

    const getInitials = (name) => {
        if (!name) return 'VT';
        const w = name.trim().split(' ');
        return w.length >= 2 ? (w[0][0] + w[w.length - 1][0]).toUpperCase() : name.substring(0, 2).toUpperCase();
    };

    const navLinks = [
        { name: 'Sân Cầu', href: '/#courts', sectionId: 'courts' },
        { name: 'Bảng Giá', href: '/#pricing', sectionId: 'pricing' },
        { name: 'Tiện Ích', href: '/#utilities', sectionId: 'utilities' },
        { name: 'Hướng Dẫn', href: '/#steps', sectionId: 'steps' },
        { name: 'Mặt Bằng', href: '/#floorplan', sectionId: 'floorplan' },
        { name: 'Tra Cứu Đơn', href: '/guest-booking-lookup' },
    ];

    // SCROLL-SPY: tự động chuyển pill active theo section đang hiển thị trên trang chủ
    useEffect(() => {
        if (window.location.pathname !== '/') return;

        const sectionLinks = navLinks.filter((l) => l.sectionId);
        const sections = sectionLinks
            .map((l) => ({ ...l, el: document.getElementById(l.sectionId) }))
            .filter((l) => l.el);

        if (sections.length === 0) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((entry) => entry.isIntersecting)
                    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

                if (visible) {
                    const match = sections.find((s) => s.el === visible.target);
                    if (match) setActiveLink(match.name);
                }
            },
            { rootMargin: '-35% 0px -55% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] }
        );

        sections.forEach((s) => observer.observe(s.el));
        return () => observer.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const mobileMenuVariant = {
        hidden: { opacity: 0, height: 0 },
        visible: { opacity: 1, height: 'auto', transition: { duration: 0.3, ease: 'easeInOut', staggerChildren: 0.05 } },
        exit: { opacity: 0, height: 0, transition: { duration: 0.2 } }
    };
    const itemVariant = { hidden: { opacity: 0, x: -15 }, visible: { opacity: 1, x: 0 } };
    const dropdownVariant = {
        hidden: { opacity: 0, y: 10, scale: 0.95 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.15 } },
        exit: { opacity: 0, y: 10, scale: 0.95, transition: { duration: 0.1 } }
    };

    return (
        <motion.header
            initial={{ y: -80 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.5, type: 'spring', stiffness: 100 }}
            className="sticky top-0 z-50 bg-zinc-950/85 backdrop-blur-xl border-b border-zinc-700"
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">

                {/* ═══ LOGO ═══ */}
                <a href="/" className="flex items-center gap-2 group focus:outline-none">
                    <span className="material-symbols-outlined text-lime-400 text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        sports_tennis
                    </span>
                    <span className="font-extrabold text-lg tracking-tight text-white uppercase">
                        NH<span className="text-lime-400"> Badminton</span>
                    </span>
                </a>

                {/* ═══ DESKTOP NAV ═══ */}
                <nav className="hidden md:flex items-center gap-1 font-semibold text-sm bg-zinc-900/80 border border-zinc-700 rounded-full px-1.5 py-1.5">
                    {navLinks.map((link) => {
                        const isActive = activeLink === link.name;
                        return (
                            <a key={link.name} href={link.href}
                                onClick={() => setActiveLink(link.name)}
                                className={`relative px-4 py-2 rounded-full transition-colors duration-200 ${isActive ? 'text-zinc-950' : 'text-zinc-400 hover:text-white'}`}>
                                {(isActive) && (
                                    <motion.div layoutId="navPill"
                                        className="absolute inset-0 bg-lime-400 rounded-full shadow-[0_0_12px_rgba(163,230,53,0.35)]"
                                        transition={{ type: 'spring', stiffness: 350, damping: 30 }} />
                                )}
                                <span className="relative z-10">{link.name}</span>
                            </a>
                        );
                    })}
                </nav>

                {/* ═══ AUTH DESKTOP ═══ */}
                <div className="hidden md:flex items-center gap-3">
                    {!currentUser ? (
                        <>
                            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                onClick={() => { setAuthMode('login'); setAuthModalOpen(true); }}
                                className="px-5 py-2.5 border border-zinc-600 hover:border-lime-400/60 text-zinc-300 hover:text-lime-300 text-sm font-semibold rounded-xl transition-all duration-300">
                                Đăng nhập
                            </motion.button>
                            <motion.a href="/#courts"
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                className="px-6 py-2.5 bg-lime-500 hover:bg-lime-400 text-zinc-950 text-sm font-extrabold rounded-xl border border-lime-300/40 shadow-[0_0_16px_rgba(163,230,53,0.3)] transition-all duration-300 uppercase tracking-wide">
                                Đặt Sân Ngay
                            </motion.a>
                        </>
                    ) : (
                        <div className="flex items-center gap-3">
                            <motion.a href="/#courts"
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                className="px-5 py-2 bg-lime-500 hover:bg-lime-400 text-zinc-950 text-sm font-extrabold rounded-xl border border-lime-300/40 shadow-[0_0_16px_rgba(163,230,53,0.3)] uppercase tracking-wide">
                                🏸 Đặt Sân
                            </motion.a>
                            <div className="relative">
                                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                                    className="flex items-center gap-2 p-1 pl-3 bg-zinc-900 border border-zinc-700 rounded-full focus:outline-none hover:border-lime-400/50 transition-colors">
                                    <span className="text-sm font-bold text-zinc-300 max-w-[120px] truncate">{currentUser.full_name || 'Vợt thủ'}</span>
                                    {currentUser.avatar_url ? (
                                        <img src={currentUser.avatar_url} alt={currentUser.full_name} className="w-8 h-8 rounded-full object-cover" />
                                    ) : (
                                        <div className="w-8 h-8 bg-gradient-to-tr from-lime-500 to-emerald-500 rounded-full flex items-center justify-center text-zinc-950 font-bold text-xs">
                                            {getInitials(currentUser.full_name)}
                                        </div>
                                    )}
                                </motion.button>

                                <AnimatePresence>
                                    {userDropdownOpen && (
                                        <motion.div variants={dropdownVariant} initial="hidden" animate="visible" exit="exit"
                                            className="absolute right-0 mt-2 w-64 bg-zinc-900 rounded-2xl shadow-2xl shadow-black/50 border border-zinc-700 py-2 z-50">
                                            <div className="px-4 py-2.5 border-b border-zinc-700 mb-1">
                                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Tài khoản của bạn</p>
                                                <p className="text-sm font-bold text-white truncate">{currentUser.phone}</p>
                                                {currentUser.email && <p className="text-xs text-zinc-500 truncate">{currentUser.email}</p>}
                                                <div className="mt-2 grid grid-cols-2 gap-2">
                                                    <div className="rounded-lg bg-lime-400/10 border border-lime-400/20 px-2.5 py-2">
                                                        <p className="text-[10px] font-bold uppercase text-lime-300">Điểm</p>
                                                        <p className="text-sm font-black text-lime-200">{currentUser.points || 0}</p>
                                                    </div>
                                                    <div className="rounded-lg bg-zinc-800 border border-zinc-600 px-2.5 py-2">
                                                        <p className="text-[10px] font-bold uppercase text-zinc-400">Hạng</p>
                                                        <p className="text-sm font-black text-white">{membershipTier.label}</p>
                                                    </div>
                                                </div>
                                                {membershipTier.hourlyDiscount > 0 && (
                                                    <p className="mt-2 rounded-lg border border-lime-400/30 bg-lime-400/10 px-2.5 py-2 text-[11px] font-semibold text-lime-300">
                                                        Ưu đãi: giảm {membershipTier.hourlyDiscount.toLocaleString('vi-VN')}đ mỗi giờ chơi
                                                    </p>
                                                )}
                                            </div>
                                            <a href="/profile" className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-300 hover:bg-lime-400/10 hover:text-lime-300 font-medium transition-colors">
                                                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" /></svg> Thông tin cá nhân
                                            </a>
                                            <a href="booking-history" className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-300 hover:bg-lime-400/10 hover:text-lime-300 font-medium transition-colors">
                                                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z" /></svg> Lịch sử đặt sân
                                            </a>
                                            <div className="border-t border-zinc-700 mt-1 pt-1">
                                                <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-400/10 font-semibold transition-colors text-left">
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

                {/* ═══ HAMBURGER MOBILE ═══ */}
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="p-2 text-zinc-400 hover:text-lime-300 hover:bg-lime-400/10 rounded-xl md:hidden focus:outline-none transition-colors">
                    <motion.div animate={{ rotate: mobileMenuOpen ? 90 : 0 }} transition={{ duration: 0.2 }}>
                        {mobileMenuOpen
                            ? <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
                            : <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M3 18H21V16H3V18ZM3 13H21V11H3V13ZM3 6V8H21V6H3Z" /></svg>}
                    </motion.div>
                </motion.button>
            </div>

            {/* ═══ MOBILE MENU ═══ */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div variants={mobileMenuVariant} initial="hidden" animate="visible" exit="exit"
                        className="md:hidden bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-700 px-6 py-6 space-y-4 overflow-hidden">
                        {navLinks.map((link) => (
                            <motion.a key={link.name} variants={itemVariant} href={link.href}
                                onClick={() => { setActiveLink(link.name); setMobileMenuOpen(false); }}
                                className={`block text-lg py-1.5 transition-colors ${activeLink === link.name ? 'text-lime-300 font-bold' : 'text-zinc-400 font-medium hover:text-lime-300'}`}>
                                {link.name}
                            </motion.a>
                        ))}
                        <motion.div variants={itemVariant} className="pt-6 border-t border-zinc-700 flex flex-col gap-3">
                            {!currentUser ? (
                                <>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button onClick={() => { setAuthMode('login'); setAuthModalOpen(true); setMobileMenuOpen(false); }}
                                            className="py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold rounded-xl text-sm border border-zinc-600">Đăng nhập</button>
                                        <button onClick={() => { setAuthMode('register'); setAuthModalOpen(true); setMobileMenuOpen(false); }}
                                            className="py-2.5 bg-zinc-800 text-lime-300 font-bold rounded-xl text-sm border border-lime-400/40">Đăng ký</button>
                                    </div>
                                    <a href="/#courts" onClick={() => setMobileMenuOpen(false)}
                                        className="block w-full text-center py-3 bg-lime-500 text-zinc-950 font-extrabold rounded-xl border border-lime-300/40 shadow-[0_0_16px_rgba(163,230,53,0.3)] uppercase tracking-wide">Đặt Sân Ngay</a>
                                </>
                            ) : (
                                <div className="bg-zinc-900 p-4 rounded-2xl border border-zinc-700 shadow-lg shadow-black/40">
                                    <div className="flex items-center gap-3 mb-4">
                                        {currentUser.avatar_url ? (
                                            <img src={currentUser.avatar_url} alt={currentUser.full_name} className="w-10 h-10 rounded-full object-cover" />
                                        ) : (
                                            <div className="w-10 h-10 bg-gradient-to-tr from-lime-500 to-emerald-500 rounded-full flex items-center justify-center text-zinc-950 font-bold text-sm">{getInitials(currentUser.full_name)}</div>
                                        )}
                                        <div className="overflow-hidden">
                                            <p className="text-sm font-bold text-white truncate">{currentUser.full_name}</p>
                                            <p className="text-xs text-zinc-500 truncate">{currentUser.phone}</p>
                                        </div>
                                    </div>
                                    <a href="/#courts" onClick={() => setMobileMenuOpen(false)}
                                        className="block w-full text-center py-2.5 bg-lime-500 text-zinc-950 font-extrabold rounded-xl shadow-sm mb-2 text-sm uppercase">🏸 Đặt Sân</a>
                                    <div className="grid grid-cols-2 gap-2 border-t border-zinc-700 pt-2">
                                        <a href="/profile" className="text-center py-2 text-xs font-semibold text-lime-300 bg-lime-400/10 border border-lime-400/20 rounded-lg">Hồ sơ</a>
                                        <button onClick={handleLogout} className="text-center py-2 text-xs font-semibold text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg">Đăng xuất</button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} initialMode={authMode} onLoginSuccess={(userData) => setCurrentUser(userData)} />
        </motion.header>
    );
};

export default Header;
