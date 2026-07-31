<?php

namespace App\Services;

use App\Models\CourtPricing;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;

class CourtPricingResolver
{
    /**
     * Tìm giá cho ngày
     */
    public function effectiveForDate(string $date): Collection
    {
        $dayType = Carbon::parse($date)->isWeekend() ? 'weekend' : 'weekday';

        $seasonal = CourtPricing::where('day_type', $dayType)
            ->whereNotNull('effective_from')
            ->where('effective_from', '<=', $date)
            ->where(function ($query) use ($date) {
                $query->whereNull('effective_to')
                    ->orWhere('effective_to', '>=', $date);
            })
            ->orderBy('start_time')
            ->get();

        if ($seasonal->isNotEmpty()) {
            return $seasonal;
        }

        return CourtPricing::where('day_type', $dayType)
            ->whereNull('effective_from')
            ->where(function ($query) use ($date) {
                $query->whereNull('effective_to')
                    ->orWhere('effective_to', '>=', $date);
            })
            ->orderBy('start_time')
            ->get();
    }
    /**
     * Tính giá cho một khoảng thời gian
     */
    public function calculate(string $date, string $startTime, string $endTime): array
    {
        $totalPrice = 0.0;
        $details = [];

        foreach ($this->effectiveForDate($date) as $pricing) {
            $pricingStart = substr($pricing->start_time, 0, 5);
            $pricingEnd = substr($pricing->end_time, 0, 5);
            $overlapStart = max($startTime, $pricingStart);
            $overlapEnd = min($endTime, $pricingEnd);

            if ($overlapStart >= $overlapEnd) {
                continue;
            }

            $minutes = (strtotime($overlapEnd) - strtotime($overlapStart)) / 60;
            $amount = ($minutes / 60) * $pricing->price;
            $totalPrice += $amount;

            $details[] = [
                'khung_gia' => "{$pricingStart} - {$pricingEnd}",
                'loai_gia' => $pricing->effective_from ? 'Giá thời vụ' : 'Giá mặc định',
                'thanh_tien' => round($amount, 2),
            ];
        }

        return [
            'total_price' => round($totalPrice, 2),
            'details' => $details,
        ];
    }
}
