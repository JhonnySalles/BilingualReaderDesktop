import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

@Component({
  selector: 'app-book-cover-3d',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative w-full h-full flex items-center justify-center">
      <div #container class="w-full h-full min-h-[300px] outline-none"></div>
      
      @if (loading()) {
        <div class="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm rounded-xl">
          <div class="flex flex-col items-center gap-3">
            <svg class="animate-spin h-8 w-8 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span class="text-xs font-semibold text-slate-300">Carregando Capa 3D...</span>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
  `]
})
export class BookCover3dComponent implements OnInit, OnDestroy {
  @ViewChild('container', { static: true }) containerRef!: ElementRef<HTMLDivElement>;

  @Input() set coverUrl(value: string | null) {
    this._coverUrl.set(value);
  }
  @Input() set backCoverUrl(value: string | null) {
    this._backCoverUrl.set(value);
  }
  @Input() isPopup = false;
  @Input() isFullCover = false;

  private _coverUrl = signal<string | null>(null);
  private _backCoverUrl = signal<string | null>(null);
  loading = signal(true);

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private model?: THREE.Group;
  private animationId?: number;
  private resizeObserver?: ResizeObserver;
  
  private frontLight!: THREE.DirectionalLight;
  private backLight!: THREE.DirectionalLight;

  constructor() {
    effect(() => {
      const url = this._coverUrl();
      const backUrl = this._backCoverUrl();
      if (url && this.model) {
        this.generateAndApplyTexture(url, backUrl);
      }
    });
  }

  ngOnInit() {
    this.initThreeJs();
    this.loadModel();
  }

  ngOnDestroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.resizeObserver?.disconnect();
    
    if (this.renderer) {
      this.renderer.dispose();
      this.containerRef.nativeElement.removeChild(this.renderer.domElement);
    }
    
    if (this.scene) {
      this.scene.clear();
    }
  }

  private initThreeJs() {
    const container = this.containerRef.nativeElement;
    const width = container.clientWidth || 300;
    const height = container.clientHeight || 400;
    
    this.scene = new THREE.Scene();
    
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 0, 3.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0); // Transparent background
    
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.enableZoom = this.isPopup;
    this.controls.enablePan = false;
    this.controls.target.set(0, this.isPopup ? 0 : -0.25, 0);
    this.controls.update();

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    hemiLight.position.set(0, 20, 0);
    this.scene.add(hemiLight);

    this.frontLight = new THREE.DirectionalLight(0xffffff, 2.0);
    this.frontLight.position.set(0, 2, 4);
    this.scene.add(this.frontLight);

    this.backLight = new THREE.DirectionalLight(0xffffff, 1.5);
    this.backLight.position.set(0, -2, -4);
    this.scene.add(this.backLight);

    this.resizeObserver = new ResizeObserver(() => this.onWindowResize());
    this.resizeObserver.observe(container);

    this.animate();
  }

  private loadModel() {
    const loader = new GLTFLoader();
    
    loader.load('assets/models/3d_book_cover.glb', (gltf: GLTF) => {
      const rawModel = gltf.scene;
      if (!rawModel) return;

      // Wrapper group for precise centering, scaling and rotation
      const wrapper = new THREE.Group();

      // Compute bounding box of raw model
      const box = new THREE.Box3().setFromObject(rawModel);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1.0;

      // Center raw model inside wrapper
      rawModel.position.x = -center.x;
      rawModel.position.y = -center.y;
      rawModel.position.z = -center.z;

      wrapper.add(rawModel);

      // Scale to unit size multiplied by view scale (2x larger in popup for clearer view)
      const unitScale = (1.0 / maxDim) * (this.isPopup ? 3.0 : 1.9);
      wrapper.scale.set(unitScale, unitScale, unitScale);
      
      // Rotate 180 degrees on Y axis so front cover faces camera
      wrapper.rotation.y = Math.PI;
      
      // Posiciona no centro vertical no popup (0) e com offset suave no card de detalhe (-0.25)
      wrapper.position.y = this.isPopup ? 0 : -0.25;

      this.scene.add(wrapper);
      this.model = wrapper;

      if (this._coverUrl()) {
        this.generateAndApplyTexture(this._coverUrl()!, this._backCoverUrl());
      } else {
        this.loading.set(false);
      }
    }, undefined, (error: unknown) => {
      console.error('An error happened while loading the 3D model:', error);
      this.loading.set(false);
    });
  }

  private async generateAndApplyTexture(coverUrl: string, backCoverUrl: string | null = null) {
    this.loading.set(true);
    try {
      const loadPromises: [Promise<HTMLImageElement>, Promise<HTMLImageElement>, Promise<HTMLImageElement | null>] = [
        this.loadImage(coverUrl),
        this.loadImage('assets/models/malha_book_cover.png'),
        backCoverUrl ? this.loadImage(backCoverUrl).catch(() => null) : Promise.resolve(null)
      ];

      const [coverImg, meshImg, backImg] = await Promise.all(loadPromises);

      const canvas = document.createElement('canvas');
      canvas.width = meshImg.width;
      canvas.height = meshImg.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      // Draw original mesh
      ctx.drawImage(meshImg, 0, 0);

      // Get predominant color from cover
      const baseColor = this.getPredominantColor(coverImg);

      // Replace green color
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Fast condition for lime green #3CFF00
        if (g > 200 && r < 100 && b < 50) {
          data[i] = baseColor.r;
          data[i + 1] = baseColor.g;
          data[i + 2] = baseColor.b;
        }
      }
      ctx.putImageData(imageData, 0, 0);

      // Detecta se é capa dupla pela flag ou automaticamente pela proporção (largura/altura >= 1.2)
      const isDoubleCover = this.isFullCover || (coverImg.width / coverImg.height >= 1.2);

      if (isDoubleCover) {
        // Calculate flaps
        const { cropLeft, cropRight } = this.calculateFlaps(coverImg);
        const effectiveWidth = coverImg.width - cropLeft - cropRight;
        
        const FRONT_COVER_WIDTH_RATIO = 0.475;
        const SPINE_WIDTH_RATIO = 0.05;

        const frontWidth = Math.floor(effectiveWidth * FRONT_COVER_WIDTH_RATIO);
        const spineWidth = Math.floor(effectiveWidth * SPINE_WIDTH_RATIO);
        
        const originalHeight = coverImg.height;

        // Draw Back Cover (rotated 180)
        const backSrc = { x: cropLeft + frontWidth + spineWidth, y: 0, w: coverImg.width - cropRight - (cropLeft + frontWidth + spineWidth), h: originalHeight };
        const backDst = { x: 0, y: 1250, w: 1750, h: 4096 - 1250 };
        
        ctx.save();
        ctx.translate(backDst.x + backDst.w / 2, backDst.y + backDst.h / 2);
        ctx.rotate(Math.PI);
        ctx.drawImage(coverImg, backSrc.x, backSrc.y, backSrc.w, backSrc.h, -backDst.w / 2, -backDst.h / 2, backDst.w, backDst.h);
        ctx.restore();

        // Draw Front Cover (rotated 180)
        const frontSrc = { x: cropLeft, y: 0, w: frontWidth, h: originalHeight };
        const frontDst = { x: 1758, y: 1250, w: 3520 - 1758, h: 4096 - 1250 };
        
        ctx.save();
        ctx.translate(frontDst.x + frontDst.w / 2, frontDst.y + frontDst.h / 2);
        ctx.rotate(Math.PI);
        ctx.drawImage(coverImg, frontSrc.x, frontSrc.y, frontSrc.w, frontSrc.h, -frontDst.w / 2, -frontDst.h / 2, frontDst.w, frontDst.h);
        ctx.restore();

        // Draw Spine (rotated -90)
        const spineSrc = { x: cropLeft + frontWidth, y: 0, w: spineWidth, h: originalHeight };
        const spineDst = { x: 0, y: 276, w: 2880, h: 770 - 276 };
        
        ctx.save();
        ctx.translate(spineDst.x + spineDst.w / 2, spineDst.y + spineDst.h / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.drawImage(coverImg, spineSrc.x, spineSrc.y, spineSrc.w, spineSrc.h, -spineDst.h / 2, -spineDst.w / 2, spineDst.h, spineDst.w);
        ctx.restore();
      } else {
        // Se houver capa traseira separada
        if (backImg) {
          const backSrc = { x: 0, y: 0, w: backImg.width, h: backImg.height };
          const backDst = { x: 0, y: 1250, w: 1750, h: 4096 - 1250 };
          ctx.save();
          ctx.translate(backDst.x + backDst.w / 2, backDst.y + backDst.h / 2);
          ctx.rotate(Math.PI);
          ctx.drawImage(backImg, backSrc.x, backSrc.y, backSrc.w, backSrc.h, -backDst.w / 2, -backDst.h / 2, backDst.w, backDst.h);
          ctx.restore();
        }

        // Front cover
        const frontSrc = { x: 0, y: 0, w: coverImg.width, h: coverImg.height };
        const frontDst = { x: 1758, y: 1250, w: 3520 - 1758, h: 4096 - 1250 };
        ctx.save();
        ctx.translate(frontDst.x + frontDst.w / 2, frontDst.y + frontDst.h / 2);
        ctx.rotate(Math.PI);
        ctx.drawImage(coverImg, frontSrc.x, frontSrc.y, frontSrc.w, frontSrc.h, -frontDst.w / 2, -frontDst.h / 2, frontDst.w, frontDst.h);
        ctx.restore();
      }

      // Apply texture to model
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = false;

      this.model?.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.material) {
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const mat of materials) {
              const standardMat = mat as THREE.MeshStandardMaterial;
              if (standardMat.isMeshStandardMaterial || (standardMat as any).map !== undefined) {
                standardMat.map = texture;
                standardMat.needsUpdate = true;
              }
            }
          }
        }
      });
      
    } catch (e) {
      console.error('Failed to generate 3d cover texture', e);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadImage(url: string): Promise<HTMLImageElement> {
    // Normaliza barras invertidas do Windows para barras normais em URLs
    let normalizedUrl = url.replace(/\\/g, '/');
    if (normalizedUrl.startsWith('local-cover:')) {
      const rawPath = normalizedUrl.replace(/^local-cover:\/*/, '');
      normalizedUrl = 'local-cover:///' + rawPath;
    }

    let objectUrlToRevoke: string | null = null;
    let effectiveUrl = normalizedUrl;

    try {
      if (normalizedUrl.startsWith('local-cover:') || /^https?:\/\//i.test(normalizedUrl)) {
        const response = await fetch(normalizedUrl);
        if (response.ok) {
          const blob = await response.blob();
          effectiveUrl = URL.createObjectURL(blob);
          objectUrlToRevoke = effectiveUrl;
        }
      }
    } catch (e) {
      console.warn('[BookCover3d] Could not fetch cover as blob, using direct URL:', e);
      effectiveUrl = normalizedUrl;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      if (/^https?:\/\//i.test(effectiveUrl)) {
        img.crossOrigin = 'Anonymous';
      }
      img.onload = () => {
        if (objectUrlToRevoke) {
          setTimeout(() => URL.revokeObjectURL(objectUrlToRevoke!), 5000);
        }
        resolve(img);
      };
      img.onerror = (err) => {
        if (objectUrlToRevoke) {
          URL.revokeObjectURL(objectUrlToRevoke);
        }
        reject(err);
      };
      img.src = effectiveUrl;
    });
  }

  private getPredominantColor(img: HTMLImageElement): { r: number, g: number, b: number } {
    const defaultColor = { r: 50, g: 50, b: 50 };
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = img.width;
    canvas.height = img.height;
    if (!ctx) return defaultColor;
    
    try {
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      
      let r = 0, g = 0, b = 0;
      let count = 0;
      const step = Math.max(4, Math.floor(data.length / 400)) * 4;
      
      for (let i = 0; i < data.length; i += step) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count++;
      }
      
      if (count === 0) return defaultColor;
      
      return {
        r: Math.floor(r / count),
        g: Math.floor(g / count),
        b: Math.floor(b / count)
      };
    } catch (e) {
      console.warn('[BookCover3d] Could not extract predominant color, using default fallback:', e);
      return defaultColor;
    }
  }

  private calculateFlaps(img: HTMLImageElement): { cropLeft: number, cropRight: number } {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = img.width;
    canvas.height = img.height;
    if (!ctx) return { cropLeft: 0, cropRight: 0 };
    
    try {
      ctx.drawImage(img, 0, 0);
      const centerY = Math.floor(img.height / 2);
      const data = ctx.getImageData(0, centerY, img.width, 1).data;
      
      const isColorSimilar = (r1: number, g1: number, b1: number, r2: number, g2: number, b2: number) => {
        const dist = (r1-r2)*(r1-r2) + (g1-g2)*(g1-g2) + (b1-b2)*(b1-b2);
        return dist <= 1500;
      };

      const leftR = data[0], leftG = data[1], leftB = data[2];
      let cropLeft = 0;
      for (let x = 0; x < img.width / 3; x++) {
        const idx = x * 4;
        if (!isColorSimilar(leftR, leftG, leftB, data[idx], data[idx+1], data[idx+2])) {
          cropLeft = x;
          break;
        }
      }

      const rightIdx = (img.width - 1) * 4;
      const rightR = data[rightIdx], rightG = data[rightIdx+1], rightB = data[rightIdx+2];
      let cropRight = 0;
      for (let x = img.width - 1; x >= (img.width * 2) / 3; x--) {
        const idx = x * 4;
        if (!isColorSimilar(rightR, rightG, rightB, data[idx], data[idx+1], data[idx+2])) {
          cropRight = (img.width - 1) - x;
          break;
        }
      }

      const effectiveWidth = img.width - cropLeft - cropRight;
      const ratio = effectiveWidth / img.height;

      if (cropLeft > 0 || cropRight > 0) {
        if (ratio >= 1.35 && ratio <= 1.65) {
          return { cropLeft, cropRight };
        }
      }

      const originalRatio = img.width / img.height;
      if (originalRatio > 1.7) {
        const expectedWidth = Math.floor(img.height * 1.5);
        const excess = img.width - expectedWidth;
        if (excess > 0) {
          return { cropLeft: Math.floor(excess / 2), cropRight: excess - Math.floor(excess / 2) };
        }
      }
    } catch (e) {
      console.warn('[BookCover3d] Could not calculate flaps via pixel data:', e);
    }

    return { cropLeft: 0, cropRight: 0 };
  }

  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate);
    
    if (this.controls) {
      this.controls.update();
    }
    
    // Update lights to follow camera slightly
    if (this.camera && this.frontLight && this.backLight) {
      const camDir = new THREE.Vector3();
      this.camera.getWorldDirection(camDir);
      
      const up = this.camera.up.clone();
      const right = new THREE.Vector3().crossVectors(camDir, up).normalize();
      
      // Front light
      const fDir = camDir.clone().add(right.clone().multiplyScalar(0.3)).sub(up.clone().multiplyScalar(0.3));
      this.frontLight.position.copy(this.camera.position).add(fDir);
      
      // Back light
      const bDir = camDir.clone().negate().sub(right.clone().multiplyScalar(0.3)).add(up.clone().multiplyScalar(0.3));
      this.backLight.position.copy(this.camera.position).add(bDir.multiplyScalar(2));
    }
    
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private onWindowResize() {
    if (!this.containerRef || !this.camera || !this.renderer) return;
    
    const container = this.containerRef.nativeElement;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}
