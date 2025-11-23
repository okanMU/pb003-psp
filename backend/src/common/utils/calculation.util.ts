/**
 * Financial Calculation Utilities
 */

export class CalculationUtil {
  /**
   * Calculate commission amount
   */
  static calculateCommission(amount: number, rate: number): number {
    return this.roundToTwo(amount * rate);
  }

  /**
   * Calculate net amount (amount - commission)
   */
  static calculateNetAmount(amount: number, commission: number): number {
    return this.roundToTwo(amount - commission);
  }

  /**
   * Round to 2 decimal places
   */
  static roundToTwo(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /**
   * Calculate percentage
   */
  static calculatePercentage(value: number, total: number): number {
    if (total === 0) return 0;
    return this.roundToTwo((value / total) * 100);
  }

  /**
   * Format amount to TRY string
   */
  static formatTRY(amount: number): string {
    return `${amount.toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} TRY`;
  }

  /**
   * Format amount to currency string
   */
  static formatCurrency(amount: number, currency: string = 'TRY'): string {
    return `${amount.toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${currency}`;
  }

  /**
   * Calculate waste (difference between collateral and amount)
   */
  static calculateWaste(collateral: number, amount: number): number {
    return Math.max(0, collateral - amount);
  }

  /**
   * Calculate waste percentage
   */
  static calculateWastePercentage(collateral: number, amount: number): number {
    if (collateral === 0) return 0;
    const waste = this.calculateWaste(collateral, amount);
    return this.calculatePercentage(waste, collateral);
  }

  /**
   * Check if amount is within range
   */
  static isWithinRange(amount: number, min: number, max: number): boolean {
    return amount >= min && amount <= max;
  }

  /**
   * Clamp value between min and max
   */
  static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Sum array of numbers
   */
  static sum(numbers: number[]): number {
    return this.roundToTwo(numbers.reduce((acc, val) => acc + val, 0));
  }

  /**
   * Average of array of numbers
   */
  static average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return this.roundToTwo(this.sum(numbers) / numbers.length);
  }

  /**
   * Get maximum value from array
   */
  static max(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return Math.max(...numbers);
  }

  /**
   * Get minimum value from array
   */
  static min(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return Math.min(...numbers);
  }

  /**
   * Calculate growth rate
   */
  static calculateGrowthRate(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return this.roundToTwo(((current - previous) / previous) * 100);
  }

  /**
   * Calculate success rate
   */
  static calculateSuccessRate(successful: number, total: number): number {
    if (total === 0) return 0;
    return this.roundToTwo((successful / total) * 100);
  }

  /**
   * Parse amount string to number
   */
  static parseAmount(amountString: string): number {
    const cleaned = amountString.replace(/[^\d.,]/g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  }

  /**
   * Check if amounts are equal (with tolerance for floating point)
   */
  static areEqual(amount1: number, amount2: number, tolerance: number = 0.01): boolean {
    return Math.abs(amount1 - amount2) < tolerance;
  }

  /**
   * Calculate median of array
   */
  static median(numbers: number[]): number {
    if (numbers.length === 0) return 0;

    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return this.roundToTwo((sorted[mid - 1] + sorted[mid]) / 2);
    }

    return sorted[mid];
  }

  /**
   * Calculate percentile
   */
  static percentile(numbers: number[], percentile: number): number {
    if (numbers.length === 0) return 0;

    const sorted = [...numbers].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;

    return sorted[Math.max(0, index)] || 0;
  }
}
