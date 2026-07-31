<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\StaffShift;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StaffShiftAndNotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_cannot_schedule_blocked_staff_or_overlapping_shift(): void
    {
        $this->signIn(null, ['role' => 'admin']);
        $blockedStaff = $this->createUser(['role' => 'staff', 'status' => 'blocked']);
        $activeStaff = $this->createUser(['role' => 'staff']);
        $date = today()->addDay()->toDateString();

        $this->postJson('/api/admin/staff-shifts', $this->shiftPayload($blockedStaff->id, $date))
            ->assertUnprocessable();

        $this->postJson('/api/admin/staff-shifts', $this->shiftPayload($activeStaff->id, $date))
            ->assertCreated();

        $this->postJson('/api/admin/staff-shifts', $this->shiftPayload(
            $activeStaff->id,
            $date,
            '11:00',
            '14:00'
        ))->assertUnprocessable();

        $this->postJson('/api/admin/staff-shifts', $this->shiftPayload(
            $activeStaff->id,
            $date,
            '12:00',
            '16:00'
        ))->assertCreated();

        $this->assertDatabaseCount('Staff_Shifts', 2);
    }

    public function test_staff_my_shifts_never_contains_another_staff_schedule(): void
    {
        $staff = $this->createUser(['role' => 'staff']);
        $other = $this->createUser(['role' => 'staff']);
        StaffShift::create($this->shiftPayload($staff->id, today()->addDay()->toDateString()));
        StaffShift::create($this->shiftPayload($other->id, today()->addDay()->toDateString(), '13:00', '17:00'));
        $this->signIn($staff);

        $this->getJson('/api/staff/my-shifts')
            ->assertOk()
            ->assertJsonCount(1, 'data.upcoming_shifts')
            ->assertJsonPath('data.upcoming_shifts.0.staff_id', $staff->id);
    }

    public function test_user_cannot_mark_another_receivers_notification_as_read(): void
    {
        $admin = $this->createUser(['role' => 'admin']);
        $staff = $this->createUser(['role' => 'staff']);
        $notification = Notification::create([
            'receiver_id' => $admin->id,
            'title' => 'Thong bao rieng',
            'content' => 'Noi dung',
            'is_read' => false,
            'created_at' => now(),
        ]);
        $this->signIn($staff);

        $this->patchJson("/api/admin/notifications/{$notification->id}/read")
            ->assertNotFound();

        $this->assertDatabaseHas('notifications', [
            'id' => $notification->id,
            'receiver_id' => $admin->id,
            'is_read' => false,
        ]);
    }

    public function test_group_notification_acknowledgement_clears_the_same_event_for_all_staff(): void
    {
        $admin = $this->createUser(['role' => 'admin']);
        $staff = $this->createUser(['role' => 'staff']);
        $group = 'req_bill_test';
        $adminNotification = Notification::create([
            'receiver_id' => $admin->id,
            'title' => 'Yeu cau',
            'content' => 'Noi dung',
            'is_read' => false,
            'created_at' => now(),
            'group_key' => $group,
        ]);
        Notification::create([
            'receiver_id' => $staff->id,
            'title' => 'Yeu cau',
            'content' => 'Noi dung',
            'is_read' => false,
            'created_at' => now(),
            'group_key' => $group,
        ]);
        $this->signIn($admin);

        $this->patchJson("/api/admin/notifications/{$adminNotification->id}/read")
            ->assertOk();

        $this->assertSame(0, Notification::where('group_key', $group)->where('is_read', false)->count());
    }

    private function shiftPayload(
        string $staffId,
        string $date,
        string $start = '08:00',
        string $end = '12:00'
    ): array {
        return [
            'staff_id' => $staffId,
            'shift_date' => $date,
            'shift_name' => 'Ca test',
            'start_time' => $start,
            'end_time' => $end,
            'status' => 'scheduled',
        ];
    }
}
