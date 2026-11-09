export type AppLang = 'en' | 'pt';

const messages = {
  en: {
    file: 'File',
    open: 'Open...',
    home: 'Home',
    library: 'Library',
    history: 'History',
    vocabulary: 'Vocabulary',
    statistics: 'Statistics',
    settings: 'Settings',
    help: 'Help',
    about: 'About',
    view: 'View',
    reload: 'Reload',
    forceReload: 'Force Reload',
    toggleDevTools: 'Toggle Developer Tools',
    resetZoom: 'Actual Size',
    zoomIn: 'Zoom In',
    zoomOut: 'Diminuir Zoom',
    togglefullscreen: 'Toggle Full Screen',
    exit: 'Exit',
    mangaLibraryDefault: 'Manga Library (Default)',
    bookLibraryDefault: 'Book Library (Default)',
    openFileTitle: 'Open Book or Manga',
    selectLibraryDirTitle: 'Select Library Directory'
  },
  pt: {
    file: 'Arquivo',
    open: 'Abrir...',
    home: 'Início',
    library: 'Biblioteca',
    history: 'Histórico',
    vocabulary: 'Vocabulário',
    statistics: 'Estatísticas',
    settings: 'Configurações',
    help: 'Ajuda',
    about: 'Sobre',
    view: 'Exibir',
    reload: 'Recarregar',
    forceReload: 'Forçar Recarregamento',
    toggleDevTools: 'Alternar Ferramentas de Desenvolvedor',
    resetZoom: 'Tamanho Real',
    zoomIn: 'Aumentar Zoom',
    zoomOut: 'Diminuir Zoom',
    togglefullscreen: 'Alternar Tela Cheia',
    exit: 'Sair',
    mangaLibraryDefault: 'Biblioteca de Mangás (Padrão)',
    bookLibraryDefault: 'Biblioteca de Livros (Padrão)',
    openFileTitle: 'Abrir Livro ou Mangá',
    selectLibraryDirTitle: 'Selecionar Diretório de Biblioteca'
  }
};

let currentLang: AppLang = 'en';

export function setAppLanguage(lang: string): void {
  currentLang = lang?.toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

export function getAppLanguage(): AppLang {
  return currentLang;
}

export function t(key: keyof typeof messages['en']): string {
  return messages[currentLang]?.[key] || messages['en']?.[key] || key;
}

