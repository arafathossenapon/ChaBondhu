const { CreatePayments1795390200000 } = require("../dist/database/migrations/1795390200000-CreatePayments");
const { randomUUID } = require("node:crypto");
const { setTimeout: delay } = require("node:timers/promises");
const { Test } = require("@nestjs/testing");
const { hash } = require("argon2");
const request = require("supertest");
const { DataSource } = require("typeorm");
const { AppModule } = require("../dist/app.module");
const { ValidationPipe } = require("../dist/common/pipes/validation.pipe");
const { dataSourceOptions } = require("../dist/config/database.config");
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
const {
  PriceOffer,
} = require("../dist/modules/offers/entities/price-offer.entity");
const { Order } = require("../dist/modules/orders/entities/order.entity");
const {
  OrderRequest,
} = require("../dist/modules/orders/entities/order-request.entity");
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

const databaseUrl = process.env.CHABONDHU_ORDERS_TEST_URL;
const describeRace = databaseUrl ? describe : describe.skip;

describeRace(
  "Orders PostgreSQL transaction races (disposable database)",
  () => {
    const applicationName = `chabondhu-race-${randomUUID()}`;
    const password = randomUUID();
    const bearer = { type: "bearer" };
    let dataSource;
    let app;
    let api;
    let growerToken;
    let farmerId;
    let buyers;

    async function createAccount(role, email, passwordHash) {
      const user = await dataSource.manager.save(User, {
        email,
        role,
        passwordHash,
        fullName: "Race fixture",
        phoneNumber: "01711000001",
      });
      const response = await api
        .post("/auth/login")
        .send({ email, password })
        .expect(200);
      return { user, token: response.body.accessToken };
    }

    beforeAll(async () => {
      const url = new URL(databaseUrl);
      if (!["localhost", "127.0.0.1"].includes(url.hostname) || !url.port) {
        throw new Error(
          "Orders race tests require a dedicated local PostgreSQL instance",
        );
      }
      dataSource = await new DataSource({
        ...dataSourceOptions,
        host: url.hostname,
        port: Number(url.port),
        username: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.slice(1),
        extra: { application_name: applicationName, max: 8 },
        migrations: [
          CreateUsersAndProfiles1793882640314,
          CreateHarvestListings1793884438520,
          TrackFactoryVerificationReviews1795300000000,
          CreatePriceOffers1795300100000,
          CreateOrderRequestsAndOrders1795390000000,
          AddOrderPickupFields1795390100000,
          CreatePayments1795390200000,
        ],
      }).initialize();
      const [{ occupied }] = await dataSource.query(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public') AS occupied",
      );
      if (occupied)
        throw new Error(
          "Orders race tests require an empty disposable database",
        );
      await dataSource.runMigrations({ transaction: "all" });
      const module = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(DataSource)
        .useValue(dataSource)
        .compile();
      app = module.createNestApplication({ logger: false });
      app.useGlobalPipes(new ValidationPipe());
      await app.init();
      api = request(app.getHttpServer());
      const passwordHash = await hash(password);
      const grower = await createAccount(
        "GROWER",
        "race-grower@example.com",
        passwordHash,
      );
      growerToken = grower.token;
      farmerId = (
        await dataSource.manager.save(FarmerProfile, {
          userId: grower.user.id,
          gardenName: "Race Garden",
          division: "Rangpur",
          district: "Panchagarh",
          upazila: "Tetulia",
        })
      ).id;
      buyers = await Promise.all(
        [1, 2].map(async (number) => {
          const account = await createAccount(
            "FACTORY",
            `race-factory-${number}@example.com`,
            passwordHash,
          );
          const profile = await dataSource.manager.save(FactoryProfile, {
            userId: account.user.id,
            factoryName: `Race Factory ${number}`,
            representativeName: "Race fixture",
            district: "Panchagarh",
            upazila: "Tetulia",
            verificationStatus: "VERIFIED",
          });
          const offer = await dataSource.manager.save(PriceOffer, {
            factoryProfileId: profile.id,
            teaGrade: "CTC",
            pricePerKg: 28.5,
            validUntil: "2099-12-31",
          });
          return { token: account.token, offer };
        }),
      );
    });

    afterAll(async () => {
      if (app) await app.close();
      if (dataSource?.isInitialized) await dataSource.destroy();
    });

    async function listing() {
      return dataSource.manager.save(HarvestListing, {
        farmerProfileId: farmerId,
        teaGrade: "CTC",
        estimatedQuantityKg: 150,
        expectedHarvestDate: "2099-12-30",
        collectionLocation: "Race collection point",
      });
    }

    const submit = (buyer, harvestListingId) =>
      api
        .post("/order-requests")
        .auth(buyer.token, bearer)
        .send({ harvestListingId, priceOfferId: buyer.offer.id });
    const accept = (id) =>
      api.patch(`/order-requests/${id}/accept`).auth(growerToken, bearer);
    const cancel = (id) =>
      api.patch(`/listings/${id}/cancel`).auth(growerToken, bearer);

    async function waitForBlockedConnections(count) {
      const deadline = Date.now() + 4_000;
      while (Date.now() < deadline) {
        const [result] = await dataSource.query(
          "SELECT count(*)::int AS count FROM pg_stat_activity WHERE application_name = $1 AND wait_event_type = 'Lock' AND query LIKE '%FOR UPDATE%'",
          [applicationName],
        );
        if (result.count >= count) return;
        await delay(20);
      }
      throw new Error(
        `Expected ${count} independent PostgreSQL sessions waiting on the listing lock`,
      );
    }

    async function race(id, first, second) {
      const blocker = dataSource.createQueryRunner();
      await blocker.startTransaction();
      let pending = [];
      try {
        await blocker.manager.findOneOrFail(HarvestListing, {
          where: { id },
          lock: { mode: "pessimistic_write" },
        });
        pending.push(first().then((response) => response));
        await waitForBlockedConnections(1);
        pending.push(second().then((response) => response));
        await waitForBlockedConnections(2);
      } finally {
        await blocker.rollbackTransaction();
        await blocker.release();
        await Promise.allSettled(pending);
      }
      return Promise.all(pending);
    }

    it("allows exactly one acceptance when two independent sessions race", async () => {
      const batch = await listing();
      const first = (await submit(buyers[0], batch.id).expect(201)).body;
      const second = (await submit(buyers[1], batch.id).expect(201)).body;
      const [winner, loser] = await race(
        batch.id,
        () => accept(first.id),
        () => accept(second.id),
      );
      expect([winner.status, loser.status]).toEqual([200, 409]);
      expect(
        await dataSource.manager.countBy(Order, { harvestListingId: batch.id }),
      ).toBe(1);
      expect(
        await dataSource.manager.findOneByOrFail(OrderRequest, {
          id: second.id,
        }),
      ).toMatchObject({
        status: "CLOSED",
        closureReason: "ANOTHER_REQUEST_ACCEPTED",
      });
      await expect(
        dataSource.manager.insert(Order, {
          orderRequestId: second.id,
          harvestListingId: batch.id,
          agreedPricePerKg: second.quotedPricePerKg,
          estimatedQuantityKg: batch.estimatedQuantityKg,
        }),
      ).rejects.toMatchObject({
        code: "23505",
        constraint: "UQ_orders_listing_reservation",
      });
      await accept(first.id).expect(200);
    });

    it("blocks submission queued behind a winning acceptance", async () => {
      const batch = await listing();
      const first = (await submit(buyers[0], batch.id).expect(201)).body;
      const responses = await race(
        batch.id,
        () => accept(first.id),
        () => submit(buyers[1], batch.id),
      );
      expect(responses.map(({ status }) => status)).toEqual([200, 409]);
      expect(
        await dataSource.manager.countBy(OrderRequest, {
          harvestListingId: batch.id,
        }),
      ).toBe(1);
    });

    it("serializes listing cancellation against acceptance", async () => {
      const batch = await listing();
      const incoming = (await submit(buyers[0], batch.id).expect(201)).body;
      const responses = await race(
        batch.id,
        () => cancel(batch.id),
        () => accept(incoming.id),
      );
      expect(responses.map(({ status }) => status)).toEqual([200, 409]);
      expect(
        await dataSource.manager.countBy(Order, { harvestListingId: batch.id }),
      ).toBe(0);
      expect(
        await dataSource.manager.findOneByOrFail(OrderRequest, {
          id: incoming.id,
        }),
      ).toMatchObject({
        status: "CLOSED",
        closureReason: "LISTING_UNAVAILABLE",
      });
    });

    it("rolls back order creation, reservation, and acceptance after an injected closure failure", async () => {
      const batch = await listing();
      const first = (await submit(buyers[0], batch.id).expect(201)).body;
      const second = (await submit(buyers[1], batch.id).expect(201)).body;
      // A temporary fixture constraint triggers a real PostgreSQL write failure during closure.
      await dataSource.query(
        `ALTER TABLE order_requests ADD CONSTRAINT test_block_closure CHECK (id <> ${Number(second.id)} OR status <> 'CLOSED')`,
      );
      await accept(first.id).expect(500);
      expect(
        await dataSource.manager.countBy(Order, { harvestListingId: batch.id }),
      ).toBe(0);
      expect(
        await dataSource.manager.findOneByOrFail(HarvestListing, {
          id: batch.id,
        }),
      ).toMatchObject({ status: "ACTIVE" });
      expect(
        await dataSource.manager.countBy(OrderRequest, {
          harvestListingId: batch.id,
          status: "PENDING",
        }),
      ).toBe(2);
    });
  },
);
