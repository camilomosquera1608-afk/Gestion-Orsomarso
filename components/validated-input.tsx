'use client';

import { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { validationRules, validateField, debounce } from '@/lib/form-validation';

interface ValidatedInputProps {
  name: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  type?: string;
  rules?: ReturnType<typeof validationRules[keyof typeof validationRules]>[];
  debounceMs?: number;
  required?: boolean;
}

export function ValidatedInput({
  name,
  value,
  onChange,
  label,
  placeholder,
  type = 'text',
  rules = [],
  debounceMs = 300,
  required = false,
}: ValidatedInputProps) {
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);

  const allRules = required ? [validationRules.required(label || name), ...rules] : rules;

  const debouncedValidate = debounce((val: string) => {
    const validationError = validateField(val, allRules);
    setError(validationError);
    setIsValid(!validationError && val.length > 0);
  }, debounceMs);

  useEffect(() => {
    if (touched) {
      debouncedValidate(value);
    }
  }, [value, touched, debouncedValidate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    if (!touched) setTouched(true);
  };

  const handleBlur = () => {
    setTouched(true);
    const validationError = validateField(value, allRules);
    setError(validationError);
    setIsValid(!validationError && value.length > 0);
  };

  return (
    <div className="field">
      {label && (
        <label htmlFor={name}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          id={name}
          type={type}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={`input ${error ? 'input-error' : ''} ${isValid ? 'input-success' : ''}`}
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : undefined}
        />
        {touched && isValid && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
            <Check size={16} />
          </div>
        )}
        {touched && error && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500">
            <X size={16} />
          </div>
        )}
      </div>
      {error && (
        <p id={`${name}-error`} className="text-red-500 text-xs mt-1">
          {error}
        </p>
      )}
    </div>
  );
}
