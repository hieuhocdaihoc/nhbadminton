import { lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

// Layouts
import UserLayout from "./layouts/UserLayout";
import AdminLayout from "./layouts/AdminLayout";

import ToastContainer from "./components/ToastContainer";
import {
  ADMIN_HOME_BY_ROLE,
  canAccessAdminPath,
  readStoredUser,
} from "./utils/accessControl";

const HomePage = lazy(() => import("./pages/user/HomePage"));
const UserProfile = lazy(() => import("./pages/user/UserProfile"));
const BookingHistory = lazy(() => import("./pages/user/BookingHistory"));
const BookingPage = lazy(() => import("./pages/user/BookingPage"));
const GuestBookingLookup = lazy(() => import("./pages/user/GuestBookingLookup"));

const MembershipManager = lazy(() => import("./pages/admin/MembershipManager"));
const DashboardReport = lazy(() => import("./pages/admin/DashboardReport"));
const CourtManager = lazy(() => import("./pages/admin/CourtManager"));
const ProductManager = lazy(() => import("./pages/admin/ProductManager"));
const CustomerManager = lazy(() => import("./pages/admin/CustomerManager"));
const StaffManager = lazy(() => import("./pages/admin/StaffManager"));
const StaffShiftManager = lazy(() => import("./pages/admin/StaffShiftManager"));
const PricingManager = lazy(() => import("./pages/admin/PricingManager"));
const TodayBookings = lazy(() => import("./pages/admin/TodayBookings"));
const SingleBookings = lazy(() => import("./pages/admin/SingleBookings"));
const RecurringBookings = lazy(() => import("./pages/admin/RecurringBookings"));
const LongTermBookings = lazy(() => import("./pages/admin/LongTermBookings"));
const CreateBooking = lazy(() => import("./pages/admin/CreateBooking"));
const AdditionalServiceManager = lazy(() => import("./pages/admin/Services"));
const SupplierManager = lazy(() => import("./pages/admin/SupplierManager"));
const InventoryManager = lazy(() => import("./pages/admin/InventoryManager"));
const RevenueManager = lazy(() => import("./pages/admin/RevenueManager"));
const RefundManager = lazy(() => import("./pages/admin/RefundManager"));
const PromotionManager = lazy(() => import("./pages/admin/PromotionManager"));
const SystemSettings = lazy(() => import("./pages/admin/SystemSettings"));
const ReviewManager = lazy(() => import("./pages/admin/ReviewManager"));

// RÀO CẢN BẢO VỆ GIAO DIỆN ADMIN
const AdminRoute = ({ children, allowedRoles = ["admin", "staff"] }) => {
  const user = readStoredUser();
  if (!user) return <Navigate to="/" replace />;

  if (canAccessAdminPath(user.role, allowedRoles)) return children;

  if (user.role === "staff") {
    return <Navigate to={ADMIN_HOME_BY_ROLE.staff} replace />;
  }

  return <Navigate to="/" replace />;
};

const ProtectedAdminPage = ({ children, allowedRoles }) => (
  <AdminRoute allowedRoles={allowedRoles}>
    <AdminLayout>{children}</AdminLayout>
  </AdminRoute>
);

/**
 * Trang dành cho khách. Nếu phiên đang đăng nhập là admin/staff (VD: mở lại tab
 * sau khi tắt trình duyệt, localStorage còn token) thì đưa thẳng về khu quản trị,
 * tránh trạng thái lẫn lộn: header hiện "Admin" nhưng đang xem giao diện khách.
 */
const CustomerPage = ({ children }) => {
  const user = readStoredUser();
  const adminHome = user ? ADMIN_HOME_BY_ROLE[user.role] : null;

  if (adminHome) return <Navigate to={adminHome} replace />;

  return <UserLayout>{children}</UserLayout>;
};

const AdminEntryRedirect = () => {
  const user = readStoredUser();
  if (!user) return <Navigate to="/" replace />;

  return <Navigate to={ADMIN_HOME_BY_ROLE[user.role] || "/"} replace />;
};

const RouteLoading = () => (
  <div className="flex min-h-screen items-center justify-center bg-zinc-50" role="status">
    <span className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-emerald-600" />
    <span className="sr-only">Đang tải</span>
  </div>
);

function App() {
  return (
    <Router>
      <Suspense fallback={<RouteLoading />}>
      <Routes>
        {/* LUỒNG KHÁCH HÀNG */}
        <Route
          path="/"
          element={
            <CustomerPage>
              <HomePage />
            </CustomerPage>
          }
        />
        <Route
          path="/profile"
          element={
            <CustomerPage>
              <UserProfile />
            </CustomerPage>
          }
        />
        <Route
          path="/booking-history"
          element={
            <CustomerPage>
              <BookingHistory />
            </CustomerPage>
          }
        />
        <Route
          path="/booking-page"
          element={
            <CustomerPage>
              <BookingPage />
            </CustomerPage>
          }
        />
        <Route
          path="/guest-booking-lookup"
          element={
            <CustomerPage>
              <GuestBookingLookup />
            </CustomerPage>
          }
        />

        {/* LUỒNG QUẢN TRỊ VIÊN */}
        <Route path="/admin" element={<AdminEntryRedirect />} />
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedAdminPage allowedRoles={["admin", "staff"]}>
              <DashboardReport />
            </ProtectedAdminPage>
          }
        />
        <Route
          path="/admin/bookings"
          element={<Navigate to="/admin/bookings/today" replace />}
        />
        <Route
          path="/admin/courts"
          element={
            <ProtectedAdminPage allowedRoles={["admin"]}>
              <CourtManager />
            </ProtectedAdminPage>
          }
        />
        <Route
          path="/admin/products"
          element={
            <ProtectedAdminPage allowedRoles={["admin", "staff"]}>
              <ProductManager />
            </ProtectedAdminPage>
          }
        />
        <Route
          path="/admin/customers"
          element={
            <ProtectedAdminPage allowedRoles={["admin", "staff"]}>
              <CustomerManager />
            </ProtectedAdminPage>
          }
        />
        <Route
          path="/admin/staffs"
          element={
            <ProtectedAdminPage allowedRoles={["admin"]}>
              <StaffManager />
            </ProtectedAdminPage>
          }
        />
        <Route
          path="/admin/staff-shifts"
          element={
            <ProtectedAdminPage allowedRoles={["admin"]}>
              <StaffShiftManager />
            </ProtectedAdminPage>
          }
        />
        <Route
          path="/admin/pricings"
          element={
            <ProtectedAdminPage allowedRoles={["admin"]}>
              <PricingManager />
            </ProtectedAdminPage>
          }
        />
        <Route
          path="/admin/bookings/create"
          element={
            <ProtectedAdminPage allowedRoles={["admin", "staff"]}>
              <CreateBooking />
            </ProtectedAdminPage>
          }
        />
        <Route
          path="/admin/bookings/today"
          element={
            <ProtectedAdminPage allowedRoles={["admin", "staff"]}>
              <TodayBookings />
            </ProtectedAdminPage>
          }
        />
        <Route
          path="/admin/bookings/single"
          element={
            <ProtectedAdminPage allowedRoles={["admin", "staff"]}>
              <SingleBookings />
            </ProtectedAdminPage>
          }
        />
        <Route
          path="/admin/bookings/recurring"
          element={
            <ProtectedAdminPage allowedRoles={["admin", "staff"]}>
              <RecurringBookings />
            </ProtectedAdminPage>
          }
        />
        <Route
          path="/admin/bookings/long-term"
          element={
            <ProtectedAdminPage allowedRoles={["admin", "staff"]}>
              <LongTermBookings />
            </ProtectedAdminPage>
          }
        />
        <Route
          path="/admin/services"
          element={
            <ProtectedAdminPage allowedRoles={["admin", "staff"]}>
              <AdditionalServiceManager />
            </ProtectedAdminPage>
          }
        />
        <Route
          path="/admin/suppliers"
          element={
            <ProtectedAdminPage allowedRoles={["admin", "staff"]}>
              <SupplierManager />
            </ProtectedAdminPage>
          }
        />
        <Route
          path="/admin/inventory-transactions"
          element={
            <ProtectedAdminPage allowedRoles={["admin", "staff"]}>
              <InventoryManager />
            </ProtectedAdminPage>
          }
        />
        <Route
          path="/admin/revenue"
          element={
            <ProtectedAdminPage allowedRoles={["admin", "staff"]}>
              <RevenueManager />
            </ProtectedAdminPage>
          }
        />
        <Route
          path="/admin/refunds"
          element={
            <ProtectedAdminPage allowedRoles={["admin", "staff"]}>
              <RefundManager />
            </ProtectedAdminPage>
          }
        />
        <Route
          path="/admin/promotions"
          element={
            <ProtectedAdminPage allowedRoles={["admin"]}>
              <PromotionManager />
            </ProtectedAdminPage>
          }
        />
        <Route
          path="/admin/reviews"
          element={
            <ProtectedAdminPage allowedRoles={["admin", "staff"]}>
              <ReviewManager />
            </ProtectedAdminPage>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <ProtectedAdminPage allowedRoles={["admin"]}>
              <SystemSettings />
            </ProtectedAdminPage>
          }
        />

        <Route
          path="/admin/membership"
          element={
            <ProtectedAdminPage allowedRoles={["admin"]}>
              <MembershipManager />
            </ProtectedAdminPage>
          }
        />

        {/* Xử lý bẻ lái ngoại lệ 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      <ToastContainer />
    </Router>
  );
}

export default App;
