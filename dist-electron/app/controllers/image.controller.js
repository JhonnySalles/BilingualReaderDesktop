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
exports.ImageController = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const https = __importStar(require("https"));
const http = __importStar(require("http"));
const electron_1 = require("electron");
class ImageController {
    static _instance;
    static get instance() {
        if (!this._instance) {
            this._instance = new ImageController();
        }
        return this._instance;
    }
    getCacheDir() {
        const userData = electron_1.app ? electron_1.app.getPath('userData') : process.cwd();
        const cacheDir = path.join(userData, 'cache', 'images');
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }
        return cacheDir;
    }
    generateHash(url) {
        return crypto.createHash('md5').update(url).digest('hex');
    }
    async getImageFromUrl(url) {
        if (!url || url === 'null')
            return null;
        const hash = this.generateHash(url);
        const cacheDir = this.getCacheDir();
        const cachedFilePath = path.join(cacheDir, hash);
        if (fs.existsSync(cachedFilePath)) {
            return cachedFilePath;
        }
        return new Promise((resolve) => {
            const client = url.startsWith('https') ? https : http;
            client.get(url, (res) => {
                if (res.statusCode !== 200) {
                    resolve(null);
                    return;
                }
                const data = [];
                res.on('data', (chunk) => data.push(chunk));
                res.on('end', () => {
                    const buffer = Buffer.concat(data);
                    fs.writeFileSync(cachedFilePath, buffer);
                    resolve(cachedFilePath);
                });
            }).on('error', () => {
                resolve(null);
            });
        });
    }
}
exports.ImageController = ImageController;
