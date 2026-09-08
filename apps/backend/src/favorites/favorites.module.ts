import { Module } from '@nestjs/common';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';

@Module({
  controllers: [FavoritesController],
  providers: [FavoritesService],
  // FoodsService / MealsService read the favorite id-sets for their `isFavorite` flags; the
  // nutrition picker reads the lists for the Favoriten tab's ordering.
  exports: [FavoritesService],
})
export class FavoritesModule {}
