import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

// Layouts
import UserLayout from "./layouts/UserLayout";
import AdminLayout from "./layouts/AdminLayout";

// User Pages
import HomePage from "./pages/user/HomePage";
import UserProfile from "./pages/user/UserProfile";
import BookingHistory from "./pages/user/BookingHistory";
import BookingPage from "./pages/user/BookingPage";

// Admin Pages
import DashboardReport from "./pages/admin/DashboardReport";
import BookingManager from "./pages/admin/BookingManager";
import CourtManager from "./pages/admin/CourtManager";
import ProductManager from "./pages/admin/ProductManager";
import CustomerManager from "./pages/admin/CustomerManager";
import StaffManager from "./pages/admin/StaffManager";
import StaffShiftManager from "./pages/admin/StaffShiftManager";
import PricingManager from "./pages/admin/PricingManager";
import TodayBookings from "./pages/admin/TodayBookings";
import SingleBookings from "./pages/admin/SingleBookings";
import RecurringBookings from "./pages/admin/RecurringBookings";
import Categories from "./pages/admin/Categories";
import AdditionalServiceManager from "./pages/admin/Services";
import SupplierManager from "./pages/admin/SupplierManager";
import InventoryManager from "./pages/admin/InventoryManager";
import RevenueManager from "./pages/admin/RevenueManager";

const ADMIN_HOME_BY_ROLE = {
  admin: "/admin/dashboard",
  staff: "/admin/bookings/today",
};

const canAccessAdminPath = (role, allowedRoles) => {
  if (!["admin", "staff"].includes(role)) return false;
  if (!allowedRoles?.length) return true;
  return allowedRoles.includes(role);
};

const readStoredUser = () => {
  const storedUser = localStorage.getItem("current_user");
  const storedRole = localStorage.getItem("current_role");
  if (!storedUser) return null;

  try {
    const user = JSON.parse(storedUser);
    return {
      ...user,
      role: user.role || storedRole,
    };
  } catch (err) {
    console.error(err);
    return null;
  }
};

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

const AdminEntryRedirect = () => {
  const user = readStoredUser();
  if (!user) return <Navigate to="/" replace />;

  return <Navigate to={ADMIN_HOME_BY_ROLE[user.role] || "/"} replace />;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* LUỒNG KHÁCH HÀNG */}
        <Route
          path="/"
          element={
            <UserLayout>
              <HomePage />
            </UserLayout>
          }
        />
        <Route
          path="/profile"
          element={
            <UserLayout>
              <UserProfile />
            </UserLayout>
          }
        />
        <Route
          path="/booking-history"
          element={
            <UserLayout>
              <BookingHistory />
            </UserLayout>
          }
        />
        <Route
          path="/booking-page"
          element={
            <UserLayout>
              <BookingPage />
            </UserLayout>
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
          element={
            <ProtectedAdminPage allowedRoles={["admin", "staff"]}>
              <BookingManager />
            </ProtectedAdminPage>
          }
        />
        <Route
          path="/admin/courts"
          element={
            <ProtectedAdminPage allowedRoles={["admin", "staff"]}>
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
            <ProtectedAdminPage allowedRoles={["admin", "staff"]}>
              <PricingManager />
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
          path="/admin/categories"
          element={
            <ProtectedAdminPage allowedRoles={["admin", "staff"]}>
              <Categories />
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

        {/* Xử lý bẻ lái ngoại lệ 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
