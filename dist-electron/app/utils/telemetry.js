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
exports.Telemetry = void 0;
const Sentry = __importStar(require("@sentry/electron/main"));
const secrets_1 = require("./secrets");
/**
 * Centralized error reporting — mirrors Android Telemetry.kt (Sentry only on desktop).
 */
class Telemetry {
    static initialized = false;
    static enabled = false;
    static get isEnabled() {
        return this.enabled;
    }
    /** Call once as early as possible in the Electron main process. */
    static init() {
        if (this.initialized)
            return;
        this.initialized = true;
        const secrets = secrets_1.Secrets.instance;
        this.enabled = secrets.isTelemetryEnabled();
        if (!this.enabled) {
            return;
        }
        const dsn = secrets.getSentryDsn().trim();
        const environment = secrets.getSentryEnvironment();
        const tracesSampleRate = secrets.getSentryTracesSampleRate();
        Sentry.init({
            dsn,
            environment,
            tracesSampleRate,
            // Avoid Sentry debug console noise unless explicitly testing.
            debug: false,
            beforeSend(event) {
                if (!Telemetry.enabled)
                    return null;
                const exception = event.exception?.values?.[0];
                const value = exception?.value || '';
                // Mirror Android: drop noisy gateway timeouts from third-party HTTP.
                if (exception?.type === 'SentryHttpClientException' &&
                    typeof value === 'string' &&
                    value.includes('504')) {
                    return null;
                }
                return event;
            }
        });
    }
    static recordException(error, message) {
        if (!this.enabled) {
            const detail = message || (error instanceof Error ? error.message : String(error));
            console.warn(`[Telemetry] disabled. Exception ignored: ${detail}`);
            return;
        }
        try {
            const err = this.toError(error);
            Sentry.withScope(scope => {
                if (message) {
                    scope.setExtra('message', message);
                }
                Sentry.captureException(err);
            });
        }
        catch (ex) {
            console.error('[Telemetry] Failed to record exception:', ex?.message || ex);
        }
    }
    static setCustomKey(key, value) {
        if (!this.enabled)
            return;
        try {
            Sentry.setTag(key, value);
        }
        catch (ex) {
            console.error('[Telemetry] Failed to set custom key:', ex?.message || ex);
        }
    }
    /** Reconstruct Error from IPC payload. */
    static fromSerialized(payload) {
        const err = new Error(payload.message || 'Unknown error');
        if (payload.name)
            err.name = payload.name;
        if (payload.stack)
            err.stack = payload.stack;
        return err;
    }
    static toSerialized(error) {
        const err = this.toError(error);
        return { name: err.name, message: err.message, stack: err.stack };
    }
    static toError(error) {
        if (error instanceof Error)
            return error;
        if (typeof error === 'string')
            return new Error(error);
        try {
            return new Error(JSON.stringify(error));
        }
        catch {
            return new Error(String(error));
        }
    }
}
exports.Telemetry = Telemetry;
