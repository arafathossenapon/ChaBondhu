const { randomUUID } = require("node:crypto");
const { Test } = require("@nestjs/testing");
const { getRepositoryToken } = require("@nestjs/typeorm");
const { hash } = require("argon2");
const request = require("supertest");
const { DataSource } = require("typeorm");
const { AppModule } = require("../dist/app.module");
const { ValidationPipe } = require("../dist/common/pipes/validation.pipe");
const { dataSourceOptions } = require("../dist/config/database.config");
const {
  provisionDevelopmentAdmin,
} = require("../dist/script/provision_dev_admin");
const {
  CreateUsersAndProfiles1793882640314,
} = require("../dist/database/migrations/1793882640314-CreateUsersAndProfiles");
const {
  CreateHarvestListings1793884438520,
} = require("../dist/database/migrations/1793884438520-CreateHarvestListings");
const {
  TrackFactoryVerificationReviews1795300000000,
} = require("../dist/database/migrations/1795300000000-TrackFactoryVerificationReviews");
const {
  CreatePriceOffers1795300100000,
} = require("../dist/database/migrations/1795300100000-CreatePriceOffers");
const {
  CreateOrderRequestsAndOrders1795390000000,
} = require("../dist/database/migrations/1795390000000-CreateOrderRequestsAndOrders");
const {
  AddOrderPickupFields1795390100000,
} = require("../dist/database/migrations/1795390100000-AddOrderPickupFields");
const {
  OrderRequest,
} = require("../dist/modules/orders/entities/order-request.entity");
const { Order } = require("../dist/modules/orders/entities/order.entity");
const {
  PriceOffer,
} = require("../dist/modules/offers/entities/price-offer.entity");
const { OffersService } = require("../dist/modules/offers/offers.service");
const {
  FactoryVerificationService,
} = require("../dist/modules/factory-profiles/factory-verification.service");
const { User } = require("../dist/modules/users/entities/user.entity");
const {
  FarmerProfile,
} = require("../dist/modules/farmer-profiles/entities/farmer-profile.entity");
const {
  FactoryProfile,
} = require("../dist/modules/factory-profiles/entities/factory-profile.entity");
const {
  HarvestListing,
} = require("../dist/modules/listings/entities/harvest-listing.entity");

const password = randomUUID();
const grower = {
  fullName: "Test Grower",
  email: "grower@example.com",
  phoneNumber: "01711000001",
  role: "GROWER",
  password,
};
const otherGrower = { ...grower, email: "other-grower@example.com" };
const factory = { ...grower, email: "factory@example.com", role: "FACTORY" };
const admin = { ...grower, email: "admin@example.com", role: "ADMIN" };
const adminEnv = {
  NODE_ENV: "development",
  CHABONDHU_ADMIN_EMAIL: admin.email.toUpperCase(),
  CHABONDHU_ADMIN_PASSWORD: password,
  CHABONDHU_ADMIN_NAME: admin.fullName,
  CHABONDHU_ADMIN_PHONE: admin.phoneNumber,
};
const farm = {
  gardenName: "Test Garden",
  division: "Rangpur",
  district: "Panchagarh",
  upazila: "Tetulia",
};
const factoryProfile = {
  factoryName: "Test Factory",
  representativeName: "Test Representative",
  district: "Panchagarh",
  upazila: "Tetulia",
};
const listing = {
  teaGrade: "CTC",
  estimatedQuantityKg: 1.25,
  expectedHarvestDate: "2030-01-01",
  collectionLocation: "Test Collection Point",
};
const offer = {
  teaGrade: "CTC",
  pricePerKg: 28.51,
  validUntil: "2099-12-31",
  minimumQuantityKg: 100.125,
  estimatedTransportCostBdt: 500.25,
};

describe("ChaBondhu backend", () => {
  let app;
  let dataSource;
  let runner;
  let api;
  let growerToken;
  let otherGrowerToken;
  let factoryToken;
  let adminToken;
  let startupExpiryOfferId;

  async function login(email) {
    const response = await api
      .post("/auth/login")
      .send({ email, password })
      .expect(200);
    expect(typeof response.body.accessToken).toBe("string");
    return response.body.accessToken;
  }

  beforeAll(async () => {
    const schema = `chabondhu_test_${randomUUID().replaceAll("-", "")}`;
    dataSource = await new DataSource({
      ...dataSourceOptions,
      schema,
    }).initialize();
    runner = dataSource.createQueryRunner();
    await runner.startTransaction();
    // আলাদা স্কিমার টেবিল ও টেস্ট ডেটা একই ট্রানজ্যাকশনে তৈরি হয়। শেষে রোলব্যাক হয়।
    await runner.query(`CREATE SCHEMA "${schema}"`);
    await runner.query(`SET LOCAL search_path TO "${schema}"`);
    await new CreateUsersAndProfiles1793882640314().up(runner);
    await new CreateHarvestListings1793884438520().up(runner);
    expect(await provisionDevelopmentAdmin(runner.manager, adminEnv)).toBe(
      "created",
    );
    const legacyAdmin = await runner.manager.findOneByOrFail(User, {
      email: admin.email,
    });
    const [legacyFactory] = await runner.query(
      "INSERT INTO users (full_name, email, phone_number, role, password_hash) VALUES ('Legacy Factory', 'legacy-factory@example.com', '01711000001', 'FACTORY', $1) RETURNING id",
      [await hash(password)],
    );
    await runner.query(
      "INSERT INTO factory_profiles (user_id, factory_name, representative_name, district, upazila, is_verified, verified_at, verified_by_admin_id) VALUES ($1, 'Legacy Factory', 'Legacy Rep', 'Panchagarh', 'Tetulia', true, now(), $2)",
      [legacyFactory.id, legacyAdmin.id],
    );
    await new TrackFactoryVerificationReviews1795300000000().up(runner);
    await new CreatePriceOffers1795300100000().up(runner);
    await new CreateOrderRequestsAndOrders1795390000000().up(runner);
    await new AddOrderPickupFields1795390100000().up(runner);
    const legacyProfile = await runner.manager.findOneByOrFail(FactoryProfile, {
      userId: legacyFactory.id,
    });
    const startupOffer = await runner.manager.insert(PriceOffer, {
      ...offer,
      teaGrade: "Startup expiry fixture",
      factoryProfileId: legacyProfile.id,
      validUntil: "1990-01-01",
    });
    startupExpiryOfferId = startupOffer.identifiers[0].id;

    const testingModule = Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DataSource)
      .useValue(dataSource);
    for (const entity of [
      User,
      FarmerProfile,
      FactoryProfile,
      HarvestListing,
      PriceOffer,
      OrderRequest,
      Order,
    ]) {
      testingModule
        .overrideProvider(getRepositoryToken(entity))
        .useValue(runner.manager.getRepository(entity));
    }
    const module = await testingModule.compile();
    app = module.createNestApplication({ logger: false });
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
    api = request(app.getHttpServer());

    for (const account of [grower, otherGrower, factory]) {
      await api.post("/auth/register").send(account).expect(201);
    }
    growerToken = await login(grower.email);
    otherGrowerToken = await login(otherGrower.email);
    factoryToken = await login(factory.email);
    adminToken = await login(admin.email);
  });

  afterAll(async () => {
    if (runner?.isTransactionActive) await runner.rollbackTransaction();
    await runner?.release();
    if (app) await app.close();
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  it("provisions a login-capable admin once and refuses production settings", async () => {
    expect(
      await provisionDevelopmentAdmin(runner.manager, {
        ...adminEnv,
        CHABONDHU_ADMIN_EMAIL: "another-admin@example.com",
        CHABONDHU_ADMIN_PASSWORD: randomUUID(),
      }),
    ).toBe("already-exists");
    await expect(
      provisionDevelopmentAdmin(runner.manager, {
        ...adminEnv,
        NODE_ENV: "production",
      }),
    ).rejects.toThrow();
    expect(await runner.manager.countBy(User, { role: "ADMIN" })).toBe(1);
    const response = await api
      .get("/users/me")
      .auth(adminToken, { type: "bearer" })
      .expect(200);
    expect(response.body).toMatchObject({ email: admin.email, role: "ADMIN" });
  });

  it("validates registration and login, and protects the current user profile", async () => {
    await api.post("/auth/register").send(grower).expect(409);
    await api.post("/auth/register").send(admin).expect(400);
    await api
      .post("/auth/register")
      .send({ ...grower, email: "bad-email" })
      .expect(400);
    await api
      .post("/auth/login")
      .send({ email: grower.email, password: "wrong-password" })
      .expect(401);
    const stored = await runner.manager
      .getRepository(User)
      .findOneOrFail({ where: { email: grower.email } });
    expect(stored.passwordHash.startsWith("$argon2")).toBe(true);
    await api.get("/users/me").expect(401);
    await api.get("/users/me").auth("invalid", { type: "bearer" }).expect(401);
    const profile = await api
      .get("/users/me")
      .auth(growerToken, { type: "bearer" })
      .expect(200);
    expect(profile.body.email).toBe(grower.email);
    expect(profile.body).not.toHaveProperty("passwordHash");
    await api
      .patch("/users/me")
      .auth(growerToken, { type: "bearer" })
      .send({ role: "ADMIN" })
      .expect(400);
    await api
      .patch("/users/me")
      .auth(growerToken, { type: "bearer" })
      .send({ fullName: "Updated Grower" })
      .expect(200);
  });

  it("manages owner profiles and preserves server-controlled verification", async () => {
    await api
      .get("/farmer-profiles/me")
      .auth(otherGrowerToken, { type: "bearer" })
      .expect(404);
    await api
      .post("/farmer-profiles")
      .auth(factoryToken, { type: "bearer" })
      .send(farm)
      .expect(403);
    const createdFarm = await api
      .post("/farmer-profiles")
      .auth(growerToken, { type: "bearer" })
      .send(farm)
      .expect(201);
    await api
      .get("/farmer-profiles/me")
      .auth(growerToken, { type: "bearer" })
      .expect(200);
    await api
      .patch("/farmer-profiles/me")
      .auth(growerToken, { type: "bearer" })
      .send({ village: "Test Village" })
      .expect(200);
    await api
      .get(`/farmer-profiles/${createdFarm.body.id}`)
      .auth(factoryToken, { type: "bearer" })
      .expect(200);
    await api
      .post("/farmer-profiles")
      .auth(growerToken, { type: "bearer" })
      .send(farm)
      .expect(409);
    await api
      .post("/factory-profiles")
      .auth(growerToken, { type: "bearer" })
      .send(factoryProfile)
      .expect(403);
    const createdFactory = await api
      .post("/factory-profiles")
      .auth(factoryToken, { type: "bearer" })
      .send(factoryProfile)
      .expect(201);
    expect(createdFactory.body.isVerified).toBe(false);
    await api
      .get("/factory-profiles/me")
      .auth(factoryToken, { type: "bearer" })
      .expect(200);
    await api
      .patch("/factory-profiles/me")
      .auth(factoryToken, { type: "bearer" })
      .send({ address: "Updated Address" })
      .expect(200);
    await api
      .patch("/factory-profiles/me")
      .auth(factoryToken, { type: "bearer" })
      .send({ isVerified: true })
      .expect(400);
    await api
      .get(`/factory-profiles/${createdFactory.body.id}`)
      .auth(growerToken, { type: "bearer" })
      .expect(200);
  });

  it("preserves an existing approval and imports its known review", async () => {
    const legacy = await runner.manager.findOneByOrFail(User, {
      email: "legacy-factory@example.com",
    });
    const response = await api
      .get(`/admin/users/${legacy.id}/factory-verification`)
      .auth(adminToken, { type: "bearer" })
      .expect(200);
    expect(response.body.factoryProfile).toMatchObject({
      verificationStatus: "VERIFIED",
      isVerified: true,
    });
    expect(response.body.reviews).toHaveLength(1);
    expect(response.body.reviews[0].decision).toBe("VERIFIED");
  });

  it("restricts factory decisions and keeps rejection history private across resubmission", async () => {
    const reviewFactory = { ...factory, email: "review-factory@example.com" };
    const account = await api
      .post("/auth/register")
      .send(reviewFactory)
      .expect(201);
    const token = await login(reviewFactory.email);
    const profile = await api
      .post("/factory-profiles")
      .auth(token, { type: "bearer" })
      .send(factoryProfile)
      .expect(201);
    const base = `/admin/users/${account.body.id}`;
    const history = "/factory-profiles/me/verification-history";
    const submit = "/factory-profiles/me/resubmit-verification";
    const gate = app.get(FactoryVerificationService);
    const owner = {
      id: account.body.id,
      email: reviewFactory.email,
      role: "FACTORY",
    };
    const asAdmin = { type: "bearer" };
    expect(profile.body.verificationStatus).toBe("PENDING");
    await expect(gate.requireVerifiedFactory(owner)).rejects.toMatchObject({
      status: 403,
    });
    await api.patch(`${base}/verify`).expect(401);
    for (const nonAdminToken of [token, growerToken]) {
      await api
        .get(`${base}/factory-verification`)
        .auth(nonAdminToken, asAdmin)
        .expect(403);
      await api
        .patch(`${base}/verify`)
        .auth(nonAdminToken, asAdmin)
        .expect(403);
      await api
        .patch(`${base}/reject-verification`)
        .auth(nonAdminToken, asAdmin)
        .send({ reason: "Example" })
        .expect(403);
    }
    await api
      .patch(`${base}/reject-verification`)
      .auth(adminToken, asAdmin)
      .send({ reason: "  " })
      .expect(400);
    await api.patch(submit).auth(token, asAdmin).expect(409);

    const rejection = await api
      .patch(`${base}/reject-verification`)
      .auth(adminToken, asAdmin)
      .send({ reason: "  Confirm the factory address.  " })
      .expect(200);
    expect(rejection.body.factoryProfile).toMatchObject({
      verificationStatus: "REJECTED",
      isVerified: false,
    });
    await expect(gate.requireVerifiedFactory(owner)).rejects.toMatchObject({
      status: 403,
    });
    await api.patch(`${base}/verify`).auth(adminToken, asAdmin).expect(409);
    const publicProfile = await api
      .get(`/factory-profiles/${profile.body.id}`)
      .auth(growerToken, asAdmin)
      .expect(200);
    expect(publicProfile.body.verificationStatus).toBe("REJECTED");
    expect(JSON.stringify(publicProfile.body)).not.toContain(
      "Confirm the factory address.",
    );
    await api.get(history).auth(growerToken, asAdmin).expect(403);
    const differentOwner = await api
      .get(history)
      .auth(factoryToken, asAdmin)
      .expect(200);
    expect(differentOwner.body).toEqual([]);
    const ownHistory = await api.get(history).auth(token, asAdmin).expect(200);
    expect(ownHistory.body).toHaveLength(1);
    expect(ownHistory.body[0]).toMatchObject({
      decision: "REJECTED",
      reason: "Confirm the factory address.",
    });

    await api
      .patch("/factory-profiles/me")
      .auth(token, asAdmin)
      .send({ address: "Confirmed address" })
      .expect(200);
    const resubmitted = await api
      .patch(submit)
      .auth(token, asAdmin)
      .expect(200);
    expect(resubmitted.body.verificationStatus).toBe("PENDING");
    const approved = await api
      .patch(`${base}/verify`)
      .auth(adminToken, asAdmin)
      .expect(200);
    expect(approved.body.factoryProfile).toMatchObject({
      verificationStatus: "VERIFIED",
      isVerified: true,
    });
    expect(approved.body.factoryProfile.verifiedByAdminId).toEqual(
      expect.any(Number),
    );
    expect(approved.body.factoryProfile.verifiedAt).toEqual(expect.any(String));
    await expect(gate.requireVerifiedFactory(owner)).resolves.toMatchObject({
      verificationStatus: "VERIFIED",
    });
    await api.patch(`${base}/verify`).auth(adminToken, asAdmin).expect(409);
    const adminReview = await api
      .get(`${base}/factory-verification`)
      .auth(adminToken, asAdmin)
      .expect(200);
    expect(adminReview.body.reviews.map((review) => review.decision)).toEqual([
      "VERIFIED",
      "REJECTED",
    ]);
  });

  describe("POST /offers", () => {
    const bearer = { type: "bearer" };
    let verifiedFactory;
    let rejectedFactory;
    let pendingFactory;
    let factoryWithoutProfile;

    async function createFactory(label, withProfile = true) {
      const email = `${label}@example.com`;
      const { body: account } = await api
        .post("/auth/register")
        .send({ ...factory, email })
        .expect(201);
      const token = await login(email);
      if (!withProfile) return { account, token };
      const { body: profile } = await api
        .post("/factory-profiles")
        .auth(token, bearer)
        .send(factoryProfile)
        .expect(201);
      return { account, token, profile };
    }

    beforeAll(async () => {
      verifiedFactory = await createFactory("publisher-verified");
      rejectedFactory = await createFactory("publisher-rejected");
      pendingFactory = await createFactory("publisher-pending");
      factoryWithoutProfile = await createFactory(
        "publisher-no-profile",
        false,
      );
      await api
        .patch(`/admin/users/${verifiedFactory.account.id}/verify`)
        .auth(adminToken, bearer)
        .expect(200);
      await api
        .patch(`/admin/users/${rejectedFactory.account.id}/reject-verification`)
        .auth(adminToken, bearer)
        .send({ reason: "Address could not be verified." })
        .expect(200);
    });

    it("publishes active BDT offers for the signed-in verified factory", async () => {
      const first = await api
        .post("/offers")
        .auth(verifiedFactory.token, bearer)
        .send(offer)
        .expect(201);
      expect(first.body).toMatchObject({
        ...offer,
        factoryProfileId: verifiedFactory.profile.id,
        status: "ACTIVE",
      });
      expect(first.body).not.toHaveProperty("factoryProfile");
      expect(first.body).not.toHaveProperty("listingId");
      const stored = await runner.manager.findOneOrFail(PriceOffer, {
        where: { id: first.body.id },
        relations: { factoryProfile: true },
      });
      expect(stored.factoryProfile.userId).toBe(verifiedFactory.account.id);
      expect(stored.pricePerKg).toBe(offer.pricePerKg);
      const second = await api
        .post("/offers")
        .auth(verifiedFactory.token, bearer)
        .send({
          teaGrade: "Green",
          pricePerKg: 27,
          validUntil: offer.validUntil,
        })
        .expect(201);
      expect(second.body).toMatchObject({
        factoryProfileId: verifiedFactory.profile.id,
        minimumQuantityKg: null,
        estimatedTransportCostBdt: null,
      });
    });

    it("requires factory authentication, a profile, and verified status", async () => {
      await api.post("/offers").send(offer).expect(401);
      for (const token of [
        growerToken,
        adminToken,
        pendingFactory.token,
        rejectedFactory.token,
      ]) {
        await api.post("/offers").auth(token, bearer).send(offer).expect(403);
      }
      await api
        .post("/offers")
        .auth(factoryWithoutProfile.token, bearer)
        .send(offer)
        .expect(404);
    });

    it("rejects invalid values, listing IDs, and client-supplied ownership or status", async () => {
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Dhaka",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      for (const fields of [
        { teaGrade: " " },
        { pricePerKg: "28.51" },
        { pricePerKg: 28.511 },
        { pricePerKg: 1e-7 },
        { minimumQuantityKg: 0 },
        { estimatedTransportCostBdt: -1 },
        { validUntil: today },
        { validUntil: "2099-02-29" },
        { listingId: 999999 },
        { factoryProfileId: pendingFactory.profile.id },
        { status: "EXPIRED" },
      ]) {
        await api
          .post("/offers")
          .auth(verifiedFactory.token, bearer)
          .send({ ...offer, ...fields })
          .expect(400);
      }
    });
  });

  describe("GET /offers", () => {
    let owner;
    const grade = "Browse CTC";
    const bearer = { type: "bearer" };
    const browse = (query = {}) =>
      api.get("/offers").auth(growerToken, bearer).query(query);

    beforeAll(async () => {
      owner = await runner.manager.findOneByOrFail(FactoryProfile, {
        factoryName: "Legacy Factory",
      });
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Dhaka",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      const fixture = {
        factoryProfileId: owner.id,
        teaGrade: grade,
        validUntil: "2099-12-31",
        status: "ACTIVE",
      };
      await runner.manager.insert(PriceOffer, [
        {
          ...fixture,
          pricePerKg: 22,
          createdAt: new Date("2026-01-03"),
          minimumQuantityKg: 50,
        },
        {
          ...fixture,
          pricePerKg: 31,
          createdAt: new Date("2026-01-01"),
          minimumQuantityKg: 100,
        },
        {
          ...fixture,
          pricePerKg: 28.5,
          createdAt: new Date("2026-01-02"),
          validUntil: today,
        },
        { ...fixture, pricePerKg: 101, validUntil: "2000-01-01" },
        { ...fixture, pricePerKg: 102, status: "EXPIRED" },
        { ...fixture, pricePerKg: 103, status: "WITHDRAWN" },
        { ...fixture, pricePerKg: 24, teaGrade: "Browse Green" },
      ]);
    });

    it("requires JWT and includes active offers through their expiry day with public factory fields", async () => {
      await api.get("/offers").expect(401);
      const response = await browse({ teaGrade: "  browse ctc  " }).expect(200);
      expect(response.body).toMatchObject({
        total: 3,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
      expect(response.body.data.map((row) => row.pricePerKg)).toEqual([
        31, 28.5, 22,
      ]);
      expect(response.body.data[0].factoryProfile).toEqual({
        id: owner.id,
        factoryName: owner.factoryName,
        district: owner.district,
      });
      expect(Object.keys(response.body.data[0]).sort()).toEqual([
        "createdAt",
        "estimatedTransportCostBdt",
        "factoryProfile",
        "id",
        "minimumQuantityKg",
        "pricePerKg",
        "qualityRequirements",
        "status",
        "teaGrade",
        "validUntil",
      ]);
      await api.get("/offers").auth(factoryToken, bearer).expect(200);
      await api.get("/offers").auth(adminToken, bearer).expect(200);
    });

    it("paginates sorted offers and reports totals on empty pages", async () => {
      const query = {
        teaGrade: grade,
        sortBy: "pricePerKg",
        sortOrder: "ASC",
        limit: 2,
      };
      const page1 = await browse(query).expect(200);
      const page2 = await browse({ ...query, page: 2 }).expect(200);
      const page3 = await browse({ ...query, page: 3 }).expect(200);
      expect(page1.body.data.map((row) => row.pricePerKg)).toEqual([22, 28.5]);
      expect(page2.body.data.map((row) => row.pricePerKg)).toEqual([31]);
      expect(page2.body).toMatchObject({
        total: 3,
        page: 2,
        limit: 2,
        totalPages: 2,
      });
      expect(page3.body).toEqual({
        data: [],
        total: 3,
        page: 3,
        limit: 2,
        totalPages: 2,
      });
    });

    it("sorts by creation time, expiry, and minimum quantity", async () => {
      for (const [sortBy, sortOrder, prices] of [
        ["createdAt", "ASC", [31, 28.5, 22]],
        ["createdAt", "DESC", [22, 28.5, 31]],
        ["validUntil", "ASC", [28.5, 22, 31]],
        ["minimumQuantityKg", "DESC", [31, 22, 28.5]],
      ]) {
        const result = await browse({
          teaGrade: grade,
          sortBy,
          sortOrder,
        }).expect(200);
        expect(result.body.data.map((row) => row.pricePerKg)).toEqual(prices);
      }
    });

    it("combines exact tea grades with inclusive BDT price bounds", async () => {
      const result = await browse({
        teaGrade: grade,
        minPrice: 22,
        maxPrice: 28.5,
      }).expect(200);
      expect(result.body.data.map((row) => row.pricePerKg)).toEqual([28.5, 22]);
      const none = await browse({ teaGrade: "Browse", minPrice: 22 }).expect(
        200,
      );
      expect(none.body).toEqual({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
    });

    it("rejects invalid pagination, filters, and sort options", async () => {
      for (const query of [
        { page: 0 },
        { page: "1.5" },
        { page: Number.MAX_SAFE_INTEGER, limit: 100 },
        { limit: 101 },
        { limit: "" },
        { teaGrade: " " },
        { minPrice: " " },
        { minPrice: 30, maxPrice: 20 },
        { minPrice: -1 },
        { maxPrice: "12.345" },
        { minPrice: ["1", "2"] },
        { sortBy: "factoryProfileId" },
        { sortOrder: "RANDOM" },
        { district: "Panchagarh" },
      ]) {
        await browse(query).expect(400);
      }
    });
  });

  describe("offer details and factory-owned offers", () => {
    const bearer = { type: "bearer" };
    let ownerToken;
    let owner;
    let otherOwner;
    let otherToken;
    let ids;
    let otherId;

    async function createOwner(email) {
      await api
        .post("/auth/register")
        .send({ ...factory, email })
        .expect(201);
      const token = await login(email);
      const { body: profile } = await api
        .post("/factory-profiles")
        .auth(token, bearer)
        .send(factoryProfile)
        .expect(201);
      return { token, profile };
    }

    beforeAll(async () => {
      ({ token: ownerToken, profile: owner } = await createOwner(
        "offer-owner@example.com",
      ));
      ({ token: otherToken, profile: otherOwner } = await createOwner(
        "other-offer-owner@example.com",
      ));
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Dhaka",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      const fixture = {
        ...offer,
        factoryProfileId: owner.id,
        notes: "Owner management note",
        createdAt: new Date("2026-11-01"),
      };
      const result = await runner.manager.insert(PriceOffer, [
        { ...fixture, status: "ACTIVE", validUntil: today },
        { ...fixture, status: "ACTIVE", validUntil: "2000-01-01" },
        { ...fixture, status: "EXPIRED" },
        { ...fixture, status: "WITHDRAWN" },
      ]);
      ids = result.identifiers.map(({ id }) => id);
      const other = await runner.manager.insert(PriceOffer, {
        ...fixture,
        factoryProfileId: otherOwner.id,
      });
      otherId = other.identifiers[0].id;
    });

    it("returns the same public offer fields as browsing, including on its Bangladesh expiry day", async () => {
      const detail = await api
        .get(`/offers/${ids[0]}`)
        .auth(growerToken, bearer)
        .expect(200);
      const browse = await api
        .get("/offers")
        .auth(growerToken, bearer)
        .query({ teaGrade: offer.teaGrade })
        .expect(200);
      expect(detail.body).toEqual(
        browse.body.data.find(({ id }) => id === ids[0]),
      );
      expect(detail.body.factoryProfile).toEqual({
        id: owner.id,
        factoryName: owner.factoryName,
        district: owner.district,
      });
      for (const field of [
        "notes",
        "factoryProfileId",
        "updatedAt",
        "passwordHash",
        "verificationHistory",
      ]) {
        expect(detail.body).not.toHaveProperty(field);
      }
      await api.get(`/offers/${otherId}`).auth(ownerToken, bearer).expect(200);
    });

    it("uses the same not-found response for unavailable and unknown offers", async () => {
      await api.get(`/offers/${ids[0]}`).expect(401);
      const missing = await api
        .get("/offers/2147483647")
        .auth(growerToken, bearer)
        .expect(404);
      for (const id of [...ids.slice(1), "99999999999"]) {
        const response = await api
          .get(`/offers/${id}`)
          .auth(growerToken, bearer)
          .expect(404);
        expect(response.body).toEqual(missing.body);
      }
      await api.get("/offers/not-an-id").auth(growerToken, bearer).expect(400);
    });

    it("paginates only the factory's own offers and keeps all stored statuses", async () => {
      const page1 = await api
        .get("/offers/my")
        .auth(ownerToken, bearer)
        .query({ limit: 2 })
        .expect(200);
      const page2 = await api
        .get("/offers/my")
        .auth(ownerToken, bearer)
        .query({ limit: 2, page: 2 })
        .expect(200);
      expect(page1.body).toMatchObject({
        page: 1,
        limit: 2,
        total: 4,
        totalPages: 2,
      });
      expect(page2.body).toMatchObject({
        page: 2,
        limit: 2,
        total: 4,
        totalPages: 2,
      });
      const offers = [...page1.body.data, ...page2.body.data];
      expect(offers.map(({ id }) => id)).toEqual([...ids].reverse());
      expect(offers.map(({ status }) => status)).toEqual([
        "WITHDRAWN",
        "EXPIRED",
        "ACTIVE",
        "ACTIVE",
      ]);
      for (const result of offers) {
        expect(result).toMatchObject({
          factoryProfileId: owner.id,
          notes: "Owner management note",
          updatedAt: expect.any(String),
        });
        expect(result).not.toHaveProperty("factoryProfile");
      }
      const other = await api
        .get("/offers/my")
        .auth(otherToken, bearer)
        .expect(200);
      expect(other.body).toMatchObject({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
      expect(other.body.data.map(({ id }) => id)).toEqual([otherId]);
      const expired = await api
        .get("/offers/my")
        .auth(ownerToken, bearer)
        .query({ status: "EXPIRED" })
        .expect(200);
      expect(expired.body.data.map(({ id }) => id)).toEqual([ids[2]]);
    });

    it("restricts ownership to the authenticated factory and validates owner queries", async () => {
      await api.get("/offers/my").expect(401);
      for (const token of [growerToken, adminToken]) {
        await api.get("/offers/my").auth(token, bearer).expect(403);
      }
      for (const query of [
        { factoryProfileId: otherOwner.id },
        { factoryId: otherOwner.id },
        { status: "INVALID" },
        { page: 0 },
        { limit: 101 },
      ]) {
        await api
          .get("/offers/my")
          .auth(ownerToken, bearer)
          .query(query)
          .expect(400);
      }
      const email = "no-profile-offers@example.com";
      await api
        .post("/auth/register")
        .send({ ...factory, email })
        .expect(201);
      const token = await login(email);
      await api.get("/offers/my").auth(token, bearer).expect(404);
    });
  });

  describe("price offer lifecycle", () => {
    const bearer = { type: "bearer" };
    let ownerToken;
    let ownerProfile;
    let otherToken;
    let unverifiedToken;
    let unverifiedProfile;

    async function createFactory(email, verified) {
      const { body: account } = await api
        .post("/auth/register")
        .send({ ...factory, email })
        .expect(201);
      const token = await login(email);
      const { body: profile } = await api
        .post("/factory-profiles")
        .auth(token, bearer)
        .send(factoryProfile)
        .expect(201);
      if (verified) {
        await api
          .patch(`/admin/users/${account.id}/verify`)
          .auth(adminToken, bearer)
          .expect(200);
      }
      return { token, profile };
    }

    async function insertOffer(changes = {}) {
      const result = await runner.manager.insert(PriceOffer, {
        ...offer,
        factoryProfileId: ownerProfile.id,
        ...changes,
      });
      return result.identifiers[0].id;
    }

    beforeAll(async () => {
      ({ token: ownerToken, profile: ownerProfile } = await createFactory(
        "lifecycle-owner@example.com",
        true,
      ));
      ({ token: otherToken } = await createFactory(
        "lifecycle-other@example.com",
        true,
      ));
      ({ token: unverifiedToken, profile: unverifiedProfile } =
        await createFactory("lifecycle-unverified@example.com", false));
    });

    it("updates the four documented fields as the verified owner and preserves ownership and status", async () => {
      const created = await api
        .post("/offers")
        .auth(ownerToken, bearer)
        .send(offer)
        .expect(201);
      const path = `/offers/${created.body.id}`;
      const changes = {
        pricePerKg: 31.75,
        minimumQuantityKg: 125.125,
        validUntil: "2099-12-30",
        notes: "Updated pickup terms",
      };
      const updated = await api
        .patch(path)
        .auth(ownerToken, bearer)
        .send(changes)
        .expect(200);
      expect(updated.body).toMatchObject({
        ...changes,
        id: created.body.id,
        factoryProfileId: ownerProfile.id,
        status: "ACTIVE",
        teaGrade: offer.teaGrade,
      });
      expect(updated.body).not.toHaveProperty("factoryProfile");
      const cleared = await api
        .patch(path)
        .auth(ownerToken, bearer)
        .send({ minimumQuantityKg: null, notes: null })
        .expect(200);
      expect(cleared.body).toMatchObject({
        minimumQuantityKg: null,
        notes: null,
        pricePerKg: changes.pricePerKg,
      });
      const detail = await api.get(path).auth(growerToken, bearer).expect(200);
      expect(detail.body.pricePerKg).toBe(changes.pricePerKg);
      expect(detail.body).not.toHaveProperty("notes");
    });

    it("rejects unauthorized editing and withdrawal, including a different factory and admins", async () => {
      const id = await insertOffer();
      for (const suffix of ["", "/withdraw"]) {
        const path = `/offers/${id}${suffix}`;
        await api.patch(path).send({ pricePerKg: 30 }).expect(401);
        for (const token of [growerToken, adminToken, otherToken]) {
          await api
            .patch(path)
            .auth(token, bearer)
            .send({ pricePerKg: 30 })
            .expect(403);
        }
        await api
          .patch(`/offers/2147483647${suffix}`)
          .auth(ownerToken, bearer)
          .send({ pricePerKg: 30 })
          .expect(404);
      }
      const unverifiedId = await insertOffer({
        factoryProfileId: unverifiedProfile.id,
      });
      await api
        .patch(`/offers/${unverifiedId}`)
        .auth(unverifiedToken, bearer)
        .send({ pricePerKg: 30 })
        .expect(403);
      await api
        .patch(`/offers/${unverifiedId}/withdraw`)
        .auth(unverifiedToken, bearer)
        .expect(200);
    });

    it("rejects protected or undocumented fields and invalid prices, quantities, and dates", async () => {
      const id = await insertOffer();
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Dhaka",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      for (const changes of [
        { id: 1 },
        { factoryProfileId: 1 },
        { status: "WITHDRAWN" },
        { teaGrade: "Green" },
        { qualityRequirements: "Test" },
        { estimatedTransportCostBdt: 1 },
        { pricePerKg: 0 },
        { pricePerKg: null },
        { pricePerKg: 1e-7 },
        { minimumQuantityKg: -1 },
        { minimumQuantityKg: 1.0001 },
        { notes: {} },
        { validUntil: "2000-01-01" },
        { validUntil: today },
        { validUntil: "2099-02-29" },
        { validUntil: null },
      ]) {
        await api
          .patch(`/offers/${id}`)
          .auth(ownerToken, bearer)
          .send(changes)
          .expect(400);
      }
      const stored = await runner.manager.findOneByOrFail(PriceOffer, { id });
      expect(stored).toMatchObject({
        pricePerKg: offer.pricePerKg,
        validUntil: offer.validUntil,
        status: "ACTIVE",
      });
    });

    it("withdraws an offer once, hides it from public reads, and keeps it in the owner's list", async () => {
      const id = await insertOffer({ teaGrade: "Withdrawal fixture" });
      const path = `/offers/${id}`;
      const browse = () =>
        api
          .get("/offers")
          .auth(growerToken, bearer)
          .query({ teaGrade: "Withdrawal fixture" });
      await api.get(path).auth(growerToken, bearer).expect(200);
      expect((await browse().expect(200)).body.total).toBe(1);
      const withdrawal = await api
        .patch(`${path}/withdraw`)
        .auth(ownerToken, bearer)
        .expect(200);
      expect(withdrawal.body).toMatchObject({
        id,
        status: "WITHDRAWN",
        factoryProfileId: ownerProfile.id,
      });
      await api.patch(`${path}/withdraw`).auth(ownerToken, bearer).expect(409);
      await api
        .patch(path)
        .auth(ownerToken, bearer)
        .send({ pricePerKg: 30 })
        .expect(409);
      await api.get(path).auth(growerToken, bearer).expect(404);
      expect((await browse().expect(200)).body.total).toBe(0);
      const own = await api
        .get("/offers/my")
        .auth(ownerToken, bearer)
        .query({ status: "WITHDRAWN" })
        .expect(200);
      expect(own.body.data).toEqual([
        expect.objectContaining({ id, status: "WITHDRAWN" }),
      ]);
    });

    it("rejects both transitions for expired offers, even before their stored status changes", async () => {
      const expired = await insertOffer({ status: "EXPIRED" });
      const staleActive = await insertOffer({ validUntil: "2000-01-01" });
      for (const id of [expired, staleActive]) {
        await api
          .patch(`/offers/${id}`)
          .auth(ownerToken, bearer)
          .send({ validUntil: "2099-12-31" })
          .expect(409);
        await api
          .patch(`/offers/${id}/withdraw`)
          .auth(ownerToken, bearer)
          .expect(409);
      }
      const stored = await runner.manager.findOneByOrFail(PriceOffer, {
        id: staleActive,
      });
      expect(stored).toMatchObject({
        status: "ACTIVE",
        validUntil: "2000-01-01",
      });
    });

    it("expires overdue offers at startup and transitions only ACTIVE rows after Dhaka midnight", async () => {
      expect(
        (
          await runner.manager.findOneByOrFail(PriceOffer, {
            id: startupExpiryOfferId,
          })
        ).status,
      ).toBe("EXPIRED");
      const validUntil = "1999-01-01";
      const active = await insertOffer({ validUntil });
      const withdrawn = await insertOffer({ validUntil, status: "WITHDRAWN" });
      const expired = await insertOffer({ validUntil, status: "EXPIRED" });
      const offers = app.get(OffersService);
      await expect(
        offers.expireOffers(new Date("1999-01-01T17:59:59.999Z")),
      ).resolves.toBe(0);
      const boundary = new Date("1999-01-01T18:00:00Z");
      await expect(offers.expireOffers(boundary)).resolves.toBe(1);
      await expect(offers.expireOffers(boundary)).resolves.toBe(0);
      const own = await api
        .get("/offers/my")
        .auth(ownerToken, bearer)
        .query({ status: "EXPIRED" })
        .expect(200);
      expect(own.body.data.map(({ id }) => id)).toEqual(
        expect.arrayContaining([active, expired]),
      );
      expect(own.body.data.map(({ id }) => id)).not.toContain(withdrawn);
      expect(
        (await runner.manager.findOneByOrFail(PriceOffer, { id: withdrawn }))
          .status,
      ).toBe("WITHDRAWN");
    });
  });

  describe("order requests and confirmed orders", () => {
    const bearer = { type: "bearer" };
    let growerToken;
    let buyerOne;
    let buyerTwo;
    let pendingBuyer;

    async function createBuyer(email, verify = true) {
      const { body: user } = await api
        .post("/auth/register")
        .send({ ...factory, email })
        .expect(201);
      const token = await login(email);
      const { body: profile } = await api
        .post("/factory-profiles")
        .auth(token, bearer)
        .send(factoryProfile)
        .expect(201);
      if (verify)
        await api
          .patch(`/admin/users/${user.id}/verify`)
          .auth(adminToken, bearer)
          .expect(200);
      return { token, profile };
    }

    async function createListing(changes = {}) {
      const { body } = await api
        .post("/listings")
        .auth(growerToken, bearer)
        .send({
          ...listing,
          teaGrade: " CTC ",
          estimatedQuantityKg: 150,
          ...changes,
        })
        .expect(201);
      return body;
    }

    async function createOffer(buyer, changes = {}) {
      const { body } = await api
        .post("/offers")
        .auth(buyer.token, bearer)
        .send({ ...offer, teaGrade: "ctc", ...changes })
        .expect(201);
      return body;
    }

    function submit(token, harvestListingId, priceOfferId) {
      return api
        .post("/order-requests")
        .auth(token, bearer)
        .send({ harvestListingId, priceOfferId });
    }

    beforeAll(async () => {
      const email = "requests-grower@example.com";
      await api
        .post("/auth/register")
        .send({ ...grower, email })
        .expect(201);
      growerToken = await login(email);
      await api
        .post("/farmer-profiles")
        .auth(growerToken, bearer)
        .send({ ...farm, district: "Thakurgaon" })
        .expect(201);
      buyerOne = await createBuyer("requests-buyer-one@example.com");
      buyerTwo = await createBuyer("requests-buyer-two@example.com");
      pendingBuyer = await createBuyer(
        "requests-buyer-pending@example.com",
        false,
      );
    });

    it("allows competing factories, rejects duplicates across offers, and scopes paginated reads", async () => {
      const batch = await createListing();
      const firstOffer = await createOffer(buyerOne);
      const secondOffer = await createOffer(buyerTwo);
      const { body: first } = await submit(
        buyerOne.token,
        batch.id,
        firstOffer.id,
      ).expect(201);
      const duplicateOffer = await createOffer(buyerOne);
      await submit(buyerOne.token, batch.id, duplicateOffer.id).expect(409);
      const { body: second } = await submit(
        buyerTwo.token,
        batch.id,
        secondOffer.id,
      ).expect(201);
      expect(first).toMatchObject({
        status: "PENDING",
        quotedPricePerKg: firstOffer.pricePerKg,
        factoryProfile: { id: buyerOne.profile.id },
      });
      expect(Object.keys(first.factoryProfile).sort()).toEqual([
        "district",
        "factoryName",
        "id",
      ]);
      const listingsPath = `/listings/${batch.id}/order-requests`;
      const owned = await api
        .get(listingsPath)
        .auth(growerToken, bearer)
        .query({ limit: 1, status: "PENDING" })
        .expect(200);
      expect(owned.body).toMatchObject({
        total: 2,
        totalPages: 2,
        page: 1,
        data: [{ id: second.id }],
      });
      await api.get(listingsPath).auth(otherGrowerToken, bearer).expect(404);
      await api.get(listingsPath).auth(buyerOne.token, bearer).expect(403);
      const own = await api
        .get("/order-requests/my")
        .auth(buyerOne.token, bearer)
        .expect(200);
      expect(own.body.data).toContainEqual(
        expect.objectContaining({ id: first.id }),
      );
      expect(own.body.data).not.toContainEqual(
        expect.objectContaining({ id: second.id }),
      );
      await api.get("/order-requests/my").auth(growerToken, bearer).expect(403);
    });

    it("requires a verified offer owner and validates combinations, fields, and quantities", async () => {
      const batch = await createListing();
      const eligible = await createOffer(buyerOne);
      const wrongGrade = await createOffer(buyerOne, { teaGrade: "Green" });
      const oversized = await createOffer(buyerOne, {
        minimumQuantityKg: 150.001,
      });
      const ownedByPending = await runner.manager.save(PriceOffer, {
        ...offer,
        factoryProfileId: pendingBuyer.profile.id,
      });
      await api
        .post("/order-requests")
        .send({ harvestListingId: batch.id, priceOfferId: eligible.id })
        .expect(401);
      await submit(growerToken, batch.id, eligible.id).expect(403);
      await submit(pendingBuyer.token, batch.id, ownedByPending.id).expect(403);
      await submit(buyerTwo.token, batch.id, eligible.id).expect(404);
      await submit(buyerOne.token, 2147483647, eligible.id).expect(404);
      await submit(buyerOne.token, batch.id, wrongGrade.id).expect(409);
      await submit(buyerOne.token, batch.id, oversized.id).expect(409);
      await api
        .post("/order-requests")
        .auth(buyerOne.token, bearer)
        .send({
          harvestListingId: batch.id,
          priceOfferId: eligible.id,
          quotedPricePerKg: 0,
        })
        .expect(400);
      await api
        .patch(`/offers/${eligible.id}/withdraw`)
        .auth(buyerOne.token, bearer)
        .expect(200);
      await submit(buyerOne.token, batch.id, eligible.id).expect(409);
    });

    it("accepts one request atomically, reserves the listing, and copies the submitted price and current estimate", async () => {
      const batch = await createListing();
      const firstOffer = await createOffer(buyerOne);
      const secondOffer = await createOffer(buyerTwo);
      const { body: winner } = await submit(
        buyerOne.token,
        batch.id,
        firstOffer.id,
      ).expect(201);
      const { body: competitor } = await submit(
        buyerTwo.token,
        batch.id,
        secondOffer.id,
      ).expect(201);
      await api
        .patch(`/offers/${firstOffer.id}`)
        .auth(buyerOne.token, bearer)
        .send({ pricePerKg: 35 })
        .expect(200);
      await api
        .patch(`/listings/${batch.id}`)
        .auth(growerToken, bearer)
        .send({ estimatedQuantityKg: 175.125 })
        .expect(200);
      await api
        .patch(`/order-requests/${winner.id}/accept`)
        .auth(otherGrowerToken, bearer)
        .expect(404);
      await api
        .patch(`/order-requests/${winner.id}/accept`)
        .auth(buyerOne.token, bearer)
        .expect(403);
      const accepted = await api
        .patch(`/order-requests/${winner.id}/accept`)
        .auth(growerToken, bearer)
        .expect(200);
      expect(accepted.body).toMatchObject({
        request: {
          status: "ACCEPTED",
          quotedPricePerKg: firstOffer.pricePerKg,
        },
        order: {
          orderRequestId: winner.id,
          harvestListingId: batch.id,
          agreedPricePerKg: firstOffer.pricePerKg,
          estimatedQuantityKg: 175.125,
          actualCollectedWeightKg: null,
          orderStatus: "ACCEPTED",
          paymentStatus: "PENDING",
        },
      });
      const retry = await api
        .patch(`/order-requests/${winner.id}/accept`)
        .auth(growerToken, bearer)
        .expect(200);
      expect(retry.body.order.id).toBe(accepted.body.order.id);
      expect(
        await runner.manager.countBy(Order, { harvestListingId: batch.id }),
      ).toBe(1);
      expect(
        await runner.manager.findOneByOrFail(OrderRequest, {
          id: competitor.id,
        }),
      ).toMatchObject({
        status: "CLOSED",
        closureReason: "ANOTHER_REQUEST_ACCEPTED",
      });
      expect(
        await runner.manager.findOneByOrFail(HarvestListing, { id: batch.id }),
      ).toMatchObject({ status: "RESERVED", isActive: true });
      await api
        .patch(`/order-requests/${competitor.id}/accept`)
        .auth(growerToken, bearer)
        .expect(409);
      await api
        .patch(`/listings/${batch.id}/cancel`)
        .auth(growerToken, bearer)
        .expect(409);
      await api
        .patch(`/listings/${batch.id}`)
        .auth(growerToken, bearer)
        .send({ notes: "late edit" })
        .expect(409);
      await submit(buyerTwo.token, batch.id, secondOffer.id).expect(409);
    });

    it("rechecks offer validity, verification, and quantity at acceptance", async () => {
      const batch = await createListing();
      const firstOffer = await createOffer(buyerOne);
      const secondOffer = await createOffer(buyerTwo);
      const { body: first } = await submit(
        buyerOne.token,
        batch.id,
        firstOffer.id,
      ).expect(201);
      const { body: second } = await submit(
        buyerTwo.token,
        batch.id,
        secondOffer.id,
      ).expect(201);
      const accept = (id) =>
        api.patch(`/order-requests/${id}/accept`).auth(growerToken, bearer);
      await api
        .patch(`/offers/${firstOffer.id}/withdraw`)
        .auth(buyerOne.token, bearer)
        .expect(200);
      await accept(first.id).expect(409);
      await runner.manager.update(PriceOffer, secondOffer.id, {
        validUntil: "2001-01-01",
      });
      await accept(second.id).expect(409);
      await runner.manager.update(PriceOffer, secondOffer.id, {
        validUntil: offer.validUntil,
      });
      await runner.manager.update(FactoryProfile, buyerTwo.profile.id, {
        verificationStatus: "REJECTED",
      });
      await accept(second.id).expect(409);
      await runner.manager.update(FactoryProfile, buyerTwo.profile.id, {
        verificationStatus: "VERIFIED",
      });
      await api
        .patch(`/listings/${batch.id}`)
        .auth(growerToken, bearer)
        .send({ estimatedQuantityKg: 90 })
        .expect(200);
      await accept(second.id).expect(409);
      expect(
        await runner.manager.countBy(Order, { harvestListingId: batch.id }),
      ).toBe(0);
    });

    it("supports rejecting, withdrawing, resubmitting, and closing requests during listing moderation or cancellation", async () => {
      const batch = await createListing();
      const proposed = await createOffer(buyerOne);
      const { body: first } = await submit(
        buyerOne.token,
        batch.id,
        proposed.id,
      ).expect(201);
      await api
        .patch(`/order-requests/${first.id}/withdraw`)
        .auth(buyerTwo.token, bearer)
        .expect(404);
      const rejected = await api
        .patch(`/order-requests/${first.id}/reject`)
        .auth(growerToken, bearer)
        .expect(200);
      expect(rejected.body.status).toBe("REJECTED");
      const { body: second } = await submit(
        buyerOne.token,
        batch.id,
        proposed.id,
      ).expect(201);
      const withdrawn = await api
        .patch(`/order-requests/${second.id}/withdraw`)
        .auth(buyerOne.token, bearer)
        .expect(200);
      expect(withdrawn.body.status).toBe("WITHDRAWN");
      const { body: third } = await submit(
        buyerOne.token,
        batch.id,
        proposed.id,
      ).expect(201);
      await api
        .delete(`/listings/${batch.id}`)
        .auth(adminToken, bearer)
        .expect(200);
      expect(
        await runner.manager.findOneByOrFail(OrderRequest, { id: third.id }),
      ).toMatchObject({
        status: "CLOSED",
        closureReason: "LISTING_UNAVAILABLE",
      });
      const cancelled = await createListing();
      const { body: fourth } = await submit(
        buyerOne.token,
        cancelled.id,
        proposed.id,
      ).expect(201);
      await api
        .patch(`/listings/${cancelled.id}/cancel`)
        .auth(growerToken, bearer)
        .expect(200);
      expect(
        await runner.manager.findOneByOrFail(OrderRequest, { id: fourth.id }),
      ).toMatchObject({
        status: "CLOSED",
        closureReason: "LISTING_UNAVAILABLE",
      });
    });

    async function acceptOrder(batch, buyer = buyerOne) {
      const proposed = await createOffer(buyer);
      const { body: pending } = await submit(
        buyer.token,
        batch.id,
        proposed.id,
      ).expect(201);
      const { body } = await api
        .patch(`/order-requests/${pending.id}/accept`)
        .auth(growerToken, bearer)
        .expect(200);
      return body.order;
    }

    it("exposes confirmed orders only to their participants and admins", async () => {
      const batch = await createListing();
      const order = await acceptOrder(batch);
      const path = `/orders/${order.id}`;
      await api.get(path).expect(401);
      for (const token of [growerToken, buyerOne.token, adminToken]) {
        const result = await api.get(path).auth(token, bearer).expect(200);
        expect(result.body).toMatchObject({
          id: order.id,
          harvestListing: { id: batch.id },
          factoryProfile: { id: buyerOne.profile.id },
          orderStatus: "ACCEPTED",
          paymentStatus: "PENDING",
        });
        expect(Object.keys(result.body.factoryProfile).sort()).toEqual([
          "district",
          "factoryName",
          "id",
        ]);
        expect(Object.keys(result.body.farmerProfile).sort()).toEqual([
          "district",
          "gardenName",
          "id",
        ]);
      }
      for (const token of [otherGrowerToken, buyerTwo.token]) {
        await api.get(path).auth(token, bearer).expect(404);
        const own = await api.get("/orders/my").auth(token, bearer).expect(200);
        expect(own.body.data).not.toContainEqual(
          expect.objectContaining({ id: order.id }),
        );
      }
      await api.get("/orders/my").auth(adminToken, bearer).expect(403);
      await api
        .get("/orders/my")
        .auth(growerToken, bearer)
        .query({ limit: 101 })
        .expect(400);
      const list = await api
        .get("/orders/my")
        .auth(buyerOne.token, bearer)
        .query({ orderStatus: "ACCEPTED", paymentStatus: "PENDING", limit: 1 })
        .expect(200);
      expect(list.body).toMatchObject({
        page: 1,
        limit: 1,
        data: [{ id: order.id }],
      });
    });

    it("lets only the owning grower cancel before pickup and reopens an eligible listing for new requests", async () => {
      const batch = await createListing();
      const otherOffer = await createOffer(buyerTwo);
      const { body: competing } = await submit(
        buyerTwo.token,
        batch.id,
        otherOffer.id,
      ).expect(201);
      const order = await acceptOrder(batch);
      const path = `/orders/${order.id}/status`;
      const cancel = { orderStatus: "CANCELLED" };
      await api
        .patch(path)
        .auth(buyerOne.token, bearer)
        .send(cancel)
        .expect(403);
      await api
        .patch(path)
        .auth(otherGrowerToken, bearer)
        .send(cancel)
        .expect(404);
      const result = await api
        .patch(path)
        .auth(growerToken, bearer)
        .send(cancel)
        .expect(200);
      expect(result.body).toMatchObject({
        orderStatus: "CANCELLED",
        paymentStatus: "PENDING",
        agreedPricePerKg: order.agreedPricePerKg,
        estimatedQuantityKg: order.estimatedQuantityKg,
      });
      await api.patch(path).auth(growerToken, bearer).send(cancel).expect(409);
      expect(
        await runner.manager.findOneByOrFail(HarvestListing, { id: batch.id }),
      ).toMatchObject({ status: "ACTIVE", isActive: true });
      expect(
        await runner.manager.findOneByOrFail(OrderRequest, {
          id: competing.id,
        }),
      ).toMatchObject({ status: "CLOSED" });
      const next = (
        await submit(buyerTwo.token, batch.id, otherOffer.id).expect(201)
      ).body;
      expect(next.id).not.toBe(competing.id);
      await api
        .patch(`/order-requests/${next.id}/accept`)
        .auth(growerToken, bearer)
        .expect(200);
      expect(
        await runner.manager.countBy(Order, { harvestListingId: batch.id }),
      ).toBe(2);
    });

    it("does not reopen a moderated listing when its accepted order is cancelled", async () => {
      const batch = await createListing();
      const order = await acceptOrder(batch);
      await api
        .delete(`/listings/${batch.id}`)
        .auth(adminToken, bearer)
        .expect(200);
      await api
        .patch(`/orders/${order.id}/status`)
        .auth(growerToken, bearer)
        .send({ orderStatus: "CANCELLED" })
        .expect(200);
      expect(
        await runner.manager.findOneByOrFail(HarvestListing, { id: batch.id }),
      ).toMatchObject({ status: "CANCELLED", isActive: false });
    });

    it("lets the owning factory schedule pickup and collect weight without changing the snapshots or payment", async () => {
      const batch = await createListing();
      const order = await acceptOrder(batch);
      const path = `/orders/${order.id}/status`;
      const pickup = {
        orderStatus: "PICKUP_SCHEDULED",
        proposedCollectionDate: "2099-12-18",
        collectionPoint: "  Tetulia collection point  ",
        pickupNotes: "Truck arrives at 9 AM",
        estimatedTransportCostBdt: 500.25,
      };
      await api.patch(path).auth(growerToken, bearer).send(pickup).expect(403);
      await api.patch(path).auth(adminToken, bearer).send(pickup).expect(403);
      await api
        .patch(path)
        .auth(buyerTwo.token, bearer)
        .send(pickup)
        .expect(404);
      await api
        .patch(path)
        .auth(buyerOne.token, bearer)
        .send({ orderStatus: "COLLECTED", actualCollectedWeightKg: 142.75 })
        .expect(409);
      const scheduled = await api
        .patch(path)
        .auth(buyerOne.token, bearer)
        .send(pickup)
        .expect(200);
      expect(scheduled.body).toMatchObject({
        ...pickup,
        collectionPoint: "Tetulia collection point",
        paymentStatus: "PENDING",
        actualCollectedWeightKg: null,
        estimatedQuantityKg: batch.estimatedQuantityKg,
      });
      await api
        .patch(path)
        .auth(growerToken, bearer)
        .send({ orderStatus: "CANCELLED" })
        .expect(409);
      await api
        .patch(path)
        .auth(buyerOne.token, bearer)
        .send(pickup)
        .expect(409);
      const collected = await api
        .patch(path)
        .auth(buyerOne.token, bearer)
        .send({ orderStatus: "COLLECTED", actualCollectedWeightKg: 142.75 })
        .expect(200);
      expect(collected.body).toMatchObject({
        orderStatus: "COLLECTED",
        paymentStatus: "PENDING",
        actualCollectedWeightKg: 142.75,
        agreedPricePerKg: order.agreedPricePerKg,
        estimatedQuantityKg: order.estimatedQuantityKg,
        collectionPoint: "Tetulia collection point",
        proposedCollectionDate: pickup.proposedCollectionDate,
      });
      const growerRead = await api
        .get(`/orders/${order.id}`)
        .auth(growerToken, bearer)
        .expect(200);
      expect(growerRead.body).toEqual(collected.body);
      await api
        .patch(path)
        .auth(buyerOne.token, bearer)
        .send({ orderStatus: "COMPLETED" })
        .expect(400);
      expect(
        await runner.manager.findOneByOrFail(HarvestListing, { id: batch.id }),
      ).toMatchObject({
        status: "RESERVED",
        estimatedQuantityKg: batch.estimatedQuantityKg,
      });
    });

    it("rejects invalid pickup details, collection weight, and attempts to alter order snapshots", async () => {
      const order = await acceptOrder(await createListing());
      const edit = (dto) =>
        api
          .patch(`/orders/${order.id}/status`)
          .auth(buyerOne.token, bearer)
          .send(dto);
      for (const changes of [
        { orderStatus: "PICKUP_SCHEDULED" },
        {
          orderStatus: "PICKUP_SCHEDULED",
          proposedCollectionDate: "2099-02-29",
          collectionPoint: "Tetulia",
        },
        {
          orderStatus: "PICKUP_SCHEDULED",
          proposedCollectionDate: "2099-03-01",
          collectionPoint: "  ",
        },
        {
          orderStatus: "PICKUP_SCHEDULED",
          proposedCollectionDate: "2099-03-01",
          collectionPoint: "Tetulia",
          estimatedTransportCostBdt: -1,
        },
        {
          orderStatus: "PICKUP_SCHEDULED",
          proposedCollectionDate: "2099-03-01",
          collectionPoint: "Tetulia",
          actualCollectedWeightKg: 12,
        },
        { orderStatus: "COLLECTED" },
        { orderStatus: "COLLECTED", actualCollectedWeightKg: -1 },
        { orderStatus: "COLLECTED", actualCollectedWeightKg: 142.7501 },
        { orderStatus: "COLLECTED", actualCollectedWeightKg: "142.75" },
        {
          orderStatus: "COLLECTED",
          actualCollectedWeightKg: 142.75,
          estimatedQuantityKg: 1,
        },
        {
          orderStatus: "COLLECTED",
          actualCollectedWeightKg: 142.75,
          paymentStatus: "COMPLETED",
        },
        {
          orderStatus: "COLLECTED",
          actualCollectedWeightKg: 142.75,
          agreedPricePerKg: 1,
        },
      ])
        await edit(changes).expect(400);
      expect(
        await runner.manager.findOneByOrFail(Order, { id: order.id }),
      ).toMatchObject({
        orderStatus: "ACCEPTED",
        paymentStatus: "PENDING",
        actualCollectedWeightKg: null,
      });
    });
  });

  it("enforces listing ownership and moderation and filters paginated results", async () => {
    await api.get("/listings").expect(401);
    await api
      .post("/listings")
      .auth(factoryToken, { type: "bearer" })
      .send(listing)
      .expect(403);
    await api
      .post("/listings")
      .auth(otherGrowerToken, { type: "bearer" })
      .send(listing)
      .expect(404);
    await api
      .post("/listings")
      .auth(growerToken, { type: "bearer" })
      .send({ ...listing, estimatedQuantityKg: 0 })
      .expect(400);
    const created = await api
      .post("/listings")
      .auth(growerToken, { type: "bearer" })
      .send(listing)
      .expect(201);
    const path = `/listings/${created.body.id}`;
    const detail = await api
      .get(path)
      .auth(factoryToken, { type: "bearer" })
      .expect(200);
    expect(detail.body.farmerProfile.district).toBe("Panchagarh");
    const own = await api
      .get("/listings/my")
      .auth(growerToken, { type: "bearer" })
      .expect(200);
    expect(own.body.map((row) => row.id)).toEqual([created.body.id]);
    await api
      .patch(path)
      .auth(otherGrowerToken, { type: "bearer" })
      .send({ notes: "Edit" })
      .expect(403);
    await api
      .patch(path)
      .auth(growerToken, { type: "bearer" })
      .send({ notes: "Edit" })
      .expect(200);
    await api
      .post("/listings")
      .auth(growerToken, { type: "bearer" })
      .send({ ...listing, teaGrade: "Green" })
      .expect(201);
    const first = await api
      .get("/listings?district=panchagarh&limit=1&page=1")
      .auth(factoryToken, { type: "bearer" })
      .expect(200);
    const second = await api
      .get("/listings?district=panchagarh&limit=1&page=2")
      .auth(factoryToken, { type: "bearer" })
      .expect(200);
    expect(first.body.total).toBe(2);
    expect(first.body.data[0].id).not.toBe(second.body.data[0].id);
    const filtered = await api
      .get("/listings?teaGrade=ctc&district=panchagarh")
      .auth(factoryToken, { type: "bearer" })
      .expect(200);
    expect(filtered.body.data.map((row) => row.id)).toEqual([created.body.id]);
    await api
      .get("/listings?limit=101")
      .auth(factoryToken, { type: "bearer" })
      .expect(400);
    await api
      .patch(`${path}/cancel`)
      .auth(otherGrowerToken, { type: "bearer" })
      .expect(403);
    await api
      .patch(`${path}/cancel`)
      .auth(growerToken, { type: "bearer" })
      .expect(200);
    await api
      .patch(path)
      .auth(growerToken, { type: "bearer" })
      .send({ notes: "Edit" })
      .expect(409);
    await api.delete(path).auth(factoryToken, { type: "bearer" }).expect(403);
    await api.delete(path).auth(adminToken, { type: "bearer" }).expect(200);
    await api.get(path).auth(factoryToken, { type: "bearer" }).expect(404);
  });
});
