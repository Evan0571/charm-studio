import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, Globe2 } from 'lucide-react';
import { formatMoney, LANGUAGE_STORAGE_KEY, resolveLanguage, translate, type Language } from '../shared/localization';
import type { Quote } from '../shared/types';
import './language.css';

function readLanguage(): Language {
  try { return resolveLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY)); }
  catch { return 'en'; }
}

const LanguageContext = createContext<{
  language: Language;
  locale: string;
  setLanguage: (language: Language) => void;
  tr: (text: string, ...values: (string | number)[]) => string;
  money: (value: number, currency?: Quote['currency']) => string;
} | null>(null);

export function LanguageProvider({ children, title = 'LOOP · 你的随身小个性' }: { children: ReactNode; title?: string }) {
  const [language, setLanguage] = useState<Language>(readLanguage);
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = translate(title, language);
    try { localStorage.setItem(LANGUAGE_STORAGE_KEY, language); } catch { /* Language switching also works when storage is unavailable. */ }
  }, [language, title]);
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === LANGUAGE_STORAGE_KEY || event.key === null) setLanguage(resolveLanguage(event.newValue)); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const value = useMemo(() => ({ language, locale: language === 'en' ? 'en-US' : 'zh-CN', setLanguage,
    tr: (text: string, ...values: (string | number)[]) => translate(text, language, ...values),
    money: (amount: number, currency?: Quote['currency']) => formatMoney(amount, language, currency),
  }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage requires LanguageProvider');
  return context;
}

export function LanguageSwitcher() {
  const { language, setLanguage, tr } = useLanguage();
  return <label className="language-switcher">
    <Globe2 size={15} aria-hidden="true"/>
    <select aria-label={tr('语言')} value={language} onChange={event => setLanguage(resolveLanguage(event.target.value))}>
      <option value="en" lang="en">English</option>
      <option value="zh-CN" lang="zh-CN">中文</option>
    </select>
    <ChevronDown size={12} aria-hidden="true"/>
  </label>;
}
