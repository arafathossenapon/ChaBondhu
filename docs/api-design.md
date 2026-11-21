# ChaBondhu — API Design

**Version:** 1.0  
**Date:** 2026-11-05  
**Framework:** NestJS  
**Base URL:** `http://localhost:3000`  
**API Documentation:** Available at `/api/docs` (Swagger UI)

---

## Table of Contents

1. [Conventions](#1-conventions)
2. [Authentication](#2-authentication)
3. [Error Response Format](#3-error-response-format)
4. [Module: Auth](#4-module-auth)
5. [Module: Users](#5-module-users)
6. [Module: Farmer Profiles](#6-module-farmer-profiles)
7. [Module: Harvest Listings](#7-module-harvest-listings)
8. [Module: Factory Profiles](#8-module-factory-profiles)
9. [Module: Price Offers](#9-module-price-offers)
10. [Module: Orders](#10-module-orders)
11. [Module: Payments](#11-module-payments)
12. [Module: Admin](#12-module-admin)
13. [HTTP Status Code Reference](#13-http-status-code-reference)
14. [Complete Endpoint Index](#14-complete-endpoint-index)

---

## 1. Conventions

### 1.1 URL Structure

```
/resource              → collection operations (list, create)
/resource/:id          → single resource operations (read, update, delete)
/resource/:id/action   → specific actions on a resource (e.g., /orders/:id/status)
```

### 1.2 HTTP Methods

| Method | Meaning | Success Code |
|---|---|---|
| `GET` | Read one or many | `200 OK` |
| `POST` | Create a new resource | `201 Created` |
| `PATCH` | Partial update | `200 OK` |
| `DELETE` | Remove or soft-delete | `200 OK` |

### 1.3 Auth Header

Protected endpoints require a JWT token in the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

### 1.4 Role Labels

| Label | Meaning |
|---|---|
| Public | No token required |
| GROWER | Requires JWT with `role = GROWER` |
| FACTORY | Requires JWT with `role = FACTORY` |
| ADMIN | Requires JWT with `role = ADMIN` |
| Any Auth | Any valid JWT token (any role) |

### 1.5 Decimal Values

All monetary and quantity values in request bodies and responses are JSON numbers with up to 2–3 decimal places. Never use string formatting in the API layer for these values — that is a frontend concern.

---

## 2. Authentication

The API uses **JWT Bearer Token authentication**.

- Tokens are issued by `POST /auth/login`.
- Tokens contain: `sub` (user ID), `email`, `role`.
- Token expiry is configured in the environment variable `JWT_EXPIRES_IN` (e.g., `7d`).
- Refresh tokens are **not implemented** in the MVP.

---

## 3. Error Response Format

All errors follow a consistent structure returned by NestJS exception filters:

```json
{
  "statusCode": 404,
  "message": "Harvest listing not found",
  "error": "Not Found"
}
```

Validation errors (from `ValidationPipe`) return an array of messages:

```json
{
  "statusCode": 400,
  "message": [
    "pricePerKg must be a positive number",
    "validUntil must be a valid date string"
  ],
  "error": "Bad Request"
}
```

---

## 4. Module: Auth

**Base path:** `/auth`

---

### 4.1 Register

**`POST /auth/register`**

| Property | Value |
|---|---|
| Auth | Public |
| Description | Register a new GROWER or FACTORY user account |

**Request Body:**

```json
{
  "fullName": "Rahim Uddin",
  "email": "rahim@example.com",
  "password": "SecurePass123",
  "phoneNumber": "01711000001",
  "role": "GROWER"
}
```

| Field | Type | Required | Rules |
|---|---|---|---|
| `fullName` | string | Yes | 2–150 characters |
| `email` | string | Yes | Valid email format |
| `password` | string | Yes | Minimum 8 characters |
| `phoneNumber` | string | Yes | Valid phone number |
| `role` | enum | Yes | `GROWER` or `FACTORY` only (`ADMIN` is not allowed here) |

**Success Response — `201 Created`:**

```json
{
  "id": 1,
  "fullName": "Rahim Uddin",
  "email": "rahim@example.com",
  "phoneNumber": "01711000001",
  "role": "GROWER",
  "isActive": true,
  "createdAt": "2026-11-05T10:00:00.000Z"
}
```

**Error Cases:**

| Status | Condition |
|---|---|
| `400 Bad Request` | Missing or invalid fields |
| `409 Conflict` | Email is already registered |

---

### 4.2 Login

**`POST /auth/login`**

| Property | Value |
|---|---|
| Auth | Public |
| Description | Authenticate a user and receive a JWT token |

**Request Body:**

```json
{
  "email": "rahim@example.com",
  "password": "SecurePass123"
}
```

| Field | Type | Required | Rules |
|---|---|---|---|
| `email` | string | Yes | Valid email format |
| `password` | string | Yes | Non-empty |

**Success Response — `200 OK`:**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "fullName": "Rahim Uddin",
    "email": "rahim@example.com",
    "role": "GROWER"
  }
}
```

**Error Cases:**

| Status | Condition |
|---|---|
| `400 Bad Request` | Missing fields |
| `401 Unauthorized` | Incorrect email or password |
| `403 Forbidden` | Account is deactivated (`isActive = false`) |

---

## 5. Module: Users

**Base path:** `/users`

---

### 5.1 Get Own Profile

**`GET /users/me`**

| Property | Value |
|---|---|
| Auth | Any Auth |
| Description | Get the authenticated user's own account details |

**Success Response — `200 OK`:**

```json
{
  "id": 1,
  "fullName": "Rahim Uddin",
  "email": "rahim@example.com",
  "phoneNumber": "01711000001",
  "role": "GROWER",
  "isActive": true,
  "createdAt": "2026-11-05T10:00:00.000Z"
}
```

**Error Cases:**

| Status | Condition |
|---|---|
| `401 Unauthorized` | No token or invalid token |

---

### 5.2 Update Own Profile

**`PATCH /users/me`**

| Property | Value |
|---|---|
| Auth | Any Auth |
| Description | Update the authenticated user's own name or phone number |

**Request Body (all fields optional):**

```json
{
  "fullName": "Rahim Uddin Ahmed",
  "phoneNumber": "01711000002"
}
```

| Field | Type | Required | Rules |
|---|---|---|---|
| `fullName` | string | No | 2–150 characters |
| `phoneNumber` | string | No | Valid phone number |

> **Note:** `email` and `role` cannot be changed through this endpoint.

**Success Response — `200 OK`:** Returns the updated user object (same shape as 5.1).

**Error Cases:**

| Status | Condition |
|---|---|
| `400 Bad Request` | Invalid field values |
| `401 Unauthorized` | No token or invalid token |

---

## 6. Module: Farmer Profiles

**Base path:** `/farmer-profiles`

---

### 6.1 Create Farmer Profile

**`POST /farmer-profiles`**

| Property | Value |
|---|---|
| Auth | GROWER |
| Description | Create the authenticated farmer's farm profile. Only one profile per farmer. |

**Request Body:**

```json
{
  "gardenName": "Rahim Tea Garden",
  "division": "Rangpur",
  "district": "Panchagarh",
  "upazila": "Tetulia",
  "village": "Bhajanghat",
  "farmSizeAcres": 5.25,
  "description": "Small organic tea garden established in 2010."
}
```

| Field | Type | Required | Rules |
|---|---|---|---|
| `gardenName` | string | Yes | 2–200 characters |
| `division` | string | Yes | Non-empty |
| `district` | string | Yes | Non-empty |
| `upazila` | string | Yes | Non-empty |
| `village` | string | No | — |
| `farmSizeAcres` | number | No | Positive decimal; informational only |
| `description` | string | No | — |

**Success Response — `201 Created`:** Returns the created `FarmerProfile` object.

**Error Cases:**

| Status | Condition |
|---|---|
| `400 Bad Request` | Missing required fields |
| `401 Unauthorized` | No token |
| `403 Forbidden` | User is not a GROWER |
| `409 Conflict` | Farmer already has a profile |

---

### 6.2 Get Farmer Profile by ID

**`GET /farmer-profiles/:id`**

| Property | Value |
|---|---|
| Auth | Any Auth |
| Description | Get a specific farmer profile (publicly accessible to logged-in users) |

**Success Response — `200 OK`:** Returns the `FarmerProfile` object.

**Error Cases:**

| Status | Condition |
|---|---|
| `401 Unauthorized` | No token |
| `404 Not Found` | Profile does not exist |

---

### 6.3 Get Own Farmer Profile

**`GET /farmer-profiles/me`**

| Property | Value |
|---|---|
| Auth | GROWER |
| Description | Get the authenticated farmer's own profile |

**Success Response — `200 OK`:** Returns the `FarmerProfile` object.

**Error Cases:**

| Status | Condition |
|---|---|
| `401 Unauthorized` | No token |
| `403 Forbidden` | User is not a GROWER |
| `404 Not Found` | Farmer has not created a profile yet |

---

### 6.4 Update Own Farmer Profile

**`PATCH /farmer-profiles/me`**

| Property | Value |
|---|---|
| Auth | GROWER |
| Description | Update the authenticated farmer's own profile |

**Request Body (all fields optional):**

```json
{
  "gardenName": "Rahim Premium Tea Garden",
  "village": "Updated Village",
  "farmSizeAcres": 6.0,
  "description": "Updated description."
}
```

**Success Response — `200 OK`:** Returns the updated `FarmerProfile` object.

**Error Cases:**

| Status | Condition |
|---|---|
| `400 Bad Request` | Invalid field values |
| `401 Unauthorized` | No token |
| `403 Forbidden` | User is not a GROWER |
| `404 Not Found` | Farmer has not created a profile yet |

---

## 7. Module: Harvest Listings

**Base path:** `/listings`

---

### 7.1 Create Harvest Listing

**`POST /listings`**

| Property | Value |
|---|---|
| Auth | GROWER |
| Description | Create a new harvest listing. Farmer must have an existing farm profile. |

**Request Body:**

```json
{
  "teaGrade": "CTC",
  "estimatedQuantityKg": 350.5,
  "expectedHarvestDate": "2026-12-15",
  "lastHarvestDate": "2026-09-20",
  "qualityDescription": "First flush, medium leaf, clean.",
  "collectionLocation": "Bhajanghat village, Tetulia, Panchagarh",
  "notes": "Leaves will be ready after 10 AM."
}
```

| Field | Type | Required | Rules |
|---|---|---|---|
| `teaGrade` | string | Yes | Non-empty; free text |
| `estimatedQuantityKg` | number | Yes | Positive decimal |
| `expectedHarvestDate` | string | Yes | ISO date format `YYYY-MM-DD` |
| `lastHarvestDate` | string | No | ISO date format |
| `qualityDescription` | string | No | — |
| `collectionLocation` | string | Yes | Non-empty |
| `notes` | string | No | — |

**Success Response — `201 Created`:** Returns the created `HarvestListing` object.

**Error Cases:**

| Status | Condition |
|---|---|
| `400 Bad Request` | Missing or invalid fields |
| `401 Unauthorized` | No token |
| `403 Forbidden` | User is not a GROWER |
| `404 Not Found` | Farmer has no farm profile |

---

### 7.2 Get All Active Listings

**`GET /listings`**

| Property | Value |
|---|---|
| Auth | Any Auth |
| Description | Browse all active harvest listings (marketplace view) |

**Query Parameters (optional):**

| Param | Type | Description |
|---|---|---|
| `teaGrade` | string | Filter by tea grade (partial match) |
| `district` | string | Filter by farmer's district |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20, max: 100) |

**Success Response — `200 OK`:**

```json
{
  "data": [
    {
      "id": 12,
      "teaGrade": "CTC",
      "estimatedQuantityKg": "350.500",
      "expectedHarvestDate": "2026-12-15",
      "collectionLocation": "Bhajanghat village, Tetulia, Panchagarh",
      "status": "ACTIVE",
      "farmerProfile": {
        "id": 3,
        "gardenName": "Rahim Tea Garden",
        "district": "Panchagarh"
      },
      "createdAt": "2026-11-05T10:00:00.000Z"
    }
  ],
  "total": 45,
  "page": 1,
  "limit": 20
}
```

**Error Cases:**

| Status | Condition |
|---|---|
| `401 Unauthorized` | No token |

---

### 7.3 Get Single Listing

**`GET /listings/:id`**

| Property | Value |
|---|---|
| Auth | Any Auth |
| Description | Get full details of a specific harvest listing |

**Success Response — `200 OK`:** Returns full `HarvestListing` with nested `FarmerProfile`.

**Error Cases:**

| Status | Condition |
|---|---|
| `401 Unauthorized` | No token |
| `404 Not Found` | Listing not found or is inactive |

---

### 7.4 Get Own Listings

**`GET /listings/my`**

| Property | Value |
|---|---|
| Auth | GROWER |
| Description | Get all listings created by the authenticated farmer |

**Success Response — `200 OK`:** Returns array of the farmer's own listings (all statuses).

---

### 7.5 Update Listing

**`PATCH /listings/:id`**

| Property | Value |
|---|---|
| Auth | GROWER |
| Description | Update a harvest listing. Only the listing's owner can update it. Only allowed when status is `ACTIVE`. |

**Request Body (all fields optional):**

```json
{
  "estimatedQuantityKg": 400.0,
  "qualityDescription": "Updated quality notes.",
  "notes": "Available after Dec 10."
}
```

> `teaGrade`, `collectionLocation`, and `expectedHarvestDate` can also be updated.  
> `status` cannot be freely set here — use the cancel endpoint instead.

**Error Cases:**

| Status | Condition |
|---|---|
| `400 Bad Request` | Invalid fields |
| `401 Unauthorized` | No token |
| `403 Forbidden` | User is not the listing's owner |
| `404 Not Found` | Listing not found |
| `409 Conflict` | Listing is not in `ACTIVE` status |

---

### 7.6 Cancel Listing

**`PATCH /listings/:id/cancel`**

| Property | Value |
|---|---|
| Auth | GROWER |
| Description | Cancel a listing. Only allowed if no order is in `ACCEPTED` or later status. |

**Request Body:** None required.

**Success Response — `200 OK`:** Returns the listing with `status = "CANCELLED"`.

**Error Cases:**

| Status | Condition |
|---|---|
| `401 Unauthorized` | No token |
| `403 Forbidden` | Not the listing's owner |
| `404 Not Found` | Listing not found |
| `409 Conflict` | Listing has an active/accepted order; cancellation not allowed |

---

### 7.7 Admin: Remove Listing (Soft Delete)

**`DELETE /listings/:id`**

| Property | Value |
|---|---|
| Auth | ADMIN |
| Description | Soft-delete a listing for moderation purposes (sets `isActive = false`) |

**Success Response — `200 OK`:**

```json
{
  "message": "Listing has been deactivated."
}
```

**Error Cases:**

| Status | Condition |
|---|---|
| `401 Unauthorized` | No token |
| `403 Forbidden` | Not an ADMIN |
| `404 Not Found` | Listing not found |

---

## 8. Module: Factory Profiles

**Base path:** `/factory-profiles`

---

### 8.1 Create Factory Profile

**`POST /factory-profiles`**

| Property | Value |
|---|---|
| Auth | FACTORY |
| Description | Create the authenticated factory's profile. One profile per factory user. |

**Request Body:**

```json
{
  "factoryName": "Panchagarh Tea Processing Ltd.",
  "representativeName": "Karim Hossain",
  "district": "Panchagarh",
  "upazila": "Panchagarh Sadar",
  "address": "123 Industrial Area, Panchagarh"
}
```

| Field | Type | Required | Rules |
|---|---|---|---|
| `factoryName` | string | Yes | 2–200 characters |
| `representativeName` | string | Yes | 2–150 characters |
| `district` | string | Yes | Non-empty |
| `upazila` | string | Yes | Non-empty |
| `address` | string | No | — |

**Success Response — `201 Created`:** Returns the created `FactoryProfile` with `verificationStatus: "PENDING"` and `isVerified: false`.

**Error Cases:**

| Status | Condition |
|---|---|
| `400 Bad Request` | Missing required fields |
| `401 Unauthorized` | No token |
| `403 Forbidden` | User is not a FACTORY |
| `409 Conflict` | Factory already has a profile |

---

### 8.2 Get Factory Profile by ID

**`GET /factory-profiles/:id`**

| Property | Value |
|---|---|
| Auth | Any Auth |
| Description | Get a factory profile by its ID |

**Success Response — `200 OK`:** Returns `FactoryProfile` (without sensitive fields).

**Error Cases:**

| Status | Condition |
|---|---|
| `401 Unauthorized` | No token |
| `404 Not Found` | Profile not found |

---

### 8.3 Get Own Factory Profile

**`GET /factory-profiles/me`**

| Property | Value |
|---|---|
| Auth | FACTORY |
| Description | Get the authenticated factory's own profile |

---

### 8.4 Update Own Factory Profile

**`PATCH /factory-profiles/me`**

| Property | Value |
|---|---|
| Auth | FACTORY |
| Description | Update the factory's own profile details |

**Request Body (all optional):**

```json
{
  "factoryName": "Panchagarh Premium Tea Ltd.",
  "representativeName": "Karim Ahmed",
  "district": "Panchagarh",
  "upazila": "Tetulia",
  "address": "Updated address."
}
```

**Success Response — `200 OK`:** Returns the updated `FactoryProfile`.

**Error Cases:**

| Status | Condition |
|---|---|
| `400 Bad Request` | Invalid fields |
| `401 Unauthorized` | No token |
| `403 Forbidden` | Not a FACTORY user |
| `404 Not Found` | Profile not created yet |

---

## 9. Module: Price Offers

**Base path:** `/offers`

---

### 9.1 Create Price Offer

**`POST /offers`**

| Property | Value |
|---|---|
| Auth | FACTORY |
| Description | Publish a buying price offer for a tea grade. The authenticated factory must have a profile in `VERIFIED` status. |

**Request Body:**

```json
{
  "teaGrade": "CTC",
  "pricePerKg": 28.50,
  "qualityRequirements": "Fresh, moisture below 70%, no damaged leaves.",
  "minimumQuantityKg": 100.0,
  "validUntil": "2026-12-31",
  "estimatedTransportCostBdt": 500.00,
  "notes": "Collection every Saturday."
}
```

| Field | Type | Required | Rules |
|---|---|---|---|
| `teaGrade` | string | Yes | 1–100 characters after trimming |
| `pricePerKg` | number | Yes | Positive BDT per kg with up to 2 decimal places |
| `qualityRequirements` | string | No | — |
| `minimumQuantityKg` | number | No | Positive kg with up to 3 decimal places if provided |
| `validUntil` | string | Yes | Calendar date `YYYY-MM-DD` after the current date in Bangladesh |
| `estimatedTransportCostBdt` | number | No | Flat, non-negative BDT estimate with up to 2 decimal places |
| `notes` | string | No | — |

**Success Response — `201 Created`:** Returns the created `PriceOffer` with `status: "ACTIVE"`.

The server sets `factoryProfileId` from the signed-in account. The DTO accepts the fields above. Including a listing ID, factory profile ID, or status in the request returns HTTP 400. A harvest listing and an offer will be linked through the future Orders workflow.

**Error Cases:**

| Status | Condition |
|---|---|
| `400 Bad Request` | Missing or invalid fields, including an expiry date on or before today |
| `401 Unauthorized` | No token |
| `403 Forbidden` | User is not a FACTORY, or factory is not verified |
| `404 Not Found` | Factory has no profile |

---

### 9.2 Get All Active Offers

**`GET /offers`**

| Property | Value |
|---|---|
| Auth | Any Auth |
| Description | Browse all currently active price offers (price comparison view for farmers) |

**Query Parameters (optional):**

| Param | Type | Description |
|---|---|---|
| `teaGrade` | string | Filter by tea grade |
| `minPrice` | number | Minimum price per kg |
| `maxPrice` | number | Maximum price per kg |
| `sortBy` | string | `pricePerKg`, `validUntil`, `minimumQuantityKg` |
| `sortOrder` | string | `ASC` or `DESC` (default: `DESC` for price) |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20) |

**Success Response — `200 OK`:**

```json
{
  "data": [
    {
      "id": 5,
      "teaGrade": "CTC",
      "pricePerKg": "28.50",
      "qualityRequirements": "Fresh, moisture below 70%.",
      "minimumQuantityKg": "100.000",
      "validUntil": "2026-12-31",
      "estimatedTransportCostBdt": "500.00",
      "status": "ACTIVE",
      "factoryProfile": {
        "id": 2,
        "factoryName": "Panchagarh Tea Processing Ltd.",
        "district": "Panchagarh"
      },
      "createdAt": "2026-11-05T10:00:00.000Z"
    }
  ],
  "total": 12,
  "page": 1,
  "limit": 20
}
```

**Error Cases:**

| Status | Condition |
|---|---|
| `401 Unauthorized` | No token |

---

### 9.3 Get Single Offer

**`GET /offers/:id`**

| Property | Value |
|---|---|
| Auth | Any Auth |
| Description | Get full details of a specific price offer |

**Success Response — `200 OK`:** Returns full `PriceOffer` with nested `FactoryProfile`.

**Error Cases:**

| Status | Condition |
|---|---|
| `401 Unauthorized` | No token |
| `404 Not Found` | Offer not found |

---

### 9.4 Get Own Offers

**`GET /offers/my`**

| Property | Value |
|---|---|
| Auth | FACTORY |
| Description | Get all price offers created by the authenticated factory (all statuses) |

---

### 9.5 Update Offer

**`PATCH /offers/:id`**

| Property | Value |
|---|---|
| Auth | FACTORY |
| Description | Update an active price offer. Only the owning factory can update it. Existing orders are NOT affected. |

**Request Body (all optional):**

```json
{
  "pricePerKg": 29.00,
  "minimumQuantityKg": 150.0,
  "validUntil": "2027-01-31",
  "notes": "Updated schedule."
}
```

**Success Response — `200 OK`:** Returns the updated `PriceOffer`.

**Error Cases:**

| Status | Condition |
|---|---|
| `400 Bad Request` | Invalid fields |
| `401 Unauthorized` | No token |
| `403 Forbidden` | Not the offer's owner |
| `404 Not Found` | Offer not found |
| `409 Conflict` | Offer is not in `ACTIVE` status |

---

### 9.6 Withdraw Offer

**`PATCH /offers/:id/withdraw`**

| Property | Value |
|---|---|
| Auth | FACTORY |
| Description | Withdraw an active offer. Sets status to `WITHDRAWN`. Existing orders are NOT affected. |

**Success Response — `200 OK`:** Returns the offer with `status: "WITHDRAWN"`.

**Error Cases:**

| Status | Condition |
|---|---|
| `401 Unauthorized` | No token |
| `403 Forbidden` | Not the offer's owner |
| `404 Not Found` | Offer not found |
| `409 Conflict` | Offer is already withdrawn or expired |

---

## 10. Module: Orders

**Base path:** `/orders`

---

### 10.1 Create Order (Farmer Submits Request)

**`POST /orders`**

| Property | Value |
|---|---|
| Auth | GROWER |
| Description | Submit an order request linking the farmer's listing to a factory's price offer. |

**Request Body:**

```json
{
  "harvestListingId": 12,
  "priceOfferId": 5
}
```

| Field | Type | Required | Rules |
|---|---|---|---|
| `harvestListingId` | number | Yes | Must be an `ACTIVE` listing owned by the authenticated farmer |
| `priceOfferId` | number | Yes | Must be an `ACTIVE` offer |

**Service Logic (checked in service layer):**
- The listing must be `ACTIVE` and `isActive = true`.
- The offer must be `ACTIVE` and not expired.
- The listing must belong to the authenticated farmer.
- The listing must not already have an `ACCEPTED` or later order against it.
- `agreedPricePerKg` is set from `priceOffer.pricePerKg` at this moment and stored immutably.

**Success Response — `201 Created`:**

```json
{
  "id": 88,
  "harvestListingId": 12,
  "priceOfferId": 5,
  "farmerProfileId": 3,
  "factoryProfileId": 2,
  "agreedPricePerKg": "28.50",
  "estimatedQuantityKg": "350.500",
  "actualCollectedWeightKg": null,
  "orderStatus": "REQUESTED",
  "paymentStatus": "PENDING",
  "proposedCollectionDate": null,
  "collectionPoint": null,
  "pickupNotes": null,
  "estimatedTransportCostBdt": null,
  "createdAt": "2026-11-05T10:00:00.000Z"
}
```

**Error Cases:**

| Status | Condition |
|---|---|
| `400 Bad Request` | Missing fields |
| `401 Unauthorized` | No token |
| `403 Forbidden` | User is not a GROWER; listing does not belong to this farmer |
| `404 Not Found` | Listing or offer not found |
| `409 Conflict` | Listing is not ACTIVE; offer is expired or withdrawn; listing already has an accepted order |

---

### 10.2 Get Own Orders

**`GET /orders/my`**

| Property | Value |
|---|---|
| Auth | GROWER or FACTORY |
| Description | Get all orders relevant to the authenticated user (farmer sees own orders; factory sees incoming orders against their offers) |

**Query Parameters (optional):**

| Param | Type | Description |
|---|---|---|
| `orderStatus` | string | Filter by order status |
| `paymentStatus` | string | Filter by payment status |
| `page` | number | Page number |
| `limit` | number | Items per page |

**Success Response — `200 OK`:** Returns paginated list of orders with related data.

---

### 10.3 Get Single Order

**`GET /orders/:id`**

| Property | Value |
|---|---|
| Auth | Any Auth |
| Description | Get full order details. A farmer can only see their own orders; a factory can only see orders against their offers; an admin can see all. |

**Success Response — `200 OK`:** Returns the full `Order` with nested listing, offer, farmer, and factory data.

**Error Cases:**

| Status | Condition |
|---|---|
| `401 Unauthorized` | No token |
| `403 Forbidden` | Authenticated user is not related to this order |
| `404 Not Found` | Order not found |

---

### 10.4 Update Order Status

**`PATCH /orders/:id/status`**

| Property | Value |
|---|---|
| Auth | GROWER or FACTORY |
| Description | Advance the order status. Only valid transitions are allowed. |

**Request Body:**

```json
{
  "orderStatus": "ACCEPTED"
}
```

| Transition | Required Additional Fields |
|---|---|
| `REQUESTED → ACCEPTED` | None |
| `REQUESTED → REJECTED` | None |
| `ACCEPTED → PICKUP_SCHEDULED` | `proposedCollectionDate`, `collectionPoint` required |
| `ACCEPTED → CANCELLED` | None (farmer only) |
| `PICKUP_SCHEDULED → COLLECTED` | `actualCollectedWeightKg` required |
| `COLLECTED → COMPLETED` | None |

**Extended Request Body for `PICKUP_SCHEDULED`:**

```json
{
  "orderStatus": "PICKUP_SCHEDULED",
  "proposedCollectionDate": "2026-12-18",
  "collectionPoint": "Bhajanghat village market, Tetulia",
  "pickupNotes": "Factory truck arrives at 9 AM.",
  "estimatedTransportCostBdt": 500.00
}
```

**Extended Request Body for `COLLECTED`:**

```json
{
  "orderStatus": "COLLECTED",
  "actualCollectedWeightKg": 342.75
}
```

**Success Response — `200 OK`:** Returns the updated `Order` object.

**Error Cases:**

| Status | Condition |
|---|---|
| `400 Bad Request` | Invalid status value; missing required fields for the transition |
| `401 Unauthorized` | No token |
| `403 Forbidden` | User is not authorized to make this transition |
| `404 Not Found` | Order not found |
| `409 Conflict` | Transition is not valid from the current status |

---

### 10.5 Update Payment Status

**`PATCH /orders/:id/payment-status`**

| Property | Value |
|---|---|
| Auth | FACTORY |
| Description | Update the payment status of an order. Only the factory involved in the order can do this. |

**Request Body:**

```json
{
  "paymentStatus": "PROCESSING",
  "paymentMethod": "Bank Transfer",
  "paymentDate": null,
  "notes": "Transfer initiated via DBBL."
}
```

| Field | Type | Required | Rules |
|---|---|---|---|
| `paymentStatus` | enum | Yes | Valid payment status enum value |
| `paymentMethod` | string | No | Free text |
| `paymentDate` | string | No | ISO date; set when marking as `COMPLETED` |
| `notes` | string | No | — |

**Success Response — `200 OK`:** Returns the updated `Order` and `Payment` objects.

**Error Cases:**

| Status | Condition |
|---|---|
| `400 Bad Request` | Invalid payment status or transition |
| `401 Unauthorized` | No token |
| `403 Forbidden` | Not the factory involved in this order |
| `404 Not Found` | Order not found |
| `409 Conflict` | Invalid payment status transition |

---

## 11. Module: Payments

**Base path:** `/payments`

---

### 11.1 Get Payment Record for an Order

**`GET /payments/order/:orderId`**

| Property | Value |
|---|---|
| Auth | GROWER, FACTORY, or ADMIN |
| Description | Get the payment record for a specific order. Access limited to parties involved in the order. |

**Success Response — `200 OK`:**

```json
{
  "id": 15,
  "orderId": 88,
  "agreedPricePerKg": "28.50",
  "actualCollectedWeightKg": "342.750",
  "totalAmountBdt": "9768.38",
  "paymentStatus": "PENDING",
  "paymentMethod": null,
  "paymentDate": null,
  "notes": null,
  "createdAt": "2026-11-05T14:00:00.000Z"
}
```

**Error Cases:**

| Status | Condition |
|---|---|
| `401 Unauthorized` | No token |
| `403 Forbidden` | User is not a party to this order |
| `404 Not Found` | No payment record for this order yet |

---

## 12. Module: Admin

**Base path:** `/admin`

> All endpoints in this module require `ADMIN` role.

---

### 12.1 List All Users

**`GET /admin/users`**

| Property | Value |
|---|---|
| Auth | ADMIN |
| Description | Paginated list of all registered users |

**Query Parameters (optional):**

| Param | Type | Description |
|---|---|---|
| `role` | string | Filter by role: `GROWER`, `FACTORY`, `ADMIN` |
| `isActive` | boolean | Filter active/inactive users |
| `page` | number | Page number |
| `limit` | number | Items per page |

**Success Response — `200 OK`:** Returns paginated list of `User` objects (without `passwordHash`).

---

### 12.2 Get User Details

**`GET /admin/users/:id`**

| Property | Value |
|---|---|
| Auth | ADMIN |
| Description | Get detailed information about any user |

**Success Response — `200 OK`:** Returns `User` object with linked profile.

**Error Cases:**

| Status | Condition |
|---|---|
| `404 Not Found` | User not found |

---

### 12.3 Verify Factory Account

**`PATCH /admin/users/:id/verify`**

| Property | Value |
|---|---|
| Auth | ADMIN |
| Description | Mark a factory account as verified so it can publish price offers |

**Request Body:** None required.

**Success Response — `200 OK`:**

```json
{
  "message": "Factory account has been verified.",
  "factoryProfile": {
    "id": 2,
    "factoryName": "Panchagarh Tea Processing Ltd.",
    "verificationStatus": "VERIFIED",
    "isVerified": true,
    "verifiedAt": "2026-11-05T12:00:00.000Z",
    "verifiedByAdminId": 1
  }
}
```

**Error Cases:**

| Status | Condition |
|---|---|
| `403 Forbidden` | Not an ADMIN |
| `404 Not Found` | User not found or user is not a FACTORY |
| `409 Conflict` | Factory verification is outside the pending state |

#### Review, rejection, and resubmission

| Method and path | Access | Behavior |
|---|---|---|
| `GET /admin/users/:id/factory-verification` | ADMIN | Returns the factory profile and decision history by factory user ID |
| `PATCH /admin/users/:id/reject-verification` | ADMIN | Rejects a pending profile. Requires a trimmed `reason` of 1–1,000 characters. |
| `GET /factory-profiles/me/verification-history` | FACTORY | Returns the signed-in factory's decision history, newest first |
| `PATCH /factory-profiles/me/resubmit-verification` | FACTORY | Returns the signed-in factory's rejected profile to `PENDING` |

Signed-in profile readers can see `verificationStatus` and the derived `isVerified` flag. Decision history and rejection reasons are available through the admin and owner routes above. Approval and rejection return HTTP 409 outside the pending state. Resubmission returns HTTP 409 outside the rejected state.

---

### 12.4 Deactivate User Account

**`PATCH /admin/users/:id/deactivate`**

| Property | Value |
|---|---|
| Auth | ADMIN |
| Description | Deactivate a user account. The user will not be able to log in. |

**Success Response — `200 OK`:**

```json
{
  "message": "User account has been deactivated."
}
```

**Error Cases:**

| Status | Condition |
|---|---|
| `403 Forbidden` | Not an ADMIN |
| `404 Not Found` | User not found |
| `409 Conflict` | Account is already deactivated |

---

### 12.5 Reactivate User Account

**`PATCH /admin/users/:id/activate`**

| Property | Value |
|---|---|
| Auth | ADMIN |
| Description | Reactivate a previously deactivated user account |

**Success Response — `200 OK`:**

```json
{
  "message": "User account has been reactivated."
}
```

---

### 12.6 List All Listings (Admin View)

**`GET /admin/listings`**

| Property | Value |
|---|---|
| Auth | ADMIN |
| Description | View all harvest listings across all farmers (all statuses, including inactive) |

**Query Parameters:** `status`, `isActive`, `page`, `limit`

**Success Response — `200 OK`:** Paginated list of all listings.

---

### 12.7 List All Orders (Admin View)

**`GET /admin/orders`**

| Property | Value |
|---|---|
| Auth | ADMIN |
| Description | View all orders across the entire platform for oversight |

**Query Parameters:** `orderStatus`, `paymentStatus`, `page`, `limit`

**Success Response — `200 OK`:** Paginated list of all orders.

---

## 13. HTTP Status Code Reference

| Code | Meaning | When Used |
|---|---|---|
| `200 OK` | Successful read or update | `GET`, `PATCH`, `DELETE` success |
| `201 Created` | Resource created | `POST` success |
| `400 Bad Request` | Validation failed or bad input | Missing fields, invalid values, bad transitions |
| `401 Unauthorized` | No token or invalid token | Missing or expired JWT |
| `403 Forbidden` | Token valid but role/ownership mismatch | Wrong role, accessing another user's resource |
| `404 Not Found` | Resource does not exist | Invalid ID in URL |
| `409 Conflict` | Business rule violation | Duplicate email, invalid status transition, already verified |
| `500 Internal Server Error` | Unexpected server error | Database failures, unhandled exceptions |

---

## 14. Complete Endpoint Index

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Register new user |
| `POST` | `/auth/login` | Public | Login and receive JWT |
| `GET` | `/users/me` | Any Auth | Get own user profile |
| `PATCH` | `/users/me` | Any Auth | Update own user profile |
| `POST` | `/farmer-profiles` | GROWER | Create farmer profile |
| `GET` | `/farmer-profiles/me` | GROWER | Get own farmer profile |
| `GET` | `/farmer-profiles/:id` | Any Auth | Get farmer profile by ID |
| `PATCH` | `/farmer-profiles/me` | GROWER | Update own farmer profile |
| `POST` | `/listings` | GROWER | Create harvest listing |
| `GET` | `/listings` | Any Auth | Browse all active listings |
| `GET` | `/listings/my` | GROWER | Get own listings |
| `GET` | `/listings/:id` | Any Auth | Get listing by ID |
| `PATCH` | `/listings/:id` | GROWER | Update listing |
| `PATCH` | `/listings/:id/cancel` | GROWER | Cancel listing |
| `DELETE` | `/listings/:id` | ADMIN | Soft-delete listing |
| `POST` | `/factory-profiles` | FACTORY | Create factory profile |
| `GET` | `/factory-profiles/me` | FACTORY | Get own factory profile |
| `GET` | `/factory-profiles/:id` | Any Auth | Get factory profile by ID |
| `PATCH` | `/factory-profiles/me` | FACTORY | Update own factory profile |
| `POST` | `/offers` | FACTORY | Create price offer |
| `GET` | `/offers` | Any Auth | Browse all active offers |
| `GET` | `/offers/my` | FACTORY | Get own offers |
| `GET` | `/offers/:id` | Any Auth | Get offer by ID |
| `PATCH` | `/offers/:id` | FACTORY | Update price offer |
| `PATCH` | `/offers/:id/withdraw` | FACTORY | Withdraw price offer |
| `POST` | `/orders` | GROWER | Create order request |
| `GET` | `/orders/my` | GROWER / FACTORY | Get own orders |
| `GET` | `/orders/:id` | Any Auth | Get order by ID |
| `PATCH` | `/orders/:id/status` | GROWER / FACTORY | Update order status |
| `PATCH` | `/orders/:id/payment-status` | FACTORY | Update payment status |
| `GET` | `/payments/order/:orderId` | Any Auth | Get payment record for order |
| `GET` | `/admin/users` | ADMIN | List all users |
| `GET` | `/admin/users/:id` | ADMIN | Get user details |
| `PATCH` | `/admin/users/:id/verify` | ADMIN | Verify factory account |
| `PATCH` | `/admin/users/:id/deactivate` | ADMIN | Deactivate user |
| `PATCH` | `/admin/users/:id/activate` | ADMIN | Reactivate user |
| `GET` | `/admin/listings` | ADMIN | View all listings |
| `GET` | `/admin/orders` | ADMIN | View all orders |

---

*Document version: 1.0*  
*Created: 2026-11-05*  
*Update this document when any endpoint is added, removed, or changed.*
