import { IsOptional } from 'class-validator';
import { SearchTerm } from '../../common/validation/field-rules';

/** `GET /foods`: the Lebensmittel search. */
export class FoodsQueryDto {
  @IsOptional()
  @SearchTerm()
  search?: string;
}

/** `GET /foods/similar`: the name typed into the editor, checked against existing foods. */
export class SimilarFoodsQueryDto {
  @IsOptional()
  @SearchTerm()
  name?: string;
}
