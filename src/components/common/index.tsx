import {
  Fragment,
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════════════════
   Brand
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * The mark: a shield (safety) whose interior reads as a discharge doorway with
 * a check. Drawn rather than an image file so it inherits currentColor and
 * stays crisp at every size.
 */
export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="sd-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22D3EE" />
          <stop offset="100%" stopColor="#0E7490" />
        </linearGradient>
      </defs>
      <path
        d="M16 2.5 27 6.2v9.1c0 6.9-4.5 12.4-11 14.2C9.5 27.7 5 22.2 5 15.3V6.2L16 2.5Z"
        fill="url(#sd-logo)"
      />
      <path
        d="M10.8 16.3l3.5 3.6 7-7.4"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark({ compact }: { compact?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Logo size={30} />
      {!compact && (
        <span className="min-w-0">
          <span className="block truncate text-[0.9375rem] font-semibold leading-tight tracking-[-0.015em]">
            SafeDischarge
          </span>
          <span className="eyebrow block truncate text-[0.625rem]">Care transitions</span>
        </span>
      )}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Button
   ═══════════════════════════════════════════════════════════════════════════ */

type Variant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'success'
  | 'outline'
  | 'subtle';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-primary-600 text-white shadow-xs hover:bg-primary-700 active:bg-primary-800 ' +
    'disabled:bg-primary-600/50',
  secondary:
    'bg-secondary-600 text-white shadow-xs hover:bg-secondary-700 disabled:bg-secondary-600/50',
  ghost:
    'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-sunken)] ' +
    'hover:text-[var(--color-text)]',
  danger:
    'bg-[var(--color-danger)] text-white shadow-xs hover:brightness-110 disabled:opacity-50',
  success:
    'bg-[var(--color-success)] text-white shadow-xs hover:brightness-110 disabled:opacity-50',
  outline:
    'border border-[var(--color-border-dark)] bg-[var(--color-surface)] text-[var(--color-text)] ' +
    'shadow-xs hover:bg-[var(--color-surface-muted)] hover:border-[var(--color-border-strong)]',
  subtle:
    'bg-[var(--color-primary-50)] text-[var(--color-primary-dark)] hover:bg-[var(--color-primary-100)]',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9.5 px-3.5 text-[0.8125rem] gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading,
    icon,
    iconRight,
    fullWidth,
    className,
    children,
    disabled,
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center rounded-lg font-medium',
        'transition-[background-color,border-color,color,box-shadow,transform] duration-150',
        'active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-y-0',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {loading ? <Spinner size={size === 'sm' ? 12 : 14} /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  );
});

/** A button that looks like plain text until hovered. For tertiary actions. */
export function LinkButton({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'text-[0.8125rem] font-medium text-[var(--color-primary)] underline-offset-2 hover:underline',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Loading
   ═══════════════════════════════════════════════════════════════════════════ */

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3.5" />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LoadingPane({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20">
      <Spinner size={22} className="text-[var(--color-primary)]" />
      <span className="text-[0.8125rem] text-muted">{label}…</span>
    </div>
  );
}

export function Skeleton({
  className,
  w,
  h = 14,
}: {
  className?: string;
  w?: number | string;
  h?: number | string;
}) {
  return <div className={cn('skeleton', className)} style={{ width: w, height: h }} />;
}

/** Placeholder rows shaped like the table that is about to arrive. */
export function SkeletonRows({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3 py-2">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="flex-1" w={c === 0 ? '28%' : undefined} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Surfaces
   ═══════════════════════════════════════════════════════════════════════════ */

export function Card({
  children,
  className,
  padded = true,
  interactive,
  accent,
  elevated,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  /** Lifts on hover — use only when the whole card is a link or button. */
  interactive?: boolean;
  /** Colour of the 3px rail along the top edge. */
  accent?: string;
  elevated?: boolean;
}) {
  return (
    <div
      className={cn(
        'relative rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]',
        elevated ? 'shadow-md' : 'shadow-xs',
        accent && 'overflow-hidden',
        interactive &&
          'cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-border-dark)] hover:shadow-md',
        padded && 'p-5',
        className
      )}
    >
      {accent && (
        <span
          className="absolute inset-x-0 top-0 h-[3px]"
          style={{ background: accent }}
          aria-hidden
        />
      )}
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  accent,
  icon,
  eyebrow,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  /** A small dot in the brand colour of whatever produced this content. */
  accent?: string;
  icon?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]"
            aria-hidden
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
          <h3 className="flex items-center gap-2 truncate">
            {accent && (
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full ring-2"
                style={{ background: accent, ['--tw-ring-color' as string]: `${accent}22` }}
                aria-hidden
              />
            )}
            {title}
          </h3>
          {subtitle && <p className="mt-1 text-xs leading-relaxed text-muted">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** A hairline rule with optional centred label, for separating card regions. */
export function Divider({ label, className }: { label?: ReactNode; className?: string }) {
  if (!label) {
    return (
      <hr
        className={cn('border-0 border-t border-[var(--color-border)]', className)}
        aria-hidden
      />
    );
  }
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <hr className="flex-1 border-0 border-t border-[var(--color-border)]" />
      <span className="eyebrow">{label}</span>
      <hr className="flex-1 border-0 border-t border-[var(--color-border)]" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Badge
   ═══════════════════════════════════════════════════════════════════════════ */

export type BadgeTone =
  | 'neutral'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'purple';

const TONES: Record<BadgeTone, { bg: string; color: string; border: string }> = {
  neutral: {
    bg: 'var(--color-surface-sunken)',
    color: 'var(--color-text-secondary)',
    border: 'var(--color-border)',
  },
  primary: {
    bg: 'var(--color-primary-50)',
    color: 'var(--color-primary-dark)',
    border: 'var(--color-primary-100)',
  },
  success: {
    bg: 'var(--color-success-light)',
    color: 'var(--color-success)',
    border: 'var(--color-success-border)',
  },
  warning: {
    bg: 'var(--color-warning-light)',
    color: 'var(--color-warning)',
    border: 'var(--color-warning-border)',
  },
  danger: {
    bg: 'var(--color-danger-light)',
    color: 'var(--color-danger)',
    border: 'var(--color-danger-border)',
  },
  info: {
    bg: 'var(--color-info-light)',
    color: 'var(--color-info)',
    border: 'var(--color-info-border)',
  },
  purple: { bg: '#F3E8FF', color: '#6D28D9', border: '#DDD6FE' },
};

export function Badge({
  children,
  tone = 'neutral',
  style,
  className,
  dot,
  size = 'md',
}: {
  children: ReactNode;
  tone?: BadgeTone;
  style?: React.CSSProperties;
  className?: string;
  dot?: boolean;
  size?: 'sm' | 'md';
}) {
  const palette = TONES[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-medium',
        size === 'sm' ? 'px-1.5 py-px text-[0.625rem]' : 'px-2.5 py-0.5 text-[0.6875rem]',
        className
      )}
      style={{
        background: palette.bg,
        color: palette.color,
        borderColor: palette.border,
        ...style,
      }}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5" aria-hidden>
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
            style={{ background: 'currentColor' }}
          />
          <span
            className="relative inline-flex h-1.5 w-1.5 rounded-full"
            style={{ background: 'currentColor' }}
          />
        </span>
      )}
      {children}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Callout — a short, framed explanation. The main storytelling device.
   ═══════════════════════════════════════════════════════════════════════════ */

const CALLOUT_ICONS = {
  info: InformationCircleIcon,
  success: CheckCircleIcon,
  warning: ExclamationTriangleIcon,
  danger: XCircleIcon,
  neutral: InformationCircleIcon,
};

export function Callout({
  tone = 'info',
  title,
  children,
  action,
  className,
  icon,
}: {
  tone?: 'info' | 'success' | 'warning' | 'danger' | 'neutral';
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  const map = {
    info: ['var(--color-info-light)', 'var(--color-info)', 'var(--color-info-border)'],
    success: ['var(--color-success-light)', 'var(--color-success)', 'var(--color-success-border)'],
    warning: ['var(--color-warning-light)', 'var(--color-warning)', 'var(--color-warning-border)'],
    danger: ['var(--color-danger-light)', 'var(--color-danger)', 'var(--color-danger-border)'],
    neutral: [
      'var(--color-surface-muted)',
      'var(--color-text-secondary)',
      'var(--color-border)',
    ],
  }[tone];
  const Icon = CALLOUT_ICONS[tone];

  return (
    <div
      className={cn('flex gap-3 rounded-xl border px-4 py-3', className)}
      style={{ background: map[0], borderColor: map[2] }}
    >
      <span className="mt-px shrink-0" style={{ color: map[1] }} aria-hidden>
        {icon ?? <Icon className="h-[18px] w-[18px]" />}
      </span>
      <div className="min-w-0 flex-1">
        {title && (
          <p className="text-[0.8125rem] font-semibold" style={{ color: map[1] }}>
            {title}
          </p>
        )}
        {children && (
          <div
            className={cn('text-xs leading-relaxed', Boolean(title) && 'mt-1')}
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {children}
          </div>
        )}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Form fields
   ═══════════════════════════════════════════════════════════════════════════ */

const FIELD_BASE =
  'w-full rounded-lg border bg-[var(--color-surface)] px-3 text-[0.8125rem] text-[var(--color-text)] ' +
  'placeholder:text-[var(--color-text-tertiary)] shadow-xs transition-all duration-150 ' +
  'border-[var(--color-border-dark)] focus:border-primary-500 focus:outline-none ' +
  'focus:ring-4 focus:ring-primary-600/10 disabled:bg-[var(--color-surface-muted)] disabled:opacity-70';

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block', className)}>
      {label && (
        <span className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
          {label}
          {required && <span className="ml-0.5 text-[var(--color-danger)]">*</span>}
        </span>
      )}
      {children}
      {error ? (
        <span className="mt-1.5 flex items-center gap-1 text-xs text-[var(--color-danger)]">
          <ExclamationTriangleIcon className="h-3.5 w-3.5 shrink-0" />
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1.5 block text-xs leading-relaxed text-faint">{hint}</span>
      ) : null}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(FIELD_BASE, 'h-9.5', className)} {...props} />;
  }
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(FIELD_BASE, 'py-2 leading-relaxed', className)} {...props} />;
  }
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(FIELD_BASE, 'h-9.5 cursor-pointer appearance-none pr-9', className)}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2394A3B8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.6' d='m6 8 4 4 4-4'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 0.6rem center',
          backgroundSize: '1.1rem',
        }}
        {...props}
      >
        {children}
      </select>
    );
  }
);

export function Checkbox({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-2.5 text-[0.8125rem]', className)}>
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-[var(--color-border-dark)] text-primary-600 focus:ring-2 focus:ring-primary-600/20"
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}

/** A compact two-or-three-way switch. Clearer than a <select> for few options. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-0.5',
        className
      )}
      role="group"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            'rounded-md px-3 py-1 text-xs font-medium transition-all duration-150',
            value === option.value
              ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-xs'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Modal
   ═══════════════════════════════════════════════════════════════════════════ */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-120"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-ink-950/50 backdrop-blur-[3px]" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95 translate-y-2"
              enterTo="opacity-100 scale-100 translate-y-0"
              leave="ease-in duration-120"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel
                className={cn(
                  'w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl',
                  widths[size]
                )}
              >
                <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-6 py-4">
                  <div className="min-w-0">
                    <Dialog.Title className="text-[0.9375rem] font-semibold tracking-[-0.01em]">
                      {title}
                    </Dialog.Title>
                    {subtitle && (
                      <p className="mt-0.5 text-xs leading-relaxed text-muted">{subtitle}</p>
                    )}
                  </div>
                  <button
                    onClick={onClose}
                    className="-m-1 rounded-lg p-1.5 text-faint transition-colors hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-text)]"
                    aria-label="Close"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>

                {footer && (
                  <div className="flex justify-end gap-2 rounded-b-2xl border-t border-[var(--color-border)] bg-[var(--color-surface-muted)] px-6 py-4">
                    {footer}
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Table
   ═══════════════════════════════════════════════════════════════════════════ */

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full border-collapse text-[0.8125rem]', className)}>{children}</table>
    </div>
  );
}

export function Th({
  children,
  className,
  onClick,
}: {
  /** Omitted for an action column that needs no header text. */
  children?: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <th
      onClick={onClick}
      className={cn(
        'sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-left first:pl-5 last:pr-5',
        'text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-tertiary)]',
        onClick && 'cursor-pointer select-none transition-colors hover:text-[var(--color-text)]',
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <td
      className={cn(
        'border-b border-[var(--color-border)] px-4 py-3 align-middle first:pl-5 last:pr-5',
        className
      )}
    >
      {children}
    </td>
  );
}

export function Tr({
  children,
  onClick,
  className,
  selected,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  selected?: boolean;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        onClick && 'cursor-pointer',
        'transition-colors hover:bg-[var(--color-surface-muted)]',
        selected && 'bg-[var(--color-primary-50)]',
        className
      )}
    >
      {children}
    </tr>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Empty / error states
   ═══════════════════════════════════════════════════════════════════════════ */

export function EmptyState({
  title,
  detail,
  action,
  icon,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      {icon && (
        <div
          className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-tertiary)]"
          aria-hidden
        >
          {icon}
        </div>
      )}
      <p className="text-[0.9375rem] font-semibold tracking-[-0.01em]">{title}</p>
      {detail && <p className="max-w-sm text-[0.8125rem] leading-relaxed text-muted">{detail}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Callout
      tone="danger"
      title="Something went wrong"
      action={
        onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        )
      }
    >
      {message}
    </Callout>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Tabs
   ═══════════════════════════════════════════════════════════════════════════ */

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  counts,
}: {
  tabs: { key: T; label: string }[];
  active: T;
  onChange: (key: T) => void;
  counts?: Partial<Record<T, number>>;
}) {
  return (
    <div
      className="flex gap-1 overflow-x-auto border-b"
      style={{ borderColor: 'var(--color-border)' }}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.key)}
            className={cn(
              '-mb-px flex items-center whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[0.8125rem] font-medium transition-colors',
              isActive
                ? 'border-primary-600 text-primary-700 dark:text-primary-300'
                : 'border-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border-dark)] hover:text-[var(--color-text)]'
            )}
          >
            {tab.label}
            {counts?.[tab.key] !== undefined && (
              <span
                className="ml-1.5 rounded-full border px-1.5 py-px text-[0.625rem] font-semibold"
                style={{
                  background: isActive ? 'var(--color-primary-50)' : 'var(--color-surface-sunken)',
                  borderColor: isActive ? 'var(--color-primary-100)' : 'var(--color-border)',
                  color: isActive ? 'var(--color-primary-dark)' : 'var(--color-text-tertiary)',
                }}
              >
                {counts[tab.key]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Page scaffolding
   ═══════════════════════════════════════════════════════════════════════════ */

export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumb,
  eyebrow,
  story,
  meta,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
  /** Small kicker above the title that says where you are. */
  eyebrow?: ReactNode;
  /** One plain-language sentence explaining what this page is for. */
  story?: ReactNode;
  /** Chips or stats sitting under the title. */
  meta?: ReactNode;
}) {
  return (
    <div className="mb-6 animate-rise">
      {breadcrumb && <div className="mb-3">{breadcrumb}</div>}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 max-w-3xl">
          {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
          <h1>{title}</h1>
          {subtitle && <p className="mt-1.5 text-[0.8125rem] text-muted">{subtitle}</p>}
          {story && (
            <p className="mt-2.5 max-w-2xl text-[0.8125rem] leading-relaxed text-[var(--color-text-secondary)]">
              {story}
            </p>
          )}
          {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function StatPill({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: ReactNode;
  tone?: BadgeTone;
}) {
  const palette = TONES[tone];
  return (
    <div
      className="rounded-lg border px-3 py-2"
      style={{ background: palette.bg, color: palette.color, borderColor: palette.border }}
    >
      <div className="text-lg font-semibold leading-tight tabular">{value}</div>
      <div className="text-[0.625rem] font-semibold uppercase tracking-[0.06em] opacity-80">
        {label}
      </div>
    </div>
  );
}

/** A label/value pair for detail panels. */
export function KeyValue({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-[var(--color-text-tertiary)]">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-[0.8125rem] font-medium">{children}</dd>
    </div>
  );
}

/** Horizontal meter. `tone` colours the fill. */
export function Progress({
  value,
  max = 100,
  tone = 'primary',
  size = 'md',
  label,
}: {
  value: number;
  max?: number;
  tone?: BadgeTone;
  size?: 'sm' | 'md';
  label?: ReactNode;
}) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(max, 1)) * 100));
  return (
    <div>
      {label && (
        <div className="mb-1 flex items-baseline justify-between text-xs">
          <span className="text-muted">{label}</span>
          <span className="font-medium tabular">{Math.round(pct)}%</span>
        </div>
      )}
      <div
        className={cn(
          'w-full overflow-hidden rounded-full bg-[var(--color-surface-sunken)]',
          size === 'sm' ? 'h-1.5' : 'h-2'
        )}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%`, background: TONES[tone].color }}
        />
      </div>
    </div>
  );
}

export function Avatar({
  name,
  size = 36,
  color = 'var(--color-primary-dark)',
  className,
}: {
  name: string;
  size?: number;
  color?: string;
  className?: string;
}) {
  const text = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        className
      )}
      style={{ width: size, height: size, background: color, fontSize: size * 0.36 }}
      aria-hidden
    >
      {text}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Timeline — the narrative primitive. A vertical rail of events.
   ═══════════════════════════════════════════════════════════════════════════ */

export function Timeline({ children, className }: { children: ReactNode; className?: string }) {
  return <ol className={cn('relative', className)}>{children}</ol>;
}

export function TimelineItem({
  marker,
  title,
  meta,
  children,
  last,
  tone = 'var(--color-border-dark)',
  index = 0,
}: {
  marker?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
  last?: boolean;
  /** Colour of the node and the connector above it. */
  tone?: string;
  index?: number;
}) {
  return (
    <li
      className="relative flex gap-3.5 pb-4 last:pb-0 animate-rise"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {!last && (
        <span
          className="absolute left-[13px] top-7 bottom-0 w-px origin-top animate-draw-line"
          style={{ background: 'var(--color-border)', animationDelay: `${index * 50 + 100}ms` }}
          aria-hidden
        />
      )}
      <span
        className="relative z-10 mt-0.5 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border-2 bg-[var(--color-surface)] text-[0.625rem] font-bold"
        style={{ borderColor: tone, color: tone }}
      >
        {marker}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[0.8125rem] font-medium">{title}</span>
          {meta && <span className="text-[0.6875rem] text-faint">{meta}</span>}
        </div>
        {children && <div className="mt-1 text-xs leading-relaxed text-muted">{children}</div>}
      </div>
    </li>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Confirm dialog
   ═══════════════════════════════════════════════════════════════════════════ */

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  tone = 'primary',
  pending,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  tone?: Variant;
  pending?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={pending}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-[0.8125rem] leading-relaxed text-muted">{message}</div>
    </Modal>
  );
}
