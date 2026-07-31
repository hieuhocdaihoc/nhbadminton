<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\BookingIntent;
use App\Models\MembershipCard;
use App\Models\MembershipCardUsage;
use App\Models\MembershipPackage;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class MembershipController extends Controller
{
    // ═══════════════════════════════════════════════════════
    //  QUẢN LÝ GÓI THÀNH VIÊN
    // ═══════════════════════════════════════════════════════

    /** Danh sách gói thành viên */
    public function indexPackages()
    {
        $packages = MembershipPackage::withCount(['cards as total_cards_sold'])
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['status' => 'success', 'data' => $packages]);
    }

    /** Tạo gói mới */
    public function storePackage(Request $request)
    {
        $validated = $request->validate([
            'name'              => ['required', 'string', 'max:100'],
            'description'       => ['nullable', 'string'],
            'total_sessions'    => ['required', 'integer', 'min:1'],
            'duration_days'     => ['required', 'integer', 'min:1'],
            'price'             => ['required', 'numeric', 'min:0'],
            'price_per_session' => ['required', 'numeric', 'min:0'],
            'status'            => ['in:active,inactive'],
        ]);

        $package = MembershipPackage::create($validated);

        return response()->json(['status' => 'success', 'data' => $package], 201);
    }

    /** Cập nhật gói */
    public function updatePackage(Request $request, $id)
    {
        $package = MembershipPackage::findOrFail($id);

        $validated = $request->validate([
            'name'              => ['required', 'string', 'max:100'],
            'description'       => ['nullable', 'string'],
            'total_sessions'    => ['required', 'integer', 'min:1'],
            'duration_days'     => ['required', 'integer', 'min:1'],
            'price'             => ['required', 'numeric', 'min:0'],
            'price_per_session' => ['required', 'numeric', 'min:0'],
            'status'            => ['in:active,inactive'],
        ]);

        $package->update($validated);

        return response()->json(['status' => 'success', 'data' => $package]);
    }

    /** Xóa gói (chỉ khi chưa có thẻ nào được tạo) */
    public function destroyPackage($id)
    {
        $package = MembershipPackage::findOrFail($id);
        $hasPendingPurchase = BookingIntent::where('booking_type', 'membership')
            ->where('payload->package_id', $package->id)
            ->where('expires_at', '>', now())
            ->get()
            ->contains(fn (BookingIntent $intent) =>
                ($intent->payload['membership_status'] ?? 'pending') === 'pending'
            );

        if (
            $package->cards()->exists()
            || $hasPendingPurchase
        ) {
            return response()->json([
                'message' => 'Không thể xóa gói đã có thẻ hoặc phiên mua. Hãy chuyển sang ngưng bán.',
            ], 422);
        }

        $package->delete();

        return response()->json(['message' => 'Đã xóa gói thành viên.']);
    }

    // ═══════════════════════════════════════════════════════
    //  QUẢN LÝ THẺ THÀNH VIÊN
    // ═══════════════════════════════════════════════════════

    /** Danh sách tất cả thẻ + tìm kiếm */
    public function indexCards(Request $request)
    {
        // Đồng bộ thẻ hết hạn theo thời gian trước khi liệt kê
        MembershipCard::where('status', 'active')
            ->where('valid_to', '<', today())
            ->update(['status' => 'expired']);

        $query = MembershipCard::with(['user:id,full_name,phone', 'package:id,name'])
            ->orderByDesc('created_at');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('card_code', 'like', "%$s%")
                  ->orWhereHas('user', fn($u) => $u->where('full_name', 'like', "%$s%")->orWhere('phone', 'like', "%$s%"));
            });
        }

        $cards = $query->get()->map(fn($c) => $this->formatCard($c));

        // Thống kê
        $summary = [
            'total'           => MembershipCard::count(),
            'active'          => MembershipCard::where('status', 'active')->count(),
            'expired'         => MembershipCard::where('status', 'expired')->count(),
            'depleted'        => MembershipCard::where('status', 'depleted')->count(),
            'pending_payment' => MembershipCard::where('status', 'pending_payment')->count(),
        ];

        return response()->json(['status' => 'success', 'data' => $cards, 'summary' => $summary]);
    }

    /** Chi tiết thẻ + lịch sử dùng ca */
    public function showCard($id)
    {
        $card = MembershipCard::with(['user:id,full_name,phone,email', 'package:id,name', 'usages.booking:id,booking_code'])
            ->findOrFail($id);

        return response()->json(['status' => 'success', 'data' => $this->formatCard($card, true)]);
    }

    /**
     * Admin tạo thẻ cho khách (sau khi đã nhận tiền mặt / xác nhận chuyển khoản).
     * Mỗi khách chỉ được có 1 thẻ active tại 1 thời điểm.
     */
    public function storeCard(Request $request)
    {
        $validated = $request->validate([
            'user_id'         => ['required', 'exists:users,id'],
            'package_id'      => ['required', 'exists:membership_packages,id'],
            'payment_channel' => ['required', 'in:cash,bank_transfer'],
            'payment_confirmed' => ['required', 'accepted'],
            'note'            => ['nullable', 'string', 'max:1000'],
        ]);

        $adminId = $request->user()?->id;
        [$card, $package] = DB::transaction(function () use ($validated, $adminId) {
            DB::table('users')
                ->where('id', $validated['user_id'])
                ->lockForUpdate()
                ->first();

            $user = User::findOrFail($validated['user_id']);
            $package = MembershipPackage::where('status', 'active')
                ->findOrFail($validated['package_id']);

            MembershipCard::where('user_id', $user->id)
                ->where('status', 'active')
                ->where('valid_to', '<', today())
                ->update(['status' => 'expired']);

            $existing = MembershipCard::where('user_id', $user->id)
                ->whereIn('status', ['active', 'pending_payment'])
                ->lockForUpdate()
                ->first();

            if ($existing) {
                throw new HttpResponseException(response()->json([
                    'message' => "Khách {$user->full_name} đang có thẻ {$existing->card_code} còn hiệu lực. Không thể tạo thêm.",
                ], 422));
            }

            $pendingOnlineIntent = BookingIntent::where('booking_type', 'membership')
                ->where('payload->user_id', $user->id)
                ->where('expires_at', '>', now())
                ->lockForUpdate()
                ->get()
                ->first(fn (BookingIntent $intent) =>
                    ($intent->payload['membership_status'] ?? 'pending') === 'pending'
                );

            if ($pendingOnlineIntent) {
                throw new HttpResponseException(response()->json([
                    'message' => "Khách đang có phiên tự mua {$pendingOnlineIntent->intent_code}. "
                        . 'Hãy yêu cầu khách đóng phiên này trước khi cấp thẻ thủ công.',
                ], 422));
            }

            $card = MembershipCard::create([
                'card_code'         => $this->generateCardCode(),
                'user_id'           => $user->id,
                'package_id'        => $package->id,
                'total_sessions'    => $package->total_sessions,
                'used_sessions'     => 0,
                'valid_from'        => today(),
                'valid_to'          => today()->addDays(max(1, $package->duration_days) - 1),
                'price'             => $package->price,
                'price_per_session' => $package->price_per_session,
                'status'            => 'active',
                'created_by'        => $adminId,
                'note'              => $validated['note'] ?? null,
            ]);

            $channelLabel = $validated['payment_channel'] === 'cash'
                ? 'tiền mặt'
                : 'chuyển khoản ngoài hệ thống';

            Payment::create([
                'payment_code'   => 'CARD-' . strtoupper(Str::random(8)),
                'booking_id'     => null,
                'user_id'        => $user->id,
                'payment_method' => 'membership_card',
                'amount'         => $package->price,
                'paid_at'        => now(),
                'status'         => 'success',
                'bank_gateway'   => $validated['payment_channel'] === 'cash'
                    ? 'MANUAL_CASH'
                    : 'MANUAL_BANK_TRANSFER',
                'payment_content' => "Admin xác nhận mua thẻ {$card->card_code} bằng {$channelLabel}"
                    . (!empty($validated['note']) ? ": {$validated['note']}" : ''),
            ]);

            return [$card, $package];
        });

        return response()->json([
            'status'  => 'success',
            'message' => "Đã tạo và kích hoạt thẻ {$card->card_code}; doanh thu "
                . number_format($package->price) . 'đ đã được ghi nhận.',
            'data'    => $this->formatCard($card->load(['user:id,full_name,phone', 'package:id,name'])),
        ], 201);
    }

    /**
     * Kích hoạt thẻ đã thanh toán + ghi doanh thu. Dùng chung cho 2 đường vào:
     * webhook SePay (khách tự quét QR mua gói) và admin bấm tay (thu tiền mặt tại quầy).
     * Hạn thẻ tính từ ngày kích hoạt — không phải ngày tạo — để khách không mất ngày chờ.
     */
    public static function activatePaidCard(MembershipCard $card, array $paymentInfo = []): void
    {
        DB::transaction(function () use ($card, $paymentInfo) {
            $durationDays = $card->package?->duration_days
                ?? ($card->valid_from && $card->valid_to
                    ? $card->valid_from->diffInDays($card->valid_to) + 1
                    : 30);

            $card->update([
                'status'     => 'active',
                'valid_from' => today(),
                'valid_to'   => today()->addDays($durationDays - 1),
            ]);

            // Doanh thu bán thẻ ghi 1 lần duy nhất tại đây. Method riêng 'membership_card'
            // để dashboard tách được tiền bán thẻ với tiền đặt sân.
            Payment::create([
                'payment_code'         => 'CARD-' . strtoupper(Str::random(8)),
                'booking_id'           => null,
                'user_id'              => $card->user_id,
                'payment_method'       => 'membership_card',
                'amount'               => $card->price,
                'paid_at'              => $paymentInfo['paid_at'] ?? now(),
                'status'               => 'success',
                'sepay_transaction_id' => $paymentInfo['sepay_transaction_id'] ?? null,
                'bank_gateway'         => $paymentInfo['bank_gateway'] ?? null,
                'reference_code'       => $paymentInfo['reference_code'] ?? null,
                'payment_content'      => $paymentInfo['payment_content'] ?? "Mua thẻ thành viên {$card->card_code}",
            ]);
        });
    }

    /** Admin kích hoạt thẻ đang chờ thanh toán (thu tiền mặt tại quầy) */
    public function activateCard(Request $request, $id)
    {
        $card = MembershipCard::findOrFail($id);

        if ($card->status !== 'pending_payment') {
            return response()->json(['message' => 'Thẻ không ở trạng thái chờ thanh toán.'], 422);
        }

        self::activatePaidCard($card);

        return response()->json(['status' => 'success', 'message' => "Đã kích hoạt thẻ {$card->card_code} và ghi nhận doanh thu " . number_format($card->price) . "đ."]);
    }

    /** Admin hủy thẻ */
    public function cancelCard(Request $request, $id)
    {
        $card = MembershipCard::findOrFail($id);

        if (in_array($card->status, ['expired', 'depleted', 'cancelled'])) {
            return response()->json(['message' => 'Thẻ này đã kết thúc, không cần hủy.'], 422);
        }

        $card->update(['status' => 'cancelled']);

        return response()->json(['status' => 'success', 'message' => "Đã hủy thẻ {$card->card_code}."]);
    }

    /**
     * Trừ ca khi admin hoàn thành đơn đặt sân có dùng thẻ.
     * Được gọi từ BookingController khi bấm Hoàn thành.
     * Trả về thông tin để frontend hiện popup xác nhận.
     */
    public static function deductSessions(MembershipCard $card, string $bookingId, int $sessions, string $note = ''): array
    {
        $card->increment('used_sessions', $sessions);

        MembershipCardUsage::create([
            'card_id'           => $card->id,
            'booking_id'        => $bookingId,
            'sessions_deducted' => $sessions,
            'note'              => $note,
        ]);

        // Kiểm tra thẻ đã hết ca chưa
        $card->refresh();
        if ($card->used_sessions >= $card->total_sessions) {
            $card->update(['status' => 'depleted']);
        }

        return [
            'card_code'          => $card->card_code,
            'sessions_deducted'  => $sessions,
            'remaining_sessions' => $card->remainingSessions(),
            'card_status'        => $card->status,
        ];
    }

    /** Format card cho response */
    private function formatCard(MembershipCard $card, bool $withUsages = false): array
    {
        $data = [
            'id'                 => $card->id,
            'card_code'          => $card->card_code,
            'user_name'          => $card->user?->full_name ?? '—',
            'user_phone'         => $card->user?->phone ?? '—',
            'package_name'       => $card->package?->name ?? '—',
            'total_sessions'     => $card->total_sessions,
            'used_sessions'      => $card->used_sessions,
            'remaining_sessions' => $card->remainingSessions(),
            'valid_from'         => $card->valid_from?->format('d/m/Y'),
            'valid_to'           => $card->valid_to?->format('d/m/Y'),
            'price'              => $card->price,
            'price_per_session'  => $card->price_per_session,
            'status'             => $card->status,
            'note'               => $card->note,
            'created_at'         => $card->created_at?->format('d/m/Y H:i'),
        ];

        if ($withUsages) {
            $data['usages'] = $card->usages->map(fn($u) => [
                'booking_code'      => $u->booking?->booking_code ?? '—',
                'sessions_deducted' => $u->sessions_deducted,
                'used_at'           => $u->used_at?->format('d/m/Y H:i'),
                'note'              => $u->note,
            ]);
        }

        return $data;
    }

    /** Sinh mã thẻ tự động: CARD-YYYY-NNN */
    private function generateCardCode(): string
    {
        $year  = now()->year;
        $count = MembershipCard::whereYear('created_at', $year)->count() + 1;
        return 'CARD-' . $year . '-' . str_pad($count, 3, '0', STR_PAD_LEFT);
    }
}
