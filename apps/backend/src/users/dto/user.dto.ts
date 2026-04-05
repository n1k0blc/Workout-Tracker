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
}
