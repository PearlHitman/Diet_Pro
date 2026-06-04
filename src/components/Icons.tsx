// Icons — compat shim.
// We migrated to lucide-react (matches the Figma export). This file
// re-exports the old names so legacy callers in pages/* keep working.

import * as React from 'react';
import {
  ChefHat as LucideChefHat,
  Globe as LucideGlobe,
  ArrowRight as LucideArrowRight,
  ArrowLeft as LucideArrowLeft,
  Clock as LucideClock,
  Flame as LucideFlame,
  TrendingUp as LucideTrendingUp,
  AlertCircle as LucideAlertCircle,
  Sparkles as LucideSparkles,
  BookOpen as LucideBookOpen,
  Plus as LucidePlus,
  Trash2 as LucideTrash,
  Settings as LucideSettings,
  User as LucideUser,
  Check as LucideCheck,
  X as LucideX,
  Heart as LucideHeart,
  Home as LucideHome,
  Package as LucidePackage,
  SlidersHorizontal as LucideSliders,
  Star as LucideStar,
  type LucideIcon,
} from 'lucide-react';

type Props = {
  size?: number;
  strokeWidth?: number;
  color?: string;
  style?: React.CSSProperties;
};

// Lucide components are forwardRefs; type them loosely so we don't have
// to mirror their full prop signature.
const wrap = (Lucide: LucideIcon) =>
  ({ size = 16, strokeWidth = 2, color = 'currentColor', style }: Props) =>
    <Lucide size={size} strokeWidth={strokeWidth} color={color} style={style} />;

export const ChefHat = wrap(LucideChefHat);
export const Globe = wrap(LucideGlobe);
export const ArrowRight = wrap(LucideArrowRight);
export const ArrowLeft = wrap(LucideArrowLeft);
export const Clock = wrap(LucideClock);
export const Flame = wrap(LucideFlame);
export const TrendingUp = wrap(LucideTrendingUp);
export const AlertCircle = wrap(LucideAlertCircle);
export const Sparkles = wrap(LucideSparkles);
export const BookOpen = wrap(LucideBookOpen);
export const Plus = wrap(LucidePlus);
export const Trash = wrap(LucideTrash);
export const Settings = wrap(LucideSettings);
export const User = wrap(LucideUser);
export const Check = wrap(LucideCheck);
export const X = wrap(LucideX);
export const Heart = wrap(LucideHeart);
export const Home = wrap(LucideHome);
export const Package = wrap(LucidePackage);
export const Sliders = wrap(LucideSliders);

export function Star({ filled = false, size = 16 }: { filled?: boolean; size?: number }) {
  return (
    <LucideStar
      size={size}
      strokeWidth={1.75}
      style={{
        fill: filled ? 'var(--mise-primary)' : 'none',
        color: filled ? 'var(--mise-primary)' : 'var(--mise-text-tertiary)',
      }}
    />
  );
}
