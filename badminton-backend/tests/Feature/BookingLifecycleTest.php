<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\BookingDetail;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BookingLifecycleTest extends TestCase
{
    use RefreshDatabase;

    public function test_check_in_requires_matching_phone_and_booking_code(): void
    {
        $this->signIn(null, ['role' => 'staff']);
        $booking = $this->scheduledBooking(now());

        $this->postJson("/api/admin/bookings/{$booking->id}/check-in", [
            'phone' => '0999999999',
            'booking_code' => $booking->booking_code,
        ])->assertUnprocessable();

        $this->assertSame('confirmed', $booking->fresh()->status);
        $this->assertNull($booking->fresh()->check_in_at);
    }

    public function test_booking_cannot_be_checked_in_or_checked_out_before_its_playing_window(): void
    {
        $this->travelTo(Carbon::parse('2026-07-26 08:00:00'));
        $this->signIn(null, ['role' => 'staff']);
        $booking = $this->scheduledBooking(Carbon::parse('2026-07-27 10:00:00'));

        $this->postJson("/api/admin/bookings/{$booking->id}/check-in", [
            'phone' => $booking->customer_phone,
            'booking_code' => $booking->booking_code,
        ])->assertUnprocessable();

        $this->patchJson("/api/admin/bookings/{$booking->id}/checkout")
            ->assertUnprocessable();

        $booking->refresh();
        $this->assertSame('confirmed', $booking->status);
        $this->assertSame('unpaid', $booking->payment_status);
        $this->assertDatabaseCount('payments', 0);
    }

    public function test_check_in_and_checkout_complete_booking_and_collect_remaining_cash_once(): void
    {
        $this->travelTo(Carbon::parse('2026-07-26 10:05:00'));
        $customer = $this->createUser();
        $this->signIn(null, ['role' => 'staff']);
        $booking = $this->scheduledBooking(now(), $customer);

        $this->postJson("/api/admin/bookings/{$booking->id}/check-in", [
            'phone' => '090 123 4567',
            'booking_code' => strtolower($booking->booking_code),
        ])->assertOk()
            ->assertJsonPath('data.status', 'playing');

        $this->patchJson("/api/admin/bookings/{$booking->id}/checkout")
            ->assertOk()
            ->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('data.payment_status', 'paid');

        $this->assertDatabaseHas('payments', [
            'booking_id' => $booking->id,
            'payment_method' => 'cash',
            'amount' => 200000,
            'status' => 'success',
        ]);

        $this->patchJson("/api/admin/bookings/{$booking->id}/checkout")
            ->assertUnprocessable();

        $this->assertDatabaseCount('payments', 1);
    }

    public function test_unpaid_booking_cannot_be_marked_completed_directly(): void
    {
        $this->signIn(null, ['role' => 'admin']);
        $booking = $this->scheduledBooking(now());

        $this->patchJson("/api/admin/bookings/{$booking->id}/status", [
            'status' => 'completed',
        ])->assertUnprocessable();

        $this->assertSame('confirmed', $booking->fresh()->status);
    }

    private function scheduledBooking(Carbon $start, $customer = null): Booking
    {
        $court = $this->createCourt();
        $booking = $this->createBooking($customer, [
            'booking_code' => 'BILL_LIFE' . random_int(100, 999),
            'customer_name' => 'Khach Test',
            'customer_phone' => '0901234567',
        ]);

        BookingDetail::create([
            'booking_id' => $booking->id,
            'court_id' => $court->id,
            'booking_date' => $start->toDateString(),
            'start_time' => $start->format('H:i'),
            'end_time' => $start->copy()->addHour()->format('H:i'),
            'duration_minutes' => 60,
            'price_per_hour' => 200000,
            'price' => 200000,
        ]);

        return $booking;
    }

    public function test_admin_can_reschedule_multi_slot_booking_shifting_all_details(): void
    {
        $this->signIn(null, ['role' => 'admin']);
        $court = $this->createCourt();
        $court2 = $this->createCourt(['name' => 'Sân 2']);
        $today = now()->addDays(2)->toDateString();

        $booking = $this->createBooking(null, [
            'booking_code' => 'MULTISLOT1',
            'customer_name' => 'Khach Multi Slot',
            'customer_phone' => '0901234567',
        ]);

        $detail1 = BookingDetail::create([
            'booking_id' => $booking->id,
            'court_id' => $court->id,
            'booking_date' => $today,
            'start_time' => '11:00:00',
            'end_time' => '12:00:00',
            'duration_minutes' => 60,
            'price_per_hour' => 100000,
            'price' => 100000,
        ]);

        $detail2 = BookingDetail::create([
            'booking_id' => $booking->id,
            'court_id' => $court->id,
            'booking_date' => $today,
            'start_time' => '12:00:00',
            'end_time' => '13:00:00',
            'duration_minutes' => 60,
            'price_per_hour' => 100000,
            'price' => 100000,
        ]);

        $this->patchJson("/api/admin/bookings/details/{$detail1->id}/reschedule", [
            'court_id' => $court2->id,
            'booking_date' => $today,
            'start_time' => '18:00',
            'end_time' => '20:00',
        ])->assertOk();

        $d1 = $detail1->fresh();
        $d2 = $detail2->fresh();

        $this->assertSame($court2->id, $d1->court_id);
        $this->assertSame($court2->id, $d2->court_id);
        $this->assertSame('18:00:00', $d1->start_time);
        $this->assertSame('19:00:00', $d1->end_time);
        $this->assertSame('19:00:00', $d2->start_time);
        $this->assertSame('20:00:00', $d2->end_time);
    }
}
