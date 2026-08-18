<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\CourtPricing;
use App\Models\CourtPriceHistory;
use App\Services\CourtPricingResolver;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CourtPricingController extends Controller
{
    private const DAY_TYPES = ['weekday', 'weekend', 'holiday'];
    private const MIN_BOOKING_MINUTES = 30;

    public function __construct(private CourtPricingResolver $pricingResolver)
    {
    }

    // lay danh sach bang gia chung (ap dung cho tat ca san)
    public function index()
    {
        $pricings = CourtPricing::orderBy('day_type')
            ->orderBy('start_time')
            ->get();

        return response()->json([
            'message' => 'Danh sách bảng giá theo khung giờ',
            'data'    => $pricings,
        ]);
    }

    // tao moi mot khung gia chung
    public function store(Request $request)
    {
        $validated = $request->validate([
            'day_type'            => ['required', 'in:' . implode(',', self::DAY_TYPES)],
            'start_time'          => ['required', 'date_format:H:i', 'before:end_time'],
            'end_time'            => ['required', 'date_format:H:i'],
            'price'               => ['required', 'numeric', 'min:0'],
            'effective_from'      => ['nullable', 'date'],
            'effective_to'        => ['nullable', 'date', 'after_or_equal:effective_from'],
            'min_booking_minutes' => ['integer', 'min:' . self::MIN_BOOKING_MINUTES],
        ]);

        $pricing = CourtPricing::create($validated);

        CourtPriceHistory::create([
            'court_pricing_id' => $pricing->id,
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

    // lay chi tiet mot cau hinh gia
    public function show($id)
    {
        return response()->json(['data' => CourtPricing::findOrFail($id)]);
    }

    // cap nhat mot khung gia chung
    public function update(Request $request, $id)
    {
        $pricing = CourtPricing::findOrFail($id);

        $validated = $request->validate([
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

        if ((float) $validated['price'] !== $oldPrice) {
            CourtPriceHistory::create([
                'court_pricing_id' => $pricing->id,
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

    // xoa mot khung gia
    public function destroy($id)
    {
        $pricing = CourtPricing::findOrFail($id);

        CourtPriceHistory::create([
            'court_pricing_id' => $pricing->id,
            'old_price'        => (float) $pricing->price,
            'new_price'        => null,
            'action'           => 'delete',
            'note'             => "{$pricing->day_type} " . substr($pricing->start_time, 0, 5) . '-' . substr($pricing->end_time, 0, 5),
            'changed_by'       => request()->user()?->id,
        ]);

        $pricing->delete();

        return response()->json(['message' => 'Đã xóa cấu hình giá khỏi hệ thống']);
    }

    // tao hoac cap nhat mot moc gia chung trong 1 transaction
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
        $entryIds = $validated['entry_ids'] ?? [];
        $note     = "{$validated['day_type']} {$validated['start_time']}-{$validated['end_time']}";

        if ($conflict = $this->findOverlappingGroup($validated, $entryIds)) {
            $cs = substr($conflict->start_time, 0, 5);
            $ce = substr($conflict->end_time, 0, 5);
            return response()->json([
                'message' => "Khung giờ bị chồng với mốc giá {$cs}-{$ce} đã có. Vui lòng sửa hoặc xóa mốc đó trước.",
            ], 422);
        }

        $result = DB::transaction(function () use ($validated, $entryIds, $userId, $note) {
            // Chế độ sửa: cập nhật bản ghi đã chỉ định
            if (!empty($entryIds)) {
                $pricing = CourtPricing::whereIn('id', $entryIds)->firstOrFail();
                $this->applyRowUpdate($pricing, $validated, $userId, $note);
                return ['created' => 0, 'updated' => 1];
            }

            // Chế độ tạo: tìm bản ghi trùng khóa để upsert, hoặc tạo mới
            $existing = CourtPricing::where('day_type', $validated['day_type'])
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
                return ['created' => 0, 'updated' => 1];
            }

            $pricing = CourtPricing::create([
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
                'old_price'        => null,
                'new_price'        => $pricing->price,
                'action'           => 'create',
                'note'             => $note,
                'changed_by'       => $userId,
            ]);

            return ['created' => 1, 'updated' => 0];
        });

        return response()->json([
            'message' => $result['created'] ? 'Đã tạo mốc giá mới' : 'Đã cập nhật mốc giá',
            'data'    => $result,
        ]);
    }

    // xoa mot hoac nhieu moc gia
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

        return response()->json(['message' => "Đã xóa {$deleted} mốc giá"]);
    }

    // tim moc gia da co bi chong khung gio voi moc dang luu
    private function findOverlappingGroup(array $validated, array $entryIds): ?CourtPricing
    {
        $newStart = $validated['start_time'] . ':00';
        $newEnd   = $validated['end_time'] . ':00';
        $from     = $validated['effective_from'] ?? null;
        $to       = $validated['effective_to'] ?? null;

        $query = CourtPricing::where('day_type', $validated['day_type'])
            ->where('start_time', '<', $newEnd)
            ->where('end_time', '>', $newStart)
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

    // cap nhat 1 ban ghi gia, ghi lich su khi gia doi
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
                'old_price'        => $oldPrice,
                'new_price'        => (float) $validated['price'],
                'action'           => 'update',
                'note'             => $note,
                'changed_by'       => $userId,
            ]);
        }
    }

    // lich su sua gia — bien dong gia, nguoi sua, thoi diem
    public function priceHistory(Request $request)
    {
        $histories = CourtPriceHistory::with(['changedBy:id,full_name'])
            ->orderByDesc('created_at')
            ->limit(200)
            ->get()
            ->map(fn($h) => [
                'id'         => $h->id,
                'old_price'  => $h->old_price,
                'new_price'  => $h->new_price,
                'diff'       => ($h->new_price !== null && $h->old_price !== null) ? $h->new_price - $h->old_price : null,
                'action'     => $h->action,
                'note'       => $h->note,
                'changed_by' => $h->changedBy?->full_name ?? '—',
                'created_at' => $h->created_at?->format('d/m/Y H:i'),
            ]);

        $totalChanges = CourtPriceHistory::count();

        return response()->json([
            'status'  => 'success',
            'data'    => $histories,
            'summary' => [['label' => 'Tổng thay đổi', 'change_count' => $totalChanges]],
        ]);
    }

    // tinh thu gia theo ngay va khung gio khach chon
    public function calculatePrice(Request $request)
    {
        $validated = $request->validate([
            'date'       => ['required', 'date'],
            'start_time' => ['required', 'date_format:H:i'],
            'end_time'   => ['required', 'date_format:H:i', 'after:start_time'],
        ]);

        $calculation = $this->pricingResolver->calculate(
            $validated['date'],
            $validated['start_time'],
            $validated['end_time']
        );

        return response()->json([
            'status'      => 'success',
            'total_price' => $calculation['total_price'],
            'details'     => $calculation['details'],
        ]);
    }

    // tra bang gia public (dung cho trang chi tiet san)
    public function getPublicPricing($courtId = null)
    {
        $pricings = CourtPricing::orderBy('day_type')
            ->orderBy('start_time')
            ->get();

        return response()->json(['status' => 'success', 'data' => $pricings]);
    }

    // bang gia tong hop cho trang chu
    public function getPublicAllPricings()
    {
        $rows = CourtPricing::whereNull('effective_from')
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
