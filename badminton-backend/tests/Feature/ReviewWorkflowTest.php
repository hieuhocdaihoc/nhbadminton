<?php

namespace Tests\Feature;

use App\Models\BookingDetail;
use App\Models\Review;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReviewWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_can_review_only_a_completed_paid_booking_they_own(): void
    {
        $customer = $this->createUser();
        $otherCustomer = $this->createUser();
        $court = $this->createCourt();
        $booking = $this->createBooking($customer, [
            'status' => 'completed',
            'payment_status' => 'paid',
            'deposit_amount' => 200000,
            'remaining_amount' => 0,
        ]);
        BookingDetail::create([
            'booking_id' => $booking->id,
            'court_id' => $court->id,
            'booking_date' => today()->subDay()->toDateString(),
            'start_time' => '18:00',
            'end_time' => '19:00',
            'duration_minutes' => 60,
            'price' => 200000,
        ]);
        $this->createUser(['role' => 'admin']);
        $this->createUser(['role' => 'staff']);

        $this->signIn($otherCustomer);
        $payload = [
            'target_type' => 'court',
            'target_id' => $court->id,
            'booking_id' => $booking->id,
            'rating' => 5,
            'comment' => 'Good court and service',
        ];
        $this->postJson('/api/reviews', $payload)->assertForbidden();

        $this->signIn($customer);
        $this->postJson('/api/reviews', $payload)
            ->assertCreated()
            ->assertJsonPath('data.status', 'pending');

        $this->assertDatabaseCount('notifications', 2);
        $this->postJson('/api/reviews', $payload)->assertUnprocessable();
    }

    public function test_public_review_feed_exposes_only_approved_reviews(): void
    {
        $customer = $this->createUser();
        $court = $this->createCourt();
        $booking = $this->createBooking($customer, ['status' => 'completed', 'payment_status' => 'paid']);

        Review::create([
            'user_id' => $customer->id,
            'target_type' => 'court',
            'target_id' => $court->id,
            'booking_id' => $booking->id,
            'rating' => 4,
            'comment' => 'Pending review',
            'status' => 'pending',
        ]);
        Review::create([
            'user_id' => $customer->id,
            'target_type' => 'court',
            'target_id' => $court->id,
            'booking_id' => null,
            'rating' => 5,
            'comment' => 'Approved review',
            'status' => 'approved',
        ]);

        $this->getJson("/api/reviews?target_id={$court->id}")
            ->assertOk()
            ->assertJsonPath('data.summary.total_reviews', 1)
            ->assertJsonCount(1, 'data.reviews');
    }
}
