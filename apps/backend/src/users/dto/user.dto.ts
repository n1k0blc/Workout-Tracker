export class HomeGymDto {
  id: string;
  name: string;
  createdAt: Date;
}

export class UserDto {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: Date;
  height?: number;
  weight?: number;
  createdAt: Date;
  homeGyms?: HomeGymDto[];
  // Tagesziele (#152): manual daily targets, each null until the user sets it.
  targetKcal?: number | null;
  targetCarbs?: number | null;
  targetProtein?: number | null;
  targetFat?: number | null;
}
