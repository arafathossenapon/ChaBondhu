import { IsOptional, IsString, Length } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateFactoryProfileDto {
  @ApiPropertyOptional({
    description: "Official factory name",
    example: "Panchagarh Premium Tea Processing Ltd.",
  })
  @IsOptional()
  @IsString()
  @Length(2, 200)
  factoryName?: string;

  @ApiPropertyOptional({
    description: "Representative contact person name",
    example: "Karim Ahmed",
  })
  @IsOptional()
  @IsString()
  @Length(2, 150)
  representativeName?: string;

  @ApiPropertyOptional({
    description: "District where factory is located",
    example: "Panchagarh",
  })
  @IsOptional()
  @IsString()
  @Length(2, 100)
  district?: string;

  @ApiPropertyOptional({
    description: "Sub-district or Upazila/Thana",
    example: "Tetulia",
  })
  @IsOptional()
  @IsString()
  @Length(2, 100)
  upazila?: string;

  @ApiPropertyOptional({
    description: "Full factory street/location address",
    example: "Updated Industrial Area, Panchagarh",
  })
  @IsOptional()
  @IsString()
  address?: string;
}
