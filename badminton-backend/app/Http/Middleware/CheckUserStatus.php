<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class CheckUserStatus
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user() ?? Auth::guard('sanctum')->user();

        if ($user && $user->status !== 'active') {
            $user->tokens()->delete();

            return response()->json([
                'message' => 'Tài khoản của bạn đã bị khóa.',
                'error_code' => 'ACCOUNT_BLOCKED',
            ], 403);
        }

        return $next($request);
    }
}
