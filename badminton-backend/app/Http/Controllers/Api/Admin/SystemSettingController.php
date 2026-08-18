<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use Illuminate\Http\Request;

class SystemSettingController extends Controller
{
    private const ALLOWED_KEYS = [
        'club_name',
        'description',
        'address',
        'hotline',
        'email',
        'weekday_hours',
        'weekend_hours',
        'holiday_hours',
        'map_url',
        'map_lat',
        'map_lng',
        'facebook_url',
        'instagram_url',
        'youtube_url',
        'deposit_percent',
        'cancel_request_min_hours',
        'overtime_grace_minutes',
    ];

    // lay toan bo cau hinh he thong cho admin xem/sua
    public function index()
    {
        return response()->json([
            'status' => 'success',
            'data'   => SystemSetting::getAll(),
        ]);
    }

    // cap nhat hang loat cau hinh he thong (dia chi, sdt, email, gio hoat dong, mang xa hoi
    public function update(Request $request)
    {
        $validated = $request->validate([
            'settings'   => ['required', 'array'],
            'settings.*' => ['nullable', 'string', 'max:2000'],
        ]);

        foreach ($validated['settings'] as $key => $value) {
            if (!in_array($key, self::ALLOWED_KEYS, true)) {
                continue;
            }

            SystemSetting::updateOrCreate(
                ['setting_key'   => $key],
                ['setting_value' => $value ?? '']
            );
        }

        return response()->json([
            'status'  => 'success',
            'message' => 'Cập nhật cấu hình hệ thống thành công.',
            'data'    => SystemSetting::getAll(),
        ]);
    }
}
