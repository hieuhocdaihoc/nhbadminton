<?php

namespace App\Traits;

use Illuminate\Support\Str;

trait HasUuid
{
    protected static function bootHasUuid()
    {
        static::creating(function ($model) {
            if (empty($model->{$model->getKeyName()})) {
                $model->{$model->getKeyName()} = (string) Str::uuid();
            }
        });
    }

    /**
     * Chức năng: Khai báo model không dùng khóa chính tự tăng.
     */
    public function getIncrementing()
    {
        return false;
    }
    /**
     * Chức năng: Khai báo kiểu khóa chính của model là string để dùng UUID.
     */
    public function getKeyType()
    {
        return 'string';
    }
}
