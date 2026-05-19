<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Support\Str;

class AdminUserController extends Controller
{
    /**
     * -------------------------------------------------------------
     * LẤY DANH SÁCH TÀI KHOẢN
     * -------------------------------------------------------------
     */
    public function index(Request $request)
    {
        // Khởi tạo query lấy dữ liệu từ bảng users
        $query = User::query();
        if ($request->filled('role')) {
            $query->where('role', $request->role);
        }
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('search')) {

            // Lấy từ khóa tìm kiếm
            $search = $request->search;

            $query->where(function ($q) use ($search) {

                $q->where('full_name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('customer_code', 'like', "%{$search}%");
            });
        }
        $users = $query
            ->orderByDesc('created_at')
            ->paginate($request->get('per_page', 10));

        // Trả dữ liệu về frontend
        return response()->json([
            'message' => 'Lấy danh sách tài khoản thành công',
            'data' => $users
        ]);
    }

    /**
     * -------------------------------------------------------------
     * TẠO TÀI KHOẢN MỚI
     * -------------------------------------------------------------
     */
    public function store(Request $request)
    {
        /**
         * Validate dữ liệu đầu vào
         */
        $validated = $request->validate([

            'full_name' => ['required', 'string', 'max:100'],

            'email' => [
                'nullable',
                'email',
                'max:100',
                'unique:users,email'
            ],

            'phone' => [
                'required',
                'string',
                'max:20',
                'unique:users,phone'
            ],

            'password' => ['required', 'string', 'min:6'],
            'role' => [
                'required',
                Rule::in(['staff', 'customer'])
            ],

            'gender' => [
                'nullable',
                Rule::in(['male', 'female', 'other'])
            ],

            'date_of_birth' => ['nullable', 'date'],

            'membership_level' => ['nullable', 'string', 'max:50'],

            'status' => [
                'nullable',
                Rule::in(['active', 'blocked'])
            ],
        ]);

        /**
         * Tạo user mới
         */
        $user = User::create([

            // Sinh UUID
            'id' => (string) Str::uuid(),

            'full_name' => $validated['full_name'],

            'email' => $validated['email'] ?? null,

            'phone' => $validated['phone'],
            'password_hash' => Hash::make($validated['password']),

            'role' => $validated['role'],

            'gender' => $validated['gender'] ?? null,

            'date_of_birth' => $validated['date_of_birth'] ?? null,

            'membership_level' => $validated['membership_level'] ?? null,

            'status' => $validated['status'] ?? 'active',
            'customer_code' => $validated['role'] === 'customer'
                ? 'KH' . now()->format('YmdHis')
                : null,

            // Điểm mặc định
            'points' => 0,

            // Tổng chi tiêu mặc định
            'total_spent' => 0,
        ]);

        return response()->json([
            'message' => 'Tạo tài khoản thành công',
            'data' => $user
        ], 201);
    }

    /**
     * -------------------------------------------------------------
     * XEM CHI TIẾT TÀI KHOẢN
     * -------------------------------------------------------------
     */
    public function show($id)
    {
        $user = User::findOrFail($id);

        return response()->json([
            'message' => 'Lấy chi tiết tài khoản thành công',
            'data' => $user
        ]);
    }

    /**
     * -------------------------------------------------------------
     * CẬP NHẬT TÀI KHOẢN
     * -------------------------------------------------------------
     */
    public function update(Request $request, $id)
    {
        // Tìm user theo id
        $user = User::findOrFail($id);
        if ($user->role === 'admin') {

            return response()->json([
                'message' => 'Không được chỉnh sửa tài khoản admin bằng chức năng này'
            ], 403);
        }
        $validated = $request->validate([

            'full_name' => ['required', 'string', 'max:100'],

            'email' => [
                'nullable',
                'email',
                'max:100',
                Rule::unique('users', 'email')->ignore($user->id),
            ],

            'phone' => [
                'required',
                'string',
                'max:20',

                Rule::unique('users', 'phone')->ignore($user->id),
            ],

            'gender' => [
                'nullable',
                Rule::in(['male', 'female', 'other'])
            ],

            'date_of_birth' => ['nullable', 'date'],

            'membership_level' => ['nullable', 'string', 'max:50'],

            'status' => [
                'nullable',
                Rule::in(['active', 'blocked'])
            ],
        ]);
        $user->update($validated);

        return response()->json([
            'message' => 'Cập nhật tài khoản thành công',
            'data' => $user
        ]);
    }

    /**
     * -------------------------------------------------------------
     * KHÓA / MỞ KHÓA TÀI KHOẢN
     * -------------------------------------------------------------
     */
    public function updateStatus(Request $request, $id)
    {
        $user = User::findOrFail($id);
        if ($user->role === 'admin') {

            return response()->json([
                'message' => 'Không được khóa tài khoản admin'
            ], 403);
        }
        $validated = $request->validate([
            'status' => [
                'required',
                Rule::in(['active', 'blocked'])
            ],
        ]);
        $user->update([
            'status' => $validated['status']
        ]);

        return response()->json([
            'message' => 'Cập nhật trạng thái tài khoản thành công',
            'data' => $user
        ]);
    }

    /**
     * -------------------------------------------------------------
     * RESET MẬT KHẨU
     * -------------------------------------------------------------
     */
    public function resetPassword(Request $request, $id)
    {
        $user = User::findOrFail($id);
        if ($user->role === 'admin') {

            return response()->json([
                'message' => 'Không được đổi mật khẩu admin bằng chức năng này'
            ], 403);
        }
        $validated = $request->validate([
            'password' => ['required', 'string', 'min:6', 'confirmed'],
        ]);

        /**
         * Cập nhật password mới
         */
        $user->update([
            'password_hash' => Hash::make($validated['password'])
        ]);

        return response()->json([
            'message' => 'Đặt lại mật khẩu thành công'
        ]);
    }
    /**
     * -------------------------------------------------------------
     * THỐNG KÊ ĐƠN ĐẶT SÂN CỦA TÀI KHOẢN
     * -------------------------------------------------------------
     */
    public function bookingStats($id)
    {
        // Tìm tài khoản theo id
        $user = User::findOrFail($id);

        // Khởi tạo query lấy các đơn đặt sân của tài khoản này
        $bookingQuery = $user->bookings();

        // Đếm tổng số đơn
        $totalBookings = (clone $bookingQuery)->count();

        // Đếm số đơn theo từng trạng thái
        $pendingBookings = (clone $bookingQuery)->where('status', 'pending')->count();
        $confirmedBookings = (clone $bookingQuery)->where('status', 'confirmed')->count();
        $completedBookings = (clone $bookingQuery)->where('status', 'completed')->count();
        $cancelledBookings = (clone $bookingQuery)->where('status', 'cancelled')->count();

        // Đếm số đơn đã thanh toán
        $paidBookings = (clone $bookingQuery)->where('payment_status', 'paid')->count();

        // Tính tổng tiền từ các đơn không bị hủy
        $totalBookingAmount = (clone $bookingQuery)
            ->where('status', '!=', 'cancelled')
            ->sum('total_price');

        // Tính tổng tiền đã thanh toán
        $totalPaidAmount = (clone $bookingQuery)
            ->where('payment_status', 'paid')
            ->where('status', '!=', 'cancelled')
            ->sum('total_price');

        // Trả kết quả về frontend
        return response()->json([
            'message' => 'Lấy thống kê đơn đặt sân của tài khoản thành công',
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'full_name' => $user->full_name,
                    'phone' => $user->phone,
                    'email' => $user->email,
                    'role' => $user->role,
                    'status' => $user->status,
                ],
                'booking_stats' => [
                    'total_bookings' => $totalBookings,
                    'pending_bookings' => $pendingBookings,
                    'confirmed_bookings' => $confirmedBookings,
                    'completed_bookings' => $completedBookings,
                    'cancelled_bookings' => $cancelledBookings,
                    'paid_bookings' => $paidBookings,
                    'total_booking_amount' => $totalBookingAmount,
                    'total_paid_amount' => $totalPaidAmount,
                ]
            ]
        ]);
    }
}