import React from 'react';
import Header from '../components/user/Header';
import Footer from '../components/user/Footer';
import CourtPolicyButton from '../components/user/CourtPolicyButton';

const UserLayout = ({ children }) => {
    return (
        <div className="min-h-screen bg-white font-sans text-zinc-900 selection:bg-emerald-500 selection:text-white flex flex-col justify-between">
            {/* Cố định Header ở trên cùng */}
            <Header />

            {/* Phần nội dung chính (Động theo từng trang) */}
            <main className="flex-grow">
                {children}
            </main>

            {/* Cố định Footer ở dưới cùng */}
            <Footer />

            <CourtPolicyButton />
        </div>
    );
};

export default UserLayout;
