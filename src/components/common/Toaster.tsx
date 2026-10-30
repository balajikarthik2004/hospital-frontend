import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useNotificationStore, type ToastTone } from '@/store/notificationStore';

const ICONS: Record<ToastTone, typeof CheckCircleIcon> = {
  success: CheckCircleIcon,
  error: XCircleIcon,
  warning: ExclamationTriangleIcon,
  info: InformationCircleIcon,
};

const COLORS: Record<ToastTone, { border: string; icon: string }> = {
  success: { border: 'var(--color-success)', icon: 'var(--color-success)' },
  error: { border: 'var(--color-danger)', icon: 'var(--color-danger)' },
  warning: { border: 'var(--color-warning)', icon: 'var(--color-warning)' },
  info: { border: 'var(--color-info)', icon: 'var(--color-info)' },
};

export function Toaster() {
  const toasts = useNotificationStore((s) => s.toasts);
  const dismiss = useNotificationStore((s) => s.dismiss);

  if (!toasts.length) return null;

  return (
    <div
      className="no-print pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const Icon = ICONS[t.tone];
        const palette = COLORS[t.tone];
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex animate-fade-in items-start gap-3 rounded-xl border-l-4 bg-[var(--color-surface)] p-3.5 shadow-lg"
            style={{ borderLeftColor: palette.border, border: '1px solid var(--color-border)', borderLeftWidth: 4 }}
            role="status"
          >
            <Icon className="mt-0.5 h-5 w-5 shrink-0" style={{ color: palette.icon }} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.detail && <p className="mt-0.5 text-xs text-muted">{t.detail}</p>}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="-m-1 rounded p-1 text-faint hover:bg-[var(--color-surface-muted)]"
              aria-label="Dismiss"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
