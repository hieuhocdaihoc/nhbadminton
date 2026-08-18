<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    private const STATUS_VALUES = ['active', 'inactive'];
    private const DEFAULT_STATUS = 'active';

    // lay danh sach danh muc, ho tro loc theo trang thai
    public function index(Request $request)
    {
        $query = Category::query();

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $categories = $query->orderBy('name', 'asc')->get();

        return response()->json(['status' => 'success', 'data' => $categories]);
    }

    // tao moi danh muc san pham
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'        => ['required', 'string', 'max:100', 'unique:categories,name'],
            'description' => ['nullable', 'string'],
            'status'      => ['nullable', 'in:' . implode(',', self::STATUS_VALUES)],
        ]);

        $validated['status'] = $validated['status'] ?? self::DEFAULT_STATUS;

        $category = Category::create($validated);

        return response()->json([
            'status'  => 'success',
            'message' => 'Thêm danh mục thành công!',
            'data'    => $category,
        ], 201);
    }

    // lay chi tiet mot danh muc
    public function show($id)
    {
        $category = Category::findOrFail($id);

        return response()->json(['status' => 'success', 'data' => $category]);
    }

    // cap nhat ten, mo ta hoac trang thai danh muc
    public function update(Request $request, $id)
    {
        $category = Category::findOrFail($id);

        $validated = $request->validate([
            'name'        => ['sometimes', 'required', 'string', 'max:100', 'unique:categories,name,' . $id],
            'description' => ['nullable', 'string'],
            'status'      => ['sometimes', 'required', 'in:' . implode(',', self::STATUS_VALUES)],
        ]);

        $category->update($validated);

        return response()->json([
            'status'  => 'success',
            'message' => 'Cập nhật danh mục thành công!',
            'data'    => $category,
        ]);
    }

    // tam ngung danh muc bang cach chuyen trang thai sang inactive
    public function destroy($id)
    {
        $category = Category::findOrFail($id);

        $category->update(['status' => 'inactive']);

        return response()->json(['status' => 'success', 'message' => 'Đã tạm ẩn danh mục này!']);
    }
}
