import type { ComponentType, SVGProps } from 'react';
import {
  AcademicCapIcon,
  BeakerIcon,
  BoltIcon,
  CloudIcon,
  HandRaisedIcon,
  HeartIcon,
  ShieldCheckIcon,
  SparklesIcon,
  SpeakerWaveIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';

export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * Department records store an icon *name*, not a component, so an
 * administrator can change one without a deploy. Anything unrecognised falls
 * back to a heart rather than rendering nothing — a department with a missing
 * icon should still look like a department.
 *
 * Heroicons has no stethoscope, bone, ear or baby, so those map to the
 * nearest shape that still reads at 20px.
 */
export const DEPARTMENT_ICONS: Record<string, IconComponent> = {
  HeartIcon,
  StethoscopeIcon: ShieldCheckIcon,
  BoneIcon: HandRaisedIcon,
  BabyIcon: AcademicCapIcon,
  SparklesIcon,
  EarIcon: SpeakerWaveIcon,
  BeakerIcon,
  CloudIcon,
  BoltIcon,
  UserGroupIcon,
};

export const iconFor = (name: string | undefined): IconComponent =>
  (name && DEPARTMENT_ICONS[name]) || HeartIcon;
