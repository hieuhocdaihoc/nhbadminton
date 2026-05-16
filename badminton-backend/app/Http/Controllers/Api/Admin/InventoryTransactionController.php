<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\InventoryTransaction;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InventoryTransactionController extends Controller
{
    // =========================================================================
    // 1. XEM LỊCH SỬ BIẾN ĐỘNG KHO (Báo cáo Xuất - Nhập - Tồn)
    // =========================================================================
    public function index(Request $request)
    {
        // Kéo theo thông tin sản phẩm (id, tên, sku) để hiển thị lên bảng báo cáo
        $query = InventoryTransaction::with([
            'product' => function ($q) {
                $q->select('id', 'name', 'sku');
            }
        ]);

        // Lọc theo từng Sản phẩm cụ thể nếu Admin muốn xem riêng lịch sử của 1 món
        if ($request->has('product_id') && $request->product_id != '') {
            $query->where('product_id', $request->product_id);
        }

        // Lọc theo Loại biến động (import, export, sale, adjustment)
        if ($request->has('type') && $request->type != '') {
            $query->where('transaction_type', $request->type);
        }

        // Sắp xếp theo thời gian mới nhất lên đầu và phân trang 15 dòng/trang
        $history = $query->orderBy('created_at', 'desc')->paginate(15);

        return response()->json([
            'status' => 'success',
            'data' => $history
        ]);
    }

    // =========================================================================
    // 2. ĐIỀU CHỈNH KHO THỦ CÔNG (Kiểm kho: Báo hao hụt, mất mát, hỏng hóc)
    // =========================================================================
    public function store(Request $request)
    {
        // Phân loại kiểm kho thủ công chỉ được chọn: export (xuất hủy) hoặc adjustment (điều chỉnh cân bằng)
        $request->validate([
            'product_id' => 'required|exists:products,id',
            'transaction_type' => 'required|in:export,adjustment',
            'quantity' => 'required|integer', // Có thể truyền số dương (nếu thừa hàng) hoặc số âm (nếu hụt hàng)
            'note' => 'required|string|max:500' // Bắt buộc ghi rõ lý do điều chỉnh (VD: "Chuột cắn hỏng 2 lon")
        ]);

        $user = $request->user('sanctum');

        // Dùng DB::transaction để bảo vệ an toàn dữ liệu 2 bảng cùng lúc
        return DB::transaction(function () use ($request, $user) {

            // Khóa dòng sản phẩm lại để tránh xung đột dữ liệu lúc đang tính toán
            $product = Product::lockForUpdate()->findOrFail($request->product_id);

            $beforeQty = $product->stock_quantity;
            $changeQty = $request->quantity; // Ví dụ: -3 (hụt 3 cái) hoặc +2 (dư 2 cái)
            $afterQty = $beforeQty + $changeQty;

            // Kiểm tra an toàn: Không cho phép điều chỉnh khiến kho bị âm số lượng
            if ($afterQty < 0) {
                return response()->json([
                    'status' => 'error',
                    'message' => "Không thể trừ kho! Số lượng hao hụt ({$changeQty}) lớn hơn số lượng tồn kho hiện tại ({$beforeQty})."
                ], 400);
            }

            // 1. Cập nhật lại số lượng tồn kho mới vào bảng Products
            $product->update([
                'stock_quantity' => $afterQty
            ]);

            // 2. Ghi sổ nhật ký kho để lưu lại bằng chứng kiểm kho
            $transaction = InventoryTransaction::create([
                'product_id' => $product->id,
                'transaction_type' => $request->transaction_type,
                'quantity' => $changeQty,
                'before_quantity' => $beforeQty,
                'after_quantity' => $afterQty,
                'reference_type' => 'manual_adjustment', // Đánh dấu đây là thao tác thủ công của Admin
                'reference_id' => null, // Không có hóa đơn đi kèm vì đây là kiểm kho
                'note' => $request->note,
                'created_by' => $user ? $user->id : null
            ]);

            return response()->json([
                'status' => 'success',
                'message' => 'Điều chỉnh kho thành công!',
                'data' => $transaction
            ], 201);
        });
    }
}