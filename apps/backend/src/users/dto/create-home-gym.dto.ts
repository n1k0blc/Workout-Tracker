import { IsString, MaxLength } from 'class-validator';

export class CreateHomeGymDto {
  @IsString()
  @MaxLength(100, { message: 'Gym name must not exceed 100 characters' })
  name: string;
}
