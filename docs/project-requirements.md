# ChaBondhu — Project Requirements Document

**Project Name:** ChaBondhu (চাBondhu)  
**Type:** Digital Tea Leaf Marketplace and Procurement Coordination Platform  
**Region:** Panchagarh, Bangladesh  
**Course:** Advanced Web Technologies (University MVP)  
**Document Version:** 1.0  
**Date:** 2026-11-05  

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Goals and Non-Goals](#2-goals-and-non-goals)
3. [User Roles and Permissions](#3-user-roles-and-permissions)
4. [Functional Requirements — Farmer](#4-functional-requirements--farmer)
5. [Functional Requirements — Factory](#5-functional-requirements--factory)
6. [Functional Requirements — Admin](#6-functional-requirements--admin)
7. [Price Comparison Feature](#7-price-comparison-feature)
8. [Harvest Information](#8-harvest-information)
9. [Order Workflow](#9-order-workflow)
10. [Pickup Coordination](#10-pickup-coordination)
11. [Payment Tracking](#11-payment-tracking)
12. [Non-Functional Requirements](#12-non-functional-requirements)
13. [Data Model Overview](#13-data-model-overview)
14. [API Surface Overview](#14-api-surface-overview)
15. [Project Phases](#15-project-phases)
16. [Future Enhancements](#16-future-enhancements)
17. [Assumptions](#17-assumptions)
18. [Unresolved Business Decisions](#18-unresolved-business-decisions)
19. [Out of Scope](#19-out-of-scope)

---

## 1. Problem Statement

Tea growers in Panchagarh may face difficulty obtaining fair prices for their tea leaves. Without a central information source, growers may not know what prices different factories are currently offering. This information gap can disadvantage farmers during negotiation.

Tea factories, on the other hand, may face challenges in finding sufficient quantities of suitable tea leaves and efficiently managing procurement and transportation logistics.

**ChaBondhu** aims to close this gap by providing a transparent digital marketplace where:

- Farmers can publish their harvest listings and browse competitive factory price offers.
- Factories can publish their buying prices, quality requirements, and collection arrangements.
- Both parties can coordinate orders and track their status in one place.

> **Important note:** ChaBondhu does not guarantee that using the platform will result in higher earnings for farmers. It provides information and tools — outcomes depend on market conditions and negotiations between parties.

---

## 2. Goals and Non-Goals

### 2.1 Goals (MVP)

| Goal | Description |
|---|---|
| Connect farmers and factories | Provide a shared platform where both can find each other |
| Price transparency | Let farmers see and compare offers from multiple factories |
| Harvest listing management | Allow farmers to list available tea leaf batches |
| Order coordination | Let verified factories submit requests to growers and let the listing owner choose one |
| Order tracking | Track order status from request through collection and payment |
| Pickup scheduling | Allow factories to propose collection dates and logistics |
| Payment record tracking | Record payment status without real money transfer |
| Secure authentication | Role-based login for Farmer, Factory, and Admin |

### 2.2 Non-Goals (Explicitly Excluded from MVP)

| Non-Goal | Reason |
|---|---|
| Real payment processing | Out of scope for university MVP |
| Agricultural loans or credit | Financial complexity not required |
| AI yield or price prediction | ML infrastructure not required |
| Advanced route optimization | Logistics complexity out of scope |
| SMS or email notifications | Nice-to-have; not core MVP |
| Mobile application | Web-only for MVP; mobile is a future phase |
| Guaranteed price calculations | Prices and earnings are estimates only |

---

## 3. User Roles and Permissions

ChaBondhu has three distinct user roles. Each role has access to different features and endpoints.

### 3.1 Role Definitions

| Role | Identifier | Description |
|---|---|---|
| Farmer | `GROWER` | A tea grower who registers farms and sells tea leaves |
| Factory | `FACTORY` | A tea factory representative who buys tea leaves |
| Admin | `ADMIN` | A platform administrator who manages and moderates accounts |

### 3.2 Permission Matrix

| Action | GROWER | FACTORY | ADMIN |
|---|---|---|---|
| Register and log in | ✅ | ✅ | ✅ |
| Manage own profile | ✅ | ✅ | ✅ |
| Create / manage farm profile | ✅ | ❌ | ❌ |
| Create harvest listings | ✅ | ❌ | ❌ |
| Browse factory price offers | ✅ | ❌ | ❌ |
| Submit a request against a harvest listing | ❌ | ✅ (verified) | ❌ |
| Track own order status | ✅ | ✅ | ✅ |
| Create / manage factory profile | ❌ | ✅ | ❌ |
| Publish price offers | ❌ | ✅ | ❌ |
| View incoming requests for an owned listing | ✅ | ❌ | ❌ |
| Accept or reject incoming requests | ✅ | ❌ | ❌ |
| View or withdraw own pending requests | ❌ | ✅ | ❌ |
| Confirm actual collected weight | ❌ | ✅ | ❌ |
| Update collection / payment status | ❌ | ✅ | ❌ |
| View all registered users | ❌ | ❌ | ✅ |
| Verify factory accounts | ❌ | ❌ | ✅ |
| Moderate users and listings | ❌ | ❌ | ✅ |
| View all order activity | ❌ | ❌ | ✅ |

### 3.3 Account Verification

- Factory accounts must be verified by an Admin before they can publish price offers.
- Farmer accounts can self-register and become active immediately.
- Admin accounts are created directly in the system (not through public registration).

Factory profiles start as `PENDING`. Signed-in users can see the current verification status. The factory owner and admins can see decision history and rejection reasons.

---

## 4. Functional Requirements — Farmer

### 4.1 Registration and Login

- A farmer must be able to register with: full name, email, password, and phone number.
- Password must be securely hashed (bcrypt) before storage.
- After successful login, the system must return a JWT token.
- The farmer must use this token to access all protected endpoints.

### 4.2 Farmer Profile Management

- A farmer must be able to view and update their own profile.
- Editable profile fields: full name, phone number.
- Email must not be changeable after registration (it is the unique identifier).

### 4.3 Farm Profile Management

A farmer may maintain a farm (garden) profile with the following information:

| Field | Type | Required | Notes |
|---|---|---|---|
| Garden / farm name | string | Yes | |
| Division | string | Yes | e.g. Rangpur |
| District | string | Yes | e.g. Panchagarh |
| Upazila / Thana | string | Yes | |
| Village / area | string | No | |
| Farm size (acres) | decimal | No | Informational only — not a harvest predictor |
| Description | string | No | |

> A farmer may have one farm profile linked to their account for the MVP. Multiple farms per farmer is a future enhancement.

### 4.4 Harvest Listings

A farmer may create a harvest listing to indicate they have tea leaves available.

| Field | Type | Required | Notes |
|---|---|---|---|
| Tea grade / type | string | Yes | e.g. "Green", "Black", "CTC" |
| Estimated quantity (kg) | decimal | Yes | Estimate only — not a guarantee |
| Expected harvest date | date | Yes | |
| Last harvest date | date | No | |
| Harvest quality description | string | No | |
| Collection location | string | Yes | Where leaves can be picked up |
| Listing status | enum | Auto | `ACTIVE`, `RESERVED`, `SOLD`, `EXPIRED`, `CANCELLED` |
| Notes | string | No | Any additional information |

**Business rules:**
- A farmer can only create listings for their own farm.
- A listing must be marked as `SOLD` when an order for it is successfully completed.
- A farmer may cancel their own listing if no order has been accepted yet.
- Estimated quantity is an estimate — the actual collected weight is recorded separately on the order.

### 4.5 Browsing Factory Price Offers

- A farmer must be able to view all currently active factory price offers.
- Each offer must display the information needed for price comparison (see Section 7).
- A farmer must be able to filter or browse offers without placing an order.

### 4.6 Order Request

- A grower reviews requests submitted by verified factories against their available harvest listing and may reject a pending request or accept one.
- Acceptance creates one order, reserves the listing, and closes competing pending requests in the same transaction.
- Reserved listings cannot be normally edited or cancelled. When an eligible order is cancelled before pickup scheduling, an eligible listing may reopen. Earlier closed requests stay closed.

### 4.7 Order Tracking

- A farmer must be able to view all their orders.
- Each order must show: current order status, payment status, factory name, agreed price, and collection date (if scheduled).

### 4.8 Payment History

- A farmer must be able to view the payment status of each of their completed or in-progress orders.
- Payment records are for tracking purposes only. No real money is transferred.

---

## 5. Functional Requirements — Factory

### 5.1 Registration and Login

- A factory must be able to register with: factory name, representative name, email, password, and phone number.
- Factory accounts must be verified by an Admin before they can publish price offers.
- After login, the factory receives a JWT token for protected endpoints.

### 5.2 Factory Profile Management

- A factory must be able to view and update their profile.
- Editable fields: factory name, representative name, phone number, factory location.

### 5.3 Factory Location

A factory may maintain location information:

| Field | Type | Required |
|---|---|---|
| District | string | Yes |
| Upazila / Thana | string | Yes |
| Factory address | string | No |

### 5.4 Price Offer Management

A factory may publish price offers for tea leaves they wish to purchase.

| Field | Type | Required | Notes |
|---|---|---|---|
| Tea grade / type | string | Yes | Must match what farmers list |
| Price per kg (BDT) | decimal | Yes | |
| Quality requirements | string | No | Describe what quality they need |
| Minimum quantity (kg) | decimal | No | Optional minimum batch size |
| Offer valid until | date | Yes | Offers must have an expiry |
| Estimated transport cost (BDT) | decimal | No | Optional flat estimate for the farmer |
| Notes | string | No | |
| Offer status | enum | Auto | `ACTIVE`, `EXPIRED`, `WITHDRAWN` |

**Business rules:**
- Only verified factory accounts may publish price offers.
- A verified factory can edit its own active, unexpired offers. An owning factory can withdraw an active, unexpired offer. Expired and withdrawn offers are final.
- Updating a price offer does not affect any orders already placed against that offer — the agreed price at order time is preserved.
- Expired offers (past their `valid until` date) must automatically show as `EXPIRED` and not appear in active listings.

### 5.5 Submitting Order Requests

- A verified factory may request an available listing using one of its own active, unexpired offers. Tea grades must match after trimming and case-insensitive comparison, and the listing's estimate must meet the offer's minimum quantity.
- A factory may have one pending request per listing. Different factories can have pending requests for the same listing.
- Submission stores the offered price as an immutable quote. Acceptance rechecks verification, listing availability, and offer eligibility.

### 5.6 Viewing and Withdrawing Own Requests

- A factory can view the requests it submitted and withdraw its own pending requests. After a withdrawal, it can submit a new request using an eligible offer.
- Only the listing owner can accept or reject a request. A reserved listing stays unavailable for new requests until an eligible cancellation reopens it.

### 5.7 Confirming Actual Collected Weight

- After tea leaves are physically collected, the factory must record the actual collected weight in kilograms.
- This is a separate field from the farmer's estimated quantity.
- The actual collected weight is used for payment record calculation.

### 5.8 Updating Collection and Payment Status

- The factory is responsible for updating:
  - Collection status (e.g., pickup scheduled, leaves collected)
  - Payment status (e.g., payment pending, payment completed)
- These are two independent status fields and must not be conflated.

---

## 6. Functional Requirements — Admin

### 6.1 User Management

- An admin must be able to view a list of all registered users (farmers and factories).
- An admin must be able to view the details of any user.

### 6.2 Factory Verification

- An admin can approve a pending factory profile as `VERIFIED` or reject it as `REJECTED` with a reason. Each decision records the reviewing admin and timestamp.
- The factory owner can update their profile and explicitly resubmit a rejected verification for review. Resubmission returns it to `PENDING` and retains earlier decisions.
- A factory may only publish price offers when their account is `VERIFIED`.

### 6.3 User Moderation

- An admin must be able to deactivate a user account.
- Deactivated users must not be able to log in or perform any actions.
- An admin must be able to reactivate a deactivated account.

### 6.4 Listing Moderation

- An admin must be able to view all harvest listings.
- An admin must be able to remove (soft-delete) a listing if it violates platform rules.

### 6.5 Order Activity

- An admin must be able to view all orders across the platform.
- This is for oversight only — admins do not intervene in individual order workflows.

### 6.6 Platform Settings

- An admin may manage basic configuration values (e.g., default offer validity duration).
- Specific settings to be determined during implementation.

---

## 7. Price Comparison Feature

### 7.1 Purpose

The price comparison view is a key feature for farmers. It allows a farmer to evaluate multiple factory offers before committing to one.

### 7.2 Information Displayed Per Offer

| Field | Source | Notes |
|---|---|---|
| Factory name | Factory profile | |
| Price per kg (BDT) | Price offer | |
| Tea grade / quality requirements | Price offer | |
| Minimum collection quantity (kg) | Price offer | Optional; shown if set |
| Offer valid until | Price offer | |
| Estimated transport cost | Price offer | Optional; shown if provided by factory |
| Estimated net earnings | Calculated | See Section 7.3 |

### 7.3 Estimated Net Earnings Calculation

The system may display an estimated net earnings figure to help farmers compare offers.

**Formula (estimate only):**

```
estimated_net_earnings =
  (price_per_kg × farmer_estimated_quantity_kg) - estimated_transport_cost
```

**Important disclaimers that must accompany this figure:**
- This is an estimate based on the farmer's declared quantity and the factory's transport cost estimate.
- The actual payment will be based on the confirmed collected weight.
- ChaBondhu does not guarantee these earnings.

> **⚠️ Assumption:** Transport cost is a flat estimate provided by the factory. Distance-based calculation is a future enhancement.

### 7.4 Sorting and Filtering

- The comparison view should allow sorting by: price per kg (high to low), offer expiry, minimum quantity.
- Filtering by tea grade is desirable but may be deferred if complexity is high.

---

## 8. Harvest Information

### 8.1 Purpose

Farmers provide harvest information so factories can assess quantity and quality before accepting an order.

### 8.2 Harvest Fields

| Field | Notes |
|---|---|
| Farm size (acres) | Informational; must not be used to auto-calculate yield |
| Estimated available quantity (kg) | Farmer's own estimate; not guaranteed |
| Last harvest date | Optional context |
| Expected harvest date | When the leaves will be ready |
| Harvest quality | Free text description |
| Collection location | Where leaves can be picked up |

### 8.3 Important Constraint

Farm size must **never** be used as a formula input to automatically predict or calculate harvest quantity. The two are related in the real world, but the system must not make this assumption. The farmer's stated estimated quantity is the only quantity used in calculations.

---

## 9. Order Workflow

### 9.1 Order Status State Machine

The following statuses define the lifecycle of an order. Status transitions must be validated — unauthorized or skipped transitions must be rejected.

```
ACCEPTED → PICKUP_SCHEDULED → COLLECTED → COMPLETED
ACCEPTED  → CANCELLED  (farmer cancels before pickup)
```

| Status | Description | Who Sets It |
|---|---|---|
| `ACCEPTED` | The grower accepted an order request and an order was created | Grower |
| `PICKUP_SCHEDULED` | Collection date and logistics confirmed | Factory |
| `COLLECTED` | Leaves physically collected; actual weight entered | Factory |
| `COMPLETED` | Order fully completed | Factory (after payment confirmed) |
| `CANCELLED` | Farmer cancelled before pickup | Farmer (only before `PICKUP_SCHEDULED`) |

### 9.2 Payment Status State Machine

The owning factory submits a full settlement, moving payment from PENDING to SUBMITTED. The owning grower confirms receipt or rejects with a reason. Rejection permits another submission while preserving the original attempt. Admin oversight is read-only. The factory explicitly completes the order after confirmation.

### 9.3 Agreed Price Rule

- When an order is created, copy the request's `quotedPricePerKg` to `agreedPricePerKg` and the listing's current estimate to `estimatedQuantityKg`. Preserve both snapshots.
- This value must never be recalculated or overwritten after the order is placed.
- If the factory later changes their price offer, existing orders are not affected.

### 9.4 Authorization Rules for Status Changes

| Transition | Who Is Allowed |
|---|---|
| Pending request accepted or rejected | Grower (owner of the listing) |
| Pending request withdrawn | Factory (owner of the offer) |
| `ACCEPTED` → `PICKUP_SCHEDULED` | Factory (owner of the offer) |
| `PICKUP_SCHEDULED` → `COLLECTED` | Factory |
| `COLLECTED` → `COMPLETED` | Factory |
| `ACCEPTED` → `CANCELLED` | Farmer (owner of the order) |
| Any status → anything else | ❌ Not allowed |

---

## 10. Pickup Coordination

### 10.1 Purpose

The MVP must support basic pickup scheduling so both parties know when and where collection will occur.

### 10.2 Pickup Fields (Stored on the Order)

| Field | Type | Required | Notes |
|---|---|---|---|
| Proposed collection date | date | Yes (when scheduling) | |
| Collection point / location | string | Yes (when scheduling) | May differ from farm location |
| Pickup arrangement notes | string | No | e.g. "Factory truck will arrive at 9am" |
| Estimated transport cost (BDT) | decimal | No | The factory's declared cost for this order |

### 10.3 Constraints

- Pickup details are set by the factory when moving the order to `PICKUP_SCHEDULED`.
- The farmer can view but not edit pickup details.
- Grouped pickup optimization (multiple farms in one trip) is a future enhancement.

---

## 11. Payment Tracking

The factory pays the grower based on actual collected weight multiplied by the agreed price. The backend uses exact decimal arithmetic and requires at least BDT 0.01. Supported methods are cash, bank transfer, and mobile financial services (bKash or Nagad). A rejected external transaction reference cannot be reused for the same method and provider. The MVP supports one full settlement, manual receipt confirmation, and private attempt history.

---

## 12. Non-Functional Requirements

### 12.1 Security

| Requirement | Implementation |
|---|---|
| Passwords must be hashed | bcrypt |
| Authentication via token | JWT, returned on login |
| Token required for all protected routes | `JwtAuthGuard` on protected controllers |
| Role-based access control | `RolesGuard` + `@Roles()` decorator |
| Input validation on all endpoints | NestJS `ValidationPipe` + `class-validator` DTOs |
| Secrets in environment variables | `.env` file, loaded via `@nestjs/config` |

### 12.2 Data Integrity

- Agreed prices must be immutable after order creation.
- Estimated quantity and actual collected weight must be stored as separate fields.
- Order status and payment status must be independent fields with separate validation.
- Soft delete should be preferred over hard delete for user accounts and listings (to preserve order history).

### 12.3 API Design

- All endpoints follow REST conventions.
- HTTP status codes must be used correctly (200, 201, 400, 401, 403, 404, 409, 500).
- API documentation must be available via Swagger UI at `/api/docs`.
- All request bodies must be validated through DTOs with `class-validator`.

### 12.4 Technology Constraints

| Constraint | Value |
|---|---|
| Backend language | TypeScript |
| Backend framework | NestJS |
| Database | PostgreSQL |
| ORM | TypeORM |
| Frontend (Phase 2) | React + TypeScript |
| Testing | Jest (unit/integration), Swagger/Postman (API) |
| Auth | JWT + Passport |

---

## 13. Data Model Overview

This is a high-level description of the main entities. Detailed schemas will be defined during the implementation phase.

### 13.1 Entities

| Entity | Description | Key Relationships |
|---|---|---|
| `User` | A platform account (farmer, factory rep, admin) | Has one `Garden` or one `Factory` |
| `Garden` | A farmer's tea garden profile | Belongs to one `User`; has many `Listing`s |
| `Listing` | A harvest listing for available tea leaves | Belongs to one `Garden`; can have one accepted `Order` |
| `Factory` | A factory's profile | Belongs to one `User`; has many `PriceOffer`s |
| `PriceOffer` | A factory's buying price offer | Belongs to one `Factory`; can have many `OrderRequest`s |
| `OrderRequest` | A factory's request with a fixed quoted price | Links one harvest listing and one offer; may produce one order |
| `Order` | A confirmed procurement order | Belongs to one accepted request and listing; may have one future payment record |
| `PaymentRecord` | Tracks payment status and amounts | Belongs to one `Order` |

### 13.2 Key Design Decisions

1. **`User` stores the account** — role, email, hashed password. `Garden` and `Factory` are separate profile entities.
2. **`agreedPricePerKg` is stored on `Order`** — copied at creation time and never recalculated.
3. **`estimatedQuantityKg` starts on `Listing`** — the farmer's estimate is also copied onto `Order` at acceptance. `actualCollectedWeightKg` on `Order` records the factory's confirmed weight separately.
4. **`orderStatus` and `paymentStatus` are on `Order`** — two separate enum fields, independently managed.
5. **Soft delete** — `isActive` flag on `User` and `Listing` to preserve history.

---

## 14. API Surface Overview

This is a preliminary list of planned API endpoint groups. Exact routes will be defined during implementation.

| Module | Base Path | Key Endpoints |
|---|---|---|
| Auth | `/auth` | `POST /register`, `POST /login` |
| Users | `/users` | `GET /me`, `PATCH /me` |
| Gardens | `/gardens` | `POST /`, `GET /:id`, `PATCH /:id` |
| Listings | `/listings` | `POST /`, `GET /`, `GET /:id`, `PATCH /:id`, `DELETE /:id` |
| Factories | `/factories` | `POST /`, `GET /:id`, `PATCH /:id` |
| Price Offers | `/offers` | `POST /`, `GET /`, `GET /:id`, `PATCH /:id`, `DELETE /:id` |
| Order requests | `/order-requests` | `POST /`, `GET /my`, `PATCH /:id/accept`, `PATCH /:id/reject`, `PATCH /:id/withdraw`, `GET /listings/:id/order-requests` |
| Orders | `/orders` | `GET /my`, `GET /:id`, `PATCH /:id/status` |
| Payments | `/payments` | `GET /:orderId`, `PATCH /:orderId/status` |
| Admin | `/admin` | `GET /users`, `PATCH /users/:id/verify`, `PATCH /users/:id/deactivate` |

---

## 15. Project Phases

### Phase 1 — Midterm (Backend)

| Deliverable | Description |
|---|---|
| NestJS project scaffold | Folder structure, AppModule, global config, Swagger setup |
| Database connection | PostgreSQL + TypeORM configuration |
| Auth module | Registration, login, JWT, Guards, Passport Strategy |
| Users module | Profile management |
| Gardens module | Farm profile CRUD |
| Listings module | Harvest listing CRUD |
| Factories module | Factory profile CRUD |
| Price Offers module | Offer management |
| Orders module | Order workflow and status transitions |
| Payment tracking | Payment record and status management |
| Admin endpoints | User list, factory verification, moderation |

### Phase 2 — Final (Frontend)

| Deliverable | Description |
|---|---|
| React + TypeScript setup | Project scaffold, routing, API client |
| Auth pages | Register, Login |
| Farmer dashboard | Listings, order tracking, price comparison |
| Factory dashboard | Offers, incoming orders, order management |
| Admin panel | User management, factory verification |

---

## 16. Future Enhancements

These are features that are explicitly deferred beyond the MVP:

| Enhancement | Notes |
|---|---|
| Grouped pickup optimization | Route planning for collecting from multiple farms |
| Real payment gateway | e.g., bKash, Nagad integration |
| Agricultural loan partnerships | Financial services for farmers |
| Advanced analytics dashboard | Sales trends, price history, yield data |
| Mobile application | Android/iOS app |
| SMS/email notifications | Order status alerts |
| Multiple farms per farmer | Currently one farm per account |
| Distance-based transport cost | Requires map/coordinates integration |

---

## 17. Assumptions

The following assumptions have been made in writing this requirements document. These should be reviewed and confirmed before implementation begins.

| # | Assumption |
|---|---|
| A1 | A farmer account is linked to exactly one farm profile in the MVP. Multiple farms per farmer is deferred. |
| A2 | A factory account is linked to exactly one factory profile. |
| A3 | Transport cost is a flat estimate declared by the factory per offer — it is not calculated from GPS distance. |
| A4 | Tea grade/type is a free-text string. There is no enforced master list of grades in the MVP. |
| A5 | Farmer cancellation is only allowed before the order reaches `PICKUP_SCHEDULED` status. |
| A6 | The admin account is seeded directly into the database — there is no public admin registration endpoint. |
| A7 | Soft delete (deactivation flag) is used for users and listings, so historical order data remains intact. |
| A8 | All monetary values are in Bangladeshi Taka (BDT). Currency conversion is not required. |
| A9 | Factories can have multiple active price offers at the same time (e.g., different offers for different tea grades). |
| A10 | A listing can only have one accepted active order at a time. |

---

## 18. Unresolved Business Decisions

The following questions need explicit decisions before or during implementation. They are listed here to avoid making hidden assumptions.

| # | Question | Impact |
|---|---|---|
| U1 | Resolved. Rejecting a request leaves the listing available. An eligible pre-pickup order cancellation can reopen a reserved listing. | Order + Listing status logic |
| U2 | Resolved. Multiple factories can submit requests for one listing, with one pending request per factory. | Request creation rules |
| U3 | Resolved. Acceptance closes competing pending requests with `ANOTHER_REQUEST_ACCEPTED`. | Order workflow |
| U4 | Should price offers be visible to unregistered (unauthenticated) users, or is login required to browse them? | Auth guard placement |
| U5 | A separate request timeout is deferred. Offer and listing eligibility are rechecked when the grower accepts a request. | Request expiry logic |
| U6 | Who sets the payment method — is it a free-text field entered by the factory, or a fixed enum? | Payment record design |
| U7 | Should deactivated factory accounts have their active price offers automatically withdrawn? | Cascading status logic |
| U8 | What is the exact list of tea grades / types? Is it a fixed enum or free text? | Listing and offer validation |
| U9 | Should harvest listings have an automatic expiry date, or do they remain `ACTIVE` until the farmer manually changes them? | Listing lifecycle |
| U10 | Resolved. Admins approve or reject pending profiles. Rejected owners can resubmit, and the owner and admins can see the full decision history. | Admin + Factory module design |

> These decisions must be resolved during planning discussions before the relevant modules are implemented.

---

## 19. Out of Scope

The following are confirmed out of scope for this university MVP and must not be implemented:

| Feature | Reason |
|---|---|
| Real money transfer or payment gateway | University MVP; payment is tracking-only |
| Agricultural loan or credit system | Financial complexity not required |
| AI/ML yield or price prediction | Infrastructure and ML not in course scope |
| Advanced route/logistics optimization | Requires mapping APIs and complex logic |
| SMS or email notifications | Infrastructure not required for MVP |
| WebSockets or real-time updates | Not in course syllabus |
| Docker or containerization | Not required for university submission |
| Mobile application (iOS/Android) | Web only for MVP |
| Multi-currency support | BDT only; conversion not needed |
| Third-party map/GPS integration | Distance-based transport is a future enhancement |

---

*Document version: 1.0*  
*Created: 2026-11-05*  
*This document must be updated whenever a requirement changes or an unresolved decision is settled.*
