"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EdgeTtsService = void 0;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const electron_1 = require("electron");
const msedge_tts_1 = require("msedge-tts");
const tts_enums_1 = require("../../../src/app/core/models/enums/tts-enums");
const PREFETCH_LIMIT = 3;
class EdgeTtsService {
    lastVoice = '';
    lastFormatReady = false;
    tts = null;
    inflight = new Map();
    getCacheRoot() {
        return path.join(electron_1.app.getPath('userData'), 'cache', 'audio');
    }
    ensureCacheDir() {
        const dir = this.getCacheRoot();
        fs.mkdirSync(dir, { recursive: true });
        return dir;
    }
    cacheKey(text, voice, rate) {
        const normalizedRate = Math.max(-50, Math.min(50, Math.round((rate || 0) / 5) * 5));
        return crypto
            .createHash('md5')
            .update(`${voice}|${normalizedRate}|${text}`)
            .digest('hex');
    }
    async synthesize(req) {
        const text = (req.text || '').replace(/\s+/g, ' ').trim();
        if (!text) {
            throw new Error('Texto vazio para TTS');
        }
        const voice = (req.voice || 'pt-BR-FranciscaNeural').trim();
        const rate = Math.max(-50, Math.min(50, Math.round((req.rate ?? 0) / 5) * 5));
        const key = this.cacheKey(text, voice, rate);
        const existing = this.inflight.get(key);
        if (existing)
            return existing;
        const job = this.synthesizeInternal(text, voice, rate, key);
        this.inflight.set(key, job);
        try {
            return await job;
        }
        finally {
            this.inflight.delete(key);
        }
    }
    async prefetch(items) {
        const slice = (items || []).slice(0, PREFETCH_LIMIT);
        const out = [];
        for (const item of slice) {
            try {
                out.push(await this.synthesize(item));
            }
            catch (e) {
                console.warn('[EdgeTts] prefetch failed', e);
            }
        }
        return out;
    }
    clearCache() {
        const dir = this.getCacheRoot();
        if (!fs.existsSync(dir))
            return true;
        try {
            for (const name of fs.readdirSync(dir)) {
                try {
                    fs.rmSync(path.join(dir, name), { force: true });
                }
                catch { }
            }
            return true;
        }
        catch (e) {
            console.warn('[EdgeTts] clearCache failed', e);
            return false;
        }
    }
    async synthesizeInternal(text, voice, rate, key) {
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
        const rateStr = (0, tts_enums_1.ttsRateToEdge)(rate);
        const result = await client.toFile(dir, text, { rate: rateStr });
        const generated = result.audioFilePath;
        if (!generated || !fs.existsSync(generated)) {
            throw new Error('Falha ao gerar áudio TTS');
        }
        if (path.resolve(generated) !== path.resolve(filePath)) {
            try {
                if (fs.existsSync(filePath))
                    fs.rmSync(filePath, { force: true });
                fs.renameSync(generated, filePath);
            }
            catch {
                fs.copyFileSync(generated, filePath);
                try {
                    fs.rmSync(generated, { force: true });
                }
                catch { }
            }
        }
        return {
            audioUrl: this.toDataUrl(filePath),
            cacheKey: key,
            voice,
            rate
        };
    }
    async ensureClient(voice) {
        if (!this.tts) {
            this.tts = new msedge_tts_1.MsEdgeTTS({ enableLogger: false });
        }
        if (!this.lastFormatReady || this.lastVoice !== voice) {
            await this.tts.setMetadata(voice, msedge_tts_1.OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
            this.lastVoice = voice;
            this.lastFormatReady = true;
        }
        return this.tts;
    }
    toDataUrl(filePath) {
        const buf = fs.readFileSync(filePath);
        return `data:audio/mpeg;base64,${buf.toString('base64')}`;
    }
}
exports.EdgeTtsService = EdgeTtsService;
