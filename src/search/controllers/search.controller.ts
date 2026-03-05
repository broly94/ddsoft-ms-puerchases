import { Controller, Get, Query, Logger } from '@nestjs/common';
import { QdrantService } from '../services/qdrant.service';

@Controller('internal-comparison')
export class SearchController {
  private readonly logger = new Logger(SearchController.name);

  constructor(private readonly qdrantService: QdrantService) {}

  @Get('search')
  async search(
    @Query('q') query: string,
    @Query('rubro') rubro?: string | string[],
    @Query('marca') marca?: string | string[],
    @Query('peso') peso?: string | string[],
    @Query('limit') limit: number = 20000
  ) {
    if (!query) {
      return [];
    }

    const toArray = (val: any): string[] => {
      if (!val) return [];
      return Array.isArray(val) ? val : [val];
    };
    
    const filters = {
      rubro_descripcion: toArray(rubro),
      marca: toArray(marca),
      peso: toArray(peso)
    };

    // LOG CRITICO PARA VERIFICAR QUE LLEGAN FILTROS
    this.logger.log(`[BUSQUEDA] Query: "${query}" | Filtros: ${JSON.stringify(filters)}`);
    
    // FORZAMOS QUE LIMIT SEA UN NUMERO (USIZE) PARA QDRANT
    const numericLimit = Number(limit) || 20000;
    
    return await this.qdrantService.search(query, filters, numericLimit);
  }
}
