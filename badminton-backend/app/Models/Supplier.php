<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class Supplier extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'suppliers';
    public $timestamps = false; // Tắt tự động thời gian

    protected $fillable = [
        'name',
        'phone',
        'email',
        'address',
        'contact_person'
    ];
}