import { Platform } from 'react-native';

// ── B · Soft Mono token palette ───────────────────────────────────────────────

export const colors = {
  bg: '#f3f1ec',
  surface: '#fbfaf6',
  surfaceAlt: '#ece9e0',
  accent: '#008c19',       // green — tweaks override from app.jsx
  accentLight: '#b8dfbf',  // mix(#008c19, #fff, 0.72)
  accentSoft: '#b8dfbf',   // alias
  ok: '#3a6b3c',           // open / success
  amber: '#D97706',
  amberLight: '#FEF3C7',
  coral: '#C4462A',
  coralLight: '#FDECEA',
  blue: '#2563EB',
  blueLight: '#EFF6FF',
  border: '#dbd6c8',       // hair
  borderStrong: '#c5bfb0',
  text: '#3a3935',         // ink
  textSecondary: '#54514a', // ink2
  textMuted: '#8a877c',    // muted
  white: '#FFFFFF',
  overlay: 'rgba(0,0,0,0.5)',
  error: '#C4462A',
  errorLight: '#FDECEA',
} as const;

// System monospace font — used for labels, metadata, numbers
export const monoFont = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
}) as string;

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const, lineHeight: 36 },
  h2: { fontSize: 22, fontWeight: '700' as const, lineHeight: 30 },
  h3: { fontSize: 18, fontWeight: '600' as const, lineHeight: 26 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodyMedium: { fontSize: 15, fontWeight: '500' as const, lineHeight: 22 },
  bodySmall: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  label: { fontSize: 14, fontWeight: '500' as const, lineHeight: 20 },
  button: { fontSize: 16, fontWeight: '600' as const, lineHeight: 22 },
  buttonSmall: { fontSize: 14, fontWeight: '600' as const, lineHeight: 20 },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;
