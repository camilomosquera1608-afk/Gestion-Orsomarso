// Premium PDF Theme System - Professional Analytics Report Design
// Inspired by StatsBomb, Hudl, Catapult, Wyscout, Opta

export const PDFTheme = {
  // Color Palette - Minimalist Premium
  colors: {
    // Primary
    black: '#0A0A0A',
    white: '#FFFFFF',
    
    // Grayscale
    gray50: '#F9FAFB',
    gray100: '#F3F4F6',
    gray200: '#E5E7EB',
    gray300: '#D1D5DB',
    gray400: '#9CA3AF',
    gray500: '#6B7280',
    gray600: '#4B5563',
    gray700: '#374151',
    gray800: '#1F2937',
    gray900: '#111827',
    
    // Orsomarso Green (Institutional) - Only for emphasis
    green: '#0D9467',
    greenLight: '#D1FAE5',
    greenDark: '#065F46',
    
    // Semantic (minimal usage)
    success: '#059669',
    warning: '#D97706',
    error: '#DC2626',
    info: '#2563EB',
  },
  
  // Typography - Clean, Professional
  typography: {
    fontFamily: {
      primary: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      secondary: '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
      mono: '"SF Mono", "JetBrains Mono", Consolas, monospace',
    },
    
    fontSize: {
      xs: '10px',
      sm: '11px',
      base: '12px',
      md: '13px',
      lg: '14px',
      xl: '16px',
      '2xl': '18px',
      '3xl': '24px',
      '4xl': '32px',
      '5xl': '48px',
      '6xl': '64px',
    },
    
    fontWeight: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
    },
    
    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.75,
    },
    
    letterSpacing: {
      tight: '-0.025em',
      normal: '0',
      wide: '0.025em',
      wider: '0.05em',
      widest: '0.1em',
    },
  },
  
  // Spacing - Generous whitespace
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '32px',
    '4xl': '40px',
    '5xl': '48px',
    '6xl': '64px',
  },
  
  // Border Radius - Subtle
  borderRadius: {
    none: '0',
    sm: '2px',
    md: '4px',
    lg: '6px',
    xl: '8px',
    '2xl': '12px',
    full: '9999px',
  },
  
  // Shadows - Minimal
  shadows: {
    none: 'none',
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px rgba(0, 0, 0, 0.07)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
  },
  
  // Page Configuration
  page: {
    size: 'A4',
    margin: '12mm',
    padding: '16mm',
  },
  
  // Component-specific
  components: {
    // KPI Cards
    kpi: {
      padding: '16px',
      borderRadius: '8px',
      backgroundColor: '#FFFFFF',
      border: '1px solid #E5E7EB',
    },
    
    // Sections
    section: {
      padding: '20px',
      borderRadius: '8px',
      backgroundColor: '#FFFFFF',
      marginBottom: '16px',
    },
    
    // Tables
    table: {
      header: {
        backgroundColor: '#F9FAFB',
        color: '#6B7280',
        fontSize: '11px',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      },
      row: {
        borderBottom: '1px solid #E5E7EB',
        padding: '12px',
      },
    },
    
    // Charts
    chart: {
      colors: {
        primary: '#0D9467',
        secondary: '#6B7280',
        accent: '#D97706',
      },
    },
  },
} as const;

export type PDFTheme = typeof PDFTheme;

// Helper functions for theme access
export const getColor = (color: keyof PDFTheme['colors']) => PDFTheme.colors[color];
export const getFontSize = (size: keyof PDFTheme['typography']['fontSize']) => PDFTheme.typography.fontSize[size];
export const getSpacing = (space: keyof PDFTheme['spacing']) => PDFTheme.spacing[space];
