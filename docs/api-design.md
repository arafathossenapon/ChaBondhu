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

DTO validation failures return HTTP 400 with a generic message from `ValidationPipe`.

```json
{
  "statusCode": 400,
  "message": "Bad Request Payload",
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

The server sets `factoryProfileId` from the signed-in account. The DTO accepts the fields above. Including a listing ID, factory profile ID, or status in the request returns HTTP 400. An order request links a harvest listing to one of the requesting factory’s own eligible price offers. The factory supplies both IDs in `POST /order-requests`.

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
| Description | Browse `ACTIVE` price offers through their `validUntil` date in Bangladesh |

**Query Parameters (optional):**

| Param | Type | Description |
|---|---|---|
| `teaGrade` | string | Case-insensitive exact match after trimming |
| `minPrice` | number | Inclusive lower bound in BDT per kg, non-negative with up to 2 decimal places |
| `maxPrice` | number | Inclusive upper bound in BDT per kg, non-negative with up to 2 decimal places |
| `sortBy` | string | `pricePerKg` (default), `validUntil`, `minimumQuantityKg`, or `createdAt` |
| `sortOrder` | string | `ASC` or `DESC` (default). Use `createdAt` for oldest or newest first. |
| `page` | integer | Current page, starting at 1. Default is 1. |
| `limit` | integer | Items per page from 1 to 100. Default is 20. |

Example request `GET /offers?teaGrade=CTC&minPrice=20&maxPrice=30&sortBy=pricePerKg&sortOrder=DESC&page=1&limit=20`.

Ties are ordered by offer ID in the same direction. Offers with no minimum quantity sort last when ordering by minimum quantity. The response gives the total number of matches and total pages before pagination. An out-of-range page returns an empty `data` array with the same totals.

**Success Response — `200 OK`:**

```json
{
  "data": [
    {
      "id": 5,
      "teaGrade": "CTC",
      "pricePerKg": 28.50,
      "qualityRequirements": "Fresh, moisture below 70%.",
      "minimumQuantityKg": 100,
      "validUntil": "2026-12-31",
      "estimatedTransportCostBdt": 500,
      "status": "ACTIVE",
      "factoryProfile": {
        "id": 2,
        "factoryName": "Panchagarh Tea Processing Ltd.",
        "district": "Panchagarh"
      },
      "createdAt": "2026-11-05T10:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

**Error Cases:**

| Status | Condition |
|---|---|
| `400 Bad Request` | Invalid or unknown query field, or `minPrice` greater than `maxPrice` |
| `401 Unauthorized` | No token |

---

### 9.3 Get Single Offer

**`GET /offers/:id`**

| Property | Value |
|---|---|
| Auth | Any Auth |
| Description | Get one `ACTIVE` offer through its `validUntil` date in Bangladesh |

Example request `GET /offers/5`. The path parameter `id` is an integer. The response uses the same public fields as a single item in `GET /offers`.

```json
{
  "id": 5,
  "teaGrade": "CTC",
  "pricePerKg": 28.5,
  "qualityRequirements": null,
  "minimumQuantityKg": 100,
  "validUntil": "2099-12-31",
  "estimatedTransportCostBdt": 500,
  "status": "ACTIVE",
  "factoryProfile": {
    "id": 2,
    "factoryName": "Panchagarh Tea Processing Ltd.",
    "district": "Panchagarh"
  },
  "createdAt": "2026-11-21T10:00:00.000Z"
}
```

**Error Cases:**

| Status | Condition |
|---|---|
| `400 Bad Request` | ID is not an integer |
| `401 Unauthorized` | Missing or invalid token |
| `404 Not Found` | Offer is missing, expired by status or date, or withdrawn |

---

### 9.4 Get Own Offers

**`GET /offers/my`**

| Property | Value |
|---|---|
| Auth | FACTORY |
| Description | Get all price offers created by the authenticated factory (all statuses) |

| Query parameter | Description |
|---|---|
| `page` | Page number starting at 1. Default is 1. |
| `limit` | Items per page from 1 to 100. Default is 20. |
| `status` | Optional exact match for stored status `ACTIVE`, `EXPIRED`, or `WITHDRAWN` |

Ownership is determined from the JWT account's factory profile. Any factory with a profile can view its own offers. The list is ordered by creation time descending, then ID descending. After an offer's expiry date passes in Bangladesh, public browse and detail hide it immediately. The owner list continues to return the stored status until the next successful expiry sweep.

Example request `GET /offers/my?status=WITHDRAWN&page=1&limit=20`.

```json
{
  "data": [{
    "id": 6,
    "factoryProfileId": 2,
    "teaGrade": "CTC",
    "pricePerKg": 28.5,
    "qualityRequirements": null,
    "minimumQuantityKg": 100,
    "validUntil": "2099-12-31",
    "estimatedTransportCostBdt": 500,
    "notes": "Collection every Saturday.",
    "status": "WITHDRAWN",
    "createdAt": "2026-11-21T10:00:00.000Z",
    "updatedAt": "2026-11-21T11:00:00.000Z"
  }],
  "total": 1,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

| Status | Condition |
|---|---|
| `200 OK` | Owned offers with pagination, including an empty list when none match |
| `400 Bad Request` | Invalid or unknown query parameter, including a client-supplied factory ID |
| `401 Unauthorized` | Missing or invalid token |
| `403 Forbidden` | Account lacks the FACTORY role |
| `404 Not Found` | Account has no factory profile |

---

### 9.5 Update Offer

**`PATCH /offers/:id`**

| Property | Value |
|---|---|
| Auth | Verified FACTORY that owns the offer |
| Description | Update an `ACTIVE` offer through its expiry date in Bangladesh. Expired and withdrawn offers cannot be reactivated. |

**Request Body (all optional):**

```json
{
  "pricePerKg": 29.00,
  "minimumQuantityKg": 150.0,
  "validUntil": "2027-01-31",
  "notes": "Updated schedule."
}
```

Only these four fields can be edited. Price and quantity use the same precision rules as publishing. A replacement `validUntil` must be after today in Bangladesh. Set `minimumQuantityKg` or `notes` to `null` to clear them.

**Success Response — `200 OK`:** Returns the updated offer record using the same fields as an item in `GET /offers/my`.

**Error Cases:**

| Status | Condition |
|---|---|
| `400 Bad Request` | Non-integer ID, invalid or protected fields, or a replacement expiry on or before today |
| `401 Unauthorized` | Missing or invalid token |
| `403 Forbidden` | Caller lacks the FACTORY role, is unverified, or does not own the offer |
| `404 Not Found` | Offer or factory profile not found |
| `409 Conflict` | Offer is expired by date or status, or is withdrawn |

---

### 9.6 Withdraw Offer

**`PATCH /offers/:id/withdraw`**

| Property | Value |
|---|---|
| Auth | FACTORY that owns the offer |
| Description | Set an active, unexpired offer to `WITHDRAWN`. Public reads hide it immediately and the owner can still view it. |

No request body is required.

**Success Response — `200 OK`:** Returns the offer record with `status: "WITHDRAWN"`.

**Error Cases:**

| Status | Condition |
|---|---|
| `400 Bad Request` | Non-integer ID |
| `401 Unauthorized` | Missing or invalid token |
| `403 Forbidden` | Caller lacks the FACTORY role or does not own the offer |
| `404 Not Found` | Offer or factory profile not found |
| `409 Conflict` | Offer is already withdrawn or expired by date or status |

#### Automatic expiry

An offer remains valid through its `validUntil` day in `Asia/Dhaka`. The app checks for overdue offers at startup and every minute. The sweep changes only overdue `ACTIVE` records to `EXPIRED` and leaves existing `EXPIRED` and `WITHDRAWN` records intact. Public reads also apply the date cutoff directly.

---

## 10. Module: Orders

**Base path:** `/orders`

---

### 10.1 Factory Requests and Grower Decisions

An order exists only after the grower accepts a request. Request routes require a JWT.

| Method and route | Role and scope | Input | Success |
|---|---|---|---|
| `POST /order-requests` | Verified FACTORY, using its own offer | `harvestListingId`, `priceOfferId` | `201` request with `status: "PENDING"` and an immutable quote |
| `GET /listings/:id/order-requests` | GROWER who owns the listing | Optional `status`, `page`, `limit` | `200` paginated incoming requests |
| `GET /order-requests/my` | FACTORY, scoped to its own offers | Optional `status`, `page`, `limit` | `200` paginated requests the factory submitted |
| `PATCH /order-requests/:id/accept` | GROWER who owns the listing | No body | `200 { request, order }`. Retrying the accepted request returns the same order. |
| `PATCH /order-requests/:id/reject` | GROWER who owns the listing | No body | `200` request with `status: "REJECTED"` |
| `PATCH /order-requests/:id/withdraw` | FACTORY that submitted the request | No body | `200` request with `status: "WITHDRAWN"` |

**Request Body:**

```json
{
  "harvestListingId": 12,
  "priceOfferId": 5
}
```

| Field | Type | Required | Rules |
|---|---|---|---|
| `harvestListingId` | integer | Yes | Available `ACTIVE` harvest listing |
| `priceOfferId` | integer | Yes | Active, unexpired offer owned by the authenticated factory |

**Service Logic (checked in service layer):**
- The listing must be `ACTIVE` and `isActive = true`.
- The offer must be `ACTIVE` and not expired.
- Tea grades must match after trimming and case-insensitive comparison. The listing estimate must meet the offer's minimum quantity if one is set.
- Factories may compete for a listing. Each factory may have one pending request for it, even if it has several offers.
- Submission copies the offer price into `quotedPricePerKg`. Acceptance rechecks eligibility and copies the quote and the listing's current estimate into the order.
- Acceptance reserves the listing and closes competing pending requests with `ANOTHER_REQUEST_ACCEPTED` in the same transaction. Listing cancellation and moderation close pending requests with `LISTING_UNAVAILABLE`.

Example response to accepting a request:

```json
{
  "request": {
    "id": 40,
    "harvestListingId": 12,
    "priceOfferId": 5,
    "quotedPricePerKg": 28.50,
    "status": "ACCEPTED",
    "closureReason": null,
    "harvestListing": { "id": 12, "teaGrade": "CTC", "estimatedQuantityKg": 350.5 },
    "factoryProfile": { "id": 2, "factoryName": "Panchagarh Tea Processing Ltd.", "district": "Panchagarh" },
    "createdAt": "2026-11-22T10:00:00.000Z",
    "updatedAt": "2026-11-22T10:30:00.000Z"
  },
  "order": {
    "id": 88,
    "orderRequestId": 40,
    "harvestListingId": 12,
    "agreedPricePerKg": 28.50,
    "estimatedQuantityKg": 350.5,
    "actualCollectedWeightKg": null,
    "proposedCollectionDate": null,
    "collectionPoint": null,
    "pickupNotes": null,
    "estimatedTransportCostBdt": null,
    "orderStatus": "ACCEPTED",
    "paymentStatus": "PENDING",
    "createdAt": "2026-11-22T10:30:00.000Z",
    "updatedAt": "2026-11-22T10:30:00.000Z"
  }
}
```

**Error Cases:**

| Status | Condition |
|---|---|
| `400 Bad Request` | Invalid identifiers, body, or query parameters |
| `401 Unauthorized` | Missing or invalid token |
| `403 Forbidden` | Wrong role or the submitting factory is unverified |
| `404 Not Found` | Missing resource or outside the caller's ownership scope |
| `409 Conflict` | Unavailable listing or offer, mismatch, duplicate pending request, or request no longer eligible for the action |

Lists return `{ data, total, page, limit, totalPages }`, newest first. Pagination starts at 1 with a default limit of 20 and maximum of 100. Request statuses are `PENDING`, `ACCEPTED`, `REJECTED`, `CLOSED`, and `WITHDRAWN`.

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

**Success Response — `200 OK`:** Returns confirmed orders using `{ data, total, page, limit, totalPages }`, newest first. Pagination starts at 1 with a default limit of 20 and a maximum of 100. A malformed query returns `400`, missing authentication returns `401`, and a role other than GROWER or FACTORY returns `403`.

---

### 10.3 Get Single Order

**`GET /orders/:id`**

| Property | Value |
|---|---|
| Auth | GROWER or FACTORY participating in the order, or ADMIN |
| Description | Read a confirmed order's snapshots, statuses, pickup details, and limited participant summaries |

**Success Response — `200 OK`:** Returns the same order fields shown in the acceptance response, plus `priceOfferId` and safe summaries for `harvestListing`, `farmerProfile`, and `factoryProfile`.

**Error Cases:**

| Status | Condition |
|---|---|
| `400 Bad Request` | Non-integer ID |
| `401 Unauthorized` | Missing or invalid token |
| `404 Not Found` | Order is missing or outside the participant's ownership scope |

---

### 10.4 Update Order Status

**`PATCH /orders/:id/status`**

| Property | Value |
|---|---|
| Auth | GROWER or FACTORY |
| Description | Cancel an accepted order, schedule pickup, or record actual collection |

**Request Body:**

```json
{
  "orderStatus": "CANCELLED"
}
```

| Transition | Owner | Additional fields |
|---|---|---|
| `ACCEPTED → PICKUP_SCHEDULED` | FACTORY | Required `proposedCollectionDate` as `YYYY-MM-DD` and `collectionPoint`. Optional `pickupNotes` and non-negative `estimatedTransportCostBdt`. |
| `ACCEPTED → CANCELLED` | GROWER | None |
| `PICKUP_SCHEDULED → COLLECTED` | FACTORY | Required positive `actualCollectedWeightKg` with up to three decimal places |
| `COLLECTED → COMPLETED` | Owning FACTORY | No additional fields. Payment must be `CONFIRMED`, the listing must be `RESERVED`, and the payable amount must be positive. Completion marks the listing `SOLD` in the same transaction. |

Cancellation reopens an eligible listing and leaves closed requests closed. A moderated listing remains unavailable. The listing stays `RESERVED` during pickup and collection. The owning factory can complete a collected order after grower payment confirmation.

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

**Success Response — `200 OK`:** Returns the same order representation as the detail endpoint. Updating order status preserves the agreed price, estimated weight, and payment status.

**Error Cases:**

| Status | Condition |
|---|---|
| `400 Bad Request` | Invalid target status, missing required fields, or fields that do not belong to the transition |
| `401 Unauthorized` | No token |
| `403 Forbidden` | User is not authorized to make this transition |
| `404 Not Found` | Order is missing or outside the caller's ownership scope |
| `409 Conflict` | Transition is not valid from the current status |

---

## 11. Module: Payments

Every route requires a Bearer JWT. Private order routes are available to the two participants and to admins for read-only oversight. Unrelated users receive `404`.

| Method and route | Actor | Request | Success |
|---|---|---|---|
| `GET /payments/order/:orderId/amount` | Participants, admin | — | 200 with order ID, exact decimal `amountBdt`, currency and payment status |
| `POST /payments/order/:orderId/attempts` | Owning factory | `Idempotency-Key` header and method, paymentDate, provider and reference as applicable | 201 with settlement ID, order ID, amount, currency and original attempt |
| `GET /payments/order/:orderId` | Participants, admin | — | 200 with settlement ID, order ID, amount, currency, creation date and current payment status |
| `GET /payments/order/:orderId/history` | Participants, admin | `page`, `limit` | 200 with paginated attempts and receipt decisions |
| `GET /payments/my` | Factory, grower | `page`, `limit` | 200 with own settlements |
| `GET /admin/payments` | Admin | `page`, `limit` | 200 with settlement summaries |
| `PATCH /payments/order/:orderId/attempts/:attemptId/confirm` | Owning grower | Empty body | 200 with the confirmed attempt, including on retry |
| `PATCH /payments/order/:orderId/attempts/:attemptId/reject` | Owning grower | `rejectionReason` (1–1000 characters after trimming) | 200 with the rejected attempt |

Pagination defaults to page 1 and limit 20, with a maximum limit of 100. Responses include `data`, `total`, `page`, `limit`, and `totalPages`.

Submit a date in `YYYY-MM-DD` format and a key of 1–128 printable non-space ASCII characters. Methods are `CASH`, `BANK_TRANSFER`, and `MOBILE_FINANCIAL_SERVICE`. Bank and mobile submissions require provider and reference. Mobile providers are `BKASH` and `NAGAD`. Cash accepts an optional reference. Provider and reference are trimmed and uppercased. Reusing a key for the same normalized payload returns the original response. Changing the payload under the same key or reusing an external reference for the same method and provider returns `409`, including after rejection.

Amounts use actual collected weight and the agreed unit price, rounded to two BDT decimal places. Uncollected and zero-payable orders return `409` from the amount and submission endpoints. Invalid payloads return `400`, missing authentication `401`, and wrong roles `403`. Missing settlements or attempts return `404`. Ineligible decision states return `409`.

Confirmation leaves the order `COLLECTED`. The owning factory completes it with `PATCH /orders/:id/status` and `{"orderStatus":"COMPLETED"}`. The transaction requires `CONFIRMED` payment and marks the listing `SOLD`.

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

Planned for broader admin oversight. Admins can already read an individual order through `GET /orders/:id`.

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
| `POST` | `/order-requests` | Verified FACTORY | Submit a request against an available listing using an owned offer |
| `GET` | `/listings/:id/order-requests` | Owning GROWER | Read requests for a listing |
| `GET` | `/order-requests/my` | FACTORY | Read own requests |
| `PATCH` | `/order-requests/:id/accept` | Owning GROWER | Accept request and create the order |
| `PATCH` | `/order-requests/:id/reject` | Owning GROWER | Reject pending request |
| `PATCH` | `/order-requests/:id/withdraw` | Owning FACTORY | Withdraw pending request |
| `GET` | `/orders/my` | GROWER / FACTORY | Get own orders |
| `GET` | `/orders/:id` | Any Auth | Get order by ID |
| `PATCH` | `/orders/:id/status` | GROWER / FACTORY | Update order status |
| `GET` | `/payments/order/:orderId` | Participants / ADMIN | Get private payment settlement |
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
