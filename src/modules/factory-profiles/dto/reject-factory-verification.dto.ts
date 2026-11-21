import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsString, Length } from "class-validator";

export class RejectFactoryVerificationDto {
  @ApiProperty({
    description:
      "Reason for rejection, visible to the factory owner and admins",
    minLength: 1,
    maxLength: 1000,
  })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 1000)
  reason!: string;
}
