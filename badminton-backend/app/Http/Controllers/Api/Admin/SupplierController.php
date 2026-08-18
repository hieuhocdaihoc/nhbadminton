<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Supplier;
use Illuminate\Http\Request;

class SupplierController extends Controller
{
    // lay danh sach nha cung cap, ho tro tim kiem theo ten hoac so dien thoai
    public function index(Request $request)
    {
        $query = Supplier::withCount('purchaseOrders')
            ->withSum('purchaseOrders as total_import_amount', 'total_amount');

        if ($request->filled('keyword')) {
            $keyword = $request->query('keyword');
            $query->where('name', 'like', "%{$keyword}%")
                ->orWhere('phone', 'like', "%{$keyword}%");
        }

        $suppliers = $query->orderBy('name', 'asc')->get();

        $stats = [
            'total'               => $suppliers->count(),
            'total_orders'        => (int) $suppliers->sum('purchase_orders_count'),
            'total_import_amount' => (float) $suppliers->sum('total_import_amount'),
        ];

        return response()->json(['status' => 'success', 'data' => $suppliers, 'stats' => $stats]);
    }

    // tao moi thong tin nha cung cap
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

    // lay chi tiet nha cung cap
    public function show($id)
    {
        $supplier = Supplier::findOrFail($id);

        return response()->json(['status' => 'success', 'data' => $supplier]);
    }

    // cap nhat thong tin nha cung cap
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

    // xoa nha cung cap, tra loi neu con phieu nhap hang lien ket
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
