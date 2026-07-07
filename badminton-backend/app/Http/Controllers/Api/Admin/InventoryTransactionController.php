<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\InventoryTransaction;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InventoryTransactionController extends Controller
{
    private const MANUAL_TYPES = ['export', 'adjustment'];

    /** Chức năng: Lấy lịch sử biến động kho, có hỗ trợ lọc theo sản phẩm và loại giao dịch. */
    public function index(Request $request)
    {
        $query = InventoryTransaction::with([
            'product' => fn($q) => $q->select('id', 'name', 'sku'),
            'creator:id,full_name,phone,role',
        ]);

        if ($request->filled('product_id')) {
            $query->where('product_id', $request->product_id);
        }

        if ($request->filled('type')) {
            $query->where('transaction_type', $request->type);
        }

        $history = $query->orderBy('created_at', 'desc')->paginate(15);

        return response()->json(['status' => 'success', 'data' => $history]);
    }

    /** Chức năng: Tạo phiếu điều chỉnh kho thủ công và cập nhật tồn kho sản phẩm. */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'product_id'       => ['required', 'exists:products,id'],
            'transaction_type' => ['required', 'in:' . implode(',', self::MANUAL_TYPES)],
            'quantity'         => ['required', 'integer'],
            'note'             => ['required', 'string', 'max:500'],
        ]);

        $user = $request->user('sanctum');

        return DB::transaction(function () use ($validated, $user) {
            $product = Product::lockForUpdate()->findOrFail($validated['product_id']);

            $beforeQty = $product->stock_quantity;
            $changeQty = $validated['quantity'];
            $afterQty  = $beforeQty + $changeQty;

            if ($afterQty < 0) {
                return response()->json([
                    'status'  => 'error',
                    'message' => "Không thể trừ kho! Số lượng hao hụt ({$changeQty}) lớn hơn số lượng tồn kho hiện tại ({$beforeQty}).",
                ], 400);
            }

            $product->update(['stock_quantity' => $afterQty]);

            $transaction = InventoryTransaction::create([
                'product_id'       => $product->id,
                'transaction_type' => $validated['transaction_type'],
                'quantity'         => $changeQty,
                'before_quantity'  => $beforeQty,
                'after_quantity'   => $afterQty,
                'reference_type'   => 'manual_adjustment',
                'reference_id'     => null,
                'note'             => $validated['note'],
                'created_by'       => $user?->id,
            ]);

            return response()->json(['status' => 'success', 'message' => 'Điều chỉnh kho thành công!', 'data' => $transaction], 201);
        });
    }
}
