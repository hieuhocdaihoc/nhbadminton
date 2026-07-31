<?php

namespace App\Services;

final class MembershipTierService
{
    public const LEVEL_DONG = 'Dong';
    public const LEVEL_BAC = 'Bac';
    public const LEVEL_VANG = 'Vang';

    public static function levelForPoints(int $points): string
    {
        return match (true) {
            $points >= 3000 => self::LEVEL_VANG,
            $points >= 1000 => self::LEVEL_BAC,
            default => self::LEVEL_DONG,
        };
    }

    public static function hourlyDiscountForPoints(int $points): int
    {
        return match (true) {
            $points >= 3000 => 5000,
            $points >= 1000 => 2000,
            default => 0,
        };
    }

    public static function discountForMinutes(int $points, int|float $minutes): float
    {
        $hours = max(0, $minutes) / 60;

        return $hours * self::hourlyDiscountForPoints($points);
    }
}
