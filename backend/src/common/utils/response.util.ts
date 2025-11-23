/**
 * Response Formatting Utilities
 */

import { ApiResponse, PaginatedResponse } from '../types/response.types';

export class ResponseUtil {
  /**
   * Format successful response
   */
  static success<T>(data: T, message?: string): ApiResponse<T> {
    return {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Format paginated response
   */
  static paginated<T>(
    data: T[],
    total: number,
    limit: number,
    offset: number,
  ): PaginatedResponse<T> {
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  }

  /**
   * Format simple success message
   */
  static message(message: string): ApiResponse {
    return {
      success: true,
      message,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Format operation result
   */
  static operation(success: boolean, message: string, data?: any): ApiResponse {
    return {
      success,
      data,
      message,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Message formatting helper
 */
export function formatMessage(
  template: string,
  values: Record<string, any>,
): string {
  let message = template;
  Object.keys(values).forEach((key) => {
    message = message.replace(new RegExp(`{${key}}`, 'g'), String(values[key]));
  });
  return message;
}
