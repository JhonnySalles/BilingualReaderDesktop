import { Injectable, signal, inject, OnDestroy } from '@angular/core';
import { ElectronService } from '../electron.service';
import { ConfirmDialogService } from '../confirm-dialog.service';
import { ShareMarkCloud, ShareMarkType } from '../../models/enums/sharemark.enum';

export interface ShareMarkStatusView {
  enabled: boolean;
  cloud: ShareMarkCloud;
  signedIn: boolean;
  email: string | null;
  lastSyncManga: string | null;
  lastSyncBook: string | null;
  inSync: boolean;
  oauthConfigured: boolean;
}

export interface ShareMarkSyncResult {
  result: ShareMarkType | string;
  send: number;
  receive: number;
  message?: string;
  status?: ShareMarkStatusView;
}

@Injectable({ providedIn: 'root' })
export class ShareMarkUiService implements OnDestroy {
  private electron = inject(ElectronService);
  private confirmDialog = inject(ConfirmDialogService);
  private unsubProgress: (() => void) | null = null;
  private unsubItem: (() => void) | null = null;

  status = signal<ShareMarkStatusView>({
    enabled: false,
    cloud: ShareMarkCloud.GOOGLE_DRIVE,
    signedIn: false,
    email: null,
    lastSyncManga: null,
    lastSyncBook: null,
    inSync: false,
    oauthConfigured: false
  });

  syncing = signal(false);
  signingIn = signal(false);
  toastMessage = signal<string | null>(null);
  toastKind = signal<'info' | 'success' | 'error'>('info');
  progressPhase = signal<string | null>(null);

  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    void this.refreshStatus();
    if (typeof window !== 'undefined' && window.electronAPI?.on) {
      this.unsubProgress = window.electronAPI.on('sharemark:progress', (p: any) => {
        this.progressPhase.set(p?.phase ?? null);
        this.status.update((s) => ({ ...s, inSync: p?.phase !== 'done' }));
      });
      this.unsubItem = window.electronAPI.on('sharemark:item-updated', () => {
        // consumers can listen via refresh callbacks
      });
    }
  }

  ngOnDestroy(): void {
    this.unsubProgress?.();
    this.unsubItem?.();
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  async refreshStatus(): Promise<void> {
    const s = await this.electron.shareMarkStatus();
    if (s) this.status.set(s);
  }

  showToast(message: string, kind: 'info' | 'success' | 'error' = 'info', ms = 4500): void {
    this.toastMessage.set(message);
    this.toastKind.set(kind);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastMessage.set(null), ms);
  }

  dismissToast(): void {
    this.toastMessage.set(null);
  }

  async setEnabled(enabled: boolean): Promise<void> {
    const s = await this.electron.shareMarkSetEnabled(enabled);
    if (s) this.status.set(s);
  }

  async setCloud(cloud: ShareMarkCloud): Promise<void> {
    const s = await this.electron.shareMarkSetCloud(cloud);
    if (s) this.status.set(s);
  }

  async signIn(): Promise<void> {
    this.signingIn.set(true);
    try {
      const res = await this.electron.shareMarkSignIn();
      if (res?.status) this.status.set(res.status);
      if (res?.ok) {
        this.showToast(`Conta conectada: ${res.email || 'Google'}`, 'success');
      } else {
        this.showToast(res?.error || 'Falha ao entrar com Google', 'error');
      }
    } finally {
      this.signingIn.set(false);
    }
  }

  async signOut(): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      title: 'Desconectar Conta Google',
      message: 'Deseja realmente sair da sua conta Google?',
      confirmText: 'Sair',
      confirmVariant: 'danger',
      icon: 'danger'
    });
    if (!ok) return;
    const res = await this.electron.shareMarkSignOut();
    if (res?.status) this.status.set(res.status);
    this.showToast('Conta desconectada', 'info');
  }

  async clearLastSync(type: 'MANGA' | 'BOOK'): Promise<void> {
    const typeLabel = type === 'MANGA' ? 'mangás' : 'livros';
    const ok = await this.confirmDialog.confirm({
      title: 'Limpar Data de Sincronização',
      message: `Deseja limpar a data da última sincronização de ${typeLabel}?\n\nNa próxima sincronização, todos os arquivos serão verificados novamente.`,
      confirmText: 'Limpar',
      confirmVariant: 'warning',
      icon: 'sync'
    });
    if (!ok) return;
    const s = await this.electron.shareMarkClearLastSync(type);
    if (s) this.status.set(s);
  }

  async sync(type: 'MANGA' | 'BOOK'): Promise<ShareMarkSyncResult | null> {
    const st = this.status();
    if (!st.enabled) {
      this.showToast('Ative a sincronização em Configurações → Sistema', 'error');
      return null;
    }
    if (!st.signedIn) {
      this.showToast('Entre com a conta Google nas configurações', 'error');
      return null;
    }
    if (this.syncing() || st.inSync) {
      this.showToast('Sincronização já em andamento', 'info');
      return null;
    }

    this.syncing.set(true);
    this.progressPhase.set('syncing');
    try {
      const res = await this.electron.shareMarkSync(type);
      if (res?.status) this.status.set(res.status);
      const result = (res?.result || ShareMarkType.ERROR) as string;
      const send = res?.send ?? 0;
      const receive = res?.receive ?? 0;
      this.showToast(this.formatResult(result, send, receive), this.resultKind(result));
      return res;
    } catch (e: any) {
      this.showToast(e?.message || 'Erro na sincronização', 'error');
      return null;
    } finally {
      this.syncing.set(false);
      this.progressPhase.set(null);
      await this.refreshStatus();
    }
  }

  private resultKind(result: string): 'info' | 'success' | 'error' {
    if (
      result === ShareMarkType.SUCCESS ||
      result === ShareMarkType.NOT_ALTERATION ||
      result === ShareMarkType.NOTIFY_DATA_SET
    ) {
      return 'success';
    }
    if (result === ShareMarkType.SYNC_IN_PROGRESS) return 'info';
    return 'error';
  }

  private formatResult(result: string, send: number, receive: number): string {
    switch (result) {
      case ShareMarkType.SUCCESS:
      case ShareMarkType.NOTIFY_DATA_SET:
        return `Sincronizado: ${send} enviado(s), ${receive} recebido(s)`;
      case ShareMarkType.NOT_ALTERATION:
        return 'Nenhuma alteração para sincronizar';
      case ShareMarkType.NOT_SIGN_IN:
        return 'Conta Google não conectada';
      case ShareMarkType.ERROR_NETWORK:
        return 'Sem conexão de rede';
      case ShareMarkType.ERROR_DOWNLOAD:
        return 'Erro ao baixar da nuvem';
      case ShareMarkType.ERROR_UPLOAD:
        return 'Erro ao enviar para a nuvem';
      case ShareMarkType.NOT_CONNECT_DRIVE:
      case ShareMarkType.NOT_CONNECT_GDRIVE:
        return 'Não foi possível conectar ao Google Drive';
      case ShareMarkType.NOT_CONNECT_FIREBASE:
        return 'Não foi possível conectar ao Firestore';
      case ShareMarkType.SYNC_IN_PROGRESS:
        return 'Sincronização em andamento';
      case ShareMarkType.NEED_PERMISSION_DRIVE:
        return 'Permissão do Google Drive necessária — entre novamente';
      default:
        return `Falha na sincronização (${result})`;
    }
  }
}
