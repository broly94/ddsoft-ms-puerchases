import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PedidoHistorico } from '../entities/pedido-historico.entity';

export interface ExtractedOrder {
  filename: string;
  razon_social: string | null;
  fecha_pedido: string | null;   // formato YYYY-MM-DD
  cod_proveedor: string | null;
  marca: string | null;
  raw_date: string | null;       // fecha tal como viene del PDF
  confidence: 'ok' | 'partial' | 'failed';
  error?: string;
}

@Injectable()
export class PdfImportService {
  private readonly logger = new Logger(PdfImportService.name);
  private genAI: GoogleGenerativeAI;

  constructor(
    @InjectRepository(PedidoHistorico)
    private readonly pedidoHistoricoRepository: Repository<PedidoHistorico>,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('GOOGLE_GEMINI_API_KEY');
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    } else {
      this.logger.error('GOOGLE_GEMINI_API_KEY no configurada');
    }
  }

  /**
   * Extrae los datos de un PDF de orden de compra usando Gemini Vision.
   */
  async extractFromPdf(filename: string, buffer: Buffer): Promise<ExtractedOrder> {
    if (!this.genAI) {
      return { filename, razon_social: null, fecha_pedido: null, cod_proveedor: null, marca: null, raw_date: null, confidence: 'failed', error: 'Gemini no configurado' };
    }

    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash-lite',
        generationConfig: { temperature: 0 },
      });

      const pdfBase64 = buffer.toString('base64');

      const prompt = `Analizá este PDF que es una orden de compra argentina. Extraé exactamente los siguientes campos:

                1. razon_social: El nombre del proveedor/empresa. SIEMPRE está en la primera línea de texto visible en la esquina superior izquierda del documento. Es el primer texto en negrita o destacado que aparece arriba a la izquierda, generalmente dentro de un cuadro gris u oscuro (ej: "SUDAMERICANA DE BEBIDAS SRL", "La rosquinense", "VERDE FLOR SA"). Copialo exactamente como aparece aunque esté incompleto o sin el sufijo legal (SRL, SA, S.A., etc.) — NO lo completes ni lo inventes. Si el texto está cortado, copiá solo lo que se ve.

                2. fecha_pedido: La fecha del pedido. Buscá el texto "fecha del pedido" o "fecha de pedido" en el documento. Suele estar en la esquina superior derecha con formato DD/MM/YYYY o D/M/YYYY (ej: "16/12/2025", "23/2/2025").

                3. cod_proveedor: El código del proveedor. Buscá en la columna llamada "cod prov" de la tabla de items. Si todos los valores son 0 o está vacío, devolvé null.

                4. marca: El valor de la columna "marca" de la tabla de items. Puede ser un número (ej: 361) o un nombre de marca (ej: "ARCOR", "VERDE FLOR"). Si hay varios valores distintos, tomá el primero que no sea 0 o vacío. Si la marca es un nombre de texto, preferilo sobre un código numérico.

                Respondé ÚNICAMENTE con un objeto JSON válido, sin explicaciones, sin markdown, sin bloques de código. Ejemplo exacto del formato:
                {"razon_social":"SUDAMERICANA DE BEBIDAS SRL","fecha_pedido":"16/12/2025","cod_proveedor":null,"marca":"361"}

                Si no podés encontrar un campo, usá null para ese campo.`;

      const result = await model.generateContent([
        {
          inlineData: {
            data: pdfBase64,
            mimeType: 'application/pdf',
          },
        },
        prompt,
      ]);

      const text = result.response.text().trim();

      // Limpiar posible markdown que Gemini agrega a veces
      const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(jsonStr);

      const rawDate = parsed.fecha_pedido || null;
      const fechaNormalizada = this.parseDate(rawDate);

      const confidence = parsed.razon_social && fechaNormalizada ? 'ok'
        : parsed.razon_social || fechaNormalizada ? 'partial'
          : 'failed';

      return {
        filename,
        razon_social: parsed.razon_social || null,
        fecha_pedido: fechaNormalizada,
        cod_proveedor: parsed.cod_proveedor ? String(parsed.cod_proveedor) : null,
        marca: parsed.marca ? String(parsed.marca) : null,
        raw_date: rawDate,
        confidence,
      };
    } catch (err) {
      this.logger.error(`Error procesando ${filename}: ${err.message}`);
      return {
        filename,
        razon_social: null,
        fecha_pedido: null,
        cod_proveedor: null,
        marca: null,
        raw_date: null,
        confidence: 'failed',
        error: err.message,
      };
    }
  }

  /**
   * Convierte DD/MM/YYYY o D/M/YYYY → YYYY-MM-DD.
   */
  private parseDate(raw: string | null): string | null {
    if (!raw) return null;
    const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;
    const [, d, m, y] = match;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  /**
   * Procesa un lote de PDFs en paralelo (máximo BATCH_SIZE concurrentes).
   */
  async extractBatch(files: { filename: string; buffer: Buffer }[]): Promise<ExtractedOrder[]> {
    const CONCURRENCY = 8;
    const results: ExtractedOrder[] = [];

    for (let i = 0; i < files.length; i += CONCURRENCY) {
      const batch = files.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(f => this.extractFromPdf(f.filename, f.buffer)),
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Guarda los registros confirmados en pedidos_historicos.
   * Evita duplicados por (razon_social + fecha_pedido).
   */
  async saveOrders(orders: Omit<ExtractedOrder, 'confidence' | 'error' | 'raw_date'>[]): Promise<{ saved: number; skipped: number }> {
    let saved = 0;
    let skipped = 0;

    for (const o of orders) {
      if (!o.razon_social || !o.fecha_pedido) { skipped++; continue; }

      // Verificar duplicado
      const exists = await this.pedidoHistoricoRepository.findOne({
        where: { razon_social: o.razon_social, fecha_pedido: new Date(o.fecha_pedido) as any },
      });
      if (exists) { skipped++; continue; }

      await this.pedidoHistoricoRepository.save(
        this.pedidoHistoricoRepository.create({
          razon_social: o.razon_social,
          fecha_pedido: new Date(o.fecha_pedido) as any,
          cod_proveedor: o.cod_proveedor,
          marca: o.marca,
        }),
      );
      saved++;
    }

    return { saved, skipped };
  }
}
