<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    // =========================================================================
    // 1. XEM DANH SÁCH (Lấy danh sách sản phẩm, có kèm tên Danh mục)
    // =========================================================================
    /**
     * Chức năng: Lấy danh sách sản phẩm/hàng hóa, có hỗ trợ lọc danh mục, trạng thái và tồn kho thấp.
     */
    public function index(Request $request)
    {
        // Dùng with('category') để tự động nối bảng lấy tên danh mục, tránh lỗi N+1 Query làm chậm server
        $query = Product::with([
            'category' => function ($q) {
                $q->select('id', 'name'); // Chỉ lấy đúng cột id và name của danh mục cho nhẹ dữ liệu
            }
        ]);

        // Lọc theo Tên sản phẩm hoặc Mã kho (SKU) nếu trên URL có truyền ?keyword=...
        if ($request->has('keyword') && $request->keyword != '') {
            $keyword = $request->keyword;
            $query->where('name', 'like', "%{$keyword}%")
                ->orWhere('sku', 'like', "%{$keyword}%");
        }

        // Lọc theo Danh mục nếu Admin chọn phân loại (Ví dụ: Chỉ xem các loại "Nước giải khát")
        if ($request->has('category_id') && $request->category_id != '') {
            $query->where('category_id', $request->category_id);
        }

        // Sắp xếp các sản phẩm mới tạo lên đầu tiên và phân trang (15 món / trang)
        $products = $query->orderBy('created_at', 'desc')->paginate(15);

        return response()->json(['status' => 'success', 'data' => $products]);
    }

    // =========================================================================
    // 2. THÊM MỚI SẢN PHẨM (Mặc định số lượng kho ban đầu luôn = 0)
    // =========================================================================
    /**
     * Chức năng: Tạo mới sản phẩm với thông tin SKU, mô tả và tồn kho ban đầu.
     */
    public function store(Request $request)
    {
        // Kiểm tra dữ liệu đầu vào khắt khe khi tạo mới sản phẩm
        $request->validate([
            'category_id' => 'required|exists:categories,id', // Danh mục phải tồn tại thật trong DB
            'name' => 'required|string|max:200',
            'sku' => 'required|string|max:100|unique:products,sku', // Mã kho cấm trùng trùng nhau
            'low_stock_threshold' => 'nullable|integer|min:0',
            'selling_price' => 'required|numeric|min:0' // Giá bán lẻ bắt buộc nhập và không được âm
        ]);

        // Tiến hành tạo sản phẩm
        $product = Product::create([
            'category_id' => $request->category_id,
            'name' => $request->name,
            'sku' => $request->sku,
            'brand' => $request->brand,
            'description' => $request->description,
            'short_description' => $request->short_description,
            'material' => $request->material,
            'origin' => $request->origin,
            'selling_price' => $request->selling_price,
            'stock_quantity' => 0, // Bắt buộc = 0, muốn có hàng phải làm phiếu nhập ở chặng 3
            'sold_count' => 0, // Mới tạo chưa bán được chai nào
            'low_stock_threshold' => $request->low_stock_threshold ?? 5, // Dưới ngưỡng này hệ thống sẽ báo động sắp hết hàng
            'status' => 'active' // Mặc định tạo xong cho mở bán luôn
        ]);

        return response()->json(['status' => 'success', 'message' => 'Tạo sản phẩm thành công!', 'data' => $product], 201);
    }

    // =========================================================================
    // 3. XEM CHI TIẾT SẢN PHẨM (Dùng để lấy data fill lên form sửa ở Frontend)
    // =========================================================================
    /**
     * Chức năng: Lấy chi tiết một sản phẩm kèm danh mục liên quan.
     */
    public function show($id)
    {
        // Tìm sản phẩm kèm theo thông tin danh mục của nó
        $product = Product::with('category')->find($id);

        if (!$product)
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy sản phẩm!'], 404);

        return response()->json(['status' => 'success', 'data' => $product]);
    }

    // =========================================================================
    // 4. CẬP NHẬT THÔNG TIN SẢN PHẨM (Đổi tên, giá bán, hoặc MỞ HOẠT ĐỘNG TRỞ LẠI)
    // =========================================================================
    /**
     * Chức năng: Cập nhật thông tin sản phẩm và cấu hình cảnh báo tồn kho.
     */
    public function update(Request $request, $id)
    {
        $product = Product::find($id);
        if (!$product)
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy sản phẩm!'], 404);

        // BỘ VALIDATE ĐÃ ĐƯỢC NÂNG CẤP: Thêm kiểm tra trạng thái 'status'
        $request->validate([
            'category_id' => 'sometimes|required|exists:categories,id',
            'name' => 'sometimes|required|string|max:200',
            'sku' => 'sometimes|required|string|max:100|unique:products,sku,' . $id, // Bỏ qua check trùng với chính nó
            'selling_price' => 'sometimes|required|numeric|min:0',
            'status' => 'sometimes|required|in:active,inactive', // ĐÃ THÊM: Chấp nhận truyền active hoặc inactive lên để bật/tắt
        ]);

        // TUYỆT ĐỐI BẢO MẬT KHO: Loại bỏ trường số lượng tồn kho và số lượng đã bán.
        // Không một ai được phép dùng hàm update thông thường này để "hack" số lượng sản phẩm.
        $dataToUpdate = $request->except(['stock_quantity', 'sold_count']);

        // Cập nhật các trường còn lại vào DB (Bao gồm cả Tên, Giá, và Trạng thái active/inactive)
        $product->update($dataToUpdate);

        return response()->json(['status' => 'success', 'message' => 'Cập nhật thông tin thành công!', 'data' => $product]);
    }

    // =========================================================================
    // 5. TẠM NGƯNG KINH DOANH (XÓA MỀM)
    // =========================================================================
    /**
     * Chức năng: Tạm ngưng kinh doanh sản phẩm bằng cách đổi trạng thái.
     */
    public function destroy($id)
    {
        $product = Product::find($id);
        if (!$product)
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy sản phẩm!'], 404);

        // Nếu sản phẩm đã bị ngưng từ trước thì chặn thao tác thừa
        if ($product->status === 'inactive') {
            return response()->json(['status' => 'error', 'message' => 'Sản phẩm này đã được tạm ngưng từ trước!'], 400);
        }

        // Chuyển sang trạng thái inactive để ẩn đi, bảo toàn lịch sử hóa đơn cũ
        $product->status = 'inactive';
        $product->save();

        return response()->json(['status' => 'success', 'message' => 'Đã tạm ngưng bán sản phẩm này!']);
    }
}