import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowPathIcon,
  BeakerIcon,
  CheckBadgeIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  DocumentTextIcon,
  InboxArrowDownIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  LoadingPane,
  Modal,
  PageHeader,
  Spinner,
  StatPill,
  Tabs,
  Textarea,
} from '@/components/common';
import { Markdown } from '@/components/common/Markdown';
import { errorMessage } from '@/lib/api';
import { useSocketEvent } from '@/hooks/useSocket';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import {
  STATUS_LABEL,
  acknowledgeFlag,
  cancelPrescription,
  dispensePrescription,
  fetchPrescription,
  fetchPrescriptions,
  fetchQueueSummary,
  generateCounselling,
  markReady,
  verifyPrescription,
  type Prescription,
  type PrescriptionStatus,
  type QueueSummary,
} from '@/lib/prescriptionApi';
import { SafetyFlagList } from './SafetyFlagList';

/* ═══════════════════════════════════════════════════════════════════════════
   The pharmacy counter.

   A queue on the left, the prescription in front of you on the right. That
   is how the work actually happens: you are never looking at one script in
   isolation, you are looking at one while five more wait.

   The single hard rule in this screen is that critical and high flags must
   be accepted by a named pharmacist before "Hand over" will do anything.
   The server enforces it too — this just makes the reason visible before
   someone wastes a click.
   ═══════════════════════════════════════════════════════════════════════════ */

type TabKey = 'sent_to_pharmacy' | 'preparing' | 'ready' | 'dispensed';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'sent_to_pharmacy', label: 'New' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready', label: 'Ready' },
  { key: 'dispensed', label: 'Dispensed' },
];

const PRIORITY_TONE = { stat: 'danger', urgent: 'warning', routine: 'neutral' } as const;

function waitingFor(iso: string | null): string {
  if (!iso) return '';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function PharmacyPage() {
  const push = useNotificationStore((s) => s.push);
  const can = useAuthStore((s) => s.can);
  const canDispense = can('prescription:dispense');

  const [tab, setTab] = useState<TabKey>('sent_to_pharmacy');
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [summary, setSummary] = useState<QueueSummary | null>(null);
  const [selected, setSelected] = useState<Prescription | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (status: TabKey, keepSelection = false) => {
      setLoading(true);
      setError(null);
      try {
        const [list, counts] = await Promise.all([
          fetchPrescriptions({ status, search: search.trim() || undefined, limit: 100 }),
          fetchQueueSummary(),
        ]);
        setPrescriptions(list.prescriptions);
        setSummary(counts);
        if (!keepSelection) {
          setSelected(list.prescriptions[0] ?? null);
        }
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [search]
  );

  useEffect(() => {
    void load(tab);
  }, [tab, load]);

  // The counter is a queue someone is standing at, so new work should appear
  // without anyone pressing refresh.
  useSocketEvent('prescription:new', () => {
    push({ tone: 'info', title: 'New prescription in the queue' });
    void load(tab, true);
  });
  useSocketEvent('prescription:status-changed', () => void load(tab, true));

  const refreshSelected = async (updated: Prescription) => {
    setSelected(updated);
    await load(tab, true);
  };

  const counts = useMemo(
    () =>
      summary
        ? {
            sent_to_pharmacy: summary.counts.sent_to_pharmacy,
            preparing: summary.counts.preparing,
            ready: summary.counts.ready,
            dispensed: summary.counts.dispensed,
          }
        : undefined,
    [summary]
  );

  return (
    <div>
      <PageHeader
        eyebrow="Pharmacy"
        title="Dispensing counter"
        story="Everything the wards and clinics have prescribed, in the order it arrived. Check it, prepare it, hand it over — and give the patient a sheet that explains what they are taking."
        meta={
          <>
            <StatPill label="Waiting" value={summary?.waiting ?? '—'} tone="primary" />
            <StatPill
              label="Urgent"
              value={summary?.urgent ?? '—'}
              tone={summary?.urgent ? 'danger' : 'neutral'}
            />
            <StatPill label="Dispensed" value={summary?.counts.dispensed ?? '—'} tone="success" />
          </>
        }
        actions={
          <Button
            variant="outline"
            loading={loading}
            icon={<ArrowPathIcon className="h-4 w-4" />}
            onClick={() => void load(tab, true)}
          >
            Refresh
          </Button>
        }
      />

      {!canDispense && (
        <Callout tone="info" className="mb-4">
          You can see the queue, but only pharmacy staff can verify or hand over medicines.
        </Callout>
      )}

      {error && (
        <Callout tone="danger" className="mb-4">
          {error}
        </Callout>
      )}

      <Tabs active={tab} onChange={setTab} tabs={TABS} counts={counts} />

      <div className="mt-5 grid gap-5 lg:grid-cols-[22rem_1fr]">
        <div>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void load(tab)}
            placeholder="Search by patient or RX number"
            aria-label="Search prescriptions"
            className="mb-3"
          />

          {loading && !prescriptions.length ? (
            <LoadingPane label="Loading the queue" />
          ) : prescriptions.length === 0 ? (
            <Card>
              <EmptyState
                icon={<InboxArrowDownIcon className="h-6 w-6" />}
                title="Nothing here"
                detail={
                  tab === 'sent_to_pharmacy'
                    ? 'No new prescriptions are waiting. They appear here the moment a doctor sends one.'
                    : `No prescriptions are ${STATUS_LABEL[tab as PrescriptionStatus].toLowerCase()}.`
                }
              />
            </Card>
          ) : (
            <ul className="space-y-2">
              {prescriptions.map((rx) => {
                const active = selected?._id === rx._id;
                const blocking = rx.safety.flags.filter(
                  (f) => (f.severity === 'critical' || f.severity === 'high') && !f.acknowledged
                ).length;
                const demo = rx.patientId?.demographics;

                return (
                  <li key={rx._id}>
                    <button
                      type="button"
                      onClick={() => setSelected(rx)}
                      className={`w-full rounded-xl border p-3 text-left transition-colors ${
                        active
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary-50)]'
                          : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-dark)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[0.6875rem] text-muted">
                          {rx.prescriptionId}
                        </span>
                        {rx.priority !== 'routine' && (
                          <Badge tone={PRIORITY_TONE[rx.priority]} size="sm">
                            {rx.priority.toUpperCase()}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-[0.8125rem] font-semibold">
                        {demo ? `${demo.firstName} ${demo.lastName}` : 'Unknown patient'}
                      </p>
                      <p className="text-[0.75rem] text-muted">
                        {rx.items.length} item{rx.items.length === 1 ? '' : 's'}
                        {rx.diagnosis ? ` · ${rx.diagnosis}` : ''}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        {rx.sentToPharmacyAt && (
                          <span className="inline-flex items-center gap-1 text-[0.6875rem] text-muted">
                            <ClockIcon className="h-3 w-3" />
                            {waitingFor(rx.sentToPharmacyAt)}
                          </span>
                        )}
                        {blocking > 0 && (
                          <Badge tone="danger" size="sm">
                            {blocking} to review
                          </Badge>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {selected ? (
          <PrescriptionDetail
            prescription={selected}
            canDispense={canDispense}
            onChanged={refreshSelected}
          />
        ) : (
          <Card>
            <EmptyState
              icon={<BeakerIcon className="h-6 w-6" />}
              title="Pick a prescription"
              detail="Choose one from the queue to check it, prepare it and hand it over."
            />
          </Card>
        )}
      </div>
    </div>
  );
}

/* ── One prescription at the counter ────────────────────────────────────── */

function PrescriptionDetail({
  prescription,
  canDispense,
  onChanged,
}: {
  prescription: Prescription;
  canDispense: boolean;
  onChanged: (updated: Prescription) => void | Promise<void>;
}) {
  const push = useNotificationStore((s) => s.push);
  const [busy, setBusy] = useState<string | null>(null);
  const [showDispense, setShowDispense] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [counselling, setCounselling] = useState(prescription.counselling?.content ?? '');

  useEffect(() => {
    setCounselling(prescription.counselling?.content ?? '');
  }, [prescription._id, prescription.counselling?.content]);

  const demo = prescription.patientId?.demographics;
  const patientName = demo ? `${demo.firstName} ${demo.lastName}` : 'Unknown patient';
  const allergies = prescription.patientId?.medicalHistory?.allergies ?? [];

  const blocking = prescription.safety.flags.filter(
    (f) => (f.severity === 'critical' || f.severity === 'high') && !f.acknowledged
  );

  const run = async (label: string, fn: () => Promise<Prescription>) => {
    setBusy(label);
    try {
      await onChanged(await fn());
      push({ tone: 'success', title: `${prescription.prescriptionId} — ${label}` });
    } catch (err) {
      push({ tone: 'error', title: 'That did not work', detail: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  const writeCounselling = async () => {
    setBusy('counselling');
    try {
      const result = await generateCounselling(prescription._id);
      setCounselling(result.counselling);
      push({
        tone: 'success',
        title: 'Counselling sheet written',
        detail: 'Check it reads correctly before giving it to the patient.',
      });
    } catch (err) {
      push({
        tone: 'error',
        title: 'Could not write the counselling sheet',
        detail: errorMessage(err),
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          icon={<ClipboardDocumentCheckIcon className="h-5 w-5" />}
          eyebrow={prescription.prescriptionId}
          title={patientName}
          subtitle={
            `${prescription.patientId?.patientId ?? '—'} · prescribed by ` +
            `${prescription.prescribedBy ? `Dr. ${prescription.prescribedBy.firstName} ${prescription.prescribedBy.lastName}` : 'unknown'}` +
            (prescription.diagnosis ? ` · ${prescription.diagnosis}` : '')
          }
          action={<Badge tone="info">{STATUS_LABEL[prescription.status]}</Badge>}
        />

        {allergies.length > 0 && (
          <Callout tone="warning" title="Documented allergies" className="mb-4">
            {allergies.map((a) => `${a.substance} (${a.severity})`).join(' · ')}
          </Callout>
        )}

        {prescription.notes && (
          <p className="mb-4 rounded-lg bg-[var(--color-surface-sunken)] px-3 py-2 text-[0.8125rem]">
            <span className="text-muted">Prescriber’s note: </span>
            {prescription.notes}
          </p>
        )}

        <ul className="space-y-2">
          {prescription.items.map((item) => (
            <li
              key={item._id}
              className="rounded-lg border border-[var(--color-border)] p-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[0.875rem] font-semibold">{item.drugName}</span>
                <span className="text-[0.75rem] text-muted">
                  {item.drugClass || 'Unclassified'}
                </span>
              </div>
              <p className="mt-1 text-[0.8125rem]">
                {item.dosage} · {item.frequency} · {item.route}
                {item.durationDays ? ` · for ${item.durationDays} days` : ' · ongoing'}
                {item.quantity ? ` · qty ${item.quantity}` : ''}
              </p>
              {item.instructions && (
                <p className="mt-1 text-[0.75rem] text-muted">{item.instructions}</p>
              )}
              <div className="mt-1.5 flex flex-wrap gap-2">
                {!item.substitutionAllowed && (
                  <Badge tone="warning" size="sm">
                    Brand only — no substitution
                  </Badge>
                )}
                {item.substitutedWith && (
                  <Badge tone="purple" size="sm">
                    Supplied: {item.substitutedWith}
                  </Badge>
                )}
                {item.isDispensed && (
                  <Badge tone="success" size="sm">
                    Dispensed{item.dispensedQuantity ? ` ×${item.dispensedQuantity}` : ''}
                  </Badge>
                )}
              </div>
            </li>
          ))}
        </ul>

        {canDispense && prescription.status !== 'dispensed' && prescription.status !== 'cancelled' && (
          <div className="mt-4 flex flex-wrap gap-2">
            {prescription.status === 'sent_to_pharmacy' && (
              <Button
                loading={busy === 'verified'}
                disabled={Boolean(busy)}
                onClick={() => void run('verified', () => verifyPrescription(prescription._id))}
              >
                Accept &amp; start preparing
              </Button>
            )}
            {prescription.status === 'preparing' && (
              <Button
                loading={busy === 'ready'}
                disabled={Boolean(busy)}
                icon={<CheckBadgeIcon className="h-4 w-4" />}
                onClick={() => void run('ready', () => markReady(prescription._id))}
              >
                Mark ready for collection
              </Button>
            )}
            {(prescription.status === 'ready' || prescription.status === 'preparing') && (
              <Button onClick={() => setShowDispense(true)} disabled={Boolean(busy)}>
                Hand over to patient
              </Button>
            )}
            <Button variant="ghost" onClick={() => setShowCancel(true)} disabled={Boolean(busy)}>
              Cancel prescription
            </Button>
          </div>
        )}

        {prescription.status === 'dispensed' && (
          <Callout tone="success" className="mt-4">
            Handed over to <strong>{prescription.pharmacy.collectedBy}</strong>
            {prescription.pharmacy.dispensedBy &&
              ` by ${prescription.pharmacy.dispensedBy.firstName} ${prescription.pharmacy.dispensedBy.lastName}`}
            {prescription.pharmacy.dispensedAt &&
              ` on ${new Date(prescription.pharmacy.dispensedAt).toLocaleString()}`}
            .
          </Callout>
        )}

        {prescription.status === 'cancelled' && (
          <Callout tone="neutral" className="mt-4">
            Cancelled: {prescription.cancelReason || 'no reason recorded'}
          </Callout>
        )}
      </Card>

      {prescription.safety.flags.length > 0 && (
        <Card>
          <CardHeader
            title="Safety checks"
            subtitle={
              blocking.length
                ? `${blocking.length} must be accepted before these medicines can be handed over`
                : 'All blocking issues have been accepted'
            }
            action={
              <Badge tone={blocking.length ? 'danger' : 'success'}>
                {blocking.length ? 'Action needed' : 'Cleared'}
              </Badge>
            }
          />
          <SafetyFlagList
            flags={prescription.safety.flags}
            busyFlagId={busy?.startsWith('flag:') ? busy.slice(5) : null}
            onAcknowledge={
              canDispense && prescription.status !== 'dispensed'
                ? async (flagId, note) => {
                    setBusy(`flag:${flagId}`);
                    try {
                      await onChanged(
                        await acknowledgeFlag(prescription._id, flagId, note)
                      );
                    } catch (err) {
                      push({
                        tone: 'error',
                        title: 'Could not record that',
                        detail: errorMessage(err),
                      });
                    } finally {
                      setBusy(null);
                    }
                  }
                : undefined
            }
          />
        </Card>
      )}

      <Card>
        <CardHeader
          icon={<SparklesIcon className="h-5 w-5" />}
          accent="#7C3AED"
          title="Patient counselling sheet"
          subtitle="Written by the Medication Agent from this prescription — the medicines, doses and durations are the prescriber's, the agent only puts them in plain words."
          action={
            <Button
              variant="outline"
              loading={busy === 'counselling'}
              disabled={Boolean(busy)}
              icon={<DocumentTextIcon className="h-4 w-4" />}
              onClick={() => void writeCounselling()}
            >
              {counselling ? 'Rewrite' : 'Write sheet'}
            </Button>
          }
        />

        {busy === 'counselling' ? (
          <div className="flex items-center gap-2 py-8 text-[0.8125rem] text-muted">
            <Spinner size={16} />
            <span>Reading the prescription and writing the sheet…</span>
          </div>
        ) : counselling ? (
          <>
            <div className="prose-clinical max-h-[28rem] overflow-y-auto">
              <Markdown content={counselling} />
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" onClick={() => window.print()}>
                Print for the patient
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  void navigator.clipboard?.writeText(counselling);
                  push({ tone: 'success', title: 'Copied' });
                }}
              >
                Copy
              </Button>
            </div>
          </>
        ) : (
          <EmptyState
            icon={<DocumentTextIcon className="h-6 w-6" />}
            title="No sheet written yet"
            detail="Generate a plain-language sheet explaining what each medicine is for, how to take it and when to get help. Read it before handing it over — it is a draft, like everything the agents produce."
          />
        )}
      </Card>

      <DispenseModal
        open={showDispense}
        onClose={() => setShowDispense(false)}
        prescription={prescription}
        blockingCount={blocking.length}
        onDispensed={async (updated) => {
          setShowDispense(false);
          await onChanged(updated);
        }}
      />

      <CancelModal
        open={showCancel}
        onClose={() => setShowCancel(false)}
        prescriptionId={prescription.prescriptionId}
        onCancelled={async (reason) => {
          await run('cancelled', () => cancelPrescription(prescription._id, reason));
          setShowCancel(false);
        }}
      />
    </div>
  );
}

/* ── Handing over ───────────────────────────────────────────────────────── */

function DispenseModal({
  open,
  onClose,
  prescription,
  blockingCount,
  onDispensed,
}: {
  open: boolean;
  onClose: () => void;
  prescription: Prescription;
  blockingCount: number;
  onDispensed: (updated: Prescription) => void | Promise<void>;
}) {
  const [collectedBy, setCollectedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [subs, setSubs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!collectedBy.trim()) {
      setError('Record who collected the medicines.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await dispensePrescription(prescription._id, {
        collectedBy: collectedBy.trim(),
        notes,
        items: prescription.items.map((item) => ({
          itemId: item._id,
          dispensedQuantity: item.quantity,
          substitutedWith: subs[item._id]?.trim() || null,
        })),
      });
      await onDispensed(updated);
      setCollectedBy('');
      setNotes('');
      setSubs({});
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Hand over to the patient"
      subtitle={`${prescription.prescriptionId} · ${prescription.items.length} item(s)`}
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Back
          </Button>
          <Button loading={busy} disabled={blockingCount > 0} onClick={() => void submit()}>
            Confirm handover
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {blockingCount > 0 && (
          <Callout tone="danger" title="Safety checks still outstanding">
            {blockingCount} critical or high warning
            {blockingCount === 1 ? '' : 's'} must be reviewed and accepted before these
            medicines can be handed over. Close this and deal with them first.
          </Callout>
        )}

        {error && <Callout tone="danger">{error}</Callout>}

        <Field label="Who collected the medicines?" required hint="The patient, or the named person collecting for them">
          <Input
            value={collectedBy}
            onChange={(e) => setCollectedBy(e.target.value)}
            placeholder="e.g. Senthil Kumar (patient)"
            disabled={busy || blockingCount > 0}
          />
        </Field>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
            Substitutions
          </span>
          <ul className="space-y-2">
            {prescription.items.map((item) => (
              <li key={item._id} className="rounded-lg border border-[var(--color-border)] p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[0.8125rem] font-medium">
                    {item.drugName} {item.dosage}
                  </span>
                  {!item.substitutionAllowed && (
                    <Badge tone="warning" size="sm">
                      Brand only
                    </Badge>
                  )}
                </div>
                {item.substitutionAllowed && (
                  <Input
                    value={subs[item._id] ?? ''}
                    onChange={(e) => setSubs((p) => ({ ...p, [item._id]: e.target.value }))}
                    placeholder="Leave blank if you supplied exactly this"
                    disabled={busy || blockingCount > 0}
                    className="mt-1.5"
                  />
                )}
              </li>
            ))}
          </ul>
        </div>

        <Field label="Pharmacy note">
          <Textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything recorded at handover"
            disabled={busy || blockingCount > 0}
          />
        </Field>
      </div>
    </Modal>
  );
}


function CancelModal({
  open,
  onClose,
  prescriptionId,
  onCancelled,
}: {
  open: boolean;
  onClose: () => void;
  prescriptionId: string;
  onCancelled: (reason: string) => void | Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cancel this prescription?"
      subtitle={prescriptionId}
      size="sm"
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Keep it
          </Button>
          <Button
            variant="danger"
            loading={busy}
            disabled={!reason.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await onCancelled(reason.trim());
                setReason('');
              } finally {
                setBusy(false);
              }
            }}
          >
            Cancel prescription
          </Button>
        </div>
      }
    >
      <p className="mb-3 text-[0.8125rem] leading-relaxed text-muted">
        The ward will see this as cancelled. Give a reason so whoever prescribed it knows what
        to do next.
      </p>
      <Field label="Reason" required>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Out of stock — prescriber asked for an alternative"
          disabled={busy}
        />
      </Field>
    </Modal>
  );
}
