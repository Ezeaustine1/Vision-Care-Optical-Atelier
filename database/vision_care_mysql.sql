-- =============================================================================
-- VISION CARE — CLINICAL & LUXURY EYEWEAR ATELIER
-- Complete MySQL / MariaDB Database Schema & Initial Seed Data
-- Compatible with Ordinary cPanel Hosting (MySQL 5.7+, MySQL 8.0+, MariaDB 10.3+)
-- Import directly via cPanel -> phpMyAdmin -> Import
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 1. USERS TABLE (Self-Hosted Authentication: Customers & Admins)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uid` VARCHAR(128) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `password_hash` VARCHAR(255) DEFAULT NULL,
  `full_name` VARCHAR(191) DEFAULT '',
  `phone` VARCHAR(64) DEFAULT '',
  `role` VARCHAR(32) NOT NULL DEFAULT 'customer',
  `email_verified` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_users_uid` (`uid`),
  KEY `idx_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. CATEGORIES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `categories` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `description` TEXT,
  `category_type` VARCHAR(64) NOT NULL DEFAULT 'frame',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_categories_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. PRODUCTS (FRAMES & AI SMART GLASSES) TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `products` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `sku` VARCHAR(64) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `brand` VARCHAR(191) NOT NULL,
  `category` VARCHAR(64) NOT NULL,
  `gender` VARCHAR(32) NOT NULL,
  `shape` VARCHAR(64) NOT NULL,
  `rim_style` VARCHAR(64) NOT NULL,
  `material` VARCHAR(128) NOT NULL,
  `dimensions` VARCHAR(64) NOT NULL,
  `price_ngn` INT NOT NULL DEFAULT 0,
  `discount_price_ngn` INT DEFAULT NULL,
  `colors_json` LONGTEXT NOT NULL,
  `images_json` LONGTEXT NOT NULL,
  `stock_quantity` INT NOT NULL DEFAULT 25,
  `is_protective_ready` TINYINT(1) NOT NULL DEFAULT 0,
  `default_protective_type` VARCHAR(128) DEFAULT '',
  `is_featured` TINYINT(1) NOT NULL DEFAULT 0,
  `is_best_seller` TINYINT(1) NOT NULL DEFAULT 0,
  `is_new_arrival` TINYINT(1) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `description` TEXT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_products_sku` (`sku`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. LENS TYPES TABLE (Single Vision, Bifocal, Invisible Bifocal, Varilux, Special Order)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `lens_types` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(128) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `category` VARCHAR(64) NOT NULL,
  `tier` VARCHAR(128) NOT NULL DEFAULT 'Standard',
  `description` TEXT NOT NULL,
  `options_json` LONGTEXT NOT NULL,
  `price_ngn` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_lens_types_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. LENS COATINGS & HIGH-INDEX UPGRADES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `lens_coatings` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(128) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `group_type` VARCHAR(64) NOT NULL,
  `description` TEXT NOT NULL,
  `price_ngn` INT NOT NULL DEFAULT 0,
  `compatible_with_json` LONGTEXT NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_lens_coatings_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 6. PRESCRIPTIONS & OCR VERIFICATION TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `prescriptions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_uid` VARCHAR(128) NOT NULL,
  `patient_name` VARCHAR(191) NOT NULL,
  `submission_type` VARCHAR(64) NOT NULL DEFAULT 'manual',
  `od_sph` VARCHAR(32) NOT NULL DEFAULT '0.00',
  `od_cyl` VARCHAR(32) NOT NULL DEFAULT '0.00',
  `od_axis` VARCHAR(32) NOT NULL DEFAULT '0',
  `od_add` VARCHAR(32) NOT NULL DEFAULT '0.00',
  `os_sph` VARCHAR(32) NOT NULL DEFAULT '0.00',
  `os_cyl` VARCHAR(32) NOT NULL DEFAULT '0.00',
  `os_axis` VARCHAR(32) NOT NULL DEFAULT '0',
  `os_add` VARCHAR(32) NOT NULL DEFAULT '0.00',
  `pd` VARCHAR(32) NOT NULL DEFAULT '63',
  `monocular_pd_od` VARCHAR(32) DEFAULT '',
  `monocular_pd_os` VARCHAR(32) DEFAULT '',
  `prescription_date` VARCHAR(64) DEFAULT '',
  `doctor_name` VARCHAR(191) DEFAULT '',
  `notes` TEXT,
  `document_data_url` LONGTEXT,
  `document_file_name` VARCHAR(255) DEFAULT '',
  `ocr_confidence_notes` TEXT,
  `unreadable_fields_json` TEXT,
  `customer_confirmed` TINYINT(1) NOT NULL DEFAULT 1,
  `verification_status` VARCHAR(64) NOT NULL DEFAULT 'pending_review',
  `admin_feedback` TEXT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_prescriptions_user_uid` (`user_uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 7. ORDERS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `orders` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_number` VARCHAR(64) NOT NULL,
  `user_uid` VARCHAR(128) NOT NULL,
  `customer_name` VARCHAR(191) NOT NULL,
  `customer_email` VARCHAR(191) NOT NULL,
  `customer_phone` VARCHAR(64) NOT NULL,
  `delivery_address` TEXT NOT NULL,
  `delivery_city` VARCHAR(128) NOT NULL,
  `delivery_state` VARCHAR(128) NOT NULL,
  `delivery_method` VARCHAR(191) NOT NULL DEFAULT 'Express Courier (Lagos & Nationwide)',
  `order_notes` TEXT,
  `subtotal_ngn` INT NOT NULL DEFAULT 0,
  `delivery_fee_ngn` INT NOT NULL DEFAULT 0,
  `discount_ngn` INT NOT NULL DEFAULT 0,
  `coupon_code` VARCHAR(64) DEFAULT '',
  `total_ngn` INT NOT NULL DEFAULT 0,
  `payment_method` VARCHAR(64) NOT NULL,
  `payment_reference` VARCHAR(191) NOT NULL DEFAULT '',
  `payment_status` VARCHAR(64) NOT NULL DEFAULT 'pending_verification',
  `order_status` VARCHAR(128) NOT NULL DEFAULT 'Order received',
  `internal_admin_notes` LONGTEXT,
  `prescription_id` INT UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_orders_order_number` (`order_number`),
  KEY `idx_orders_user_uid` (`user_uid`),
  KEY `idx_orders_customer_email` (`customer_email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 8. ORDER ITEMS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id` INT UNSIGNED NOT NULL,
  `product_id` INT UNSIGNED DEFAULT NULL,
  `product_name` VARCHAR(191) NOT NULL,
  `product_brand` VARCHAR(191) NOT NULL DEFAULT 'VISION CARE',
  `product_image` LONGTEXT,
  `order_type` VARCHAR(64) NOT NULL,
  `selected_color` VARCHAR(128) NOT NULL DEFAULT 'Default',
  `quantity` INT NOT NULL DEFAULT 1,
  `frame_price_ngn` INT NOT NULL DEFAULT 0,
  `lens_type_name` VARCHAR(191) NOT NULL DEFAULT 'None',
  `lens_option_selected` VARCHAR(191) DEFAULT '',
  `lens_price_ngn` INT NOT NULL DEFAULT 0,
  `coating_summary` VARCHAR(255) NOT NULL DEFAULT 'Standard Clear',
  `coating_price_ngn` INT NOT NULL DEFAULT 0,
  `prescription_snapshot_json` LONGTEXT,
  `unit_total_ngn` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_order_items_order_id` (`order_id`),
  CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 9. CLINICAL EYE APPOINTMENTS & DRUG PRESCRIPTIONS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `appointments` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `appointment_number` VARCHAR(64) NOT NULL,
  `user_uid` VARCHAR(128) DEFAULT '',
  `patient_name` VARCHAR(191) NOT NULL,
  `patient_email` VARCHAR(191) NOT NULL,
  `patient_phone` VARCHAR(64) NOT NULL,
  `patient_age` VARCHAR(32) DEFAULT '',
  `patient_gender` VARCHAR(32) DEFAULT 'Prefer not to say',
  `preferred_date` VARCHAR(64) NOT NULL,
  `preferred_time` VARCHAR(64) NOT NULL,
  `clinic_branch` VARCHAR(191) NOT NULL,
  `complaint_category` VARCHAR(191) NOT NULL,
  `complaint_description` TEXT NOT NULL,
  `symptom_duration` VARCHAR(128) DEFAULT '',
  `severity_level` VARCHAR(64) DEFAULT 'Moderate',
  `medical_history` TEXT,
  `medical_history_document_url` LONGTEXT,
  `medical_history_document_name` VARCHAR(255) DEFAULT '',
  `current_medications` TEXT,
  `known_allergies` VARCHAR(255) DEFAULT 'None reported',
  `uses_corrective_lenses` TINYINT(1) NOT NULL DEFAULT 0,
  `consultation_fee_ngn` INT NOT NULL DEFAULT 15000,
  `payment_method` VARCHAR(64) NOT NULL DEFAULT 'paystack',
  `payment_reference` VARCHAR(191) DEFAULT '',
  `payment_status` VARCHAR(64) NOT NULL DEFAULT 'unpaid',
  `status` VARCHAR(64) NOT NULL DEFAULT 'pending_review',
  `assigned_doctor` VARCHAR(191) DEFAULT 'Dr. Tunde Bakare, OD, FNCO (Chief Optometrist)',
  `clinical_diagnosis` TEXT,
  `doctor_notes` TEXT,
  `follow_up_date` VARCHAR(64) DEFAULT '',
  `drug_prescription_status` VARCHAR(64) NOT NULL DEFAULT 'awaiting_payment',
  `prescribed_drugs_json` LONGTEXT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_appointments_number` (`appointment_number`),
  KEY `idx_appointments_email` (`patient_email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 10. ADDRESSES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `addresses` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_uid` VARCHAR(128) NOT NULL,
  `label` VARCHAR(64) NOT NULL DEFAULT 'Home',
  `recipient_name` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(64) NOT NULL,
  `street_address` TEXT NOT NULL,
  `city` VARCHAR(128) NOT NULL,
  `state` VARCHAR(128) NOT NULL,
  `is_default` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_addresses_user_uid` (`user_uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 11. WISHLISTS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `wishlists` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_uid` VARCHAR(128) NOT NULL,
  `product_id` INT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_wishlists_user_uid` (`user_uid`),
  KEY `idx_wishlists_product_id` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 12. CUSTOMER REVIEWS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `reviews` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_uid` VARCHAR(128) NOT NULL,
  `customer_name` VARCHAR(191) NOT NULL,
  `customer_role` VARCHAR(191) NOT NULL DEFAULT 'Verified Buyer',
  `product_id` INT UNSIGNED DEFAULT NULL,
  `rating` INT NOT NULL DEFAULT 5,
  `comment` TEXT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 13. PROMO COUPONS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `coupons` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(64) NOT NULL,
  `discount_percent` INT NOT NULL DEFAULT 10,
  `min_order_ngn` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_coupons_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 14. CLIENT NOTIFICATIONS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_uid` VARCHAR(191) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `message` LONGTEXT NOT NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notifications_user_uid` (`user_uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 15. CUSTOMER ENQUIRIES & LIVE CONCIERGE MESSAGES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `enquiries` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_uid` VARCHAR(128) DEFAULT '',
  `customer_name` VARCHAR(191) NOT NULL,
  `customer_email` VARCHAR(191) NOT NULL,
  `order_number` VARCHAR(64) DEFAULT '',
  `subject` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'open',
  `admin_reply` TEXT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_enquiries_email` (`customer_email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 16. SITE CONTENT & STOREFRONT CMS CONFIGURATION TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `site_content` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `key` VARCHAR(128) NOT NULL,
  `value_json` LONGTEXT NOT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_site_content_key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- DEFAULT SEED DATA (ADMIN ACCOUNT, LENSES, COATINGS, COUPONS)
-- =============================================================================

INSERT IGNORE INTO `users` (`uid`, `email`, `password_hash`, `full_name`, `phone`, `role`, `email_verified`) VALUES
('vc_admin_chief', 'ezehaustine1@gmail.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Chief Admin (Austine Ezeh)', '+234 800 847 4662', 'admin', 1),
('vc_patient_demo', 'chidinma.okafor@visioncare.ng', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Dr. Chidinma Okafor', '+234 803 400 1122', 'customer', 1);

INSERT IGNORE INTO `coupons` (`code`, `discount_percent`, `min_order_ngn`, `is_active`) VALUES
('VISION10', 10, 50000, 1),
('ATELIER15', 15, 150000, 1);

SET FOREIGN_KEY_CHECKS = 1;
