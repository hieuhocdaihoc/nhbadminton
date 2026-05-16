<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Supplier;
use Illuminate\Http\Request;

class SupplierController extends Controller
{
    // =========================================================================
    // 1. LẤY DANH SÁCH & TÌM KIẾM NHÀ CUNG CẤP
    // =========================================================================
    public function index(Request $request)
    {
        // Lấy từ khóa tìm kiếm từ url (?keyword=...)
        $keyword = $request->query('keyword');
        $query = Supplier::query();

        // Nếu Admin có nhập từ khóa, hệ thống sẽ tìm kiếm song song theo cả Tên HOẶC Số điện thoại
        if ($keyword) {
            $query->where('name', 'like', "%{$keyword}%")
                ->orWhere('phone', 'like', "%{$keyword}%");
        }

        // Sắp xếp danh sách nhà cung cấp theo bảng chữ cái từ A-Z
        $suppliers = $query->orderBy('name', 'asc')->get();

        return response()->json(['status' => 'success', 'data' => $suppliers]);
    }

    // =========================================================================
    // 2. THÊM MỚI NHÀ CUNG CẤP
    // =========================================================================
    public function store(Request $request)
    {
        // Kiểm tra dữ liệu đầu vào: Tên là bắt buộc, các thông tin khác có thể trống
        $request->validate([
            'name' => 'required|string|max:150',
            'phone' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:100',
            'address' => 'nullable|string',
            'contact_person' => 'nullable|string|max:100'
        ]);

        // Lưu nhà cung cấp mới vào cơ sở dữ liệu
        $supplier = Supplier::create($request->all());

        return response()->json(['status' => 'success', 'message' => 'Thêm nhà cung cấp thành công!', 'data' => $supplier], 201);
    }

    // =========================================================================
    // 3. XEM CHI TIẾT MỘT NHÀ CUNG CẤP
    // =========================================================================
    public function show($id)
    {
        // Tìm nhà cung cấp theo mã ID (UUID)
        $supplier = Supplier::find($id);

        // Nếu không tồn tại trong DB, trả về lỗi 404
        if (!$supplier)
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy nhà cung cấp!'], 404);

        return response()->json(['status' => 'success', 'data' => $supplier]);
    }

    // =========================================================================
    // 4. CẬP NHẬT THÔNG TIN NHÀ CUNG CẤP
    // =========================================================================
    public function update(Request $request, $id)
    {
        // Kiểm tra xem nhà cung cấp có tồn tại trước khi sửa không
        $supplier = Supplier::find($id);
        if (!$supplier)
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy nhà cung cấp!'], 404);

        // Kiểm tra dữ liệu: dùng 'sometimes' để chỉ validate những trường được gửi lên
        $request->validate([
            'name' => 'sometimes|required|string|max:150',
            'phone' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:100',
            'address' => 'nullable|string',
            'contact_person' => 'nullable|string|max:100'
        ]);

        // Tiến hành cập nhật các thay đổi
        $supplier->update($request->all());

        return response()->json(['status' => 'success', 'message' => 'Cập nhật thông tin thành công!', 'data' => $supplier]);
    }

    // =========================================================================
    // 5. XÓA CỨNG NHÀ CUNG CẤP (CÓ CHẶN LỖI FOREIGN KEY)
    // =========================================================================
    public function destroy($id)
    {
        $supplier = Supplier::find($id);
        if (!$supplier)
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy nhà cung cấp!'], 404);

        // Sử dụng try-catch để đánh chặn lỗi ràng buộc dữ liệu (Khóa ngoại)
        try {
            // Thực hiện xóa khỏi Database
            $supplier->delete();
            return response()->json(['status' => 'success', 'message' => 'Xóa nhà cung cấp thành công!']);
        } catch (\Exception $e) {
            // Nếu ông nhà cung cấp này đã có lịch sử trong bảng phiếu nhập (Purchase Orders), 
            // Database sẽ kích hoạt khóa ngoại và quăng lỗi vào đây để bảo vệ toàn vẹn dữ liệu kế toán.
            return response()->json(['status' => 'error', 'message' => 'Không thể xóa nhà cung cấp vì đang có phiếu nhập hàng liên kết với người này!'], 400);
        }
    }
}