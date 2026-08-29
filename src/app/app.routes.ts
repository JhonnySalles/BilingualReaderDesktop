import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/library/library.component').then(m => m.LibraryComponent)
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent)
  },
  {
    path: 'reader-image/:id',
    loadComponent: () => import('./features/reader-image/reader-image.component').then(m => m.ReaderImageComponent)
  },
  {
    path: 'reader-text/:id',
    loadComponent: () => import('./features/reader-text/reader-text.component').then(m => m.ReaderTextComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
