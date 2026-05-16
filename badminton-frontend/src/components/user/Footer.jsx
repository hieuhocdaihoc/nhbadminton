import React from 'react';

const Footer = () => {
    return (
        <footer id="footer" className="bg-zinc-900 text-zinc-400 pt-16 pb-12 border-t border-zinc-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 pb-16 border-b border-zinc-800">

                    {/* Brand */}
                    <div className="lg:col-span-2">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xl tracking-tighter">
                                NH
                            </div>
                            <span className="font-extrabold text-xl tracking-tight text-white">
                                Badminton<span className="text-blue-500">.</span>
                            </span>
                        </div>
                        <p className="text-zinc-400 text-sm max-w-sm leading-relaxed mb-6">
                            Hệ thống đặt lịch và quản lý sân cầu lông chuyên nghiệp độc quyền. Giải pháp chuyển đổi số tối ưu hóa trải nghiệm vợt thủ.
                        </p>
                        <div className="flex items-center gap-3">
                            <a href="#" aria-label="Facebook" className="w-10 h-10 rounded-xl bg-zinc-800 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-colors">
                                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                            </a>
                            <a href="#" aria-label="Instagram" className="w-10 h-10 rounded-xl bg-zinc-800 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-colors">
                                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44 1.441-.645 1.441-1.44-.645-1.44-1.441-1.44z" /></svg>
                            </a>
                        </div>
                    </div>

                    {/* Danh mục */}
                    <div>
                        <h4 className="text-white font-bold text-base mb-6 tracking-wide">Danh mục</h4>
                        <ul className="space-y-3 text-sm font-medium">
                            <li><a href="#" className="hover:text-blue-400 transition-colors">Trang chủ</a></li>
                            <li><a href="#utilities" className="hover:text-blue-400 transition-colors">Tiện ích</a></li>
                            <li><a href="#courts" className="hover:text-blue-400 transition-colors">Sơ đồ sân</a></li>
                            <li><a href="#steps" className="hover:text-blue-400 transition-colors">Quy trình</a></li>
                        </ul>
                    </div>

                    {/* Hỗ trợ */}
                    <div>
                        <h4 className="text-white font-bold text-base mb-6 tracking-wide">Hỗ trợ</h4>
                        <ul className="space-y-3 text-sm font-medium">
                            <li><a href="#" className="hover:text-blue-400 transition-colors">Câu hỏi thường gặp</a></li>
                            <li><a href="#" className="hover:text-blue-400 transition-colors">Chính sách bảo mật</a></li>
                            <li><a href="#" className="hover:text-blue-400 transition-colors">Điều khoản dịch vụ</a></li>
                            <li><a href="#" className="hover:text-blue-400 transition-colors">Quy chế hoạt động</a></li>
                        </ul>
                    </div>

                    {/* Liên hệ nhanh */}
                    <div>
                        <h4 className="text-white font-bold text-base mb-6 tracking-wide">Liên hệ</h4>
                        <div className="space-y-4 text-sm">
                            <div className="flex items-start gap-3">
                                <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5 fill-current" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z" /></svg>
                                <span>Khu Công nghệ cao, Quận 9, TP. HCM</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <svg className="w-5 h-5 text-blue-500 shrink-0 fill-current" viewBox="0 0 24 24"><path d="M6.62 10.79C8.06 13.62 10.38 15.94 13.21 17.38L15.41 15.18C15.69 14.9 16.08 14.82 16.43 14.93C17.55 15.3 18.75 15.5 20 15.5C20.55 15.5 21 15.95 21 16.5V20C21 20.55 20.55 21 20 21C10.61 21 3 13.39 3 4C3 3.45 3.45 3 4 3H7.5C8.05 3 8.5 3.45 8.5 4C8.5 5.25 8.7 6.45 9.07 7.57C9.18 7.92 9.1 8.31 8.82 8.59L6.62 10.79Z" /></svg>
                                <span>0123.456.789</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <svg className="w-5 h-5 text-blue-500 shrink-0 fill-current" viewBox="0 0 24 24"><path d="M20 4H4C2.9 4 2.01 4.9 2.01 6L2 18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 18H4V8L12 13L20 8V18ZM12 11L4 6H20L12 11Z" /></svg>
                                <span>support@nhbadminton.vn</span>
                            </div>
                        </div>
                    </div>

                </div>

                <div className="pt-8 text-center text-xs text-zinc-600 font-medium">
                    <p>© 2026 NH Badminton. Nền tảng phục vụ Khóa luận Tốt nghiệp.</p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;