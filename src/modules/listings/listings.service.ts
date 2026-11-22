import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import { HarvestListing } from "./entities/harvest-listing.entity";
import { CreateHarvestListingDto } from "./dto/create-harvest-listing.dto";
import { UpdateHarvestListingDto } from "./dto/update-harvest-listing.dto";
import { QueryHarvestListingDto } from "./dto/query-harvest-listing.dto";
import { FarmerProfilesService } from "@/modules/farmer-profiles/farmer-profiles.service";
import { ListingStatus } from "@/common/enums/listing-status.enum";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import { Role } from "@/common/enums/role.enum";
import { FarmerProfile } from "@/modules/farmer-profiles/entities/farmer-profile.entity";
import { closePendingRequests } from "@/modules/orders/close-pending-requests";
import { OrderRequestClosureReason } from "@/modules/orders/order-status";
import { lockHarvestListing } from "./lock-harvest-listing";

@Injectable()
export class ListingsService {
  constructor(
    @InjectRepository(HarvestListing)
    private readonly harvestListingRepository: Repository<HarvestListing>,
    private readonly farmerProfilesService: FarmerProfilesService,
  ) {}

  async create(
    userId: number,
    createDto: CreateHarvestListingDto,
  ): Promise<HarvestListing> {
    const farmerProfile = await this.farmerProfilesService.getOwnProfile(userId);

    const listing = this.harvestListingRepository.create({
      ...createDto,
      farmerProfileId: farmerProfile.id,
      status: ListingStatus.ACTIVE,
      isActive: true,
    });

    return this.harvestListingRepository.save(listing);
  }

  async findAllActive(queryDto: QueryHarvestListingDto): Promise<{
    data: HarvestListing[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = queryDto.page && queryDto.page > 0 ? queryDto.page : 1;
    const limit = queryDto.limit && queryDto.limit > 0 ? Math.min(queryDto.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const qb = this.harvestListingRepository
      .createQueryBuilder("listing")
      .innerJoinAndSelect("listing.farmerProfile", "farmerProfile")
      .where("listing.status = :status", { status: ListingStatus.ACTIVE })
      .andWhere("listing.isActive = :isActive", { isActive: true });

    if (queryDto.teaGrade) {
      qb.andWhere("LOWER(listing.teaGrade) LIKE LOWER(:teaGrade)", {
        teaGrade: `%${queryDto.teaGrade}%`,
      });
    }

    if (queryDto.district) {
      qb.andWhere("LOWER(farmerProfile.district) = LOWER(:district)", {
        district: queryDto.district,
      });
    }

    qb.orderBy("listing.createdAt", "DESC")
      .skip(skip)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async findOwnListings(userId: number): Promise<HarvestListing[]> {
    let farmerProfile;
    try {
      farmerProfile = await this.farmerProfilesService.getOwnProfile(userId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return [];
      }
      throw error;
    }

    return this.harvestListingRepository.find({
      where: { farmerProfileId: farmerProfile.id },
      order: { createdAt: "DESC" },
    });
  }

  async findById(id: number, currentUser?: AuthUser): Promise<HarvestListing> {
    const listing = await this.harvestListingRepository.findOne({
      where: { id },
      relations: ["farmerProfile"],
    });

    if (!listing) {
      throw new NotFoundException(`Harvest listing with ID ${id} not found`);
    }

    if (!listing.isActive) {
      const isOwner = currentUser && listing.farmerProfile?.userId === currentUser.id;
      const isAdmin = currentUser && currentUser.role === Role.ADMIN;
      if (!isOwner && !isAdmin) {
        throw new NotFoundException(`Harvest listing with ID ${id} not found`);
      }
    }

    return listing;
  }

  async update(
    id: number,
    userId: number,
    updateDto: UpdateHarvestListingDto,
  ): Promise<HarvestListing> {
    return this.harvestListingRepository.manager.transaction(async (manager) => {
      const listing = await this.lockOwnListing(manager, id, userId);
      if (!listing.isActive || listing.status !== ListingStatus.ACTIVE) {
        throw new ConflictException("Only active listings can be updated");
      }
      const repository = manager.getRepository(HarvestListing);
      return repository.save(repository.merge(listing, updateDto));
    });
  }

  async cancel(id: number, userId: number): Promise<HarvestListing> {
    return this.harvestListingRepository.manager.transaction(async (manager) => {
      const listing = await this.lockOwnListing(manager, id, userId);
      if (listing.status === ListingStatus.CANCELLED) return listing;
      if (listing.status === ListingStatus.SOLD || listing.status === ListingStatus.RESERVED) {
        throw new ConflictException("Cannot cancel a reserved or sold listing");
      }
      listing.status = ListingStatus.CANCELLED;
      await closePendingRequests(manager, listing.id, OrderRequestClosureReason.LISTING_UNAVAILABLE);
      return manager.save(HarvestListing, listing);
    });
  }

  async softDelete(id: number): Promise<{ message: string }> {
    return this.harvestListingRepository.manager.transaction(async (manager) => {
      const listing = await lockHarvestListing(manager, id);
      await manager.update(HarvestListing, listing.id, { isActive: false });
      await closePendingRequests(manager, listing.id, OrderRequestClosureReason.LISTING_UNAVAILABLE);
      return { message: "Listing has been deactivated." };
    });
  }

  private async lockOwnListing(manager: EntityManager, id: number, userId: number) {
    // গ্রহণ ও তালিকার পরিবর্তন একই সারি লক করে, তাই সংরক্ষণ হারিয়ে যায় না।
    const listing = await lockHarvestListing(manager, id);
    const profile = await manager.findOneBy(FarmerProfile, { id: listing.farmerProfileId, userId });
    if (!profile) throw new ForbiddenException("You do not own this listing");
    listing.farmerProfile = profile;
    return listing;
  }
}
