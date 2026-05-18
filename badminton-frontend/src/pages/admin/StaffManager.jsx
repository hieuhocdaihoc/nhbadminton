import React from 'react';

const StaffManager = () => {
    return (
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-zinc-100">
            <h3 className="text-base font-bold text-zinc-800 mb-1">Phân Quyền Nhân Viên</h3>
            <p className="text-xs text-zinc-400 mb-6">Quản lý các tài khoản trực quầy lễ tân.</p>
            <div className="p-10 bg-zinc-50 border border-zinc-100 rounded-xl text-center">
                <p className="text-3xl mb-3 opacity-20">🔐</p>
                <p className="text-sm font-semibold text-zinc-500">Tính năng Phân quyền Nâng cao</p>
                <p className="text-xs text-zinc-400 mt-1">Chỉ tài khoản Chủ sân mới có quyền thao tác khu vực này.</p>
            </div>
        </div>
    );
};

export default StaffManager;