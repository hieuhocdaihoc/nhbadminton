<?php

namespace App\Console\Commands;

use App\Models\MembershipCard;
use Illuminate\Console\Command;

/**
 * Quét và chuyển các thẻ thành viên đã quá hạn (còn 'active' nhưng valid_to < hôm nay)
 * sang trạng thái 'expired'. Chạy hằng ngày để thống kê "thẻ đang hoạt động" luôn chính xác,
 * không phụ thuộc việc có ai mở thẻ ra xem hay không.
 */
class ExpireMembershipCards extends Command
{
    protected $signature = 'cards:expire';
    protected $description = 'Chuyển thẻ thành viên quá hạn sang trạng thái expired';

    public function handle(): int
    {
        $count = MembershipCard::where('status', 'active')
            ->whereDate('valid_to', '<', today())
            ->update(['status' => 'expired']);

        $this->info("Đã chuyển {$count} thẻ quá hạn sang expired.");

        return self::SUCCESS;
    }
}
