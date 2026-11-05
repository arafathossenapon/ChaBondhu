import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { FarmerProfile } from "./entities/farmer-profile.entity";
import { CreateFarmerProfileDto } from "./dto/create-farmer-profile.dto";
import { UpdateFarmerProfileDto } from "./dto/update-farmer-profile.dto";
import { Role } from "@/common/enums/role.enum";

@Injectable()
export class FarmerProfilesService {
  constructor(
    @InjectRepository(FarmerProfile)
    private readonly farmerProfileRepository: Repository<FarmerProfile>,
  ) {}

  async create(
    userId: number,
    role: Role,
    createDto: CreateFarmerProfileDto,
  ): Promise<FarmerProfile> {
    if (role !== Role.GROWER) {
      throw new ForbiddenException(
        "Only users with GROWER role can create a farmer profile",
      );
    }

    const existingProfile = await this.farmerProfileRepository.findOne({
      where: { userId },
    });

    if (existingProfile) {
      throw new ConflictException("Farmer profile already exists for this user");
    }

    const profile = this.farmerProfileRepository.create({
      ...createDto,
      userId,
    });

    return this.farmerProfileRepository.save(profile);
  }

  async getOwnProfile(userId: number): Promise<FarmerProfile> {
    const profile = await this.farmerProfileRepository.findOne({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException("Farmer profile not found for this user");
    }

    return profile;
  }

  async findById(id: number): Promise<FarmerProfile> {
    const profile = await this.farmerProfileRepository.findOne({
      where: { id },
    });

    if (!profile) {
      throw new NotFoundException(`Farmer profile with ID ${id} not found`);
    }

    return profile;
  }

  async updateOwnProfile(
    userId: number,
    updateDto: UpdateFarmerProfileDto,
  ): Promise<FarmerProfile> {
    const profile = await this.getOwnProfile(userId);

    if (updateDto.gardenName !== undefined) {
      profile.gardenName = updateDto.gardenName;
    }
    if (updateDto.division !== undefined) {
      profile.division = updateDto.division;
    }
    if (updateDto.district !== undefined) {
      profile.district = updateDto.district;
    }
    if (updateDto.upazila !== undefined) {
      profile.upazila = updateDto.upazila;
    }
    if (updateDto.village !== undefined) {
      profile.village = updateDto.village;
    }
    if (updateDto.farmSizeAcres !== undefined) {
      profile.farmSizeAcres = updateDto.farmSizeAcres;
    }
    if (updateDto.description !== undefined) {
      profile.description = updateDto.description;
    }

    return this.farmerProfileRepository.save(profile);
  }
}
