<?php

namespace App\Http\Controllers\Api\Admin; // Namespace đã có thêm \Admin

use App\Http\Controllers\Controller;
use App\Models\Court;
use Illuminate\Http\Request;

class CourtController extends Controller
{
    // Lấy danh sách sân (Admin quản lý)
    /**
     * Chức năng: Lấy danh sách sân cho khu vực quản trị.
     */
    public function index()
    {
        $courts = Court::all();
        return response()->json([
            'message' => 'Danh sách sân hiện có',
            'data' => $courts
        ]);
    }

    // Thêm sân mới
    /**
     * Chức năng: Tạo mới sân với mã sân, thông tin mặt sân, sức chứa và trạng thái vận hành.
     */
    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:100',
            'court_code' => 'required|string|unique:courts,court_code|max:50',
            'floor_type' => 'nullable|string|max:100',
            'has_lighting' => 'boolean',
            'capacity' => 'nullable|integer',
            'location_note' => 'nullable|string|max:255',
            'status' => 'string|in:active,inactive'
        ]);

        $court = Court::create($request->all());

        return response()->json([
            'message' => 'Tạo sân thành công',
            'data' => $court
        ], 201);
    }

    // Xem chi tiết
    /**
     * Chức năng: Lấy chi tiết một sân.
     */
    public function show($id)
    {
        $court = Court::find($id);
        if (!$court)
            return response()->json(['message' => 'Không tìm thấy sân'], 404);
        return response()->json(['data' => $court]);
    }

    // Cập nhật sân
    /**
     * Chức năng: Cập nhật thông tin cấu hình và trạng thái của sân.
     */
    public function update(Request $request, $id)
    {
        $court = Court::find($id);
        if (!$court)
            return response()->json(['message' => 'Không tìm thấy sân'], 404);

        $request->validate([
            'name' => 'required|string|max:100',
            'court_code' => 'required|string|max:50|unique:courts,court_code,' . $court->id,
            'floor_type' => 'nullable|string|max:100',
            'has_lighting' => 'boolean',
            'capacity' => 'nullable|integer',
            'is_maintenance' => 'boolean',
            'status' => 'string|in:active,inactive'
        ]);

        $court->update($request->all());

        return response()->json([
            'message' => 'Cập nhật thành công',
            'data' => $court
        ]);
    }

    // Xóa sân
    /**
     * Chức năng: Ngưng hoạt động sân bằng cách chuyển trạng thái thay vì xóa dữ liệu.
     */
    public function destroy($id)
    {
        $court = Court::find($id);
        if (!$court)
            return response()->json(['message' => 'Không tìm thấy sân'], 404);

        $court->delete();
        return response()->json(['message' => 'Đã xóa sân khỏi hệ thống']);
    }



    // API PUBLIC: Lấy danh sách sân cho Khách hàng (Chỉ lấy sân Active kèm ảnh)
    // API PUBLIC: Lấy danh sách sân đang hoạt động cho Khách hàng
    /**
     * Chức năng: Lấy danh sách sân đang public cho khách xem và đặt lịch.
     */
    public function getPublicCourts()
    {
        // Truy vấn lấy các sân có status = 'active'
        $courts = Court::where('status', 'active')
            ->with([
                'images' => function ($query) {
                    // Lọc lấy ảnh được đánh dấu làm ảnh bìa
                    $query->where('is_primary', true);
                }
            ])
            ->orderBy('name')
            ->get();

        // Chuẩn hóa JSON trả về với key 'data' rõ ràng
        return response()->json([
            'status' => 'success',
            'data' => $courts
        ]);
    }
}