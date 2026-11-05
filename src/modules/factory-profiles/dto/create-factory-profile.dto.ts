import { IsNotEmpty, IsOptional, IsString, Length } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateFactoryProfileDto {
  @ApiProperty({
    description: "Official factory name",
    example: "Panchagarh Tea Processing Ltd.",
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 200)
  factoryName!: string;

  @ApiProperty({
    description: "Representative contact person name",
    example: "Karim Hossain",
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 150)
  representativeName!: string;

  @ApiProperty({
    description: "District where factory is located",
    example: "Panchagarh",
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  district!: string;

  @ApiProperty({
    description: "Sub-district or Upazila/Thana",
    example: "Panchagarh Sadar",
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  upazila!: string;

  @ApiPropertyOptional({
    description: "Full factory street/location address",
    example: "123 Industrial Area, Panchagarh",
  })
  @IsOptional()
  @IsString()
  address?: string;
}
