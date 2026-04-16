import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ru from './locales/ru.json';
import en from './locales/en.json';
import de from './locales/de.json';

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
    lng: 'de', // default language
    fallbackLng: 'de',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
