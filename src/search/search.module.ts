import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmbeddingService } from './services/embedding.service';
import { QdrantService } from './services/qdrant.service';
import { SearchController } from './controllers/search.controller';

@Module({
  imports: [ConfigModule],
  providers: [EmbeddingService, QdrantService],
  controllers: [SearchController],
  exports: [QdrantService],
})
export class SearchModule {}
