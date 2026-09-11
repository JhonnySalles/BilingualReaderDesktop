import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { ttsRateToEdge } from '../../../src/app/core/models/enums/tts-enums';
import { getAppCacheDir } from '../../utils/app-paths';

export interface TtsSynthesizeRequest {
  text: string;
  voice: string;
  rate?: number;
}

export interface TtsSynthesizeResult {
  audioUrl: string;
  cacheKey: string;
  voice: string;
  rate: number;
}

const PREFETCH_LIMIT = 3;

export class EdgeTtsService {
  private lastVoice = '';
  private lastFormatReady = false;
  private tts: MsEdgeTTS | null = null;
  private inflight = new Map<string, Promise<TtsSynthesizeResult>>();

  getCacheRoot(): string {
    return path.join(getAppCacheDir(), 'audio');
  }

  ensureCacheDir(): string {
    const dir = this.getCacheRoot();
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  cacheKey(text: string, voice: string, rate: number): string {
    const normalizedRate = Math.max(-50, Math.min(50, Math.round((rate || 0) / 5) * 5));
    return crypto
      .createHash('md5')
      .update(`${voice}|${normalizedRate}|${text}`)
      .digest('hex');
  }

  async synthesize(req: TtsSynthesizeRequest): Promise<TtsSynthesizeResult> {
    const text = (req.text || '').replace(/\s+/g, ' ').trim();
    if (!text) {
      throw new Error('Texto vazio para TTS');
    }
    const voice = (req.voice || 'pt-BR-FranciscaNeural').trim();
    const rate = Math.max(-50, Math.min(50, Math.round((req.rate ?? 0) / 5) * 5));
    const key = this.cacheKey(text, voice, rate);

    const existing = this.inflight.get(key);
    if (existing) return existing;

    const job = this.synthesizeInternal(text, voice, rate, key);
    this.inflight.set(key, job);
    try {
      return await job;
    } finally {
      this.inflight.delete(key);
    }
  }

  async prefetch(items: TtsSynthesizeRequest[]): Promise<TtsSynthesizeResult[]> {
    const slice = (items || []).slice(0, PREFETCH_LIMIT);
    const out: TtsSynthesizeResult[] = [];
    for (const item of slice) {
      try {
        out.push(await this.synthesize(item));
      } catch (e) {
        console.warn('[EdgeTts] prefetch failed', e);
      }
    }
    return out;
  }

  clearCache(): boolean {
    const dir = this.getCacheRoot();
    if (!fs.existsSync(dir)) return true;
    try {
      for (const name of fs.readdirSync(dir)) {
        try {
          fs.rmSync(path.join(dir, name), { force: true });
        } catch {}
      }
      return true;
    } catch (e) {
      console.warn('[EdgeTts] clearCache failed', e);
      return false;
    }
  }

  private async synthesizeInternal(
    text: string,
    voice: string,
    rate: number,
    key: string
  ): Promise<TtsSynthesizeResult> {
    const dir = this.ensureCacheDir();
    const filePath = path.join(dir, `${key}.mp3`);
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
      return {
        audioUrl: this.toDataUrl(filePath),
        cacheKey: key,
        voice,
        rate
      };
    }

    const client = await this.ensureClient(voice);
    const rateStr = ttsRateToEdge(rate);
    const result = await client.toFile(dir, text, { rate: rateStr });
    const generated = result.audioFilePath;
    if (!generated || !fs.existsSync(generated)) {
      throw new Error('Falha ao gerar áudio TTS');
    }

    if (path.resolve(generated) !== path.resolve(filePath)) {
      try {
        if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true });
        fs.renameSync(generated, filePath);
      } catch {
        fs.copyFileSync(generated, filePath);
        try {
          fs.rmSync(generated, { force: true });
        } catch {}
      }
    }

    return {
      audioUrl: this.toDataUrl(filePath),
      cacheKey: key,
      voice,
      rate
    };
  }

  private async ensureClient(voice: string): Promise<MsEdgeTTS> {
    if (!this.tts) {
      this.tts = new MsEdgeTTS({ enableLogger: false });
    }
    if (!this.lastFormatReady || this.lastVoice !== voice) {
      await this.tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      this.lastVoice = voice;
      this.lastFormatReady = true;
    }
    return this.tts;
  }

  private toDataUrl(filePath: string): string {
    const buf = fs.readFileSync(filePath);
    return `data:audio/mpeg;base64,${buf.toString('base64')}`;
  }
}
