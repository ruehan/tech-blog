import { useEffect, useId, useState, type CSSProperties } from 'react';
import { Icon } from './Icons';

type Preferences = { size: 'small' | 'normal' | 'large'; width: 'narrow' | 'normal' | 'wide' };
const defaults: Preferences = { size: 'normal', width: 'normal' };

export function useReadingPreferences() {
  const [preferences, setPreferences] = useState<Preferences>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('journal-reading') ?? 'null');
      return {
        size: ['small', 'normal', 'large'].includes(saved?.size) ? saved.size : defaults.size,
        width: ['narrow', 'normal', 'wide'].includes(saved?.width) ? saved.width : defaults.width,
      };
    } catch { return defaults; }
  });
  useEffect(() => {
    try { localStorage.setItem('journal-reading', JSON.stringify(preferences)); }
    catch { /* Preferences remain usable without browser storage. */ }
  }, [preferences]);
  const style = {
    '--reading-size-offset': `${{ small: -2, normal: 0, large: 3 }[preferences.size]}px`,
    '--reading-width': `${{ narrow: 640, normal: 780, wide: 920 }[preferences.width]}px`,
  } as CSSProperties;
  return { preferences, setPreferences, style };
}

export function JournalReadingSettings({ preferences, onChange }: { preferences: Preferences; onChange: (value: Preferences) => void }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return <>
    <button className="rail-button" type="button" popoverTarget={id} aria-label="읽기 설정" aria-expanded={open} aria-controls={id} title="읽기 설정">
      <Icon name="reading"/><span className="journal-tooltip">읽기 설정</span>
    </button>
    <div id={id} popover="auto" className="reading-settings" role="region" aria-label="읽기 설정" onToggle={event => setOpen(event.newState === 'open')}>
      <div className="reading-settings-heading"><strong>읽기 설정</strong><button className="icon-button" type="button" popoverTarget={id} popoverTargetAction="hide" aria-label="읽기 설정 닫기"><Icon name="close" size={18}/></button></div>
      <fieldset><legend>글자 크기</legend><div className="reading-options">
        {(['small', 'normal', 'large'] as const).map((size, index) => <label key={size}><input type="radio" name={`${id}-size`} value={size} checked={preferences.size === size} onChange={() => onChange({ ...preferences, size })}/><span>{['작게', '기본', '크게'][index]}</span></label>)}
      </div></fieldset>
      <fieldset><legend>본문 너비</legend><div className="reading-options">
        {(['narrow', 'normal', 'wide'] as const).map((width, index) => <label key={width}><input type="radio" name={`${id}-width`} value={width} checked={preferences.width === width} onChange={() => onChange({ ...preferences, width })}/><span>{['좁게', '기본', '넓게'][index]}</span></label>)}
      </div></fieldset>
      <button className="reading-reset" type="button" disabled={preferences.size === 'normal' && preferences.width === 'normal'} onClick={() => onChange(defaults)}>기본값으로</button>
    </div>
  </>;
}
