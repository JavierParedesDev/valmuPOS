import { MD3LightTheme } from 'react-native-paper';

export const brandColors = {
    background: '#F8FAFC',    // Slate 50 - Ultra clean
    backgroundAlt: '#F1F5F9', // Slate 100
    surface: '#FFFFFF',
    surfaceSoft: '#F8FAFC',
    shell: '#0F172A',         // Slate 900 - Deep professional
    shellSoft: '#1E293B',     // Slate 800
    accent: '#FF6B00',        // Vibrant Orange
    accentStrong: '#E65100',
    accentSoft: '#FFF4ED',
    text: '#0F172A',
    textMuted: '#64748B',     // Slate 500
    outline: '#E2E8F0',       // Slate 200
    success: '#10B981',       // Emerald 500
    danger: '#EF4444'         // Red 500
};

export const appTheme = {
    ...MD3LightTheme,
    roundness: 16, // Smoother corners for premium feel
    colors: {
        ...MD3LightTheme.colors,
        primary: brandColors.accent,
        onPrimary: '#FFFFFF',
        primaryContainer: brandColors.accentSoft,
        onPrimaryContainer: brandColors.accentStrong,
        secondary: brandColors.shell,
        onSecondary: '#FFFFFF',
        secondaryContainer: brandColors.backgroundAlt,
        onSecondaryContainer: brandColors.shell,
        tertiary: '#0EA5E9',      // Sky 500
        background: brandColors.background,
        onBackground: brandColors.text,
        surface: brandColors.surface,
        onSurface: brandColors.text,
        surfaceVariant: brandColors.surfaceSoft,
        onSurfaceVariant: brandColors.textMuted,
        outline: brandColors.outline,
        outlineVariant: '#CBD5E1',
        error: brandColors.danger,
        onError: '#FFFFFF',
        errorContainer: '#FEE2E2',
        onErrorContainer: brandColors.danger,
        elevation: {
            level0: 'transparent',
            level1: '#FFFFFF',
            level2: '#F8FAFC',
            level3: '#F1F5F9',
            level4: '#E2E8F0',
            level5: '#CBD5E1'
        }
    }
};

