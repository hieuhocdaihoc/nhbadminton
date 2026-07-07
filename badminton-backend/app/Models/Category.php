<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Category extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'categories';

    public $timestamps = false;

    protected $fillable = [
        'name',
        'description',
        'status',
    ];

    // Relationships

    /** Quan hệ: danh mục có nhiều sản phẩm */
    public function products()
    {
        return $this->hasMany(Product::class, 'category_id', 'id');
    }
}
