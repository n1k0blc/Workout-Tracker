import { IsIn, IsOptional } from 'class-validator';

/** `GET /meals`. `mine` narrows to the caller's own meals (the tab's "Nur meine" filter). */
export class MealsQueryDto {
  @IsOptional()
  @IsIn(['1', 'true', '0', 'false'])
  mine?: string;
}
