import { IsString, MaxLength } from 'class-validator';

export class UpdateHomeGymDto {
  @IsString()
  @MaxLength(100)
  name: string;
}
