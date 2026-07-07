<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class SystemSetting extends Model
{
    use HasUuid;

    protected $table = 'system_settings';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = [
        'setting_key',
        'setting_value',
    ];

    public static function getAll(): array
    {
        return static::query()->pluck('setting_value', 'setting_key')->toArray();
    }
}
