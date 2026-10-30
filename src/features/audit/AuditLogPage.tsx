import { useEffect, useRef, useState } from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingPane,
  PageHeader,
  Select,
  Spinner,
  Table,
  Td,
  Th,
  Tr,
} from '@/components/common';
import { api, errorMessage } from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from '@/store/notificationStore';
import { downloadBlob, fmtDateTime, titleCase } from '@/lib/utils';
import type { AuditLogEntry } from '@/types';

const PAGE_SIZE = 40;

/** Colour-codes the action so AI activity stands apart from human activity. */
function actionTone(action: string): 'purple' | 'danger' | 'success' | 'info' | 'neutral' {
  if (action.startsWith('agent')) return 'purple';
  if (action.includes('reject') || action.includes('deactivat')) return 'danger';
  if (action.includes('approve') || action.includes('complete')) return 'success';
  if (action.includes('creat') || action.includes('record') || action.includes('initiat'))
    return 'info';
  return 'neutral';
}

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const q = useDebounce(search, 300);
  const sentinel = useRef<HTMLDivElement>(null);

  const buildParams = (targetPage: number) => {
    const params = new URLSearchParams({
      page: String(targetPage),
      limit: String(PAGE_SIZE),
    });
    if (action) params.set('action', action);
    if (entity) params.set('entity', entity);
    if (q) params.set('q', q);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return params;
  };

  // Reload from page 1 whenever a filter changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<{ logs: AuditLogEntry[]; actions: string[]; pagination: { total: number } }>(
        `/audit?${buildParams(1).toString()}`
      )
      .then((res) => {
        if (cancelled) return;
        setLogs(res.data.logs);
        setActions(res.data.actions);
        setTotal(res.data.pagination.total);
        setPage(1);
      })
      .catch((err) => !cancelled && setError(errorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, entity, q, from, to]);

  const loadMore = async () => {
    if (loadingMore || logs.length >= total) return;
    setLoadingMore(true);
    try {
      const res = await api.get<{ logs: AuditLogEntry[] }>(
        `/audit?${buildParams(page + 1).toString()}`
      );
      setLogs((prev) => [...prev, ...res.data.logs]);
      setPage((p) => p + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  };

  // Infinite scroll.
  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => entries[0].isIntersecting && void loadMore(),
      { rootMargin: '200px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs.length, total, loadingMore]);

  const exportCsv = async () => {
    try {
      const res = await api.get(`/audit/export?${buildParams(1).toString()}`, {
        responseType: 'text',
      });
      downloadBlob(
        res.data as string,
        `safedischarge-audit-${new Date().toISOString().slice(0, 10)}.csv`
      );
      toast.success('Audit log exported');
    } catch (err) {
      toast.error('Export failed', errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Oversight"
        title="Audit log"
        subtitle={`${total.toLocaleString()} entries`}
        story="Every agent recommendation, human edit, approval and rejection, recorded permanently and in order. This is the record you would hand to a regulator."
        actions={
          <Button
            variant="outline"
            icon={<ArrowDownTrayIcon className="h-4 w-4" />}
            onClick={exportCsv}
          >
            Export CSV
          </Button>
        }
      />

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Search description" className="lg:col-span-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. warfarin, approved, Kumar"
            />
          </Field>
          <Field label="Action">
            <Select value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="">All actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="From">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {['', 'discharge_packages', 'patients', 'medications', 'vitals', 'admissions', 'users'].map(
            (e) => (
              <button
                key={e || 'all'}
                onClick={() => setEntity(e)}
                className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                style={{
                  background:
                    entity === e ? 'var(--color-primary-50)' : 'var(--color-surface-muted)',
                  color:
                    entity === e
                      ? 'var(--color-primary-dark)'
                      : 'var(--color-text-secondary)',
                }}
              >
                {e ? titleCase(e) : 'All entities'}
              </button>
            )
          )}
        </div>
      </Card>

      {error && <ErrorState message={error} />}

      <Card padded={false}>
        {loading ? (
          <LoadingPane label="Loading the audit trail" />
        ) : logs.length === 0 ? (
          <EmptyState title="No audit entries match" detail="Try widening the filters." />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Timestamp</Th>
                  <Th>User</Th>
                  <Th>Role</Th>
                  <Th>Action</Th>
                  <Th>Entity</Th>
                  <Th>Patient</Th>
                  <Th>Details</Th>
                  <Th>IP</Th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <Tr key={log._id}>
                    <Td className="whitespace-nowrap font-mono text-xs text-muted">
                      {fmtDateTime(log.timestamp)}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {log.userId ? (
                        `${log.userId.firstName} ${log.userId.lastName}`
                      ) : (
                        <span className="italic text-faint">system</span>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={log.userRole === 'system' ? 'purple' : 'neutral'}>
                        {titleCase(log.userRole)}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge tone={actionTone(log.action)}>{log.action}</Badge>
                    </Td>
                    <Td className="text-xs text-muted">{log.entity}</Td>
                    <Td className="whitespace-nowrap font-mono text-xs text-muted">
                      {log.patientId?.patientId ?? '—'}
                    </Td>
                    <Td className="max-w-[420px]">
                      <span className="block text-xs">{log.details?.description}</span>
                    </Td>
                    <Td className="font-mono text-[10px] text-faint">{log.ipAddress || '—'}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>

            <div ref={sentinel} className="flex justify-center py-4">
              {loadingMore ? (
                <span className="flex items-center gap-2 text-xs text-muted">
                  <Spinner size={14} /> Loading more…
                </span>
              ) : logs.length >= total ? (
                <span className="text-xs text-faint">
                  All {total.toLocaleString()} entries loaded
                </span>
              ) : (
                <Button size="sm" variant="outline" onClick={loadMore}>
                  Load more
                </Button>
              )}
            </div>
          </>
        )}
      </Card>
    </>
  );
}
