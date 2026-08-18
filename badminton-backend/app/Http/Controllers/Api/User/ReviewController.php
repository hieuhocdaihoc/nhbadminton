<?php

namespace App\Http\Controllers\Api\User;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Notification;
use App\Models\Review;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ReviewController extends Controller
{
    // lay danh sach review da duyet de hien thi public tren trang chu hoac trang san
    public function index(Request $request)
    {
        $validated = $request->validate([
            'target_type' => ['nullable', 'in:court'],
            'target_id' => ['nullable', 'string', 'max:36'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:20'],
        ]);

        $query = Review::with([
            'user:id,full_name,customer_code',
            'user.avatar',
            'court:id,name,court_code',
            'booking:id,booking_code',
        ])
            ->where('target_type', $validated['target_type'] ?? 'court')
            ->where('status', 'approved');

        if (!empty($validated['target_id'])) {
            $query->where('target_id', $validated['target_id']);
        }

        $summaryQuery = clone $query;
        $reviews = $query
            ->orderByDesc('rating')
            ->limit((int) ($validated['limit'] ?? 12))
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => [
                'summary' => [
                    'average_rating' => round((float) (clone $summaryQuery)->avg('rating'), 1),
                    'total_reviews' => (int) (clone $summaryQuery)->count(),
                ],
                'reviews' => $reviews,
            ],
        ]);
    }

    // cho khach da hoan thanh don gui danh gia san va dua review vao trang thai cho duyet
    public function store(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'target_type' => ['required', 'in:court'],
            'target_id' => ['required', 'exists:courts,id'],
            'booking_id' => ['required', 'exists:bookings,id'],
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'comment' => ['required', 'string', 'min:5', 'max:1000'],
        ]);

        $booking = Booking::with('details')
            ->where('id', $validated['booking_id'])
            ->where('user_id', $user->id)
            ->first();

        if (!$booking) {
            return response()->json([
                'status' => 'error',
                'message' => 'Don dat san khong thuoc tai khoan hien tai.',
            ], 403);
        }

        if ($booking->status !== 'completed' || $booking->payment_status !== 'paid') {
            return response()->json([
                'status' => 'error',
                'message' => 'Chi don da hoan thanh va da thanh toan moi duoc danh gia.',
            ], 422);
        }

        $hasPlayedCourt = $booking->details->contains(
            fn($detail) => $detail->court_id === $validated['target_id']
        );

        if (!$hasPlayedCourt) {
            return response()->json([
                'status' => 'error',
                'message' => 'San duoc danh gia khong nam trong don dat san nay.',
            ], 422);
        }

        $exists = Review::where('user_id', $user->id)
            ->where('booking_id', $booking->id)
            ->where('target_type', 'court')
            ->where('target_id', $validated['target_id'])
            ->exists();

        if ($exists) {
            return response()->json([
                'status' => 'error',
                'message' => 'Ban da danh gia san nay cho don dat san nay.',
            ], 422);
        }

        $review = Review::create([
            'user_id' => $user->id,
            'target_type' => 'court',
            'target_id' => $validated['target_id'],
            'booking_id' => $booking->id,
            'rating' => $validated['rating'],
            'comment' => trim($validated['comment']),
            'status' => 'pending',
        ]);

        $this->notifyAdminsAboutReview($review->load(['user', 'court', 'booking']));

        return response()->json([
            'status' => 'success',
            'message' => 'Đã gửi đánh giá. Đánh giá sẽ hiển thị sau khi được duyệt.',
            'data' => $review->load(['user:id,full_name,customer_code', 'court:id,name,court_code']),
        ], 201);
    }

    // tao thong bao cho admin/staff khi co danh gia moi can kiem duyet
    private function notifyAdminsAboutReview(Review $review): void
    {
        $receiverIds = User::whereIn('role', ['admin', 'staff'])
            ->where('status', 'active')
            ->pluck('id');

        if ($receiverIds->isEmpty()) {
            return;
        }

        $courtName = $review->court?->name ?? 'san';
        $customerName = $review->user?->full_name ?? 'Khach hang';
        $bookingCode = $review->booking?->booking_code ?? 'don dat san';
        $now = now();

        $groupKey = 'review_' . ($review->id ?? Str::uuid());
        $rows = $receiverIds->map(fn($receiverId) => [
            'id' => (string) Str::uuid(),
            'receiver_id' => $receiverId,
            'sender_id' => $review->user_id,
            'title' => 'Co danh gia san moi',
            'content' => "{$customerName} danh gia {$review->rating} sao cho {$courtName} tu {$bookingCode}.",
            'is_read' => false,
            'created_at' => $now,
            'group_key' => $groupKey,
        ])->all();

        Notification::insert($rows);
    }
}
