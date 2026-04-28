'use client';

import * as React from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatYmdWithWeekday } from '@/lib/datetime/format-ymd-weekday';

export type YmdDateInputProps = Omit<
  React.ComponentProps<'input'>,
  'type' | 'className'
> & {
  className?: string;
};

function assignRef<T>(ref: React.Ref<T> | undefined, node: T | null) {
  if (ref == null) return;
  if (typeof ref === 'function') ref(node);
  else (ref as React.MutableRefObject<T | null>).current = node;
}

/**
 * Native `type="date"` with a visible value that includes weekday
 * (`MMM d, yyyy (EEE)`), since browsers do not allow customizing the native date display.
 *
 * The invisible native date input often only receives clicks on its calendar icon (Chromium).
 * Any click on the field opens the picker via `HTMLInputElement.showPicker()` when available.
 */
const YmdDateInput = React.forwardRef<HTMLInputElement, YmdDateInputProps>(
  (
    { className, value, defaultValue, onChange, disabled, id, ...rest },
    ref,
  ) => {
    const isControlled = value !== undefined;
    const [inner, setInner] = React.useState(() =>
      isControlled ? '' : String(defaultValue ?? ''),
    );
    const nativeRef = React.useRef<HTMLInputElement>(null);

    const setNativeRef = React.useCallback(
      (node: HTMLInputElement | null) => {
        nativeRef.current = node;
        assignRef(ref, node);
      },
      [ref],
    );

    React.useEffect(() => {
      if (!isControlled && defaultValue !== undefined) {
        setInner(String(defaultValue));
      }
    }, [defaultValue, isControlled]);

    const ymd = isControlled ? String(value ?? '') : inner;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isControlled) setInner(e.target.value);
      onChange?.(e);
    };

    const openPicker = React.useCallback(() => {
      if (disabled) return;
      const el = nativeRef.current;
      if (!el) return;
      try {
        if (typeof el.showPicker === 'function') {
          el.showPicker();
        } else {
          el.click();
        }
      } catch {
        try {
          el.click();
        } catch {
          /* ignore */
        }
      }
    }, [disabled]);

    const display = ymd.length >= 10 ? formatYmdWithWeekday(ymd) : '';

    return (
      <div
        id={id}
        tabIndex={disabled ? -1 : 0}
        className={cn(
          'relative inline-flex w-full max-w-full min-w-0 rounded-md outline-none',
          'focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:border-ring',
          disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        )}
        onClick={(e) => {
          if (disabled) return;
          e.preventDefault();
          openPicker();
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openPicker();
          }
        }}
      >
        <Input
          readOnly
          aria-hidden
          tabIndex={-1}
          disabled={disabled}
          value={display}
          placeholder="Select date"
          className={cn(
            'pointer-events-none tabular-nums selection:bg-transparent',
            className,
          )}
        />
        <input
          ref={setNativeRef}
          type="date"
          disabled={disabled}
          tabIndex={-1}
          className={cn(
            'pointer-events-none absolute inset-0 z-10 h-full min-h-0 w-full opacity-0',
            'disabled:cursor-not-allowed',
          )}
          value={isControlled ? value : undefined}
          defaultValue={isControlled ? undefined : defaultValue}
          onChange={handleChange}
          {...rest}
        />
      </div>
    );
  },
);
YmdDateInput.displayName = 'YmdDateInput';

export { YmdDateInput };
