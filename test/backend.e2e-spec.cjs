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
  PriceOffer,
} = require("../dist/modules/offers/entities/price-offer.entity");
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

    const testingModule = Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DataSource)
      .useValue(dataSource);
    for (const entity of [
      User,
      FarmerProfile,
      FactoryProfile,
      HarvestListing,
      PriceOffer,
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
