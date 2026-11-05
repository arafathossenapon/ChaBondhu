import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToOne,
  OneToMany,
} from "typeorm";
import { Role } from "@/common/enums/role.enum";
import { FarmerProfile } from "@/modules/farmer-profiles/entities/farmer-profile.entity";
import { FactoryProfile } from "@/modules/factory-profiles/entities/factory-profile.entity";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 150 })
  fullName!: string;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 255, unique: true })
  email!: string;

  @Column({ type: "varchar", length: 255 })
  passwordHash!: string;

  @Column({ type: "varchar", length: 20 })
  phoneNumber!: string;

  @Index()
  @Column({
    type: "varchar",
    length: 20,
    default: Role.GROWER,
  })
  role!: Role;

  @Index()
  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @OneToOne(() => FarmerProfile, (profile) => profile.user)
  farmerProfile?: FarmerProfile;

  @OneToOne(() => FactoryProfile, (profile) => profile.user)
  factoryProfile?: FactoryProfile;

  @OneToMany(() => FactoryProfile, (profile) => profile.verifiedByAdmin)
  verifiedFactories?: FactoryProfile[];

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
