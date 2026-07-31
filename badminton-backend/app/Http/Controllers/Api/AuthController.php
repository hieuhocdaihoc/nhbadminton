<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Image;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    private const PHONE_REGEX = '/^0[35789][0-9]{8}$/';
    private const GENDERS = ['male', 'female', 'other'];

    /** Chức năng: Đăng ký tài khoản khách hàng mới, mã hóa mật khẩu và cấp token đăng nhập. */
    public function register(Request $request)
    {
        if ($request->filled('phone')) {
            $request->merge(['phone' => preg_replace('/[\s\-]/', '', $request->phone)]);
        }

        $request->validate([
            'full_name' => ['required', 'string', 'min:2', 'max:100'],
            'email'     => ['required', 'email', 'max:150', 'unique:users,email'],
            'phone'     => ['required', 'string', 'regex:' . self::PHONE_REGEX, 'unique:users,phone'],
            'password'  => ['required', 'string', 'min:6', 'max:128'],
        ], [
            'full_name.min'  => 'Họ và tên phải có ít nhất 2 ký tự.',
            'full_name.max'  => 'Họ và tên không được vượt quá 100 ký tự.',
            'email.email'    => 'Địa chỉ email không hợp lệ.',
            'email.unique'   => 'Email này đã được sử dụng.',
            'phone.regex'    => 'Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại Việt Nam 10 số (bắt đầu bằng 03, 05, 07, 08 hoặc 09).',
            'phone.unique'   => 'Số điện thoại này đã được đăng ký.',
            'password.min'   => 'Mật khẩu phải có ít nhất 6 ký tự.',
        ]);

        $user = User::create([
            'full_name'     => $request->full_name,
            'email'         => $request->email,
            'phone'         => $request->phone,
            'password_hash' => Hash::make($request->password),
            'role'          => 'customer',
            'status'        => 'active',
        ]);

        return response()->json(['message' => 'Đăng ký thành công', 'user' => $user], 201);
    }

    /** Chức năng: Đăng nhập bằng số điện thoại, kiểm tra trạng thái tài khoản và trả về token theo role. */
    public function login(Request $request)
    {
        $request->validate([
            'phone'    => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('phone', $request->phone)->first();

        if (!$user || !Hash::check($request->password, $user->password_hash)) {
            return response()->json(['message' => 'Thông tin đăng nhập không chính xác'], 401);
        }

        if ($user->status !== 'active') {
            return response()->json(['message' => 'Tài khoản của bạn hiện đang bị khóa hoặc không hoạt động.'], 403);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message'      => 'Đăng nhập thành công',
            'access_token' => $token,
            'token_type'   => 'Bearer',
            'user'         => $user,
            'role'         => $user->role,
            'redirect_to'  => $this->getRedirectPathForRole($user->role),
            'permissions'  => $this->getPermissionsForRole($user->role),
        ]);
    }

    /** Chức năng: Trả về đường dẫn chuyển hướng sau đăng nhập dựa theo role. */
    private function getRedirectPathForRole(string $role): string
    {
        return match ($role) {
            'admin' => '/admin/dashboard',
            'staff' => '/admin/bookings/today',
            default => '/',
        };
    }

    /** Chức năng: Trả về danh sách quyền tương ứng với role của người dùng. */
    private function getPermissionsForRole(string $role): array
    {
        return match ($role) {
            'admin' => ['admin:*'],
            'staff' => ['bookings:read', 'bookings:update', 'payments:collect', 'pos:sell', 'catalog:read'],
            default => ['profile:read', 'profile:update', 'bookings:create', 'bookings:own-read'],
        };
    }

    /** Chức năng: Cho người dùng đang đăng nhập đổi mật khẩu sau khi xác thực mật khẩu hiện tại. */
    public function changePassword(Request $request)
    {
        $request->validate([
            'old_password' => ['required', 'string'],
            'new_password' => ['required', 'string', 'min:6', 'max:128', 'confirmed'],
        ]);

        $user = Auth::user();

        if (!Hash::check($request->old_password, $user->password_hash)) {
            return response()->json(['message' => 'Mật khẩu cũ không đúng'], 400);
        }

        if (Hash::check($request->new_password, $user->password_hash)) {
            return response()->json(['message' => 'Mật khẩu mới phải khác mật khẩu hiện tại'], 422);
        }

        $user->update(['password_hash' => Hash::make($request->new_password)]);

        return response()->json(['message' => 'Đổi mật khẩu thành công']);
    }

    /** Chức năng: Cập nhật thông tin cá nhân của tài khoản đang đăng nhập. */
    public function updateProfile(Request $request)
    {
        $user = Auth::user();

        if ($request->filled('phone')) {
            $request->merge(['phone' => preg_replace('/[\s\-]/', '', $request->phone)]);
        }

        $validated = $request->validate([
            'full_name'     => ['required', 'string', 'min:2', 'max:100'],
            'email'         => ['required', 'email', 'max:150', 'unique:users,email,' . $user->id],
            'phone'         => ['required', 'string', 'regex:' . self::PHONE_REGEX, 'unique:users,phone,' . $user->id],
            'gender'        => ['nullable', 'in:' . implode(',', self::GENDERS)],
            'date_of_birth' => ['nullable', 'date'],
        ], [
            'full_name.min' => 'Họ và tên phải có ít nhất 2 ký tự.',
            'full_name.max' => 'Họ và tên không được vượt quá 100 ký tự.',
            'email.email'   => 'Địa chỉ email không hợp lệ.',
            'email.unique'  => 'Email này đã được sử dụng bởi tài khoản khác.',
            'phone.regex'   => 'Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại Việt Nam 10 số (bắt đầu bằng 03, 05, 07, 08 hoặc 09).',
            'phone.unique'  => 'Số điện thoại này đã được đăng ký bởi tài khoản khác.',
        ]);

        $user->update($validated);

        return response()->json(['message' => 'Cập nhật thông tin thành công', 'user' => $user]);
    }

    /** Chức năng: Cho người dùng đang đăng nhập tải lên hoặc thay ảnh đại diện của chính mình. */
    public function uploadAvatar(Request $request)
    {
        $request->validate([
            'image' => ['required', 'image', 'mimes:jpeg,png,jpg,webp', 'max:2048'],
        ]);

        $user = Auth::user();

        Image::where('target_type', 'user')->where('target_id', $user->id)->update(['is_primary' => false]);

        $file     = $request->file('image');
        $fileName = time() . '_' . uniqid() . '.' . $file->getClientOriginalExtension();
        $path     = $file->storeAs('uploads/user', $fileName, 'public');

        $image = Image::create([
            'url'         => asset('storage/' . $path),
            'alt_text'    => 'Avatar của ' . $user->full_name,
            'target_type' => 'user',
            'target_id'   => $user->id,
            'sort_order'  => 0,
            'is_primary'  => true,
        ]);

        return response()->json(['message' => 'Cập nhật ảnh đại diện thành công', 'avatar_url' => $image->url]);
    }

    /** Chức năng: Lấy hồ sơ tài khoản đang đăng nhập kèm dữ liệu cần hiển thị ở frontend. */
    public function getProfile()
    {
        return response()->json(['message' => 'Lấy thông tin tài khoản thành công', 'user' => Auth::user()]);
    }

    /** Chức năng: Đăng xuất thiết bị hiện tại bằng cách xóa token đang sử dụng. */
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Đăng xuất thành công, token đã bị thu hồi']);
    }

    /** Chức năng: Đăng xuất tất cả thiết bị bằng cách xóa toàn bộ token của người dùng. */
    public function logoutAllDevices(Request $request)
    {
        $request->user()->tokens()->delete();

        return response()->json(['message' => 'Đã đăng xuất khỏi tất cả các thiết bị']);
    }
}
