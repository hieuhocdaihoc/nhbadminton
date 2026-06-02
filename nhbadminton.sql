-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Generation Time: May 18, 2026 at 07:24 AM
-- Server version: 8.4.7
-- PHP Version: 8.3.28

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `nhbadminton`
--

-- --------------------------------------------------------

--
-- Table structure for table `additional_services`
--

DROP TABLE IF EXISTS `additional_services`;
CREATE TABLE IF NOT EXISTS `additional_services` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tên dịch vụ (Dạy cầu, thuê vợt...)',
  `service_type` enum('drink','rental','coaching','shuttlecock','other') COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Loại dịch vụ',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT 'Mô tả dịch vụ',
  `price` decimal(12,2) NOT NULL COMMENT 'Giá bán niêm yết',
  `unit` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Đơn vị (Chai, Tiếng, Buổi...)',
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Các dịch vụ cộng thêm không phải hàng hóa kho';

--
-- Dumping data for table `additional_services`
--

INSERT INTO `additional_services` (`id`, `name`, `service_type`, `description`, `price`, `unit`, `status`) VALUES
('019e2eea-496b-7203-a558-63991dd9cbfa', 'Đèn', 'other', 'đâsdasd', 50000.00, 'Lần', 'active'),
('e16d513f-4ad0-11f1-b356-0250edbfc5ac', 'Thuê vợt Yonex (Phổ thông)', 'rental', NULL, 30000.00, 'Cây/Ca', 'inactive'),
('e16d53ad-4ad0-11f1-b356-0250edbfc5ac', 'Thuê vợt Lining (Cao cấp)', 'rental', NULL, 50000.00, 'Cây/Ca', 'inactive'),
('e16d542d-4ad0-11f1-b356-0250edbfc5ac', 'Thuê giày cầu lông', 'rental', NULL, 30000.00, 'Đôi/Ca', 'active'),
('e16d5465-4ad0-11f1-b356-0250edbfc5ac', 'Dịch vụ đan lưới', 'other', NULL, 80000.00, 'Lần', 'active');

-- --------------------------------------------------------

--
-- Table structure for table `bookings`
--

DROP TABLE IF EXISTS `bookings`;
CREATE TABLE IF NOT EXISTS `bookings` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `booking_code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Mã đơn hàng in cho khách',
  `user_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ID khách hàng (Nếu có tài khoản)',
  `recurring_booking_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `staff_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Nhân viên lễ tân thực hiện đơn',
  `promotion_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Áp dụng mã giảm giá nào',
  `subtotal_court` decimal(12,2) DEFAULT NULL COMMENT 'Tổng tiền thuê sân',
  `subtotal_service` decimal(12,2) DEFAULT NULL COMMENT 'Tổng tiền dịch vụ/hàng hóa',
  `discount_amount` decimal(12,2) DEFAULT '0.00' COMMENT 'Số tiền được giảm trừ',
  `total_price` decimal(12,2) NOT NULL COMMENT 'Số tiền cuối cùng khách phải trả',
  `deposit_amount` decimal(12,2) DEFAULT NULL COMMENT 'Số tiền khách đặt cọc trước',
  `remaining_amount` decimal(12,2) DEFAULT NULL COMMENT 'Số tiền còn phải thu',
  `customer_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Tên khách (Nếu khách vãng lai)',
  `customer_phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'SĐT khách (Nếu khách vãng lai)',
  `check_in_at` datetime DEFAULT NULL COMMENT 'Thời gian vào sân thực tế',
  `check_out_at` datetime DEFAULT NULL COMMENT 'Thời gian trả sân thực tế',
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'pending' COMMENT 'Trạng thái đơn (chờ, đã chơi, hủy)',
  `payment_status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'unpaid' COMMENT 'Tình trạng thanh toán',
  `points_awarded_at` datetime DEFAULT NULL COMMENT 'Thời điểm đơn đã được cộng điểm thành viên',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `booking_code` (`booking_code`),
  KEY `fk_b_user` (`user_id`),
  KEY `fk_b_staff` (`staff_id`),
  KEY `fk_b_promo` (`promotion_id`),
  KEY `idx_recurring` (`recurring_booking_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng chính lưu thông tin đặt sân';

--
-- Dumping data for table `bookings`
--

INSERT INTO `bookings` (`id`, `booking_code`, `user_id`, `recurring_booking_id`, `staff_id`, `promotion_id`, `subtotal_court`, `subtotal_service`, `discount_amount`, `total_price`, `deposit_amount`, `remaining_amount`, `customer_name`, `customer_phone`, `check_in_at`, `check_out_at`, `status`, `payment_status`, `created_at`) VALUES
('067d556e-5e9b-4dec-96b5-057a493545b0', 'BILL_4KV2NN', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', '8ded26f7-3a32-4d98-9f75-aac40c5ca0ce', NULL, NULL, 100000.00, NULL, 0.00, 100000.00, 0.00, 100000.00, 'Nguyen Van A', '0901234567', NULL, NULL, 'pending', 'unpaid', '2026-05-15 05:40:30'),
('0ee9f674-03a7-483d-a8db-c6f60b7078d0', 'BILL_LF2FBQ', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', NULL, NULL, NULL, 200000.00, NULL, 0.00, 200000.00, 0.00, 200000.00, 'Nguyen Van A', '0901234567', NULL, NULL, 'confirmed', 'paid', '2026-05-15 01:54:47'),
('1567c7b3-9fad-499f-b3ee-3964f9e73d06', 'BILL_MHGRWX', NULL, '1d800515-7e5c-4ffd-af3a-59f8da4bdc5f', NULL, NULL, 200000.00, NULL, 0.00, 200000.00, 0.00, 200000.00, 'CLB Cầu Lông Q1', '0901234567', NULL, NULL, 'confirmed', 'paid', '2026-05-13 23:54:49'),
('1ab4d945-5f45-45cc-ba4f-600e7000c772', 'BILL_7PJOR1', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', '26e38450-4565-4b4d-9fec-ee35b8ca706c', NULL, NULL, 100000.00, NULL, 0.00, 100000.00, 0.00, 100000.00, 'Nguyen Van A', '0901234567', NULL, NULL, 'pending', 'unpaid', '2026-05-15 05:35:52'),
('2bd6591f-ee19-4238-84ef-2ef21c9bc93f', 'BILL_YMRURM', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', '8ded26f7-3a32-4d98-9f75-aac40c5ca0ce', NULL, NULL, 100000.00, NULL, 0.00, 100000.00, 0.00, 100000.00, 'Nguyen Van A', '0901234567', NULL, NULL, 'pending', 'unpaid', '2026-05-15 05:40:30'),
('3c9376a0-e985-4753-86b5-be7878a3004c', 'BILL_BDT8RZ', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', '8ded26f7-3a32-4d98-9f75-aac40c5ca0ce', NULL, NULL, 100000.00, NULL, 0.00, 100000.00, 0.00, 100000.00, 'Nguyen Van A', '0901234567', NULL, NULL, 'pending', 'unpaid', '2026-05-15 05:40:30'),
('433eae8f-d11f-45b2-be72-7583e613b2e0', 'BILL_QPSE3B', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', NULL, NULL, NULL, 100000.00, NULL, 0.00, 100000.00, 0.00, 100000.00, 'Nguyen Van A', '0901234567', NULL, NULL, 'confirmed', 'unpaid', '2026-05-15 05:03:55'),
('44ee4327-e920-4473-b1bb-e657ffccd978', 'BILL_WL7SGT', NULL, NULL, NULL, NULL, 160000.00, NULL, 0.00, 160000.00, 0.00, 160000.00, 'em hieu', '03994421192', NULL, NULL, 'confirmed', 'unpaid', '2026-05-16 07:35:50'),
('4a6c8c8c-5276-4d22-8076-6be0bed0676e', 'BILL_PDQWYF', NULL, '1d800515-7e5c-4ffd-af3a-59f8da4bdc5f', NULL, NULL, 200000.00, NULL, 0.00, 200000.00, 0.00, 200000.00, 'CLB Cầu Lông Q1', '0901234567', NULL, NULL, 'confirmed', 'paid', '2026-05-13 23:54:49'),
('5e9d955e-2f77-4c51-b921-1315be2ed35d', 'BILL_IMAO2E', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', '8ded26f7-3a32-4d98-9f75-aac40c5ca0ce', NULL, NULL, 100000.00, NULL, 0.00, 100000.00, 0.00, 100000.00, 'Nguyen Van A', '0901234567', NULL, NULL, 'pending', 'unpaid', '2026-05-15 05:40:30'),
('5f61edec-b9d7-4274-a3ff-0b257026b8e1', 'BILL_6U6NCJ', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', 'ace7cc52-77c4-481a-82a2-094b21fbd392', NULL, NULL, 100000.00, NULL, 0.00, 100000.00, 0.00, 100000.00, 'Nguyen Van A', '0901234567', NULL, NULL, 'cancelled', 'paid', '2026-05-14 05:22:12'),
('61380c70-8456-4dba-b62f-74c754560a02', 'BILL_21MBVB', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', 'ace7cc52-77c4-481a-82a2-094b21fbd392', NULL, NULL, 100000.00, NULL, 0.00, 100000.00, 0.00, 100000.00, 'Nguyen Van A', '0901234567', NULL, NULL, 'pending', 'unpaid', '2026-05-14 05:22:12'),
('6798553f-4ed8-4b59-a6b5-3e66a909dc84', 'BILL_10ONVZ', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', '02844964-980f-409c-b9b8-cb68a58da382', NULL, NULL, 200000.00, NULL, 0.00, 200000.00, 0.00, 200000.00, 'CLB Cầu Lông Q1', '0901234567', NULL, NULL, 'pending', 'unpaid', '2026-05-14 02:56:26'),
('6fe2bf5b-acd0-48c9-a624-12cee1b77aa3', 'BILL_DNA3IW', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', NULL, NULL, NULL, 100000.00, NULL, 0.00, 100000.00, 0.00, 100000.00, 'Nguyen Van A', '0901234567', NULL, NULL, 'cancelled', 'unpaid', '2026-05-15 01:44:47'),
('85356bb7-8fac-42b2-8921-4e415398919d', 'BILL_7DVUNT', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', 'ace7cc52-77c4-481a-82a2-094b21fbd392', NULL, NULL, 100000.00, NULL, 0.00, 100000.00, 0.00, 100000.00, 'Nguyen Van A', '0901234567', NULL, NULL, 'pending', 'unpaid', '2026-05-14 05:22:12'),
('87830699-3306-4fb0-b28d-7bf8c035e392', 'BILL_FXLBM5', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', '8ded26f7-3a32-4d98-9f75-aac40c5ca0ce', NULL, NULL, 100000.00, NULL, 0.00, 100000.00, 0.00, 100000.00, 'Nguyen Van A', '0901234567', NULL, NULL, 'pending', 'unpaid', '2026-05-15 05:40:30'),
('8aae5daa-c3b8-40aa-acd9-46a82acb63b3', 'BILL_NJ5XXC', NULL, NULL, NULL, NULL, 100000.00, NULL, 0.00, 100000.00, 0.00, 100000.00, 'test', '0987654321', NULL, NULL, 'pending', 'unpaid', '2026-05-14 05:38:44'),
('8ceb5d2d-9865-4e4f-91bc-4fcd1dacd434', 'BILL_XBXC7F', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', 'ace7cc52-77c4-481a-82a2-094b21fbd392', NULL, NULL, 100000.00, NULL, 0.00, 100000.00, 0.00, 100000.00, 'Nguyen Van A', '0901234567', NULL, NULL, 'pending', 'unpaid', '2026-05-14 05:22:12'),
('8e6dab31-5df9-4810-bdb2-9ad9898f3562', 'BILL_P2WBXE', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', '02844964-980f-409c-b9b8-cb68a58da382', NULL, NULL, 200000.00, NULL, 0.00, 200000.00, 0.00, 200000.00, 'CLB Cầu Lông Q1', '0901234567', NULL, NULL, 'pending', 'unpaid', '2026-05-14 02:56:26'),
('8f0322f9-b593-4402-b162-4d8b00850780', 'BILL_TST2WT', NULL, NULL, NULL, NULL, 60000.00, NULL, 0.00, 300000.00, 0.00, 60000.00, 'hiu', '0398824492', NULL, NULL, 'confirmed', 'partially_paid', '2026-05-17 22:58:42'),
('9013bbc3-fea1-4185-9716-c9e45df6e8d7', 'BILL_WI2LUQ', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', '02844964-980f-409c-b9b8-cb68a58da382', NULL, NULL, 240000.00, NULL, 0.00, 496000.00, 0.00, 240000.00, 'CLB Cầu Lông Q1', '0901234567', NULL, NULL, 'confirmed', 'unpaid', '2026-05-14 02:56:26'),
('954886e6-531d-4f35-bfe2-7c408390f1aa', 'BILL_M6VXKM', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', '02844964-980f-409c-b9b8-cb68a58da382', NULL, NULL, 120000.00, NULL, 0.00, 120000.00, 0.00, 120000.00, 'CLB Cầu Lông Q1', '0901234567', NULL, NULL, 'pending', 'unpaid', '2026-05-14 02:56:26'),
('960e663d-6a2b-47dd-b768-64bb44b84ef1', 'BILL_VEUR9I', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', '26e38450-4565-4b4d-9fec-ee35b8ca706c', NULL, NULL, 100000.00, NULL, 0.00, 100000.00, 0.00, 100000.00, 'Nguyen Van A', '0901234567', NULL, NULL, 'pending', 'unpaid', '2026-05-15 05:35:52'),
('99173286-aa1b-473d-93a3-0e69cf24ab7d', 'BILL_C5N49J', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', '26e38450-4565-4b4d-9fec-ee35b8ca706c', NULL, NULL, 100000.00, NULL, 0.00, 100000.00, 0.00, 100000.00, 'Nguyen Van A', '0901234567', NULL, NULL, 'pending', 'unpaid', '2026-05-15 05:35:52'),
('9c9351f5-2e5e-48e9-80ea-71c401ee7ff8', 'BILL_8JYGBA', NULL, '1d800515-7e5c-4ffd-af3a-59f8da4bdc5f', NULL, NULL, 200000.00, NULL, 0.00, 200000.00, 0.00, 200000.00, 'CLB Cầu Lông Q1', '0901234567', NULL, NULL, 'pending', 'unpaid', '2026-05-13 23:54:49'),
('9e987661-1a81-484e-92bb-44df08a65423', 'BILL_WGN1YZ', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', '26e38450-4565-4b4d-9fec-ee35b8ca706c', NULL, NULL, 100000.00, NULL, 0.00, 100000.00, 0.00, 100000.00, 'Nguyen Van A', '0901234567', NULL, NULL, 'pending', 'unpaid', '2026-05-15 05:35:52'),
('9ea9ba31-0181-4ae4-8368-e4b5ec194e24', 'BILL_NM6NHA', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', 'ace7cc52-77c4-481a-82a2-094b21fbd392', NULL, NULL, 100000.00, NULL, 0.00, 100000.00, 0.00, 100000.00, 'Nguyen Van A', '0901234567', NULL, NULL, 'pending', 'unpaid', '2026-05-14 05:22:12'),
('a5f2717d-c72a-4d5b-8df8-61ed2fc2bcaf', 'BILL_KBATPX', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', '8ded26f7-3a32-4d98-9f75-aac40c5ca0ce', NULL, NULL, 100000.00, NULL, 0.00, 100000.00, 0.00, 100000.00, 'Nguyen Van A', '0901234567', NULL, NULL, 'pending', 'unpaid', '2026-05-15 05:40:30'),
('ac457610-e7c2-4fa6-99b9-cf2d94fc29ca', 'BILL_BJ0DEC', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', NULL, NULL, NULL, 120000.00, NULL, 0.00, 250000.00, 0.00, 120000.00, 'Trần Hiếu', '0901234567', NULL, NULL, 'confirmed', 'unpaid', '2026-05-14 02:48:45'),
('b362541e-b479-4e54-9f06-82fbe876535d', 'BILL_0OQQE9', NULL, NULL, NULL, NULL, 240000.00, NULL, 0.00, 240000.00, 0.00, 240000.00, 'Trần Hiếu', '0901234567', NULL, NULL, 'pending', 'unpaid', '2026-05-13 01:02:37'),
('bced5b37-385e-436d-9803-84de71d6531b', 'BILL_QOMGED', NULL, '1d800515-7e5c-4ffd-af3a-59f8da4bdc5f', NULL, NULL, 200000.00, NULL, 0.00, 200000.00, 0.00, 200000.00, 'CLB Cầu Lông Q1', '0901234567', NULL, NULL, 'pending', 'unpaid', '2026-05-13 23:54:49'),
('c628fbaf-6f56-46bc-a93a-b8a888a5674c', 'BILL_PYVP7X', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', '26e38450-4565-4b4d-9fec-ee35b8ca706c', NULL, NULL, 100000.00, NULL, 0.00, 100000.00, 0.00, 100000.00, 'Nguyen Van A', '0901234567', NULL, NULL, 'pending', 'unpaid', '2026-05-15 05:35:52'),
('c7ba6cb2-43ba-445c-8452-a62da8e6fca4', 'BILL_JPXMWS', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', '26e38450-4565-4b4d-9fec-ee35b8ca706c', NULL, NULL, 100000.00, NULL, 0.00, 100000.00, 0.00, 100000.00, 'Nguyen Van A', '0901234567', NULL, NULL, 'pending', 'unpaid', '2026-05-15 05:35:52'),
('ce5bad02-fe46-4064-97b6-52616b758979', 'BILL_WZ4QBQ', NULL, NULL, NULL, NULL, 60000.00, NULL, 0.00, 60000.00, 0.00, 60000.00, 'asd', '123', NULL, NULL, 'completed', 'paid', '2026-05-14 05:40:31'),
('d4f5b467-7118-4bc5-b5da-31516de81880', 'BILL_VNHTS3', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', '26e38450-4565-4b4d-9fec-ee35b8ca706c', NULL, NULL, 100000.00, NULL, 0.00, 100000.00, 0.00, 100000.00, 'Nguyen Van A', '0901234567', NULL, NULL, 'confirmed', 'unpaid', '2026-05-15 05:35:52'),
('d9d320c9-93c0-48de-b784-2b7930b99604', 'BILL_KTLPSE', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', 'ace7cc52-77c4-481a-82a2-094b21fbd392', NULL, NULL, 100000.00, NULL, 0.00, 100000.00, 0.00, 100000.00, 'Nguyen Van A', '0901234567', NULL, NULL, 'pending', 'unpaid', '2026-05-14 05:22:12'),
('e9bad740-77d2-49ff-a73f-c760d6eb430f', 'BILL_EMQOIJ', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', 'ace7cc52-77c4-481a-82a2-094b21fbd392', NULL, NULL, 100000.00, NULL, 0.00, 100000.00, 0.00, 100000.00, 'Nguyen Van A', '0901234567', NULL, NULL, 'pending', 'unpaid', '2026-05-14 05:22:12'),
('eebe9ccd-a825-427f-97b6-2dce5320883c', 'BILL_HSCLP3', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', NULL, NULL, NULL, 100000.00, NULL, 0.00, 100000.00, 0.00, 100000.00, 'Nguyen Van A', '0901234567', NULL, NULL, 'cancelled', 'paid', '2026-05-14 05:21:43'),
('f5cdda36-327d-40c4-814b-c9df0787d3b6', 'BILL_ME6WUI', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', 'ace7cc52-77c4-481a-82a2-094b21fbd392', NULL, NULL, 100000.00, NULL, 0.00, 100000.00, 0.00, 100000.00, 'Nguyen Van A', '0901234567', NULL, NULL, 'pending', 'unpaid', '2026-05-14 05:22:12'),
('fa358bde-d73a-41e6-b9e2-8cfb6949afea', 'BILL_XOCWAG', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', '8ded26f7-3a32-4d98-9f75-aac40c5ca0ce', NULL, NULL, 100000.00, NULL, 0.00, 100000.00, 0.00, 100000.00, 'Nguyen Van A', '0901234567', NULL, NULL, 'confirmed', 'unpaid', '2026-05-15 05:40:30'),
('ffe87c4b-0d7f-492d-a1c9-fd2a7719d041', 'BILL_R95PKG', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', 'ace7cc52-77c4-481a-82a2-094b21fbd392', NULL, NULL, 100000.00, NULL, 0.00, 100000.00, 0.00, 100000.00, 'Nguyen Van A', '0901234567', NULL, NULL, 'pending', 'unpaid', '2026-05-14 05:22:12');

-- --------------------------------------------------------

--
-- Table structure for table `booking_details`
--

DROP TABLE IF EXISTS `booking_details`;
CREATE TABLE IF NOT EXISTS `booking_details` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `booking_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Thuộc đơn đặt nào',
  `court_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Thuê sân số mấy',
  `booking_date` date DEFAULT NULL COMMENT 'Ngày chơi',
  `start_time` time DEFAULT NULL COMMENT 'Giờ đặt bắt đầu',
  `end_time` time DEFAULT NULL COMMENT 'Giờ đặt kết thúc',
  `duration_minutes` int DEFAULT NULL COMMENT 'Tổng thời gian thuê (phút)',
  `price_per_hour` decimal(12,2) DEFAULT NULL COMMENT 'Giá sân tại thời điểm chốt đơn',
  `price` decimal(12,2) DEFAULT NULL COMMENT 'Thành tiền thuê sân (chưa overtime)',
  `overtime_minutes` int DEFAULT '0' COMMENT 'Số phút chơi quá giờ',
  `overtime_fee` decimal(12,2) DEFAULT '0.00' COMMENT 'Tiền phạt/phụ thu quá giờ',
  PRIMARY KEY (`id`),
  KEY `fk_bd_booking` (`booking_id`),
  KEY `fk_bd_court` (`court_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Chi tiết giờ giấc thuê của từng sân trong 1 đơn';

--
-- Dumping data for table `booking_details`
--

INSERT INTO `booking_details` (`id`, `booking_id`, `court_id`, `booking_date`, `start_time`, `end_time`, `duration_minutes`, `price_per_hour`, `price`, `overtime_minutes`, `overtime_fee`) VALUES
('05d8efdd-7227-4e16-95bf-1bab9dcad06a', '433eae8f-d11f-45b2-be72-7583e613b2e0', 'b95cc409-3c58-43d6-ae30-c4a37c6e90f6', '2026-05-15', '21:00:00', '22:00:00', 60, 100000.00, 100000.00, 0, 0.00),
('0c6add92-10c9-434b-bce1-b1632395a6f4', '0ee9f674-03a7-483d-a8db-c6f60b7078d0', '8ef9d035-7dc8-419b-9d19-6addc9196826', '2026-05-15', '21:00:00', '22:00:00', 60, 100000.00, 100000.00, 0, 0.00),
('0d85b570-33f6-44cc-b2e5-ff8c876da212', 'c7ba6cb2-43ba-445c-8452-a62da8e6fca4', '71504586-8d59-43ad-ac8f-d40a529651fb', '2026-06-05', '21:00:00', '22:00:00', 60, 100000.00, 100000.00, 0, 0.00),
('0e1f013d-d257-4e98-9008-ff8e42e5f364', 'c628fbaf-6f56-46bc-a93a-b8a888a5674c', '71504586-8d59-43ad-ac8f-d40a529651fb', '2026-05-29', '21:00:00', '22:00:00', 60, 100000.00, 100000.00, 0, 0.00),
('1207edf6-aa90-4b01-aaa9-c45c52b4a873', '8aae5daa-c3b8-40aa-acd9-46a82acb63b3', 'f078a9d4-780a-444d-b6d6-e803bcd7db3c', '2026-05-15', '20:00:00', '21:00:00', 60, 100000.00, 100000.00, 0, 0.00),
('19caf279-f268-4d1d-903a-380ba1a6dc43', 'b362541e-b479-4e54-9f06-82fbe876535d', '1e78caa0-d9db-4e51-bf1b-eb58d3bbf0d5', '2026-05-20', '08:00:00', '10:00:00', 120, 60000.00, 120000.00, 0, 0.00),
('1c216c0e-32eb-413f-8ec1-8a92bdeb9107', 'e9bad740-77d2-49ff-a73f-c760d6eb430f', '71504586-8d59-43ad-ac8f-d40a529651fb', '2026-05-21', '21:00:00', '22:00:00', 60, 100000.00, 100000.00, 0, 0.00),
('1ce7fcd2-d681-48c6-a2cc-62ec446b255d', '3c9376a0-e985-4753-86b5-be7878a3004c', 'f078a9d4-780a-444d-b6d6-e803bcd7db3c', '2026-05-22', '21:00:00', '22:00:00', 60, 100000.00, 100000.00, 0, 0.00),
('23e2dee8-8aed-4588-94a6-c98bef634f3e', '9ea9ba31-0181-4ae4-8368-e4b5ec194e24', '71504586-8d59-43ad-ac8f-d40a529651fb', '2026-06-04', '21:00:00', '22:00:00', 60, 100000.00, 100000.00, 0, 0.00),
('271b36b0-5b8a-40e7-9710-1f3fc8bee90d', '8e6dab31-5df9-4810-bdb2-9ad9898f3562', 'f078a9d4-780a-444d-b6d6-e803bcd7db3c', '2026-06-19', '18:00:00', '20:00:00', 120, 100000.00, 200000.00, 0, 0.00),
('276e16cd-f76a-44d1-8440-2efc3c8e9599', 'd4f5b467-7118-4bc5-b5da-31516de81880', '71504586-8d59-43ad-ac8f-d40a529651fb', '2026-05-15', '21:00:00', '22:00:00', 60, 100000.00, 100000.00, 0, 0.00),
('28058359-5f61-4e62-8ca3-afc6da3aab4d', '5f61edec-b9d7-4274-a3ff-0b257026b8e1', '71504586-8d59-43ad-ac8f-d40a529651fb', '2026-05-14', '21:00:00', '22:00:00', 60, 100000.00, 100000.00, 0, 0.00),
('283a8d96-315b-4536-ba96-136c92ab6095', 'bced5b37-385e-436d-9803-84de71d6531b', 'b95cc409-3c58-43d6-ae30-c4a37c6e90f6', '2026-06-19', '18:00:00', '20:00:00', 120, 100000.00, 200000.00, 0, 0.00),
('3b8493bb-b2d5-4ce9-9a6d-f30bb98b352d', '87830699-3306-4fb0-b28d-7bf8c035e392', 'f078a9d4-780a-444d-b6d6-e803bcd7db3c', '2026-06-26', '21:00:00', '22:00:00', 60, 100000.00, 100000.00, 0, 0.00),
('3d6e7059-bf29-49d6-b717-15f32bf5adb3', 'b362541e-b479-4e54-9f06-82fbe876535d', '1e78caa0-d9db-4e51-bf1b-eb58d3bbf0d5', '2026-05-20', '14:00:00', '16:00:00', 120, 60000.00, 120000.00, 0, 0.00),
('40e3bc78-81ab-486b-9133-b15b214020a5', '5e9d955e-2f77-4c51-b921-1315be2ed35d', 'f078a9d4-780a-444d-b6d6-e803bcd7db3c', '2026-06-05', '21:00:00', '22:00:00', 60, 100000.00, 100000.00, 0, 0.00),
('4d22d465-094b-4c0b-a4bb-87aca9d57264', '9c9351f5-2e5e-48e9-80ea-71c401ee7ff8', 'b95cc409-3c58-43d6-ae30-c4a37c6e90f6', '2026-06-26', '18:00:00', '20:00:00', 120, 100000.00, 200000.00, 0, 0.00),
('586a3896-3a4c-469f-af33-b51fdc4c1b01', '9e987661-1a81-484e-92bb-44df08a65423', '71504586-8d59-43ad-ac8f-d40a529651fb', '2026-06-19', '21:00:00', '22:00:00', 60, 100000.00, 100000.00, 0, 0.00),
('5a91a52e-d99e-45ae-a29e-3294168e130b', '1ab4d945-5f45-45cc-ba4f-600e7000c772', '71504586-8d59-43ad-ac8f-d40a529651fb', '2026-06-26', '21:00:00', '22:00:00', 60, 100000.00, 100000.00, 0, 0.00),
('5e0a2529-b908-47d8-a5ac-0d9677b1535d', '4a6c8c8c-5276-4d22-8076-6be0bed0676e', 'b95cc409-3c58-43d6-ae30-c4a37c6e90f6', '2026-06-05', '18:00:00', '20:00:00', 120, 100000.00, 200000.00, 0, 0.00),
('6189df06-2286-420e-b5a1-dd4e4287142b', '8f0322f9-b593-4402-b162-4d8b00850780', 'b95cc409-3c58-43d6-ae30-c4a37c6e90f6', '2026-05-18', '15:00:00', '16:00:00', 60, 60000.00, 60000.00, 0, 0.00),
('65a9bf3d-8f68-4d98-87d4-762c0329bbe9', 'd9d320c9-93c0-48de-b784-2b7930b99604', '71504586-8d59-43ad-ac8f-d40a529651fb', '2026-07-02', '21:00:00', '22:00:00', 60, 100000.00, 100000.00, 0, 0.00),
('7278f704-8bf9-400f-b5a2-ca5b609da09d', '99173286-aa1b-473d-93a3-0e69cf24ab7d', '71504586-8d59-43ad-ac8f-d40a529651fb', '2026-06-12', '21:00:00', '22:00:00', 60, 100000.00, 100000.00, 0, 0.00),
('75a04bb9-12e7-483a-9193-9a9487a66bbb', '6fe2bf5b-acd0-48c9-a624-12cee1b77aa3', '8ef9d035-7dc8-419b-9d19-6addc9196826', '2026-05-15', '21:00:00', '22:00:00', 60, 100000.00, 100000.00, 0, 0.00),
('7c7ae1d7-5a0c-4084-a9cf-be02834278c1', '0ee9f674-03a7-483d-a8db-c6f60b7078d0', '8ef9d035-7dc8-419b-9d19-6addc9196826', '2026-05-15', '20:00:00', '21:00:00', 60, 100000.00, 100000.00, 0, 0.00),
('82f34ee5-2980-444c-8732-977991c88f40', '960e663d-6a2b-47dd-b768-64bb44b84ef1', '71504586-8d59-43ad-ac8f-d40a529651fb', '2026-05-22', '21:00:00', '22:00:00', 60, 100000.00, 100000.00, 0, 0.00),
('86a16419-dd88-43f0-99f3-9e806f6431a5', '2bd6591f-ee19-4238-84ef-2ef21c9bc93f', 'f078a9d4-780a-444d-b6d6-e803bcd7db3c', '2026-05-29', '21:00:00', '22:00:00', 60, 100000.00, 100000.00, 0, 0.00),
('895c5700-7475-44d5-9f30-4bf55c455af9', '8ceb5d2d-9865-4e4f-91bc-4fcd1dacd434', '71504586-8d59-43ad-ac8f-d40a529651fb', '2026-07-09', '21:00:00', '22:00:00', 60, 100000.00, 100000.00, 0, 0.00),
('8d9334bd-7c74-44af-a52f-3e6a9311115b', 'a5f2717d-c72a-4d5b-8df8-61ed2fc2bcaf', 'f078a9d4-780a-444d-b6d6-e803bcd7db3c', '2026-06-19', '21:00:00', '22:00:00', 60, 100000.00, 100000.00, 0, 0.00),
('9c6bef95-a8e1-4553-b781-cdd32c349336', '44ee4327-e920-4473-b1bb-e657ffccd978', '71504586-8d59-43ad-ac8f-d40a529651fb', '2026-05-17', '06:00:00', '07:00:00', 60, 80000.00, 80000.00, 0, 0.00),
('a2d4ab62-e00b-49ec-a046-dff9b197fd18', 'f5cdda36-327d-40c4-814b-c9df0787d3b6', '71504586-8d59-43ad-ac8f-d40a529651fb', '2026-05-28', '21:00:00', '22:00:00', 60, 100000.00, 100000.00, 0, 0.00),
('aab2fc95-7066-47e8-a698-3420da0dd598', '9013bbc3-fea1-4185-9716-c9e45df6e8d7', 'f078a9d4-780a-444d-b6d6-e803bcd7db3c', '2026-05-16', '18:00:00', '20:00:00', 120, 120000.00, 240000.00, 0, 0.00),
('b498f25f-eef0-4ccf-a88c-63f6993909d6', 'ce5bad02-fe46-4064-97b6-52616b758979', '8ef9d035-7dc8-419b-9d19-6addc9196826', '2026-05-15', '08:00:00', '09:00:00', 60, 60000.00, 60000.00, 0, 0.00),
('b93d18d5-0fbf-4a1d-aaec-2747204cce87', '954886e6-531d-4f35-bfe2-7c408390f1aa', 'f078a9d4-780a-444d-b6d6-e803bcd7db3c', '2026-12-05', '19:00:00', '20:00:00', 60, 120000.00, 120000.00, 0, 0.00),
('c0390448-1f0d-4fff-b395-14edb890fb45', '1567c7b3-9fad-499f-b3ee-3964f9e73d06', 'b95cc409-3c58-43d6-ae30-c4a37c6e90f6', '2026-06-12', '18:00:00', '20:00:00', 120, 100000.00, 200000.00, 0, 0.00),
('c6adf2ee-4225-48c3-b862-6a4c33b2c327', '6798553f-4ed8-4b59-a6b5-3e66a909dc84', 'f078a9d4-780a-444d-b6d6-e803bcd7db3c', '2026-06-12', '18:00:00', '20:00:00', 120, 100000.00, 200000.00, 0, 0.00),
('c85f2139-53fa-461d-baec-b3f90f0d30bb', 'fa358bde-d73a-41e6-b9e2-8cfb6949afea', 'f078a9d4-780a-444d-b6d6-e803bcd7db3c', '2026-05-15', '21:00:00', '22:00:00', 60, 100000.00, 100000.00, 0, 0.00),
('c975618a-d662-411e-b1b7-8cf2b9cdb8fd', 'eebe9ccd-a825-427f-97b6-2dce5320883c', 'b95cc409-3c58-43d6-ae30-c4a37c6e90f6', '2026-05-14', '21:00:00', '22:00:00', 60, 100000.00, 100000.00, 0, 0.00),
('ce546d70-d268-44f0-ba26-f0538012a8f9', 'ac457610-e7c2-4fa6-99b9-cf2d94fc29ca', '71504586-8d59-43ad-ac8f-d40a529651fb', '2026-05-16', '17:00:00', '18:00:00', 60, 120000.00, 120000.00, 0, 0.00),
('dd7dbb8a-f43d-4acf-b6b7-2f1650100422', '85356bb7-8fac-42b2-8921-4e415398919d', '71504586-8d59-43ad-ac8f-d40a529651fb', '2026-06-18', '21:00:00', '22:00:00', 60, 100000.00, 100000.00, 0, 0.00),
('e5523b3d-4139-4217-aeab-f33e4f27538e', '067d556e-5e9b-4dec-96b5-057a493545b0', 'f078a9d4-780a-444d-b6d6-e803bcd7db3c', '2026-06-12', '21:00:00', '22:00:00', 60, 100000.00, 100000.00, 0, 0.00),
('eadb9bcb-a921-4672-8631-24e48391a020', 'ffe87c4b-0d7f-492d-a1c9-fd2a7719d041', '71504586-8d59-43ad-ac8f-d40a529651fb', '2026-06-25', '21:00:00', '22:00:00', 60, 100000.00, 100000.00, 0, 0.00),
('f3ab9570-2f78-4769-b89b-2485705cd547', '44ee4327-e920-4473-b1bb-e657ffccd978', '71504586-8d59-43ad-ac8f-d40a529651fb', '2026-05-17', '05:00:00', '06:00:00', 60, 80000.00, 80000.00, 0, 0.00),
('f6f6b81c-6c0d-4998-9cf4-f6df9ccae658', '61380c70-8456-4dba-b62f-74c754560a02', '71504586-8d59-43ad-ac8f-d40a529651fb', '2026-06-11', '21:00:00', '22:00:00', 60, 100000.00, 100000.00, 0, 0.00);

-- --------------------------------------------------------

--
-- Table structure for table `booking_service_details`
--

DROP TABLE IF EXISTS `booking_service_details`;
CREATE TABLE IF NOT EXISTS `booking_service_details` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `booking_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Thuộc đơn đặt nào',
  `service_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Dịch vụ lẻ (nếu có)',
  `product_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Sản phẩm kho (nếu có)',
  `quantity` int DEFAULT '1' COMMENT 'Số lượng dùng',
  `unit_price` decimal(12,2) DEFAULT NULL COMMENT 'Giá bán lúc nhân viên thêm vào',
  `total_price` decimal(12,2) DEFAULT NULL COMMENT 'Thành tiền dịch vụ',
  `note` text COLLATE utf8mb4_unicode_ci COMMENT 'Yêu cầu riêng (ví dụ: nước không đá)',
  PRIMARY KEY (`id`),
  KEY `fk_bsd_booking` (`booking_id`),
  KEY `fk_bsd_service` (`service_id`),
  KEY `fk_bsd_p` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Chi tiết các dịch vụ/hàng hóa khách dùng kèm';

--
-- Dumping data for table `booking_service_details`
--

INSERT INTO `booking_service_details` (`id`, `booking_id`, `service_id`, `product_id`, `quantity`, `unit_price`, `total_price`, `note`) VALUES
('019e2f7c-7f0b-73be-85e3-b02d3f6af2ad', '9013bbc3-fea1-4185-9716-c9e45df6e8d7', '019e2eea-496b-7203-a558-63991dd9cbfa', NULL, 1, 50000.00, 50000.00, NULL),
('019e2f7c-a1f2-7356-ac13-91bd7cac268e', '9013bbc3-fea1-4185-9716-c9e45df6e8d7', NULL, '019e2f6e-66f6-7382-9697-f1ddc329235f', 2, 13000.00, 26000.00, NULL),
('019e3130-df2b-734f-a085-5c0f55f0931e', 'ac457610-e7c2-4fa6-99b9-cf2d94fc29ca', NULL, '019e2f6e-66f6-7382-9697-f1ddc329235f', 10, 13000.00, 130000.00, NULL),
('019e3130-fab3-7393-8ac0-0dbcbd955a9c', '9013bbc3-fea1-4185-9716-c9e45df6e8d7', '019e2eea-496b-7203-a558-63991dd9cbfa', NULL, 1, 50000.00, 50000.00, NULL),
('019e3133-8b72-7330-a205-e530176d776b', '9013bbc3-fea1-4185-9716-c9e45df6e8d7', NULL, '019e2f6e-66f6-7382-9697-f1ddc329235f', 10, 13000.00, 130000.00, NULL),
('019e39cb-097b-72d7-beef-50fb8ca4018b', '8f0322f9-b593-4402-b162-4d8b00850780', 'e16d5465-4ad0-11f1-b356-0250edbfc5ac', NULL, 1, 80000.00, 80000.00, NULL),
('019e39d2-b369-7078-82f8-35c4bec384d0', '8f0322f9-b593-4402-b162-4d8b00850780', 'e16d5465-4ad0-11f1-b356-0250edbfc5ac', NULL, 1, 80000.00, 80000.00, NULL),
('019e39d2-fe46-70c2-9e3d-2fb76b59b297', '8f0322f9-b593-4402-b162-4d8b00850780', 'e16d542d-4ad0-11f1-b356-0250edbfc5ac', NULL, 1, 30000.00, 30000.00, NULL),
('019e39d3-b2bb-7240-950c-89af97ff342b', '8f0322f9-b593-4402-b162-4d8b00850780', '019e2eea-496b-7203-a558-63991dd9cbfa', NULL, 1, 50000.00, 50000.00, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `cache`
--

DROP TABLE IF EXISTS `cache`;
CREATE TABLE IF NOT EXISTS `cache` (
  `key` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiration` bigint NOT NULL,
  PRIMARY KEY (`key`),
  KEY `cache_expiration_index` (`expiration`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cache_locks`
--

DROP TABLE IF EXISTS `cache_locks`;
CREATE TABLE IF NOT EXISTS `cache_locks` (
  `key` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiration` bigint NOT NULL,
  PRIMARY KEY (`key`),
  KEY `cache_locks_expiration_index` (`expiration`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `categories`
--

DROP TABLE IF EXISTS `categories`;
CREATE TABLE IF NOT EXISTS `categories` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tên danh mục (Nước, Phụ kiện...)',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT 'Mô tả danh mục',
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Phân loại hàng hóa';

--
-- Dumping data for table `categories`
--

INSERT INTO `categories` (`id`, `name`, `description`, `status`) VALUES
('019e2f03-e4fc-70a8-9dc8-a9440ba74874', 'Nước giải khát', 'Các loại nước uống đóng chai', 'active');

-- --------------------------------------------------------

--
-- Table structure for table `courts`
--

DROP TABLE IF EXISTS `courts`;
CREATE TABLE IF NOT EXISTS `courts` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tên sân (ví dụ: Sân số 1)',
  `court_code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Mã sân quản lý nhanh',
  `floor_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Loại mặt sân (PVC, Gỗ)',
  `has_lighting` tinyint(1) DEFAULT '1' COMMENT 'Có hệ thống đèn chiếu sáng không',
  `capacity` int DEFAULT NULL COMMENT 'Sức chứa tối đa (số người)',
  `location_note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Vị trí sân trong trung tâm',
  `is_maintenance` tinyint(1) DEFAULT '0' COMMENT 'Sân đang bảo trì',
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'active' COMMENT 'Sẵn sàng hay dừng hoạt động',
  PRIMARY KEY (`id`),
  UNIQUE KEY `court_code` (`court_code`)
) ;

--
-- Dumping data for table `courts`
--

INSERT INTO `courts` (`id`, `name`, `court_code`, `floor_type`, `has_lighting`, `capacity`, `location_note`, `is_maintenance`, `status`) VALUES
('1e78caa0-d9db-4e51-bf1b-eb58d3bbf0d5', 'Sân 01', 'SAN_001', 'Thảm BWF Tiêu chuẩn', 1, 4, 'Khu vực cụm chính', 0, 'active'),
('71504586-8d59-43ad-ac8f-d40a529651fb', 'Sân 05', 'SAN_005', 'Thảm BWF Tiêu chuẩn', 1, 4, 'Khu vực cuối phòng cạnh sân 4', 0, 'active'),
('8ef9d035-7dc8-419b-9d19-6addc9196826', 'Sân 03', 'SAN_003', 'Thảm BWF Tiêu chuẩn', 1, 4, 'Khu vực cuối phòng', 0, 'active'),
('b95cc409-3c58-43d6-ae30-c4a37c6e90f6', 'Sân 02', 'SAN_002', 'Thảm BWF Tiêu chuẩn', 1, 4, 'Khu vực trung tâm', 0, 'active'),
('f078a9d4-780a-444d-b6d6-e803bcd7db3c', 'Sân 04', 'SAN_004', 'Thảm BWF Tiêu chuẩn', 1, 4, 'Khu vực rìa cạnh sân 1 và 2', 0, 'active');

-- --------------------------------------------------------

--
-- Table structure for table `court_pricing`
--

DROP TABLE IF EXISTS `court_pricing`;
CREATE TABLE IF NOT EXISTS `court_pricing` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `court_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Áp dụng cho sân nào',
  `day_type` enum('weekday','weekend','holiday') COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Loại ngày áp dụng',
  `start_time` time NOT NULL COMMENT 'Giờ bắt đầu khung giờ giá',
  `end_time` time NOT NULL COMMENT 'Giờ kết thúc khung giờ giá',
  `price` decimal(12,2) NOT NULL COMMENT 'Giá thuê mỗi giờ',
  `effective_from` date DEFAULT NULL COMMENT 'Ngày bắt đầu áp dụng bảng giá',
  `effective_to` date DEFAULT NULL COMMENT 'Ngày hết hạn bảng giá',
  `min_booking_minutes` int DEFAULT '60' COMMENT 'Thời gian thuê tối thiểu (phút)',
  PRIMARY KEY (`id`),
  KEY `fk_cp_court` (`court_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng giá thuê sân theo khung giờ';

--
-- Dumping data for table `court_pricing`
--

INSERT INTO `court_pricing` (`id`, `court_id`, `day_type`, `start_time`, `end_time`, `price`, `effective_from`, `effective_to`, `min_booking_minutes`) VALUES
('0ce703d2-90b0-4d49-8dd0-50e388297849', 'b95cc409-3c58-43d6-ae30-c4a37c6e90f6', 'weekday', '05:00:00', '17:00:00', 60000.00, NULL, NULL, 60),
('0d45187e-17a2-4300-873f-2430b126f014', '8ef9d035-7dc8-419b-9d19-6addc9196826', 'weekend', '17:00:00', '22:00:00', 120000.00, NULL, NULL, 60),
('0f171fea-c2cf-4662-9ff9-0179d64644a4', 'b95cc409-3c58-43d6-ae30-c4a37c6e90f6', 'weekend', '17:00:00', '22:00:00', 120000.00, NULL, NULL, 60),
('2b2f35bf-bb74-46d3-989c-94fdc7620e16', '71504586-8d59-43ad-ac8f-d40a529651fb', 'weekend', '17:00:00', '22:00:00', 120000.00, NULL, NULL, 60),
('3d0200cb-ba5e-400d-b80f-13f98145f0d9', '1e78caa0-d9db-4e51-bf1b-eb58d3bbf0d5', 'weekend', '17:00:00', '22:00:00', 120000.00, NULL, NULL, 60),
('423d8e17-8d85-4744-9189-cca1c1d3044e', '1e78caa0-d9db-4e51-bf1b-eb58d3bbf0d5', 'weekday', '05:00:00', '17:00:00', 60000.00, NULL, NULL, 60),
('448f4207-fd81-40a2-91c9-2813b107af56', 'b95cc409-3c58-43d6-ae30-c4a37c6e90f6', 'weekday', '17:00:00', '22:00:00', 100000.00, NULL, NULL, 60),
('4d73ab97-933a-43b9-9e12-48df00b6ec4a', '71504586-8d59-43ad-ac8f-d40a529651fb', 'weekday', '05:00:00', '17:00:00', 60000.00, NULL, NULL, 60),
('56022b86-1064-4a41-b01f-fff952b64af9', '1e78caa0-d9db-4e51-bf1b-eb58d3bbf0d5', 'weekend', '05:00:00', '17:00:00', 80000.00, NULL, NULL, 60),
('58de5493-3149-40ab-81cd-821748034fd1', 'f078a9d4-780a-444d-b6d6-e803bcd7db3c', 'weekend', '05:00:00', '17:00:00', 80000.00, NULL, NULL, 60),
('6e3a66e6-55f0-4a58-9cec-c741f92f8707', 'b95cc409-3c58-43d6-ae30-c4a37c6e90f6', 'weekend', '05:00:00', '17:00:00', 80000.00, NULL, NULL, 60),
('71bc1731-5498-4c77-a3af-dc59c3587db0', '1e78caa0-d9db-4e51-bf1b-eb58d3bbf0d5', 'weekday', '17:00:00', '22:00:00', 100000.00, NULL, NULL, 60),
('9d6c33d4-1377-4d15-b462-e5b9c5e7f303', '71504586-8d59-43ad-ac8f-d40a529651fb', 'weekday', '17:00:00', '22:00:00', 100000.00, NULL, NULL, 60),
('b39b82a6-f381-49ed-8c37-6584d174a6a1', '8ef9d035-7dc8-419b-9d19-6addc9196826', 'weekday', '17:00:00', '22:00:00', 100000.00, NULL, NULL, 60),
('bb80bddc-46c0-4cc3-a6c3-ce2de77884fb', 'f078a9d4-780a-444d-b6d6-e803bcd7db3c', 'weekend', '17:00:00', '22:00:00', 120000.00, NULL, NULL, 60),
('c11cafab-435f-4598-84bd-a017b31051bf', 'f078a9d4-780a-444d-b6d6-e803bcd7db3c', 'weekday', '17:00:00', '22:00:00', 100000.00, NULL, NULL, 60),
('c5b62a3d-152a-46ed-8920-6bd3b3eb5fd9', '8ef9d035-7dc8-419b-9d19-6addc9196826', 'weekend', '05:00:00', '17:00:00', 80000.00, NULL, NULL, 60),
('c5c20e0f-7d04-40df-88b8-2f2514844ed4', '8ef9d035-7dc8-419b-9d19-6addc9196826', 'weekday', '05:00:00', '17:00:00', 60000.00, NULL, NULL, 60),
('e4cd6e5f-a15a-4003-800b-b43aec2edad4', 'f078a9d4-780a-444d-b6d6-e803bcd7db3c', 'weekday', '05:00:00', '17:00:00', 60000.00, NULL, NULL, 60),
('f8ae3f4e-c986-43c9-85dc-40fd849ccb30', '71504586-8d59-43ad-ac8f-d40a529651fb', 'weekend', '05:00:00', '17:00:00', 80000.00, NULL, NULL, 60);

-- --------------------------------------------------------

--
-- Table structure for table `images`
--

DROP TABLE IF EXISTS `images`;
CREATE TABLE IF NOT EXISTS `images` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Đường dẫn/Link ảnh',
  `alt_text` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Mô tả ảnh cho SEO',
  `target_type` enum('court','product','user','category','service') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Ảnh của đối tượng nào',
  `target_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ID của đối tượng tương ứng',
  `sort_order` int DEFAULT '0' COMMENT 'Thứ tự ưu tiên hiển thị',
  `is_primary` tinyint(1) DEFAULT '0' COMMENT 'Có phải ảnh đại diện chính không',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Quản lý hình ảnh dùng chung cho toàn hệ thống';

-- --------------------------------------------------------

--
-- Table structure for table `inventory_transactions`
--

DROP TABLE IF EXISTS `inventory_transactions`;
CREATE TABLE IF NOT EXISTS `inventory_transactions` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `product_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Sản phẩm biến động',
  `transaction_type` enum('import','export','sale','adjustment') COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Loại: Nhập, Xuất, Bán, Điều chỉnh',
  `quantity` int NOT NULL COMMENT 'Số lượng tăng/giảm',
  `before_quantity` int DEFAULT NULL COMMENT 'Tồn kho trước khi đổi',
  `after_quantity` int DEFAULT NULL COMMENT 'Tồn kho sau khi đổi',
  `reference_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Nguồn: Booking, PurchaseOrder...',
  `reference_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ID chứng từ gốc',
  `note` text COLLATE utf8mb4_unicode_ci COMMENT 'Lý do thay đổi kho',
  `created_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Người thực hiện',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_it_p` (`product_id`),
  KEY `fk_it_user` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Lịch sử chi tiết mọi biến động kho hàng';

--
-- Dumping data for table `inventory_transactions`
--

INSERT INTO `inventory_transactions` (`id`, `product_id`, `transaction_type`, `quantity`, `before_quantity`, `after_quantity`, `reference_type`, `reference_id`, `note`, `created_by`, `created_at`) VALUES
('019e2f6f-7d2c-71d2-8b63-c4cbf2cae935', '019e2f6e-66f6-7382-9697-f1ddc329235f', 'import', 100, 0, 100, 'purchase_order', '019e2f6f-7d29-7257-999a-470073f055a3', 'Nhập hàng từ phiếu PO_RL3C9R', '11111111-1111-1111-1111-111111111111', '2026-05-15 23:18:16'),
('019e2f6f-c585-7322-a6ed-96b7526b4d38', '019e2f6e-66f6-7382-9697-f1ddc329235f', 'export', -10, 100, 90, 'manual_adjustment', NULL, 'khách mua 10', '11111111-1111-1111-1111-111111111111', '2026-05-15 23:18:34'),
('019e2f7c-a1f1-7109-94c3-5742d95bee3a', '019e2f6e-66f6-7382-9697-f1ddc329235f', 'sale', -2, 90, 88, 'booking', '9013bbc3-fea1-4185-9716-c9e45df6e8d7', 'Bán cho hóa đơn BILL_WI2LUQ', '11111111-1111-1111-1111-111111111111', '2026-05-15 23:32:37'),
('019e3130-deeb-73dd-9da9-ab644873f4c8', '019e2f6e-66f6-7382-9697-f1ddc329235f', 'sale', -10, 88, 78, 'booking', 'ac457610-e7c2-4fa6-99b9-cf2d94fc29ca', 'Bán cho hóa đơn BILL_BJ0DEC', '11111111-1111-1111-1111-111111111111', '2026-05-16 07:29:06'),
('019e3133-8b6f-7100-90ef-f0e10238e141', '019e2f6e-66f6-7382-9697-f1ddc329235f', 'sale', -10, 78, 68, 'booking', '9013bbc3-fea1-4185-9716-c9e45df6e8d7', 'Bán cho hóa đơn BILL_WI2LUQ', '11111111-1111-1111-1111-111111111111', '2026-05-16 07:32:02');

-- --------------------------------------------------------

--
-- Table structure for table `migrations`
--

DROP TABLE IF EXISTS `migrations`;
CREATE TABLE IF NOT EXISTS `migrations` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `migration` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `batch` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `migrations`
--

INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES
(1, '2026_05_08_103437_create_personal_access_tokens_table', 1),
(2, '2026_05_13_074354_create_cache_table', 2);

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `receiver_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Người nhận thông báo',
  `sender_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Người gửi hoặc ID hệ thống',
  `title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Tiêu đề thông báo',
  `content` text COLLATE utf8mb4_unicode_ci COMMENT 'Nội dung thông báo',
  `is_read` tinyint(1) DEFAULT '0' COMMENT 'Đã đọc hay chưa',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_n_user` (`receiver_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Hệ thống gửi thông báo cho User';

-- --------------------------------------------------------

--
-- Table structure for table `payments`
--

DROP TABLE IF EXISTS `payments`;
CREATE TABLE IF NOT EXISTS `payments` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `payment_code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Mã chứng từ thanh toán',
  `booking_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Thanh toán cho đơn nào',
  `user_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Người trả tiền',
  `payment_method` enum('cash','vnpay','momo','bank_transfer','card') COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Phương thức',
  `amount` decimal(12,2) DEFAULT NULL COMMENT 'Số tiền thực thu',
  `paid_at` datetime DEFAULT NULL COMMENT 'Thời điểm giao dịch thành công',
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'success',
  PRIMARY KEY (`id`),
  UNIQUE KEY `payment_code` (`payment_code`),
  KEY `fk_pay_booking` (`booking_id`),
  KEY `fk_pay_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Lịch sử dòng tiền vào';

-- --------------------------------------------------------

--
-- Table structure for table `personal_access_tokens`
--

DROP TABLE IF EXISTS `personal_access_tokens`;
CREATE TABLE IF NOT EXISTS `personal_access_tokens` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `tokenable_type` varchar(191) NOT NULL,
  `tokenable_id` char(36) NOT NULL COMMENT 'UUID của User',
  `name` varchar(191) NOT NULL,
  `token` varchar(64) NOT NULL,
  `abilities` text,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`),
  KEY `tokenable_index` (`tokenable_type`,`tokenable_id`)
) ENGINE=InnoDB AUTO_INCREMENT=113 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `personal_access_tokens`
--

INSERT INTO `personal_access_tokens` (`id`, `tokenable_type`, `tokenable_id`, `name`, `token`, `abilities`, `last_used_at`, `expires_at`, `created_at`, `updated_at`) VALUES
(1, 'App\\Models\\User', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', 'auth_token', '94d2cca6767d3e71808d8e5a604c7f484a47d0a9cfa83ef5943cbd94695e3b91', '[\"*\"]', NULL, NULL, '2026-05-08 04:04:22', '2026-05-08 04:04:22'),
(2, 'App\\Models\\User', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', 'auth_token', '36e837faab2ea7fe1efca73c9f096c99f10020e15831e3e4027156292f2b685a', '[\"*\"]', '2026-05-08 04:23:18', NULL, '2026-05-08 04:06:31', '2026-05-08 04:23:18'),
(3, 'App\\Models\\User', '11111111-1111-1111-1111-111111111111', 'auth_token', '77d8991490c8319c136801873899120f01f461e7b07a9d716c13496128daeb9a', '[\"*\"]', '2026-05-09 10:40:41', NULL, '2026-05-09 10:37:33', '2026-05-09 10:40:41'),
(4, 'App\\Models\\User', '11111111-1111-1111-1111-111111111111', 'auth_token', '4aada3a284fb3ab22164a1a43166f42e84c67e420aa0e2a2ff3f0f26de4c5463', '[\"*\"]', '2026-05-09 11:22:15', NULL, '2026-05-09 10:47:14', '2026-05-09 11:22:15'),
(5, 'App\\Models\\User', '11111111-1111-1111-1111-111111111111', 'auth_token', '21ca08c7667541735a6978e19d9e220d7a4ccedc9ad2581bc7a6f7421e5329f4', '[\"*\"]', '2026-05-09 11:14:08', NULL, '2026-05-09 11:14:02', '2026-05-09 11:14:08'),
(6, 'App\\Models\\User', '11111111-1111-1111-1111-111111111111', 'auth_token', '623c2b12133c54670168ab15d86cdc64105ed4f22b404e9d5d9257cf753f5f3f', '[\"*\"]', '2026-05-12 00:56:28', NULL, '2026-05-09 11:16:18', '2026-05-12 00:56:28'),
(7, 'App\\Models\\User', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', 'auth_token', '6aa28d408df4ef9f84fac590f1867b6463533da63249be6079c364702dc8d02e', '[\"*\"]', NULL, NULL, '2026-05-11 07:30:38', '2026-05-11 07:30:38'),
(8, 'App\\Models\\User', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', 'auth_token', '36c6b2c8561e3e2219dd6fd81100f61826a033547bc2f0764cccba11e3f52645', '[\"*\"]', NULL, NULL, '2026-05-11 07:31:45', '2026-05-11 07:31:45'),
(9, 'App\\Models\\User', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', 'auth_token', 'c19843ec038df89b64615cdcc55b89cbf1546366d0a2dce0e7599c6535522896', '[\"*\"]', NULL, NULL, '2026-05-11 07:31:56', '2026-05-11 07:31:56'),
(10, 'App\\Models\\User', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', 'auth_token', '60f7612bd403f3ca987d2516cf83aee3a6db3978828c89ea837c9538f17660b1', '[\"*\"]', NULL, NULL, '2026-05-11 07:36:33', '2026-05-11 07:36:33'),
(11, 'App\\Models\\User', '11111111-1111-1111-1111-111111111111', 'auth_token', '3475316182b457107759583c0d6af39caade772ec9f3e62b35eb8892eb6cfb20', '[\"*\"]', NULL, NULL, '2026-05-11 07:44:38', '2026-05-11 07:44:38'),
(12, 'App\\Models\\User', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', 'auth_token', '787c54ad49ebbfeaf784f6d37eda94bd6210aee67523cfbcc546b8b11aff3dee', '[\"*\"]', '2026-05-11 07:49:43', NULL, '2026-05-11 07:49:36', '2026-05-11 07:49:43'),
(13, 'App\\Models\\User', '11111111-1111-1111-1111-111111111111', 'auth_token', '27329804e1d1cefd048645d32304cf450db5b1f554723e4cddd7aacd852ffd89', '[\"*\"]', NULL, NULL, '2026-05-11 07:50:22', '2026-05-11 07:50:22'),
(14, 'App\\Models\\User', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', 'auth_token', 'd512dfe89273d0c8e3e55308cdc3279b2b9b5373bff65b208af77affdda2588f', '[\"*\"]', NULL, NULL, '2026-05-11 07:51:06', '2026-05-11 07:51:06'),
(17, 'App\\Models\\User', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', 'auth_token', '3d1330648601f3f01c413781d37c9ffab1165220ed03424f6d19ccbef0b0f245', '[\"*\"]', NULL, NULL, '2026-05-11 08:03:09', '2026-05-11 08:03:09'),
(18, 'App\\Models\\User', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', 'auth_token', '862db834cf6f20ada75dd304e56ad39ca329e0256ff92781ca325c58e1f064ee', '[\"*\"]', NULL, NULL, '2026-05-11 08:09:55', '2026-05-11 08:09:55'),
(39, 'App\\Models\\User', '11111111-1111-1111-1111-111111111111', 'auth_token', 'b9ecf63946dde47a28c8955cb4baab03d92082049294a676588fdb67fc62da3f', '[\"*\"]', '2026-05-12 01:02:43', NULL, '2026-05-12 00:56:43', '2026-05-12 01:02:43'),
(40, 'App\\Models\\User', '11111111-1111-1111-1111-111111111111', 'auth_token', 'c611ac627d03c0b838b0a4397e75a47c1477953afbe7f580cbb6d56085a8cb90', '[\"*\"]', '2026-05-12 01:05:45', NULL, '2026-05-12 01:03:42', '2026-05-12 01:05:45'),
(42, 'App\\Models\\User', '11111111-1111-1111-1111-111111111111', 'auth_token', 'c415fe76e91dd70c46a42c832df43dda00485747db353fb328d83ac2cdd85e68', '[\"*\"]', '2026-05-12 01:11:25', NULL, '2026-05-12 01:08:52', '2026-05-12 01:11:25'),
(57, 'App\\Models\\User', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', 'auth_token', 'f1f030d1df41dee8fb4140f740cfbc03ac87208ec77e282bba07b1faa18dc8b9', '[\"*\"]', '2026-05-14 00:15:36', NULL, '2026-05-14 00:11:34', '2026-05-14 00:15:36'),
(58, 'App\\Models\\User', '11111111-1111-1111-1111-111111111111', 'auth_token', 'e175bea1956a39aa977df0645aa9f47230caaebd04503b36675ac0945e37510b', '[\"*\"]', '2026-05-15 04:43:56', NULL, '2026-05-14 00:26:20', '2026-05-15 04:43:56'),
(63, 'App\\Models\\User', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', 'auth_token', '35a18f413d2dc04378d304ec80bec09912b659e69bae351009954c2012ae29d1', '[\"*\"]', '2026-05-14 02:56:26', NULL, '2026-05-14 02:39:24', '2026-05-14 02:56:26'),
(64, 'App\\Models\\User', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', 'auth_token', '0df06e1e207aeefac23e0623a07dca930e3becb032c06a99e8984a224e19d3cf', '[\"*\"]', '2026-05-14 02:56:54', NULL, '2026-05-14 02:48:07', '2026-05-14 02:56:54'),
(73, 'App\\Models\\User', '11111111-1111-1111-1111-111111111111', 'auth_token', '082ac424a740d00afe5cfaa580a4d9040a70baf05e44e3b6e53fdab4b4088ddc', '[\"*\"]', '2026-05-14 23:23:58', NULL, '2026-05-14 23:09:24', '2026-05-14 23:23:58'),
(90, 'App\\Models\\User', '11111111-1111-1111-1111-111111111111', 'auth_token', '72b7be45f61c223ef7859ead210c1cd4c33513353afe00ff635aaa00e11f5e8d', '[\"*\"]', '2026-05-15 21:17:57', NULL, '2026-05-15 20:35:08', '2026-05-15 21:17:57'),
(91, 'App\\Models\\User', '11111111-1111-1111-1111-111111111111', 'auth_token', '30f90834383326821f9cd31d8da9d1977b7a6b16b781dc3815b7ccf924390fa6', '[\"*\"]', '2026-05-15 21:19:24', NULL, '2026-05-15 21:18:56', '2026-05-15 21:19:24'),
(92, 'App\\Models\\User', '11111111-1111-1111-1111-111111111111', 'auth_token', '8c826bf464290328dfc1ea55f515e1033cbc30e6308a61adcb5d5d3f0c984371', '[\"*\"]', '2026-05-15 22:15:29', NULL, '2026-05-15 21:19:34', '2026-05-15 22:15:29'),
(111, 'App\\Models\\User', '11111111-1111-1111-1111-111111111111', 'auth_token', 'ee13371d13f947e7de7d00dc0782609b4513e35502a4aa5f842507c9834bfa77', '[\"*\"]', '2026-05-17 23:56:19', NULL, '2026-05-17 23:56:08', '2026-05-17 23:56:19'),
(112, 'App\\Models\\User', '11111111-1111-1111-1111-111111111111', 'auth_token', '3f64c23295a08347ab5d1a78fd6d5d13a5ac235467df207a8686f0dcab984b51', '[\"*\"]', NULL, NULL, '2026-05-18 00:21:05', '2026-05-18 00:21:05');

-- --------------------------------------------------------

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
CREATE TABLE IF NOT EXISTS `products` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `category_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Thuộc danh mục nào',
  `brand` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Thương hiệu sản phẩm',
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tên hàng hóa/sản phẩm',
  `sku` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Mã kho (Barcode)',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT 'Mô tả chi tiết',
  `short_description` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Mô tả ngắn hiển thị nhanh',
  `material` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Chất liệu sản phẩm',
  `origin` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Xuất xứ',
  `selling_price` decimal(12,2) NOT NULL DEFAULT '0.00',
  `sold_count` int DEFAULT '0' COMMENT 'Tổng số lượng đã bán',
  `stock_quantity` int DEFAULT '0' COMMENT 'Số lượng còn trong kho',
  `low_stock_threshold` int DEFAULT '5' COMMENT 'Ngưỡng cảnh báo sắp hết hàng',
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sku` (`sku`),
  KEY `fk_p_cat` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Danh sách hàng hóa bán tại quầy';

--
-- Dumping data for table `products`
--

INSERT INTO `products` (`id`, `category_id`, `brand`, `name`, `sku`, `description`, `short_description`, `material`, `origin`, `selling_price`, `sold_count`, `stock_quantity`, `low_stock_threshold`, `status`, `created_at`, `updated_at`) VALUES
('019e2f6e-66f6-7382-9697-f1ddc329235f', '019e2f03-e4fc-70a8-9dc8-a9440ba74874', 'Nước ngọt', 'Sting đỏ', 'Sting', NULL, NULL, NULL, NULL, 13000.00, 22, 68, 10, 'active', '2026-05-15 23:17:05', '2026-05-16 07:32:02');

-- --------------------------------------------------------

--
-- Table structure for table `promotions`
--

DROP TABLE IF EXISTS `promotions`;
CREATE TABLE IF NOT EXISTS `promotions` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Mã giảm giá (ví dụ: GIAM30)',
  `name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Tên chương trình',
  `discount_type` enum('fixed','percent') COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Kiểu giảm: tiền mặt hay %',
  `discount_value` decimal(12,2) DEFAULT NULL COMMENT 'Giá trị giảm',
  `per_user_limit` int DEFAULT NULL COMMENT 'Giới hạn số lần dùng mỗi khách',
  `min_points_required` int DEFAULT '0' COMMENT 'Điểm tích lũy cần có để dùng',
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Chương trình ưu đãi và Voucher';

-- --------------------------------------------------------

--
-- Table structure for table `purchase_orders`
--

DROP TABLE IF EXISTS `purchase_orders`;
CREATE TABLE IF NOT EXISTS `purchase_orders` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `supplier_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Nhập từ nhà cung cấp nào',
  `purchase_code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Mã phiếu nhập (ví dụ: PN001)',
  `total_amount` decimal(12,2) DEFAULT NULL COMMENT 'Tổng tiền nhập hàng',
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'pending' COMMENT 'Trạng thái: chờ hàng, đã nhập...',
  `created_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Nhân viên lập phiếu',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `purchase_code` (`purchase_code`),
  KEY `fk_po_sup` (`supplier_id`),
  KEY `fk_po_user` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Lịch sử nhập hàng hóa';

--
-- Dumping data for table `purchase_orders`
--

INSERT INTO `purchase_orders` (`id`, `supplier_id`, `purchase_code`, `total_amount`, `status`, `created_by`, `created_at`) VALUES
('019e2f6f-7d29-7257-999a-470073f055a3', '019e2f6e-dc41-70d5-8c38-ea8f727e09d2', 'PO_RL3C9R', 100000000.00, 'completed', '11111111-1111-1111-1111-111111111111', '2026-05-15 23:18:16');

-- --------------------------------------------------------

--
-- Table structure for table `purchase_order_details`
--

DROP TABLE IF EXISTS `purchase_order_details`;
CREATE TABLE IF NOT EXISTS `purchase_order_details` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `purchase_order_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Thuộc phiếu nhập nào',
  `product_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Sản phẩm được nhập',
  `quantity` int NOT NULL COMMENT 'Số lượng nhập',
  `import_price` decimal(12,2) NOT NULL COMMENT 'Giá vốn nhập vào',
  `total_price` decimal(12,2) DEFAULT NULL COMMENT 'Thành tiền chi tiết',
  PRIMARY KEY (`id`),
  KEY `fk_pod_po` (`purchase_order_id`),
  KEY `fk_pod_p` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Chi tiết các mặt hàng trong mỗi lần nhập';

--
-- Dumping data for table `purchase_order_details`
--

INSERT INTO `purchase_order_details` (`id`, `purchase_order_id`, `product_id`, `quantity`, `import_price`, `total_price`) VALUES
('019e2f6f-7d2a-7089-bcbf-866027a1c8b8', '019e2f6f-7d29-7257-999a-470073f055a3', '019e2f6e-66f6-7382-9697-f1ddc329235f', 100, 1000000.00, 100000000.00);

-- --------------------------------------------------------

--
-- Table structure for table `recurring_bookings`
--

DROP TABLE IF EXISTS `recurring_bookings`;
CREATE TABLE IF NOT EXISTS `recurring_bookings` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `user_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Khách hàng đặt lịch',
  `court_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Sân đặt cố định',
  `recurring_code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Mã lịch cố định (Lịch tháng/năm)',
  `day_of_week` tinyint DEFAULT NULL COMMENT 'Thứ trong tuần (1 là Thứ 2, 7 là CN)',
  `start_time` time DEFAULT NULL COMMENT 'Giờ bắt đầu hàng tuần',
  `end_time` time DEFAULT NULL COMMENT 'Giờ kết thúc hàng tuần',
  `start_date` date DEFAULT NULL COMMENT 'Ngày bắt đầu kỳ lịch',
  `end_date` date DEFAULT NULL COMMENT 'Ngày kết thúc kỳ lịch',
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  PRIMARY KEY (`id`),
  UNIQUE KEY `recurring_code` (`recurring_code`),
  KEY `fk_rb_user` (`user_id`),
  KEY `fk_rb_court` (`court_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Quản lý khách thuê sân cố định hàng tuần';

--
-- Dumping data for table `recurring_bookings`
--

INSERT INTO `recurring_bookings` (`id`, `user_id`, `court_id`, `recurring_code`, `day_of_week`, `start_time`, `end_time`, `start_date`, `end_date`, `status`) VALUES
('02844964-980f-409c-b9b8-cb68a58da382', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', 'f078a9d4-780a-444d-b6d6-e803bcd7db3c', 'REC_EKJVKI', 5, '18:00:00', '20:00:00', '2026-06-01', '2026-06-30', 'active'),
('1d800515-7e5c-4ffd-af3a-59f8da4bdc5f', NULL, 'b95cc409-3c58-43d6-ae30-c4a37c6e90f6', 'REC_TNSWTT', 5, '18:00:00', '20:00:00', '2026-06-01', '2026-06-30', 'active'),
('26e38450-4565-4b4d-9fec-ee35b8ca706c', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', '71504586-8d59-43ad-ac8f-d40a529651fb', 'REC_XCJ1YS', 5, '21:00:00', '22:00:00', '2026-05-15', '2026-06-28', 'active'),
('8ded26f7-3a32-4d98-9f75-aac40c5ca0ce', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', 'f078a9d4-780a-444d-b6d6-e803bcd7db3c', 'REC_PPIM7J', 5, '21:00:00', '22:00:00', '2026-05-15', '2026-06-28', 'active'),
('ace7cc52-77c4-481a-82a2-094b21fbd392', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', '71504586-8d59-43ad-ac8f-d40a529651fb', 'REC_TQKYTA', 4, '21:00:00', '22:00:00', '2026-05-14', '2026-07-11', 'active');

-- --------------------------------------------------------

--
-- Table structure for table `refunds`
--

DROP TABLE IF EXISTS `refunds`;
CREATE TABLE IF NOT EXISTS `refunds` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `payment_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Hoàn từ giao dịch nào',
  `amount` decimal(12,2) DEFAULT NULL COMMENT 'Số tiền hoàn lại',
  `reason` text COLLATE utf8mb4_unicode_ci COMMENT 'Lý do hoàn trả (Hủy sân...)',
  `processed_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Nhân viên thực hiện hoàn tiền',
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'processed',
  PRIMARY KEY (`id`),
  KEY `fk_rf_payment` (`payment_id`),
  KEY `fk_rf_user` (`processed_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Quản lý chi trả hoàn tiền cho khách';

-- --------------------------------------------------------

--
-- Table structure for table `reviews`
--

DROP TABLE IF EXISTS `reviews`;
CREATE TABLE IF NOT EXISTS `reviews` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `user_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Người đánh giá',
  `target_type` enum('court','service') COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Đối tượng: Sân hay Dịch vụ',
  `target_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ID của sân/dịch vụ được đánh giá',
  `booking_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Liên kết tới đơn hàng đã trải nghiệm',
  `rating` int DEFAULT NULL COMMENT 'Số sao (1-5)',
  `comment` text COLLATE utf8mb4_unicode_ci COMMENT 'Nội dung phản hồi của khách',
  `staff_reply` text COLLATE utf8mb4_unicode_ci COMMENT 'Phản hồi lại của trung tâm',
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'pending' COMMENT 'Trạng thái kiểm duyệt: pending, approved, hidden',
  PRIMARY KEY (`id`),
  KEY `fk_rv_user` (`user_id`),
  KEY `fk_rv_booking` (`booking_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Phản hồi khách hàng';

-- --------------------------------------------------------

--
-- Table structure for table `staff_shifts`
--

DROP TABLE IF EXISTS `staff_shifts`;
CREATE TABLE IF NOT EXISTS `staff_shifts` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `staff_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ID nhân viên trực',
  `shift_date` date NOT NULL COMMENT 'Ngày trực',
  `shift_name` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Tên ca (Sáng, Chiều, Tối)',
  `start_time` time DEFAULT NULL COMMENT 'Giờ bắt đầu quy định',
  `end_time` time DEFAULT NULL COMMENT 'Giờ kết thúc quy định',
  `check_in_time` datetime DEFAULT NULL COMMENT 'Giờ vào ca thực tế (điểm danh)',
  `check_out_time` datetime DEFAULT NULL COMMENT 'Giờ ra ca thực tế (điểm danh)',
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'scheduled' COMMENT 'Trạng thái: đã xếp, hoàn thành...',
  `note` text COLLATE utf8mb4_unicode_ci COMMENT 'Ghi chú bàn giao công việc giữa các ca',
  PRIMARY KEY (`id`),
  KEY `fk_ss_staff` (`staff_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Quản lý lịch trực nhân viên';

-- --------------------------------------------------------

--
-- Table structure for table `suppliers`
--

DROP TABLE IF EXISTS `suppliers`;
CREATE TABLE IF NOT EXISTS `suppliers` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tên nhà cung cấp',
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'SĐT liên hệ',
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Email liên hệ',
  `address` text COLLATE utf8mb4_unicode_ci COMMENT 'Địa chỉ công ty',
  `contact_person` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Người đại diện làm việc',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Quản lý đối tác cung cấp hàng';

--
-- Dumping data for table `suppliers`
--

INSERT INTO `suppliers` (`id`, `name`, `phone`, `email`, `address`, `contact_person`) VALUES
('019e2f6e-dc41-70d5-8c38-ea8f727e09d2', 'Em híu', '03944211922', 'ngochieu21192@gmail.com', 'nhà bè', 'Em híu');

-- --------------------------------------------------------

--
-- Table structure for table `system_settings`
--

DROP TABLE IF EXISTS `system_settings`;
CREATE TABLE IF NOT EXISTS `system_settings` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `setting_key` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Tên cấu hình (ví dụ: VAT_RATE, CENTER_NAME)',
  `setting_value` text COLLATE utf8mb4_unicode_ci COMMENT 'Giá trị cấu hình',
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Lưu các tham số cài đặt của phần mềm';

--
-- Dumping data for table `system_settings`
--

INSERT INTO `system_settings` (`id`, `setting_key`, `setting_value`) VALUES
('e16f2fba-4ad0-11f1-b356-0250edbfc5ac', 'club_name', 'Hệ thống Sân Cầu Lông NH Badminton'),
('e16f3254-4ad0-11f1-b356-0250edbfc5ac', 'opening_time', '05:00:00'),
('e16f32ca-4ad0-11f1-b356-0250edbfc5ac', 'closing_time', '22:00:00'),
('e16f330e-4ad0-11f1-b356-0250edbfc5ac', 'hotline', '0123456789'),
('e16f3351-4ad0-11f1-b356-0250edbfc5ac', 'address', '123 Đường Cầu Lông, Quận Thể Thao, TP. HCM');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
CREATE TABLE IF NOT EXISTS `users` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()) COMMENT 'Khóa chính UUID',
  `full_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Họ và tên người dùng',
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Địa chỉ email',
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Số điện thoại đăng nhập',
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Mật khẩu đã mã hóa',
  `role` enum('admin','staff','customer') COLLATE utf8mb4_unicode_ci DEFAULT 'customer' COMMENT 'Phân quyền hệ thống',
  `gender` enum('male','female','other') COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Giới tính',
  `date_of_birth` date DEFAULT NULL COMMENT 'Ngày sinh (để tặng voucher sinh nhật)',
  `customer_code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Mã khách hàng nội bộ (ví dụ: KH001)',
  `membership_level` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Hạng thành viên (Đồng, Bạc, Vàng...)',
  `points` int DEFAULT '0' COMMENT 'Điểm tích lũy thăng hạng/giảm giá',
  `total_spent` decimal(12,2) DEFAULT '0.00' COMMENT 'Tổng số tiền đã chi tiêu thực tế',
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'active' COMMENT 'Trạng thái: active, blocked',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `phone` (`phone`),
  UNIQUE KEY `customer_code` (`customer_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Thông tin tài khoản người dùng';

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `full_name`, `email`, `phone`, `password_hash`, `role`, `gender`, `date_of_birth`, `customer_code`, `membership_level`, `points`, `total_spent`, `status`, `created_at`, `updated_at`) VALUES
('11111111-1111-1111-1111-111111111111', 'Admin Quản Lý', 'admin@nhbadminton.com', '0999999999', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 'male', NULL, NULL, NULL, 0, 0.00, 'active', '2026-05-08 11:27:22', '2026-05-08 11:27:22'),
('22222222-2222-2222-2222-222222222222', 'Nhân viên Lễ Tân', 'staff@nhbadminton.com', '0888888888', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'staff', 'female', NULL, NULL, NULL, 0, 0.00, 'active', '2026-05-08 11:27:22', '2026-05-08 11:27:22'),
('33333333-3333-3333-3333-333333333333', 'Khách hàng Khách', 'khachhang@example.com', '0777777777', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'customer', 'male', NULL, NULL, NULL, 0, 0.00, 'active', '2026-05-08 11:27:22', '2026-05-08 11:27:22'),
('ceadf6cb-5741-4b0c-8c76-0eebeb00b925', 'Nguyen Van A', 'vana@example.com', '0901234567', '$2y$12$xfgt2iT/7cud2NwSQ6A/8OFNYYUg4hWAP04DXy4TsWxNZi0dMOyZe', 'customer', NULL, NULL, NULL, NULL, 0, 0.00, 'active', '2026-05-08 03:50:54', '2026-05-11 08:24:52');

-- --------------------------------------------------------

--
-- Table structure for table `user_addresses`
--

DROP TABLE IF EXISTS `user_addresses`;
CREATE TABLE IF NOT EXISTS `user_addresses` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `user_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Liên kết tới tài khoản User',
  `province` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Tỉnh/Thành phố',
  `district` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Quận/Huyện',
  `ward` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Phường/Xã',
  `address_line` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Địa chỉ chi tiết (Số nhà, tên đường)',
  `address_type` enum('home','office','other') COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Loại địa chỉ',
  `is_default` tinyint(1) DEFAULT '0' COMMENT 'Địa chỉ chính để giao hàng/liên hệ',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_ua_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Danh sách địa chỉ của người dùng';

--
-- Dumping data for table `user_addresses`
--

INSERT INTO `user_addresses` (`id`, `user_id`, `province`, `district`, `ward`, `address_line`, `address_type`, `is_default`, `created_at`) VALUES
('91c385a1-3f10-4fb9-a089-1e6b1d90bc98', 'ceadf6cb-5741-4b0c-8c76-0eebeb00b925', 'TP. Hồ Chí Minh', 'Quận 1', 'Phường Bến Nghé', '456 Nguyễn Huệ', 'office', 1, '2026-05-08 11:18:54');

--
-- Constraints for dumped tables
--

--
-- Constraints for table `bookings`
--
ALTER TABLE `bookings`
  ADD CONSTRAINT `fk_b_promo` FOREIGN KEY (`promotion_id`) REFERENCES `promotions` (`id`),
  ADD CONSTRAINT `fk_b_staff` FOREIGN KEY (`staff_id`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `fk_b_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `fk_bookings_recurring` FOREIGN KEY (`recurring_booking_id`) REFERENCES `recurring_bookings` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `booking_details`
--
ALTER TABLE `booking_details`
  ADD CONSTRAINT `fk_bd_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_bd_court` FOREIGN KEY (`court_id`) REFERENCES `courts` (`id`);

--
-- Constraints for table `booking_service_details`
--
ALTER TABLE `booking_service_details`
  ADD CONSTRAINT `fk_bsd_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_bsd_p` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  ADD CONSTRAINT `fk_bsd_service` FOREIGN KEY (`service_id`) REFERENCES `additional_services` (`id`);

--
-- Constraints for table `court_pricing`
--
ALTER TABLE `court_pricing`
  ADD CONSTRAINT `fk_cp_court` FOREIGN KEY (`court_id`) REFERENCES `courts` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `inventory_transactions`
--
ALTER TABLE `inventory_transactions`
  ADD CONSTRAINT `fk_it_p` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  ADD CONSTRAINT `fk_it_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`);

--
-- Constraints for table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `fk_n_user` FOREIGN KEY (`receiver_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `payments`
--
ALTER TABLE `payments`
  ADD CONSTRAINT `fk_pay_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`),
  ADD CONSTRAINT `fk_pay_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

--
-- Constraints for table `products`
--
ALTER TABLE `products`
  ADD CONSTRAINT `fk_p_cat` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `purchase_orders`
--
ALTER TABLE `purchase_orders`
  ADD CONSTRAINT `fk_po_sup` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`),
  ADD CONSTRAINT `fk_po_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`);

--
-- Constraints for table `purchase_order_details`
--
ALTER TABLE `purchase_order_details`
  ADD CONSTRAINT `fk_pod_p` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  ADD CONSTRAINT `fk_pod_po` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `recurring_bookings`
--
ALTER TABLE `recurring_bookings`
  ADD CONSTRAINT `fk_rb_court` FOREIGN KEY (`court_id`) REFERENCES `courts` (`id`),
  ADD CONSTRAINT `fk_rb_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

--
-- Constraints for table `refunds`
--
ALTER TABLE `refunds`
  ADD CONSTRAINT `fk_rf_payment` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`),
  ADD CONSTRAINT `fk_rf_user` FOREIGN KEY (`processed_by`) REFERENCES `users` (`id`);

--
-- Constraints for table `reviews`
--
ALTER TABLE `reviews`
  ADD CONSTRAINT `fk_rv_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`),
  ADD CONSTRAINT `fk_rv_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

--
-- Constraints for table `staff_shifts`
--
ALTER TABLE `staff_shifts`
  ADD CONSTRAINT `fk_ss_staff` FOREIGN KEY (`staff_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `user_addresses`
--
ALTER TABLE `user_addresses`
  ADD CONSTRAINT `fk_ua_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
