<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $limit = min((int) $request->query('limit', 10), 30);

        $notifications = Notification::where('receiver_id', $user->id)
            ->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get();

        $unreadCount = Notification::where('receiver_id', $user->id)
            ->where('is_read', false)
            ->count();

        // Fallback cho truong hop tai khoan admin/staff hien tai duoc tao sau
        // cac notification cu: van hien thi thong bao gan nhat trong kenh admin.
        if ($notifications->isEmpty() && in_array($user->role, ['admin', 'staff'], true)) {
            $adminReceiverIds = User::whereIn('role', ['admin', 'staff'])->pluck('id');

            $notifications = Notification::whereIn('receiver_id', $adminReceiverIds)
                ->orderBy('created_at', 'desc')
                ->limit($limit)
                ->get();

            $unreadCount = $notifications->where('is_read', false)->count();
        }

        $response = response()->json([
            'status' => 'success',
            'data' => [
                'unread_count' => $unreadCount,
                'notifications' => $notifications,
            ],
        ]);

        $response->headers->set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

        return $response;
    }

    public function markAsRead(Request $request, $id)
    {
        $notification = Notification::where('receiver_id', $request->user()->id)
            ->findOrFail($id);

        $notification->is_read = true;
        $notification->save();

        return response()->json([
            'status' => 'success',
            'message' => 'Da danh dau thong bao la da doc.',
            'data' => $notification,
        ]);
    }

    public function markAllAsRead(Request $request)
    {
        Notification::where('receiver_id', $request->user()->id)
            ->where('is_read', false)
            ->update(['is_read' => true]);

        return response()->json([
            'status' => 'success',
            'message' => 'Da danh dau tat ca thong bao la da doc.',
        ]);
    }
}
