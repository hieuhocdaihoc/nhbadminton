<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Promotion;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PromotionController extends Controller
{
    // Lay danh sach voucher de admin theo doi va loc theo trang thai.
    public function index(Request $request)
    {
        $query = Promotion::query();

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('keyword')) {
            $keyword = $request->keyword;
            $query->where(function ($q) use ($keyword) {
                $q->where('code', 'like', "%{$keyword}%")
                    ->orWhere('name', 'like', "%{$keyword}%");
            });
        }

        return response()->json([
            'status' => 'success',
            'data' => $query->orderBy('code')->get(),
        ]);
    }

    // Tao voucher moi cho khach nhap khi dat san.
    public function store(Request $request)
    {
        $data = $this->validatedData($request);
        $data['code'] = strtoupper(trim($data['code']));
        $data['status'] = $data['status'] ?? 'active';
        $data['per_user_limit'] = $data['per_user_limit'] ?? 1;
        $data['min_points_required'] = $data['min_points_required'] ?? 0;

        $promotion = Promotion::create($data);

        return response()->json([
            'status' => 'success',
            'message' => 'Tao ma giam gia thanh cong!',
            'data' => $promotion,
        ], 201);
    }

    // Xem chi tiet mot voucher.
    public function show($id)
    {
        $promotion = Promotion::find($id);

        if (!$promotion) {
            return response()->json([
                'status' => 'error',
                'message' => 'Khong tim thay ma giam gia.',
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'data' => $promotion,
        ]);
    }

    // Cap nhat thong tin voucher, cho phep giu nguyen code hien tai.
    public function update(Request $request, $id)
    {
        $promotion = Promotion::find($id);

        if (!$promotion) {
            return response()->json([
                'status' => 'error',
                'message' => 'Khong tim thay ma giam gia.',
            ], 404);
        }

        $data = $this->validatedData($request, $id);

        if (isset($data['code'])) {
            $data['code'] = strtoupper(trim($data['code']));
        }

        $promotion->update($data);

        return response()->json([
            'status' => 'success',
            'message' => 'Cap nhat ma giam gia thanh cong!',
            'data' => $promotion,
        ]);
    }

    // An voucher thay vi xoa cung de giu lich su booking da ap dung ma.
    public function destroy($id)
    {
        $promotion = Promotion::find($id);

        if (!$promotion) {
            return response()->json([
                'status' => 'error',
                'message' => 'Khong tim thay ma giam gia.',
            ], 404);
        }

        $promotion->status = 'inactive';
        $promotion->save();

        return response()->json([
            'status' => 'success',
            'message' => 'Da tam an ma giam gia.',
        ]);
    }

    private function validatedData(Request $request, ?string $ignoreId = null): array
    {
        return $request->validate([
            'code' => [
                $ignoreId ? 'sometimes' : 'required',
                'string',
                'max:50',
                Rule::unique('promotions', 'code')->ignore($ignoreId),
            ],
            'name' => 'required|string|max:150',
            'discount_type' => 'required|in:fixed,percent',
            'discount_value' => 'required|numeric|min:0',
            'per_user_limit' => 'nullable|integer|min:1',
            'min_points_required' => 'nullable|integer|min:0',
            'status' => 'nullable|in:active,inactive',
        ]);
    }
}
