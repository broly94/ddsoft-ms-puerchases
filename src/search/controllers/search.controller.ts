import { Controller, Get, Query, Logger } from '@nestjs/common';
import { QdrantService } from '../services/qdrant.service';

@Controller('internal-comparison')
export class SearchController {
  private readonly logger = new Logger(SearchController.name);

  constructor(private readonly qdrantService: QdrantService) {}

  @Get('search')
  async search(@Query('q') query: string) {
    if (!query) {
      return [];
    }
    this.logger.log(`Received search request: ${query}`);
    return await this.qdrantService.search(query);
  }
}
