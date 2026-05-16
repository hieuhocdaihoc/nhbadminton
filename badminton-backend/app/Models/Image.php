<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class Image extends Model
{
    use HasUuid;

    protected $table = 'images';
    public $timestamps = false; // Bảng không có updated_at, MySQL sẽ tự lo created_at

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'url',
        'alt_text',
        'target_type',
        'target_id',
        'sort_order',
        'is_primary'
    ];

    protected $casts = [
        'sort_order' => 'integer',
        'is_primary' => 'boolean',
    ];
}