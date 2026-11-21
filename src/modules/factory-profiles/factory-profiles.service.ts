import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { FactoryProfile } from "./entities/factory-profile.entity";
import { CreateFactoryProfileDto } from "./dto/create-factory-profile.dto";
import { UpdateFactoryProfileDto } from "./dto/update-factory-profile.dto";
import { Role } from "@/common/enums/role.enum";

@Injectable()
export class FactoryProfilesService {
  constructor(
    @InjectRepository(FactoryProfile)
    private readonly factoryProfileRepository: Repository<FactoryProfile>,
  ) {}

  async create(
    userId: number,
    role: Role,
    createDto: CreateFactoryProfileDto,
  ): Promise<FactoryProfile> {
    if (role !== Role.FACTORY) {
      throw new ForbiddenException(
        "Only users with FACTORY role can create a factory profile",
      );
    }

    const existingProfile = await this.factoryProfileRepository.findOne({
      where: { userId },
    });

    if (existingProfile) {
      throw new ConflictException("Factory profile already exists for this user");
    }

    const profile = this.factoryProfileRepository.create({
      ...createDto,
      userId,
    });

    return this.factoryProfileRepository.save(profile);
  }

  async getOwnProfile(userId: number): Promise<FactoryProfile> {
    const profile = await this.factoryProfileRepository.findOne({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException("Factory profile not found for this user");
    }

    return profile;
  }

  async findById(id: number): Promise<FactoryProfile> {
    const profile = await this.factoryProfileRepository.findOne({
      where: { id },
    });

    if (!profile) {
      throw new NotFoundException(`Factory profile with ID ${id} not found`);
    }

    return profile;
  }

  async updateOwnProfile(
    userId: number,
    updateDto: UpdateFactoryProfileDto,
  ): Promise<FactoryProfile> {
    const { factoryName, representativeName, district, upazila, address } = updateDto;
    const changes = { factoryName, representativeName, district, upazila, address };
    if (Object.values(changes).some((value) => value !== undefined)) {
      // শুধু প্রোফাইলের তথ্য বদলায়, একই সময়ে অ্যাডমিনের সিদ্ধান্ত বদলায় না।
      await this.factoryProfileRepository.update({ userId }, changes);
    }
    return this.getOwnProfile(userId);
  }
}
