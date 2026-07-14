<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Court;
use App\Models\CourtPricing;
use App\Models\CourtPriceHistory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CourtPricingController extends Controller
{
    private const DAY_TYPES = ['weekday', 'weekend', 'holiday'];
    private const MIN_BOOKING_MINUTES = 30;

    /** Chức năng: Lấy danh sách bảng giá sân theo sân, loại ngày và khung giờ. */
    public function index()
    {
        $pricings = CourtPricing::with('court:id,name')
            ->orderBy('court_id')
            ->orderBy('start_time')
            ->get();

        return response()->json([
            'message' => 'Danh sách bảng giá theo khung giờ',
            'data'    => $pricings,
        ]);
    }

    /** Chức năng: Tạo mới khung giá sân. */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'court_id'            => ['required', 'exists:courts,id'],
            'day_type'            => ['required', 'in:' . implode(',', self::DAY_TYPES)],
            'start_time'          => ['required', 'date_format:H:i', 'before:end_time'],
            'end_time'            => ['required', 'date_format:H:i'],
            'price'               => ['required', 'numeric', 'min:0'],
            'effective_from'      => ['nullable', 'date'],
            'effective_to'        => ['nullable', 'date', 'after_or_equal:effective_from'],
            'min_booking_minutes' => ['integer', 'min:' . self::MIN_BOOKING_MINUTES],
        ]);

        $pricing = CourtPricing::create($validated);

        // Ghi lịch sử: tạo mới khung giá
        CourtPriceHistory::create([
            'court_pricing_id' => $pricing->id,
            'court_id'         => $pricing->court_id,
            'old_price'        => null,
            'new_price'        => $pricing->price,
            'action'           => 'create',
            'note'             => "{$pricing->day_type} {$validated['start_time']}-{$validated['end_time']}",
            'changed_by'       => $request->user()?->id,
        ]);

        return response()->json([
            'message' => 'Thêm khung giờ giá thành công',
            'data'    => $pricing,
        ], 201);
    }

    /** Chức năng: Lấy chi tiết một cấu hình giá sân. */
    public function show($id)
    {
        $pricing = CourtPricing::with('court:id,name')->findOrFail($id);

        return response()->json(['data' => $pricing]);
    }

    /** Chức năng: Cập nhật bảng giá sân. */
    public function update(Request $request, $id)
    {
        $pricing = CourtPricing::findOrFail($id);

        $validated = $request->validate([
            'court_id'            => ['required', 'exists:courts,id'],
            'day_type'            => ['required', 'in:' . implode(',', self::DAY_TYPES)],
            'start_time'          => ['required', 'date_format:H:i', 'before:end_time'],
            'end_time'            => ['required', 'date_format:H:i'],
            'price'               => ['required', 'numeric', 'min:0'],
            'effective_from'      => ['nullable', 'date'],
            'effective_to'        => ['nullable', 'date', 'after_or_equal:effective_from'],
            'min_booking_minutes' => ['integer', 'min:' . self::MIN_BOOKING_MINUTES],
        ]);

        $oldPrice = (float) $pricing->price;
        $pricing->update($validated);

        // Ghi lịch sử nếu giá thay đổi
        if ((float) $validated['price'] !== $oldPrice) {
            CourtPriceHistory::create([
                'court_pricing_id' => $pricing->id,
                'court_id'         => $pricing->court_id,
                'old_price'        => $oldPrice,
                'new_price'        => (float) $validated['price'],
                'action'           => 'update',
                'note'             => "{$pricing->day_type} {$validated['start_time']}-{$validated['end_time']}",
                'changed_by'       => $request->user()?->id,
            ]);
        }

        return response()->json([
            'message' => 'Cập nhật bảng giá thành công',
            'data'    => $pricing,
        ]);
    }

    /** Chức năng: Xóa cấu hình giá sân không còn áp dụng. */
    public function destroy($id)
    {
        $pricing = CourtPricing::findOrFail($id);

        // Ghi lịch sử: xóa khung giá
        CourtPriceHistory::create([
            'court_pricing_id' => $pricing->id,
            'court_id'         => $pricing->court_id,
            'old_price'        => (float) $pricing->price,
            'new_price'        => null,
            'action'           => 'delete',
            'note'             => "{$pricing->day_type} " . substr($pricing->start_time, 0, 5) . '-' . substr($pricing->end_time, 0, 5),
            'changed_by'       => request()->user()?->id,
        ]);

        $pricing->delete();

        return response()->json(['message' => 'Đã xóa cấu hình giá khỏi hệ thống']);
    }

    /**
     * Chức năng: Tạo/cập nhật một mốc giá áp dụng đồng nhất cho TẤT CẢ sân trong 1 transaction.
     * Mỗi sân được upsert theo khóa (loại ngày + khung giờ + thời vụ); lỗi giữa chừng thì
     * rollback toàn bộ nên không bao giờ xảy ra tình trạng các sân lệch giá nhau.
     * Nếu truyền entry_ids (chế độ sửa nhóm) thì cập nhật trực tiếp các bản ghi đó
     * (cho phép đổi cả khung giờ/loại ngày) và tạo bù cho sân còn thiếu.
     */
    public function bulkUpsert(Request $request)
    {
        $validated = $request->validate([
            'day_type'            => ['required', 'in:' . implode(',', self::DAY_TYPES)],
            'start_time'          => ['required', 'date_format:H:i', 'before:end_time'],
            'end_time'            => ['required', 'date_format:H:i'],
            'price'               => ['required', 'numeric', 'min:0'],
            'effective_from'      => ['nullable', 'date'],
            'effective_to'        => ['nullable', 'date', 'after_or_equal:effective_from'],
            'min_booking_minutes' => ['nullable', 'integer', 'min:' . self::MIN_BOOKING_MINUTES],
            'entry_ids'           => ['nullable', 'array'],
            'entry_ids.*'         => ['exists:court_pricing,id'],
        ]);

        $userId   = $request->user()?->id;
        $courts   = Court::orderBy('name')->get();
        $entryIds = $validated['entry_ids'] ?? [];
        $note     = "{$validated['day_type']} {$validated['start_time']}-{$validated['end_time']}";

        if ($conflict = $this->findOverlappingGroup($validated, $entryIds)) {
            $cs = substr($conflict->start_time, 0, 5);
            $ce = substr($conflict->end_time, 0, 5);
            return response()->json([
                'message' => "Khung giờ bị chồng với mốc giá {$cs}-{$ce} đã có. Vui lòng sửa hoặc xóa mốc đó trước.",
            ], 422);
        }

        $result = DB::transaction(function () use ($validated, $courts, $entryIds, $userId, $note) {
            $created = 0;
            $updated = 0;
            $coveredCourtIds = [];

            // Chế độ sửa nhóm: cập nhật các bản ghi được chỉ định trước
            foreach (CourtPricing::whereIn('id', $entryIds)->get() as $pricing) {
                $this->applyRowUpdate($pricing, $validated, $userId, $note);
                $coveredCourtIds[] = $pricing->court_id;
                $updated++;
            }

            foreach ($courts as $court) {
                if (in_array($court->id, $coveredCourtIds, true)) {
                    continue;
                }

                $existing = CourtPricing::where('court_id', $court->id)
                    ->where('day_type', $validated['day_type'])
                    ->where('start_time', $validated['start_time'] . ':00')
                    ->where('end_time', $validated['end_time'] . ':00')
                    ->where(function ($q) use ($validated) {
                        $from = $validated['effective_from'] ?? null;
                        $from ? $q->where('effective_from', $from) : $q->whereNull('effective_from');
                    })
                    ->where(function ($q) use ($validated) {
                        $to = $validated['effective_to'] ?? null;
                        $to ? $q->where('effective_to', $to) : $q->whereNull('effective_to');
                    })
                    ->first();

                if ($existing) {
                    $this->applyRowUpdate($existing, $validated, $userId, $note);
                    $updated++;
                    continue;
                }

                $pricing = CourtPricing::create([
                    'court_id'            => $court->id,
                    'day_type'            => $validated['day_type'],
                    'start_time'          => $validated['start_time'],
                    'end_time'            => $validated['end_time'],
                    'price'               => $validated['price'],
                    'effective_from'      => $validated['effective_from'] ?? null,
                    'effective_to'        => $validated['effective_to'] ?? null,
                    'min_booking_minutes' => $validated['min_booking_minutes'] ?? 60,
                ]);

                CourtPriceHistory::create([
                    'court_pricing_id' => $pricing->id,
                    'court_id'         => $court->id,
                    'old_price'        => null,
                    'new_price'        => $pricing->price,
                    'action'           => 'create',
                    'note'             => $note,
                    'changed_by'       => $userId,
                ]);
                $created++;
            }

            return ['created' => $created, 'updated' => $updated];
        });

        return response()->json([
            'message' => "Đã áp dụng mốc giá cho {$courts->count()} sân",
            'data'    => $result,
        ]);
    }

    /** Chức năng: Xóa nguyên một mốc giá khỏi tất cả các sân trong 1 transaction. */
    public function bulkDestroy(Request $request)
    {
        $validated = $request->validate([
            'entry_ids'   => ['required', 'array', 'min:1'],
            'entry_ids.*' => ['exists:court_pricing,id'],
        ]);

        $userId = $request->user()?->id;

        $deleted = DB::transaction(function () use ($validated, $userId) {
            $pricings = CourtPricing::whereIn('id', $validated['entry_ids'])->get();

            foreach ($pricings as $pricing) {
                CourtPriceHistory::create([
                    'court_pricing_id' => $pricing->id,
                    'court_id'         => $pricing->court_id,
                    'old_price'        => (float) $pricing->price,
                    'new_price'        => null,
                    'action'           => 'delete',
                    'note'             => "{$pricing->day_type} " . substr($pricing->start_time, 0, 5) . '-' . substr($pricing->end_time, 0, 5),
                    'changed_by'       => $userId,
                ]);
                $pricing->delete();
            }

            return $pricings->count();
        });

        return response()->json(['message' => "Đã xóa mốc giá khỏi {$deleted} sân"]);
    }

    /**
     * Tìm mốc giá đã có bị chồng khung giờ với mốc đang lưu (cùng loại ngày, cùng phạm vi).
     * Giá thời vụ đè lên giá cố định là chủ đích (giá lễ/Tết) nên KHÔNG tính là chồng;
     * chỉ chặn: cố định chồng cố định, hoặc thời vụ chồng thời vụ có khoảng ngày giao nhau.
     * Bản ghi trùng khóa hoàn toàn (chính là mục tiêu upsert) và các entry đang sửa được bỏ qua.
     */
    private function findOverlappingGroup(array $validated, array $entryIds): ?CourtPricing
    {
        $newStart = $validated['start_time'] . ':00';
        $newEnd   = $validated['end_time'] . ':00';
        $from     = $validated['effective_from'] ?? null;
        $to       = $validated['effective_to'] ?? null;

        $query = CourtPricing::where('day_type', $validated['day_type'])
            ->where('start_time', '<', $newEnd)
            ->where('end_time', '>', $newStart)
            // Bỏ qua bản ghi trùng khóa hoàn toàn — đó là mục tiêu được upsert, không phải xung đột
            ->whereNot(function ($q) use ($newStart, $newEnd, $from, $to) {
                $q->where('start_time', $newStart)->where('end_time', $newEnd);
                $from ? $q->where('effective_from', $from) : $q->whereNull('effective_from');
                $to ? $q->where('effective_to', $to) : $q->whereNull('effective_to');
            });

        if (!empty($entryIds)) {
            $query->whereNotIn('id', $entryIds);
        }

        if (!$from) {
            $query->whereNull('effective_from');
        } else {
            $query->whereNotNull('effective_from')
                ->where(function ($q) use ($from) {
                    $q->whereNull('effective_to')->orWhere('effective_to', '>=', $from);
                });
            if ($to) {
                $query->where('effective_from', '<=', $to);
            }
        }

        return $query->first();
    }

    /** Cập nhật 1 bản ghi giá trong thao tác gộp: giữ min_booking_minutes cũ nếu không truyền, ghi lịch sử khi giá đổi. */
    private function applyRowUpdate(CourtPricing $pricing, array $validated, ?string $userId, string $note): void
    {
        $oldPrice = (float) $pricing->price;

        $pricing->update([
            'day_type'            => $validated['day_type'],
            'start_time'          => $validated['start_time'],
            'end_time'            => $validated['end_time'],
            'price'               => $validated['price'],
            'effective_from'      => $validated['effective_from'] ?? null,
            'effective_to'        => $validated['effective_to'] ?? null,
            'min_booking_minutes' => $validated['min_booking_minutes'] ?? $pricing->min_booking_minutes,
        ]);

        if ((float) $validated['price'] !== $oldPrice) {
            CourtPriceHistory::create([
                'court_pricing_id' => $pricing->id,
                'court_id'         => $pricing->court_id,
                'old_price'        => $oldPrice,
                'new_price'        => (float) $validated['price'],
                'action'           => 'update',
                'note'             => $note,
                'changed_by'       => $userId,
            ]);
        }
    }

    /**
     * Chức năng: Báo cáo lịch sử sửa giá — số lần cập nhật, chênh lệch giá cũ/mới,
     * người sửa và thời điểm, lọc được theo sân.
     */
    public function priceHistory(Request $request)
    {
        $query = CourtPriceHistory::with(['court:id,name', 'changedBy:id,full_name'])
            ->orderByDesc('created_at');

        if ($request->filled('court_id')) {
            $query->where('court_id', $request->court_id);
        }

        $histories = $query->limit(200)->get()->map(fn($h) => [
            'id'          => $h->id,
            'court_name'  => $h->court?->name ?? '—',
            'old_price'   => $h->old_price,
            'new_price'   => $h->new_price,
            'diff'        => ($h->new_price !== null && $h->old_price !== null) ? $h->new_price - $h->old_price : null,
            'action'      => $h->action,
            'note'        => $h->note,
            'changed_by'  => $h->changedBy?->full_name ?? '—',
            'created_at'  => $h->created_at?->format('d/m/Y H:i'),
        ]);

        // Thống kê tổng quan: số lần sửa giá theo sân
        $summary = CourtPriceHistory::select('court_id', DB::raw('COUNT(*) as change_count'))
            ->groupBy('court_id')
            ->with('court:id,name')
            ->get()
            ->map(fn($s) => [
                'court_name'   => $s->court?->name ?? '—',
                'change_count' => (int) $s->change_count,
            ]);

        return response()->json([
            'status'  => 'success',
            'data'    => $histories,
            'summary' => $summary,
        ]);
    }

    /** Chức năng: Tính thử giá thuê sân theo sân, ngày và khung giờ khách chọn. */
    public function calculatePrice(Request $request)
    {
        $validated = $request->validate([
            'court_id'   => ['required', 'exists:courts,id'],
            'date'       => ['required', 'date'],
            'start_time' => ['required', 'date_format:H:i'],
            'end_time'   => ['required', 'date_format:H:i', 'after:start_time'],
        ]);

        $bookingDate = $validated['date'];
        $dayOfWeek   = date('N', strtotime($bookingDate));
        $dayType     = ($dayOfWeek >= 6) ? 'weekend' : 'weekday';

        $pricings = CourtPricing::where('court_id', $validated['court_id'])
            ->where('day_type', $dayType)
            ->where(function ($q) use ($bookingDate) {
                $q->whereNull('effective_from')->orWhere('effective_from', '<=', $bookingDate);
            })
            ->where(function ($q) use ($bookingDate) {
                $q->whereNull('effective_to')->orWhere('effective_to', '>=', $bookingDate);
            })
            ->orderByRaw('effective_from DESC')
            ->get();

        $totalPrice  = 0;
        $details     = [];
        $filledSlots = [];

        foreach ($pricings as $pricing) {
            $dbStart = substr($pricing->start_time, 0, 5);
            $dbEnd   = substr($pricing->end_time, 0, 5);

            $overlapStart = max($validated['start_time'], $dbStart);
            $overlapEnd   = min($validated['end_time'], $dbEnd);

            if ($overlapStart >= $overlapEnd) {
                continue;
            }

            $slotKey = $overlapStart . '-' . $overlapEnd;

            if (isset($filledSlots[$slotKey])) {
                continue;
            }

            $minutes     = (strtotime($overlapEnd) - strtotime($overlapStart)) / 60;
            $amount      = ($minutes / 60) * $pricing->price;
            $totalPrice += $amount;

            $details[]         = [
                'khung_gia'  => "$dbStart - $dbEnd",
                'loai_gia'   => $pricing->effective_from ? 'Giá thời vụ' : 'Giá mặc định',
                'thanh_tien' => round($amount, 2),
            ];
            $filledSlots[$slotKey] = true;
        }

        return response()->json([
            'status'      => 'success',
            'total_price' => round($totalPrice, 2),
            'details'     => $details,
        ]);
    }

    /** Chức năng: Trả bảng giá public của một sân cho frontend khách hàng. */
    public function getPublicPricing($courtId)
    {
        $pricings = CourtPricing::where('court_id', $courtId)
            ->orderBy('day_type')
            ->orderBy('start_time')
            ->get();

        return response()->json(['status' => 'success', 'data' => $pricings]);
    }

    /**
     * Chức năng: Trả về bảng giá tổng hợp cho trang chủ.
     * Gom nhóm theo day_type + khung giờ, lấy giá cao nhất trong nhóm (đại diện cho tất cả sân).
     * Kết quả: { weekday: [...slots], weekend: [...slots], holiday: [...slots] }
     */
    public function getPublicAllPricings()
    {
        $rows = CourtPricing::selectRaw('day_type, start_time, end_time, MAX(price) as price')
            ->groupBy('day_type', 'start_time', 'end_time')
            ->orderBy('day_type')
            ->orderBy('start_time')
            ->get();

        $grouped = ['weekday' => [], 'weekend' => [], 'holiday' => []];
        foreach ($rows as $row) {
            $grouped[$row->day_type][] = [
                'start_time' => substr($row->start_time, 0, 5),
                'end_time'   => substr($row->end_time,   0, 5),
                'price'      => (float) $row->price,
            ];
        }

        return response()->json(['status' => 'success', 'data' => $grouped]);
    }
}
