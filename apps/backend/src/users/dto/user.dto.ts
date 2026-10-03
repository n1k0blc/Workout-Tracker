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
  // Locale tracer bullet (#179): drives next-intl routing/UI. foodMarket
  // also exists on User but stays off this DTO until a second market exists.
  locale: ApiLocale;
  // Weight unit system (#186): display-only preference; storage stays canonical kg.
  unitSystem: 'METRIC' | 'IMPERIAL';
  // Tagesziele (#152): manual daily targets, each null until the user sets it.
  targetKcal?: number | null;
  targetCarbs?: number | null;
  targetProtein?: number | null;
  targetFat?: number | null;
}
