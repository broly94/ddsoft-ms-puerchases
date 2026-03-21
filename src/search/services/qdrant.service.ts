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
    await this.ensureIndexes();
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

  private async ensureIndexes() {
    try {
      this.logger.log(`Recreating text index with prefix tokenizer for ${this.collectionName}`);
      // Eliminar índice anterior (puede tener tokenizer 'word') e ignorar si no existe
      try {
        await this.client.deletePayloadIndex(this.collectionName, 'texto_para_embedding');
      } catch (_) { /* no existía */ }

      await this.client.createPayloadIndex(this.collectionName, {
        field_name: 'texto_para_embedding',
        field_schema: {
          type: 'text',
          tokenizer: 'prefix',
          min_token_len: 2,
          max_token_len: 15,
          lowercase: true,
        },
      });
      this.logger.log(`Text index (prefix) created for ${this.collectionName}`);
    } catch (e) {
      this.logger.warn(`Could not recreate text index: ${e.message}`);
    }
  }

  // Cache de filtros disponibles (se invalida al reiniciar o cada 10 min)
  private filterCache: { rubros: string[]; marcas: string[]; pesos: string[]; cachedAt: number } | null = null;
  private readonly FILTER_CACHE_TTL_MS = 10 * 60 * 1000;

  async getFilterValues(): Promise<{ rubros: string[]; marcas: string[]; pesos: string[] }> {
    const now = Date.now();
    if (this.filterCache && now - this.filterCache.cachedAt < this.FILTER_CACHE_TTL_MS) {
      this.logger.log(`[FILTROS] Sirviendo desde cache (${this.filterCache.rubros.length} rubros, ${this.filterCache.marcas.length} marcas, ${this.filterCache.pesos.length} pesos)`);
      return { rubros: this.filterCache.rubros, marcas: this.filterCache.marcas, pesos: this.filterCache.pesos };
    }

    this.logger.log(`[FILTROS] Construyendo filtros desde colección Qdrant: ${this.collectionName}`);
    const rubros = new Set<string>();
    const marcas = new Set<string>();
    const pesos = new Set<string>();

    let offset: any = undefined;
    let page = 0;

    do {
      const result = await this.client.scroll(this.collectionName, {
        limit: 500,
        offset,
        with_payload: ['rubro_descripcion', 'marca', 'peso'],
        with_vector: false,
      });

      for (const point of result.points) {
        const p = point.payload as any;
        if (p?.rubro_descripcion) rubros.add(String(p.rubro_descripcion).trim());
        if (p?.marca) marcas.add(String(p.marca).trim());
        if (p?.peso) pesos.add(String(p.peso).trim());
      }

      offset = result.next_page_offset;
      page++;
    } while (offset != null);

    const sorted = (s: Set<string>) => Array.from(s).filter(Boolean).sort();
    const result = { rubros: sorted(rubros), marcas: sorted(marcas), pesos: sorted(pesos) };

    this.filterCache = { ...result, cachedAt: Date.now() };
    this.logger.log(`[FILTROS] Cache actualizado: ${result.rubros.length} rubros, ${result.marcas.length} marcas, ${result.pesos.length} pesos (${page} páginas)`);

    return result;
  }

  invalidateFilterCache() {
    this.filterCache = null;
    this.logger.log(`[FILTROS] Cache invalidado`);
  }

  // Misma lógica que DataNormalizerService.normalizeWeight() del ETL indexer
  private normalizeWeight(peso: string): string {
    if (!peso) return peso;
    const pesoStr = peso.toUpperCase().replace(/\s+/g, '').replace(',', '.');
    const normalized = pesoStr
      .replace(/KILOS?|KGS?|K$/, 'KG')
      .replace(/GRAMOS?|GRS?/, 'G')
      .replace(/LITROS?|LTS?/, 'L')
      .replace(/CC|CM3|MLITROS?/, 'ML');
    return normalized;
  }

  private cleanText(text: string): string {
    if (!text) return '';
    return text
      .toString()
      .trim()
      .replace(/[^a-zA-Z0-9\s,./-]/g, '')
      .replace(/\s{2,}/g, ' ');
  }

  private mapBrandAliases(brands: string[]): string[] {
    const results = [...brands];
    const upperBrands = brands.map(b => b.toUpperCase());

    if (upperBrands.some(b => b.includes('2 HERMANOS'))) {
      results.push('DOS HERMANOS');
    }
    if (upperBrands.some(b => b.includes('DOS HERMANOS'))) {
      results.push('2 HERMANOS');
    }
    return Array.from(new Set(results));
  }

  async search(query: string, filters?: { rubro_descripcion?: string[], marca?: string[], peso?: string[] }, limit: number = 20000) {
    try {
      const embedding = await this.embeddingService.generate(query);

      const mustConditions: any[] = [];

      // 1. FILTROS DE CATALOGO (RUBRO, MARCA, PESO)
      if (filters?.rubro_descripcion?.length > 0) {
        mustConditions.push({
          key: 'rubro_descripcion',
          match: { any: filters.rubro_descripcion.map(f => this.cleanText(f)) }
        });
      }

      if (filters?.marca?.length > 0) {
        const brandNames = this.mapBrandAliases(filters.marca);
        const cleanedBrands = brandNames.map(f => this.cleanText(f));
        const allBrandVariants = Array.from(new Set([...brandNames, ...cleanedBrands]));

        mustConditions.push({
          key: 'marca',
          match: { any: allBrandVariants }
        });
      }

      if (filters?.peso?.length > 0) {
        mustConditions.push({
          key: 'peso',
          match: { any: filters.peso.map(f => this.normalizeWeight(this.cleanText(f))) }
        });
      }

      // 2. FILTRO DE PALABRAS CLAVE con tokenizer prefix
      const keywords = query.toUpperCase()
        .replace(/[^A-Z0-9\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length >= 2);

      const keywordConditions: any[] = [];
      keywords.forEach(word => {
        keywordConditions.push({
          key: 'texto_para_embedding',
          match: { text: word }
        });
      });

      const catalogConditions = [...mustConditions]; // solo rubro/marca/peso
      const fullConditions = [...mustConditions, ...keywordConditions];

      const hasFullFilters = fullConditions.length > 0;
      const hasCatalogFilters = catalogConditions.length > 0;

      this.logger.log(`[QDRANT] Busqueda estricta (AND): "${keywords.join(' + ')}". Filtros: ${fullConditions.length}`);

      let results = await this.client.search(this.collectionName, {
        vector: embedding,
        limit,
        filter: hasFullFilters ? { must: fullConditions } : undefined,
        with_payload: true,
        with_vector: false,
      });

      // Fallback: si no hay resultados con keywords, reintentar solo con filtros de catálogo + vector
      if (results.length === 0 && keywordConditions.length > 0) {
        this.logger.log(`[QDRANT] Sin resultados con keywords, reintentando solo con vector + filtros catálogo`);
        results = await this.client.search(this.collectionName, {
          vector: embedding,
          limit,
          filter: hasCatalogFilters ? { must: catalogConditions } : undefined,
          with_payload: true,
          with_vector: false,
        });
        this.logger.log(`[QDRANT] Fallback completado: ${results.length} resultados encontrados.`);
      }

      this.logger.log(`[QDRANT] Busqueda completada: ${results.length} resultados encontrados.`);
      return results;
    } catch (error) {
      this.logger.error(`Error searching in Qdrant: ${error.message}`);
      throw error;
    }
  }
}
