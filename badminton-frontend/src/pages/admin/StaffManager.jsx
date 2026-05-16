import React from 'react';

const StaffManager = () => {
    return (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-zinc-200/80 shadow-sm">
            <h3 className="text-lg font-black text-zinc-900 mb-1">Phân Quyền Nhân Viên</h3>
            <p className="text-xs text-zinc-500 mb-6">Quản lý các tài khoản trực quầy lễ tân.</p>
            <div className="p-8 bg-blue-50/50 border border-blue-100 rounded-2xl text-center">
                <p className="text-xs font-bold text-blue-900">Tính năng Phân quyền Nâng cao</p>
                <p className="text-[11px] text-blue-700 mt-1">Chỉ tài khoản Chủ sân mới có quyền thao tác khu vực này.</p>
            </div>
        </div>
    );
};

export default StaffManager;