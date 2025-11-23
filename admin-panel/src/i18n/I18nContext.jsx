import { createContext, useContext, useState, useEffect } from 'react';
import { translations } from './translations';

const I18nContext = createContext(null);

const STORAGE_KEY = 'pspay_language';
const DEFAULT_LANGUAGE = 'tr';

export const I18nProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    // Get language from localStorage or browser
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && translations[stored]) {
      return stored;
    }

    // Detect browser language
    const browserLang = navigator.language.split('-')[0];
    return translations[browserLang] ? browserLang : DEFAULT_LANGUAGE;
  });

  useEffect(() => {
    // Save language to localStorage
    localStorage.setItem(STORAGE_KEY, language);

    // Set HTML lang attribute
    document.documentElement.lang = language;
  }, [language]);

  const t = (key, params = {}) => {
    const text = translations[language]?.[key] || translations[DEFAULT_LANGUAGE]?.[key] || key;

    // Replace parameters
    return Object.keys(params).reduce((str, param) => {
      return str.replace(new RegExp(`{{${param}}}`, 'g'), params[param]);
    }, text);
  };

  const changeLanguage = (newLang) => {
    if (translations[newLang]) {
      setLanguage(newLang);
    }
  };

  const value = {
    language,
    t,
    changeLanguage,
    languages: Object.keys(translations),
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useTranslation = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within I18nProvider');
  }
  return context;
};

// Hook alias
export const useI18n = useTranslation;
