<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class CheckUserStatus
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if ($user && $user->status === 'blocked') {
            $user->tokens()->delete();

            return response()->json([
                'message' => 'Tài khoản của bạn đã bị khóa.',
                'error_code' => 'ACCOUNT_BLOCKED',
            ], 403);
        }

        return $next($request);
    }
}
