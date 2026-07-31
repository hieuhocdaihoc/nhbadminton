<?php

namespace Tests\Feature;

use App\Models\BookingDetail;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserBookingOwnershipTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_cannot_request_or_reschedule_someone_elses_walk_in_booking(): void
    {
        $customer = $this->createUser(['phone' => '0901111111']);
        $this->signIn($customer);
        $booking = $this->walkInBooking('0902222222');

        $this->postJson('/api/user/booking-request', [
            'booking_code' => $booking->booking_code,
            'type' => 'cancel',
            'message' => 'Toi muon huy',
        ])->assertNotFound();

        $this->postJson('/api/user/bookings/reschedule', [
            'booking_code' => $booking->booking_code,
            'new_date' => today()->addDays(4)->toDateString(),
            'new_start' => '10:00',
            'new_end' => '11:00',
        ])->assertNotFound();

        $this->assertDatabaseCount('notifications', 0);
        $this->assertDatabaseHas('booking_details', [
            'booking_id' => $booking->id,
            'start_time' => '08:00',
        ]);
    }

    public function test_customer_with_matching_phone_can_manage_walk_in_booking(): void
    {
        $admin = $this->createUser(['role' => 'admin']);
        $customer = $this->createUser(['phone' => '0902222222']);
        $this->signIn($customer);
        $booking = $this->walkInBooking('090 222 2222');

        $this->postJson('/api/user/booking-request', [
            'booking_code' => strtolower($booking->booking_code),
            'type' => 'change',
            'message' => 'Xin doi lich',
        ])->assertOk();

        $this->assertDatabaseHas('notifications', [
            'receiver_id' => $admin->id,
            'sender_id' => $customer->id,
            'is_read' => false,
        ]);

        $this->postJson('/api/user/bookings/reschedule', [
            'booking_code' => $booking->booking_code,
            'new_date' => today()->addDays(4)->toDateString(),
            'new_start' => '10:00',
            'new_end' => '11:00',
        ])->assertOk()
            ->assertJsonPath('policy', 'approved');

        $this->assertDatabaseHas('booking_details', [
            'booking_id' => $booking->id,
            'booking_date' => today()->addDays(4)->toDateString(),
            'start_time' => '10:00:00',
            'end_time' => '11:00:00',
        ]);
    }

    private function walkInBooking(string $phone)
    {
        $court = $this->createCourt();
        $booking = $this->createBooking(null, [
            'booking_code' => 'BILL_WALKIN',
            'customer_phone' => $phone,
            'customer_name' => 'Khach vang lai',
        ]);

        BookingDetail::create([
            'booking_id' => $booking->id,
            'court_id' => $court->id,
            'booking_date' => today()->addDays(3),
            'start_time' => '08:00',
            'end_time' => '09:00',
            'duration_minutes' => 60,
            'price_per_hour' => 100000,
            'price' => 100000,
        ]);

        \App\Models\CourtPricing::create([
            'day_type' => Carbon::parse(today()->addDays(4))->isWeekend() ? 'weekend' : 'weekday',
            'start_time' => '06:00',
            'end_time' => '22:00',
            'price' => 100000,
            'min_booking_minutes' => 30,
        ]);

        return $booking;
    }
}
