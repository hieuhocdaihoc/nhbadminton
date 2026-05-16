import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/auth/authService';

const AdminLayout = ({ children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [adminUser, setAdminUser] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const stored = localStorage.getItem('current_user');
        if (stored) {
            setAdminUser(JSON.parse(stored));
        }
    }, []);

    const menuItems = [
        { name: 'Báo cáo Thống kê', path: '/admin/dashboard', icon: () => <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M19 3H5C3.895 3 3 3.895 3 5V19C3 20.105 3.895 21 5 21H19C20.105 21 21 20.105 21 19V5C21 3.895 20.105 3 19 3ZM9 17H7V10H9V17ZM13 17H11V7H13V17ZM17 17H15V13H17V17Z" /></svg> },

        // --- PHÂN HỆ QUẢN LÝ BOOKING (CHIA 3 LUỒNG) ---
        {
            name: 'Lịch Đặt Hôm Nay',
            path: '/admin/bookings/today',
            icon: () => <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z" /></svg>
        },
        {
            name: 'Danh Sách Đặt Lẻ',
            path: '/admin/bookings/single',
            icon: () => <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" /></svg>
        },
        {
            name: 'Hợp Đồng Định Kỳ',
            path: '/admin/bookings/recurring',
            icon: () => <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 3V5c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 13.95 20 12.54 20 11c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 9.05 4 10.46 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" /></svg>
        },
        {
            name: 'Quản lý Cụm Sân',
            path: '/admin/courts',
            icon: () => <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 2L4 5V11.09C4 16.14 7.41 20.85 12 22C16.59 20.85 20 16.14 20 11.09V5L12 2ZM10 17L6 13L7.41 11.59L10 14.17L16.59 7.58L18 9L10 17Z" /></svg>
        },
        {
            name: 'Cấu hình Giá Sân',
            path: '/admin/pricings',
            icon: () => <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M11.8 10.9C9.53 10.31 8.8 9.7 8.8 8.75C8.8 7.62 9.85 6.8 11.5 6.8C13.25 6.8 14.07 7.65 14.2 8.8H16.6C16.42 6.78 15.03 5.17 13 4.67V2H10V4.67C8.18 5.06 6.5 6.3 6.5 8.75C6.5 11.62 8.9 12.8 12.2 13.55C14.7 14.2 15.2 15.05 15.2 16.15C15.2 17.02 14.38 18 11.5 18C9.5 18 8.42 17.07 8.2 15.8H5.8C6.07 18.07 7.7 19.47 10 19.9V22H13V19.92C14.9 19.55 17.5 18.3 17.5 16.15C17.5 12.5 14.3 11.55 11.8 10.9Z" /></svg>
        },

        // =========================================================================
        // THÊM ĐƯỜNG DẪN: QUẢN LÝ DANH MỤC (ĐẶT NGAY TRÊN QUẢN LÝ SẢN PHẨM)
        // =========================================================================
        {
            name: 'Danh Mục Sản Phẩm',
            path: '/admin/categories',
            icon: () => <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12zM10 9h8v2h-8V9zm0 3h8v2h-8v-2zm0-6h8v2h-8V6z" /></svg>
        },
        {
            name: 'Quản lý Sản phẩm',
            path: '/admin/products',
            icon: () => <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M20 4H4C2.895 4 2 4.895 2 6V18C2 19.105 2.895 20 4 20H20C21.105 20 22 19.105 22 18V6C22 4.895 21.105 4 20 4ZM20 18H4V12H20V18ZM20 8H4V6H20V8Z" /></svg>
        },
        {
            name: 'Quản lý Dịch vụ',
            path: '/admin/services',
            icon: () => <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 2c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2zm1 10h3l-4-4-4 4h3v4h2v-4z" /></svg>
        },
        {
            name: 'Quản lý Kho',
            path: '/admin/inventory-transactions',
            icon: () => <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 2c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2zm1 10h3l-4-4-4 4h3v4h2v-4z" /></svg>
        },
        {
            name: 'Quản lý Nhà Cung Cấp',
            path: '/admin/suppliers',
            icon: () => <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M20 17H4V7H20V17ZM4 5H2V3C2 1.9 2.9 1 4 1H20C21.1 1 22 1.9 22 3V5H20V7H22C23.1 7 24 7.9 24 9V19C24 20.1 23.1 21 22 21H20V23H18V21H6V23H4V21C2.9 21 2 20.1 2 19V9C2 7.9 2.9 7 4 7H6V5H4Z" /></svg>
        },
        {
            name: 'Quản lý Khách hàng',
            path: '/admin/customers',
            icon: () => <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" /></svg>
        },
        {
            name: 'Quản lý Nhân viên',
            path: '/admin/staffs',
            icon: () => <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M15 12C17.21 12 19 10.21 19 8C19 5.79 17.21 4 15 4C12.79 4 11 5.79 11 8C11 10.21 12.79 12 15 12ZM6 10V7H4V10H1V12H4V15H6V12H9V10H6ZM15 14C12.33 14 7 15.34 7 18V20H23V18C23 15.34 17.67 14 15 14Z" /></svg>
        },
    ];

    const handleAdminLogout = async () => {
        try {
            await authService.logout();
        } catch (err) {
            console.error(err);
        } finally {
            localStorage.removeItem('access_token');
            localStorage.removeItem('current_user');
            window.location.href = '/';
        }
    };

    // SỬA: Đảm bảo so khớp chính xác cụm router con mà không bị kẹt ở Bảng điều khiển mặc định
    const currentTab = menuItems.find(item => location.pathname === item.path || location.pathname.startsWith(item.path + '/'))?.name || 'Bảng điều khiển';

    return (
        <div className="min-h-screen bg-zinc-100 flex font-sans text-zinc-900 selection:bg-blue-600 selection:text-white">

            {/* SIDEBAR */}
            <aside className={`bg-[#121212] text-white w-64 shrink-0 flex flex-col transition-all duration-300 border-r border-zinc-800 ${sidebarOpen ? 'block' : 'hidden md:flex md:w-20'}`}>

                {/* 1. Header Logo */}
                <div className="h-20 flex items-center gap-3 px-6 border-b border-zinc-800 shrink-0">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xl tracking-tighter shadow-md shrink-0">
                        NH
                    </div>
                    {sidebarOpen && (
                        <div className="overflow-hidden">
                            <span className="font-extrabold text-lg tracking-tight block leading-none truncate uppercase">NH Badminton</span>
                            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest block mt-1">Portal Quản Trị</span>
                        </div>
                    )}
                </div>

                {/* 2. Container chứa Menu */}
                <div className="p-4 overflow-y-auto flex-1">

                    {/* Danh sách Menu chính */}
                    <nav className="space-y-1.5 mb-6">
                        {menuItems.map((item) => {
                            const RenderIcon = item.icon;
                            // So khớp active linh hoạt hơn
                            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                            return (
                                <button
                                    key={item.name}
                                    onClick={() => navigate(item.path)}
                                    type="button"
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors text-left ${isActive ? 'bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/20' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                                        }`}
                                >
                                    <span className="shrink-0"><RenderIcon /></span>
                                    {sidebarOpen && <span className="truncate">{item.name}</span>}
                                </button>
                            );
                        })}
                    </nav>

                    {/* 3. CỤM SESSION BLOCK */}
                    <div className="pt-5 border-t border-zinc-800/80">

                        {/* Thông tin Admin */}
                        <div className="flex items-center gap-3 px-2 mb-4">
                            <div className="w-9 h-9 bg-gradient-to-tr from-amber-500 to-amber-400 rounded-xl flex items-center justify-center text-zinc-900 font-black text-xs shadow-md shrink-0">
                                AD
                            </div>
                            {sidebarOpen && (
                                <div className="overflow-hidden">
                                    <p className="text-xs font-bold text-white truncate">{adminUser?.full_name || 'Admin Quản Lý'}</p>
                                    <p className="text-[10px] text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 block"></span>
                                        <span>Đang trực hệ thống</span>
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Nút Đăng xuất */}
                        <button
                            onClick={handleAdminLogout}
                            type="button"
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-colors text-left text-red-400 hover:bg-red-500/10 hover:text-red-300 ${!sidebarOpen ? 'justify-center px-0' : ''
                                }`}
                        >
                            <span className="shrink-0">
                                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M17 7L15.59 8.41L18.17 11H8V13H18.17L15.59 15.59L17 17L22 12L17 7ZM4 5H12V3H4C2.9 3 2 3.9 2 5V19C2 20.1 2.9 21 4 21H12V19H4V5Z" /></svg>
                            </span>
                            {sidebarOpen && <span className="truncate">Đăng xuất</span>}
                        </button>
                    </div>

                </div>
            </aside>

            {/* NỘI DUNG CHÍNH */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="h-20 bg-white border-b border-zinc-200/80 px-6 flex items-center justify-between shrink-0 shadow-sm">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setSidebarOpen(!sidebarOpen)} type="button" className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 rounded-xl transition-colors focus:outline-none">
                            <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M3 18H21V16H3V18ZM3 13H21V11H3V13ZM3 6V8H21V6H3Z" /></svg>
                        </button>
                        <div>
                            <h2 className="text-lg font-black text-zinc-900 tracking-tight">{currentTab}</h2>
                            <p className="text-xs text-zinc-500 font-medium hidden sm:block">Hệ thống đồng bộ cơ sở dữ liệu thời gian thực</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 px-3 py-1.5 rounded-xl">
                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Lịch:</span>
                            <input type="date" defaultValue="2026-05-12" className="bg-transparent text-xs font-bold text-zinc-800 focus:outline-none cursor-pointer" />
                        </div>
                        <button className="px-4 py-2 bg-zinc-900 hover:bg-blue-600 text-white text-xs font-bold rounded-xl shadow transition-colors flex items-center gap-1.5" type="button">
                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12 4V1L8 5L12 9V6C15.31 6 18 8.69 18 12C18 13.01 17.75 13.97 17.3 14.8L18.76 16.26C19.54 15.03 20 13.57 20 12C20 7.58 16.42 4 12 4ZM12 18C8.69 18 6 15.31 6 12C6 10.99 6.25 10.03 6.7 9.2L5.24 7.74C4.46 8.97 4 10.43 4 12C4 16.42 7.58 20 12 20V23L16 19L12 15V18Z" /></svg>
                            <span className="hidden sm:inline">Làm mới</span>
                        </button>
                    </div>
                </header>

                <main className="flex-1 p-6 overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;