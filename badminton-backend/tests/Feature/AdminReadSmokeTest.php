<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminReadSmokeTest extends TestCase
{
    use RefreshDatabase;

    public function test_every_admin_list_and_report_endpoint_loads_on_an_empty_database(): void
    {
        $this->signIn(null, ['role' => 'admin']);

        $uris = [
            '/api/admin/bookings/long-term',
            '/api/admin/bookings/recurring',
            '/api/admin/bookings/search',
            '/api/admin/bookings/single',
            '/api/admin/bookings/today',
            '/api/admin/categories',
            '/api/admin/court-pricing',
            '/api/admin/court-pricing-history',
            '/api/admin/courts',
            '/api/admin/dashboard-report',
            '/api/admin/inventory-history',
            '/api/admin/membership/cards',
            '/api/admin/membership/packages',
            '/api/admin/notifications',
            '/api/admin/payments',
            '/api/admin/payments/summary',
            '/api/admin/products',
            '/api/admin/products-report',
            '/api/admin/promotions',
            '/api/admin/purchase-orders',
            '/api/admin/refunds',
            '/api/admin/reports/court-performance',
            '/api/admin/reviews',
            '/api/admin/services',
            '/api/admin/settings',
            '/api/admin/staff-shifts',
            '/api/admin/suppliers',
            '/api/admin/users',
        ];

        foreach ($uris as $uri) {
            $response = $this->getJson($uri);
            $this->assertSame(200, $response->getStatusCode(), "{$uri} failed: {$response->getContent()}");
        }
    }
}
