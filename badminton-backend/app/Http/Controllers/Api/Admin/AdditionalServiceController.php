<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdditionalService;
use Illuminate\Http\Request;

class AdditionalServiceController extends Controller
{
    // =========================================================================
    // 1. LẤY DANH SÁCH DỊCH VỤ (Có hỗ trợ lọc theo loại và trạng thái)
    // =========================================================================
    public function index(Request $request)
    {
        $query = AdditionalService::query();

        // Admin có thể lọc theo loại (ví dụ: ?type=drink)
        if ($request->has('type') && $request->type != '') {
            $query->where('service_type', $request->type);
        }

        // Lọc theo trạng thái (ví dụ: ?status=active)
        if ($request->has('status') && $request->status != '') {
            $query->where('status', $request->status);
        }

        // Sắp xếp mới nhất lên đầu
        $services = $query->orderBy('name', 'asc')->get();

        return response()->json([
            'status' => 'success',
            'data' => $services
        ]);
    }
    //  THÊM MỚI DỊCH VỤ
    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:100',
            'service_type' => 'required|in:racket,shoe_care,drink,rental,coaching,shuttlecock,other',
            'description' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'unit' => 'nullable|string|max:50',
            'status' => 'nullable|in:active,inactive'
        ]);

        $service = AdditionalService::create([
            'name' => $request->name,
            'service_type' => $request->service_type,
            'description' => $request->description,
            'price' => $request->price,
            'unit' => $request->unit,
            'status' => $request->status ?? 'active',
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Thêm dịch vụ thành công!',
            'data' => $service
        ], 201);
    }

    // =========================================================================
    // 3. XEM CHI TIẾT 1 DỊCH VỤ (Để fill dữ liệu lên Form sửa)
    // =========================================================================
    public function show($id)
    {
        $service = AdditionalService::find($id);

        if (!$service) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy dịch vụ!'], 404);
        }

        return response()->json([
            'status' => 'success',
            'data' => $service
        ]);
    }

    // =========================================================================
    // 4. CẬP NHẬT DỊCH VỤ
    // =========================================================================
    public function update(Request $request, $id)
    {
        $service = AdditionalService::find($id);

        if (!$service) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy dịch vụ!'], 404);
        }

        $request->validate([
            'name' => 'sometimes|required|string|max:100',
            'service_type' => 'sometimes|required|in:racket,shoe_care,drink,rental,coaching,shuttlecock,other',
            'description' => 'nullable|string',
            'price' => 'sometimes|required|numeric|min:0',
            'unit' => 'nullable|string|max:50',
            'status' => 'sometimes|required|in:active,inactive'
        ]);

        $service->update($request->all());

        return response()->json([
            'status' => 'success',
            'message' => 'Cập nhật dịch vụ thành công!',
            'data' => $service
        ]);
    }

    // =========================================================================
    // 5. XÓA DỊCH VỤ (XÓA MỀM / TẠM NGƯNG KINH DOANH)
    // =========================================================================
    public function destroy($id)
    {
        $service = AdditionalService::find($id);

        if (!$service) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy dịch vụ!'
            ], 404);
        }

        if ($service->status === 'inactive') {
            return response()->json([
                'status' => 'error',
                'message' => 'Dịch vụ này đã được tạm ngưng từ trước!'
            ], 400);
        }


        $service->status = 'inactive';
        $service->save();

        return response()->json([
            'status' => 'success',
            'message' => 'Đã tạm ngưng dịch vụ! (Dữ liệu hóa đơn cũ vẫn được bảo toàn)'
        ]);
    }
}