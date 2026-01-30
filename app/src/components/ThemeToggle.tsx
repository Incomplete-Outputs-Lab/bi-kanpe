import { useTheme, ThemeMode } from '../contexts/ThemeContext';

export function ThemeToggle() {
  const { themeMode, setThemeMode } = useTheme();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setThemeMode(e.target.value as ThemeMode);
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 12px',
      backgroundColor: 'var(--card-bg)',
      border: '1px solid var(--card-border)',
      borderRadius: '4px',
    }}>
      <label htmlFor="theme-select" style={{
        fontSize: '0.9rem',
        color: 'var(--text-color)',
        fontWeight: '500',
      }}>
        テーマ:
      </label>
      <select
        id="theme-select"
        value={themeMode}
        onChange={handleChange}
        style={{
          padding: '4px 8px',
          fontSize: '0.9rem',
          border: '1px solid var(--input-border)',
          borderRadius: '4px',
          backgroundColor: 'var(--input-bg)',
          color: 'var(--input-text)',
          cursor: 'pointer',
        }}
      >
        <option value="light">ライト</option>
        <option value="dark">ダーク</option>
        <option value="system">システム</option>
      </select>
    </div>
  );
}
