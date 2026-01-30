import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'bi-kanpe-theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');

  // システムのカラースキーム設定を取得
  const getSystemTheme = (): ResolvedTheme => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  };

  // テーマモードから実際に適用するテーマを解決
  const resolveTheme = (mode: ThemeMode): ResolvedTheme => {
    if (mode === 'system') {
      return getSystemTheme();
    }
    return mode;
  };

  // Tauriのネイティブウィンドウテーマを同期
  const syncNativeTheme = async (theme: ThemeMode) => {
    try {
      const window = getCurrentWindow();
      if (theme === 'system') {
        await window.setTheme(null);
      } else {
        await window.setTheme(theme);
      }
    } catch (error) {
      console.error('Failed to sync native theme:', error);
    }
  };

  // DOMにテーマを適用
  const applyTheme = (mode: ThemeMode, resolved: ResolvedTheme) => {
    const root = document.documentElement;
    root.setAttribute('data-theme', mode);
    root.setAttribute('data-resolved-theme', resolved);
  };

  // テーマモードを変更
  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem(STORAGE_KEY, mode);
    
    const resolved = resolveTheme(mode);
    setResolvedTheme(resolved);
    applyTheme(mode, resolved);
    syncNativeTheme(mode);
  };

  // 初回読み込み時にlocalStorageから設定を復元
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    const initialMode = stored || 'system';
    const resolved = resolveTheme(initialMode);
    
    setThemeModeState(initialMode);
    setResolvedTheme(resolved);
    applyTheme(initialMode, resolved);
    syncNativeTheme(initialMode);
  }, []);

  // システムモード時にOSのカラースキーム変更を監視
  useEffect(() => {
    if (themeMode !== 'system') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      const newResolvedTheme = e.matches ? 'dark' : 'light';
      setResolvedTheme(newResolvedTheme);
      applyTheme('system', newResolvedTheme);
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      // Legacy browsers
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, [themeMode]);

  return (
    <ThemeContext.Provider value={{ themeMode, resolvedTheme, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
