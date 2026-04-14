export const getSourcePercentage = (source: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((source / total) * 100);
};
