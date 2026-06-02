<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserHasRole
{
    /**
     * Kiểm tra xem người dùng đã đăng nhập và có vai trò phù hợp hay không.
     *
     * Usage: middleware('role:admin,staff')
     */
    /**
     * Chức năng: Kiểm tra token đăng nhập và đảm bảo người dùng có một trong các role được phép truy cập route.
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Vui lòng đăng nhập để tiếp tục.',
            ], 401);
        }

        if (!in_array($user->role, $roles, true)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Bạn không có quyền thực hiện chức năng này.',
            ], 403);
        }

        if (isset($user->status) && $user->status !== 'active') {
            return response()->json([
                'status' => 'error',
                'message' => 'Tài khoản của bạn hiện không hoạt động.',
            ], 403);
        }

        return $next($request);
    }
}
