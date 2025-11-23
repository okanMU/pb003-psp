import { Globe } from 'lucide-react';
import { useTranslation } from '../i18n/I18nContext';

/**
 * Language Switcher Component
 * Allows users to switch between supported languages
 */
export default function LanguageSwitcher() {
  const { language, changeLanguage, languages } = useTranslation();

  const languageNames = {
    tr: 'Türkçe',
    en: 'English',
  };

  const languageFlags = {
    tr: '🇹🇷',
    en: '🇬🇧',
  };

  return (
    <div className="relative group">
      <button className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg transition">
        <Globe className="w-5 h-5 text-gray-600" />
        <span className="text-sm font-medium text-gray-700">
          {languageFlags[language]} {languageNames[language]}
        </span>
      </button>

      {/* Dropdown */}
      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
        {languages.map((lang) => (
          <button
            key={lang}
            onClick={() => changeLanguage(lang)}
            className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition first:rounded-t-lg last:rounded-b-lg ${
              language === lang ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
            }`}
          >
            <span className="text-xl">{languageFlags[lang]}</span>
            <span className="font-medium">{languageNames[lang]}</span>
            {language === lang && (
              <span className="ml-auto text-blue-600">✓</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
