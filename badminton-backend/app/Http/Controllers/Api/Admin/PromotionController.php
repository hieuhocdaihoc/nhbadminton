<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Promotion;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PromotionController extends Controller
{
    private const CODE_PATTERN = '/^[A-Z0-9_\-]+$/i';
    private const DISCOUNT_TYPES = ['fixed', 'percent'];
    private const STATUSES = ['active', 'inactive'];

    /** Chức năng: Lấy danh sách voucher/mã giảm giá, có hỗ trợ lọc trạng thái và tìm kiếm. */
    public function index(Request $request)
    {
        $query = Promotion::query();

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('keyword')) {
            $keyword = $request->keyword;
            $query->where(fn($q) => $q->where('code', 'like', "%{$keyword}%")
                ->orWhere('name', 'like', "%{$keyword}%"));
        }

        return response()->json([
            'status' => 'success',
            'data'   => $query->orderBy('code')->get(),
        ]);
    }

    /** Chức năng: Tạo mới voucher với loại giảm giá, giá trị giảm và điều kiện điểm nếu có. */
    public function store(Request $request)
    {
        $data = $this->validatedData($request);
        $data['code']               = strtoupper(trim($data['code']));
        $data['status']             = $data['status'] ?? 'active';
        $data['per_user_limit']     = $data['per_user_limit'] ?? 1;
        $data['min_points_required'] = $data['min_points_required'] ?? 0;

        $promotion = Promotion::create($data);

        return response()->json([
            'status'  => 'success',
            'message' => 'Tao ma giam gia thanh cong!',
            'data'    => $promotion,
        ], 201);
    }

    /** Chức năng: Lấy chi tiết một voucher. */
    public function show($id)
    {
        return response()->json([
            'status' => 'success',
            'data'   => Promotion::findOrFail($id),
        ]);
    }

    /** Chức năng: Cập nhật thông tin voucher và điều kiện áp dụng. */
    public function update(Request $request, $id)
    {
        $promotion = Promotion::findOrFail($id);

        $data = $this->validatedData($request, $id);

        if (isset($data['code'])) {
            $data['code'] = strtoupper(trim($data['code']));
        }

        $promotion->update($data);

        return response()->json([
            'status'  => 'success',
            'message' => 'Cap nhat ma giam gia thanh cong!',
            'data'    => $promotion,
        ]);
    }

    /** Chức năng: Ẩn hoặc ngưng áp dụng voucher bằng trạng thái inactive. */
    public function destroy($id)
    {
        $promotion = Promotion::findOrFail($id);
        $promotion->status = 'inactive';
        $promotion->save();

        return response()->json([
            'status'  => 'success',
            'message' => 'Da tam an ma giam gia.',
        ]);
    }

    /** Chức năng: Validate và chuẩn hóa dữ liệu voucher dùng chung cho tạo mới và cập nhật. */
    private function validatedData(Request $request, ?string $ignoreId = null): array
    {
        return $request->validate([
            'code' => [
                $ignoreId ? 'sometimes' : 'required',
                'string',
                'max:50',
                'regex:' . self::CODE_PATTERN,
                Rule::unique('promotions', 'code')->ignore($ignoreId),
            ],
            'name'               => ['required', 'string', 'max:150'],
            'discount_type'      => ['required', 'in:fixed,percent'],
            'discount_value'     => [
                'required', 'numeric', 'min:1',
                function ($attribute, $value, $fail) use ($request) {
                    if ($request->discount_type === 'percent' && $value > 100) {
                        $fail('Giảm giá theo phần trăm không được vượt quá 100%.');
                    }
                },
            ],
            // 0 = không giới hạn lượt (voucher trong ngày tự động áp cho mọi đơn)
            'per_user_limit'      => ['nullable', 'integer', 'min:0'],
            'min_points_required' => ['nullable', 'integer', 'min:0'],
            'valid_from'          => ['nullable', 'date'],
            'valid_to'            => ['nullable', 'date', 'after_or_equal:valid_from'],
            'auto_apply'          => ['nullable', 'boolean'],
            'description'         => ['nullable', 'string', 'max:255'],
            'status'              => ['nullable', 'in:active,inactive'],
        ], [
            'code.regex'         => 'Mã voucher chỉ được chứa chữ cái không dấu, số, dấu gạch dưới (_) và gạch ngang (-).',
            'discount_value.min' => 'Giá trị giảm phải lớn hơn 0.',
        ]);
    }
}
