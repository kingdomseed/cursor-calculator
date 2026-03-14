export function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return String(Math.round(num));
}

export function formatCurrency(num: number): string {
  if (num < 0) return `-$${Math.abs(num).toFixed(2)}`;
  return `$${num.toFixed(2)}`;
}

export function formatRate(rate: number): string {
  return `$${rate.toFixed(2)}`;
}
