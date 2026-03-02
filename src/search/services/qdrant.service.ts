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
        this.logger.log(`Creating collection ${this.collectionName} with 1024 dimensions...`);
        await this.client.createCollection(this.collectionName, {
          vectors: { 
            size: this.embeddingService.getDimensions(), 
            distance: 'Cosine' 
          },
        });
        this.logger.log('✅ Collection created successfully');
      }
    } catch (error) {
      this.logger.error('❌ Error checking/creating Qdrant collection:', error);
    }
  }

  async search(query: string, limit: number = 10) {
    try {
      this.logger.log(`Performing semantic search for: ${query}`);
      const embedding = await this.embeddingService.generate(query);
      this.logger.log(`Generated embedding of size: ${embedding.length}`);
      
      const results = await this.client.search(this.collectionName, {
        vector: embedding,
        limit,
        with_payload: true,
        with_vector: false,
      });

      this.logger.log(`Search returned ${results.length} results`);
      return results;
    } catch (error) {
      this.logger.error(`Error searching in Qdrant for query: ${query}`, error);
      // Log more detail if available
      if (error.status) {
        this.logger.error(`Qdrant error status: ${error.status}, message: ${JSON.stringify(error.data)}`);
      }
      throw error;
    }
  }
}
