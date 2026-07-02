import React from 'react';
import type { TimeHorizon } from './tasks';

export type HorizonMeta = {
  id: 'today' | 'this-week' | 'upcoming' | 'open-ended';
  label: TimeHorizon;
  colorVar: string;
  shadowVar: string;
};

export const HORIZON_META: HorizonMeta[] = [
  {
    id: 'today',
    label: 'Today',
    colorVar: 'var(--horizon-today)',
    shadowVar: 'var(--horizon-today-shadow)'
  },
  {
    id: 'this-week',
    label: 'This Week',
    colorVar: 'var(--horizon-week)',
    shadowVar: 'var(--horizon-week-shadow)'
  },
  {
    id: 'upcoming',
    label: 'Upcoming',
    colorVar: 'var(--horizon-upcoming)',
    shadowVar: 'var(--horizon-upcoming-shadow)'
  },
  {
    id: 'open-ended',
    label: 'Open-ended',
    colorVar: 'var(--horizon-open)',
    shadowVar: 'var(--horizon-open-shadow)'
  }
];

export const HORIZON_BY_LABEL = HORIZON_META.reduce<Record<TimeHorizon, HorizonMeta>>(
  (acc, item) => {
    acc[item.label] = item;
    return acc;
  },
  {} as Record<TimeHorizon, HorizonMeta>
);
