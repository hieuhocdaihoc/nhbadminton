import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeDollarSign,
  Boxes,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  CircleDollarSign,
  ClipboardList,
  Grid3X3,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PackageSearch,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCcw,
  ShieldCheck,
  Truck,
  Users,
  UserCog,
  Wrench,
  X,
} from "lucide-react";
import { authService } from "../services/auth/authService";

const menuGroups = [
  {
    label: "Tổng quan",
    items: [
      {
        name: "Báo cáo thống kê",
        path: "/admin/dashboard",
        icon: LayoutDashboard,
        desc: "KPI, doanh thu và hiệu suất sân",
        roles: ["admin", "staff"],
      },
      {
        name: "Quản lý doanh thu",
        path: "/admin/revenue",
        icon: CircleDollarSign,
        desc: "Giao dịch và đối soát thanh toán",
        roles: ["admin", "staff"],
      },
    ],
  },
  {
    label: "Đặt sân",
    items: [
      {
        name: "Lịch đặt hôm nay",
        path: "/admin/bookings/today",
        icon: CalendarCheck2,
        desc: "Ca chơi, thu tiền và in bill",
        roles: ["admin", "staff"],
      },
      {
        name: "Danh sách đặt lẻ",
        path: "/admin/bookings/single",
        icon: ClipboardList,
        desc: "Theo dõi các đơn đặt sân lẻ",
        roles: ["admin", "staff"],
      },
      {
        name: "Hợp đồng định kỳ",
        path: "/admin/bookings/recurring",
        icon: CalendarClock,
        desc: "Khách thuê sân theo lịch cố định",
        roles: ["admin", "staff"],
      },
    ],
  },
  {
    label: "Cơ sở vật chất",
    items: [
      {
        name: "Quản lý cụm sân",
        path: "/admin/courts",
        icon: Grid3X3,
        desc: "Sân, trạng thái và thông số khai thác",
        roles: ["admin", "staff"],
      },
      {
        name: "Cấu hình giá sân",
        path: "/admin/pricings",
        icon: BadgeDollarSign,
        desc: "Bảng giá theo khung giờ",
        roles: ["admin", "staff"],
      },
    ],
  },
  {
    label: "Kho & sản phẩm",
    items: [
      {
        name: "Danh mục sản phẩm",
        path: "/admin/categories",
        icon: Boxes,
        desc: "Nhóm hàng hóa và dịch vụ",
        roles: ["admin", "staff"],
      },
      {
        name: "Quản lý sản phẩm",
        path: "/admin/products",
        icon: Package,
        desc: "SKU, giá bán và tồn kho",
        roles: ["admin", "staff"],
      },
      {
        name: "Quản lý dịch vụ",
        path: "/admin/services",
        icon: Wrench,
        desc: "Thuê vợt, HLV và dịch vụ ngoài",
        roles: ["admin", "staff"],
      },
      {
        name: "Quản lý kho",
        path: "/admin/inventory-transactions",
        icon: PackageSearch,
        desc: "Nhập xuất kho và tồn hàng",
        roles: ["admin", "staff"],
      },
      {
        name: "Nhà cung cấp",
        path: "/admin/suppliers",
        icon: Truck,
        desc: "Đối tác và nguồn hàng",
        roles: ["admin", "staff"],
      },
    ],
  },
  {
    label: "Nhân sự",
    items: [
      {
        name: "Quản lý khách hàng",
        path: "/admin/customers",
        icon: Users,
        desc: "Hồ sơ khách và lịch sử đặt sân",
        roles: ["admin", "staff"],
      },
      {
        name: "Quản lý nhân viên",
        path: "/admin/staffs",
        icon: UserCog,
        desc: "Tài khoản, vai trò và mật khẩu",
        roles: ["admin"],
      },
      {
        name: "Ca làm nhân viên",
        path: "/admin/staff-shifts",
        icon: CalendarDays,
        desc: "Lịch trực, điểm danh và bàn giao ca",
        roles: ["admin"],
      },
    ],
  },
];

const getAdminHomeByRole = (role) =>
  role === "staff" ? "/admin/bookings/today" : "/admin/dashboard";

const getInitials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "AD";

const readStoredAdminUser = () => {
  try {
    const stored = localStorage.getItem("current_user");
    const storedRole = localStorage.getItem("current_role");
    if (!stored) return null;

    const user = JSON.parse(stored);
    return {
      ...user,
      role: user.role || storedRole,
    };
  } catch (err) {
    console.error(err);
    return null;
  }
};

const AdminLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminUser] = useState(readStoredAdminUser);
  const navigate = useNavigate();
  const location = useLocation();
  const currentRole = adminUser?.role || "admin";

  const visibleMenuGroups = useMemo(
    () =>
      menuGroups
        .map((group) => ({
          ...group,
          items: group.items.filter(
            (item) => !item.roles || item.roles.includes(currentRole),
          ),
        }))
        .filter((group) => group.items.length > 0),
    [currentRole],
  );

  const visibleItems = useMemo(
    () => visibleMenuGroups.flatMap((group) => group.items),
    [visibleMenuGroups],
  );

  const activeItem = useMemo(
    () =>
      visibleItems.find(
        (item) =>
          location.pathname === item.path ||
          location.pathname.startsWith(item.path + "/"),
      ) || visibleItems[0],
    [location.pathname, visibleItems],
  );

  const activeGroup = useMemo(
    () =>
      visibleMenuGroups.find((group) =>
        group.items.some((item) => item.path === activeItem.path),
      ),
    [activeItem.path, visibleMenuGroups],
  );

  const handleAdminLogout = async () => {
    try {
      await authService.logout();
    } catch (err) {
      console.error(err);
    } finally {
      localStorage.removeItem("access_token");
      localStorage.removeItem("current_user");
      localStorage.removeItem("current_role");
      localStorage.removeItem("permissions");
      window.location.href = "/";
    }
  };

  const handleNavigate = (path) => {
    setMobileMenuOpen(false);
    navigate(path);
  };

  const renderSidebar = (forceExpanded = false) => {
    const isExpanded = forceExpanded || sidebarOpen;

    return (
      <aside
        className={`admin-sidebar ${isExpanded ? "w-[284px]" : "w-[84px]"} flex h-full flex-col border-r border-slate-200/80 bg-slate-950 text-white shadow-2xl shadow-slate-950/10 transition-all duration-300`}
      >
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-4">
          <button
            type="button"
            onClick={() => navigate(getAdminHomeByRole(currentRole))}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lime-400 text-sm font-black tracking-tight text-slate-950 shadow-lg shadow-lime-500/20"
            title="NH Badminton"
          >
            NH
          </button>

          {isExpanded && (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight">
                NH Badminton
              </p>
              <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-lime-300">
                Admin workspace
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white md:hidden"
            title="Đóng menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          {visibleMenuGroups.map((group) => (
            <section key={group.label} className="mb-5">
              {isExpanded && (
                <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  {group.label}
                </p>
              )}

              <nav className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    location.pathname === item.path ||
                    location.pathname.startsWith(item.path + "/");

                  return (
                    <button
                      key={item.path}
                      type="button"
                      title={!isExpanded ? item.name : undefined}
                      onClick={() => handleNavigate(item.path)}
                      className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-all ${
                        isActive
                          ? "bg-white text-slate-950 shadow-lg shadow-black/10"
                          : "text-slate-400 hover:bg-white/8 hover:text-white"
                      } ${!isExpanded ? "justify-center" : ""}`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                          isActive
                            ? "bg-lime-400 text-slate-950"
                            : "bg-white/5 text-slate-400 group-hover:bg-white/10 group-hover:text-lime-300"
                        }`}
                      >
                        <Icon className="h-4.5 w-4.5" />
                      </span>

                      {isExpanded && (
                        <span className="min-w-0">
                          <span className="block truncate">{item.name}</span>
                          <span
                            className={`mt-0.5 block truncate text-[11px] font-medium ${
                              isActive ? "text-slate-500" : "text-slate-600"
                            }`}
                          >
                            {item.desc}
                          </span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </section>
          ))}
        </div>

        <div className="border-t border-white/10 p-3">
          <div
            className={`mb-2 flex items-center gap-3 rounded-xl bg-white/5 p-2.5 ${
              !isExpanded ? "justify-center" : ""
            }`}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-lime-300 to-emerald-400 text-xs font-black text-slate-950">
              {getInitials(adminUser?.full_name)}
            </div>

            {isExpanded && (
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">
                  {adminUser?.full_name || "Quản trị viên"}
                </p>
                <p className="mt-0.5 truncate text-[11px] font-medium capitalize text-slate-500">
                  {adminUser?.role || "admin"}
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleAdminLogout}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-300 ${
              !isExpanded ? "justify-center" : ""
            }`}
            title="Đăng xuất"
          >
            <LogOut className="h-4.5 w-4.5" />
            {isExpanded && <span>Đăng xuất</span>}
          </button>
        </div>
      </aside>
    );
  };

  return (
    <div className="admin-shell flex min-h-screen bg-[#f4f6f8] text-slate-900">
      <div className="hidden md:block">{renderSidebar()}</div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            className="fixed inset-0 z-50 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Đóng menu"
            />
            <motion.div
              className="relative h-full w-[min(88vw,320px)]"
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
            >
              {renderSidebar(true)}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl md:px-6">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 md:hidden"
                title="Mở menu"
              >
                <Menu className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={() => setSidebarOpen((value) => !value)}
                className="hidden h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 md:flex"
                title={sidebarOpen ? "Thu gọn menu" : "Mở rộng menu"}
              >
                {sidebarOpen ? (
                  <PanelLeftClose className="h-5 w-5" />
                ) : (
                  <PanelLeftOpen className="h-5 w-5" />
                )}
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  <span>{activeGroup?.label || "Admin"}</span>
                  <ChevronLeft className="h-3 w-3 rotate-180" />
                  <span className="truncate text-lime-700">NH Badminton</span>
                </div>
                <h1 className="mt-0.5 truncate text-lg font-black tracking-tight text-slate-950">
                  {activeItem.name}
                </h1>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="hidden items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 sm:flex">
                <ShieldCheck className="h-4 w-4" />
                Hệ thống hoạt động
              </div>

              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                title="Tải lại trang"
              >
                <RefreshCcw className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>
        </header>

        <main className="admin-content flex-1 overflow-y-auto px-4 py-5 md:px-6 lg:px-7">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
