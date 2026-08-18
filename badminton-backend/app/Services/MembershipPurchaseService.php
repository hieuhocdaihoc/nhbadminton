<?php

namespace App\Services;

use App\Models\BookingIntent;
use App\Models\MembershipCard;
use App\Models\MembershipPackage;
use App\Models\Payment;
use DomainException;
use Illuminate\Support\Facades\DB;

class MembershipPurchaseService
{
    // hoan tat mua the sau khi tien ve: tao the, kich hoat va ghi nhan doanh thu
    public function complete(BookingIntent $intent, array $paymentInfo = []): MembershipCard
    {
        return DB::transaction(function () use ($intent, $paymentInfo) {
            $lockedIntent = BookingIntent::where('booking_type', 'membership')
                ->whereKey($intent->id)
                ->lockForUpdate()
                ->firstOrFail();

            $snapshot = $lockedIntent->payload ?? [];
            $intentStatus = $snapshot['membership_status'] ?? 'pending';
            if ($intentStatus === 'paid') {
                $paidCard = MembershipCard::find($snapshot['card_id'] ?? null);
                if ($paidCard) {
                    return $paidCard;
                }
            }

            if (!in_array($intentStatus, ['pending', 'cancelled', 'expired'], true)) {
                throw new DomainException('Intent mua gói không còn có thể thanh toán.');
            }

            $userId = $snapshot['user_id'] ?? null;
            $packageId = $snapshot['package_id'] ?? null;
            if (!$userId || !$packageId) {
                throw new DomainException('Intent mua gói thiếu thông tin khách hoặc gói.');
            }

            MembershipCard::where('user_id', $userId)
                ->where('status', 'active')
                ->where('valid_to', '<', today())
                ->update(['status' => 'expired']);

            $activeCard = MembershipCard::where('user_id', $userId)
                ->where('status', 'active')
                ->lockForUpdate()
                ->first();

            if ($activeCard) {
                throw new DomainException("Khách đã có thẻ {$activeCard->card_code} đang hoạt động.");
            }

            $package = MembershipPackage::find($packageId);
            if (!$package || empty($snapshot)) {
                throw new DomainException('Gói thành viên của intent không còn hợp lệ.');
            }

            // Dọn thẻ chờ kiểu cũ nếu người dùng đã tạo trước khi hệ thống chuyển sang intent.
            MembershipCard::where('user_id', $userId)
                ->where('status', 'pending_payment')
                ->update(['status' => 'cancelled']);

            $otherIntents = BookingIntent::where('booking_type', 'membership')
                ->where('payload->user_id', $userId)
                ->where('id', '!=', $lockedIntent->id)
                ->lockForUpdate()
                ->get();
            foreach ($otherIntents as $otherIntent) {
                $otherPayload = $otherIntent->payload ?? [];
                if (($otherPayload['membership_status'] ?? 'pending') === 'pending') {
                    $otherPayload['membership_status'] = 'cancelled';
                    $otherIntent->payload = $otherPayload;
                    $otherIntent->save();
                }
            }

            $durationDays = max(1, (int) ($snapshot['duration_days'] ?? $package->duration_days));
            $card = MembershipCard::create([
                'card_code' => $this->generateCardCode(),
                'user_id' => $userId,
                'package_id' => $packageId,
                'total_sessions' => (int) ($snapshot['total_sessions'] ?? $package->total_sessions),
                'used_sessions' => 0,
                'valid_from' => today(),
                'valid_to' => today()->addDays($durationDays - 1),
                'price' => $lockedIntent->amount,
                'price_per_session' => (float) ($snapshot['price_per_session'] ?? $package->price_per_session),
                'status' => 'active',
                'created_by' => null,
                'note' => 'Khách tự mua trên website',
            ]);

            Payment::create([
                'payment_code' => 'MEM-' . $lockedIntent->intent_code,
                'booking_id' => null,
                'user_id' => $userId,
                // Tiền mua thẻ luôn vào qua chuyển khoản/QR (giống mọi giao dịch SePay khác),
                // khớp với 3 giá trị gốc của cột (cash/bank_transfer/sepay). Phân biệt đây là
                // giao dịch mua thẻ (không phải tiền đặt sân) bằng booking_id = null, không phải
                // bằng payment_method.
                'payment_method' => 'bank_transfer',
                'amount' => $lockedIntent->amount,
                'paid_at' => $paymentInfo['paid_at'] ?? now(),
                'status' => 'success',
                'sepay_transaction_id' => $paymentInfo['sepay_transaction_id'] ?? null,
                'bank_gateway' => $paymentInfo['bank_gateway'] ?? null,
                'reference_code' => $paymentInfo['reference_code'] ?? null,
                'payment_content' => $paymentInfo['payment_content'] ?? "Mua thẻ thành viên {$card->card_code}",
            ]);

            $paidAt = $paymentInfo['paid_at'] ?? now();
            $snapshot['membership_status'] = 'paid';
            $snapshot['card_id'] = $card->id;
            $snapshot['paid_at'] = $paidAt instanceof \DateTimeInterface
                ? $paidAt->format('Y-m-d H:i:s')
                : (string) $paidAt;
            $lockedIntent->payload = $snapshot;
            $lockedIntent->expires_at = now()->addDays(7);
            $lockedIntent->save();

            return $card;
        });
    }

    // sinh ma the theo nam va so thu tu tang dan: CARD-YYYY-NNN
    private function generateCardCode(): string
    {
        $year = now()->year;
        $lastCode = MembershipCard::where('card_code', 'like', "CARD-{$year}-%")
            ->orderByDesc('card_code')
            ->lockForUpdate()
            ->value('card_code');
        $next = $lastCode ? ((int) substr($lastCode, -3)) + 1 : 1;

        do {
            $code = sprintf('CARD-%s-%03d', $year, $next++);
        } while (MembershipCard::where('card_code', $code)->exists());

        return $code;
    }
}
