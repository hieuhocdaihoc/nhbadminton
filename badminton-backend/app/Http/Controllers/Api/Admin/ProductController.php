<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    private const SKU_REGEX = '/^[A-Z0-9_\-]+$/i';
    private const SKU_REGEX_RULE = 'regex:/^[A-Z0-9_\-]+$/i';
    private const DEFAULT_LOW_STOCK_THRESHOLD = 5;
    private const DEFAULT_STATUS = 'active';
    private const STATUSES = ['active', 'inactive'];

    /** Chức năng: Lấy danh sách sản phẩm kèm danh mục, có hỗ trợ lọc theo từ khóa và danh mục. */
    public function index(Request $request)
    {
        $query = Product::with([
            'category' => fn($q) => $q->select('id', 'name'),
            'images',
        ]);

        if ($request->filled('keyword')) {
            $keyword = $request->keyword;
            $query->where('name', 'like', "%{$keyword}%")
                ->orWhere('sku', 'like', "%{$keyword}%");
        }

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        // Thống kê tổng quan tính trên toàn bộ kết quả khớp bộ lọc (không bị giới hạn bởi phân trang)
        $statsQuery = clone $query;
        $stats = [
            'total'        => (clone $statsQuery)->count(),
            'in_stock'     => (clone $statsQuery)->whereColumn('stock_quantity', '>', 'low_stock_threshold')->count(),
            'low_stock'    => (clone $statsQuery)->whereColumn('stock_quantity', '<=', 'low_stock_threshold')->where('stock_quantity', '>', 0)->count(),
            'out_of_stock' => (clone $statsQuery)->where('stock_quantity', '<=', 0)->count(),
        ];

        $products = $query->orderBy('created_at', 'desc')->paginate(15);

        return response()->json(['status' => 'success', 'data' => $products, 'stats' => $stats]);
    }

    /**
     * Chức năng: Báo cáo tồn kho — top bán chạy, sản phẩm cần nhập thêm,
     * giá trị tồn kho theo từng danh mục.
     */
    public function report()
    {
        $topSelling = Product::with('category:id,name')
            ->orderByDesc('sold_count')
            ->limit(10)
            ->get(['id', 'name', 'sku', 'category_id', 'sold_count', 'selling_price']);

        $needsRestock = Product::with('category:id,name')
            ->whereColumn('stock_quantity', '<=', 'low_stock_threshold')
            ->orderBy('stock_quantity')
            ->get(['id', 'name', 'sku', 'category_id', 'stock_quantity', 'low_stock_threshold']);

        $byCategory = Product::selectRaw('category_id, COUNT(*) as product_count, SUM(stock_quantity * selling_price) as inventory_value')
            ->groupBy('category_id')
            ->with('category:id,name')
            ->get()
            ->map(fn($row) => [
                'category_name'    => $row->category?->name ?? 'Chưa phân loại',
                'product_count'    => (int) $row->product_count,
                'inventory_value'  => (float) $row->inventory_value,
            ]);

        return response()->json([
            'status' => 'success',
            'data'   => [
                'top_selling'    => $topSelling,
                'needs_restock'  => $needsRestock,
                'by_category'    => $byCategory,
                'total_inventory_value' => (float) $byCategory->sum('inventory_value'),
            ],
        ]);
    }

    /** Chức năng: Tạo mới sản phẩm với tồn kho ban đầu bằng 0. */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'category_id'        => ['required', 'exists:categories,id'],
            'name'               => ['required', 'string', 'max:200'],
            'sku'                => ['required', 'string', 'max:100', 'unique:products,sku', self::SKU_REGEX_RULE],
            'low_stock_threshold' => ['nullable', 'integer', 'min:0'],
            'selling_price'      => ['required', 'numeric', 'min:0'],
        ], [
            'sku.regex' => 'Mã SKU chỉ được chứa chữ cái không dấu, số, dấu gạch dưới (_) và gạch ngang (-).',
        ]);

        $product = Product::create([
            'category_id'        => $validated['category_id'],
            'name'               => $validated['name'],
            'sku'                => $validated['sku'],
            'brand'              => $request->brand,
            'description'        => $request->description,
            'short_description'  => $request->short_description,
            'material'           => $request->material,
            'origin'             => $request->origin,
            'selling_price'      => $validated['selling_price'],
            'stock_quantity'     => 0,
            'sold_count'         => 0,
            'low_stock_threshold' => $validated['low_stock_threshold'] ?? self::DEFAULT_LOW_STOCK_THRESHOLD,
            'status'             => self::DEFAULT_STATUS,
        ]);

        return response()->json(['status' => 'success', 'message' => 'Tạo sản phẩm thành công!', 'data' => $product], 201);
    }

    /** Chức năng: Lấy chi tiết một sản phẩm kèm danh mục và ảnh. */
    public function show($id)
    {
        $product = Product::with(['category', 'images'])->findOrFail($id);

        return response()->json(['status' => 'success', 'data' => $product]);
    }

    /** Chức năng: Cập nhật thông tin sản phẩm, không cho phép thay đổi số lượng tồn kho trực tiếp. */
    public function update(Request $request, $id)
    {
        $product = Product::findOrFail($id);

        $validated = $request->validate([
            'category_id'    => ['sometimes', 'required', 'exists:categories,id'],
            'name'           => ['sometimes', 'required', 'string', 'max:200'],
            'sku'            => ['sometimes', 'required', 'string', 'max:100', 'unique:products,sku,' . $id, self::SKU_REGEX_RULE],
            'selling_price'  => ['sometimes', 'required', 'numeric', 'min:0'],
            'status'         => ['sometimes', 'required', 'in:' . implode(',', self::STATUSES)],
        ], [
            'sku.regex' => 'Mã SKU chỉ được chứa chữ cái không dấu, số, dấu gạch dưới (_) và gạch ngang (-).',
        ]);

        $product->update(array_diff_key($validated, array_flip(['stock_quantity', 'sold_count'])));

        return response()->json(['status' => 'success', 'message' => 'Cập nhật thông tin thành công!', 'data' => $product]);
    }

    /** Chức năng: Tạm ngưng kinh doanh sản phẩm bằng cách đổi trạng thái sang inactive. */
    public function destroy($id)
    {
        $product = Product::findOrFail($id);

        if ($product->status === 'inactive') {
            return response()->json(['status' => 'error', 'message' => 'Sản phẩm này đã được tạm ngưng từ trước!'], 400);
        }

        $product->update(['status' => 'inactive']);

        return response()->json(['status' => 'success', 'message' => 'Đã tạm ngưng bán sản phẩm này!']);
    }
}
