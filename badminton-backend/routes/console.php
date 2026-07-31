<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Hằng ngày 00:05 chuyển thẻ thành viên quá hạn sang expired
Schedule::command('cards:expire')->dailyAt('00:05');
