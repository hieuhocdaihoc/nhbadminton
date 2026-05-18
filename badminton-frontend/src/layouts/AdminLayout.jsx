import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { authService } from '../services/auth/authService';

const AdminLayout = ({ children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [adminUser, setAdminUser] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const stored = localStorage.getItem('current_user');
        if (stored) { setAdminUser(JSON.parse(stored)); }
    }, []);

    const menuGroups = [
        {
            label: 'Tổng quan',
            items: [
                { name: 'Báo cáo Thống kê', path: '/admin/dashboard', icon: () => <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M19 3H5C3.895 3 3 3.895 3 5V19C3 20.105 3.895 21 5 21H19C20.105 21 21 20.105 21 19V5C21 3.895 20.105 3 19 3ZM9 17H7V10H9V17ZM13 17H11V7H13V17ZM17 17H15V13H17V17Z" /></svg> },
            ]
        },
        {
            label: 'Quản lý đặt sân',
            items: [
                { name: 'Lịch Đặt Hôm Nay', path: '/admin/bookings/today', icon: () => <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z" /></svg> },
                { name: 'Danh Sách Đặt Lẻ', path: '/admin/bookings/single', icon: () => <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" /></svg> },
                { name: 'Hợp Đồng Định Kỳ', path: '/admin/bookings/recurring', icon: () => <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 3V5c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 13.95 20 12.54 20 11c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 9.05 4 10.46 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" /></svg> },
            ]
        },
        {
            label: 'Cơ sở vật chất',
            items: [
                { name: 'Quản lý Cụm Sân', path: '/admin/courts', icon: () => <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 2L4 5V11.09C4 16.14 7.41 20.85 12 22C16.59 20.85 20 16.14 20 11.09V5L12 2ZM10 17L6 13L7.41 11.59L10 14.17L16.59 7.58L18 9L10 17Z" /></svg> },
                { name: 'Cấu hình Giá Sân', path: '/admin/pricings', icon: () => <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M11.8 10.9C9.53 10.31 8.8 9.7 8.8 8.75C8.8 7.62 9.85 6.8 11.5 6.8C13.25 6.8 14.07 7.65 14.2 8.8H16.6C16.42 6.78 15.03 5.17 13 4.67V2H10V4.67C8.18 5.06 6.5 6.3 6.5 8.75C6.5 11.62 8.9 12.8 12.2 13.55C14.7 14.2 15.2 15.05 15.2 16.15C15.2 17.02 14.38 18 11.5 18C9.5 18 8.42 17.07 8.2 15.8H5.8C6.07 18.07 7.7 19.47 10 19.9V22H13V19.92C14.9 19.55 17.5 18.3 17.5 16.15C17.5 12.5 14.3 11.55 11.8 10.9Z" /></svg> },
            ]
        },
        {
            label: 'Kho & Sản phẩm',
            items: [
                { name: 'Danh Mục Sản Phẩm', path: '/admin/categories', icon: () => <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12zM10 9h8v2h-8V9zm0 3h8v2h-8v-2zm0-6h8v2h-8V6z" /></svg> },
                { name: 'Quản lý Sản phẩm', path: '/admin/products', icon: () => <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M20 4H4C2.895 4 2 4.895 2 6V18C2 19.105 2.895 20 4 20H20C21.105 20 22 19.105 22 18V6C22 4.895 21.105 4 20 4ZM20 18H4V12H20V18ZM20 8H4V6H20V8Z" /></svg> },
                { name: 'Quản lý Dịch vụ', path: '/admin/services', icon: () => <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 2c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2zm1 10h3l-4-4-4 4h3v4h2v-4z" /></svg> },
                { name: 'Quản lý Kho', path: '/admin/inventory-transactions', icon: () => <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v3.01c0 .72.43 1.34 1 1.69V20c0 1.1 1.1 2 2 2h14c.9 0 2-.9 2-2V8.7c.57-.35 1-.97 1-1.69V4c0-1.1-.9-2-2-2zm-5 12H9v-2h6v2zm5-7H4V4h16v3z" /></svg> },
                { name: 'Nhà Cung Cấp', path: '/admin/suppliers', icon: () => <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" /></svg> },
            ]
        },
        {
            label: 'Nhân sự',
            items: [
                { name: 'Quản lý Khách hàng', path: '/admin/customers', icon: () => <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" /></svg> },
                { name: 'Quản lý Nhân viên', path: '/admin/staffs', icon: () => <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M15 12C17.21 12 19 10.21 19 8C19 5.79 17.21 4 15 4C12.79 4 11 5.79 11 8C11 10.21 12.79 12 15 12ZM6 10V7H4V10H1V12H4V15H6V12H9V10H6ZM15 14C12.33 14 7 15.34 7 18V20H23V18C23 15.34 17.67 14 15 14Z" /></svg> },
            ]
        }
    ];

    // Flatten for path matching
    const allItems = menuGroups.flatMap(g => g.items);

    const handleAdminLogout = async () => {
        try { await authService.logout(); } catch (err) { console.error(err); }
        finally { localStorage.removeItem('access_token'); localStorage.removeItem('current_user'); window.location.href = '/'; }
    };

    const currentTab = allItems.find(item => location.pathname === item.path || location.pathname.startsWith(item.path + '/'))?.name || 'Bảng điều khiển';

    return (
        <div className="min-h-screen bg-[#f5f5f7] flex font-sans text-zinc-900">

            {/* SIDEBAR */}
            <aside className={`bg-[#0f0f0f] text-white flex flex-col transition-all duration-300 border-r border-zinc-800 ${sidebarOpen ? 'w-64' : 'hidden md:flex md:w-20'}`}>

                {/* Logo */}
                <div className="h-16 flex items-center gap-3 px-5 border-b border-zinc-800/60 shrink-0">
                    <div className="w-9 h-9 bg-lime-500 rounded-lg flex items-center justify-center text-zinc-950 font-black text-sm tracking-tighter shadow-md shrink-0">NH</div>
                    {sidebarOpen && (
                        <div className="overflow-hidden">
                            <span className="font-bold text-sm tracking-tight block leading-none text-white">NH Badminton</span>
                            <span className="text-[9px] text-lime-400 font-semibold uppercase tracking-widest block mt-0.5">Admin Panel</span>
                        </div>
                    )}
                </div>

                {/* Menu */}
                <div className="px-3 py-4 overflow-y-auto flex-1">
                    {menuGroups.map((group, gIdx) => (
                        <div key={gIdx} className="mb-5">
                            {sidebarOpen && <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest px-3 mb-2">{group.label}</p>}
                            <nav className="space-y-0.5">
                                {group.items.map((item) => {
                                    const RenderIcon = item.icon;
                                    const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                                    return (
                                        <button key={item.name} onClick={() => navigate(item.path)} type="button"
                                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all text-left relative
                                                ${isActive ? 'bg-lime-500/10 text-lime-400 font-semibold' : 'text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300'}`}>
                                            {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-lime-400 rounded-r-full" />}
                                            <span className="shrink-0"><RenderIcon /></span>
                                            {sidebarOpen && <span className="truncate">{item.name}</span>}
                                        </button>
                                    );
                                })}
                            </nav>
                        </div>
                    ))}
                </div>

                {/* User & Logout */}
                <div className="p-3 border-t border-zinc-800/60">
                    <div className="flex items-center gap-2.5 px-3 py-2 mb-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-lime-400 to-emerald-500 rounded-lg flex items-center justify-center text-zinc-950 font-bold text-[10px] shrink-0">
                            {adminUser?.full_name?.charAt(0)?.toUpperCase() || 'A'}
                        </div>
                        {sidebarOpen && (
                            <div className="overflow-hidden">
                                <p className="text-xs font-semibold text-white truncate">{adminUser?.full_name || 'Admin'}</p>
                                <p className="text-[10px] text-zinc-500 font-medium">{adminUser?.role || 'admin'}</p>
                            </div>
                        )}
                    </div>
                    <button onClick={handleAdminLogout} type="button"
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-zinc-500 hover:bg-red-500/10 hover:text-red-400 transition-colors ${!sidebarOpen ? 'justify-center' : ''}`}>
                        <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24"><path d="M17 7L15.59 8.41L18.17 11H8V13H18.17L15.59 15.59L17 17L22 12L17 7ZM4 5H12V3H4C2.9 3 2 3.9 2 5V19C2 20.1 2.9 21 4 21H12V19H4V5Z" /></svg>
                        {sidebarOpen && <span>Đăng xuất</span>}
                    </button>
                </div>
            </aside>

            {/* MAIN */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="h-14 bg-white border-b border-zinc-200/60 px-5 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setSidebarOpen(!sidebarOpen)} type="button" className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors">
                            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M3 18H21V16H3V18ZM3 13H21V11H3V13ZM3 6V8H21V6H3Z" /></svg>
                        </button>
                        <div>
                            <h2 className="text-sm font-bold text-zinc-800">{currentTab}</h2>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-zinc-400 font-medium bg-zinc-50 px-3 py-1.5 rounded-lg border border-zinc-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Hệ thống hoạt động
                        </span>
                    </div>
                </header>

                <main className="flex-1 p-5 overflow-y-auto">
                    <AnimatePresence mode="wait">
                        <motion.div key={location.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                            {children}
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;