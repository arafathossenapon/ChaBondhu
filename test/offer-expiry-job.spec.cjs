const { Logger } = require("@nestjs/common");
const { OfferExpiryJob } = require("../dist/modules/offers/offer-expiry.job");

describe("OfferExpiryJob", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("runs immediately, repeats every minute, and stops on shutdown", async () => {
    const expireOffers = jest.fn().mockResolvedValue(0);
    const job = new OfferExpiryJob({ expireOffers });
    await job.onApplicationBootstrap();
    expect(expireOffers).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(59_999);
    expect(expireOffers).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(expireOffers).toHaveBeenCalledTimes(2);
    await job.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(expireOffers).toHaveBeenCalledTimes(2);
  });

  it("retries a failed sweep and skips ticks while a sweep is running", async () => {
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
    let completeSweep;
    const pending = new Promise((resolve) => {
      completeSweep = resolve;
    });
    const expireOffers = jest
      .fn()
      .mockRejectedValueOnce(new Error("Database unavailable"))
      .mockReturnValueOnce(pending)
      .mockResolvedValue(0);
    const job = new OfferExpiryJob({ expireOffers });
    await job.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(180_000);
    expect(expireOffers).toHaveBeenCalledTimes(2);
    completeSweep(0);
    await jest.advanceTimersByTimeAsync(60_000);
    expect(expireOffers).toHaveBeenCalledTimes(3);
    await job.onModuleDestroy();
  });
});
