# Theme System Documentation

## Overview

This application now features a comprehensive dark/light theme system inspired by the UserProfilePane component styling. The theme system provides a cohesive, professional look across all components with smooth transitions between dark and light modes.

## Features

### 🌙 Default Dark Mode
- Deep purple/indigo gradient backgrounds
- High contrast text for readability
- Elegant shadows and borders
- Perfect for extended viewing sessions

### ☀️ Optional Light Mode
- Clean, bright interface
- Soft gradients for reduced eye strain
- Professional appearance
- Great for daytime use

### 🎨 Theme Toggle
- Convenient toggle button in the navigation bar
- Sun/moon icons for intuitive mode switching
- Instant theme switching
- State persists within session

## Architecture

### Theme Files

#### `/src/theme/theme.js`
Defines the dark and light theme configurations using Material-UI's `createTheme`:

**Dark Theme Colors:**
- Primary: `#6a1b9a` (deep purple)
- Secondary: `#ab47bc` (lighter purple)
- Background: Gradient from `#23272f` to `#281455`
- Field: Dark green gradients for football pitch

**Light Theme Colors:**
- Primary: `#6a1b9a` (consistent with dark)
- Secondary: `#ab47bc` (consistent with dark)
- Background: Gradient from `#f8f9fa` to `#e9ecef`
- Field: Light green gradients for football pitch

#### `/src/theme/ThemeContext.js`
Provides theme context and toggle functionality:
- `useThemeMode()` hook for accessing theme state
- `toggleTheme()` function for switching modes
- Wraps app with MUI ThemeProvider and CssBaseline

### Component Integration

All components have been updated to support theming:

#### **NavigationBar**
- Theme toggle button with sun/moon icons
- Adaptive text input styling
- Smooth color transitions

#### **UserProfilePane**
- Gradient backgrounds adapt to theme
- Button borders and hover states themed
- List items and dividers respond to theme

#### **PlayerCard**
- Card backgrounds with subtle gradients
- Theme-aware text colors
- Hover effects match theme

#### **TeamFormation**
- Football pitch with theme-appropriate greens
- Striped field pattern adapts to mode
- Bench area follows theme

#### **AuthDialog & TransferPlayer**
- Dialog backgrounds match theme gradient
- Form inputs adapt to theme
- Button styling consistent with theme

## Usage

### Using the Theme in Components

```javascript
import { useTheme } from '@mui/material/styles';
import { useThemeMode } from '../../theme/ThemeContext';

const MyComponent = () => {
  const theme = useTheme(); // Access current theme
  const { mode, toggleTheme } = useThemeMode(); // Access mode and toggle
  
  return (
    <Box sx={{ 
      color: theme.palette.text.primary,
      backgroundColor: theme.palette.background.paper 
    }}>
      {/* Component content */}
    </Box>
  );
};
```

### CSS Theme Support

CSS files use attribute selectors for light mode:

```css
/* Dark mode (default) */
.my-component {
  color: #ffffff;
  background: #23272f;
}

/* Light mode */
html[data-mui-color-scheme='light'] .my-component {
  color: #212121;
  background: #ffffff;
}
```

## Theme Palette Reference

### Dark Mode
```javascript
{
  mode: 'dark',
  primary: { main: '#6a1b9a', light: '#9c4dcc', dark: '#38006b' },
  secondary: { main: '#ab47bc', light: '#df78ef', dark: '#790e8b' },
  background: {
    default: '#1a1a2e',
    paper: '#23272f',
    gradient: 'linear-gradient(135deg, #23272f 0%, #281455 100%)'
  },
  text: { primary: '#ffffff', secondary: '#b0b0b0' }
}
```

### Light Mode
```javascript
{
  mode: 'light',
  primary: { main: '#6a1b9a', light: '#9c4dcc', dark: '#38006b' },
  secondary: { main: '#ab47bc', light: '#df78ef', dark: '#790e8b' },
  background: {
    default: '#f5f5f5',
    paper: '#ffffff',
    gradient: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)'
  },
  text: { primary: '#212121', secondary: '#757575' }
}
```

## Best Practices

1. **Always use theme values**: Reference `theme.palette` instead of hardcoded colors
2. **Test both modes**: Ensure components look good in both dark and light themes
3. **Use transitions**: Add smooth transitions for theme-dependent properties
4. **Maintain contrast**: Ensure text remains readable in both modes
5. **Consistent patterns**: Follow existing component patterns for new additions

## Future Enhancements

Potential improvements to consider:
- [ ] Persist theme preference in localStorage
- [ ] Add more color scheme options (blue, green, etc.)
- [ ] Implement theme customization panel
- [ ] Add accessibility contrast checker
- [ ] Support system theme preference detection

## Components Updated

- ✅ App.js - Theme provider integration
- ✅ NavigationBar - Toggle button and styling
- ✅ UserProfilePane - Gradient backgrounds
- ✅ PlayerCard - Card styling
- ✅ TeamFormation - Field backgrounds
- ✅ AuthDialog - Dialog styling
- ✅ TransferPlayer - Dialog styling

## Notes

- The theme system is built on Material-UI v5+
- All transitions are set to 0.3s for smooth animations
- The football pitch colors adapt while maintaining green theme
- Border radius is consistently 12px across components
- Shadow depths vary by component importance
