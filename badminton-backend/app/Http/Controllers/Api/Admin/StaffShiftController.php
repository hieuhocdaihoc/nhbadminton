<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\StaffShift;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class StaffShiftController extends Controller
{
    // Danh sach trang thai hop le cua mot ca lam.
    private array $statuses = ['scheduled', 'working', 'completed', 'cancelled'];

    /**
     * Lay danh sach ca lam cho man hinh admin.
     *
     * Ho tro loc theo nhan vien, trang thai, khoang ngay va tu khoa.
     * Ket qua tra ve dang phan trang de frontend hien thi bang du lieu.
     */
    /**
     * Chức năng: Lấy danh sách ca làm nhân viên, hỗ trợ lọc theo nhân viên, ngày và trạng thái.
     */
    public function index(Request $request)
    {
        $query = StaffShift::with(['staff:id,full_name,phone,email,status'])
            ->when($request->filled('staff_id'), fn($q) => $q->where('staff_id', $request->staff_id))
            ->when($request->filled('status'), fn($q) => $q->where('status', $request->status))
            ->when($request->filled('date_from'), fn($q) => $q->whereDate('shift_date', '>=', $request->date_from))
            ->when($request->filled('date_to'), fn($q) => $q->whereDate('shift_date', '<=', $request->date_to))
            ->when($request->filled('keyword'), function ($q) use ($request) {
                $keyword = $request->keyword;
                $q->where(function ($subQuery) use ($keyword) {
                    $subQuery->where('shift_name', 'like', "%{$keyword}%")
                        ->orWhere('note', 'like', "%{$keyword}%")
                        ->orWhereHas('staff', function ($staffQuery) use ($keyword) {
                            $staffQuery->where('full_name', 'like', "%{$keyword}%")
                                ->orWhere('phone', 'like', "%{$keyword}%");
                        });
                });
            });

        $shifts = $query
            ->orderByDesc('shift_date')
            ->orderBy('start_time')
            ->paginate($request->get('per_page', 10));

        return response()->json([
            'message' => 'Lay danh sach ca lam thanh cong',
            'data' => $shifts,
        ]);
    }

    /**
     * Tao moi mot ca lam cho nhan vien.
     *
     * Ham nay validate nhan vien phai co role staff, kiem tra gio bat dau/ket thuc
     * va chan truong hop nhan vien bi xep trung ca trong cung mot ngay.
     */
    /**
     * Chức năng: Tạo ca làm mới cho nhân viên sau khi kiểm tra trùng ca.
     */
    public function store(Request $request)
    {
        $validated = $this->validatedShift($request);
        $duplicate = $this->findOverlappingShift(
            $validated['staff_id'],
            $validated['shift_date'],
            $validated['start_time'],
            $validated['end_time']
        );

        if ($duplicate) {
            return response()->json([
                'message' => 'Nhan vien da co ca lam trung khung gio trong ngay nay.'
            ], 422);
        }

        $shift = StaffShift::create($validated);

        return response()->json([
            'message' => 'Tao ca lam thanh cong',
            'data' => $shift->load('staff:id,full_name,phone,email,status'),
        ], 201);
    }

    /**
     * Lay chi tiet mot ca lam.
     *
     * Dung khi frontend can xem day du thong tin ca va thong tin nhan vien duoc phan ca.
     */
    /**
     * Chức năng: Lấy chi tiết một ca làm.
     */
    public function show($id)
    {
        $shift = StaffShift::with('staff:id,full_name,phone,email,status')->findOrFail($id);

        return response()->json([
            'message' => 'Lay chi tiet ca lam thanh cong',
            'data' => $shift,
        ]);
    }

    /**
     * Cap nhat thong tin ca lam.
     *
     * Cho phep sua nhan vien, ngay, ten ca, khung gio, trang thai va ghi chu.
     * Neu thay doi ngay/gio/nhan vien thi van kiem tra trung ca truoc khi luu.
     */
    /**
     * Chức năng: Cập nhật thông tin ca làm và kiểm tra lại trùng ca nếu đổi lịch.
     */
    public function update(Request $request, $id)
    {
        $shift = StaffShift::findOrFail($id);
        $validated = $this->validatedShift($request, true);
        $staffId = $validated['staff_id'] ?? $shift->staff_id;
        $shiftDate = $validated['shift_date'] ?? $shift->shift_date->format('Y-m-d');
        $startTime = $validated['start_time'] ?? $shift->start_time;
        $endTime = $validated['end_time'] ?? $shift->end_time;

        $duplicate = $this->findOverlappingShift($staffId, $shiftDate, $startTime, $endTime, $shift->id);
        if ($duplicate) {
            return response()->json([
                'message' => 'Nhan vien da co ca lam trung khung gio trong ngay nay.'
            ], 422);
        }

        $shift->update($validated);

        return response()->json([
            'message' => 'Cap nhat ca lam thanh cong',
            'data' => $shift->fresh()->load('staff:id,full_name,phone,email,status'),
        ]);
    }

    /**
     * Xoa mot ca lam.
     *
     * Chi cho xoa ca chua dang dien ra; ca co trang thai working bi chan de
     * tranh mat du lieu cham cong khi nhan vien dang lam viec.
     */
    /**
     * Chức năng: Xóa ca làm chưa hoặc không cần quản lý nữa.
     */
    public function destroy($id)
    {
        $shift = StaffShift::findOrFail($id);

        if ($shift->status === 'working') {
            return response()->json([
                'message' => 'Khong the xoa ca dang lam.'
            ], 422);
        }

        $shift->delete();

        return response()->json([
            'message' => 'Xoa ca lam thanh cong',
        ]);
    }

    /**
     * Diem danh vao ca.
     *
     * Khi admin bam check-in, he thong ghi thoi diem vao ca thuc te va doi
     * trang thai sang working. Neu ca da co check_in_time thi giu lai moc cu.
     */
    /**
     * Chức năng: Ghi nhận thời điểm nhân viên bắt đầu ca làm thực tế.
     */
    public function checkIn($id)
    {
        $shift = StaffShift::findOrFail($id);

        if (!in_array($shift->status, ['scheduled', 'working'], true)) {
            return response()->json([
                'message' => 'Chi ca da xep moi duoc diem danh vao ca.'
            ], 422);
        }

        $shift->update([
            'check_in_time' => $shift->check_in_time ?: now(),
            'status' => 'working',
        ]);

        return response()->json([
            'message' => 'Diem danh vao ca thanh cong',
            'data' => $shift->fresh()->load('staff:id,full_name,phone,email,status'),
        ]);
    }

    /**
     * Diem danh ra ca.
     *
     * Chi ap dung cho ca dang working. He thong ghi thoi diem ra ca, cap nhat
     * trang thai completed va luu ghi chu ban giao neu admin nhap them.
     */
    /**
     * Chức năng: Ghi nhận thời điểm nhân viên kết thúc ca và lưu ghi chú bàn giao.
     */
    public function checkOut(Request $request, $id)
    {
        $shift = StaffShift::findOrFail($id);

        if ($shift->status !== 'working') {
            return response()->json([
                'message' => 'Chi ca dang lam moi duoc diem danh ra ca.'
            ], 422);
        }

        $request->validate([
            'note' => ['nullable', 'string'],
        ]);

        $shift->update([
            'check_out_time' => now(),
            'status' => 'completed',
            'note' => $request->filled('note') ? $request->note : $shift->note,
        ]);

        return response()->json([
            'message' => 'Diem danh ra ca thanh cong',
            'data' => $shift->fresh()->load('staff:id,full_name,phone,email,status'),
        ]);
    }

    /**
     * Validate du lieu dau vao khi tao hoac cap nhat ca lam.
     *
     * Voi tao moi, cac truong cot loi la bat buoc. Voi cap nhat, dung sometimes
     * de chi validate nhung truong frontend gui len. staff_id bat buoc ton tai
     * trong bang users va phai co role staff.
     */
    /**
     * Chức năng: Mô tả nghiệp vụ của hàm validatedShift.
     */
    private function validatedShift(Request $request, bool $isUpdate = false): array
    {
        $required = $isUpdate ? 'sometimes' : 'required';

        return $request->validate([
            'staff_id' => [
                $required,
                'string',
                Rule::exists('users', 'id')->where(fn($q) => $q->where('role', 'staff')),
            ],
            'shift_date' => [$required, 'date'],
            'shift_name' => ['nullable', 'string', 'max:50'],
            'start_time' => [$required, 'date_format:H:i'],
            'end_time' => [$required, 'date_format:H:i', 'after:start_time'],
            'check_in_time' => ['nullable', 'date'],
            'check_out_time' => ['nullable', 'date', 'after_or_equal:check_in_time'],
            'status' => ['nullable', Rule::in($this->statuses)],
            'note' => ['nullable', 'string'],
        ]);
    }

    /**
     * Kiem tra ca lam bi trung khung gio.
     *
     * Quy tac trung ca: cung nhan vien, cung ngay, ca cu chua bi huy va khoang
     * thoi gian moi giao nhau voi khoang thoi gian da ton tai.
     */
    /**
     * Chức năng: Tìm ca làm bị chồng thời gian với nhân viên được phân ca.
     */
    private function findOverlappingShift(
        string $staffId,
        string $shiftDate,
        string $startTime,
        string $endTime,
        ?string $ignoreId = null
    ): ?StaffShift {
        return StaffShift::query()
            ->where('staff_id', $staffId)
            ->whereDate('shift_date', $shiftDate)
            ->when($ignoreId, fn($q) => $q->where('id', '!=', $ignoreId))
            ->where('status', '!=', 'cancelled')
            ->where(function ($q) use ($startTime, $endTime) {
                $q->where('start_time', '<', $endTime)
                    ->where('end_time', '>', $startTime);
            })
            ->first();
    }
}
