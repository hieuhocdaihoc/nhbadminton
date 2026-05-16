<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class AdditionalService extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'additional_services';
    public $timestamps = false;
    protected $fillable = [
        'name',
        'service_type',
        'description',
        'price',
        'unit',
        'status'
    ];
}