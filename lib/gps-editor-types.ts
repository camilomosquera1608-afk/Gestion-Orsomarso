// GPS Editor Types - Professional GPS Data Editing System
// Types for editing GPS competition data with history tracking and validation

import type { DailyExternalLoadRecord, Player } from './types';
import type { ClubCategory } from './types';

/**
 * GPS Editable Data - The structure for editable GPS metrics
 */
export interface GPSEditableData {
  playerId: string;
  playerName: string;
  minutes: number;
  totalDistance: number;
  metersPerMinute: number;
  highSpeedDistance: number;
  sprintDistance: number;
  hsr: number;
  sprints: number;
  maxVelocity: number;
  acc: number;
  dcc: number;
  rhie: number;
  playerLoad: number;
  playerLoadPerMin: number;
  ima?: number;
}

/**
 * GPS Edit Row - Represents a row in the editable table
 */
export interface GPSEditRow {
  id: string;
  originalData: GPSEditableData;
  currentData: GPSEditableData;
  isModified: boolean;
  isNew: boolean;
  isDeleted: boolean;
  validationErrors: Record<string, string>;
}

/**
 * GPS Edit History Entry - Tracks changes to GPS data
 */
export interface GPSEditHistoryEntry {
  id: string;
  timestamp: number;
  userId: string;
  userName: string;
  matchId: string;
  playerId: string;
  playerName: string;
  field: string;
  oldValue: any;
  newValue: any;
  reason?: string;
}

/**
 * GPS Edit State - Overall state of the GPS editor
 */
export interface GPSEditState {
  matchId: string;
  originalRecords: DailyExternalLoadRecord[];
  currentRows: GPSEditRow[];
  hasUnsavedChanges: boolean;
  history: GPSEditHistoryEntry[];
  isRestoring: boolean;
}

/**
 * GPS Validation Rule - Defines validation rules for GPS metrics
 */
export interface GPSValidationRule {
  field: keyof GPSEditableData;
  type: 'range' | 'required' | 'pattern' | 'custom';
  min?: number;
  max?: number;
  message: string;
  validator?: (value: any, row: GPSEditRow) => boolean;
}

/**
 * GPS Validation Result - Result of validation
 */
export interface GPSValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

/**
 * GPS Editor Config - Configuration for the GPS editor
 */
export interface GPSEditorConfig {
  allowNegativeValues: boolean;
  maxMinutes: number;
  maxDistance: number;
  maxVelocity: number;
  maxPlayerLoad: number;
  requirePlayerId: boolean;
  autoCalculateDerived: boolean;
}

/**
 * GPS Calculated Metrics - Derived metrics calculated from base data
 */
export interface GPSCalculatedMetrics {
  teamAverage: {
    totalDistance: number;
    metersPerMinute: number;
    highSpeedDistance: number;
    playerLoad: number;
    sprints: number;
  };
  rankings: {
    totalDistance: GPSEditRow[];
    metersPerMinute: GPSEditRow[];
    highSpeedDistance: GPSEditRow[];
    playerLoad: GPSEditRow[];
    sprints: GPSEditRow[];
  };
  leaders: {
    totalDistance: GPSEditRow | null;
    metersPerMinute: GPSEditRow | null;
    highSpeedDistance: GPSEditRow | null;
    playerLoad: GPSEditRow | null;
    sprints: GPSEditRow | null;
  };
}

/**
 * GPS Editor Props - Props for the GPS Editor component
 */
export interface GPSEditorProps {
  matchId: string;
  category: ClubCategory;
  records: DailyExternalLoadRecord[];
  players: Player[];
  onSave: (updatedRecords: DailyExternalLoadRecord[]) => Promise<void>;
  onCancel: () => void;
  onRestoreOriginal?: () => void;
  config?: Partial<GPSEditorConfig>;
}

/**
 * GPS Cell Editor Props - Props for individual cell editor
 */
export interface GPSCellEditorProps {
  value: any;
  onChange: (value: any) => void;
  field: keyof GPSEditableData;
  row: GPSEditRow;
  validationErrors: Record<string, string>;
  disabled?: boolean;
}

/**
 * GPS Column Definition - Defines a column in the editable table
 */
export interface GPSColumnDefinition {
  key: keyof GPSEditableData;
  label: string;
  type: 'text' | 'number' | 'select' | 'player';
  width?: number;
  editable: boolean;
  required?: boolean;
  format?: (value: any) => string;
  parse?: (value: string) => any;
  validation?: GPSValidationRule[];
  options?: { value: string; label: string }[];
}
