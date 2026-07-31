export const ADMIN_HOME_BY_ROLE = {
  admin: "/admin/dashboard",
  staff: "/admin/bookings/today",
};

export const canAccessAdminPath = (role, allowedRoles) => {
  if (!["admin", "staff"].includes(role)) return false;
  if (!allowedRoles?.length) return true;
  return allowedRoles.includes(role);
};

export const readStoredUser = (storage = localStorage) => {
  const storedUser = storage.getItem("current_user");
  const storedRole = storage.getItem("current_role");
  if (!storedUser) return null;

  try {
    const user = JSON.parse(storedUser);
    return {
      ...user,
      role: user.role || storedRole,
    };
  } catch {
    return null;
  }
};
