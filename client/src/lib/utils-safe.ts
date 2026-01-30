// Bulletproof utility functions for validation and safe formatting

/**
 * Safely format a date string to localized date format
 * @param dateString - ISO date string or date value
 * @param fallback - Fallback text if date is invalid (default: "N/A")
 * @returns Formatted date string or fallback
 */
export function formatDate(dateString: string | null | undefined, fallback: string = "N/A"): string {
  if (!dateString) return fallback;
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return fallback;
    return date.toLocaleDateString();
  } catch {
    return fallback;
  }
}

/**
 * Safely format a date string to localized date and time format
 * @param dateString - ISO date string or date value
 * @param fallback - Fallback text if date is invalid (default: "N/A")
 * @returns Formatted date and time string or fallback
 */
export function formatDateTime(dateString: string | null | undefined, fallback: string = "N/A"): string {
  if (!dateString) return fallback;
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return fallback;
    return date.toLocaleString();
  } catch {
    return fallback;
  }
}

/**
 * Format a number or string as USD currency
 * @param amount - Number or string to format
 * @returns Formatted currency string (e.g., "$10.00")
 */
export function formatCurrency(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined) return "$0.00";
  
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) return "$0.00";
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(numAmount);
}

/**
 * Validate required fields in a form
 * @param fields - Object with field values
 * @param requiredFields - Array of field names that are required
 * @param customMessages - Optional custom error messages for specific fields
 * @returns Validation result with isValid flag and errors array
 */
export function validateRequired(
  fields: Record<string, any>,
  requiredFields: string[],
  customMessages?: Record<string, string>
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (const field of requiredFields) {
    const value = fields[field];
    const isEmpty = value === null || value === undefined || 
                   (typeof value === 'string' && value.trim() === '');
    
    if (isEmpty) {
      const message = customMessages?.[field] || `${field} is required`;
      errors.push(message);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Safely trim a string value
 * @param value - String value to trim
 * @returns Trimmed string or undefined if input was null/undefined
 */
export function safeTrim(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'string') return undefined;
  return value.trim();
}

/**
 * Validate email format
 * @param email - Email string to validate
 * @returns True if valid email format
 */
export function isValidEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate US phone number format (10 digits)
 * @param phone - Phone string to validate
 * @returns True if valid 10-digit phone number
 */
export function isValidPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Check if exactly 10 digits
  return digits.length === 10;
}

/**
 * Check if a value is a positive number
 * @param value - Value to check
 * @returns True if value is a positive number
 */
export function isPositiveNumber(value: any): boolean {
  if (value === null || value === undefined) return false;
  
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  return !isNaN(num) && num > 0;
}

/**
 * Safely parse a string or number to a number with fallback
 * @param value - Value to parse
 * @param defaultValue - Default value if parsing fails (default: 0)
 * @returns Parsed number or default value
 */
export function safeParseNumber(value: string | number | null | undefined, defaultValue: number = 0): number {
  if (value === null || value === undefined) return defaultValue;
  
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  return isNaN(num) ? defaultValue : num;
}

/**
 * Check if an array has items
 * @param array - Array to check
 * @returns True if array exists and has at least one item
 */
export function hasItems<T>(array: T[] | null | undefined): boolean {
  return Array.isArray(array) && array.length > 0;
}

/**
 * Check if a value is a non-empty string
 * @param value - Value to check
 * @returns True if value is a non-empty string
 */
export function isNonEmptyString(value: any): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validate if a date string is a valid date
 * @param dateString - Date string to validate
 * @returns True if valid date
 */
export function isValidDate(dateString: string | null | undefined): boolean {
  if (!dateString) return false;
  
  try {
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  } catch {
    return false;
  }
}
