<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Supplier;
use Illuminate\Http\Request;

class SupplierController extends Controller
{
    /** Chức năng: Lấy danh sách nhà cung cấp, hỗ trợ tìm kiếm theo tên hoặc số điện thoại. */
    public function index(Request $request)
    {
        $query = Supplier::query();

        if ($request->filled('keyword')) {
            $keyword = $request->query('keyword');
            $query->where('name', 'like', "%{$keyword}%")
                ->orWhere('phone', 'like', "%{$keyword}%");
        }

        $suppliers = $query->orderBy('name', 'asc')->get();

        return response()->json(['status' => 'success', 'data' => $suppliers]);
    }

    /** Chức năng: Tạo mới thông tin nhà cung cấp. */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'           => ['required', 'string', 'max:150'],
            'phone'          => ['nullable', 'string', 'max:20'],
            'email'          => ['nullable', 'email', 'max:100'],
            'address'        => ['nullable', 'string'],
            'contact_person' => ['nullable', 'string', 'max:100'],
        ]);

        $supplier = Supplier::create($validated);

        return response()->json([
            'status'  => 'success',
            'message' => 'Thêm nhà cung cấp thành công!',
            'data'    => $supplier,
        ], 201);
    }

    /** Chức năng: Lấy chi tiết nhà cung cấp. */
    public function show($id)
    {
        $supplier = Supplier::findOrFail($id);

        return response()->json(['status' => 'success', 'data' => $supplier]);
    }

    /** Chức năng: Cập nhật thông tin nhà cung cấp. */
    public function update(Request $request, $id)
    {
        $supplier = Supplier::findOrFail($id);

        $validated = $request->validate([
            'name'           => ['sometimes', 'required', 'string', 'max:150'],
            'phone'          => ['nullable', 'string', 'max:20'],
            'email'          => ['nullable', 'email', 'max:100'],
            'address'        => ['nullable', 'string'],
            'contact_person' => ['nullable', 'string', 'max:100'],
        ]);

        $supplier->update($validated);

        return response()->json([
            'status'  => 'success',
            'message' => 'Cập nhật thông tin thành công!',
            'data'    => $supplier,
        ]);
    }

    /** Chức năng: Xóa nhà cung cấp, trả lỗi nếu còn phiếu nhập hàng liên kết. */
    public function destroy($id)
    {
        $supplier = Supplier::findOrFail($id);

        try {
            $supplier->delete();

            return response()->json(['status' => 'success', 'message' => 'Xóa nhà cung cấp thành công!']);
        } catch (\Exception $e) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Không thể xóa nhà cung cấp vì đang có phiếu nhập hàng liên kết với người này!',
            ], 400);
        }
    }
}
