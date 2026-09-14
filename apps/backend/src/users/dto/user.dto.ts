import { ApiLocale } from '../../common/utils/locale.util';

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
  // Locale tracer bullet (#179): drives next-intl routing/UI. unitSystem and foodMarket
  // also exist on User but stay off this DTO until they get their own UI (unitSystem)
  // or a second market (foodMarket).
  locale: ApiLocale;
  // Tagesziele (#152): manual daily targets, each null until the user sets it.
  targetKcal?: number | null;
  targetCarbs?: number | null;
  targetProtein?: number | null;
  targetFat?: number | null;
}
