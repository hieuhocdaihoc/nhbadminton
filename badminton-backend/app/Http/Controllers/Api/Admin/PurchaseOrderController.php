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
    /** Chức năng: Lấy danh sách phiếu nhập kho kèm nhà cung cấp và người tạo. */
    public function index()
    {
        $orders = PurchaseOrder::with([
            'supplier:id,name',
            'creator:id,full_name,phone,role',
        ])->orderBy('created_at', 'desc')->paginate(15);

        return response()->json(['status' => 'success', 'data' => $orders]);
    }

    /** Chức năng: Lấy chi tiết phiếu nhập kho và các dòng sản phẩm nhập. */
    public function show($id)
    {
        $order = PurchaseOrder::with([
            'supplier',
            'details.product',
            'creator:id,full_name,phone,role',
        ])->findOrFail($id);

        return response()->json(['status' => 'success', 'data' => $order]);
    }

    /** Chức năng: Tạo phiếu nhập kho, tăng tồn sản phẩm và ghi lịch sử biến động kho. */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'supplier_id'            => ['required', 'exists:suppliers,id'],
            'items'                  => ['required', 'array', 'min:1'],
            'items.*.product_id'     => ['required', 'exists:products,id'],
            'items.*.quantity'       => ['required', 'integer', 'min:1'],
            'items.*.import_price'   => ['required', 'numeric', 'min:0'],
        ]);

        $user = $request->user('sanctum');

        return DB::transaction(function () use ($validated, $user) {
            $totalAmount  = 0;
            $purchaseCode = 'PO_' . strtoupper(Str::random(6));

            $po = PurchaseOrder::create([
                'supplier_id'   => $validated['supplier_id'],
                'purchase_code' => $purchaseCode,
                'total_amount'  => 0,
                'status'        => 'completed',
                'created_by'    => $user?->id,
            ]);

            foreach ($validated['items'] as $item) {
                $lineTotal    = $item['quantity'] * $item['import_price'];
                $totalAmount += $lineTotal;

                PurchaseOrderDetail::create([
                    'purchase_order_id' => $po->id,
                    'product_id'        => $item['product_id'],
                    'quantity'          => $item['quantity'],
                    'import_price'      => $item['import_price'],
                    'total_price'       => $lineTotal,
                ]);

                $product   = Product::where('id', $item['product_id'])->lockForUpdate()->firstOrFail();
                $beforeQty = $product->stock_quantity;
                $afterQty  = $beforeQty + $item['quantity'];

                $product->update(['stock_quantity' => $afterQty]);

                InventoryTransaction::create([
                    'product_id'       => $product->id,
                    'transaction_type' => 'import',
                    'quantity'         => $item['quantity'],
                    'before_quantity'  => $beforeQty,
                    'after_quantity'   => $afterQty,
                    'reference_type'   => 'purchase_order',
                    'reference_id'     => $po->id,
                    'note'             => "Nhập hàng từ phiếu {$purchaseCode}",
                    'created_by'       => $user?->id,
                ]);
            }

            $po->update(['total_amount' => $totalAmount]);

            return response()->json([
                'status'  => 'success',
                'message' => 'Nhập kho thành công!',
                'data'    => $po->load(['details', 'creator:id,full_name,phone,role']),
            ], 201);
        });
    }
}
