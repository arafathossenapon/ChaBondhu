# ChaBondhu — Tea Grower & Factory Marketplace

ChaBondhu (চাBondhu) is a digital tea leaf procurement and coordination platform designed for the tea-growing region of Panchagarh, Bangladesh. The platform directly connects smallholder tea growers (*ক্ষুদ্র চা চাষি*) with local tea processing factories (*চা কারখানা*), eliminating intermediary middlemen (*দালাল/ফড়িয়া*), establishing transparent leaf grade information, and providing coordinated procurement tracking.

This repository contains the **backend REST API** developed with **NestJS**, **TypeORM**, and **PostgreSQL**.

---

## 📋 Table of Contents

- [Key Features](#-key-features)
- [Technology Stack](#-technology-stack)
- [Prerequisites](#-prerequisites)
- [Project Structure](#-project-structure)
- [Installation and Setup](#-installation-and-setup)
- [Environment Variables](#-environment-variables)
- [Database and Migrations](#-database-and-migrations)
- [Running the Application](#-running-the-application)
- [API Documentation](#-api-documentation)
- [Authentication and Authorization](#-authentication-and-authorization)
- [Current Project Status](#-current-project-status)
- [Troubleshooting](#-troubleshooting)
- [License](#-license)

---

## 🚀 Key Features

### Implemented Features (Current Codebase)

- **Authentication & Account Management:**
  - Secure registration for tea growers (`GROWER`) and factories (`FACTORY`).
  - Password hashing powered by **Argon2** (never stored in plain text).
  - Stateless JSON Web Token (**JWT**) issuance for protected routes.
  - Authenticated user profile retrieval (`GET /users/me`) and safe field updates (`PATCH /users/me`).
- **Role-Based Access Control (RBAC):**
  - Granular route guards (`JwtGuard`, `RolesGuard`) enforcing permissions for `GROWER`, `FACTORY`, and `ADMIN`.
- **Tea Garden (Farmer) Profiles:**
  - One-to-one farm profile per grower (`FarmerProfile`).
  - Tracks garden name, administrative division, district (e.g., Panchagarh), upazila (e.g., Tetulia), optional village, farm size in acres, and garden description.
  - Private owner management (`/farmer-profiles/me`) and public marketplace view (`/farmer-profiles/:id`).
- **Tea Factory Profiles:**
  - One-to-one factory profile per factory representative (`FactoryProfile`).
  - Tracks factory details and verification status (`PENDING`, `VERIFIED`, or `REJECTED`). Admins can review, approve, and reject pending profiles. Factory owners can see their review history and resubmit after rejection.
- **Harvest Listings Marketplace:**
  - Tea leaf harvest listings published exclusively by verified farm owners (`HarvestListing`).
  - Tracks tea grade (e.g., CTC, Green Leaf), estimated quantity in kg (`NUMERIC(10, 3)` with database check constraint `> 0`), expected harvest date, optional last harvest date, leaf quality description, collection location, notes, and lifecycle status.
  - Public marketplace browsing with filtering by tea grade and district, plus pagination (`GET /listings`).
  - Grower-specific listing isolation (`GET /listings/my`).
  - Ownership protection: only the listing owner can update or cancel an active listing.
  - Administrative moderation: soft-deletion (`isActive = false`) preserving order referential history.
- **Strict Validation & Security:**
  - Strict payload validation with automatic whitelisting (`class-validator`, `class-transformer`).
  - Security headers configured via **Helmet** and cross-origin resource sharing via **CORS**.
  - Interactive **Swagger (OpenAPI)** documentation.

### Planned Features (Upcoming in Project Roadmap)

- Price offer editing, withdrawal, and automatic expiry transitions
- Procurement Orders & State Machine (`OrdersModule` — Step 11)
- Payment Tracking Records (`PaymentsModule` — Step 12)
- Platform Administrative Dashboard (`AdminModule` — Step 13)

---

## 🛠️ Technology Stack

| Category | Technology | Description |
|---|---|---|
| **Framework** | [NestJS v11](https://nestjs.com/) | Modular TypeScript server-side framework |
| **Language** | [TypeScript v5](https://www.typescriptlang.org/) | Strongly typed JavaScript |
| **Database** | [PostgreSQL v18](https://www.postgresql.org/) | Relational database engine |
| **ORM** | [TypeORM v0.3](https://typeorm.io/) | Object-Relational Mapper with `SnakeNamingStrategy` |
| **Authentication** | [Passport.js](http://www.passportjs.org/) & [JWT](https://jwt.io/) | Stateless token-based authentication |
| **Password Hashing** | [Argon2](https://github.com/ranisalt/node-argon2) | Memory-hard cryptographic hashing |
| **Validation** | `class-validator` & `class-transformer` | DTO request body and query validation |
| **Configuration** | `@nestjs/config` & `zod` | Schema-validated environment variables |
| **API Documentation** | [Swagger / OpenAPI](https://swagger.io/) | Built-in interactive API documentation |
| **Security** | [Helmet](https://helmetjs.github.io/) | HTTP security response headers |
| **Package Manager** | [pnpm](https://pnpm.io/) | Fast, disk-space-efficient package manager |

---

## 📦 Prerequisites

Before running the backend locally, ensure you have the following installed:

- **Node.js:** v18.17.0 or later (v20 LTS or v22 LTS recommended, matching `.nvmrc`)
- **pnpm:** v9.0.0 or later (`corepack enable && corepack prepare pnpm@latest --activate`)
- **PostgreSQL:** v15 or v18 installed and running locally on port `5432`

> [!NOTE]
> **Redis:** While the boilerplate contains optional Redis caching providers, Redis is **not mandatory** for running the core ChaBondhu MVP backend. The application boots and functions independently without an active Redis instance.

---

## 📁 Project Structure

```text
nest-boilerplate/
├── src/
│   ├── common/
│   │   ├── decorators/         # Custom decorators (@CurrentUser, @Roles)
│   │   ├── enums/              # Enums (Role, ListingStatus)
│   │   ├── guard/              # Guards (JwtGuard, RolesGuard)
│   │   ├── interfaces/         # Interfaces (AuthUser)
│   │   └── pipes/              # ValidationPipe (whitelisting & validation)
│   ├── config/
│   │   ├── app.config.ts       # Zod-validated application config
│   │   ├── database.config.ts  # TypeORM DataSource & SnakeNamingStrategy
│   │   └── global_config.ts    # Application timezone and constants
│   ├── database/
│   │   └── migrations/         # TypeORM database migration files
│   ├── modules/
│   │   ├── auth/               # User registration, login & JWT strategy
│   │   ├── factory-profiles/   # Factory profile entity, DTOs, service, controller
│   │   ├── farmer-profiles/    # Farmer profile entity, DTOs, service, controller
│   │   ├── listings/           # Harvest listings entity, DTOs, service, controller
│   │   └── users/              # User entity, profile retrieval & update
│   ├── providers/
│   │   └── database/postgres/  # TypeORM Postgres connection provider
│   ├── script/                 # Standalone TypeORM migration runner scripts
│   ├── app.controller.ts       # Health check routes (/health)
│   ├── app.module.ts           # Root module aggregating all feature modules
│   └── main.ts                 # Application entry point (Swagger, Helmet, CORS)
├── .env.example                # Sanitized environment template
├── package.json                # Dependencies and npm scripts
├── pnpm-workspace.yaml         # pnpm package overrides
└── tsconfig.json               # TypeScript compiler configuration
```

---

## ⚙️ Installation and Setup

### 1. Clone the Repository

```bash
git clone https://github.com/arafathossenapon/ChaBondhu.git
cd ChaBondhu/nest-boilerplate
```

### 2. Install Dependencies

Install all project dependencies using `pnpm`:

```bash
pnpm install --frozen-lockfile
```

### 3. Create the PostgreSQL Database

Ensure PostgreSQL is running, then create the project database `chabondhu_db` using `psql` or pgAdmin:

```sql
CREATE DATABASE chabondhu_db;
```

### 4. Configure Environment Variables

Create your local `.env` file by copying `.env.example`:

```bash
cp .env.example .env
```

Open `.env` in your text editor and update the database credentials and JWT secret according to your local environment.

### 5. Run Database Migrations

Apply the existing migrations to create all required tables (`users`, `farmer_profiles`, `factory_profiles`, `harvest_listings`):

```bash
pnpm run migration:run
```

### 6. Start the Development Server

```bash
pnpm run start:dev
```

The server will start at:
- **Base URL:** `http://localhost:5001` (or your configured `PORT`)
- **Health Check:** `http://localhost:5001/health`
- **Swagger API Docs:** `http://localhost:5001/api`

---

## 🔐 Environment Variables

The application reads configuration from a `.env` file in the `nest-boilerplate/` root directory. All required and optional variables are documented in `.env.example`:

| Variable | Description | Required | Example / Default |
|---|---|---|---|
| `PORT` | HTTP server listening port | Optional | `5001` (default: 5001) |
| `NODE_ENV` | Application environment (`development`, `production`, `test`) | Optional | `development` |
| `NODE_DB_ENV` | Database environment selector | Optional | `development` |
| `JWT_BEARER_SECRET` | Secret key used to sign and verify JWT tokens | **Required** | `your_jwt_secret_here_replace_in_local_env` |
| `DB_CLIENT` | Database driver identifier | Optional | `postgres` |
| `DB_HOST` | PostgreSQL host address | **Required** | `localhost` |
| `DB_PORT` | PostgreSQL port | **Required** | `5432` |
| `DB_DATABASE` | PostgreSQL database name | **Required** | `chabondhu_db` |
| `DB_USER` | PostgreSQL user account | **Required** | `postgres` |
| `DB_PASSWORD` | PostgreSQL user password | **Required** | `your_postgres_password` |
| `FRONTEND_URL` | Allowed frontend URL for CORS | Optional | `http://localhost:3000` |
| `CORS_ORIGINS` | Comma-separated list of allowed origins | Optional | `http://localhost:3000` |
| `REDIS_HOST` | Redis host (optional background queue/cache) | Optional | `localhost` |
| `REDIS_PORT` | Redis port | Optional | `6379` |
| `REDIS_PASSWORD` | Redis password (if password-protected) | Optional | *(empty)* |

> [!WARNING]
> Never commit your real `.env` file or credentials to version control. The `.gitignore` file is configured to exclude `.env` automatically.

---

## 🗄️ Database and Migrations

ChaBondhu strictly enforces **`synchronize: false`** across all environments. Schema modifications are managed exclusively through version-controlled TypeORM migrations.

### Table Naming Convention
All tables and columns use PostgreSQL `snake_case` through a custom `SnakeNamingStrategy` (e.g., `FarmerProfile` maps to `farmer_profiles`, `farmerProfileId` maps to `farmer_profile_id`).

### Existing Migration Files
Located in `src/database/migrations/`:
1. `1793882640314-CreateUsersAndProfiles.ts` — Creates `users`, `farmer_profiles`, and `factory_profiles` tables with foreign keys and unique constraints.
2. `1793884438520-CreateHarvestListings.ts` — Creates `harvest_listings` table with check constraints (`estimated_quantity_kg > 0`) and indexes.
3. `1795300000000-TrackFactoryVerificationReviews.ts` — Converts existing verification flags to statuses and adds decision history. Existing approvals keep their status and known approval details.
4. `1795300100000-CreatePriceOffers.ts` — Creates `price_offers` with a factory profile foreign key and checks for numeric values and status.

### Migration Commands

| Command | Action |
|---|---|
| `pnpm run migration:run` | Executes all pending migrations against `chabondhu_db` |
| `pnpm run migration:rollback` | Reverts the last executed migration |
| `pnpm run migration:rollbackAll`| Reverts all migrations |
| `pnpm run migration:create <path>` | Creates a new blank migration file |

---

## ▶️ Running the Application

All available scripts from `package.json`:

```bash
# Development mode with hot-reload
pnpm run start:dev

# Standard start mode
pnpm run start

# Production build (compiles to /dist)
pnpm run build

# Start production build
pnpm run start:prod

# Lint and fix code formatting
pnpm run lint

# Format code with Prettier
pnpm run format

# Run HTTP integration tests after building
pnpm run test:e2e --runInBand
```

The integration suite uses the PostgreSQL connection configured in `.env`. The database user needs permission to create a schema in that database. Fixtures and schema setup run in one transaction and are rolled back after the suite.

টেস্টগুলো আলাদা স্কিমায় চলে। শেষে রোলব্যাক হয়, তাই আগের ডেটা ও মাইগ্রেশন ইতিহাস অক্ষত থাকে।

### Factory verification

Provision the first development admin from the backend directory after running the migrations. In PowerShell, enter the contact details and password at the prompts. Use a unique email address and a password of at least eight characters.

```powershell
$env:NODE_ENV = 'development'
$env:CHABONDHU_ADMIN_EMAIL = Read-Host 'Admin email'
$env:CHABONDHU_ADMIN_NAME = Read-Host 'Admin full name'
$env:CHABONDHU_ADMIN_PHONE = Read-Host 'Admin phone'
$adminPasswordInput = Read-Host 'Admin password' -AsSecureString
try {
    $env:CHABONDHU_ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $adminPasswordInput).Password
    pnpm run admin:provision:dev
} finally {
    Clear-Item Env:CHABONDHU_ADMIN_PASSWORD
    $adminPasswordInput.Dispose()
}
```

The command uses the database configured in `.env`, hashes the password with Argon2, and exits safely if an active admin already exists. It leaves existing accounts untouched. Sign in through `POST /auth/login` using the email in lowercase.

| Method and endpoint | Role | Action |
|---|---|---|
| `GET /admin/users/:id/factory-verification` | `ADMIN` | Review a profile and its decision history by the factory's user ID |
| `PATCH /admin/users/:id/verify` | `ADMIN` | Approve a pending profile |
| `PATCH /admin/users/:id/reject-verification` | `ADMIN` | Reject a pending profile with a JSON body containing `reason` |
| `GET /factory-profiles/me/verification-history` | `FACTORY` | View your factory's decisions and rejection reasons |
| `PATCH /factory-profiles/me/resubmit-verification` | `FACTORY` | Return your rejected profile to pending review |

Use a signed-in admin account to review pending factories. Signed-in profile readers see the current verification status. Only the factory owner and admins can read the decision history.

### Publish a price offer

A signed-in factory with a verified profile can use `POST /offers` to create an `ACTIVE` buying offer. Send `teaGrade`, `pricePerKg` in BDT, and `validUntil` as a date after today in Bangladesh. Optional fields are `qualityRequirements`, `minimumQuantityKg`, `estimatedTransportCostBdt` as a flat cost, and `notes`. The server uses the signed-in factory profile as the offer owner.

---

## 📖 API Documentation

Once the server is running, explore and test the complete API interactively using **Swagger UI** at:

```
http://localhost:5001/api
```

### Complete Endpoints Matrix

#### 1. System & Health Check

| Method | Endpoint | Description | Authentication | Required Role |
|---|---|---|---|---|
| `GET` | `/` | Hello / Welcome message | None (Public) | None |
| `GET` | `/health` | Application health and status check | None (Public) | None |

#### 2. Authentication (`/auth`)

| Method | Endpoint | Description | Authentication | Required Role |
|---|---|---|---|---|
| `POST` | `/auth/register` | Register a new grower or factory account | None (Public) | None |
| `POST` | `/auth/login` | Log in with email & password; returns JWT token | None (Public) | None |

#### 3. User Profile (`/users`)

| Method | Endpoint | Description | Authentication | Required Role |
|---|---|---|---|---|
| `GET` | `/users/me` | Retrieve authenticated user's profile | Bearer JWT | Any |
| `PATCH` | `/users/me` | Update authenticated user's name or phone | Bearer JWT | Any |

#### 4. Farmer Profiles (`/farmer-profiles`)

| Method | Endpoint | Description | Authentication | Required Role |
|---|---|---|---|---|
| `POST` | `/farmer-profiles` | Create tea garden profile (1 per grower) | Bearer JWT | `GROWER` |
| `GET` | `/farmer-profiles/me` | Retrieve authenticated grower's own garden profile | Bearer JWT | `GROWER` |
| `GET` | `/farmer-profiles/:id`| View public tea garden profile by ID | Bearer JWT | Any |
| `PATCH` | `/farmer-profiles/me` | Update authenticated grower's garden profile | Bearer JWT | `GROWER` |

#### 5. Factory Profiles (`/factory-profiles`)

| Method | Endpoint | Description | Authentication | Required Role |
|---|---|---|---|---|
| `POST` | `/factory-profiles` | Create tea factory profile (1 per factory) | Bearer JWT | `FACTORY` |
| `GET` | `/factory-profiles/me` | Retrieve authenticated factory's own profile | Bearer JWT | `FACTORY` |
| `GET` | `/factory-profiles/:id`| View public tea factory profile by ID | Bearer JWT | Any |
| `PATCH` | `/factory-profiles/me` | Update authenticated factory's profile | Bearer JWT | `FACTORY` |

#### 6. Harvest Listings (`/listings`)

| Method | Endpoint | Description | Authentication | Required Role |
|---|---|---|---|---|
| `POST` | `/listings` | Create a tea leaf harvest listing (grower profile required) | Bearer JWT | `GROWER` |
| `GET` | `/listings` | Browse active marketplace listings (filters: `teaGrade`, `district`, `page`, `limit`) | Bearer JWT | Any |
| `GET` | `/listings/my` | Retrieve all listings created by the authenticated grower | Bearer JWT | `GROWER` |
| `GET` | `/listings/:id` | View complete details of a specific harvest listing | Bearer JWT | Any |
| `PATCH` | `/listings/:id` | Update listing details (owner only; `ACTIVE` only) | Bearer JWT | `GROWER` |
| `PATCH` | `/listings/:id/cancel` | Cancel harvest listing (`ACTIVE` → `CANCELLED`) | Bearer JWT | `GROWER` |
| `DELETE` | `/listings/:id` | Soft-delete listing for admin moderation (`isActive = false`) | Bearer JWT | `ADMIN` |

---

#### 7. Price Offers (`/offers`)

| Method | Endpoint | Description | Authentication | Required Role |
|---|---|---|---|---|
| `GET` | `/offers` | Browse active offers through their expiry date in Bangladesh | Bearer JWT | Any |
| `GET` | `/offers/:id` | View a single offer eligible for browsing | Bearer JWT | Any |
| `GET` | `/offers/my` | List your factory's offers across all stored statuses | Bearer JWT | `FACTORY` |
| `POST` | `/offers` | Publish a buying offer | Bearer JWT | Verified `FACTORY` |

Use `teaGrade` for an exact, case-insensitive match and `minPrice` or `maxPrice` for inclusive BDT price bounds. Set `sortBy` to `pricePerKg`, `validUntil`, `minimumQuantityKg`, or `createdAt`, with `sortOrder` set to `ASC` or `DESC`. The default is `pricePerKg DESC`.

`page` starts at 1. `limit` defaults to 20 and accepts up to 100. The response contains `data`, `total`, `page`, `limit`, and `totalPages`. Each offer includes only the factory profile ID, name, and district. See the [API design](docs/api-design.md#92-get-all-active-offers) for an example response.

`GET /offers/5` returns a single public offer. An unavailable offer returns HTTP 404. `GET /offers/my?status=WITHDRAWN&page=1&limit=20` returns the signed-in factory's own offer records, including notes and the stored status. The owner list defaults to all statuses, newest first. See the [offer detail example](docs/api-design.md#93-get-single-offer) and [owner list example](docs/api-design.md#94-get-own-offers).

## 🔒 Authentication and Authorization

### Registration Flow
1. Users register via `POST /auth/register` with `fullName`, `email`, `password`, `phoneNumber`, and `role` (`GROWER` or `FACTORY`).
2. Passwords must be at least 8 characters long and are hashed using **Argon2** before persistence.
3. Public registration for the `ADMIN` role is strictly blocked to maintain system integrity.

### Login & Access Token Flow
1. Users authenticate via `POST /auth/login` with their registered `email` and `password`.
2. On successful authentication, the API returns a signed JWT access token:
   ```json
   {
     "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   }
   ```
3. To access protected endpoints, include this token in the `Authorization` header:
   ```http
   Authorization: Bearer <accessToken>
   ```

### Roles and Permissions
ChaBondhu uses role-based access control with three roles:

- **`GROWER`:** Tea smallholder farmers. Can create garden profiles, publish harvest listings, update their own listings, and cancel unsold listings.
- **`FACTORY`:** Commercial tea processing factories. Can create factory profiles and browse active harvest listings in the marketplace.
- **`ADMIN`:** Platform coordinators. Can moderate listings (`DELETE /listings/:id`) and verify factory profiles.

---

## 📊 Current Project Status

| Module / Component | Implementation Status | Notes |
|---|---|---|
| **Core Architecture & Swagger** | ✅ Complete | NestJS modular architecture, Swagger UI at `/api` |
| **Database & Migrations** | ✅ Complete | PostgreSQL 18, TypeORM migrations with `synchronize: false` |
| **Authentication & Users** | ✅ Complete | Argon2 password hashing, JWT bearer auth, user profile CRUD |
| **Farmer Profiles** | ✅ Complete | 1:1 garden profile linked to growers, ownership verification |
| **Factory Profiles** | ✅ Complete | 1:1 factory profile linked to factories, admin verification audit |
| **Harvest Listings** | ✅ Complete | Marketplace CRUD, filtering, pagination, lifecycle management |
| **Price Offers** | 🔄 Partial | Publishing, active browsing and details, and factory-owned listing are available. Editing, withdrawal, and automatic expiry transitions are planned. |
| **Procurement Orders** | ⏳ Planned | Order placement and state machine (`OrdersModule` — Step 11) |
| **Payment Records** | ⏳ Planned | Procurement payment tracking (`PaymentsModule` — Step 12) |
| **Admin** | 🔄 Partial | Factory verification and decision history are available. Broader dashboard and account moderation remain planned. |

---

## 🔍 Troubleshooting

### 1. PostgreSQL Connection Error (`ECONNREFUSED` or `28P01`)
- **Cause:** PostgreSQL service is stopped, or `.env` credentials do not match PostgreSQL.
- **Solution:** On Windows, start the service using `Start-Service postgresql-x64-18` (PowerShell as Administrator). Verify `DB_USER`, `DB_PASSWORD`, and `DB_DATABASE="chabondhu_db"` in `.env`.

### 2. Missing Database Tables (`relation "..." does not exist`)
- **Cause:** The database was created but migrations have not been run.
- **Solution:** Run `pnpm run migration:run`. Never enable `synchronize: true`.

### 3. Invalid Request Payload (`400 Bad Request Payload`)
- **Cause:** The application's global `ValidationPipe` enforces strict whitelisting (`forbidNonWhitelisted: true`).
- **Solution:** Verify that your request JSON body contains only the exact fields documented in the Swagger UI and DTO schemas.

### 4. Port Conflict (`EADDRINUSE: address already in use :::5001`)
- **Cause:** Another process is listening on port `5001`.
- **Solution:** Change `PORT=5002` in your `.env` file and restart the development server.

### 5. pnpm Lifecycle Script Warning
- **Cause:** pnpm v12 blocks lifecycle build scripts by default.
- **Solution:** `argon2` and `@swc/core` include prebuilt platform binaries. The project runs and builds normally without running external install scripts.

---

## 📄 License

This project's `package.json` specifies the **MIT License**.
