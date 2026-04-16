import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ru from './locales/ru.json';
import en from './locales/en.json';
import de from './locales/de.json';
import { detectRuntimeLanguage } from './utils/i18nLanguage';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: en
      },
      ru: {
        translation: ru
      },
      de: {
        translation: de
      }
    },
    lng: detectRuntimeLanguage(),
    fallbackLng: 'de',
    supportedLngs: ['de', 'en', 'ru'],
    load: 'languageOnly',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
