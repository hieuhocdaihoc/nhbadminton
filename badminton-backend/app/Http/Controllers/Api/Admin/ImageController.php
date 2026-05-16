<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Image;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ImageController extends Controller
{
    // 1. Upload hình ảnh mới
    public function store(Request $request)
    {
        $request->validate([
            'image' => 'required|image|mimes:jpeg,png,jpg,webp|max:2048', // Tối đa 2MB
            'target_type' => 'required|in:court,product,user,category,service',
            'target_id' => 'required|string|size:36',
            'alt_text' => 'nullable|string|max:255',
            'sort_order' => 'nullable|integer',
            'is_primary' => 'nullable|boolean'
        ]);

        $isPrimary = $request->is_primary ?? false;

        // Nếu ảnh này là primary, gỡ primary của các ảnh cũ cùng target
        if ($isPrimary) {
            Image::where('target_type', $request->target_type)
                ->where('target_id', $request->target_id)
                ->update(['is_primary' => false]);
        } else {
            // Nếu chưa có ảnh nào, tự động cho ảnh đầu tiên làm primary
            $count = Image::where('target_type', $request->target_type)
                ->where('target_id', $request->target_id)
                ->count();
            if ($count === 0) {
                $isPrimary = true;
            }
        }

        // Xử lý lưu file ảnh vào thư mục: storage/app/public/uploads/{target_type}
        $file = $request->file('image');
        $folder = 'uploads/' . $request->target_type;
        $fileName = time() . '_' . uniqid() . '.' . $file->getClientOriginalExtension();

        // Lưu file vào disk 'public'
        $path = $file->storeAs($folder, $fileName, 'public');

        // Tạo đường dẫn URL đầy đủ để Frontend dễ hiển thị
        $imageUrl = asset('storage/' . $path);

        // Lưu thông tin vào Database
        $image = Image::create([
            'url' => $imageUrl,
            'alt_text' => $request->alt_text ?? "Hình ảnh " . $request->target_type,
            'target_type' => $request->target_type,
            'target_id' => $request->target_id,
            'sort_order' => $request->sort_order ?? 0,
            'is_primary' => $isPrimary
        ]);

        return response()->json([
            'message' => 'Upload hình ảnh thành công',
            'data' => $image
        ], 201);
    }

    // 2. Xóa hình ảnh
    public function destroy($id)
    {
        $image = Image::find($id);

        if (!$image) {
            return response()->json(['message' => 'Không tìm thấy hình ảnh'], 404);
        }

        // Tách lấy đường dẫn tương đối từ URL để xóa file vật lý trong ổ cứng
        // Ví dụ URL: http://127.0.0.1:8000/storage/uploads/court/123.jpg
        // Cần lấy: uploads/court/123.jpg
        $relativePath = str_replace(asset('storage') . '/', '', $image->url);

        if (Storage::disk('public')->exists($relativePath)) {
            Storage::disk('public')->delete($relativePath);
        }

        // Xóa record trong DB
        $image->delete();

        return response()->json(['message' => 'Đã xóa hình ảnh thành công']);
    }
}