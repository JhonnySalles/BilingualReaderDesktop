import { ipcMain } from 'electron';
import { LlmTranslateService, LlmTranslateRequest } from '../services/llm/llm-translate.service';
import { OpenRouterError } from '../services/llm/openrouter-client';
import { OpenAiCompatError } from '../services/llm/openai-compat-client';
import {
  LlmProviderId,
  llmProviderRouter,
  normalizeLlmProvider
} from '../services/llm/llm-provider-router';
import { SettingsService } from '../services/settings.service';
import { GeneralConsts } from '../utils/constants';

export class LlmController {
  private service = new LlmTranslateService();

  registerIpcHandlers(): void {
    ipcMain.handle('llm:status', async () => this.service.status());

    ipcMain.handle('ai:test-connection', async (_e, provider?: string) => {
      const p = provider ? normalizeLlmProvider(provider) : undefined;
      return llmProviderRouter.testConnection(p);
    });

    ipcMain.handle(
      'llm:test-local',
      async (_e, payload: { baseUrl?: string; apiKey?: string }) => {
        return llmProviderRouter.testLocalEndpoint(
          String(payload?.baseUrl || ''),
          payload?.apiKey
        );
      }
    );

    ipcMain.handle(
      'llm:list-local-models',
      async (_e, payload: { baseUrl?: string; apiKey?: string }) => {
        return llmProviderRouter.listLocalModels(
          String(payload?.baseUrl || ''),
          payload?.apiKey
        );
      }
    );

    ipcMain.handle('llm:provider', async () => ({
      provider: llmProviderRouter.getActiveProvider()
    }));

    ipcMain.handle('llm:set-provider', async (_e, provider: string) => {
      const p: LlmProviderId = normalizeLlmProvider(provider);
      SettingsService.instance.set(GeneralConsts.KEYS.LLM.PROVIDER, p);
      return { provider: p };
    });

    ipcMain.handle('llm:translate', async (_event, payload: LlmTranslateRequest) => {
      try {
        const result = await this.service.translate(payload || { mode: 'literal' });
        return { ok: true as const, ...result };
      } catch (e: any) {
        const err =
          e instanceof OpenRouterError || e instanceof OpenAiCompatError
            ? e
            : new OpenRouterError(e?.message || 'Falha na tradução LLM', undefined, 'api');
        return {
          ok: false as const,
          error: err.message,
          code: err.code || 'api',
          status: err.status ?? null
        };
      }
    });
  }
}
