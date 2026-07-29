'use client';

import React, { InputHTMLAttributes, forwardRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { checkFormFieldAccessibility } from '@/lib/accessibility';

interface AccessibleInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  isRequired?: boolean;
}

export const AccessibleInput = forwardRef<HTMLInputElement, AccessibleInputProps>(
  (
    {
      label,
      error,
      helperText,
      isRequired = false,
      id,
      className,
      ...props
    },
    ref
  ) => {
    const [fieldId] = useState(id || `input-${Math.random().toString(36).substr(2, 9)}`);
    const [errorId] = useState(`${fieldId}-error`);
    const [helperId] = useState(`${fieldId}-helper`);

    const hasError = Boolean(error);
    const ariaDescribedBy = [
      helperText ? helperId : undefined,
      hasError ? errorId : undefined,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className="flex flex-col space-y-1.5">
        {label && (
          <label
            htmlFor={fieldId}
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {label}
            {isRequired && <span className="text-red-500 ml-1" aria-label="requerido">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={fieldId}
          className={cn(
            'px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200',
            'bg-white dark:bg-gray-800',
            'border-gray-300 dark:border-gray-600',
            'text-gray-900 dark:text-gray-100',
            'placeholder-gray-400 dark:placeholder-gray-500',
            hasError
              ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
              : 'focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            className
          )}
          aria-invalid={hasError}
          aria-describedby={ariaDescribedBy || undefined}
          aria-required={isRequired}
          {...props}
        />
        {error && (
          <p id={errorId} className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} className="text-sm text-gray-500 dark:text-gray-400">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

AccessibleInput.displayName = 'AccessibleInput';
