const SUPPORTED_LANGUAGES = ['de', 'en', 'ru'] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

export const detectLanguage = (rawLanguage?: string): SupportedLanguage => {
  if (!rawLanguage) {
    return 'de';
  }

  const language = rawLanguage.toLowerCase().split('-')[0];

  return SUPPORTED_LANGUAGES.includes(language as SupportedLanguage)
    ? (language as SupportedLanguage)
    : 'de';
};

export const detectRuntimeLanguage = (): SupportedLanguage => {
  if (typeof navigator === 'undefined') {
    return 'de';
  }

  return detectLanguage(navigator.language);
};
