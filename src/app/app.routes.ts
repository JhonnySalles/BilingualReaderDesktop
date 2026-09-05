import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./core/layout/main-layout.component').then(m => m.MainLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./features/library/library.component').then(m => m.LibraryComponent)
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent)
      },
      {
        path: 'statistics',
        loadComponent: () => import('./features/statistics/statistics.component').then(m => m.StatisticsComponent)
      },
      {
        path: 'statistics/history/:type',
        loadComponent: () =>
          import('./features/statistics/statistics-history.component').then(m => m.StatisticsHistoryComponent)
      },
      {
        path: 'history',
        loadComponent: () =>
          import('./features/statistics/statistics-history.component').then(m => m.StatisticsHistoryComponent)
      },
      {
        path: 'detail/manga/:id',
        loadComponent: () => import('./features/detail/manga-detail.component').then(m => m.MangaDetailComponent)
      },
      {
        path: 'detail/book/:id',
        loadComponent: () => import('./features/detail/book-detail.component').then(m => m.BookDetailComponent)
      },
      {
        path: 'vocabulary',
        loadComponent: () => import('./features/detail/vocabulary-stub.component').then(m => m.VocabularyStubComponent)
      }
    ]
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
