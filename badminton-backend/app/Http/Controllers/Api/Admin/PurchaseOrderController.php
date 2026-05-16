<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderDetail;
use App\Models\InventoryTransaction;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PurchaseOrderController extends Controller
{
    // =========================================================================
    // 1. XEM LỊCH SỬ NHẬP KHO
    // =========================================================================
    public function index()
    {
        // Lấy danh sách phiếu nhập kèm tên Nhà cung cấp
        $orders = PurchaseOrder::with('supplier:id,name')->orderBy('created_at', 'desc')->paginate(15);
        return response()->json(['status' => 'success', 'data' => $orders]);
    }

    // =========================================================================
    // 2. XEM CHI TIẾT 1 PHIẾU NHẬP
    // =========================================================================
    public function show($id)
    {
        $order = PurchaseOrder::with(['supplier', 'details.product'])->find($id);
        if (!$order)
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy phiếu nhập!'], 404);
        return response()->json(['status' => 'success', 'data' => $order]);
    }

    // =========================================================================
    // 3. THỰC HIỆN NHẬP KHO (TRANSACTION ĐA BẢNG)
    // =========================================================================
    public function store(Request $request)
    {
        $request->validate([
            'supplier_id' => 'required|exists:suppliers,id',
            'items' => 'required|array|min:1', // Mảng các món hàng nhập
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.import_price' => 'required|numeric|min:0',
        ]);

        $user = $request->user('sanctum');

        // Bắt đầu Transaction: Đảm bảo thao tác đa bảng không bị đứt gãy
        return DB::transaction(function () use ($request, $user) {
            $totalAmount = 0;
            $purchaseCode = 'PO_' . strtoupper(Str::random(6));

            // 1. Tạo Phiếu Nhập gốc
            $po = PurchaseOrder::create([
                'supplier_id' => $request->supplier_id,
                'purchase_code' => $purchaseCode,
                'total_amount' => 0, // Tạm để 0, lát cộng dồn xong sẽ update
                'status' => 'completed',
                'created_by' => $user ? $user->id : null,
            ]);

            // 2. Duyệt qua từng sản phẩm được nhập
            foreach ($request->items as $item) {
                $lineTotal = $item['quantity'] * $item['import_price'];
                $totalAmount += $lineTotal;

                // Lưu chi tiết phiếu nhập
                PurchaseOrderDetail::create([
                    'purchase_order_id' => $po->id,
                    'product_id' => $item['product_id'],
                    'quantity' => $item['quantity'],
                    'import_price' => $item['import_price'],
                    'total_price' => $lineTotal,
                ]);

                // 3. XỬ LÝ KHO (Core Logic)
                // Lấy sản phẩm và khóa dòng lại (lockForUpdate) tránh ai đó mua đúng lúc đang nhập
                $product = Product::where('id', $item['product_id'])->lockForUpdate()->first();

                $beforeQty = $product->stock_quantity;
                $afterQty = $beforeQty + $item['quantity'];

                // Cộng số lượng vào bảng Products
                $product->update(['stock_quantity' => $afterQty]);

                // 4. Ghi Sổ Nhật Ký Kho (Audit Log)
                InventoryTransaction::create([
                    'product_id' => $product->id,
                    'transaction_type' => 'import',
                    'quantity' => $item['quantity'], // Số dương vì nhập kho
                    'before_quantity' => $beforeQty,
                    'after_quantity' => $afterQty,
                    'reference_type' => 'purchase_order',
                    'reference_id' => $po->id,
                    'note' => "Nhập hàng từ phiếu {$purchaseCode}",
                    'created_by' => $user ? $user->id : null,
                ]);
            }

            // Cập nhật lại tổng tiền cho Phiếu nhập
            $po->update(['total_amount' => $totalAmount]);

            return response()->json([
                'status' => 'success',
                'message' => 'Nhập kho thành công!',
                'data' => $po->load('details')
            ], 201);
        });
    }
}