import { CreateFoodDto } from './create-food.dto';

/**
 * A full replace of an editable USER food -- the editor always submits every field, and the
 * portion list is rewritten wholesale (same as the workout tree). `source` / `createdById`
 * are never editable.
 */
export class UpdateFoodDto extends CreateFoodDto {}
