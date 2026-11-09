import { Injectable, inject } from '@angular/core';
import { LanguageService } from './language.service';
import {
  PlatformPresetConfig,
  SocialLayoutTemplate,
  SocialPlatformPreset,
  SocialRenderedPage,
  SocialRenderOptions,
  SocialShareItem,
  SocialTheme
} from '../models/social-share.model';
import { formatReadingDuration } from './statistics.service';

export const PLATFORM_PRESETS: PlatformPresetConfig[] = [
  {
    id: 'INSTAGRAM_POST',
    label: 'Instagram Post (Retrato)',
    sublabel: 'Feed 4:5 • Ideal para visualização em tela cheia',
    width: 1080,
    height: 1350,
    aspectRatioLabel: '4:5',
    recommendedTemplate: 'BENTO_GRID'
  },
  {
    id: 'INSTAGRAM_STORY',
    label: 'Instagram Stories / Reels',
    sublabel: 'Vertical 9:16 • Formato Story / Status',
    width: 1080,
    height: 1920,
    aspectRatioLabel: '9:16',
    recommendedTemplate: 'WRAPPED_STATS'
  },
  {
    id: 'INSTAGRAM_SQUARE',
    label: 'Instagram Quadrado',
    sublabel: 'Quadrado 1:1 • Carrossel e Feed clássico',
    width: 1080,
    height: 1080,
    aspectRatioLabel: '1:1',
    recommendedTemplate: 'BENTO_GRID'
  },
  {
    id: 'TWITTER_POST',
    label: 'Twitter / X Post',
    sublabel: 'Horizontal 16:9 • Sem corte no feed',
    width: 1600,
    height: 900,
    aspectRatioLabel: '16:9',
    recommendedTemplate: 'PERSPECTIVE_SHOWCASE'
  },
  {
    id: 'TUMBLR_POST',
    label: 'Tumblr / Pôster Gráfico',
    sublabel: 'Vertical 2:3 • Estilo editorial e pôster',
    width: 1200,
    height: 1800,
    aspectRatioLabel: '2:3',
    recommendedTemplate: 'MINIMALIST_LIST'
  },
  {
    id: 'SINGLE_FULL_IMAGE',
    label: 'Imagem Única (Todas as Capas)',
    sublabel: 'Dinâmico • Todas as obras reunidas em uma única imagem',
    width: 1400,
    height: 1800,
    aspectRatioLabel: 'Auto',
    recommendedTemplate: 'BENTO_GRID'
  }
];

@Injectable({
  providedIn: 'root'
})
export class SocialImageGeneratorService {
  private languageService = inject(LanguageService);
  private imageCache = new Map<string, HTMLImageElement>();

  public getPresetConfig(preset: SocialPlatformPreset): PlatformPresetConfig {
    return (
      PLATFORM_PRESETS.find(p => p.id === preset) ?? PLATFORM_PRESETS[0]
    );
  }

  /**
   * Calcula dimensões dinâmicas para o modo SINGLE_FULL_IMAGE de acordo com o total de obras.
   */
  public computeSingleImageDimensions(
    itemsCount: number,
    options: SocialRenderOptions
  ): { width: number; height: number } {
    const count = Math.max(1, itemsCount);
    const headerH = 240;
    const footerH = options.showStatsBanner ? 180 : 120;

    if (options.template === 'MINIMALIST_LIST') {
      if (count <= 8) {
        const rowH = 132;
        const gap = 16;
        return {
          width: 1200,
          height: Math.max(900, headerH + footerH + count * rowH + (count - 1) * gap)
        };
      } else {
        const cols = 2;
        const rows = Math.ceil(count / cols);
        const rowH = 128;
        const gap = 16;
        return {
          width: 1600,
          height: Math.max(1000, headerH + footerH + rows * rowH + (rows - 1) * gap)
        };
      }
    }

    if (options.template === 'PERSPECTIVE_SHOWCASE') {
      const perShelf = 6;
      const shelves = Math.ceil(count / perShelf);
      const shelfH = 360;
      const gap = 40;
      return {
        width: 1500,
        height: Math.max(920, headerH + footerH + shelves * shelfH + (shelves - 1) * gap)
      };
    }

    if (options.template === 'WRAPPED_STATS') {
      const topCardH = 260;
      const rem = Math.max(0, count - 1);
      if (rem === 0) {
        return { width: 1200, height: headerH + topCardH + footerH + 60 };
      }
      const cols = rem <= 3 ? Math.max(2, rem) : rem <= 8 ? 4 : rem <= 15 ? 5 : 6;
      const rows = Math.ceil(rem / cols);
      const cardW = 225;
      const cardH = 330;
      const gap = 20;
      const width = Math.max(1200, cols * cardW + (cols - 1) * gap + 120);
      const gridH = rows * cardH + (rows - 1) * gap + 28;
      return {
        width,
        height: headerH + topCardH + gridH + footerH
      };
    }

    if (options.template === 'MAGAZINE_HERO') {
      const rem = Math.max(0, count - 1);
      const cols = rem <= 4 ? 3 : rem <= 8 ? 4 : 5;
      const rows = 1 + Math.ceil(rem / cols);
      const cardH = 280;
      return {
        width: Math.max(1200, cols * 240 + 120),
        height: Math.max(1000, headerH + rows * cardH + footerH)
      };
    }

    if (options.template === 'POLAROID_GALLERY') {
      const cols = count <= 3 ? Math.max(2, count) : count <= 8 ? 3 : count <= 15 ? 4 : 5;
      const rows = Math.ceil(count / cols);
      const cardW = 280;
      const cardH = 370;
      const gap = 24;
      return {
        width: Math.max(1100, cols * cardW + (cols - 1) * gap + 120),
        height: Math.max(920, headerH + rows * cardH + (rows - 1) * gap + footerH)
      };
    }

    if (options.template === 'PODIUM_RANKING') {
      const podiumH = 380;
      const rem = Math.max(0, count - 3);
      const listRows = Math.ceil(rem / 2);
      const listH = listRows * 110;
      return {
        width: 1280,
        height: Math.max(960, headerH + podiumH + (rem > 0 ? listH + 40 : 0) + footerH)
      };
    }

    if (options.template === 'GLASS_CARDS') {
      const cols = count > 6 ? 2 : 1;
      const rows = Math.ceil(count / cols);
      const rowH = 150;
      const gap = 18;
      return {
        width: cols === 2 ? 1400 : 1080,
        height: Math.max(900, headerH + rows * rowH + (rows - 1) * gap + footerH)
      };
    }

    // BENTO_GRID (Padrão)
    const cols = count <= 3 ? Math.max(2, count) : count <= 8 ? 4 : count <= 15 ? 5 : 6;
    const rows = Math.ceil(count / cols);
    const cardW = 230;
    const cardH = 335;
    const gap = 20;
    const width = Math.max(1080, cols * cardW + (cols - 1) * gap + 120);
    const height = Math.max(900, headerH + rows * cardH + (rows - 1) * gap + footerH);
    return { width, height };
  }

  /**
   * Renderiza uma ou múltiplas páginas conforme a configuração de capas por página e o preset.
   */
  public async renderPages(
    allItems: SocialShareItem[],
    options: SocialRenderOptions
  ): Promise<SocialRenderedPage[]> {
    const loadedCovers = await this.preloadCovers(allItems);
    const isSingleFull = options.preset === 'SINGLE_FULL_IMAGE';
    const perPage = isSingleFull
      ? Math.max(1, allItems.length)
      : Math.max(1, options.itemsPerPage || 9);

    const chunks: SocialShareItem[][] = [];
    if (allItems.length === 0) {
      chunks.push([]);
    } else if (isSingleFull) {
      chunks.push(allItems);
    } else {
      for (let i = 0; i < allItems.length; i += perPage) {
        chunks.push(allItems.slice(i, i + perPage));
      }
    }

    const totalPages = chunks.length;
    const results: SocialRenderedPage[] = [];

    for (let idx = 0; idx < totalPages; idx++) {
      const pageItems = chunks[idx];
      const pageNumber = idx + 1;
      const canvas = document.createElement('canvas');

      const pageOpts: SocialRenderOptions = {
        ...options,
        pageIndex: pageNumber,
        totalPages
      };

      const dataUrl = await this.renderSingleCanvasPage(
        canvas,
        pageItems,
        allItems,
        loadedCovers,
        pageOpts
      );

      results.push({
        pageNumber,
        totalPages,
        width: canvas.width,
        height: canvas.height,
        dataUrl,
        itemsCount: pageItems.length
      });
    }

    return results;
  }

  /**
   * Renderiza os dados no canvas fornecido (compatibilidade direta) e retorna o DataURL (PNG).
   */
  public async renderToCanvas(
    canvas: HTMLCanvasElement,
    items: SocialShareItem[],
    options: SocialRenderOptions
  ): Promise<string> {
    const loadedCovers = await this.preloadCovers(items);
    return this.renderSingleCanvasPage(canvas, items, items, loadedCovers, {
      ...options,
      pageIndex: 1,
      totalPages: 1
    });
  }

  private async renderSingleCanvasPage(
    canvas: HTMLCanvasElement,
    pageItems: SocialShareItem[],
    allItemsForStats: SocialShareItem[],
    loadedCovers: Map<string, HTMLImageElement>,
    options: SocialRenderOptions
  ): Promise<string> {
    const preset = this.getPresetConfig(options.preset);
    if (options.preset === 'SINGLE_FULL_IMAGE') {
      const dims = this.computeSingleImageDimensions(pageItems.length, options);
      canvas.width = dims.width;
      canvas.height = dims.height;
    } else {
      canvas.width = preset.width;
      canvas.height = preset.height;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Falha ao obter contexto 2D do Canvas');
    }

    // 1. Renderizar Fundo (Background / Mesh)
    await this.renderBackground(ctx, canvas.width, canvas.height, options.theme, loadedCovers, options);

    // 2. Renderizar Header / Título / Subtítulo (+ indicador de página se multipágina)
    const contentTop = this.renderHeader(ctx, canvas.width, options);

    // 3. Renderizar Rodapé / Branding / Stats Globais
    const contentBottom = this.renderFooter(ctx, canvas.width, canvas.height, options, allItemsForStats);

    // 4. Renderizar Miolo com as Capas da página
    const availableRect = {
      x: 60,
      y: contentTop,
      width: canvas.width - 120,
      height: Math.max(200, contentBottom - contentTop)
    };

    switch (options.template) {
      case 'BENTO_GRID':
        this.renderBentoGrid(ctx, availableRect, pageItems, loadedCovers, options);
        break;
      case 'PERSPECTIVE_SHOWCASE':
        this.renderPerspectiveShowcase(ctx, availableRect, pageItems, loadedCovers, options);
        break;
      case 'WRAPPED_STATS':
        this.renderWrappedStats(ctx, availableRect, pageItems, loadedCovers, options);
        break;
      case 'MINIMALIST_LIST':
        this.renderMinimalistList(ctx, availableRect, pageItems, loadedCovers, options);
        break;
      case 'MAGAZINE_HERO':
        this.renderMagazineHero(ctx, availableRect, pageItems, loadedCovers, options);
        break;
      case 'POLAROID_GALLERY':
        this.renderPolaroidGallery(ctx, availableRect, pageItems, loadedCovers, options);
        break;
      case 'PODIUM_RANKING':
        this.renderPodiumRanking(ctx, availableRect, pageItems, loadedCovers, options);
        break;
      case 'GLASS_CARDS':
        this.renderGlassCards(ctx, availableRect, pageItems, loadedCovers, options);
        break;
      default:
        this.renderBentoGrid(ctx, availableRect, pageItems, loadedCovers, options);
        break;
    }

    return canvas.toDataURL('image/png');
  }

  // ==========================================
  // Carregamento de Capas e Cores
  // ==========================================

  private async preloadCovers(items: SocialShareItem[]): Promise<Map<string, HTMLImageElement>> {
    const map = new Map<string, HTMLImageElement>();
    const promises = items.map(async item => {
      if (!item.coverPath) return;
      const url = 'local-cover:///' + item.coverPath.replace(/\\/g, '/');
      if (this.imageCache.has(url)) {
        map.set(item.coverPath, this.imageCache.get(url)!);
        return;
      }
      try {
        const img = await this.loadImage(url);
        this.imageCache.set(url, img);
        map.set(item.coverPath, img);
      } catch {
        // Ignora erro caso a imagem não carregue
      }
    });

    await Promise.all(promises);
    return map;
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = e => reject(e);
      img.src = src;
    });
  }

  private extractPredominantColors(
    covers: Map<string, HTMLImageElement>
  ): { primary: string; secondary: string; accent: string } {
    const defaultPalette = {
      primary: 'rgb(24, 24, 37)',
      secondary: 'rgb(15, 23, 42)',
      accent: 'rgb(99, 102, 241)'
    };

    if (covers.size === 0) return defaultPalette;

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return defaultPalette;

    let totalR = 0,
      totalG = 0,
      totalB = 0,
      count = 0;

    for (const img of covers.values()) {
      try {
        ctx.drawImage(img, 0, 0, 64, 64);
        const data = ctx.getImageData(0, 0, 64, 64).data;
        for (let i = 0; i < data.length; i += 16) {
          totalR += data[i];
          totalG += data[i + 1];
          totalB += data[i + 2];
          count++;
        }
      } catch {
        // fallback seguro
      }
    }

    if (count === 0) return defaultPalette;

    const r = Math.round(totalR / count);
    const g = Math.round(totalG / count);
    const b = Math.round(totalB / count);

    return {
      primary: `rgb(${Math.max(15, Math.min(60, r))}, ${Math.max(15, Math.min(60, g))}, ${Math.max(25, Math.min(80, b))})`,
      secondary: `rgb(${Math.max(8, r - 40)}, ${Math.max(10, g - 40)}, ${Math.max(18, b - 30)})`,
      accent: `rgb(${Math.min(255, r + 70)}, ${Math.min(255, g + 70)}, ${Math.min(255, b + 100)})`
    };
  }

  // ==========================================
  // Resolução de Paleta de Cores
  // ==========================================

  private isLightColor(hexOrRgb: string): boolean {
    let r = 0, g = 0, b = 0;
    if (hexOrRgb.startsWith('#')) {
      const hex = hexOrRgb.replace('#', '');
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
      } else {
        r = parseInt(hex.substring(0, 2), 16) || 0;
        g = parseInt(hex.substring(2, 4), 16) || 0;
        b = parseInt(hex.substring(4, 6), 16) || 0;
      }
    } else {
      const m = hexOrRgb.match(/\d+/g);
      if (m && m.length >= 3) {
        r = Number(m[0]);
        g = Number(m[1]);
        b = Number(m[2]);
      }
    }
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.55;
  }

  private isThemeLight(options: SocialRenderOptions): boolean {
    if (options.theme === 'WARM_PAPER' || options.theme === 'SAKURA_DREAM' || options.theme === 'NORDIC_FROST') {
      return true;
    }
    if (options.theme === 'CUSTOM') {
      if (options.customTheme?.textMode === 'DARK') return true;
      if (options.customTheme?.textMode === 'LIGHT') return false;
      return this.isLightColor(options.customTheme?.primaryColor || '#0f172a');
    }
    return false;
  }

  // ==========================================
  // Renderização de Fundo (Background)
  // ==========================================

  private async renderBackground(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    theme: SocialTheme,
    covers: Map<string, HTMLImageElement>,
    options?: SocialRenderOptions
  ): Promise<void> {
    ctx.save();

    if (theme === 'OLED_BLACK') {
      ctx.fillStyle = '#05070a';
      ctx.fillRect(0, 0, w, h);
    } else if (theme === 'WARM_PAPER') {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#f9f6f0');
      grad.addColorStop(1, '#ebe4d5');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    } else if (theme === 'SAKURA_DREAM') {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#fff5f7');
      grad.addColorStop(0.5, '#fde2e8');
      grad.addColorStop(1, '#fbcfe8');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    } else if (theme === 'NORDIC_FROST') {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#f8fafc');
      grad.addColorStop(0.5, '#e0f2fe');
      grad.addColorStop(1, '#bae6fd');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    } else if (theme === 'AURORA_BOREALIS') {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#051b14');
      grad.addColorStop(0.35, '#064e3b');
      grad.addColorStop(0.7, '#042f2e');
      grad.addColorStop(1, '#020617');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Aurora glow
      const glow1 = ctx.createRadialGradient(w * 0.3, h * 0.25, 30, w * 0.3, h * 0.25, w * 0.65);
      glow1.addColorStop(0, '#10b981');
      glow1.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = glow1;
      ctx.fillRect(0, 0, w, h);

      const glow2 = ctx.createRadialGradient(w * 0.75, h * 0.45, 20, w * 0.75, h * 0.45, w * 0.55);
      glow2.addColorStop(0, '#06b6d4');
      glow2.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = glow2;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1.0;
    } else if (theme === 'SUNSET_SYNTH') {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#2e1065');
      grad.addColorStop(0.4, '#581c87');
      grad.addColorStop(0.75, '#831843');
      grad.addColorStop(1, '#431407');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      const glow = ctx.createRadialGradient(w * 0.5, h * 0.65, 40, w * 0.5, h * 0.65, w * 0.6);
      glow.addColorStop(0, '#f97316');
      glow.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1.0;
    } else if (theme === 'ROYAL_GOLD') {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#18181b');
      grad.addColorStop(0.5, '#09090b');
      grad.addColorStop(1, '#1c1917');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      const glow = ctx.createRadialGradient(w * 0.5, h * 0.3, 30, w * 0.5, h * 0.3, w * 0.7);
      glow.addColorStop(0, '#d97706');
      glow.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1.0;
    } else if (theme === 'MATCHA_BOTANICAL') {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#14281d');
      grad.addColorStop(0.5, '#0d1f15');
      grad.addColorStop(1, '#09150e');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      const glow = ctx.createRadialGradient(w * 0.7, h * 0.2, 40, w * 0.7, h * 0.2, w * 0.55);
      glow.addColorStop(0, '#4ade80');
      glow.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1.0;
    } else if (theme === 'COVER_BLUR_MOSAIC') {
      // Fundo escuro base
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, w, h);

      // Renderiza miniaturas de capas com forte desfoque
      const coverList = Array.from(covers.values());
      if (coverList.length > 0) {
        ctx.save();
        ctx.filter = 'blur(50px) saturate(180%) brightness(0.4)';
        const cols = Math.min(3, coverList.length);
        const rows = Math.ceil(coverList.length / cols);
        const cw = w / cols;
        const ch = h / rows;
        coverList.forEach((cImg, i) => {
          const cx = (i % cols) * cw;
          const cy = Math.floor(i / cols) * ch;
          ctx.drawImage(cImg, cx - 40, cy - 40, cw + 80, ch + 80);
        });
        ctx.restore();
      }

      // Vinheta de acabamento
      const vinheta = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
      vinheta.addColorStop(0, 'rgba(3, 7, 18, 0.45)');
      vinheta.addColorStop(1, 'rgba(3, 7, 18, 0.88)');
      ctx.fillStyle = vinheta;
      ctx.fillRect(0, 0, w, h);
    } else if (theme === 'CUSTOM') {
      const c1 = options?.customTheme?.primaryColor || '#0f172a';
      const c2 = options?.customTheme?.secondaryColor || '#1e1b4b';
      const ac = options?.customTheme?.accentColor || '#6366f1';
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, c1);
      grad.addColorStop(1, c2);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      const glow = ctx.createRadialGradient(w * 0.35, h * 0.25, 30, w * 0.35, h * 0.25, w * 0.65);
      glow.addColorStop(0, ac);
      glow.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1.0;
    } else if (theme === 'CYBER_NEON') {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#0f0c29');
      grad.addColorStop(0.5, '#302b63');
      grad.addColorStop(1, '#24243e');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    } else if (theme === 'DARK_SLATE') {
      const grad = ctx.createRadialGradient(w / 2, h / 3, 50, w / 2, h / 2, Math.max(w, h));
      grad.addColorStop(0, '#1e293b');
      grad.addColorStop(0.7, '#0f172a');
      grad.addColorStop(1, '#020617');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    } else {
      // AMBIENT_DYNAMIC (Dynamic Mesh)
      const palette = this.extractPredominantColors(covers);
      const bgGrad = ctx.createLinearGradient(0, 0, w, h);
      bgGrad.addColorStop(0, palette.secondary);
      bgGrad.addColorStop(1, '#030712');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      const orbGrad1 = ctx.createRadialGradient(w * 0.25, h * 0.2, 20, w * 0.25, h * 0.2, w * 0.65);
      orbGrad1.addColorStop(0, palette.accent);
      orbGrad1.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = orbGrad1;
      ctx.fillRect(0, 0, w, h);

      const orbGrad2 = ctx.createRadialGradient(w * 0.8, h * 0.6, 20, w * 0.8, h * 0.6, w * 0.55);
      orbGrad2.addColorStop(0, palette.primary);
      orbGrad2.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = orbGrad2;
      ctx.fillRect(0, 0, w, h);

      ctx.globalAlpha = 1.0;
    }

    // Padrões decorativos de fundo
    const isLight = this.isThemeLight(options || { theme } as any);
    const pattern = options?.backgroundPattern ?? 'GRID';

    if (pattern === 'GRID') {
      ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.035)';
      ctx.lineWidth = 1;
      const step = 80;
      for (let x = 0; x < w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    } else if (pattern === 'DOTS') {
      ctx.fillStyle = isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.07)';
      const step = 44;
      for (let x = 20; x < w; x += step) {
        for (let y = 20; y < h; y += step) {
          ctx.beginPath();
          ctx.arc(x, y, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (pattern === 'ORBS') {
      // Glow orbs extras
      const orbColor = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)';
      const orbs = [
        { x: w * 0.2, y: h * 0.4, r: 180 },
        { x: w * 0.85, y: h * 0.15, r: 240 },
        { x: w * 0.6, y: h * 0.85, r: 210 }
      ];
      orbs.forEach(orb => {
        const rad = ctx.createRadialGradient(orb.x, orb.y, 20, orb.x, orb.y, orb.r);
        rad.addColorStop(0, orbColor);
        rad.addColorStop(1, 'transparent');
        ctx.fillStyle = rad;
        ctx.fillRect(0, 0, w, h);
      });
    }

    ctx.restore();
  }

  // ==========================================
  // Renderização de Cabeçalho e Rodapé
  // ==========================================

  private renderHeader(
    ctx: CanvasRenderingContext2D,
    w: number,
    options: SocialRenderOptions
  ): number {
    ctx.save();
    const isLight = this.isThemeLight(options);

    const startY = 80;
    ctx.textAlign = 'left';

    // Badge / Pill de categoria ou contexto
    ctx.fillStyle = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(99, 102, 241, 0.15)';
    this.roundRect(ctx, 60, startY, 210, 36, 18);
    ctx.fill();

    const accentColor = options.theme === 'CUSTOM'
      ? (options.customTheme?.accentColor || '#818cf8')
      : (options.theme === 'ROYAL_GOLD' ? '#d97706' : (isLight ? '#475569' : '#818cf8'));

    ctx.fillStyle = accentColor;
    ctx.font = 'bold 16px "Inter", "Segoe UI", sans-serif';
    ctx.fillText('⚡ READING RECAP', 80, startY + 24);

    // Indicador de Página no canto superior direito quando houver múltiplas páginas
    if (options.totalPages && options.totalPages > 1 && options.pageIndex) {
      const pageWord = this.languageService.currentLang() === 'pt' ? 'PÁGINA' : 'PAGE';
      const pageLabel = `${pageWord} ${options.pageIndex} / ${options.totalPages}`;
      ctx.font = 'bold 15px "Inter", "Segoe UI", sans-serif';
      const labelW = ctx.measureText(pageLabel).width + 36;
      const badgeX = w - 60 - labelW;

      ctx.fillStyle = isLight ? 'rgba(0,0,0,0.07)' : 'rgba(15, 23, 42, 0.75)';
      ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      this.roundRect(ctx, badgeX, startY, labelW, 36, 18);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isLight ? '#334155' : '#e2e8f0';
      ctx.textAlign = 'center';
      ctx.fillText(pageLabel, badgeX + labelW / 2, startY + 23);
      ctx.textAlign = 'left';
    }

    // Título Principal
    ctx.fillStyle = isLight ? '#0f172a' : '#f8fafc';
    ctx.font = 'bold 46px "Inter", "Segoe UI", sans-serif';
    const defaultRecapTitle = this.languageService.currentLang() === 'pt' ? 'Minhas Leituras' : 'My Readings';
    this.drawTruncatedText(ctx, options.title || defaultRecapTitle, 60, startY + 84, w - 120);

    // Subtítulo / Período
    ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
    ctx.font = '500 22px "Inter", "Segoe UI", sans-serif';
    this.drawTruncatedText(ctx, options.subtitle || 'Bilingual Reader', 60, startY + 120, w - 120);

    ctx.restore();
    return startY + 160;
  }

  private renderFooter(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    options: SocialRenderOptions,
    items: SocialShareItem[]
  ): number {
    ctx.save();
    const isLight = this.isThemeLight(options);
    const footerHeight = options.showStatsBanner ? 150 : 90;
    const footerTop = h - footerHeight;

    if (options.showStatsBanner) {
      // Banner com Estatísticas Globais do Período
      const totalWorks = items.length;
      const totalPages = items.reduce((acc, it) => acc + it.pagesReadInPeriod, 0);
      const totalSeconds = items.reduce((acc, it) => acc + it.secondsReadInPeriod, 0);
      const completedCount = items.filter(it => it.completed).length;

      const cardY = footerTop;
      const cardW = w - 120;
      const cardH = 80;

      ctx.fillStyle = isLight ? 'rgba(255,255,255,0.7)' : 'rgba(15, 23, 42, 0.65)';
      ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1.5;
      this.roundRect(ctx, 60, cardY, cardW, cardH, 20);
      ctx.fill();
      ctx.stroke();

      const isPtStats = this.languageService.currentLang() === 'pt';
      const cols = [
        { label: isPtStats ? 'OBRAS LIDAS' : 'TITLES READ', val: `${totalWorks}` },
        { label: isPtStats ? 'PÁGINAS' : 'PAGES', val: `${totalPages}` },
        { label: isPtStats ? 'TEMPO TOTAL' : 'TOTAL TIME', val: formatReadingDuration(totalSeconds) },
        { label: isPtStats ? 'CONCLUÍDOS' : 'COMPLETED', val: `${completedCount}` }
      ];

      const colW = cardW / cols.length;
      cols.forEach((col, idx) => {
        const colX = 60 + idx * colW + colW / 2;
        ctx.textAlign = 'center';

        ctx.fillStyle = isLight ? '#94a3b8' : '#64748b';
        ctx.font = 'bold 13px "Inter", "Segoe UI", sans-serif';
        ctx.fillText(col.label, colX, cardY + 28);

        ctx.fillStyle = isLight ? '#0f172a' : '#f1f5f9';
        ctx.font = 'bold 24px "Inter", "Segoe UI", sans-serif';
        ctx.fillText(col.val, colX, cardY + 60);

        if (idx < cols.length - 1) {
          ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)';
          ctx.beginPath();
          ctx.moveTo(60 + (idx + 1) * colW, cardY + 16);
          ctx.lineTo(60 + (idx + 1) * colW, cardY + cardH - 16);
          ctx.stroke();
        }
      });
    }

    // Linha final com Branding e Handle
    const bottomLineY = h - 35;
    ctx.textAlign = 'left';
    ctx.fillStyle = isLight ? '#64748b' : '#64748b';
    ctx.font = '600 16px "Inter", "Segoe UI", sans-serif';

    if (options.showBranding) {
      ctx.fillText('📖 Gerado com Bilingual Reader Desktop', 60, bottomLineY);
    }

    if (options.userHandle) {
      ctx.textAlign = 'right';
      ctx.fillStyle = isLight ? '#475569' : '#94a3b8';
      ctx.fillText(
        options.userHandle.startsWith('@') ? options.userHandle : `@${options.userHandle}`,
        w - 60,
        bottomLineY
      );
    }

    ctx.restore();
    return footerTop - 30;
  }

  // ==========================================
  // Layout 1: Bento Grid Moderno (Adaptativo)
  // ==========================================

  private renderBentoGrid(
    ctx: CanvasRenderingContext2D,
    rect: { x: number; y: number; width: number; height: number },
    items: SocialShareItem[],
    covers: Map<string, HTMLImageElement>,
    options: SocialRenderOptions
  ): void {
    if (items.length === 0) return;

    const count = items.length;
    let cols = 3;
    let rows = 2;

    if (options.preset === 'SINGLE_FULL_IMAGE') {
      cols = count <= 3 ? Math.max(1, count) : count <= 8 ? 4 : count <= 15 ? 5 : 6;
      rows = Math.ceil(count / cols);
    } else {
      // Escolhe a combinação de colunas e linhas que mantém a proporção do card mais próxima de 0.68 (2:3)
      const targetRatio = 0.68;
      let bestCols = 1;
      let bestDiff = Infinity;

      const maxCols = Math.min(count, 8);
      for (let c = 1; c <= maxCols; c++) {
        const r = Math.ceil(count / c);
        const cellW = rect.width / c;
        const cellH = rect.height / r;
        const ratio = cellW / cellH;
        const diff = Math.abs(ratio - targetRatio);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestCols = c;
        }
      }
      cols = bestCols;
      rows = Math.ceil(count / cols);
    }

    const gap = count > 16 ? 14 : 20;
    const cellW = (rect.width - gap * (cols - 1)) / cols;
    const cellH = (rect.height - gap * (rows - 1)) / rows;

    items.forEach((item, idx) => {
      const c = idx % cols;
      const r = Math.floor(idx / cols);
      const x = rect.x + c * (cellW + gap);
      const y = rect.y + r * (cellH + gap);

      this.drawCoverCard(ctx, x, y, cellW, cellH, item, covers.get(item.coverPath || ''), options);
    });
  }

  // ==========================================
  // Layout 2: Perspective Showcase (Estante Flutuante)
  // ==========================================

  private renderPerspectiveShowcase(
    ctx: CanvasRenderingContext2D,
    rect: { x: number; y: number; width: number; height: number },
    items: SocialShareItem[],
    covers: Map<string, HTMLImageElement>,
    options: SocialRenderOptions
  ): void {
    if (items.length === 0) return;

    const maxPerShelf = 6;
    const shelvesCount = Math.ceil(items.length / maxPerShelf);
    const shelfGap = shelvesCount > 1 ? 24 : 0;
    const shelfH = (rect.height - shelfGap * (shelvesCount - 1)) / shelvesCount;

    for (let s = 0; s < shelvesCount; s++) {
      const shelfItems = items.slice(s * maxPerShelf, (s + 1) * maxPerShelf);
      const count = shelfItems.length;
      const shelfY = rect.y + s * (shelfH + shelfGap);

      const baseCardW = Math.min(240, (rect.width / Math.max(count, 2)) * 1.25, shelfH * 0.68);
      const cardH = Math.min(shelfH * 0.88, baseCardW * 1.48);
      const stepX = count > 1 ? Math.min(baseCardW * 0.78, (rect.width - baseCardW) / (count - 1)) : 0;
      const totalSpan = (count - 1) * stepX + baseCardW;
      const startX = rect.x + (rect.width - totalSpan) / 2;
      const startY = shelfY + (shelfH - cardH) / 2;

      shelfItems.forEach((item, idx) => {
        const x = startX + idx * stepX;
        const centerDist = Math.abs(idx - (count - 1) / 2);
        const y = startY + centerDist * 12;

        ctx.save();
        const angle = (idx - (count - 1) / 2) * -0.035;
        ctx.translate(x + baseCardW / 2, y + cardH / 2);
        ctx.rotate(angle);
        ctx.translate(-(x + baseCardW / 2), -(y + cardH / 2));

        this.drawCoverCard(ctx, x, y, baseCardW, cardH, item, covers.get(item.coverPath || ''), options);
        ctx.restore();
      });
    }
  }

  // ==========================================
  // Layout 3: Wrapped Stats + Covers
  // ==========================================

  private renderWrappedStats(
    ctx: CanvasRenderingContext2D,
    rect: { x: number; y: number; width: number; height: number },
    items: SocialShareItem[],
    covers: Map<string, HTMLImageElement>,
    options: SocialRenderOptions
  ): void {
    if (items.length === 0) return;

    const topItem = items[0];
    const otherItems = items.slice(1);

    const isLight = options.theme === 'WARM_PAPER';
    const topCardH = otherItems.length === 0 ? Math.min(340, rect.height * 0.6) : Math.min(250, rect.height * 0.34);

    // Box do Livro Destaque
    ctx.fillStyle = isLight ? 'rgba(255,255,255,0.85)' : 'rgba(15, 23, 42, 0.75)';
    ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(99, 102, 241, 0.3)';
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, rect.x, rect.y, rect.width, topCardH, 20);
    ctx.fill();
    ctx.stroke();

    const topCoverW = (topCardH - 32) * 0.68;
    const topCoverH = topCardH - 32;
    this.drawCoverCard(
      ctx,
      rect.x + 16,
      rect.y + 16,
      topCoverW,
      topCoverH,
      topItem,
      covers.get(topItem.coverPath || ''),
      { ...options, showCoverTitles: false }
    );

    // Informações do destaque
    const textX = rect.x + topCoverW + 40;
    const maxTextW = rect.width - (textX - rect.x) - 30;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#6366f1';
    ctx.font = 'bold 16px "Inter", "Segoe UI", sans-serif';
    ctx.fillText('🏆 DESTAQUE DO PERÍODO', textX, rect.y + 50);

    ctx.fillStyle = isLight ? '#0f172a' : '#f8fafc';
    ctx.font = 'bold 28px "Inter", "Segoe UI", sans-serif';
    this.drawTruncatedText(ctx, topItem.title, textX, rect.y + 90, maxTextW);

    ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
    ctx.font = '500 18px "Inter", "Segoe UI", sans-serif';
    const sub = [topItem.author, topItem.series, topItem.volume].filter(Boolean).join(' • ');
    this.drawTruncatedText(ctx, sub || topItem.fileType, textX, rect.y + 124, maxTextW);

    // Métricas específicas do destaque (Páginas + Tempo)
    ctx.fillStyle = isLight ? '#475569' : '#cbd5e1';
    ctx.font = '600 17px "Inter", "Segoe UI", sans-serif';
    const pagesReadSuffix = this.languageService.currentLang() === 'pt' ? 'páginas lidas' : 'pages read';
    ctx.fillText(
      `⏱️ ${formatReadingDuration(topItem.secondsReadInPeriod)}  •  📖 ${topItem.pagesReadInPeriod} ${pagesReadSuffix}`,
      textX,
      rect.y + 168
    );

    // Grid inferior para todos os outros livros da página
    if (otherItems.length > 0) {
      const bottomRect = {
        x: rect.x,
        y: rect.y + topCardH + 24,
        width: rect.width,
        height: rect.height - topCardH - 24
      };
      this.renderBentoGrid(ctx, bottomRect, otherItems, covers, options);
    }
  }

  // ==========================================
  // Layout 4: Minimalist Review List
  // ==========================================

  private renderMinimalistList(
    ctx: CanvasRenderingContext2D,
    rect: { x: number; y: number; width: number; height: number },
    items: SocialShareItem[],
    covers: Map<string, HTMLImageElement>,
    options: SocialRenderOptions
  ): void {
    if (items.length === 0) return;

    const isLight = this.isThemeLight(options);
    const cols = items.length > 8 ? 2 : 1;
    const rows = Math.ceil(items.length / cols);
    const colGap = 20;
    const rowGap = items.length > 10 ? 10 : 14;
    const colW = (rect.width - colGap * (cols - 1)) / cols;
    const rowH = (rect.height - rowGap * (rows - 1)) / rows;

    items.forEach((item, idx) => {
      const c = idx % cols;
      const r = Math.floor(idx / cols);
      const colX = rect.x + c * (colW + colGap);
      const rowY = rect.y + r * (rowH + rowGap);

      // Card fundo
      ctx.fillStyle = isLight ? 'rgba(255,255,255,0.72)' : 'rgba(30, 41, 59, 0.5)';
      ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      this.roundRect(ctx, colX, rowY, colW, rowH, 16);
      ctx.fill();
      ctx.stroke();

      // Capa miniatura
      const pad = Math.min(8, rowH * 0.08);
      const coverH = Math.max(32, rowH - pad * 2);
      const coverW = coverH * 0.68;
      this.drawCoverCard(
        ctx,
        colX + pad + 2,
        rowY + pad,
        coverW,
        coverH,
        item,
        covers.get(item.coverPath || ''),
        { ...options, showCoverTitles: false }
      );

      // Textos (Título + Tempo e Autor)
      const textX = colX + coverW + pad + 20;
      const maxTextW = colW - coverW - pad - 135;
      ctx.textAlign = 'left';

      const titleFont = Math.max(13, Math.min(20, Math.round(rowH * 0.2)));
      ctx.fillStyle = isLight ? '#0f172a' : '#f8fafc';
      ctx.font = `bold ${titleFont}px "Inter", "Segoe UI", sans-serif`;
      this.drawTruncatedText(ctx, item.title, textX, rowY + rowH * 0.4, maxTextW);

      const subFont = Math.max(11, Math.min(15, Math.round(rowH * 0.15)));
      ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
      ctx.font = `500 ${subFont}px "Inter", "Segoe UI", sans-serif`;
      const timeLabel = `⏱️ ${formatReadingDuration(item.secondsReadInPeriod)} (${item.pagesReadInPeriod}p)`;
      const meta = [timeLabel, item.author || item.series].filter(Boolean).join(' • ');
      this.drawTruncatedText(ctx, meta, textX, rowY + rowH * 0.72, maxTextW);

      // Status pill à direita
      ctx.textAlign = 'right';
      const statusX = colX + colW - 20;
      ctx.fillStyle = item.completed ? '#10b981' : '#6366f1';
      ctx.font = `bold ${subFont}px "Inter", "Segoe UI", sans-serif`;
      const statusLabel = item.completed
        ? '✓ CONCLUÍDO'
        : `${Math.round((item.bookMark / Math.max(1, item.pages)) * 100)}%`;
      ctx.fillText(statusLabel, statusX, rowY + rowH * 0.55);
    });
  }

  // ==========================================
  // Layout 5: Magazine Hero
  // ==========================================

  private renderMagazineHero(
    ctx: CanvasRenderingContext2D,
    rect: { x: number; y: number; width: number; height: number },
    items: SocialShareItem[],
    covers: Map<string, HTMLImageElement>,
    options: SocialRenderOptions
  ): void {
    if (items.length === 0) return;

    if (items.length === 1) {
      this.renderBentoGrid(ctx, rect, items, covers, options);
      return;
    }

    const hero = items[0];
    const others = items.slice(1);
    const gap = 20;

    // Em telas mais largas ou com poucos itens, divide lado a lado (Hero na esquerda, grid na direita)
    const heroW = Math.min(rect.width * 0.42, 440);
    const heroH = rect.height;

    this.drawCoverCard(
      ctx,
      rect.x,
      rect.y,
      heroW,
      heroH,
      hero,
      covers.get(hero.coverPath || ''),
      options
    );

    // Badge de Hero / Destaque
    ctx.save();
    ctx.fillStyle = '#f59e0b';
    this.roundRect(ctx, rect.x + 16, rect.y + 16, 110, 28, 14);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 12px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⭐ TOP 1 PICK', rect.x + 71, rect.y + 35);
    ctx.restore();

    // Grade dos outros itens à direita
    const gridRect = {
      x: rect.x + heroW + gap,
      y: rect.y,
      width: rect.width - heroW - gap,
      height: rect.height
    };
    this.renderBentoGrid(ctx, gridRect, others, covers, options);
  }

  // ==========================================
  // Layout 6: Polaroid Gallery
  // ==========================================

  private renderPolaroidGallery(
    ctx: CanvasRenderingContext2D,
    rect: { x: number; y: number; width: number; height: number },
    items: SocialShareItem[],
    covers: Map<string, HTMLImageElement>,
    options: SocialRenderOptions
  ): void {
    if (items.length === 0) return;

    const count = items.length;
    let cols = count <= 3 ? count : count <= 8 ? 3 : 4;
    let rows = Math.ceil(count / cols);
    const gap = 24;

    const cellW = (rect.width - gap * (cols - 1)) / cols;
    const cellH = (rect.height - gap * (rows - 1)) / rows;

    items.forEach((item, idx) => {
      const c = idx % cols;
      const r = Math.floor(idx / cols);
      const x = rect.x + c * (cellW + gap);
      const y = rect.y + r * (cellH + gap);

      ctx.save();

      // Ângulo orgânico sutil (-2.5 a +2.5 graus)
      const angles = [-0.03, 0.025, -0.015, 0.035, -0.02, 0.018];
      const angle = angles[idx % angles.length];
      const centerX = x + cellW / 2;
      const centerY = y + cellH / 2;

      ctx.translate(centerX, centerY);
      ctx.rotate(angle);
      ctx.translate(-centerX, -centerY);

      // Moldura polaroid branca/marfim
      const borderPad = 12;
      const bottomLegendH = Math.max(46, Math.min(68, cellH * 0.2));

      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 8;

      ctx.fillStyle = '#ffffff';
      this.roundRect(ctx, x, y, cellW, cellH, 8);
      ctx.fill();

      ctx.shadowColor = 'transparent';

      // Capa da foto
      const photoW = cellW - borderPad * 2;
      const photoH = cellH - borderPad * 2 - bottomLegendH;
      const photoX = x + borderPad;
      const photoY = y + borderPad;

      this.drawCoverCard(
        ctx,
        photoX,
        photoY,
        photoW,
        photoH,
        item,
        covers.get(item.coverPath || ''),
        { ...options, showCoverTitles: false }
      );

      // Legenda estilo caneta no pé da Polaroid
      ctx.textAlign = 'center';
      ctx.fillStyle = '#1e293b';
      const titleFont = Math.max(11, Math.min(14, Math.round(cellW * 0.055)));
      ctx.font = `bold ${titleFont}px "Inter", "Segoe UI", sans-serif`;
      const legY = y + cellH - bottomLegendH + 20;
      this.drawTruncatedText(ctx, item.title, centerX, legY, cellW - 20);

      ctx.fillStyle = '#64748b';
      const subFont = Math.max(9, Math.min(12, Math.round(cellW * 0.045)));
      ctx.font = `600 ${subFont}px "Inter", "Segoe UI", sans-serif`;
      const timeStr = `⏱ ${formatReadingDuration(item.secondsReadInPeriod)} • ${item.pagesReadInPeriod}p`;
      this.drawTruncatedText(ctx, timeStr, centerX, legY + 18, cellW - 20);

      ctx.restore();
    });
  }

  // ==========================================
  // Layout 7: Podium Ranking (Top 3 + Lista)
  // ==========================================

  private renderPodiumRanking(
    ctx: CanvasRenderingContext2D,
    rect: { x: number; y: number; width: number; height: number },
    items: SocialShareItem[],
    covers: Map<string, HTMLImageElement>,
    options: SocialRenderOptions
  ): void {
    if (items.length === 0) return;

    const isLight = this.isThemeLight(options);
    const podiumItems = items.slice(0, 3);
    const restItems = items.slice(3);

    // Ordem no pódio visual: 2º lugar (esquerda), 1º lugar (centro, mais alto), 3º lugar (direita)
    const podiumOrder = [
      { item: podiumItems[1], rank: 2, label: '🥈 2º LUGAR', medalBg: '#94a3b8', heightFactor: 0.84, offsetIndex: 0 },
      { item: podiumItems[0], rank: 1, label: '🥇 1º LUGAR', medalBg: '#f59e0b', heightFactor: 1.0, offsetIndex: 1 },
      { item: podiumItems[2], rank: 3, label: '🥉 3º LUGAR', medalBg: '#b45309', heightFactor: 0.74, offsetIndex: 2 }
    ].filter(p => !!p.item);

    const podiumH = restItems.length > 0 ? Math.min(380, rect.height * 0.58) : rect.height;
    const colW = Math.min(260, (rect.width - 48) / Math.max(1, podiumOrder.length));
    const startX = rect.x + (rect.width - (colW * podiumOrder.length + 24 * (podiumOrder.length - 1))) / 2;

    podiumOrder.forEach((p, idx) => {
      const px = startX + idx * (colW + 24);
      const cardH = (podiumH - 70) * p.heightFactor;
      const cardW = Math.min(colW, cardH * 0.68);
      const py = rect.y + (podiumH - cardH) - 40;
      const cx = px + (colW - cardW) / 2;

      // Badge de pódio
      ctx.save();
      ctx.fillStyle = p.medalBg;
      this.roundRect(ctx, cx, py - 32, cardW, 26, 13);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.label, cx + cardW / 2, py - 15);
      ctx.restore();

      this.drawCoverCard(
        ctx,
        cx,
        py,
        cardW,
        cardH,
        p.item,
        covers.get(p.item.coverPath || ''),
        options
      );
    });

    // Se houver mais itens, lista os demais abaixo com cards compactos numerados
    if (restItems.length > 0) {
      const restRect = {
        x: rect.x,
        y: rect.y + podiumH + 16,
        width: rect.width,
        height: rect.height - podiumH - 16
      };

      const cols = restItems.length > 4 ? 2 : 1;
      const rows = Math.ceil(restItems.length / cols);
      const gap = 12;
      const cW = (restRect.width - gap * (cols - 1)) / cols;
      const rH = Math.min(68, (restRect.height - gap * (rows - 1)) / rows);

      restItems.forEach((it, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        const rx = restRect.x + c * (cW + gap);
        const ry = restRect.y + r * (rH + gap);

        ctx.fillStyle = isLight ? 'rgba(255,255,255,0.7)' : 'rgba(30, 41, 59, 0.45)';
        ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        this.roundRect(ctx, rx, ry, cW, rH, 12);
        ctx.fill();
        ctx.stroke();

        // Número da posição (#4, #5...)
        ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
        ctx.font = 'bold 15px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`#${i + 4}`, rx + 24, ry + rH / 2 + 5);

        // Capa mini
        const covH = rH - 12;
        const covW = covH * 0.68;
        this.drawCoverCard(
          ctx,
          rx + 44,
          ry + 6,
          covW,
          covH,
          it,
          covers.get(it.coverPath || ''),
          { ...options, showCoverTitles: false, showProgressBadge: false }
        );

        // Título e tempo
        ctx.textAlign = 'left';
        ctx.fillStyle = isLight ? '#0f172a' : '#f8fafc';
        ctx.font = 'bold 14px "Inter", sans-serif';
        this.drawTruncatedText(ctx, it.title, rx + 44 + covW + 14, ry + rH * 0.42, cW - covW - 130);

        ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
        ctx.font = '500 12px "Inter", sans-serif';
        const tStr = `⏱ ${formatReadingDuration(it.secondsReadInPeriod)} • ${it.pagesReadInPeriod}p`;
        this.drawTruncatedText(ctx, tStr, rx + 44 + covW + 14, ry + rH * 0.76, cW - covW - 130);
      });
    }
  }

  // ==========================================
  // Layout 8: Glass Cards (Vitrine Glassmorphism)
  // ==========================================

  private renderGlassCards(
    ctx: CanvasRenderingContext2D,
    rect: { x: number; y: number; width: number; height: number },
    items: SocialShareItem[],
    covers: Map<string, HTMLImageElement>,
    options: SocialRenderOptions
  ): void {
    if (items.length === 0) return;

    const isLight = this.isThemeLight(options);
    const cols = items.length > 6 ? 2 : 1;
    const rows = Math.ceil(items.length / cols);
    const colGap = 20;
    const rowGap = 16;
    const colW = (rect.width - colGap * (cols - 1)) / cols;
    const rowH = (rect.height - rowGap * (rows - 1)) / rows;

    items.forEach((item, idx) => {
      const c = idx % cols;
      const r = Math.floor(idx / cols);
      const x = rect.x + c * (colW + colGap);
      const y = rect.y + r * (rowH + rowGap);

      ctx.save();

      // Card com efeito de vidro fosco translúcido
      ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.78)' : 'rgba(15, 23, 42, 0.6)';
      ctx.strokeStyle = isLight ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 6;
      this.roundRect(ctx, x, y, colW, rowH, 18);
      ctx.fill();
      ctx.stroke();
      ctx.shadowColor = 'transparent';

      // Capa flutuante com sombra 3D à esquerda
      const pad = 14;
      const coverH = rowH - pad * 2;
      const coverW = coverH * 0.68;
      this.drawCoverCard(
        ctx,
        x + pad,
        y + pad,
        coverW,
        coverH,
        item,
        covers.get(item.coverPath || ''),
        { ...options, showCoverTitles: false }
      );

      // Metadados à direita
      const textX = x + pad + coverW + 18;
      const maxTextW = colW - coverW - pad * 2 - 30;

      ctx.textAlign = 'left';
      ctx.fillStyle = isLight ? '#0f172a' : '#f8fafc';
      const titleFont = Math.max(14, Math.min(20, Math.round(rowH * 0.18)));
      ctx.font = `bold ${titleFont}px "Inter", "Segoe UI", sans-serif`;
      this.drawTruncatedText(ctx, item.title, textX, y + rowH * 0.32, maxTextW);

      ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
      const subFont = Math.max(11, Math.min(14, Math.round(rowH * 0.13)));
      ctx.font = `500 ${subFont}px "Inter", "Segoe UI", sans-serif`;
      const authorOrType = item.author || (item.type === 'BOOK' ? 'Livro' : 'Mangá');
      this.drawTruncatedText(ctx, authorOrType, textX, y + rowH * 0.52, maxTextW);

      // Chips de estatística
      const chipY = y + rowH * 0.65;
      const timeStr = `⏱ ${formatReadingDuration(item.secondsReadInPeriod)}`;
      const pageStr = `📖 ${item.pagesReadInPeriod}p`;

      ctx.font = `600 ${subFont}px "Inter", "Segoe UI", sans-serif`;
      const timeW = ctx.measureText(timeStr).width + 16;
      const pageW = ctx.measureText(pageStr).width + 16;

      // Chip 1: Tempo
      ctx.fillStyle = isLight ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.2)';
      this.roundRect(ctx, textX, chipY, timeW, 24, 12);
      ctx.fill();
      ctx.fillStyle = isLight ? '#4f46e5' : '#a5b4fc';
      ctx.fillText(timeStr, textX + 8, chipY + 16);

      // Chip 2: Páginas
      ctx.fillStyle = isLight ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.2)';
      this.roundRect(ctx, textX + timeW + 8, chipY, pageW, 24, 12);
      ctx.fill();
      ctx.fillStyle = isLight ? '#059669' : '#6ee7b7';
      ctx.fillText(pageStr, textX + timeW + 16, chipY + 16);

      ctx.restore();
    });
  }

  // ==========================================
  // Utilitários de Desenho (Cards, Formas, Textos)
  // ==========================================

  private drawCoverCard(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    item: SocialShareItem,
    coverImg: HTMLImageElement | undefined,
    options: SocialRenderOptions
  ): void {
    ctx.save();

    // Sombra 3D suave
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 10;

    const radius = Math.max(8, Math.min(14, Math.round(w * 0.06)));

    // Fundo da capa / fallback
    ctx.fillStyle = item.type === 'BOOK' ? '#b45309' : '#4338ca';
    this.roundRect(ctx, x, y, w, h, radius);
    ctx.fill();

    // Reset shadow para não vazar no interior
    ctx.shadowColor = 'transparent';

    // Clip para renderizar a imagem com bordas arredondadas
    ctx.save();
    this.roundRect(ctx, x, y, w, h, radius);
    ctx.clip();

    let drawW = w;
    let drawH = h;
    let drawX = x;
    let drawY = y;

    if (coverImg) {
      // Ajuste "cover" (preenche sem distorcer)
      const imgRatio = coverImg.width / coverImg.height;
      const cardRatio = w / h;

      if (imgRatio > cardRatio) {
        drawW = h * imgRatio;
        drawX = x - (drawW - w) / 2;
      } else {
        drawH = w / imgRatio;
        drawY = y - (drawH - h) / 2;
      }

      ctx.drawImage(coverImg, drawX, drawY, drawW, drawH);
    } else {
      // Fallback elegante quando não há capa
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(x, y, w, h);

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.font = 'bold 15px "Inter", sans-serif';
      this.drawWordWrappedText(ctx, item.title, x + w / 2, y + h * 0.35, w - 24, 20);
    }

    // Rodapé do Card: Nome do Arquivo/Obra + Tempo de Leitura abaixo (Fade vs. Blur)
    if (options.showCoverTitles) {
      const titleFontPx = Math.max(11, Math.min(15, Math.round(w * 0.068)));
      const subFontPx = Math.max(10, Math.min(13, Math.round(w * 0.054)));
      const padX = Math.max(8, Math.min(14, Math.round(w * 0.055)));
      const barH = Math.max(42, Math.min(68, titleFontPx + subFontPx + 22));
      const barY = y + h - barH;

      if (options.useCardBlur) {
        // Modo BLUR (Frosted Glass na barra de texto)
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, barY, w, barH);
        ctx.clip();

        if (coverImg) {
          ctx.filter = 'blur(12px) saturate(140%) brightness(0.55)';
          ctx.drawImage(coverImg, drawX - 16, drawY - 16, drawW + 32, drawH + 32);
          ctx.filter = 'none';
        }

        // Camada vítrea escura translúcida para contraste uniforme
        ctx.fillStyle = 'rgba(15, 23, 42, 0.62)';
        ctx.fillRect(x, barY, w, barH);

        // Linha superior sutil de vidro
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, barY + 0.5);
        ctx.lineTo(x + w, barY + 0.5);
        ctx.stroke();

        ctx.restore();
      } else {
        // Modo FADE (Gradiente escuro suave na base da imagem)
        const fadeStartY = y + h - Math.max(barH * 1.65, h * 0.48);
        const grad = ctx.createLinearGradient(0, fadeStartY, 0, y + h);
        grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        grad.addColorStop(0.45, 'rgba(0, 0, 0, 0.62)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0.92)');
        ctx.fillStyle = grad;
        ctx.fillRect(x, fadeStartY, w, y + h - fadeStartY);
      }

      // Sombra de texto leve para máxima nitidez
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 1;

      // Linha 1: Nome do Arquivo / Obra
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.font = `bold ${titleFontPx}px "Inter", "Segoe UI", sans-serif`;
      const titleY = y + h - subFontPx - 12;
      this.drawTruncatedText(ctx, item.title, x + padX, titleY, w - padX * 2);

      // Linha 2: Tempo de leitura abaixo (+ páginas lidas no período)
      ctx.fillStyle = '#e2e8f0';
      ctx.font = `600 ${subFontPx}px "Inter", "Segoe UI", sans-serif`;
      const timeFormatted = formatReadingDuration(item.secondsReadInPeriod || 0);
      const subParts = [`⏱ ${timeFormatted}`];
      if (item.pagesReadInPeriod > 0) {
        subParts.push(`${item.pagesReadInPeriod}p`);
      }
      const subLine = subParts.join(' • ');
      const subY = y + h - 7;
      this.drawTruncatedText(ctx, subLine, x + padX, subY, w - padX * 2);

      ctx.restore();
    }

    ctx.restore(); // Desfaz clip da capa

    // Borda sutil de destaque ao redor do card
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, x, y, w, h, radius);
    ctx.stroke();

    // Badge de Concluído ou Progresso no topo direito do card
    if (options.showProgressBadge) {
      if (item.completed) {
        ctx.fillStyle = '#10b981';
        this.roundRect(ctx, x + w - 34, y + 10, 24, 24, 12);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.font = 'bold 14px "Inter", sans-serif';
        ctx.fillText('✓', x + w - 22, y + 26);
      } else if (item.bookMark > 0 && item.pages > 1) {
        const pct = `${Math.round((item.bookMark / item.pages) * 100)}%`;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        this.roundRect(ctx, x + w - 48, y + 10, 38, 22, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#e2e8f0';
        ctx.textAlign = 'center';
        ctx.font = 'bold 11px "Inter", sans-serif';
        ctx.fillText(pct, x + w - 29, y + 25);
      }
    }

    ctx.restore();
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number
  ): void {
    const r = Math.min(radius, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  private drawTruncatedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number
  ): void {
    if (!text || maxWidth <= 0) return;
    if (ctx.measureText(text).width <= maxWidth) {
      ctx.fillText(text, x, y);
      return;
    }

    let truncated = text;
    while (truncated.length > 0 && ctx.measureText(truncated + '…').width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    ctx.fillText(truncated + '…', x, y);
  }

  private drawWordWrappedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ): void {
    const words = (text || '').split(' ');
    let line = '';
    let curY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line, x, curY);
        line = words[n] + ' ';
        curY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, curY);
  }
}
