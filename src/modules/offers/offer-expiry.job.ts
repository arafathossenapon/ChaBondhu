import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common";
import { OffersService } from "./offers.service";

@Injectable()
export class OfferExpiryJob implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OfferExpiryJob.name);
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;

  constructor(private readonly offers: OffersService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.sweep();
    this.timer = setInterval(() => {
      void this.sweep();
    }, 60_000);
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.timer);
    await this.running;
  }

  private sweep(): Promise<void> {
    // আগের কাজ চললে একই ইনস্ট্যান্সে আরেকটি সুইপ শুরু হয় না।
    this.running ??= this.offers
      .expireOffers()
      .then(() => undefined)
      .catch(() => {
        this.logger.error(
          "Price offer expiry sweep failed. Will retry on the next interval.",
        );
      })
      .finally(() => {
        this.running = undefined;
      });
    return this.running;
  }
}
