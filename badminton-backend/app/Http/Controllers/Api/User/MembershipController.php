<?php

namespace App\Http\Controllers\Api\User;

use App\Http\Controllers\Controller;
use App\Models\BookingIntent;
use App\Models\MembershipCard;
use App\Models\MembershipPackage;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class MembershipController extends Controller
{
    // danh sach goi dang ban de khach xem va chon mua
    public function packages()
    {
        $packages = MembershipPackage::where('status', 'active')
            ->orderBy('price')
            ->get(['id', 'name', 'description', 'total_sessions', 'duration_days', 'price', 'price_per_session']);

        return response()->json(['status' => 'success', 'data' => $packages]);
    }

    // the cua khach dang dang nhap
    public function myCard(Request $request)
    {
        $card = MembershipCard::with('package:id,name')
            ->where('user_id', $request->user()->id)
            ->where('status', 'active')
            ->latest()
            ->first();

        if (!$card) {
            return response()->json(['status' => 'success', 'data' => null]);
        }

        // Hết hạn theo thời gian → tự chuyển expired khi khách xem
        $card->syncExpiryStatus();

        return response()->json([
            'status' => 'success',
            'data'   => $this->formatCard($card),
        ]);
    }

    // khach chon goi: chi tao intent + QR, chua cap the thanh vien
    public function purchase(Request $request)
    {
        $validated = $request->validate([
            'package_id' => ['required', 'exists:membership_packages,id'],
        ]);

        $user = $request->user();
        $package = MembershipPackage::where('status', 'active')->findOrFail($validated['package_id']);

        $intent = DB::transaction(function () use ($user, $package) {
            DB::table('users')->where('id', $user->id)->lockForUpdate()->first();

            MembershipCard::where('user_id', $user->id)
                ->where('status', 'active')
                ->where('valid_to', '<', today())
                ->update(['status' => 'expired']);

            $activeCard = MembershipCard::where('user_id', $user->id)
                ->where('status', 'active')
                ->first();
            if ($activeCard) {
                throw new HttpResponseException(response()->json([
                    'status' => 'error',
                    'message' => "Bạn đang dùng thẻ {$activeCard->card_code}. Chỉ được giữ một gói tại một thời điểm.",
                ], 422));
            }

            $membershipIntents = BookingIntent::where('booking_type', 'membership')
                ->where('payload->user_id', $user->id)
                ->latest()
                ->lockForUpdate()
                ->get();

            foreach ($membershipIntents as $candidate) {
                if ($this->intentStatus($candidate) === 'pending' && $candidate->expires_at->isPast()) {
                    $this->updateIntentPayload($candidate, ['membership_status' => 'expired']);
                }
            }

            $existingIntent = $membershipIntents->first(
                fn (BookingIntent $candidate) =>
                    $this->intentStatus($candidate) === 'pending'
                    && $candidate->expires_at->isFuture()
            );

            if ($existingIntent && ($existingIntent->payload['package_id'] ?? null) === $package->id) {
                return $existingIntent;
            }

            if ($existingIntent) {
                $this->updateIntentPayload($existingIntent, ['membership_status' => 'cancelled']);
            }

            // Không cho thẻ chờ theo cơ chế cũ tiếp tục xuất hiện như thẻ đã cấp.
            MembershipCard::where('user_id', $user->id)
                ->where('status', 'pending_payment')
                ->update(['status' => 'cancelled']);

            return BookingIntent::create([
                'id' => (string) Str::uuid(),
                'intent_code' => $this->generateIntentCode(),
                'payload' => [
                    'user_id' => $user->id,
                    'package_id' => $package->id,
                    'package_name' => $package->name,
                    'total_sessions' => $package->total_sessions,
                    'duration_days' => $package->duration_days,
                    'price_per_session' => $package->price_per_session,
                    'membership_status' => 'pending',
                ],
                'amount' => $package->price,
                'booking_type' => 'membership',
                'expires_at' => now()->addMinutes(30),
            ]);
        });

        return response()->json([
            'status'  => 'success',
            'message' => 'Vui lòng quét mã QR để hoàn tất thanh toán.',
            'data'    => $this->formatIntent($intent),
            'payment' => $this->buildIntentQr($intent),
        ], 201);
    }

    // frontend hoi lien tuc sau khi hien QR: intent da duoc thanh toan chua
    public function purchaseStatus(Request $request, $intentCode)
    {
        $intent = BookingIntent::where('booking_type', 'membership')
            ->where('intent_code', strtoupper($intentCode))
            ->first();

        if (!$intent || ($intent->payload['user_id'] ?? null) !== $request->user()->id) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy phiên mua gói.'], 404);
        }

        $status = $this->intentStatus($intent);
        if ($status === 'pending' && $intent->expires_at->isPast()) {
            $status = 'expired';
            $this->updateIntentPayload($intent, ['membership_status' => $status]);
        }

        $card = $status === 'paid'
            ? MembershipCard::with('package:id,name')->find($intent->payload['card_id'] ?? null)
            : null;

        return response()->json([
            'status' => 'success',
            'data'   => [
                'paid' => $status === 'paid' && $card !== null,
                'status' => $status,
                'card' => $card ? $this->formatCard($card) : null,
            ],
        ]);
    }

    // khach huy don mua goi khi chua thanh toan
    public function cancelPurchase(Request $request, $intentCode)
    {
        $intent = BookingIntent::where('booking_type', 'membership')
            ->where('intent_code', strtoupper($intentCode))
            ->first();

        if (
            !$intent
            || ($intent->payload['user_id'] ?? null) !== $request->user()->id
            || $this->intentStatus($intent) !== 'pending'
        ) {
            return response()->json(['status' => 'error', 'message' => 'Không tìm thấy đơn mua gói đang chờ.'], 404);
        }

        // Không xóa intent ngay: nếu khách vừa chuyển tiền rồi đóng modal trước khi
        // webhook tới, mã MEM vẫn phải còn để hệ thống cấp thẻ hoặc hoàn tiền.
        $this->updateIntentPayload($intent, ['membership_status' => 'cancelled']);

        return response()->json(['status' => 'success', 'message' => 'Đã đóng phiên thanh toán.']);
    }

    // thong tin QR chuyen khoan, noi dung CK la ma intent de webhook nhan dien
    private function buildIntentQr(BookingIntent $intent): array
    {
        $bankName        = config('services.sepay.bank_name');
        $bankAccount     = config('services.sepay.bank_account');
        $accountHolder   = config('services.sepay.account_holder');
        $transferContent = $intent->intent_code;

        return [
            'amount'           => (float) $intent->amount,
            'bank_name'        => $bankName,
            'bank_account'     => $bankAccount,
            'account_holder'   => $accountHolder,
            'transfer_content' => $transferContent,
            'qr_url'           => 'https://qr.sepay.vn/img?' . http_build_query([
                'acc'    => $bankAccount,
                'bank'   => $bankName,
                'amount' => $intent->amount,
                'des'    => $transferContent,
            ]),
        ];
    }

    // sinh ma phien mua the (MEM...) khong trung voi ma da co
    private function generateIntentCode(): string
    {
        do {
            $code = 'MEM' . strtoupper(Str::random(9));
        } while (BookingIntent::where('intent_code', $code)->exists());

        return $code;
    }

    // dinh dang thong tin phien mua the de tra ve cho frontend
    private function formatIntent(BookingIntent $intent): array
    {
        return [
            'intent_code' => $intent->intent_code,
            'package_id' => $intent->payload['package_id'] ?? null,
            'package_name' => $intent->payload['package_name'] ?? null,
            'amount' => (float) $intent->amount,
            'status' => $this->intentStatus($intent),
            'expires_at' => $intent->expires_at,
        ];
    }

    // doc trang thai mua the luu trong payload cua phien
    private function intentStatus(BookingIntent $intent): string
    {
        return $intent->payload['membership_status'] ?? 'pending';
    }

    // cap nhat mot phan du lieu payload cua phien mua the
    private function updateIntentPayload(BookingIntent $intent, array $changes): void
    {
        $intent->payload = array_merge($intent->payload ?? [], $changes);
        $intent->save();
    }

    // dinh dang thong tin the (so ca con lai, so ca dang giu cho) de tra ve frontend
    private function formatCard(MembershipCard $card): array
    {
        $remainingSessions = $card->remainingSessions();
        $committedSessions = $card->committedSessions();
        $availableSessions = max(0, $remainingSessions - $committedSessions);

        return [
            'id'                 => $card->id,
            'card_code'          => $card->card_code,
            'package_id'         => $card->package_id,
            'package_name'       => $card->package?->name,
            'total_sessions'     => $card->total_sessions,
            'used_sessions'      => $card->used_sessions,
            'remaining_sessions' => $remainingSessions,
            'committed_sessions' => $committedSessions,
            'available_sessions' => $availableSessions,
            'valid_from'         => $card->valid_from?->format('d/m/Y'),
            'valid_to'           => $card->valid_to?->format('d/m/Y'),
            'valid_to_iso'       => $card->valid_to?->format('Y-m-d'),
            'price'              => $card->price,
            'price_per_session'  => $card->price_per_session,
            'status'             => $card->status,
            // Cảnh báo sắp hết để frontend hiển thị nhắc nhở khách
            'near_depletion'     => $card->status === 'active' && $availableSessions > 0 && $availableSessions <= 3,
            'near_expiry'        => $card->status === 'active' && $card->valid_to
                ? today()->diffInDays($card->valid_to, false) >= 0 && today()->diffInDays($card->valid_to, false) <= 3
                : false,
            'days_left'          => $card->valid_to ? max(0, (int) today()->diffInDays($card->valid_to, false)) : null,
        ];
    }
}
