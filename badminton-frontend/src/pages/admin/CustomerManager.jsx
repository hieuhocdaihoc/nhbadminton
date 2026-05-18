import React from 'react';

const CustomerManager = () => {
    return (
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-zinc-100">
            <h3 className="text-base font-bold text-zinc-800 mb-1">Hồ Sơ Khách Hàng</h3>
            <p className="text-xs text-zinc-400 mb-6">Tra cứu thông tin liên hệ, lịch sử đặt ca hoặc uy tín của vợt thủ.</p>
            <div className="p-10 bg-zinc-50 border border-zinc-100 rounded-xl text-center">
                <p className="text-3xl mb-3 opacity-20">👤</p>
                <p className="text-sm font-semibold text-zinc-500">Đang chờ kết nối API</p>
                <p className="text-xs text-zinc-400 mt-1">Chức năng phân loại tự động khách vãng lai và hội viên.</p>
            </div>
        </div>
    );
};

export default CustomerManager;