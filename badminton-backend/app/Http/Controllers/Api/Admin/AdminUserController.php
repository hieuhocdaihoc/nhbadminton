<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\User;
use App\Services\MembershipTierService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AdminUserController extends Controller
{
    // trang thai don chua hoan thanh
    private const ACTIVE_BOOKING_STATUSES = ['confirmed', 'playing'];

    // dinh dang so dien thoai viet nam
    private const PHONE_REGEX = '/^0[35789][0-9]{8}$/';
    private const PHONE_MESSAGE = 'Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại Việt Nam 10 số (bắt đầu bằng 03, 05, 07, 08 hoặc 09).';

    // kiem tra nguoi dang thao tac co phai staff khong
    private function isStaff(Request $request): bool
    {
        return $request->user()?->role === 'staff';
    }

    // bao loi khi staff thao tac ngoai quyen
    private function staffForbiddenResponse()
    {
        return response()->json(['message' => 'Nhân viên chỉ được quản lý tài khoản khách hàng.'], 403);
    }

    // staff chi duoc quan ly tai khoan khach hang
    private function staffCannotManageUser(Request $request, User $user): bool
    {
        return $this->isStaff($request) && $user->role !== 'customer';
    }

    // lay danh sach tai khoan
    public function index(Request $request)
    {
        $query = User::query()->with('avatar');

        if ($this->isStaff($request)) {
            $query->where('role', 'customer');
        } elseif ($request->filled('role')) {
            $query->where('role', $request->role);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(
                fn($q) => $q
                    ->where('full_name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('customer_code', 'like', "%{$search}%")
            );
        }

        // dem tong so tai khoan (khong loc theo trang thai)
        $metaBase = User::query();
        if ($this->isStaff($request)) {
            $metaBase->where('role', 'customer');
        } elseif ($request->filled('role')) {
            $metaBase->where('role', $request->role);
        }
        if ($request->filled('search')) {
            $search = $request->search;
            $metaBase->where(
                fn($q) => $q
                    ->where('full_name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('customer_code', 'like', "%{$search}%")
            );
        }
        $metaTotal = (clone $metaBase)->count();
        $metaActive = (clone $metaBase)->where('status', 'active')->count();

        return response()->json([
            'message' => 'Lấy danh sách tài khoản thành công',
            'data' => $query->orderByDesc('created_at')->paginate($request->integer('per_page', 10)),
            'meta' => ['total' => $metaTotal, 'active' => $metaActive],
        ]);
    }

    // tao tai khoan moi
    public function store(Request $request)
    {
        $validated = $request->validate([
            'full_name' => ['required', 'string', 'max:100'],
            'email' => ['nullable', 'email', 'max:100', 'unique:users,email'],
            'phone' => ['required', 'string', 'regex:' . self::PHONE_REGEX, 'unique:users,phone'],
            'password' => ['required', 'string', 'min:6', 'max:128'],
            'role' => ['required', Rule::in(['staff', 'customer'])],
            'gender' => ['nullable', Rule::in(['male', 'female', 'other'])],
            'date_of_birth' => ['nullable', 'date'],
            'status' => ['nullable', Rule::in(['active', 'blocked'])],
        ], ['phone.regex' => self::PHONE_MESSAGE]);

        if ($this->isStaff($request) && $validated['role'] !== 'customer') {
            return $this->staffForbiddenResponse();
        }

        $user = User::create([
            'id' => (string) Str::uuid(),
            'full_name' => $validated['full_name'],
            'email' => $validated['email'] ?? null,
            'phone' => $validated['phone'],
            'password_hash' => Hash::make($validated['password']),
            'role' => $validated['role'],
            'gender' => $validated['gender'] ?? null,
            'date_of_birth' => $validated['date_of_birth'] ?? null,
            'membership_level' => MembershipTierService::levelForPoints(0),
            'status' => $validated['status'] ?? 'active',
            // ma khach hang chi sinh cho role customer
            'customer_code' => $validated['role'] === 'customer' ? 'KH' . now()->format('YmdHis') : null,
            'points' => 0,
            'total_spent' => 0,
        ]);

        return response()->json([
            'message' => 'Tạo tài khoản thành công',
            'data' => $user,
        ], 201);
    }

    // xem chi tiet tai khoan
    public function show(Request $request, $id)
    {
        $user = User::with('avatar')->findOrFail($id);

        if ($this->staffCannotManageUser($request, $user)) {
            return $this->staffForbiddenResponse();
        }

        return response()->json([
            'message' => 'Lấy chi tiết tài khoản thành công',
            'data' => $user,
        ]);
    }

    // cap nhat thong tin tai khoan
    public function update(Request $request, $id)
    {
        $user = User::findOrFail($id);

        if ($this->staffCannotManageUser($request, $user)) {
            return $this->staffForbiddenResponse();
        }

        if ($user->role === 'admin') {
            return response()->json(['message' => 'Không được chỉnh sửa tài khoản admin bằng chức năng này.'], 403);
        }

        $validated = $request->validate([
            'full_name' => ['required', 'string', 'max:100'],
            'email' => ['nullable', 'email', 'max:100', Rule::unique('users', 'email')->ignore($user->id)],
            'phone' => ['required', 'string', 'regex:' . self::PHONE_REGEX, Rule::unique('users', 'phone')->ignore($user->id)],
            'gender' => ['nullable', Rule::in(['male', 'female', 'other'])],
            'date_of_birth' => ['nullable', 'date'],
            'status' => ['nullable', Rule::in(['active', 'blocked'])],
        ], ['phone.regex' => self::PHONE_MESSAGE]);

        $user->update($validated);

        return response()->json([
            'message' => 'Cập nhật tài khoản thành công',
            'data' => $user,
        ]);
    }

    // khoa hoac mo khoa tai khoan
    public function updateStatus(Request $request, $id)
    {
        $user = User::findOrFail($id);

        if ($this->staffCannotManageUser($request, $user)) {
            return $this->staffForbiddenResponse();
        }

        if ($user->role === 'admin') {
            return response()->json(['message' => 'Không được khóa tài khoản admin.'], 403);
        }

        $validated = $request->validate([
            'status' => ['required', Rule::in(['active', 'blocked'])],
        ]);

        // canh bao neu tai khoan con don chua hoan thanh
        $warning = null;
        if ($validated['status'] === 'blocked' && $user->status === 'active') {
            $activeCount = Booking::where('user_id', $user->id)
                ->whereIn('status', self::ACTIVE_BOOKING_STATUSES)
                ->count();

            if ($activeCount > 0) {
                $warning = "Tài khoản này đang có {$activeCount} đơn đặt sân chưa hoàn thành. Các đơn đó vẫn còn hiệu lực sau khi khóa.";
            }
        }

        $user->update(['status' => $validated['status']]);

        return response()->json([
            'message' => 'Cập nhật trạng thái tài khoản thành công',
            'data' => $user,
            'warning' => $warning,
        ]);
    }

    // dat lai mat khau cho tai khoan
    public function resetPassword(Request $request, $id)
    {
        $user = User::findOrFail($id);

        if ($this->staffCannotManageUser($request, $user)) {
            return $this->staffForbiddenResponse();
        }

        if ($user->role === 'admin') {
            return response()->json(['message' => 'Không được đổi mật khẩu admin bằng chức năng này.'], 403);
        }

        $validated = $request->validate([
            'password' => ['required', 'string', 'min:6', 'max:128', 'confirmed'],
        ]);

        $user->update(['password_hash' => Hash::make($validated['password'])]);

        return response()->json(['message' => 'Đặt lại mật khẩu thành công.']);
    }

    // thong ke don dat san cua tai khoan
    public function bookingStats(Request $request, $id)
    {
        $user = User::findOrFail($id);

        if ($this->staffCannotManageUser($request, $user)) {
            return $this->staffForbiddenResponse();
        }

        $q = $user->bookings();

        // dem so don theo tung trang thai bang 1 lan truy van
        $countByStatus = (clone $q)->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $totalBookings = $countByStatus->sum();
        $totalAmount = (clone $q)->where('status', '!=', 'cancelled')->sum('total_price');
        $totalPaidAmount = (clone $q)->where('payment_status', 'paid')->where('status', '!=', 'cancelled')->sum('total_price');
        $paidCount = (clone $q)->where('payment_status', 'paid')->count();

        return response()->json([
            'message' => 'Lấy thống kê đơn đặt sân của tài khoản thành công',
            'data' => [
                'user' => $user->only(['id', 'full_name', 'phone', 'email', 'role', 'status']),
                'booking_stats' => [
                    'total_bookings' => $totalBookings,
                    'confirmed_bookings' => $countByStatus['confirmed'] ?? 0,
                    'completed_bookings' => $countByStatus['completed'] ?? 0,
                    'cancelled_bookings' => $countByStatus['cancelled'] ?? 0,
                    'paid_bookings' => $paidCount,
                    'total_booking_amount' => $totalAmount,
                    'total_paid_amount' => $totalPaidAmount,
                ],
            ],
        ]);
    }
}
