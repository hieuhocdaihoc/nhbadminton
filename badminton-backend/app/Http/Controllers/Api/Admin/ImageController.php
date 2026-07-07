<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Image;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ImageController extends Controller
{
    private const ALLOWED_TARGET_TYPES = ['court', 'product', 'user', 'category', 'service'];
    private const ALLOWED_MIMES        = ['jpeg', 'png', 'jpg', 'webp'];
    private const MAX_FILE_SIZE_KB     = 2048;

    /** Chức năng: Upload và lưu thông tin ảnh gắn với sân, sản phẩm, danh mục, dịch vụ hoặc người dùng. */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'image'       => ['required', 'image', 'mimes:' . implode(',', self::ALLOWED_MIMES), 'max:' . self::MAX_FILE_SIZE_KB],
            'target_type' => ['required', 'in:' . implode(',', self::ALLOWED_TARGET_TYPES)],
            'target_id'   => ['required', 'string', 'size:36'],
            'alt_text'    => ['nullable', 'string', 'max:255'],
            'sort_order'  => ['nullable', 'integer'],
            'is_primary'  => ['nullable', 'boolean'],
        ]);

        $isPrimary = $validated['is_primary'] ?? false;

        if ($isPrimary) {
            Image::where('target_type', $validated['target_type'])
                ->where('target_id', $validated['target_id'])
                ->update(['is_primary' => false]);
        } else {
            $exists = Image::where('target_type', $validated['target_type'])
                ->where('target_id', $validated['target_id'])
                ->exists();
            if (!$exists) {
                $isPrimary = true;
            }
        }

        $file     = $request->file('image');
        $folder   = 'uploads/' . $validated['target_type'];
        $fileName = time() . '_' . uniqid() . '.' . $file->getClientOriginalExtension();
        $path     = $file->storeAs($folder, $fileName, 'public');

        $image = Image::create([
            'url'         => asset('storage/' . $path),
            'alt_text'    => $validated['alt_text'] ?? 'Hình ảnh ' . $validated['target_type'],
            'target_type' => $validated['target_type'],
            'target_id'   => $validated['target_id'],
            'sort_order'  => $validated['sort_order'] ?? 0,
            'is_primary'  => $isPrimary,
        ]);

        return response()->json([
            'message' => 'Upload hình ảnh thành công',
            'data'    => $image,
        ], 201);
    }

    /** Chức năng: Xóa bản ghi ảnh và file vật lý nếu còn tồn tại trong storage. */
    public function destroy($id)
    {
        $image = Image::findOrFail($id);

        $relativePath = str_replace(asset('storage') . '/', '', $image->url);

        if (Storage::disk('public')->exists($relativePath)) {
            Storage::disk('public')->delete($relativePath);
        }

        $image->delete();

        return response()->json(['message' => 'Đã xóa hình ảnh thành công']);
    }
}
