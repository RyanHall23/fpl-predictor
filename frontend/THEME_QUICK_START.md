# FPL Predictor Theme System - Quick Start

## What's New? 🎨

Your FPL Predictor now has a beautiful, professional theme system with dark and light modes!

## How to Use

### Toggle Theme
Look for the **sun/moon icon** in the top-right corner of the navigation bar:
- 🌙 **Moon icon** = Click to switch to light mode
- ☀️ **Sun icon** = Click to switch to dark mode

### Dark Mode (Default)
- Deep purple gradients inspired by FPL branding
- Easy on the eyes for long sessions
- Professional dark aesthetic
- Purple accents throughout

### Light Mode
- Clean, bright interface
- Perfect for daytime use
- Maintains purple branding
- Excellent contrast and readability

## What Changed?

### All Components Updated ✅
1. **Navigation Bar** - Theme toggle button added
2. **User Profile Pane** - Gradient backgrounds adapt to theme
3. **Player Cards** - Styled with theme-aware colors
4. **Team Formation** - Football pitch colors adjust
5. **Dialogs** - Auth and Transfer dialogs themed
6. **App Background** - Full-page theme support

### Design Philosophy
- **Consistency**: Same purple branding across both modes
- **Smooth Transitions**: All theme changes animate smoothly
- **High Contrast**: Text is always readable
- **Modern Look**: Rounded corners, gradients, shadows
- **FPL Inspired**: Colors based on Fantasy Premier League

## Color Palette

### Purple Theme (Both Modes)
- **Primary Purple**: `#6a1b9a`
- **Secondary Purple**: `#ab47bc`
- **Hover Purple**: `#8e24aa`

### Dark Mode Specifics
- **Background**: Dark gray-blue gradients
- **Text**: White and light gray
- **Pitch**: Dark green stripes

### Light Mode Specifics
- **Background**: Light gray gradients
- **Text**: Dark gray and black
- **Pitch**: Light green stripes

## Technical Details

### Files Added
```
frontend/src/theme/
  ├── theme.js           # Theme configurations
  ├── ThemeContext.js    # Theme provider & context
  └── themeUtils.js      # Utility functions
```

### Files Updated
- `index.jsx` - Theme provider wrapper
- `App.js` - Theme integration
- All component files - Theme-aware styling
- All CSS files - Dark/light mode support

### Key Technologies
- Material-UI (MUI) v5+ theming
- React Context API
- CSS attribute selectors
- Smooth CSS transitions

## Future Enhancements (Optional)

Want to extend the theme system? Here are ideas:

1. **Persist Preference**: Save theme choice to localStorage
2. **System Sync**: Auto-detect OS theme preference
3. **More Themes**: Add blue, green, or red variants
4. **Custom Colors**: Let users pick their own colors
5. **Theme Preview**: Show before/after when hovering toggle

See `THEME_DOCUMENTATION.md` for implementation details!

## Developer Notes

### Adding Theme to New Components
```javascript
import { useTheme } from '@mui/material/styles';

const NewComponent = () => {
  const theme = useTheme();
  
  return (
    <Box sx={{ 
      backgroundColor: theme.palette.background.paper,
      color: theme.palette.text.primary 
    }}>
      Content
    </Box>
  );
};
```

### Adding Theme to CSS
```css
/* Dark mode */
.my-class {
  color: white;
}

/* Light mode */
html[data-mui-color-scheme='light'] .my-class {
  color: black;
}
```

## Questions?

Check `THEME_DOCUMENTATION.md` for detailed information about:
- Theme architecture
- Color palettes
- Best practices
- Component patterns
- API references

---

**Enjoy your new themed FPL Predictor! 🎉**
