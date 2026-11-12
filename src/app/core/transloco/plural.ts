const rules = new Map<string, Intl.PluralRules>();

/**
 * The translation key for a counted text: `key.one`, `key.two`, `key.few` (3–10 in Arabic), `key.many` (11–99),
 * `key.zero` or `key.other`, chosen by the language's plural rules. Arabic needs all of them ("درس واحد", "درسان",
 * "5 دروس", "12 درسًا"); English uses one/other. Every counted text defines all six forms in both languages.
 */
export function pluralKey(key: string, count: number, lang: string): string {
  let rule = rules.get(lang);
  if (!rule) {
    rule = new Intl.PluralRules(lang === 'ar' ? 'ar' : 'en');
    rules.set(lang, rule);
  }
  return `${key}.${rule.select(count)}`;
}
