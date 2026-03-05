import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { EmbeddingService } from './embedding.service';

@Injectable()
export class QdrantService implements OnModuleInit {
  private readonly logger = new Logger(QdrantService.name);
  private client: QdrantClient;
  public readonly collectionName = 'purchases_products';

  constructor(
    private configService: ConfigService,
    private embeddingService: EmbeddingService,
  ) { }

  async onModuleInit() {
    const url = this.configService.get<string>('QDRANT_URL') || 'http://qdrant_db:6333';
    this.logger.log(`Initializing Qdrant client with URL: ${url}`);
    this.client = new QdrantClient({ url });

    await this.ensureCollectionExists();
  }

  private async ensureCollectionExists() {
    try {
      const collections = await this.client.getCollections();
      const exists = collections.collections.find(
        (c) => c.name === this.collectionName,
      );

      if (!exists) {
        this.logger.log(`Creating collection ${this.collectionName}`);
        await this.client.createCollection(this.collectionName, {
          vectors: { 
            size: this.embeddingService.getDimensions(), 
            distance: 'Cosine' 
          },
        });
      }
    } catch (error) {
      this.logger.error('Error checking/creating Qdrant collection:', error);
    }
  }

  private cleanText(text: string): string {
    if (!text) return '';
    // Mismo algoritmo que el indexador
    return text
      .toString()
      .trim()
      .replace(/[^a-zA-Z0-9\sÃ±Ã‘,./-]/g, '')
      .replace(/\s{2,}/g, ' ');
  }

  // Mapeo especial para inconsistencias en marcas (ej: 2 vs DOS)
  private mapBrandAliases(brands: string[]): string[] {
    const results = [...brands];
    if (brands.some(b => b.toUpperCase().includes('2 HERMANOS'))) {
      results.push('DOS HERMANOS');
    }
    if (brands.some(b => b.toUpperCase().includes('DOS HERMANOS'))) {
      results.push('2 HERMANOS');
    }
    return Array.from(new Set(results));
  }

  async search(query: string, filters?: { rubro_descripcion?: string[], marca?: string[], peso?: string[] }, limit: number = 20000) {
    try {
      const embedding = await this.embeddingService.generate(query);

      const mustConditions: any[] = [];
      
      if (filters?.rubro_descripcion?.length > 0) {
        mustConditions.push({
          key: 'rubro_descripcion',
          match: { any: filters.rubro_descripcion.map(f => this.cleanText(f)) }
        });
      }

      if (filters?.marca?.length > 0) {
        const brandNames = this.mapBrandAliases(filters.marca);
        mustConditions.push({
          key: 'marca',
          match: { any: brandNames.map(f => this.cleanText(f)) }
        });
      }

      if (filters?.peso?.length > 0) {
        mustConditions.push({
          key: 'peso',
          match: { any: filters.peso.map(f => this.cleanText(f)) }
        });
      }

      const hasFilters = mustConditions.length > 0;
      
      this.logger.log(`[QDRANT] Ejecutando bÃºsqueda con ${mustConditions.length} filtros activos. LÃ­mite: ${limit}`);

      // Usamos bÃºsqueda semÃ¡ntica pero con filtros estrictos OBLIGATORIOS (must)
      const results = await this.client.search(this.collectionName, {
        vector: embedding,
        limit,
        filter: hasFilters ? { must: mustConditions } : undefined,
        with_payload: true,
        with_vector: false,
        params: {
          exact: true, // Forzamos bÃºsqueda exacta para filtros
        }
      });

      this.logger.log(`[QDRANT] BÃºsqueda completada: ${results.length} resultados encontrados.`);
      return results;
    } catch (error) {
      this.logger.error(`Error searching in Qdrant: ${error.message}`);
      throw error;
    }
  }
}
