# VISION CARE — Clinical & Luxury Eyewear Atelier

Complete full-stack optical e-commerce, clinical prescription wizard, AI prescription OCR, doctor appointment portal, and executive admin console.

Designed to run with **zero external database or cloud authentication dependencies** (no Supabase, no Firebase required) on **ordinary cPanel shared hosting (PHP 8.x + MySQL / MariaDB)** as well as local development.

---

## Project Architecture & Files

| Path | Description |
| :--- | :--- |
| `public/api/index.php` | Complete **PHP 8+ REST API Backend** implementing all `/api/*` endpoints using PDO MySQL (`utf8mb4`). Automatically copied into `dist/api/index.php` when you run `npm run build`. |
| `public/api/config.php` | **MySQL Database Connection, Auto-Schema Initializer & Self-Hosted Auth** (`DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`). Automatically creates tables and seeds initial frames, lenses, coatings, and admin account on first run. |
| `public/.htaccess` | **cPanel Apache Rewrite Configuration**. Routes `/api/*` requests to `api/index.php` (including `Authorization: Bearer` headers) and routes frontend URLs to `index.html`. |
| `database/vision_care_mysql.sql` | Complete **MySQL / MariaDB Schema & Initial Seed SQL** (16 tables: `users`, `categories`, `products`, `lens_types`, `lens_coatings`, `prescriptions`, `orders`, `order_items`, `appointments`, `addresses`, `wishlists`, `reviews`, `coupons`, `notifications`, `enquiries`, `site_content`). Ready to import via **cPanel phpMyAdmin**. |
| `src/` | React 19 + TypeScript + Tailwind CSS frontend application. |

---

## Deploying to Ordinary cPanel Shared Hosting (Step-by-Step)

### Step 1: Create Your MySQL Database in cPanel
1. Log in to your **cPanel** control panel and open **MySQL® Database Wizard** (or **MySQL® Databases**).
2. Create a database (e.g., `cpaneluser_visioncare`) and a MySQL user (e.g., `cpaneluser_vcadmin`) with a strong password.
3. Grant **ALL PRIVILEGES** to the user on that database.
4. *(Optional)* Open **phpMyAdmin** in cPanel, select your new database, click **Import**, and upload `database/vision_care_mysql.sql`. *(Note: `api/config.php` also auto-creates and seeds all tables automatically on first visit if the database is empty).*

### Step 2: Build the Frontend & PHP Bundle
Run the production build locally or in your CI/GitHub workflow:
```bash
npm install
npm run build
```
Vite compiles the React frontend into the `dist/` folder and automatically copies `public/.htaccess`, `public/api/index.php`, and `public/api/config.php` into `dist/`.

### Step 3: Upload to cPanel `public_html`
1. Upload the contents of the `dist/` folder (and the `database/` folder if you want automatic SQL bootstrapping) into your cPanel domain root (`public_html/`).
2. Open `public_html/api/config.php` (or create `public_html/.env` from `.env.example`) and enter your cPanel MySQL credentials:
   ```php
   define('DB_HOST', 'localhost');
   define('DB_NAME', 'cpaneluser_visioncare');
   define('DB_USER', 'cpaneluser_vcadmin');
   define('DB_PASS', 'your_cpanel_mysql_password');
   ```
3. Visit your domain! Sign in as Admin using `ezehaustine1@gmail.com` to access the **Admin & Lab Control Center**.
