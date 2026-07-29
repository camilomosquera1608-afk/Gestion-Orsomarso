// Real-time form validation utilities

export interface ValidationRule {
  validate: (value: string) => boolean;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export const validationRules = {
  required: (fieldName: string): ValidationRule => ({
    validate: (value) => value.trim().length > 0,
    message: `${fieldName} es requerido`,
  }),
  
  minLength: (min: number, fieldName: string): ValidationRule => ({
    validate: (value) => value.length >= min,
    message: `${fieldName} debe tener al menos ${min} caracteres`,
  }),
  
  maxLength: (max: number, fieldName: string): ValidationRule => ({
    validate: (value) => value.length <= max,
    message: `${fieldName} no puede exceder ${max} caracteres`,
  }),
  
  email: (): ValidationRule => ({
    validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    message: 'Email inválido',
  }),
  
  numeric: (fieldName: string): ValidationRule => ({
    validate: (value) => !isNaN(Number(value)) && value.trim() !== '',
    message: `${fieldName} debe ser un número`,
  }),
  
  range: (min: number, max: number, fieldName: string): ValidationRule => ({
    validate: (value) => {
      const num = Number(value);
      return !isNaN(num) && num >= min && num <= max;
    },
    message: `${fieldName} debe estar entre ${min} y ${max}`,
  }),
  
  date: (): ValidationRule => ({
    validate: (value) => !isNaN(Date.parse(value)),
    message: 'Fecha inválida',
  }),
};

export function validateField(
  value: string,
  rules: ValidationRule[]
): string | null {
  for (const rule of rules) {
    if (!rule.validate(value)) {
      return rule.message;
    }
  }
  return null;
}

export function validateForm(
  data: Record<string, string>,
  fieldRules: Record<string, ValidationRule[]>
): ValidationResult {
  const errors: Record<string, string> = {};
  
  for (const [field, rules] of Object.entries(fieldRules)) {
    const value = data[field] || '';
    const error = validateField(value, rules);
    if (error) {
      errors[field] = error;
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}
