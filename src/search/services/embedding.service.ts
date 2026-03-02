import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { pipeline } from '@huggingface/transformers';
import * as path from 'path';

@Injectable()
export class EmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingService.name);
  private embedder: any;
  // Cambiamos al modelo más ligero y compatible (80MB)
  private readonly modelName = 'Xenova/all-MiniLM-L6-v2';
  private readonly cacheDir = path.join(process.cwd(), 'model_cache');

  async onModuleInit() {
    this.logger.log(`Initializing Local Embedding Service (MiniLM-L12)`);
    try {
      this.embedder = await pipeline('feature-extraction', this.modelName, {
        cache_dir: this.cacheDir,
        device: 'cpu',
        quantized: true,
      } as any);
      this.logger.log('✅ Local Embedding Service initialized (384d)');
    } catch (error) {
      this.logger.error('❌ Error initializing local embedding model:', error);
    }
  }

  async generate(text: string): Promise<number[]> {
    if (!this.embedder) {
      throw new Error('Embedding model not initialized');
    }

    try {
      const output = await this.embedder(text, { pooling: 'mean', normalize: true });
      return Array.from(output.data);
    } catch (error) {
      this.logger.error(`Error generating local embedding for: ${text}`, error);
      throw error;
    }
  }

  getDimensions(): number {
    return 384; // Dimensión de MiniLM-L12
  }
}
