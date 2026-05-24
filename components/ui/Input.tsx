'use client';

/**
 * Input Component
 *
 * Reusable input component with validation states.
 *
 * @example
 * <Input label="Name" placeholder="Enter your name" error="Required" />
 */

import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const inputWrapperStyles = 'relative';
    const inputStyles = `
      w-full px-4 py-3 rounded-xl border-2 font-semibold
      focus:ring-0 transition-all
      ${error
        ? 'border-red-300 focus:border-red-500'
        : 'border-slate-200 focus:border-blue-500'
      }
      ${disabled ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white text-slate-900'}
      ${leftIcon ? 'pl-12' : ''}
      ${rightIcon ? 'pr-12' : ''}
    `;

    const iconStyles = 'absolute top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none';
    const leftIconStyles = `${iconStyles} left-4`;
    const rightIconStyles = `${iconStyles} right-4`;

    return (
      <div className="space-y-1.5">
        {label && (
          <label className="flex items-center gap-2 text-sm font-bold text-slate-900">
            {label}
          </label>
        )}

        <div className={inputWrapperStyles}>
          {leftIcon && <span className={leftIconStyles}>{leftIcon}</span>}

          <input
            ref={ref}
            className={`${inputStyles} ${className}`}
            disabled={disabled}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? `${props.id}-error` : helperText ? `${props.id}-helper` : undefined}
            {...props}
          />

          {rightIcon && <span className={rightIconStyles}>{rightIcon}</span>}
        </div>

        {error && (
          <p id={`${props.id}-error`} className="text-sm font-semibold text-red-600">
            {error}
          </p>
        )}

        {helperText && !error && (
          <p id={`${props.id}-helper`} className="text-xs text-slate-500">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

/**
 * Textarea Component
 */

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, className = '', ...props }, ref) => {
    const textareaStyles = `
      w-full px-4 py-3 rounded-xl border-2 font-semibold
      focus:ring-0 transition-all resize-none
      ${error
        ? 'border-red-300 focus:border-red-500'
        : 'border-slate-200 focus:border-blue-500'
      }
      bg-white text-slate-900
    `;

    return (
      <div className="space-y-1.5">
        {label && (
          <label className="flex items-center gap-2 text-sm font-bold text-slate-900">
            {label}
          </label>
        )}

        <textarea
          ref={ref}
          className={`${textareaStyles} ${className}`}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${props.id}-error` : helperText ? `${props.id}-helper` : undefined}
          {...props}
        />

        {error && (
          <p id={`${props.id}-error`} className="text-sm font-semibold text-red-600">
            {error}
          </p>
        )}

        {helperText && !error && (
          <p id={`${props.id}-helper`} className="text-xs text-slate-500">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
