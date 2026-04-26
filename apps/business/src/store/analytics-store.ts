import { create } from 'zustand';

export type AnalyticsPeriod = 'day' | 'week' | 'month';

interface AnalyticsStore {
  period: AnalyticsPeriod;
  setPeriod: (period: AnalyticsPeriod) => void;
}

export const useAnalyticsStore = create<AnalyticsStore>((set) => ({
  period: 'week',
  setPeriod: (period) => set({ period }),
}));
