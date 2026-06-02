<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;
use App\Models\UserAddress;

class AuthController extends Controller
{
    // 1. Đăng ký
    /**
     * Chức năng: Đăng ký tài khoản khách hàng mới, mã hóa mật khẩu và cấp token đăng nhập.
     */
    public function register(Request $request)
    {
        $request->validate([
            'full_name' => 'required|string|max:100',
            'email' => 'required|email|unique:users,email',
            'phone' => 'required|string|unique:users,phone',
            'password' => 'required|string|min:6',
        ]);

        $user = User::create([
            'full_name' => $request->full_name,
            'email' => $request->email,
            'phone' => $request->phone,
            'password_hash' => Hash::make($request->password), // Mã hóa mật khẩu
            'role' => 'customer',
            'status' => 'active'
        ]);

        return response()->json(['message' => 'Đăng ký thành công', 'user' => $user], 201);
    }
    // 2. Đăng nhập bằng Số điện thoại
    /**
     * Chức năng: Đăng nhập bằng email hoặc số điện thoại, kiểm tra trạng thái tài khoản và trả về token theo role.
     */
    public function login(Request $request)
    {
        $request->validate([
            'phone' => 'required|string',
            'password' => 'required|string',
        ]);

        $user = User::where('phone', $request->phone)->first();

        if (!$user || !Hash::check($request->password, $user->password_hash)) {
            return response()->json(['message' => 'Thông tin đăng nhập không chính xác'], 401);
        }

        if ($user->status !== 'active') {
            return response()->json([
                'message' => 'Tài khoản của bạn hiện đang bị khóa hoặc không hoạt động.'
            ], 403);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message' => 'Đăng nhập thành công',
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $user,
            'role' => $user->role,
            'redirect_to' => $this->getRedirectPathForRole($user->role),
            'permissions' => $this->getPermissionsForRole($user->role),
        ]);
    }

    /**
     * Chức năng: Mô tả nghiệp vụ của hàm getRedirectPathForRole.
     */
    private function getRedirectPathForRole(string $role): string
    {
        return match ($role) {
            'admin' => '/admin/dashboard',
            'staff' => '/admin/bookings/today',
            default => '/',
        };
    }

    /**
     * Chức năng: Mô tả nghiệp vụ của hàm getPermissionsForRole.
     */
    private function getPermissionsForRole(string $role): array
    {
        return match ($role) {
            'admin' => ['admin:*'],
            'staff' => [
                'bookings:read',
                'bookings:update',
                'payments:collect',
                'pos:sell',
                'catalog:read',
            ],
            default => [
                'profile:read',
                'profile:update',
                'bookings:create',
                'bookings:own-read',
            ],
        };
    }

    // 3. Đổi mật khẩu (Cần đăng nhập mới làm được)
    /**
     * Chức năng: Cho người dùng đang đăng nhập đổi mật khẩu sau khi xác thực mật khẩu hiện tại.
     */
    public function changePassword(Request $request)
    {
        $request->validate([
            'old_password' => 'required',
            'new_password' => 'required|min:6|confirmed',
        ]);

        $user = Auth::user();

        if (!Hash::check($request->old_password, $user->password_hash)) {
            return response()->json(['message' => 'Mật khẩu cũ không đúng'], 400);
        }

        $user->update([
            'password_hash' => Hash::make($request->new_password)
        ]);

        return response()->json(['message' => 'Đổi mật khẩu thành công']);
    }

    // 4. Cập nhật thông tin cá nhân
    /**
     * Chức năng: Cập nhật thông tin cá nhân của tài khoản đang đăng nhập.
     */
    public function updateProfile(Request $request)
    {
        // Lấy thông tin user đang đăng nhập (nhờ Token)
        $user = Auth::user();

        // Validate dữ liệu (Chú ý rule unique ngoại trừ ID của user hiện tại)
        $request->validate([
            'full_name' => 'required|string|max:100',
            'email' => 'required|email|unique:users,email,' . $user->id,
            'phone' => 'required|string|unique:users,phone,' . $user->id,
            'gender' => 'nullable|in:male,female,other',
            'date_of_birth' => 'nullable|date',
        ]);

        // Cập nhật dữ liệu vào DB
        $user->update([
            'full_name' => $request->full_name,
            'email' => $request->email,
            'phone' => $request->phone,
            'gender' => $request->gender, // Có thể có hoặc không
            'date_of_birth' => $request->date_of_birth, // Có thể có hoặc không
        ]);

        return response()->json([
            'message' => 'Cập nhật thông tin thành công',
            'user' => $user
        ]);
    }

    // 5. Thêm mới địa chỉ (Create)
    /**
     * Chức năng: Thêm địa chỉ nhận hàng/liên hệ cho người dùng và xử lý địa chỉ mặc định.
     */
    public function addAddress(Request $request)
    {
        $user = Auth::user();

        $request->validate([
            'province' => 'required|string|max:100',
            'district' => 'required|string|max:100',
            'ward' => 'required|string|max:100',
            'address_line' => 'required|string',
            'address_type' => 'required|in:home,office,other',
            'is_default' => 'boolean'
        ]);

        $isDefault = $request->is_default ?? false;

        // Logic 1: Nếu user chọn địa chỉ này làm mặc định -> Hủy các mặc định cũ
        if ($isDefault) {
            UserAddress::where('user_id', $user->id)->update(['is_default' => false]);
        }
        // Logic 2: Nếu đây là địa chỉ đầu tiên của user -> Tự động ép thành mặc định
        else {
            $addressCount = UserAddress::where('user_id', $user->id)->count();
            if ($addressCount === 0) {
                $isDefault = true;
            }
        }

        // Tạo địa chỉ mới
        $address = UserAddress::create([
            'user_id' => $user->id, // Lấy ID của user đang đăng nhập
            'province' => $request->province,
            'district' => $request->district,
            'ward' => $request->ward,
            'address_line' => $request->address_line,
            'address_type' => $request->address_type,
            'is_default' => $isDefault,
        ]);

        return response()->json([
            'message' => 'Thêm địa chỉ mới thành công',
            'address' => $address
        ], 201);
    }

    // 6. Cập nhật một địa chỉ cụ thể
    /**
     * Chức năng: Cập nhật địa chỉ thuộc tài khoản hiện tại và đồng bộ lại cờ mặc định nếu cần.
     */
    public function updateAddress(Request $request, $id)
    {
        $user = Auth::user();

        // Kiểm tra quyền sở hữu: Tránh việc User này sửa địa chỉ của User khác
        $address = UserAddress::where('id', $id)->where('user_id', $user->id)->first();

        if (!$address) {
            return response()->json(['message' => 'Không tìm thấy địa chỉ hợp lệ'], 404);
        }

        $request->validate([
            'province' => 'required|string|max:100',
            'district' => 'required|string|max:100',
            'ward' => 'required|string|max:100',
            'address_line' => 'required|string',
            'address_type' => 'required|in:home,office,other',
            'is_default' => 'boolean'
        ]);

        // Nếu cập nhật địa chỉ này thành mặc định, hủy mặc định của các địa chỉ khác
        if ($request->is_default) {
            UserAddress::where('user_id', $user->id)->where('id', '!=', $id)->update(['is_default' => false]);
        }

        $address->update($request->all());

        return response()->json(['message' => 'Cập nhật địa chỉ thành công', 'address' => $address]);
    }

    // 7. Lấy thông tin cá nhân của người dùng đang đăng nhập
    /**
     * Chức năng: Lấy hồ sơ tài khoản đang đăng nhập kèm dữ liệu cần hiển thị ở frontend.
     */
    public function getProfile()
    {
        // Auth::user() sẽ tự động lấy User dựa trên Token gửi lên
        $user = Auth::user();

        return response()->json([
            'message' => 'Lấy thông tin tài khoản thành công',
            'user' => $user
        ]);
    }

    // 8. Đăng xuất (Xóa token hiện tại)
    /**
     * Chức năng: Đăng xuất thiết bị hiện tại bằng cách xóa token đang sử dụng.
     */
    public function logout(Request $request)
    {
        // Lấy user hiện tại và xóa chính xác cái Token đang dùng để gọi API này
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Đăng xuất thành công, token đã bị thu hồi'
        ]);
    }

    // (TẶNG THÊM) 9. Đăng xuất khỏi TẤT CẢ các thiết bị
    /**
     * Chức năng: Đăng xuất tất cả thiết bị bằng cách xóa toàn bộ token của người dùng.
     */
    public function logoutAllDevices(Request $request)
    {
        // Xóa toàn bộ token của user này trong DB (Đăng xuất cả trên Web lẫn App)
        $request->user()->tokens()->delete();

        return response()->json([
            'message' => 'Đã đăng xuất khỏi tất cả các thiết bị'
        ]);
    }
}
