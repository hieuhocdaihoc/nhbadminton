import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { settingService } from '../../services/settingService';

const DEFAULT_SETTINGS = {
    club_name: 'NH Badminton',
    description: 'Hệ thống đặt lịch và quản lý sân cầu lông chuyên nghiệp. Giải pháp chuyển đổi số tối ưu hóa trải nghiệm cho mọi vợt thủ.',
    address: '1000 ấp 3 xã phước kiển huyện nhà bè',
    hotline: '0394.421.192',
    email: 'ngochieu21192@gmail.com',
    weekday_hours: '05:00 - 23:00',
    weekend_hours: '06:00 - 23:00',
    holiday_hours: '07:00 - 22:00',
    map_url: 'https://maps.google.com',
    facebook_url: '#',
    instagram_url: '#',
    youtube_url: '#',
};

const Footer = () => {
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);

    useEffect(() => {
        settingService.getPublicSettings()
            .then((response) => {
                const data = response.data?.data || {};
                setSettings((prev) => ({ ...prev, ...data }));
            })
            .catch((error) => console.error('Khong the tai cau hinh he thong:', error));
    }, []);

    const quickLinks = [
        { name: 'Trang chủ', href: '/' },
        { name: 'Sân đấu', href: '/#courts' },
        { name: 'Tiện ích sân', href: '/#utilities' },
        { name: 'Quy trình đặt sân', href: '/#steps' },
        { name: 'Sơ đồ mặt bằng', href: '/#floorplan' },
    ];

    const supportLinks = [
        { name: 'Câu hỏi thường gặp', href: '#' },
        { name: 'Chính sách bảo mật', href: '#' },
        { name: 'Điều khoản dịch vụ', href: '#' },
        { name: 'Quy chế hoạt động', href: '#' },
    ];

    const openHours = [
        { day: 'Thứ 2 - Thứ 6', time: settings.weekday_hours },
        { day: 'Thứ 7 - Chủ nhật', time: settings.weekend_hours },
        { day: 'Ngày lễ / Tết', time: settings.holiday_hours },
    ];

    const socials = [
        { label: 'Facebook', href: settings.facebook_url || '#', path: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z' },
        { label: 'Instagram', href: settings.instagram_url || '#', path: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.441-.645 1.441-1.44s-.646-1.44-1.441-1.44z' },
        { label: 'YouTube', href: settings.youtube_url || '#', path: 'M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z' },
    ];

    return (
        <footer id="footer" className="bg-zinc-950 text-zinc-500 pt-20 pb-10 border-t border-zinc-800/50 relative overflow-hidden">
            {/* Decorative top glow line */}
            <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-lime-500/30 to-transparent" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 pb-16 border-b border-zinc-800/60">

                    {/* ═══ CỘT 1: GIỚI THIỆU & SOCIAL ═══ */}
                    <div className="lg:col-span-4">
                        <div className="flex items-center gap-2.5 mb-5">
                            <div className="w-10 h-10 bg-lime-500 rounded-xl flex items-center justify-center text-zinc-950 font-black text-xl tracking-tighter shadow-lg shadow-lime-500/20">NH</div>
                            <span className="font-extrabold text-xl tracking-tight text-white">{settings.club_name || 'NH Badminton'}<span className="text-lime-400">.</span></span>
                        </div>
                        <p className="text-zinc-500 text-sm leading-relaxed mb-6 max-w-xs">
                            {settings.description}
                        </p>
                        <div className="flex items-center gap-3">
                            {socials.map((s) => (
                                <motion.a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}
                                    whileHover={{ y: -3, scale: 1.1 }}
                                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                    className="w-10 h-10 rounded-xl bg-zinc-800/80 hover:bg-lime-500 text-zinc-500 hover:text-zinc-950 flex items-center justify-center transition-colors duration-300 border border-zinc-700/50 hover:border-lime-400 hover:shadow-[0_0_15px_rgba(163,230,53,0.3)]">
                                    <svg className="w-[18px] h-[18px] fill-current" viewBox="0 0 24 24"><path d={s.path} /></svg>
                                </motion.a>
                            ))}
                        </div>
                    </div>

                    {/* ═══ CỘT 2: LIÊN KẾT NHANH ═══ */}
                    <div className="lg:col-span-2">
                        <h4 className="text-white font-extrabold text-xs uppercase tracking-widest mb-6">Danh mục</h4>
                        <ul className="space-y-3 text-sm font-medium">
                            {quickLinks.map((l) => (
                                <li key={l.name}>
                                    <a href={l.href} className="group inline-flex items-center gap-1.5 hover:text-lime-400 transition-all duration-300">
                                        <span className="w-0 group-hover:w-2 h-[2px] bg-lime-400 rounded transition-all duration-300" />
                                        {l.name}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* ═══ CỘT 3: GIỜ MỞ CỬA ═══ */}
                    <div className="lg:col-span-3">
                        <h4 className="text-white font-extrabold text-xs uppercase tracking-widest mb-6">Giờ hoạt động</h4>
                        <div className="space-y-3">
                            {openHours.map((h, i) => (
                                <div key={i} className="flex items-center justify-between text-sm bg-zinc-900/50 rounded-xl px-4 py-2.5 border border-zinc-800/60">
                                    <span className="text-zinc-400 font-medium">{h.day}</span>
                                    <span className="text-lime-400 font-bold font-mono text-xs">{h.time}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ═══ CỘT 4: LIÊN HỆ ═══ */}
                    <div className="lg:col-span-3">
                        <h4 className="text-white font-extrabold text-xs uppercase tracking-widest mb-6">Liên hệ</h4>
                        <div className="space-y-4 text-sm">
                            <div className="flex items-start gap-3 group">
                                <svg className="w-5 h-5 text-lime-400 shrink-0 mt-0.5 fill-current" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" /></svg>
                                <span className="group-hover:text-zinc-300 transition-colors">{settings.address}</span>
                            </div>
                            <div className="flex items-center gap-3 group">
                                <svg className="w-5 h-5 text-lime-400 shrink-0 fill-current" viewBox="0 0 24 24"><path d="M6.62 10.79C8.06 13.62 10.38 15.94 13.21 17.38l2.2-2.2c.28-.28.67-.36 1.02-.25 1.12.37 2.32.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg>
                                <span className="text-lime-400 font-semibold group-hover:text-lime-300 transition-colors">{settings.hotline}</span>
                            </div>
                            <div className="flex items-center gap-3 group">
                                <svg className="w-5 h-5 text-lime-400 shrink-0 fill-current" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8l8 5 8-5v10zm-8-7L4 6h16l-8 5z" /></svg>
                                <span className="group-hover:text-zinc-300 transition-colors">{settings.email}</span>
                            </div>
                        </div>

                        {/* Bản đồ: ưu tiên tọa độ ghim chính xác, fallback theo địa chỉ chữ */}
                        <div className="mt-5 rounded-xl overflow-hidden border border-zinc-800/60 h-[140px] bg-zinc-900/50 relative group">
                            {(settings.map_lat && settings.map_lng) || settings.address ? (
                                <iframe
                                    title="Bản đồ địa chỉ"
                                    src={
                                        settings.map_lat && settings.map_lng
                                            ? `https://www.google.com/maps?q=${settings.map_lat},${settings.map_lng}&z=16&output=embed`
                                            : `https://www.google.com/maps?q=${encodeURIComponent(settings.address)}&output=embed`
                                    }
                                    width="100%"
                                    height="100%"
                                    style={{ border: 0, filter: 'grayscale(1) invert(0.92) contrast(0.9)' }}
                                    loading="lazy"
                                    referrerPolicy="no-referrer-when-downgrade"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs text-zinc-500">
                                    Chưa có địa chỉ
                                </div>
                            )}
                            <a
                                href={
                                    settings.map_lat && settings.map_lng
                                        ? `https://www.google.com/maps/search/?api=1&query=${settings.map_lat},${settings.map_lng}`
                                        : settings.map_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address || '')}`
                                }
                                target="_blank" rel="noopener noreferrer"
                                className="absolute bottom-2 right-2 text-[10px] bg-zinc-950/80 backdrop-blur px-2.5 py-1.5 rounded-lg text-zinc-300 hover:text-lime-400 transition-colors font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100"
                            >
                                <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" /></svg>
                                Mở Google Maps →
                            </a>
                        </div>
                    </div>
                </div>

                {/* ═══ COPYRIGHT BAR ═══ */}
                <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-600 font-medium">
                    <p>© 2026 NH Badminton. Nền tảng phục vụ Khóa luận Tốt nghiệp.</p>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-lime-500 animate-pulse" />
                        <span className="text-zinc-500">Hệ thống đang hoạt động</span>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;