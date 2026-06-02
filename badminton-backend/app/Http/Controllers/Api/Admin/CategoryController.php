<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    // =========================================================================
    // 1. LẤY DANH SÁCH DANH MỤC (Có lọc theo trạng thái)
    // =========================================================================
    /**
     * Chức năng: Lấy danh sách danh mục sản phẩm/dịch vụ, có hỗ trợ lọc trạng thái.
     */
    public function index(Request $request)
    {
        $query = Category::query();

        // Admin có thể lọc: chỉ xem danh mục đang bán (?status=active) hoặc đã ẩn (?status=inactive)
        if ($request->has('status') && $request->status != '') {
            $query->where('status', $request->status);
        }

        // Sắp xếp danh mục theo thứ tự bảng chữ cái từ A-Z để dễ nhìn trên giao diện
        $categories = $query->orderBy('name', 'asc')->get();

        return response()->json(['status' => 'success', 'data' => $categories]);
    }

    // =========================================================================
    // 2. THÊM MỚI DANH MỤC SẢN PHẨM
    // =========================================================================
    /**
     * Chức năng: Tạo mới danh mục để nhóm sản phẩm hoặc hàng hóa.
     */
    public function store(Request $request)
    {
        // Kiểm tra dữ liệu: 'unique:categories,name' đảm bảo không có 2 danh mục trùng tên nhau
        $request->validate([
            'name' => 'required|string|max:100|unique:categories,name',
            'description' => 'nullable|string',
            'status' => 'nullable|in:active,inactive'
        ]);

        // Tạo danh mục mới, nếu Admin không truyền status thì mặc định lấy 'active'
        $category = Category::create([
            'name' => $request->name,
            'description' => $request->description,
            'status' => $request->status ?? 'active',
        ]);

        return response()->json(['status' => 'success', 'message' => 'Thêm danh mục thành công!', 'data' => $category], 201);
    }

    // =========================================================================
    // 3. XEM CHI TIẾT MỘT DANH MỤC
    // =========================================================================
    /**
     * Chức năng: Lấy chi tiết một danh mục.
     */
    public function show($id)
    {
        $category = Category::find($id);
        if (!$category)
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy danh mục!'], 404);

        return response()->json(['status' => 'success', 'data' => $category]);
    }

    // =========================================================================
    // 4. CẬP NHẬT DANH MỤC (CHỐNG TRÙNG TÊN CHÍNH NÓ)
    // =========================================================================
    /**
     * Chức năng: Cập nhật tên, mô tả hoặc trạng thái danh mục.
     */
    public function update(Request $request, $id)
    {
        $category = Category::find($id);
        if (!$category)
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy danh mục!'], 404);

        // Đoạn ',name,'.$id cực kỳ quan trọng, nó báo cho Laravel biết là: 
        // "Nếu Admin giữ nguyên tên cũ khi bấm lưu thì không được báo lỗi trùng tên với chính nó".
        $request->validate([
            'name' => 'sometimes|required|string|max:100|unique:categories,name,' . $id,
            'description' => 'nullable|string',
            'status' => 'sometimes|required|in:active,inactive'
        ]);

        // Cập nhật thông tin danh mục
        $category->update($request->all());

        return response()->json(['status' => 'success', 'message' => 'Cập nhật danh mục thành công!', 'data' => $category]);
    }

    // =========================================================================
    // 5. XÓA MỀM DANH MỤC (ẨN KHỎI MENU BÁN HÀNG)
    // =========================================================================
    /**
     * Chức năng: Tạm ngưng danh mục bằng trạng thái inactive để giữ dữ liệu cũ.
     */
    public function destroy($id)
    {
        $category = Category::find($id);
        if (!$category)
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy danh mục!'], 404);

        // Nghiệp vụ cao cấp: Tuyệt đối không xóa cứng danh mục khỏi DB.
        // Vì nếu xóa, các sản phẩm đang gắn với danh mục này (ví dụ lon Bò Húc thuộc danh mục "Nước giải khát") 
        // sẽ bị mồ côi 'category_id', gây sập hệ thống (lỗi crash giao diện).
        // Giải pháp: Chuyển trạng thái sang 'inactive' để ẩn đi trên menu bán hàng.
        $category->status = 'inactive';
        $category->save();

        return response()->json(['status' => 'success', 'message' => 'Đã tạm ẩn danh mục này!']);
    }
}