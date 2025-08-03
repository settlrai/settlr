export const theme = {
  colors: {
    // Primary grey theme (replacing blue)
    primary: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
    },
    
    // Secondary greys for UI elements
    secondary: {
      50: '#fafafa',
      100: '#f4f4f5',
      200: '#e4e4e7',
      300: '#d4d4d8',
      400: '#a1a1aa',
      500: '#71717a',
      600: '#52525b',
      700: '#3f3f46',
      800: '#27272a',
      900: '#18181b',
    },
    
    // Background colors
    background: {
      primary: '#ffffff',
      secondary: '#f8fafc',
      dark: '#0a0a0a',
      darkSecondary: '#1a1a1a',
    },
    
    // Text colors
    text: {
      primary: '#171717',
      secondary: '#64748b',
      tertiary: '#94a3b8',
      inverse: '#ffffff',
      dark: '#ededed',
      darkSecondary: '#a1a1aa',
    },
    
    // Border colors
    border: {
      light: '#e2e8f0',
      medium: '#cbd5e1',
      dark: '#475569',
    },
    
    // Status colors
    status: {
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',
    },
    
    // Interactive states
    interactive: {
      hover: '#f1f5f9',
      focus: '#e2e8f0',
      active: '#cbd5e1',
      disabled: '#f8fafc',
    },
  },
  
  // Semantic color mappings
  semantic: {
    // Input field colors
    input: {
      background: '#ffffff',
      border: '#d1d5db',
      borderFocus: '#6b7280',
      text: '#111827',
      placeholder: '#9ca3af',
    },
    
    // Button colors (grey theme)
    button: {
      primary: {
        background: '#6b7280',
        backgroundHover: '#4b5563',
        text: '#ffffff',
        border: '#6b7280',
      },
      secondary: {
        background: '#f3f4f6',
        backgroundHover: '#e5e7eb',
        text: '#374151',
        border: '#d1d5db',
      },
    },
    
    // Chat message colors
    chat: {
      userMessage: '#6b7280',
      userMessageText: '#ffffff',
      assistantMessage: '#f9fafb',
      assistantMessageText: '#111827',
      errorMessage: '#fef2f2',
      errorMessageText: '#dc2626',
    },
  },
} as const;

export type Theme = typeof theme;
export type ThemeColors = typeof theme.colors;
export type SemanticColors = typeof theme.semantic;