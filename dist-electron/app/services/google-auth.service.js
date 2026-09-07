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
exports.GoogleAuthService = void 0;
const fs = __importStar(require("fs"));
const http = __importStar(require("http"));
const path = __importStar(require("path"));
const electron_1 = require("electron");
const google_auth_library_1 = require("google-auth-library");
const secrets_1 = require("../utils/secrets");
const SCOPES = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/drive'
];
class GoogleAuthService {
    static _instance;
    tokens = null;
    tokenPath;
    static get instance() {
        if (!this._instance) {
            this._instance = new GoogleAuthService();
        }
        return this._instance;
    }
    constructor() {
        const userData = electron_1.app ? electron_1.app.getPath('userData') : process.cwd();
        this.tokenPath = path.join(userData, 'google-oauth.json');
        this.loadTokens();
    }
    loadTokens() {
        try {
            if (fs.existsSync(this.tokenPath)) {
                this.tokens = JSON.parse(fs.readFileSync(this.tokenPath, 'utf-8'));
            }
        }
        catch (e) {
            console.error('[GoogleAuth] Failed to load tokens:', e);
            this.tokens = null;
        }
    }
    saveTokens(tokens) {
        this.tokens = tokens;
        try {
            fs.writeFileSync(this.tokenPath, JSON.stringify(tokens, null, 2), 'utf-8');
        }
        catch (e) {
            console.error('[GoogleAuth] Failed to save tokens:', e);
        }
    }
    isSignedIn() {
        return !!(this.tokens?.refresh_token || this.tokens?.access_token);
    }
    getEmail() {
        return this.tokens?.email ?? null;
    }
    getTokens() {
        return this.tokens;
    }
    createOAuthClient(redirectUri) {
        const secrets = secrets_1.Secrets.instance;
        const clientId = secrets.getGoogleOAuthClientId();
        const clientSecret = secrets.getGoogleOAuthClientSecret();
        if (!clientId || !clientSecret) {
            throw new Error('GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET missing in .env');
        }
        return new google_auth_library_1.OAuth2Client(clientId, clientSecret, redirectUri);
    }
    async getAuthenticatedClient() {
        if (!this.tokens?.refresh_token && !this.tokens?.access_token) {
            throw new Error('NOT_SIGN_IN');
        }
        const client = this.createOAuthClient();
        client.setCredentials({
            access_token: this.tokens.access_token ?? undefined,
            refresh_token: this.tokens.refresh_token ?? undefined,
            scope: this.tokens.scope ?? undefined,
            token_type: this.tokens.token_type ?? undefined,
            expiry_date: this.tokens.expiry_date ?? undefined,
            id_token: this.tokens.id_token ?? undefined
        });
        client.on('tokens', (fresh) => {
            const merged = {
                ...this.tokens,
                access_token: fresh.access_token ?? this.tokens?.access_token,
                refresh_token: fresh.refresh_token ?? this.tokens?.refresh_token,
                expiry_date: fresh.expiry_date ?? this.tokens?.expiry_date,
                id_token: fresh.id_token ?? this.tokens?.id_token,
                scope: fresh.scope ?? this.tokens?.scope,
                token_type: fresh.token_type ?? this.tokens?.token_type
            };
            this.saveTokens(merged);
        });
        // Force refresh if expired
        const expiry = this.tokens.expiry_date ?? 0;
        if (expiry && expiry < Date.now() + 60_000) {
            const { credentials } = await client.refreshAccessToken();
            this.saveTokens({
                ...this.tokens,
                access_token: credentials.access_token,
                refresh_token: credentials.refresh_token ?? this.tokens.refresh_token,
                expiry_date: credentials.expiry_date,
                id_token: credentials.id_token ?? this.tokens.id_token,
                scope: credentials.scope ?? this.tokens.scope,
                token_type: credentials.token_type ?? this.tokens.token_type
            });
            client.setCredentials(credentials);
        }
        return client;
    }
    async signIn() {
        const port = await this.findFreePort();
        const redirectUri = `http://127.0.0.1:${port}`;
        const client = this.createOAuthClient(redirectUri);
        const authUrl = client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: SCOPES
        });
        const code = await this.waitForAuthCode(port, authUrl);
        const { tokens } = await client.getToken(code);
        client.setCredentials(tokens);
        let email = null;
        if (tokens.id_token) {
            const ticket = await client.verifyIdToken({
                idToken: tokens.id_token,
                audience: secrets_1.Secrets.instance.getGoogleOAuthClientId() || secrets_1.Secrets.instance.getGoogleIdToken()
            }).catch(() => null);
            email = ticket?.getPayload()?.email || null;
        }
        if (!email && tokens.access_token) {
            email = await this.fetchEmail(tokens.access_token);
        }
        const stored = {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            scope: tokens.scope,
            token_type: tokens.token_type,
            expiry_date: tokens.expiry_date,
            id_token: tokens.id_token,
            email
        };
        // Exchange Google ID token for Firebase Auth (needed for Firestore)
        if (tokens.id_token && secrets_1.Secrets.instance.getFirebaseApiKey()) {
            try {
                const fb = await this.signInWithFirebase(tokens.id_token);
                stored.firebase_id_token = fb.idToken;
                stored.firebase_refresh_token = fb.refreshToken;
            }
            catch (e) {
                console.warn('[GoogleAuth] Firebase sign-in skipped:', e);
            }
        }
        this.saveTokens(stored);
        return { email: email || '' };
    }
    async signOut() {
        this.tokens = null;
        try {
            if (fs.existsSync(this.tokenPath)) {
                fs.unlinkSync(this.tokenPath);
            }
        }
        catch (e) {
            console.error('[GoogleAuth] Failed to delete tokens:', e);
        }
    }
    async getFirebaseIdToken() {
        if (!this.tokens)
            return null;
        if (this.tokens.firebase_id_token) {
            return this.tokens.firebase_id_token;
        }
        if (this.tokens.id_token && secrets_1.Secrets.instance.getFirebaseApiKey()) {
            try {
                const fb = await this.signInWithFirebase(this.tokens.id_token);
                this.saveTokens({
                    ...this.tokens,
                    firebase_id_token: fb.idToken,
                    firebase_refresh_token: fb.refreshToken
                });
                return fb.idToken;
            }
            catch {
                return null;
            }
        }
        return null;
    }
    async signInWithFirebase(googleIdToken) {
        const apiKey = secrets_1.Secrets.instance.getFirebaseApiKey();
        const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${apiKey}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                postBody: `id_token=${googleIdToken}&providerId=google.com`,
                requestUri: 'http://localhost',
                returnIdpCredential: true,
                returnSecureToken: true
            })
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Firebase signInWithIdp failed: ${res.status} ${text}`);
        }
        const data = (await res.json());
        return { idToken: data.idToken, refreshToken: data.refreshToken };
    }
    async fetchEmail(accessToken) {
        try {
            const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (!res.ok)
                return null;
            const data = (await res.json());
            return data.email ?? null;
        }
        catch {
            return null;
        }
    }
    findFreePort() {
        return new Promise((resolve, reject) => {
            const server = http.createServer();
            server.listen(0, '127.0.0.1', () => {
                const addr = server.address();
                if (addr && typeof addr === 'object') {
                    const port = addr.port;
                    server.close(() => resolve(port));
                }
                else {
                    server.close(() => reject(new Error('No free port')));
                }
            });
            server.on('error', reject);
        });
    }
    waitForAuthCode(port, authUrl) {
        return new Promise((resolve, reject) => {
            const server = http.createServer((req, res) => {
                try {
                    const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
                    const code = url.searchParams.get('code');
                    const error = url.searchParams.get('error');
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    if (error) {
                        res.end(`<html><body><h2>Login cancelado</h2><p>${error}</p><script>window.close()</script></body></html>`);
                        server.close();
                        reject(new Error(error));
                        return;
                    }
                    if (code) {
                        res.end('<html><body><h2>Login concluído</h2><p>Você pode fechar esta janela e voltar ao Bilingual Reader.</p><script>window.close()</script></body></html>');
                        server.close();
                        resolve(code);
                        return;
                    }
                    res.end('<html><body>Aguardando...</body></html>');
                }
                catch (e) {
                    server.close();
                    reject(e);
                }
            });
            server.listen(port, '127.0.0.1', () => {
                void electron_1.shell.openExternal(authUrl);
            });
            server.on('error', reject);
            setTimeout(() => {
                try {
                    server.close();
                }
                catch {
                    // ignore
                }
                reject(new Error('OAuth timeout'));
            }, 5 * 60_000);
        });
    }
}
exports.GoogleAuthService = GoogleAuthService;
