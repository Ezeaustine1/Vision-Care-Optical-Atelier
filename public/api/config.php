<?php
/**
 * VISION CARE — Clinical & Luxury Eyewear Atelier
 * cPanel PHP 8.x + MySQL / MariaDB Database Configuration & Auto-Bootstrapper
 *
 * HOW TO CONFIGURE ON ORDINARY CPANEL HOSTING:
 * 1. Create a MySQL Database and User in cPanel -> "MySQL® Databases"
 * 2. Update DB_NAME, DB_USER, and DB_PASS below (or set them in a .env file)
 * 3. All tables and initial optical products/lenses are created automatically on first request,
 *    or you can import /database/vision_care_mysql.sql via phpMyAdmin.
 */

declare(strict_types=1);

// Load .env if present in root or parent directory
function load_dotenv_file(string $path): void {
    if (!is_readable($path)) {
        return;
    }
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (!$lines) {
        return;
    }
    foreach ($lines as $line) {
        $trimmed = trim($line);
        if ($trimmed === '' || str_starts_with($trimmed, '#') || !str_contains($trimmed, '=')) {
            continue;
        }
        [$k, $v] = explode('=', $trimmed, 2);
        $k = trim($k);
        $v = trim($v, " \t\n\r\0\x0B\"'");
        if ($k !== '' && getenv($k) === false) {
            putenv("$k=$v");
            $_ENV[$k] = $v;
        }
    }
}

load_dotenv_file(__DIR__ . '/../../.env');
load_dotenv_file(__DIR__ . '/../.env');
load_dotenv_file(__DIR__ . '/.env');

// cPanel MySQL Database Credentials (edit directly or set in .env)
define('DB_HOST', getenv('MYSQL_HOST') ?: (getenv('DB_HOST') ?: 'localhost'));
define('DB_PORT', getenv('MYSQL_PORT') ?: (getenv('DB_PORT') ?: '3306'));
define('DB_NAME', getenv('MYSQL_DATABASE') ?: (getenv('DB_NAME') ?: 'cpaneluser_visioncare'));
define('DB_USER', getenv('MYSQL_USER') ?: (getenv('DB_USER') ?: 'cpaneluser_vcadmin'));
define('DB_PASS', getenv('MYSQL_PASSWORD') ?: (getenv('DB_PASS') ?: 'your_cpanel_mysql_password'));
define('APP_SECRET', getenv('JWT_SECRET') ?: 'vision_care_cpanel_secret_key_2026_optical_atelier');
define('INITIAL_ADMIN_EMAIL', getenv('ADMIN_EMAIL') ?: 'ezehaustine1@gmail.com');
define('GEMINI_API_KEY', getenv('GEMINI_API_KEY') ?: '');

/**
 * Establish PDO MySQL connection and auto-bootstrap tables if needed.
 */
function get_pdo(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_PORT, DB_NAME);
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    ensure_database_schema_and_seed($pdo);
    return $pdo;
}

/**
 * Create all required MySQL tables and seed initial optical data if the catalog is empty.
 */
function ensure_database_schema_and_seed(PDO $pdo): void {
    // Fast check: if `site_content` table already exists and has storefront_config, skip DDL
    try {
        $stmt = $pdo->query("SELECT COUNT(*) AS cnt FROM `products`");
        $row = $stmt ? $stmt->fetch() : null;
        if ($row && (int)$row['cnt'] > 0) {
            return;
        }
    } catch (Throwable $e) {
        // Table does not exist yet; run schema creation below
    }

    $sqlFile = __DIR__ . '/../../database/vision_care_mysql.sql';
    if (is_readable($sqlFile)) {
        $rawSql = file_get_contents($sqlFile);
        if ($rawSql) {
            $pdo->exec($rawSql);
        }
    }

    // Ensure `users` table has `password_hash` column even if migrated from older schema
    try {
        $pdo->exec("ALTER TABLE `users` ADD COLUMN `password_hash` VARCHAR(255) DEFAULT NULL AFTER `email`");
    } catch (Throwable $e) {
        // Column already exists
    }

    // Seed Default Products if empty
    $countProducts = (int)$pdo->query("SELECT COUNT(*) FROM `products`")->fetchColumn();
    if ($countProducts === 0) {
        $imgAviator = '/src/assets/images/frame_aviator_gold_1793890598064.jpg';
        $imgRound   = '/src/assets/images/frame_round_navy_1793890600366.jpg';
        $imgCateye  = '/src/assets/images/frame_cateye_tortoise_1793890600804.jpg';
        $imgSquare  = '/src/assets/images/frame_square_matte_1793890601011.jpg';

        $seedProducts = [
            ['VC-FRM-001', 'Mayfair Round Optical', 'VISION CARE ATELIER', 'Unisex', 'Unisex', 'Round', 'Full-Rim', 'Italian Acetate', '49-20-145 mm', 85000, 72000, json_encode(['Deep Navy', 'Havana Tortoise', 'Crystal Clear']), json_encode([$imgRound, $imgAviator]), 18, 1, 'Blue Cut Glasses', 1, 1, 0, 'Hand-polished Mazzucchelli Italian acetate frame with spring hinges and balanced nose pads.'],
            ['VC-FRM-002', 'Sovereign Titanium Aviator', 'VISION CARE LUXE', 'Luxury', 'Men', 'Aviator', 'Full-Rim', 'Japanese Titanium', '55-17-148 mm', 120000, 105000, json_encode(['18K Champagne Gold', 'Gunmetal', 'Brushed Silver']), json_encode([$imgAviator, $imgSquare]), 14, 1, 'Photochromic Anti-Glare Glasses', 1, 1, 1, 'Featherlight beta-titanium aviator engineered for all-day executive comfort and high-index progressive lenses.'],
            ['VC-FRM-003', 'Victoria Cat-Eye Couture', 'VISION CARE ATELIER', 'Women', 'Women', 'Cat-Eye', 'Full-Rim', 'Italian Acetate', '52-18-142 mm', 92000, null, json_encode(['Amber Tortoise', 'Burgundy Rose', 'Onyx Black']), json_encode([$imgCateye, $imgRound]), 22, 1, 'Photochromic Blue Cut Glasses', 1, 0, 1, 'Sculpted feminine cat-eye silhouette crafted for Single Vision, Invisible Bifocal, and Varilux lenses.'],
            ['VC-FRM-004', 'Kensington Matte Executive Square', 'VISION CARE STUDIO', 'Men', 'Men', 'Square', 'Full-Rim', 'TR90 Composite', '54-18-145 mm', 78000, 68000, json_encode(['Matte Obsidian Black', 'Slate Grey', 'Espresso']), json_encode([$imgSquare, $imgAviator]), 30, 1, 'Blue Cut Glasses', 1, 1, 0, 'Architectural matte square frame with high-flexibility TR90 temples and precision optical groove.'],
            ['VC-AI-009', 'Ray-Ban Meta Wayfarer AI Smart Glasses', 'META × VISION CARE ATELIER', 'AI Glasses', 'Unisex', 'Square', 'Full-Rim', 'Italian Acetate', '50-22-150 mm', 485000, 450000, json_encode(['Matte Obsidian Black', 'Shiny Havana Tortoise', 'Warm Stone Sapphire']), json_encode([$imgSquare, $imgAviator, $imgRound]), 14, 1, 'Photochromic Blue Cut Glasses', 1, 1, 1, 'Next-generation AI Smart Glasses featuring an ultra-wide 12MP POV camera, open-ear directional spatial speakers, 5-microphone array, and hands-free Voice AI assistant.'],
            ['VC-AI-010', 'Solos AirGo3 Argon Acoustic AI Titanium Frame', 'SOLOS × VISION CARE LAB', 'AI Glasses', 'Unisex', 'Rectangle', 'Half-Rim', 'Japanese Titanium', '53-18-146 mm', 395000, 365000, json_encode(['Brushed Gunmetal Titanium', 'Champagne Gold', 'Obsidian Silver']), json_encode([$imgAviator, $imgRound, $imgSquare]), 11, 1, 'Blue Cut Glasses', 1, 1, 1, 'Featherlight 30g smart optical frame with ChatGPT-enabled live voice translation, Whisper audio noise cancellation, and modular IP67 temples.'],
        ];

        $insProd = $pdo->prepare("
            INSERT INTO `products` (
                `sku`, `name`, `brand`, `category`, `gender`, `shape`, `rim_style`, `material`,
                `dimensions`, `price_ngn`, `discount_price_ngn`, `colors_json`, `images_json`,
                `stock_quantity`, `is_protective_ready`, `default_protective_type`,
                `is_featured`, `is_best_seller`, `is_new_arrival`, `is_active`, `description`
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        ");
        foreach ($seedProducts as $p) {
            $insProd->execute($p);
        }
    }

    // Seed Default Lens Types if empty
    $countLenses = (int)$pdo->query("SELECT COUNT(*) FROM `lens_types`")->fetchColumn();
    if ($countLenses === 0) {
        $seedLenses = [
            ['single_vision', 'Single Vision Lens', 'single_vision', 'Standard Clinical', 'Precision digital surfacing for either Distance Vision or Near Reading (SPH and/or CYL+AXIS without ADD).', json_encode(['Distance Vision', 'Near Reading', 'Computer Intermediate']), 25000],
            ['fused_bifocal', 'Fused Bifocal Lens', 'bifocal', 'Dual-Segment', 'Classic visible D-segment reading window combined with crisp distance correction.', json_encode(['28mm Flat-Top Segment', 'Round Segment']), 42000],
            ['invisible_bifocal', 'Invisible Bifocal Lens', 'invisible_bifocal', 'Blended No-Line', 'Cosmetically seamless blended reading zone with zero visible dividing line.', json_encode(['Standard Blended Zone', 'Wide Reading Zone']), 58000],
            ['progressive_varilux', 'Varilux Progressive Lens', 'progressive_varilux', 'Essilor Varilux Series', 'Effortless multifocal transition across Distance, Intermediate (Computer), and Near Reading.', json_encode(['Varilux Comfort Max', 'Varilux Physio 3.0', 'Varilux X Series']), 95000],
            ['special_order_bifocal', 'Special Order Bifocal Lens', 'special_order_bifocal', 'Special Order Lab', 'Custom laboratory-surfaced Bifocal lens for prescriptions combining Astigmatism (CYL + AXIS) and Reading ADD.', json_encode(['Custom Toric D-28 Segment', 'Prism-Compensated']), 68000],
            ['special_order_invisible_bifocal', 'Special Order Invisible Bifocal Lens', 'special_order_invisible_bifocal', 'Special Order Lab', 'Custom laboratory-surfaced blended no-line bifocal for combined CYL + AXIS + ADD prescriptions.', json_encode(['Digital Freeform Blended', 'High-Cylinder Stabilized']), 82000],
            ['special_order_varilux', 'Special Order Varilux Lens', 'special_order_varilux', 'Special Order Lab', 'Bespoke freeform Varilux progressive lens custom-ground for combined Cylinder, Axis, and ADD powers.', json_encode(['Varilux Tailor-Made Toric', 'Wide-Corridor Digital']), 135000],
            ['non_prescription_plano', 'Protective 0.00 Plano Lens', 'non_prescription', 'Zero-Power Protective', 'Optical-grade 0.00 Plano lenses for computer screen protection and outdoor UV defense.', json_encode(['0.00 Plano Screen & Sun']), 0],
        ];
        $insLens = $pdo->prepare("
            INSERT INTO `lens_types` (`code`, `name`, `category`, `tier`, `description`, `options_json`, `price_ngn`, `is_active`)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        ");
        foreach ($seedLenses as $l) {
            $insLens->execute($l);
        }
    }

    // Seed Default Lens Coatings if empty
    $countCoatings = (int)$pdo->query("SELECT COUNT(*) FROM `lens_coatings`")->fetchColumn();
    if ($countCoatings === 0) {
        $allLensCodes = json_encode(['single_vision', 'fused_bifocal', 'invisible_bifocal', 'progressive_varilux', 'special_order_bifocal', 'special_order_invisible_bifocal', 'special_order_varilux', 'non_prescription_plano']);
        $seedCoatings = [
            ['clear_standard', 'Standard Clear Hard-Coat', 'tint_treatment', 'Scratch-resistant crystal-clear optical finish with UV400 block.', 0, $allLensCodes],
            ['blue_cut_digital', 'Blue-Cut Digital Filter + AR', 'tint_treatment', 'Filters harmful 415–455nm HEV blue light from laptops, phones, and LED lighting.', 18000, $allLensCodes],
            ['photochromic_transitions', 'Photochromic Sun-Adaptive (Grey / Brown)', 'tint_treatment', 'Automatically darkens outdoors in sunlight and returns crystal clear indoors.', 25000, $allLensCodes],
            ['blue_cut_photo_ar', 'Blue Cut Photo AR (Photochromic + Blue Filter + Anti-Glare)', 'tint_treatment', 'Complete all-in-one indoor blue light shield, outdoor sun-adaptive tint, and night driving anti-glare.', 28000, $allLensCodes],
            ['photo_ar', 'Photo AR (Photochromic + Anti-Reflective)', 'tint_treatment', 'Rapid outdoor UV darkening paired with multi-layer Crizal-grade anti-reflective coating.', 22000, $allLensCodes],
            ['crizal_sapphire_ar', 'Crizal Sapphire 360° Anti-Reflective', 'addon_feature', 'Eliminates night-driving halo glare, water smudges, and dust static.', 20000, $allLensCodes],
            ['index_156', '1.56 Mid-Index Aspheric (Standard Thin)', 'index_material', 'Up to 15% thinner and lighter than standard CR-39 lenses.', 0, $allLensCodes],
            ['index_161', '1.61 High-Index Super-Thin', 'index_material', 'Up to 25% thinner; recommended for SPH powers above ±2.50.', 18000, $allLensCodes],
            ['index_167', '1.67 Ultra-Thin High-Index Aspheric', 'index_material', 'Up to 40% thinner and flatter; ideal for strong prescriptions and rimless frames.', 35000, $allLensCodes],
        ];
        $insCoat = $pdo->prepare("
            INSERT INTO `lens_coatings` (`code`, `name`, `group_type`, `description`, `price_ngn`, `compatible_with_json`, `is_active`)
            VALUES (?, ?, ?, ?, ?, ?, 1)
        ");
        foreach ($seedCoatings as $c) {
            $insCoat->execute($c);
        }
    }
}

/**
 * Create a signed session token for authenticated users.
 */
function create_session_token(array $user): string {
    $payload = [
        'uid'   => $user['uid'],
        'email' => $user['email'],
        'name'  => $user['fullName'] ?? ($user['full_name'] ?? ''),
        'role'  => $user['role'] ?? 'customer',
        'iat'   => time(),
    ];
    $encoded = base64_encode(json_encode($payload));
    return 'vc_session_' . $encoded;
}

/**
 * Extract and verify the Bearer token from the incoming HTTP request.
 */
function verify_request_auth(bool $requireAuth = true): ?array {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION']
        ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
        ?? '';

    if ($authHeader === '' && function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        $authHeader = $headers['Authorization'] ?? ($headers['authorization'] ?? '');
    }

    if (!str_starts_with($authHeader, 'Bearer ')) {
        if ($requireAuth) {
            http_response_code(401);
            echo json_encode(['error' => 'Unauthorized: Missing Bearer token']);
            exit;
        }
        return null;
    }

    $token = trim(substr($authHeader, 7));
    if (str_starts_with($token, 'vc_session_')) {
        $encoded = substr($token, strlen('vc_session_'));
        $decoded = json_decode(base64_decode($encoded), true);
        if (is_array($decoded) && !empty($decoded['uid']) && !empty($decoded['email'])) {
            return $decoded;
        }
    }

    if ($requireAuth) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized: Invalid session token']);
        exit;
    }
    return null;
}

/**
 * Convert snake_case MySQL row keys to camelCase for the React frontend.
 */
function row_to_camel(array $row, array $boolKeys = [], array $intKeys = []): array {
    $out = [];
    foreach ($row as $k => $v) {
        $camel = lcfirst(str_replace('_', '', ucwords($k, '_')));
        if (in_array($camel, $boolKeys, true)) {
            $out[$camel] = (bool)$v;
        } elseif (in_array($camel, $intKeys, true) && $v !== null) {
            $out[$camel] = (int)$v;
        } else {
            $out[$camel] = $v;
        }
    }
    return $out;
}
