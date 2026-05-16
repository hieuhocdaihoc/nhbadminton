import React from 'react';

const CustomerManager = () => {
    return (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-zinc-200/80 shadow-sm">
            <h3 className="text-lg font-black text-zinc-900 mb-1">Hồ Sơ Khách Hàng</h3>
            <p className="text-xs text-zinc-500 mb-6">Tra cứu thông tin liên hệ, lịch sử đặt ca hoặc uy tín của vợt thủ.</p>
            <div className="p-8 bg-zinc-50 border border-zinc-100 rounded-2xl text-center">
                <p className="text-xs font-bold text-zinc-500">Hệ thống đang chờ kết nối API danh sách Users từ Laravel...</p>
                <p className="text-[11px] text-zinc-400 mt-1">Chức năng phân loại tự động khách vãng lai và khách hội viên.</p>
            </div>
        </div>
    );
};

export default CustomerManager;