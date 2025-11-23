/**
 * Date and Time Utilities
 */

import * as dayjs from 'dayjs';

export class DateUtil {
  /**
   * Add minutes to current time
   */
  static addMinutes(minutes: number): Date {
    return dayjs().add(minutes, 'minute').toDate();
  }

  /**
   * Add hours to current time
   */
  static addHours(hours: number): Date {
    return dayjs().add(hours, 'hour').toDate();
  }

  /**
   * Add days to current time
   */
  static addDays(days: number): Date {
    return dayjs().add(days, 'day').toDate();
  }

  /**
   * Check if date is expired
   */
  static isExpired(date: Date): boolean {
    return dayjs(date).isBefore(dayjs());
  }

  /**
   * Check if date is within range
   */
  static isWithinRange(date: Date, startDate: Date, endDate: Date): boolean {
    const target = dayjs(date);
    return target.isAfter(dayjs(startDate)) && target.isBefore(dayjs(endDate));
  }

  /**
   * Get start of day
   */
  static startOfDay(date?: Date): Date {
    return dayjs(date).startOf('day').toDate();
  }

  /**
   * Get end of day
   */
  static endOfDay(date?: Date): Date {
    return dayjs(date).endOf('day').toDate();
  }

  /**
   * Get start of current month
   */
  static startOfMonth(): Date {
    return dayjs().startOf('month').toDate();
  }

  /**
   * Get end of current month
   */
  static endOfMonth(): Date {
    return dayjs().endOf('month').toDate();
  }

  /**
   * Format date to ISO string
   */
  static toISO(date: Date): string {
    return dayjs(date).toISOString();
  }

  /**
   * Format date to display string (Turkish format)
   */
  static format(date: Date, format: string = 'DD.MM.YYYY HH:mm:ss'): string {
    return dayjs(date).format(format);
  }

  /**
   * Get difference in minutes
   */
  static diffInMinutes(date1: Date, date2: Date): number {
    return dayjs(date1).diff(dayjs(date2), 'minute');
  }

  /**
   * Get difference in seconds
   */
  static diffInSeconds(date1: Date, date2: Date): number {
    return dayjs(date1).diff(dayjs(date2), 'second');
  }

  /**
   * Get difference in milliseconds
   */
  static diffInMilliseconds(date1: Date, date2: Date): number {
    return dayjs(date1).diff(dayjs(date2), 'millisecond');
  }

  /**
   * Get N days ago
   */
  static daysAgo(days: number): Date {
    return dayjs().subtract(days, 'day').toDate();
  }

  /**
   * Get N hours ago
   */
  static hoursAgo(hours: number): Date {
    return dayjs().subtract(hours, 'hour').toDate();
  }

  /**
   * Get N minutes ago
   */
  static minutesAgo(minutes: number): Date {
    return dayjs().subtract(minutes, 'minute').toDate();
  }

  /**
   * Parse date string
   */
  static parse(dateString: string): Date {
    return dayjs(dateString).toDate();
  }

  /**
   * Check if two dates are same day
   */
  static isSameDay(date1: Date, date2: Date): boolean {
    return dayjs(date1).isSame(dayjs(date2), 'day');
  }

  /**
   * Get time remaining in human readable format
   */
  static getTimeRemaining(expiryDate: Date): string {
    const now = dayjs();
    const expiry = dayjs(expiryDate);

    if (expiry.isBefore(now)) {
      return 'Süresi doldu';
    }

    const minutes = expiry.diff(now, 'minute');
    const seconds = expiry.diff(now, 'second') % 60;

    if (minutes > 0) {
      return `${minutes} dakika ${seconds} saniye`;
    }

    return `${seconds} saniye`;
  }
}
