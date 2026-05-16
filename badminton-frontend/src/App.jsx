import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import UserLayout from './layouts/UserLayout';
import AdminLayout from './layouts/AdminLayout';

// User Pages
import HomePage from './pages/user/HomePage';
import UserProfile from './pages/user/UserProfile';
import BookingHistory from './pages/user/BookingHistory';
import BookingPage from './pages/user/BookingPage';

// Admin Pages
import DashboardReport from './pages/admin/DashboardReport';
import BookingManager from './pages/admin/BookingManager';
import CourtManager from './pages/admin/CourtManager';
import ProductManager from './pages/admin/ProductManager';
import CustomerManager from './pages/admin/CustomerManager';
import StaffManager from './pages/admin/StaffManager';
import PricingManager from './pages/admin/PricingManager';
import TodayBookings from './pages/admin/TodayBookings';
import SingleBookings from './pages/admin/SingleBookings';
import RecurringBookings from './pages/admin/RecurringBookings';
import Categories from './pages/admin/Categories';
import AdditionalServiceManager from './pages/admin/Services';
import SupplierManager from './pages/admin/SupplierManager';
import InventoryManager from './pages/admin/InventoryManager';

// RÀO CẢN BẢO VỆ GIAO DIỆN ADMIN
const AdminRoute = ({ children }) => {
  const storedUser = localStorage.getItem('current_user');
  if (!storedUser) return <Navigate to="/" replace />;
  try {
    const user = JSON.parse(storedUser);
    if (user.role === 'admin' || user.role === 'staff') return children;
  } catch (err) { console.error(err); }
  return <Navigate to="/" replace />;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* LUỒNG KHÁCH HÀNG */}
        <Route path="/" element={<UserLayout><HomePage /></UserLayout>} />
        <Route path="/profile" element={<UserLayout><UserProfile /></UserLayout>} />
        <Route path="/booking-history" element={<UserLayout><BookingHistory /></UserLayout>} />
        <Route path="/booking-page" element={<UserLayout><BookingPage /></UserLayout>} />

        {/* LUỒNG QUẢN TRỊ VIÊN */}
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin/dashboard" element={<AdminRoute><AdminLayout><DashboardReport /></AdminLayout></AdminRoute>} />
        <Route path="/admin/bookings" element={<AdminRoute><AdminLayout><BookingManager /></AdminLayout></AdminRoute>} />
        <Route path="/admin/courts" element={<AdminRoute><AdminLayout><CourtManager /></AdminLayout></AdminRoute>} />
        <Route path="/admin/products" element={<AdminRoute><AdminLayout><ProductManager /></AdminLayout></AdminRoute>} />
        <Route path="/admin/customers" element={<AdminRoute><AdminLayout><CustomerManager /></AdminLayout></AdminRoute>} />
        <Route path="/admin/staffs" element={<AdminRoute><AdminLayout><StaffManager /></AdminLayout></AdminRoute>} />
        <Route path="/admin/pricings" element={<AdminRoute><AdminLayout><PricingManager /></AdminLayout></AdminRoute>} />
        <Route path="/admin/bookings/today" element={<AdminRoute><AdminLayout><TodayBookings /></AdminLayout></AdminRoute>} />
        <Route path="/admin/bookings/single" element={<AdminRoute><AdminLayout><SingleBookings /></AdminLayout></AdminRoute>} />
        <Route path="/admin/bookings/recurring" element={<AdminRoute><AdminLayout><RecurringBookings /></AdminLayout></AdminRoute>} />
        <Route path="/admin/categories" element={<AdminLayout><Categories /></AdminLayout>} />
        <Route path="/admin/services" element={<AdminRoute><AdminLayout><AdditionalServiceManager /></AdminLayout></AdminRoute>} />
        <Route path="/admin/suppliers" element={<AdminLayout><SupplierManager /></AdminLayout>} />
        <Route path="/admin/inventory-transactions" element={<AdminLayout><InventoryManager /></AdminLayout>} />

        {/* Xử lý bẻ lái ngoại lệ 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;