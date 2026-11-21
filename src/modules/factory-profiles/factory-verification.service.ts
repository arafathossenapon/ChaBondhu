import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { FactoryVerificationStatus } from "@/common/enums/factory-verification-status.enum";
import { Role } from "@/common/enums/role.enum";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import { FactoryProfile } from "./entities/factory-profile.entity";
import {
  FactoryVerificationDecision,
  FactoryVerificationReview,
} from "./entities/factory-verification-review.entity";
import { FactoryProfilesService } from "./factory-profiles.service";

@Injectable()
export class FactoryVerificationService {
  constructor(
    @InjectRepository(FactoryProfile)
    private readonly profiles: Repository<FactoryProfile>,
    private readonly factoryProfiles: FactoryProfilesService,
  ) {}

  async getAdminReview(actor: AuthUser, userId: number) {
    this.requireRole(actor, Role.ADMIN);
    const factoryProfile = await this.factoryQuery(
      this.profiles,
      userId,
    ).getOne();
    if (!factoryProfile)
      throw new NotFoundException("Factory profile not found");
    return {
      factoryProfile,
      reviews: await this.findReviews(factoryProfile.id),
    };
  }

  async getOwnReviews(actor: AuthUser): Promise<FactoryVerificationReview[]> {
    this.requireRole(actor, Role.FACTORY);
    const profile = await this.factoryProfiles.getOwnProfile(actor.id);
    return this.findReviews(profile.id);
  }

  async requireVerifiedFactory(actor: AuthUser): Promise<FactoryProfile> {
    this.requireRole(actor, Role.FACTORY);
    const profile = await this.factoryProfiles.getOwnProfile(actor.id);
    if (!profile.isVerified) {
      throw new ForbiddenException(
        "Factory verification is required to publish price offers",
      );
    }
    return profile;
  }

  async approve(actor: AuthUser, userId: number): Promise<FactoryProfile> {
    return this.recordDecision(
      actor,
      userId,
      FactoryVerificationStatus.VERIFIED,
      null,
    );
  }

  async reject(
    actor: AuthUser,
    userId: number,
    reason: string,
  ): Promise<FactoryProfile> {
    this.requireRole(actor, Role.ADMIN);
    const trimmedReason = reason.trim();
    if (!trimmedReason || trimmedReason.length > 1000) {
      throw new BadRequestException(
        "Rejection reason must contain 1 to 1000 characters",
      );
    }
    return this.recordDecision(
      actor,
      userId,
      FactoryVerificationStatus.REJECTED,
      trimmedReason,
    );
  }

  async resubmit(actor: AuthUser): Promise<FactoryProfile> {
    this.requireRole(actor, Role.FACTORY);
    return this.profiles.manager.transaction(async (manager) => {
      const repository = manager.getRepository(FactoryProfile);
      const profile = await this.factoryQuery(repository, actor.id)
        .setLock("pessimistic_write", undefined, ["profile"])
        .getOne();
      if (!profile) throw new NotFoundException("Factory profile not found");
      if (profile.verificationStatus !== FactoryVerificationStatus.REJECTED) {
        throw new ConflictException(
          "Only a rejected verification can be resubmitted",
        );
      }
      profile.verificationStatus = FactoryVerificationStatus.PENDING;
      return repository.save(profile);
    });
  }

  private async recordDecision(
    actor: AuthUser,
    userId: number,
    decision: FactoryVerificationDecision,
    reason: string | null,
  ): Promise<FactoryProfile> {
    this.requireRole(actor, Role.ADMIN);
    return this.profiles.manager.transaction(async (manager) => {
      const repository = manager.getRepository(FactoryProfile);
      // একই আবেদন একসঙ্গে দুইবার চূড়ান্ত করা যায় না।
      const profile = await this.factoryQuery(repository, userId)
        .setLock("pessimistic_write", undefined, ["profile"])
        .getOne();
      if (!profile) throw new NotFoundException("Factory profile not found");
      if (profile.verificationStatus !== FactoryVerificationStatus.PENDING) {
        throw new ConflictException(
          "Only a pending verification can be reviewed",
        );
      }

      const reviewedAt = new Date();
      const approved = decision === FactoryVerificationStatus.VERIFIED;
      profile.verificationStatus = decision;
      profile.verifiedAt = approved ? reviewedAt : null;
      profile.verifiedByAdminId = approved ? actor.id : null;
      await repository.save(profile);
      await manager.insert(FactoryVerificationReview, {
        factoryProfileId: profile.id,
        reviewedByAdminId: actor.id,
        decision,
        reason,
        createdAt: reviewedAt,
      });
      return profile;
    });
  }

  private factoryQuery(repository: Repository<FactoryProfile>, userId: number) {
    return repository
      .createQueryBuilder("profile")
      .innerJoin("profile.user", "account")
      .where("profile.userId = :userId AND account.role = :role", {
        userId,
        role: Role.FACTORY,
      });
  }

  private findReviews(
    factoryProfileId: number,
  ): Promise<FactoryVerificationReview[]> {
    return this.profiles.manager.find(FactoryVerificationReview, {
      where: { factoryProfileId },
      order: { id: "DESC" },
    });
  }

  private requireRole(actor: AuthUser, role: Role): void {
    if (actor.role !== role)
      throw new ForbiddenException("You do not have permission");
  }
}
