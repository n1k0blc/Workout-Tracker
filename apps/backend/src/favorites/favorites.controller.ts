import { Controller, Post, Delete, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FavoritesService } from './favorites.service';

/**
 * Star / unstar a shared Lebensmittel or Mahlzeit (#148). Both verbs are idempotent, so the
 * optimistic client never has to reconcile a 409: POST twice stars once, DELETE of something
 * unstarred is a 204 no-op.
 */
@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Post('foods/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async starFood(@CurrentUser() user: { id: string }, @Param('id') id: string): Promise<void> {
    return this.favorites.setFoodFavorite(user.id, id, true);
  }

  @Delete('foods/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unstarFood(@CurrentUser() user: { id: string }, @Param('id') id: string): Promise<void> {
    return this.favorites.setFoodFavorite(user.id, id, false);
  }

  @Post('meals/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async starMeal(@CurrentUser() user: { id: string }, @Param('id') id: string): Promise<void> {
    return this.favorites.setMealFavorite(user.id, id, true);
  }

  @Delete('meals/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unstarMeal(@CurrentUser() user: { id: string }, @Param('id') id: string): Promise<void> {
    return this.favorites.setMealFavorite(user.id, id, false);
  }
}
