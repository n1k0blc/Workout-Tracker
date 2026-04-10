import { Module } from '@nestjs/common';
import { ORMService } from './orm.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ORMService],
  exports: [ORMService],
})
export class ORMModule {}
