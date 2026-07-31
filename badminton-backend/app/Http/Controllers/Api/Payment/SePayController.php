<?php

namespace App\Http\Controllers\Api\Payment;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\BookingIntent;
use App\Models\MembershipCard;
use App\Models\Payment;
use App\Models\RecurringBooking;
use App\Models\User;
use App\Services\MembershipPurchaseService;
use App\Services\PaymentService;
use Carbon\Carbon;
use DomainException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SePayController extends Controller
{
    /**
     * Nhận webhook thanh toán từ SePay.
     */
    /**
     * Chức năng: Nhận webhook SePay, dò mã booking, chống giao dịch trùng và ghi nhận thanh toán chuyển khoản.
     */
    public function webhook(Request $request)
    {
        $expectedApiKey = trim((string) config('services.sepay.webhook_api_key'));
        if ($expectedApiKey !== '') {
            $authorization = trim((string) $request->header('Authorization'));
            $providedApiKey = preg_replace('/^Apikey\s+/i', '', $authorization);

            if ($providedApiKey === $authorization || !hash_equals($expectedApiKey, trim($providedApiKey))) {
                return response()->json([
                    'success' => false,
                    'message' => 'Webhook khong duoc xac thuc.',
                ], 401);
            }
        }

        if ($request->transferType !== 'in') {
            return response()->json([
                'success' => true,
                'message' => 'Bỏ qua giao dịch không phải tiền vào'
            ]);
        }

        $searchText = trim(
            ($request->code ?? '') . ' ' .
            ($request->content ?? '') . ' ' .
            ($request->description ?? '') . ' ' .
            ($request->referenceCode ?? '')
        );

        // Mua gói thành viên online: intent MEM... chưa phải là thẻ. Chỉ khi tiền
        // vào đủ mới tạo thẻ active và payment trong cùng một transaction.
        preg_match('/MEM[A-Z0-9]{9}/i', $searchText, $membershipIntentMatches);
        if (!empty($membershipIntentMatches)) {
            $intentCode = strtoupper($membershipIntentMatches[0]);
            $intent = BookingIntent::where('booking_type', 'membership')
                ->where('intent_code', $intentCode)
                ->first();

            if ($intent) {
                $membershipPayload = $intent->payload ?? [];
                $membershipStatus = $membershipPayload['membership_status'] ?? 'pending';
                $paidCard = $membershipStatus === 'paid'
                    ? MembershipCard::find($membershipPayload['card_id'] ?? null)
                    : null;

                if ($membershipStatus === 'paid' && $paidCard) {
                    return response()->json([
                        'success' => true,
                        'message' => 'Gói thành viên đã được xử lý trước đó',
                        'data' => ['card_code' => $paidCard->card_code],
                    ]);
                }

                if ($membershipStatus === 'failed') {
                    return response()->json([
                        'success' => true,
                        'message' => 'Giao dịch mua gói lỗi đã được ghi phiếu hoàn tiền trước đó',
                    ]);
                }

                $paidAmount = (float) $request->transferAmount;
                if ($paidAmount <= 0) {
                    return response()->json(['success' => false, 'message' => 'Số tiền không hợp lệ'], 422);
                }
                if ($paidAmount + 0.5 < (float) $intent->amount) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Số tiền chuyển chưa đủ giá gói (' . number_format($intent->amount) . 'đ)',
                    ], 422);
                }
                if ($this->isDuplicateTransaction($request)) {
                    return response()->json(['success' => true, 'message' => 'Giao dịch đã được xử lý trước đó']);
                }

                try {
                    $card = app(MembershipPurchaseService::class)->complete($intent, [
                        'paid_at' => $request->transactionDate ?? now(),
                        'sepay_transaction_id' => $request->id ?? null,
                        'bank_gateway' => $request->gateway ?? null,
                        'reference_code' => $request->referenceCode ?? null,
                        'payment_content' => $searchText,
                    ]);
                } catch (DomainException $e) {
                    $membershipPayload['membership_status'] = 'failed';
                    $membershipPayload['failed_at'] = now()->toDateTimeString();
                    $intent->payload = $membershipPayload;
                    $intent->expires_at = now()->addDays(7);
                    $intent->save();

                    \App\Models\Refund::create([
                        'payment_id' => null,
                        'amount' => $paidAmount,
                        'reason' => "Khách đã chuyển tiền mua gói {$intentCode} nhưng không cấp được thẻ: {$e->getMessage()} Cần hoàn tiền cho khách.",
                        'refund_method' => 'bank_transfer',
                        'status' => 'recorded',
                    ]);

                    $now = now();
                    $rows = User::whereIn('role', ['admin', 'staff'])->pluck('id')
                        ->map(fn ($receiverId) => [
                            'id' => (string) Str::uuid(),
                            'receiver_id' => $receiverId,
                            'sender_id' => null,
                            'title' => 'Mua gói không cấp được thẻ',
                            'content' => "Khách đã chuyển " . number_format($paidAmount)
                                . "đ cho {$intentCode} nhưng không cấp được thẻ ({$e->getMessage()}). Đã tạo phiếu hoàn tiền.",
                            'is_read' => false,
                            'created_at' => $now,
                            'group_key' => 'membership_payfail_' . strtolower($intentCode),
                        ])->all();
                    if (!empty($rows)) {
                        \App\Models\Notification::insert($rows);
                    }

                    return response()->json([
                        'success' => true,
                        'message' => 'Đã nhận tiền nhưng không cấp được thẻ; hệ thống đã tạo phiếu hoàn tiền.',
                    ]);
                }

                return response()->json([
                    'success' => true,
                    'message' => 'Kích hoạt thẻ thành viên thành công',
                    'data' => ['card_code' => $card->card_code, 'paid_amount' => $paidAmount],
                ]);
            }
        }

        // Match mã thẻ thành viên CARD2026005 (khách tự mua gói trên website).
        // Giữ lại để tương thích với thẻ chờ được tạo trước khi chuyển sang intent.
        preg_match('/CARD[\s_-]?(\d{4})[\s_-]?(\d{3})/i', $searchText, $cardMatches);
        if (!empty($cardMatches)) {
            $cardCode = sprintf('CARD-%s-%s', $cardMatches[1], $cardMatches[2]);
            $card = MembershipCard::with('package')->where('card_code', $cardCode)->first();

            if ($card) {
                // Chỉ kích hoạt thẻ đang chờ, hoặc thẻ vừa bị hủy mà tiền mới vào (webhook trễ)
                // → khách đã chuyển tiền thì vẫn cấp thẻ, không để mất tiền.
                if (!in_array($card->status, ['pending_payment', 'cancelled'], true)) {
                    return response()->json([
                        'success' => true,
                        'message' => 'Thẻ đã được kích hoạt trước đó',
                    ]);
                }

                $paidAmount = (float) $request->transferAmount;
                if ($paidAmount + 0.5 < (float) $card->price) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Số tiền chuyển chưa đủ giá gói (' . number_format($card->price) . 'đ)',
                    ], 422);
                }

                // Chống xử lý trùng một giao dịch ngân hàng
                if ($this->isDuplicateTransaction($request)) {
                    return response()->json(['success' => true, 'message' => 'Giao dịch đã được xử lý trước đó']);
                }

                \App\Http\Controllers\Api\Admin\MembershipController::activatePaidCard($card, [
                    'paid_at'              => $request->transactionDate ?? now(),
                    'sepay_transaction_id' => $request->id ?? null,
                    'bank_gateway'         => $request->gateway ?? null,
                    'reference_code'       => $request->referenceCode ?? null,
                    'payment_content'      => $searchText,
                ]);

                return response()->json([
                    'success' => true,
                    'message' => 'Kích hoạt thẻ thành viên thành công',
                    'data'    => ['card_code' => $card->card_code, 'paid_amount' => $paidAmount],
                ]);
            }
        }

        // Ưu tiên match intent code PAY... (đặt online chưa tạo booking)
        preg_match('/PAY[A-Z0-9]{7}/i', $searchText, $intentMatches);
        if (!empty($intentMatches)) {
            $intentCode = strtoupper($intentMatches[0]);
            $intent = BookingIntent::where('intent_code', $intentCode)
                ->where('expires_at', '>', now())
                ->first();

            if ($intent) {
                $paidAmount = (float) $request->transferAmount;
                if ($paidAmount <= 0) {
                    return response()->json(['success' => false, 'message' => 'Số tiền không hợp lệ'], 422);
                }
                if ($paidAmount + 0.5 < (float) $intent->amount) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Số tiền chuyển chưa đủ cho đơn đặt sân (' . number_format($intent->amount) . 'đ)',
                    ], 422);
                }

                // Đánh dấu "đang xử lý" trước khi xóa intent, để intentStatus biết chờ
                // thay vì trả paid=true với booking_codes rỗng (race condition)
                Cache::put('intent_processing_' . $intent->intent_code, true, now()->addMinutes(2));

                // Lock: xóa intent ngay lập tức để tránh xử lý 2 lần
                $locked = BookingIntent::where('intent_code', $intent->intent_code)
                    ->where('expires_at', '>', now())
                    ->delete();

                if (!$locked) {
                    return response()->json(['success' => true, 'message' => 'Intent đã được xử lý trước đó']);
                }

                // Tạo booking TỪ NGOÀI transaction (store() tự quản lý transaction của nó)
                $bookingController = app(\App\Http\Controllers\Api\User\BookingController::class);
                $fakeRequest = \Illuminate\Http\Request::create('/bookings', 'POST', $intent->payload);
                $fakeRequest->setUserResolver(function () use ($intent) {
                    $userId = $intent->payload['user_id'] ?? null;
                    return $userId ? User::find($userId) : null;
                });
                // Đánh dấu request này đã qua xác nhận thanh toán thật (chỉ set được từ server,
                // không nằm trong payload nên client không thể tự thêm để giả mạo).
                $fakeRequest->attributes->set('is_verified_payment', true);

                try {
                    $response = $bookingController->store($fakeRequest);
                } catch (\Illuminate\Validation\ValidationException $ve) {
                    return response()->json(['success' => false, 'message' => 'Validation: ' . json_encode($ve->errors())], 422);
                } catch (\Throwable $e) {
                    return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
                }

                $responseData = json_decode($response->getContent(), true);

                if (($responseData['status'] ?? '') !== 'success') {
                    $intent->delete();

                    // Tiền khách ĐÃ VÀO nhưng không tạo được đơn (VD: khung giờ vừa bị người
                    // khác đặt mất). KHÔNG trả 500 vì SePay sẽ retry vô hạn và khách mất tiền.
                    // Thay vào đó: ghi phiếu hoàn tiền + báo admin, trả 200 để SePay dừng lại.
                    $failReason = $responseData['message'] ?? 'không rõ nguyên nhân';

                    \App\Models\Refund::create([
                        'payment_id'    => null,
                        'amount'        => $paidAmount,
                        'reason'        => 'Khách đã chuyển ' . number_format($paidAmount) . 'đ (mã ' . $intent->intent_code . ') nhưng tạo đơn thất bại: ' . $failReason . '. Cần hoàn tiền cho khách.',
                        'refund_method' => 'bank_transfer',
                        'status'        => 'recorded',
                    ]);

                    $now = now();
                    $rows = \App\Models\User::whereIn('role', ['admin', 'staff'])->pluck('id')
                        ->map(fn ($rid) => [
                            'id'          => (string) \Illuminate\Support\Str::uuid(),
                            'receiver_id' => $rid,
                            'sender_id'   => null,
                            'title'       => 'Thanh toán không tạo được đơn — cần hoàn tiền',
                            'content'     => 'Khách đã chuyển ' . number_format($paidAmount) . 'đ nhưng đơn không tạo được (' . $failReason . '). Đã ghi phiếu hoàn tiền, vui lòng liên hệ hoàn tiền cho khách.',
                            'is_read'     => false,
                            'created_at'  => $now,
                            'group_key'   => 'payfail_' . strtolower($intent->intent_code),
                        ])->all();
                    if (!empty($rows)) {
                        \App\Models\Notification::insert($rows);
                    }

                    return response()->json([
                        'success' => true,
                        'message' => 'Đã ghi nhận thanh toán nhưng không tạo được đơn; đã tạo phiếu hoàn tiền cho khách.',
                    ]);
                }

                // Ghi nhận payment trong transaction riêng
                $data = $responseData['data'] ?? [];
                $bookingId = $data['payment_booking_id'] ?? $data['booking_id'] ?? null;

                DB::transaction(function () use ($bookingId, $data, $paidAmount, $request, $searchText) {
                    $remaining = $paidAmount;
                    $batchBookings = $data['bookings'] ?? [];

                    if (!empty($batchBookings) && is_array($batchBookings)) {
                        $sortedBatch = collect($batchBookings)
                            ->map(fn($item) => Booking::with('details')->find($item['booking_id'] ?? null))
                            ->filter()
                            ->sortBy(function ($b) {
                                $d = $b->details->first();
                                return ($d->booking_date ?? '9999-99-99') . ' ' . ($d->start_time ?? '00:00');
                            })
                            ->values();

                        $count = $sortedBatch->count();
                        foreach ($sortedBatch as $index => $bModel) {
                            if ($remaining <= 0) break;
                            if ($bModel->payment_status === 'paid') continue;
                            $remForThis = (float) $bModel->remaining_amount;
                            $isLast = ($index === $count - 1);
                            $toApply = min($remaining, $remForThis);
                            if ($isLast && $remForThis > 0 && ($remaining >= $remForThis - 1000)) {
                                $toApply = $remForThis;
                            }
                            if ($toApply > 0) {
                                app(PaymentService::class)->recordSuccessfulPayment($bModel, [
                                    'payment_method' => 'bank_transfer',
                                    'amount' => $toApply,
                                    'paid_at' => $request->transactionDate ?? now(),
                                    'sepay_transaction_id' => $request->id ?? null,
                                    'bank_gateway' => $request->gateway ?? null,
                                    'reference_code' => $request->referenceCode ?? null,
                                    'payment_content' => $searchText,
                                ]);
                                $remaining -= $toApply;
                            }
                        }
                    } elseif ($bookingId) {
                        $booking = Booking::find($bookingId);
                        if ($booking) {
                            $toApply = min($remaining, (float) $booking->remaining_amount);
                            app(PaymentService::class)->recordSuccessfulPayment($booking, [
                                'payment_method' => 'bank_transfer',
                                'amount' => $toApply > 0 ? $toApply : $remaining,
                                'paid_at' => $request->transactionDate ?? now(),
                                'sepay_transaction_id' => $request->id ?? null,
                                'bank_gateway' => $request->gateway ?? null,
                                'reference_code' => $request->referenceCode ?? null,
                                'payment_content' => $searchText,
                            ]);
                            $remaining -= ($toApply > 0 ? $toApply : $remaining);
                        }
                    }

                    // Nếu recurring/long_term, mark toàn bộ sessions paid còn lại theo thứ tự ngày
                    if (!empty($data['recurring_id']) && $remaining > 0) {
                        $siblings = Booking::where('recurring_booking_id', $data['recurring_id'])
                            ->where('id', '!=', $bookingId)
                            ->where('payment_status', '!=', 'paid')
                            ->with('details')
                            ->get()
                            ->sortBy(function ($b) {
                                $d = $b->details->first();
                                return ($d->booking_date ?? '9999-99-99') . ' ' . ($d->start_time ?? '00:00');
                            })
                            ->values();

                        $count = $siblings->count();
                        foreach ($siblings as $index => $b) {
                            if ($remaining <= 0) break;
                            $remForThis = (float) $b->remaining_amount;
                            $isLast = ($index === $count - 1);
                            $toApply = min($remaining, $remForThis);
                            if ($isLast && $remForThis > 0 && ($remaining >= $remForThis - 1000)) {
                                $toApply = $remForThis;
                            }
                            app(PaymentService::class)->recordSuccessfulPayment($b, [
                                'payment_method' => 'bank_transfer',
                                'amount' => $toApply,
                                'paid_at' => $request->transactionDate ?? now(),
                                'sepay_transaction_id' => $request->id ?? null,
                                'bank_gateway' => $request->gateway ?? null,
                                'reference_code' => $request->referenceCode ?? null,
                                'payment_content' => $searchText,
                            ]);
                            $remaining -= $toApply;
                        }
                    }
                });

                // Cache booking codes, xóa marker processing
                $codes = [];
                if ($bookingId) {
                    $b = Booking::find($bookingId);
                    if ($b) {
                        $codes[] = $b->booking_code;
                    }
                }
                Cache::put('intent_paid_' . $intent->intent_code, $codes, now()->addHour());
                Cache::forget('intent_processing_' . $intent->intent_code);

                return response()->json([
                    'success' => true,
                    'message' => 'Đặt sân và thanh toán thành công',
                    'data' => ['intent_code' => $intent->intent_code, 'paid_amount' => $paidAmount],
                ]);
            }
        }

        // Thử match mã hợp đồng REC_ / LTB_ trước (thanh toán toàn bộ hợp đồng)
        preg_match('/(REC|LTB)[\s_-]?[A-Z0-9]+/i', $searchText, $contractMatches);

        if (!empty($contractMatches)) {
            $rawCode = strtoupper($contractMatches[0]);
            $recurringCode = str_replace([' ', '-'], '_', $rawCode);
            if (!str_contains($recurringCode, '_')) {
                $recurringCode = substr($recurringCode, 0, 3) . '_' . substr($recurringCode, 3);
            }

            $recurringBooking = RecurringBooking::where('recurring_code', $recurringCode)->first();

            if ($recurringBooking) {
                $paidAmount = (float) $request->transferAmount;

                if ($paidAmount <= 0) {
                    return response()->json(['success' => false, 'message' => 'Số tiền không hợp lệ'], 422);
                }

                $duplicateQuery = Payment::query();
                $hasDuplicateKey = false;
                if ($request->filled('referenceCode')) {
                    $duplicateQuery->where('reference_code', $request->referenceCode);
                    $hasDuplicateKey = true;
                }
                if ($request->filled('id')) {
                    $hasDuplicateKey
                        ? $duplicateQuery->orWhere('sepay_transaction_id', $request->id)
                        : $duplicateQuery->where('sepay_transaction_id', $request->id);
                    $hasDuplicateKey = true;
                }
                if ($hasDuplicateKey && $duplicateQuery->exists()) {
                    return response()->json(['success' => true, 'message' => 'Giao dịch đã được xử lý trước đó']);
                }

                return DB::transaction(function () use ($request, $recurringBooking, $searchText, $paidAmount) {
                    $unpaidBookings = Booking::where('recurring_booking_id', $recurringBooking->id)
                        ->where('payment_status', '!=', 'paid')
                        ->lockForUpdate()
                        ->get();

                    $requiredAmount = (float) $unpaidBookings->sum('remaining_amount');
                    if ($requiredAmount > 0 && $paidAmount + 0.5 < $requiredAmount) {
                        return response()->json([
                            'success' => false,
                            'message' => 'Hợp đồng định kỳ/dài hạn phải thanh toán đủ 100% (' . number_format($requiredAmount) . 'đ)',
                        ], 422);
                    }

                    $remaining = $paidAmount;
                    $paidCount = 0;
                    $lastPayment = null;

                    foreach ($unpaidBookings as $b) {
                        if ($remaining <= 0)
                            break;
                        $toApply = min($remaining, (float) $b->remaining_amount);
                        $lastPayment = app(PaymentService::class)->recordSuccessfulPayment($b, [
                            'payment_method' => 'bank_transfer',
                            'amount' => $toApply,
                            'paid_at' => $request->transactionDate ?? now(),
                            'sepay_transaction_id' => $request->id,
                            'bank_gateway' => $request->gateway,
                            'reference_code' => $request->referenceCode,
                            'payment_content' => $searchText,
                        ]);
                        $remaining -= $toApply;
                        $paidCount++;
                    }

                    return response()->json([
                        'success' => true,
                        'message' => "Thanh toán hợp đồng thành công ({$paidCount} ca)",
                        'data' => [
                            'recurring_code' => $recurringBooking->recurring_code,
                            'paid_sessions' => $paidCount,
                            'paid_amount' => $paidAmount,
                        ]
                    ]);
                });
            }
        }

        // Thử match mã đặt lẻ BILL_
        preg_match('/BILL[\s_-]?[A-Z0-9]+/i', $searchText, $matches);

        if (empty($matches)) {
            return response()->json([
                'success' => true,
                'message' => 'Không tìm thấy mã booking trong nội dung chuyển khoản',
                'debug_search_text' => $searchText
            ]);
        }

        $rawBookingCode = strtoupper($matches[0]);
        $rawBookingCode = str_replace([' ', '-'], '_', $rawBookingCode);
        $bookingCode = str_contains($rawBookingCode, 'BILL_')
            ? $rawBookingCode
            : 'BILL_' . str_replace('BILL', '', $rawBookingCode);

        $booking = Booking::where('booking_code', $bookingCode)->first();

        if (!$booking) {
            return response()->json([
                'success' => true,
                'message' => 'Không tìm thấy đơn đặt sân tương ứng',
                'debug_booking_code' => $bookingCode,
                'debug_search_text' => $searchText
            ]);
        }

        $paidAmount = (float) $request->transferAmount;

        if ($paidAmount <= 0) {
            return response()->json([
                'success' => false,
                'message' => 'Số tiền thanh toán không hợp lệ'
            ], 422);
        }

        $duplicateQuery = Payment::query();
        $hasDuplicateKey = false;

        if ($request->filled('referenceCode')) {
            $duplicateQuery->where('reference_code', $request->referenceCode);
            $hasDuplicateKey = true;
        }

        if ($request->filled('id')) {
            $hasDuplicateKey
                ? $duplicateQuery->orWhere('sepay_transaction_id', $request->id)
                : $duplicateQuery->where('sepay_transaction_id', $request->id);
            $hasDuplicateKey = true;
        }

        if ($hasDuplicateKey && $duplicateQuery->exists()) {
            return response()->json([
                'success' => true,
                'message' => 'Giao dịch đã được xử lý trước đó'
            ]);
        }

        return DB::transaction(function () use ($request, $booking, $searchText, $paidAmount) {
            $booking = Booking::where('id', $booking->id)
                ->lockForUpdate()
                ->firstOrFail();

            $duplicateQuery = Payment::query();
            $hasDuplicateKey = false;

            if ($request->filled('referenceCode')) {
                $duplicateQuery->where('reference_code', $request->referenceCode);
                $hasDuplicateKey = true;
            }

            if ($request->filled('id')) {
                $hasDuplicateKey
                    ? $duplicateQuery->orWhere('sepay_transaction_id', $request->id)
                    : $duplicateQuery->where('sepay_transaction_id', $request->id);
                $hasDuplicateKey = true;
            }

            if ($hasDuplicateKey && $duplicateQuery->exists()) {
                return response()->json([
                    'success' => true,
                    'message' => 'Giao dịch đã được xử lý trước đó'
                ]);
            }

            $toApply = min($paidAmount, (float) $booking->remaining_amount);
            $payment = app(PaymentService::class)->recordSuccessfulPayment($booking, [
                'payment_method' => 'bank_transfer',
                'amount' => $toApply > 0 ? $toApply : $paidAmount,
                'paid_at' => $request->transactionDate ?? now(),
                'sepay_transaction_id' => $request->id,
                'bank_gateway' => $request->gateway,
                'reference_code' => $request->referenceCode,
                'payment_content' => $searchText,
            ]);

            $remainingExtra = $paidAmount - ($toApply > 0 ? $toApply : $paidAmount);

            // Nếu còn tiền thừa, gạch nợ cho các đơn anh em tạo cùng đợt (trong vòng 5 phút)
            if ($remainingExtra > 0) {
                $createdAtTime = Carbon::parse($booking->created_at);
                $siblingsQuery = Booking::where('id', '!=', $booking->id)
                    ->where('created_at', '>=', $createdAtTime->copy()->subMinutes(5))
                    ->where('created_at', '<=', $createdAtTime->copy()->addMinutes(5))
                    ->where('payment_status', '!=', 'paid');

                if ($booking->user_id) {
                    $siblingsQuery->where('user_id', $booking->user_id);
                } elseif ($booking->customer_phone) {
                    $siblingsQuery->where('customer_phone', $booking->customer_phone);
                }

                $siblings = $siblingsQuery->get();

                foreach ($siblings as $sib) {
                    if ($remainingExtra <= 0) break;
                    $toApplySib = min($remainingExtra, (float) $sib->remaining_amount);
                    if ($toApplySib > 0) {
                        app(PaymentService::class)->recordSuccessfulPayment($sib, [
                            'payment_method' => 'bank_transfer',
                            'amount' => $toApplySib,
                            'paid_at' => $request->transactionDate ?? now(),
                            'sepay_transaction_id' => $request->id,
                            'bank_gateway' => $request->gateway,
                            'reference_code' => $request->referenceCode,
                            'payment_content' => $searchText,
                        ]);
                        $remainingExtra -= $toApplySib;
                    }
                }
            }

            $booking->refresh();

            return response()->json([
                'success' => true,
                'message' => 'Xử lý thanh toán SePay thành công',
                'data' => [
                    'booking_code' => $booking->booking_code,
                    'payment_code' => $payment->payment_code,
                    'paid_amount' => $paidAmount,
                    'payment_status' => $booking->payment_status,
                    'remaining_amount' => $booking->remaining_amount,
                ]
            ]);
        });
    }

    /**
     * Lấy thông tin thanh toán và QR chuyển khoản cho đơn đặt sân.
     */
    /**
     * Chức năng: Trả thông tin số tiền cần thanh toán và QR chuyển khoản cho một đơn đặt sân.
     */
    public function paymentInfo($bookingId)
    {
        $booking = Booking::with('recurringBooking')->findOrFail($bookingId);
        $transferPrefix = config('services.sepay.transfer_prefix');
        $bankName = config('services.sepay.bank_name');
        $bankAccount = config('services.sepay.bank_account');
        $accountHolder = config('services.sepay.account_holder');

        // Nếu booking thuộc hợp đồng định kỳ/dài hạn → tổng tiền tất cả sessions
        if ($booking->recurring_booking_id && $booking->recurringBooking) {
            $recurringCode = $booking->recurringBooking->recurring_code;

            $siblingBookings = Booking::where('recurring_booking_id', $booking->recurring_booking_id)
                ->where('payment_status', '!=', 'paid')
                ->get();

            $amount = (float) $siblingBookings->sum('remaining_amount');
            $sessionsCount = $siblingBookings->count();

            $transferContent = $transferPrefix
                ? $transferPrefix . ' ' . $recurringCode
                : $recurringCode;

            $qrUrl = 'https://qr.sepay.vn/img?' . http_build_query([
                'acc' => $bankAccount,
                'bank' => $bankName,
                'amount' => $amount,
                'des' => $transferContent,
            ]);

            return response()->json([
                'message' => 'Lấy thông tin thanh toán thành công',
                'data' => [
                    'booking_id' => $booking->id,
                    'booking_code' => $recurringCode,
                    'total_price' => $amount,
                    'deposit_amount' => 0,
                    'remaining_amount' => $amount,
                    'payment_status' => $booking->payment_status,
                    'sessions_count' => $sessionsCount,
                    'bank_name' => $bankName,
                    'bank_account' => $bankAccount,
                    'account_holder' => $accountHolder,
                    'transfer_content' => $transferContent,
                    'qr_url' => $qrUrl,
                ]
            ]);
        }

        // Đặt lẻ thông thường
        $amount = (float) $booking->remaining_amount;
        $transferContent = $transferPrefix
            ? $transferPrefix . ' ' . $booking->booking_code
            : $booking->booking_code;

        $qrUrl = 'https://qr.sepay.vn/img?' . http_build_query([
            'acc' => $bankAccount,
            'bank' => $bankName,
            'amount' => $amount,
            'des' => $transferContent,
        ]);

        return response()->json([
            'message' => 'Lấy thông tin thanh toán thành công',
            'data' => [
                'booking_id' => $booking->id,
                'booking_code' => $booking->booking_code,
                'total_price' => (float) $booking->total_price,
                'deposit_amount' => (float) $booking->deposit_amount,
                'remaining_amount' => (float) $booking->remaining_amount,
                'payment_status' => $booking->payment_status,
                'bank_name' => $bankName,
                'bank_account' => $bankAccount,
                'account_holder' => $accountHolder,
                'transfer_content' => $transferContent,
                'qr_url' => $qrUrl,
            ]
        ]);
    }

    /**
     * Chức năng: Kiểm tra intent còn tồn tại không (để frontend biết đã được xử lý chưa).
     * Intent bị xóa sau khi webhook tạo booking xong → trả về paid=true.
     */
    public function intentStatus($code)
    {
        $intent = BookingIntent::where('intent_code', strtoupper($code))->first();

        if (!$intent) {
            // Webhook đang xử lý (chưa có codes) → chờ thêm
            if (Cache::has('intent_processing_' . strtoupper($code))) {
                return response()->json(['status' => 'success', 'data' => ['paid' => false]]);
            }

            // Webhook xong → trả paid=true kèm mã đơn
            $paidCacheKey = 'intent_paid_' . strtoupper($code);
            if (Cache::has($paidCacheKey)) {
                return response()->json(['status' => 'success', 'data' => [
                    'paid'          => true,
                    'booking_codes' => Cache::get($paidCacheKey, []),
                ]]);
            }

            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy phiên thanh toán.',
                'data' => ['paid' => false],
            ], 404);
        }

        if ($intent->expires_at->isPast()) {
            $intent->delete();
            return response()->json(['status' => 'success', 'data' => ['paid' => false, 'expired' => true]]);
        }

        return response()->json(['status' => 'success', 'data' => ['paid' => false, 'expires_at' => $intent->expires_at]]);
    }

    /**
     * Chức năng: Kiểm tra một giao dịch SePay đã được ghi nhận trước đó chưa,
     * dựa trên referenceCode hoặc transaction id — chống xử lý trùng webhook.
     */
    private function isDuplicateTransaction(Request $request): bool
    {
        $query = Payment::query();
        $hasKey = false;

        if ($request->filled('referenceCode')) {
            $query->where('reference_code', $request->referenceCode);
            $hasKey = true;
        }
        if ($request->filled('id')) {
            $hasKey
                ? $query->orWhere('sepay_transaction_id', $request->id)
                : $query->where('sepay_transaction_id', $request->id);
            $hasKey = true;
        }

        return $hasKey && $query->exists();
    }
}
