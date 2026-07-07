<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\StaffShift;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class StaffShiftController extends Controller
{
    private const STATUSES = ['scheduled', 'working', 'completed', 'cancelled'];

    /** Chức năng: Lấy danh sách ca làm nhân viên, hỗ trợ lọc theo nhân viên, ngày và trạng thái. */
    public function index(Request $request)
    {
        $query = StaffShift::with(['staff:id,full_name,phone,email,status'])
            ->when($request->filled('staff_id'),  fn($q) => $q->where('staff_id', $request->staff_id))
            ->when($request->filled('status'),    fn($q) => $q->where('status', $request->status))
            ->when($request->filled('date_from'), fn($q) => $q->whereDate('shift_date', '>=', $request->date_from))
            ->when($request->filled('date_to'),   fn($q) => $q->whereDate('shift_date', '<=', $request->date_to))
            ->when($request->filled('keyword'), function ($q) use ($request) {
                $keyword = $request->keyword;
                $q->where(function ($sub) use ($keyword) {
                    $sub->where('shift_name', 'like', "%{$keyword}%")
                        ->orWhere('note', 'like', "%{$keyword}%")
                        ->orWhereHas('staff', fn($sq) => $sq
                            ->where('full_name', 'like', "%{$keyword}%")
                            ->orWhere('phone', 'like', "%{$keyword}%"));
                });
            });

        $shifts = $query->orderByDesc('shift_date')->orderBy('start_time')->paginate($request->get('per_page', 10));

        return response()->json(['message' => 'Lấy danh sách ca làm thành công', 'data' => $shifts]);
    }

    /** Chức năng: Tạo ca làm mới cho nhân viên sau khi kiểm tra trạng thái và trùng ca. */
    public function store(Request $request)
    {
        $validated = $this->validatedShift($request);

        $staff = \App\Models\User::findOrFail($validated['staff_id']);
        if ($staff->status !== 'active') {
            return response()->json(['message' => 'Nhân viên này đang bị khóa tài khoản, không thể xếp ca.'], 422);
        }

        if ($validated['shift_date'] < now()->format('Y-m-d')) {
            return response()->json(['message' => 'Không thể tạo ca làm cho ngày đã qua.'], 422);
        }

        if ($this->findOverlappingShift($validated['staff_id'], $validated['shift_date'], $validated['start_time'], $validated['end_time'])) {
            return response()->json(['message' => 'Nhân viên đã có ca làm trùng khung giờ trong ngày này.'], 422);
        }

        $shift = StaffShift::create($validated);

        return response()->json([
            'message' => 'Tạo ca làm thành công',
            'data'    => $shift->load('staff:id,full_name,phone,email,status'),
        ], 201);
    }

    /** Chức năng: Lấy chi tiết một ca làm. */
    public function show($id)
    {
        $shift = StaffShift::with('staff:id,full_name,phone,email,status')->findOrFail($id);

        return response()->json(['message' => 'Lấy chi tiết ca làm thành công', 'data' => $shift]);
    }

    /** Chức năng: Cập nhật thông tin ca làm và kiểm tra lại trùng ca nếu đổi lịch. */
    public function update(Request $request, $id)
    {
        $shift     = StaffShift::findOrFail($id);
        $validated = $this->validatedShift($request, true);

        $staffId   = $validated['staff_id']   ?? $shift->staff_id;
        $shiftDate = $validated['shift_date']  ?? $shift->shift_date->format('Y-m-d');
        $startTime = $validated['start_time']  ?? $shift->start_time;
        $endTime   = $validated['end_time']    ?? $shift->end_time;

        if ($this->findOverlappingShift($staffId, $shiftDate, $startTime, $endTime, $shift->id)) {
            return response()->json(['message' => 'Nhân viên đã có ca làm trùng khung giờ trong ngày này.'], 422);
        }

        $shift->update($validated);

        return response()->json([
            'message' => 'Cập nhật ca làm thành công',
            'data'    => $shift->fresh()->load('staff:id,full_name,phone,email,status'),
        ]);
    }

    /** Chức năng: Xóa ca làm chưa hoặc không cần quản lý nữa. */
    public function destroy($id)
    {
        $shift = StaffShift::findOrFail($id);

        if ($shift->status === 'working') {
            return response()->json(['message' => 'Không thể xóa ca đang làm.'], 422);
        }

        $shift->delete();

        return response()->json(['message' => 'Xóa ca làm thành công']);
    }

    /** Chức năng: Trả về trạng thái ca làm hiện tại và lịch sắp tới của nhân viên đang đăng nhập. */
    public function myShifts(Request $request)
    {
        $staffId = $request->user()->id;
        $now     = now()->setTimezone('Asia/Ho_Chi_Minh');
        $today   = $now->format('Y-m-d');
        $currentTime = $now->format('H:i');

        $currentShift = StaffShift::where('staff_id', $staffId)
            ->whereDate('shift_date', $today)
            ->where('start_time', '<=', $currentTime)
            ->where('end_time', '>', $currentTime)
            ->whereIn('status', ['scheduled', 'working'])
            ->first();

        $upcomingShifts = StaffShift::where('staff_id', $staffId)
            ->where(function ($q) use ($today, $currentTime) {
                $q->whereDate('shift_date', '>', $today)
                    ->orWhere(function ($q2) use ($today, $currentTime) {
                        $q2->whereDate('shift_date', $today)
                            ->where('start_time', '>', $currentTime);
                    });
            })
            ->whereIn('status', ['scheduled', 'working'])
            ->orderBy('shift_date')
            ->orderBy('start_time')
            ->limit(20)
            ->get();

        return response()->json([
            'data' => [
                'is_on_shift'    => !is_null($currentShift),
                'current_shift'  => $currentShift,
                'upcoming_shifts' => $upcomingShifts,
            ],
        ]);
    }

    /** Chức năng: Ghi nhận thời điểm nhân viên bắt đầu ca làm thực tế. */
    public function checkIn($id)
    {
        $shift = StaffShift::findOrFail($id);

        if (!in_array($shift->status, ['scheduled', 'working'], true)) {
            return response()->json(['message' => 'Chỉ ca đã xếp mới được điểm danh vào ca.'], 422);
        }

        $shift->update([
            'check_in_time' => $shift->check_in_time ?: now(),
            'status'        => 'working',
        ]);

        return response()->json([
            'message' => 'Điểm danh vào ca thành công',
            'data'    => $shift->fresh()->load('staff:id,full_name,phone,email,status'),
        ]);
    }

    /** Chức năng: Ghi nhận thời điểm nhân viên kết thúc ca và lưu ghi chú bàn giao. */
    public function checkOut(Request $request, $id)
    {
        $shift = StaffShift::findOrFail($id);

        if ($shift->status !== 'working') {
            return response()->json(['message' => 'Chỉ ca đang làm mới được điểm danh ra ca.'], 422);
        }

        $request->validate(['note' => ['nullable', 'string']]);

        $shift->update([
            'check_out_time' => now(),
            'status'         => 'completed',
            'note'           => $request->filled('note') ? $request->note : $shift->note,
        ]);

        return response()->json([
            'message' => 'Điểm danh ra ca thành công',
            'data'    => $shift->fresh()->load('staff:id,full_name,phone,email,status'),
        ]);
    }

    /** Chức năng: Validate dữ liệu đầu vào khi tạo hoặc cập nhật ca làm. */
    private function validatedShift(Request $request, bool $isUpdate = false): array
    {
        $required = $isUpdate ? 'sometimes' : 'required';

        return $request->validate([
            'staff_id'       => [$required, 'string', Rule::exists('users', 'id')->where(fn($q) => $q->where('role', 'staff'))],
            'shift_date'     => [$required, 'date'],
            'shift_name'     => ['nullable', 'string', 'max:50'],
            'start_time'     => [$required, 'date_format:H:i'],
            'end_time'       => [$required, 'date_format:H:i', 'after:start_time'],
            'check_in_time'  => ['nullable', 'date'],
            'check_out_time' => ['nullable', 'date', 'after_or_equal:check_in_time'],
            'status'         => ['nullable', Rule::in(self::STATUSES)],
            'note'           => ['nullable', 'string'],
        ]);
    }

    /** Chức năng: Tìm ca làm bị chồng thời gian với nhân viên được phân ca. */
    private function findOverlappingShift(
        string $staffId,
        string $shiftDate,
        string $startTime,
        string $endTime,
        ?string $ignoreId = null
    ): ?StaffShift {
        return StaffShift::where('staff_id', $staffId)
            ->whereDate('shift_date', $shiftDate)
            ->when($ignoreId, fn($q) => $q->where('id', '!=', $ignoreId))
            ->where('status', '!=', 'cancelled')
            ->where(fn($q) => $q->where('start_time', '<', $endTime)->where('end_time', '>', $startTime))
            ->first();
    }
}
