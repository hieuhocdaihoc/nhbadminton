<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Review;
use Illuminate\Http\Request;

class ReviewController extends Controller
{
    /**
     * Chức năng: Lấy danh sách đánh giá để admin/staff lọc, duyệt, ẩn hoặc phản hồi.
     */
    public function index(Request $request)
    {
        $query = Review::with([
            'user:id,full_name,phone,customer_code',
            'court:id,name,court_code',
            'booking:id,booking_code,status,payment_status',
        ]);

        if ($request->filled('target_type')) {
            $query->where('target_type', $request->target_type);
        }

        if ($request->filled('rating')) {
            $query->where('rating', (int) $request->rating);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('reply_status')) {
            if ($request->reply_status === 'replied') {
                $query->whereNotNull('staff_reply')->where('staff_reply', '!=', '');
            }

            if ($request->reply_status === 'unreplied') {
                $query->where(function ($q) {
                    $q->whereNull('staff_reply')->orWhere('staff_reply', '');
                });
            }
        }

        if ($request->filled('keyword')) {
            $keyword = trim($request->keyword);
            $query->where(function ($q) use ($keyword) {
                $q->where('comment', 'like', "%{$keyword}%")
                    ->orWhere('staff_reply', 'like', "%{$keyword}%")
                    ->orWhereHas('user', function ($userQuery) use ($keyword) {
                        $userQuery->where('full_name', 'like', "%{$keyword}%")
                            ->orWhere('phone', 'like', "%{$keyword}%");
                    })
                    ->orWhereHas('booking', function ($bookingQuery) use ($keyword) {
                        $bookingQuery->where('booking_code', 'like', "%{$keyword}%");
                    });
            });
        }

        $reviews = $query->orderByDesc('id')->paginate(12);

        return response()->json([
            'status' => 'success',
            'data' => $reviews,
        ]);
    }

    /**
     * Chức năng: Lưu phản hồi của trung tâm cho một đánh giá khách hàng.
     */
    public function reply(Request $request, $id)
    {
        $validated = $request->validate([
            'staff_reply' => ['nullable', 'string', 'max:1000'],
        ]);

        $review = Review::findOrFail($id);
        $review->staff_reply = trim((string) ($validated['staff_reply'] ?? ''));
        $review->save();

        return response()->json([
            'status' => 'success',
            'message' => 'Da cap nhat phan hoi danh gia.',
            'data' => $review->load([
                'user:id,full_name,phone,customer_code',
                'court:id,name,court_code',
                'booking:id,booking_code,status,payment_status',
            ]),
        ]);
    }

    /**
     * Chức năng: Cập nhật trạng thái kiểm duyệt review: pending, approved hoặc hidden.
     */
    public function updateStatus(Request $request, $id)
    {
        $validated = $request->validate([
            'status' => ['required', 'in:pending,approved,hidden'],
        ]);

        $review = Review::findOrFail($id);
        $review->status = $validated['status'];
        $review->save();

        return response()->json([
            'status' => 'success',
            'message' => 'Đã cập nhật trạng thái đánh giá.',
            'data' => $review->load([
                'user:id,full_name,phone,customer_code',
                'court:id,name,court_code',
                'booking:id,booking_code,status,payment_status',
            ]),
        ]);
    }

    /**
     * Chức năng: Xóa đánh giá không phù hợp khỏi hệ thống.
     */
    public function destroy($id)
    {
        Review::findOrFail($id)->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Da xoa danh gia khong phu hop.',
        ]);
    }
}
