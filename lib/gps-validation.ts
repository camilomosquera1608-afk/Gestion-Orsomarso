// GPS Validation System - Professional GPS Data Validation
// Comprehensive validation rules for GPS competition data editing

import type {
  GPSEditableData,
  GPSEditRow,
  GPSValidationRule,
  GPSValidationResult,
  GPSEditorConfig
} from './gps-editor-types';

/**
 * Default GPS Editor Configuration
 */
export const DEFAULT_GPS_CONFIG: GPSEditorConfig = {
  allowNegativeValues: false,
  maxMinutes: 130,
  maxDistance: 20000, // 20km in meters
  maxVelocity: 15, // 15 m/s (54 km/h)
  maxPlayerLoad: 1000,
  requirePlayerId: true,
  autoCalculateDerived: true,
};

/**
 * GPS Validation Rules Definition
 */
export const GPS_VALIDATION_RULES: GPSValidationRule[] = [
  // Minutes validation
  {
    field: 'minutes',
    type: 'range',
    min: 0,
    max: 130,
    message: 'Los minutos deben estar entre 0 y 130',
  },
  {
    field: 'minutes',
    type: 'required',
    message: 'Los minutos son obligatorios',
  },
  
  // Total distance validation
  {
    field: 'totalDistance',
    type: 'range',
    min: 0,
    max: 20000,
    message: 'La distancia total debe estar entre 0 y 20,000m',
  },
  {
    field: 'totalDistance',
    type: 'required',
    message: 'La distancia total es obligatoria',
  },
  
  // Meters per minute validation
  {
    field: 'metersPerMinute',
    type: 'range',
    min: 0,
    max: 200,
    message: 'Los m/min deben estar entre 0 y 200',
  },
  
  // High speed distance validation
  {
    field: 'highSpeedDistance',
    type: 'range',
    min: 0,
    max: 5000,
    message: 'La distancia a alta velocidad debe estar entre 0 y 5,000m',
  },
  
  // Sprint distance validation
  {
    field: 'sprintDistance',
    type: 'range',
    min: 0,
    max: 3000,
    message: 'La distancia de sprint debe estar entre 0 y 3,000m',
  },
  
  // HSR validation
  {
    field: 'hsr',
    type: 'range',
    min: 0,
    max: 100,
    message: 'El HSR debe estar entre 0 y 100',
  },
  
  // Sprints validation
  {
    field: 'sprints',
    type: 'range',
    min: 0,
    max: 100,
    message: 'Los sprints deben estar entre 0 y 100',
  },
  
  // Max velocity validation
  {
    field: 'maxVelocity',
    type: 'range',
    min: 0,
    max: 15,
    message: 'La velocidad máxima debe estar entre 0 y 15 m/s',
  },
  
  // ACC validation
  {
    field: 'acc',
    type: 'range',
    min: 0,
    max: 200,
    message: 'Las aceleraciones deben estar entre 0 y 200',
  },
  
  // DCC validation
  {
    field: 'dcc',
    type: 'range',
    min: 0,
    max: 200,
    message: 'Las desaceleraciones deben estar entre 0 y 200',
  },
  
  // RHIE validation
  {
    field: 'rhie',
    type: 'range',
    min: 0,
    max: 100,
    message: 'Los RHIE deben estar entre 0 y 100',
  },
  
  // Player load validation
  {
    field: 'playerLoad',
    type: 'range',
    min: 0,
    max: 1000,
    message: 'El player load debe estar entre 0 y 1,000',
  },
  
  // Player load per minute validation
  {
    field: 'playerLoadPerMin',
    type: 'range',
    min: 0,
    max: 20,
    message: 'El player load/min debe estar entre 0 y 20',
  },
  
  // Player ID validation
  {
    field: 'playerId' as any,
    type: 'required',
    message: 'El jugador es obligatorio',
  },
];

/**
 * Custom validation rules for logical consistency
 */
export const GPS_CUSTOM_VALIDATORS: {
  [key: string]: (value: any, row: GPSEditRow) => boolean;
} = {
  // Validate that high speed distance doesn't exceed total distance
  validateHSRDistance: (value: any, row: GPSEditRow) => {
    const hsr = row.currentData.highSpeedDistance;
    const total = row.currentData.totalDistance;
    return hsr <= total;
  },
  
  // Validate that sprint distance doesn't exceed high speed distance
  validateSprintDistance: (value: any, row: GPSEditRow) => {
    const sprint = row.currentData.sprintDistance;
    const hsr = row.currentData.highSpeedDistance;
    return sprint <= hsr;
  },
  
  // Validate that meters per minute is consistent with total distance and minutes
  validateMetersPerMinute: (value: any, row: GPSEditRow) => {
    const metersPerMin = row.currentData.metersPerMinute;
    const total = row.currentData.totalDistance;
    const minutes = row.currentData.minutes;
    if (minutes === 0) return true;
    const calculated = total / minutes;
    return Math.abs(metersPerMin - calculated) < 10; // Allow 10m/min tolerance
  },
  
  // Validate that player load per minute is consistent with total player load and minutes
  validatePlayerLoadPerMin: (value: any, row: GPSEditRow) => {
    const loadPerMin = row.currentData.playerLoadPerMin;
    const totalLoad = row.currentData.playerLoad;
    const minutes = row.currentData.minutes;
    if (minutes === 0) return true;
    const calculated = totalLoad / minutes;
    return Math.abs(loadPerMin - calculated) < 1; // Allow 1 unit tolerance
  },
};

/**
 * Validate a single GPS row
 */
export function validateGPSRow(
  row: GPSEditRow,
  config: GPSEditorConfig = DEFAULT_GPS_CONFIG
): GPSValidationResult {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};
  
  const data = row.currentData;
  
  // Apply standard validation rules
  for (const rule of GPS_VALIDATION_RULES) {
    const field = rule.field as keyof GPSEditableData;
    const value = data[field];
    
    // Skip if field doesn't exist in data
    if (!(field in data)) continue;
    
    // Required field validation
    if (rule.type === 'required') {
      if (value === null || value === undefined || value === '') {
        errors[field] = rule.message;
        continue;
      }
    }
    
    // Range validation
    if (rule.type === 'range') {
      if (typeof value === 'number') {
        if (!config.allowNegativeValues && value < 0) {
          errors[field] = 'No se permiten valores negativos';
          continue;
        }
        
        if (rule.min !== undefined && value < rule.min) {
          errors[field] = rule.message;
          continue;
        }
        
        if (rule.max !== undefined && value > rule.max) {
          errors[field] = rule.message;
          continue;
        }
      }
    }
    
    // Custom validator
    if (rule.validator) {
      if (!rule.validator(value, row)) {
        errors[field] = rule.message;
      }
    }
  }
  
  // Apply custom logical validations
  if (!GPS_CUSTOM_VALIDATORS.validateHSRDistance(null, row)) {
    warnings['highSpeedDistance'] = 'La distancia a alta velocidad no puede exceder la distancia total';
  }
  
  if (!GPS_CUSTOM_VALIDATORS.validateSprintDistance(null, row)) {
    warnings['sprintDistance'] = 'La distancia de sprint no puede exceder la distancia a alta velocidad';
  }
  
  if (!GPS_CUSTOM_VALIDATORS.validateMetersPerMinute(null, row)) {
    warnings['metersPerMinute'] = 'Los m/min no son consistentes con la distancia total y minutos';
  }
  
  if (!GPS_CUSTOM_VALIDATORS.validatePlayerLoadPerMin(null, row)) {
    warnings['playerLoadPerMin'] = 'El player load/min no es consistente con el player load total y minutos';
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate multiple GPS rows
 */
export function validateGPSRows(
  rows: GPSEditRow[],
  config: GPSEditorConfig = DEFAULT_GPS_CONFIG
): {
  isValid: boolean;
  rowResults: Map<string, GPSValidationResult>;
  totalErrors: number;
  totalWarnings: number;
} {
  const rowResults = new Map<string, GPSValidationResult>();
  let totalErrors = 0;
  let totalWarnings = 0;
  
  for (const row of rows) {
    const result = validateGPSRow(row, config);
    rowResults.set(row.id, result);
    totalErrors += Object.keys(result.errors).length;
    totalWarnings += Object.keys(result.warnings).length;
  }
  
  return {
    isValid: totalErrors === 0,
    rowResults,
    totalErrors,
    totalWarnings,
  };
}

/**
 * Validate a single field value
 */
export function validateGPSField(
  field: keyof GPSEditableData,
  value: any,
  config: GPSEditorConfig = DEFAULT_GPS_CONFIG
): {
  isValid: boolean;
  error?: string;
} {
  const rules = GPS_VALIDATION_RULES.filter(rule => rule.field === field);
  
  for (const rule of rules) {
    // Required field validation
    if (rule.type === 'required') {
      if (value === null || value === undefined || value === '') {
        return { isValid: false, error: rule.message };
      }
    }
    
    // Range validation
    if (rule.type === 'range') {
      if (typeof value === 'number') {
        if (!config.allowNegativeValues && value < 0) {
          return { isValid: false, error: 'No se permiten valores negativos' };
        }
        
        if (rule.min !== undefined && value < rule.min) {
          return { isValid: false, error: rule.message };
        }
        
        if (rule.max !== undefined && value > rule.max) {
          return { isValid: false, error: rule.message };
        }
      }
    }
  }
  
  return { isValid: true };
}

/**
 * Parse and validate a numeric input
 */
export function parseAndValidateGPSNumber(
  input: string,
  field: keyof GPSEditableData,
  config: GPSEditorConfig = DEFAULT_GPS_CONFIG
): {
  isValid: boolean;
  value?: number;
  error?: string;
} {
  // Check if empty
  if (!input || input.trim() === '') {
    return { isValid: false, error: 'Este campo es obligatorio' };
  }
  
  // Try to parse as number
  const parsed = parseFloat(input);
  if (isNaN(parsed)) {
    return { isValid: false, error: 'Debe ser un número válido' };
  }
  
  // Validate the parsed number
  const validation = validateGPSField(field, parsed, config);
  if (!validation.isValid) {
    return { isValid: false, error: validation.error };
  }
  
  return { isValid: true, value: parsed };
}
