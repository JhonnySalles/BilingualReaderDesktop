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
const electron_1 = require("electron");
class Secrets {
    static _instance;
    animeListClientId = '';
    aniListClientId = '';
    aniListClientSecret = '';
    googleIdToken = '';
    googleOAuthClientId = '';
    googleOAuthClientSecret = '';
    firebaseApiKey = '';
    firebaseAuthDomain = '';
    firebaseProjectId = '';
    firebaseAppId = '';
    openRouterApiKey = '';
    sentryDsn = '';
    telemetryEnabled = false;
    sentryEnvironment = '';
    sentryTracesSampleRate = null;
    static get instance() {
        if (!this._instance) {
            this._instance = new Secrets();
        }
        return this._instance;
    }
    constructor() {
        this.loadSecrets();
    }
    isPackaged() {
        try {
            return !!electron_1.app?.isPackaged;
        }
        catch {
            return false;
        }
    }
    candidateRoots() {
        const roots = [process.cwd()];
        try {
            if (typeof process.resourcesPath === 'string' && process.resourcesPath) {
                roots.push(process.resourcesPath);
            }
        }
        catch {
            // ignore
        }
        try {
            if (electron_1.app) {
                roots.push(electron_1.app.getAppPath());
                if (!electron_1.app.isPackaged) {
                    roots.push(path.join(electron_1.app.getAppPath(), '..'));
                }
            }
        }
        catch {
            // app may be unavailable in some test contexts
        }
        try {
            roots.push(path.join(__dirname, '../..'));
            roots.push(path.join(__dirname, '../../..'));
        }
        catch {
            // ignore
        }
        return [...new Set(roots.filter(Boolean))];
    }
    /** Preferred env filenames: packaged → .env.production first; dev → .env first. */
    preferredEnvFiles() {
        if (this.isPackaged()) {
            return ['.env.production', '.env'];
        }
        return ['.env', '.env.production'];
    }
    loadSecrets() {
        try {
            const envNames = this.preferredEnvFiles();
            for (const root of this.candidateRoots()) {
                for (const name of envNames) {
                    const envPath = path.join(root, name);
                    if (fs.existsSync(envPath)) {
                        this.parseEnv(fs.readFileSync(envPath, 'utf-8'));
                        return;
                    }
                }
                const propsPath = path.join(root, 'secrets.properties');
                if (fs.existsSync(propsPath)) {
                    this.parseProperties(fs.readFileSync(propsPath, 'utf-8'));
                    return;
                }
            }
        }
        catch (e) {
            console.error('Error reading secrets:', e);
        }
    }
    parseBool(value) {
        const v = value.trim().toLowerCase();
        return v === '1' || v === 'true' || v === 'yes' || v === 'on';
    }
    applyKey(k, value) {
        switch (k) {
            case 'ANIME_LIST_CLIENT_ID':
            case 'MY_ANIME_LIST_CLIENT_ID':
                this.animeListClientId = value;
                break;
            case 'ANILIST_CLIENT_ID':
            case 'ANI_LIST_CLIENT_ID':
                this.aniListClientId = value;
                break;
            case 'ANILIST_CLIENT_SECRET':
            case 'ANI_LIST_CLIENT_SECRET':
                this.aniListClientSecret = value;
                break;
            case 'GOOGLE_ID_TOKEN':
                this.googleIdToken = value;
                break;
            case 'GOOGLE_OAUTH_CLIENT_ID':
                this.googleOAuthClientId = value;
                break;
            case 'GOOGLE_OAUTH_CLIENT_SECRET':
                this.googleOAuthClientSecret = value;
                break;
            case 'FIREBASE_API_KEY':
                this.firebaseApiKey = value;
                break;
            case 'FIREBASE_AUTH_DOMAIN':
                this.firebaseAuthDomain = value;
                break;
            case 'FIREBASE_PROJECT_ID':
                this.firebaseProjectId = value;
                break;
            case 'FIREBASE_APP_ID':
                this.firebaseAppId = value;
                break;
            case 'OPENROUTER_API_KEY':
                this.openRouterApiKey = value;
                break;
            case 'SENTRY_DSN':
                this.sentryDsn = value;
                break;
            case 'TELEMETRY_ENABLED':
                this.telemetryEnabled = this.parseBool(value);
                break;
            case 'SENTRY_ENVIRONMENT':
                this.sentryEnvironment = value;
                break;
            case 'SENTRY_TRACES_SAMPLE_RATE': {
                const n = Number(value);
                this.sentryTracesSampleRate = Number.isFinite(n) ? n : null;
                break;
            }
        }
    }
    parseEnv(content) {
        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#'))
                continue;
            const [key, ...valueParts] = trimmed.split('=');
            const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
            this.applyKey(key.trim(), value);
        }
    }
    parseProperties(content) {
        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!'))
                continue;
            const [key, ...valueParts] = trimmed.split('=');
            this.applyKey(key.trim(), valueParts.join('=').trim());
        }
    }
    getMyAnimeListClientId() {
        return this.animeListClientId;
    }
    getAniListClientId() {
        return this.aniListClientId;
    }
    getAniListClientSecret() {
        return this.aniListClientSecret;
    }
    getGoogleIdToken() {
        return this.googleIdToken;
    }
    getGoogleOAuthClientId() {
        return this.googleOAuthClientId || this.googleIdToken;
    }
    getGoogleOAuthClientSecret() {
        return this.googleOAuthClientSecret;
    }
    getFirebaseApiKey() {
        return this.firebaseApiKey;
    }
    getFirebaseAuthDomain() {
        return this.firebaseAuthDomain;
    }
    getFirebaseProjectId() {
        return this.firebaseProjectId;
    }
    getFirebaseAppId() {
        return this.firebaseAppId;
    }
    getOpenRouterApiKey() {
        return this.openRouterApiKey;
    }
    getSentryDsn() {
        return this.sentryDsn;
    }
    /** True only when TELEMETRY_ENABLED is on and a DSN is present. */
    isTelemetryEnabled() {
        return this.telemetryEnabled && !!this.sentryDsn.trim();
    }
    getSentryEnvironment() {
        if (this.sentryEnvironment.trim())
            return this.sentryEnvironment.trim();
        return this.isPackaged() ? 'production' : 'development';
    }
    getSentryTracesSampleRate() {
        if (this.sentryTracesSampleRate != null) {
            return Math.min(1, Math.max(0, this.sentryTracesSampleRate));
        }
        return this.isPackaged() ? 0.1 : 0;
    }
}
exports.Secrets = Secrets;
