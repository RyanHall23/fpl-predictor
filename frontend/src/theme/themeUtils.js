// Theme utility functions and constants

/**
 * Theme mode constants
 */
export const THEME_MODES = {
  DARK: 'dark',
  LIGHT: 'light',
};

/**
 * Local storage key for theme preference
 */
export const THEME_STORAGE_KEY = 'fpl-predictor-theme-mode';

/**
 * Save theme preference to localStorage
 * @param {string} mode - 'dark' or 'light'
 */
export const saveThemePreference = (mode) => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch (error) {
    console.warn('Failed to save theme preference:', error);
  }
};

/**
 * Load theme preference from localStorage
 * @returns {string} - 'dark' or 'light', defaults to 'dark'
 */
export const loadThemePreference = () => {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === THEME_MODES.LIGHT ? THEME_MODES.LIGHT : THEME_MODES.DARK;
  } catch (error) {
    console.warn('Failed to load theme preference:', error);
    return THEME_MODES.DARK;
  }
};

/**
 * Get system theme preference
 * @returns {string} - 'dark' or 'light'
 */
export const getSystemThemePreference = () => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? THEME_MODES.DARK
      : THEME_MODES.LIGHT;
  }
  return THEME_MODES.DARK;
};

/**
 * Listen for system theme changes
 * @param {function} callback - Called when system theme changes
 * @returns {function} - Cleanup function to remove listener
 */
export const watchSystemTheme = (callback) => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e) => {
      callback(e.matches ? THEME_MODES.DARK : THEME_MODES.LIGHT);
    };
    
    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    // Older browsers
    else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }
  
  return () => {}; // No-op cleanup
};
