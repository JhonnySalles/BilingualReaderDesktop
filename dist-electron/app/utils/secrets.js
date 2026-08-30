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
exports.Secrets = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class Secrets {
    static _instance;
    animeListClientId = '';
    googleIdToken = '';
    openRouterApiKey = '';
    static get instance() {
        if (!this._instance) {
            this._instance = new Secrets();
        }
        return this._instance;
    }
    constructor() {
        this.loadSecrets();
    }
    loadSecrets() {
        try {
            // Look for .env or secrets.properties in process cwd or app root
            const rootPath = process.cwd();
            const envPath = path.join(rootPath, '.env');
            const propsPath = path.join(rootPath, 'secrets.properties');
            if (fs.existsSync(envPath)) {
                const content = fs.readFileSync(envPath, 'utf-8');
                this.parseEnv(content);
            }
            else if (fs.existsSync(propsPath)) {
                const content = fs.readFileSync(propsPath, 'utf-8');
                this.parseProperties(content);
            }
        }
        catch (e) {
            console.error('Error reading secrets:', e);
        }
    }
    parseEnv(content) {
        const lines = content.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#'))
                continue;
            const [key, ...valueParts] = trimmed.split('=');
            const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
            const k = key.trim();
            if (k === 'ANIME_LIST_CLIENT_ID' || k === 'MY_ANIME_LIST_CLIENT_ID') {
                this.animeListClientId = value;
            }
            else if (k === 'GOOGLE_ID_TOKEN') {
                this.googleIdToken = value;
            }
            else if (k === 'OPENROUTER_API_KEY') {
                this.openRouterApiKey = value;
            }
        }
    }
    parseProperties(content) {
        const lines = content.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!'))
                continue;
            const [key, ...valueParts] = trimmed.split('=');
            const value = valueParts.join('=').trim();
            const k = key.trim();
            if (k === 'ANIME_LIST_CLIENT_ID') {
                this.animeListClientId = value;
            }
            else if (k === 'GOOGLE_ID_TOKEN') {
                this.googleIdToken = value;
            }
            else if (k === 'OPENROUTER_API_KEY') {
                this.openRouterApiKey = value;
            }
        }
    }
    getMyAnimeListClientId() {
        return this.animeListClientId;
    }
    getGoogleIdToken() {
        return this.googleIdToken;
    }
    getOpenRouterApiKey() {
        return this.openRouterApiKey;
    }
}
exports.Secrets = Secrets;
