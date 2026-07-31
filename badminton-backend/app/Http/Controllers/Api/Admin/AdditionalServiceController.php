<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdditionalService;
use Illuminate\Http\Request;

class AdditionalServiceController extends Controller
{
    // Danh sach loai dich vu hop le
    private const SERVICE_TYPES = ['racket', 'shoe_care', 'other'];

    /**
     * Chức năng: Lấy danh sách dịch vụ bổ sung, hỗ trợ lọc theo loại và trạng thái.
     */
    public function index(Request $request)
    {
        $query = AdditionalService::where('service_type', '!=', 'rental');

        if ($request->filled('type')) {
            $query->where('service_type', $request->type);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        return response()->json([
            'status' => 'success',
            'data' => $query->orderBy('name')->get(),
        ]);
    }

    /**
     * Chức năng: Thêm mới một dịch vụ bổ sung (nước, huấn luyện, cầu...).
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'service_type' => ['required', 'in:' . implode(',', self::SERVICE_TYPES)],
            'description' => ['nullable', 'string'],
            'price' => ['required', 'numeric', 'min:0'],
            'unit' => ['nullable', 'string', 'max:50'],
            'status' => ['nullable', 'in:active,inactive'],
        ]);

        $service = AdditionalService::create([
            ...$validated,
            'status' => $validated['status'] ?? 'active',
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Thêm dịch vụ thành công!',
            'data' => $service,
        ], 201);
    }

    /**
     * Chức năng: Lấy chi tiết một dịch vụ để hiển thị lên form chỉnh sửa.
     */
    public function show($id)
    {
        $service = AdditionalService::findOrFail($id);

        return response()->json([
            'status' => 'success',
            'data' => $service,
        ]);
    }

    /**
     * Chức năng: Cập nhật thông tin dịch vụ (có thể gửi một phần trường, không cần gửi hết).
     */
    public function update(Request $request, $id)
    {
        $service = AdditionalService::findOrFail($id);

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:100'],
            'service_type' => ['sometimes', 'required', 'in:' . implode(',', self::SERVICE_TYPES)],
            'description' => ['nullable', 'string'],
            'price' => ['sometimes', 'required', 'numeric', 'min:0'],
            'unit' => ['nullable', 'string', 'max:50'],
            'status' => ['sometimes', 'required', 'in:active,inactive'],
        ]);

        $service->update($validated);

        return response()->json([
            'status' => 'success',
            'message' => 'Cập nhật dịch vụ thành công!',
            'data' => $service,
        ]);
    }

    /**
     * Chức năng: Tạm ngưng dịch vụ (xóa mềm) thay vì xóa hẳn để bảo toàn lịch sử hóa đơn cũ.
     */
    public function destroy($id)
    {
        $service = AdditionalService::findOrFail($id);

        if ($service->status === 'inactive') {
            return response()->json([
                'status' => 'error',
                'message' => 'Dịch vụ này đã được tạm ngưng từ trước!',
            ], 400);
        }

        $service->update(['status' => 'inactive']);

        return response()->json([
            'status' => 'success',
            'message' => 'Đã tạm ngưng dịch vụ! (Dữ liệu hóa đơn cũ vẫn được bảo toàn)',
        ]);
    }
}
