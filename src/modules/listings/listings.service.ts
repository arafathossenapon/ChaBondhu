import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { HarvestListing } from "./entities/harvest-listing.entity";
import { CreateHarvestListingDto } from "./dto/create-harvest-listing.dto";
import { UpdateHarvestListingDto } from "./dto/update-harvest-listing.dto";
import { QueryHarvestListingDto } from "./dto/query-harvest-listing.dto";
import { FarmerProfilesService } from "@/modules/farmer-profiles/farmer-profiles.service";
import { ListingStatus } from "@/common/enums/listing-status.enum";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import { Role } from "@/common/enums/role.enum";

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
    const listing = await this.harvestListingRepository.findOne({
      where: { id },
      relations: ["farmerProfile"],
    });

    if (!listing) {
      throw new NotFoundException(`Harvest listing with ID ${id} not found`);
    }

    if (!listing.farmerProfile || listing.farmerProfile.userId !== userId) {
      throw new ForbiddenException(
        "You do not have permission to update this listing",
      );
    }

    if (listing.status !== ListingStatus.ACTIVE) {
      throw new ConflictException("Only active listings can be updated");
    }

    if (updateDto.teaGrade !== undefined) {
      listing.teaGrade = updateDto.teaGrade;
    }
    if (updateDto.estimatedQuantityKg !== undefined) {
      listing.estimatedQuantityKg = updateDto.estimatedQuantityKg;
    }
    if (updateDto.expectedHarvestDate !== undefined) {
      listing.expectedHarvestDate = updateDto.expectedHarvestDate;
    }
    if (updateDto.lastHarvestDate !== undefined) {
      listing.lastHarvestDate = updateDto.lastHarvestDate;
    }
    if (updateDto.qualityDescription !== undefined) {
      listing.qualityDescription = updateDto.qualityDescription;
    }
    if (updateDto.collectionLocation !== undefined) {
      listing.collectionLocation = updateDto.collectionLocation;
    }
    if (updateDto.notes !== undefined) {
      listing.notes = updateDto.notes;
    }

    return this.harvestListingRepository.save(listing);
  }

  async cancel(id: number, userId: number): Promise<HarvestListing> {
    const listing = await this.harvestListingRepository.findOne({
      where: { id },
      relations: ["farmerProfile"],
    });

    if (!listing) {
      throw new NotFoundException(`Harvest listing with ID ${id} not found`);
    }

    if (!listing.farmerProfile || listing.farmerProfile.userId !== userId) {
      throw new ForbiddenException(
        "You do not have permission to cancel this listing",
      );
    }

    if (listing.status === ListingStatus.CANCELLED) {
      return listing;
    }

    if (listing.status === ListingStatus.SOLD) {
      throw new ConflictException("Cannot cancel a completed/sold listing");
    }

    // Note: Order dependency rule: Once OrdersModule is implemented,
    // active order checks (ACCEPTED or later) will be enforced here.

    listing.status = ListingStatus.CANCELLED;
    return this.harvestListingRepository.save(listing);
  }

  async softDelete(id: number): Promise<{ message: string }> {
    const listing = await this.harvestListingRepository.findOne({
      where: { id },
    });

    if (!listing) {
      throw new NotFoundException(`Harvest listing with ID ${id} not found`);
    }

    listing.isActive = false;
    await this.harvestListingRepository.save(listing);

    return { message: "Listing has been deactivated." };
  }
}
