import messages from './messages.json';
import type { Catalog, Quote } from './types';

export type Language = 'en' | 'zh-CN';
export const LANGUAGE_STORAGE_KEY = 'loop-language';
export const resolveLanguage = (value: unknown): Language => value === 'zh-CN' ? 'zh-CN' : 'en';

const english: Record<string, string> = messages;
const chinese = new Map(Object.entries(english).map(([zh, en]) => [en, zh]));
const interpolate = (text: string, values: (string | number)[]) => text.replace(/\{(\d+)\}/g, (token, index) => String(values[Number(index)] ?? token));
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const patterns = Object.entries(english).filter(([source]) => source.includes('{0}')).flatMap(([zh, en]) => [zh, en].map(source => ({
  zh, en, regex: new RegExp(`^${source.split(/\{\d+\}/).map(escapeRegex).join('(.*?)')}$`, 'u'),
})));

// Translate only built-in copy and catalog metadata. User names and chat history
// stay as authored. Reverse lookup also keeps existing system notices reactive.
export function translate(text: string, language: Language, ...values: (string | number)[]): string {
  const source = Object.hasOwn(english, text) ? text : chinese.get(text) ?? text;
  if (Object.hasOwn(english, source)) return interpolate(language === 'en' ? english[source] : source, values);
  for (const pattern of patterns) {
    const match = text.match(pattern.regex);
    if (match) return interpolate(language === 'en' ? pattern.en : pattern.zh, match.slice(1).map(value => translate(value, language)));
  }
  return interpolate(text, values);
}

export function localizeCatalog(catalog: Catalog, language: Language): Catalog {
  const t = (text: string) => translate(text, language);
  return {
    ...catalog,
    templates: catalog.templates.map(template => ({ ...template, name: t(template.name), subtitle: t(template.subtitle), description: t(template.description), slots: template.slots.map(slot => ({ ...slot, name: t(slot.name) })) })),
    parts: catalog.parts.map(part => ({ ...part, name: t(part.name), material: t(part.material), tags: part.tags.map(t) })),
    connectors: catalog.connectors.map(connector => ({ ...connector, name: t(connector.name) })),
    cordColors: catalog.cordColors.map(color => ({ ...color, name: t(color.name) })),
  };
}

export function formatMoney(value: number, language: Language, currency: Quote['currency'] = 'USD'): string {
  return new Intl.NumberFormat(language === 'en' ? 'en-US' : 'zh-CN', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
}
