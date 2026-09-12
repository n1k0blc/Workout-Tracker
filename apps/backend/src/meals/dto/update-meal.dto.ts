import { CreateMealDto } from './create-meal.dto';

/**
 * Updates a Mahlzeit. Same shape as create -- name and the full item list are always sent,
 * and the item list is rewritten wholesale (delete all, recreate from the payload) so
 * `order` stays contiguous from array position.
 */
export class UpdateMealDto extends CreateMealDto {}
