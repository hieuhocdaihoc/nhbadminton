<?php

namespace App\Services;

final class MembershipTierService
{
    public const LEVEL_DONG = 'Dong';
    public const LEVEL_BAC = 'Bac';
    public const LEVEL_VANG = 'Vang';

    // xac dinh hang thanh vien (Dong/Bac/Vang) theo diem tich luy
    public static function levelForPoints(int $points): string
    {
        return match (true) {
            $points >= 3000 => self::LEVEL_VANG,
            $points >= 1000 => self::LEVEL_BAC,
            default => self::LEVEL_DONG,
        };
    }

    // so tien duoc giam moi gio choi theo hang thanh vien
    public static function hourlyDiscountForPoints(int $points): int
    {
        return match (true) {
            $points >= 3000 => 5000,
            $points >= 1000 => 2000,
            default => 0,
        };
    }

    // tong tien duoc giam cho ca don dua theo so phut choi va hang thanh vien
    public static function discountForMinutes(int $points, int|float $minutes): float
    {
        $hours = max(0, $minutes) / 60;

        return $hours * self::hourlyDiscountForPoints($points);
    }
}
