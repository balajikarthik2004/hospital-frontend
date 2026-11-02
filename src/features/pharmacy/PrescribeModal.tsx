import { useState } from 'react';
import { PlusIcon, TrashIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import {
  Badge,
  Button,
  Callout,
  Field,
  Input,
  Modal,
  Select,
  Spinner,
  Textarea,
} from '@/components/common';
import { errorMessage } from '@/lib/api';
import { useNotificationStore } from '@/store/notificationStore';
import {
  createPrescription,
  sendToPharmacy,
  type Prescription,
  type PrescriptionItemInput,
  type PrescriptionPriority,
} from '@/lib/prescriptionApi';
import { SafetyFlagList } from './SafetyFlagList';

/**
 * Where a doctor writes a prescription.
 *
 * It is saved first and sent second, deliberately. Saving runs the safety
 * screen against the patient's allergies and current medicines, so the
 * prescriber sees the interactions *before* committing — not after the
 * pharmacy has already queued it and has to ring the ward back.
 */

const ROUTES = ['oral', 'IV', 'IM', 'SC', 'topical', 'inhaled', 'rectal'];

const BLANK: PrescriptionItemInput = {
  drugName: '',
  dosage: '',
  frequency: '',
  route: 'oral',
  durationDays: 0,
  quantity: 0,
  instructions: '',
  substitutionAllowed: true,
};

export function PrescribeModal({
  open,
  onClose,
  patientId,
  patientName,
  admissionId,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  /** The patient's Mongo _id. */
  patientId: string;
  patientName?: string;
  admissionId?: string | null;
  onSent?: (prescription: Prescription) => void;
}) {
  const push = useNotificationStore((s) => s.push);

  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<PrescriptionPriority>('routine');
  const [items, setItems] = useState<PrescriptionItemInput[]>([{ ...BLANK }]);

  const [saved, setSaved] = useState<Prescription | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setDiagnosis('');
    setNotes('');
    setPriority('routine');
    setItems([{ ...BLANK }]);
    setSaved(null);
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const setItem = (index: number, patch: Partial<PrescriptionItemInput>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
    // The saved screen described the previous list; it no longer applies.
    setSaved(null);
  };

  const usable = items.filter((i) => i.drugName.trim());
  const incomplete = usable.filter((i) => !i.dosage.trim() || !i.frequency.trim());

  const save = async () => {
    if (!usable.length) {
      setError('Add at least one medicine.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const prescription = await createPrescription({
        patientId,
        admissionId: admissionId ?? null,
        diagnosis,
        notes,
        priority,
        items: usable,
      });
      setSaved(prescription);
      push({
        tone: prescription.safety.flags.length ? 'warning' : 'success',
        title: `${prescription.prescriptionId} saved`,
        detail: prescription.safety.flags.length
          ? `${prescription.safety.flags.length} safety flag(s) to review before sending`
          : 'No safety flags. Ready to send to the pharmacy.',
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!saved) return;
    setBusy(true);
    setError(null);
    try {
      const sent = await sendToPharmacy(saved._id);
      push({
        tone: 'success',
        title: `${sent.prescriptionId} sent to the pharmacy`,
        detail: 'The pharmacy queue has been notified.',
      });
      onSent?.(sent);
      close();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Write a prescription"
      subtitle={patientName ? `For ${patientName}` : undefined}
      size="xl"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <span className="text-[0.75rem] text-muted">
            {saved
              ? `${saved.prescriptionId} saved as a draft`
              : 'Saving runs the safety check against this patient’s allergies and current medicines.'}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={close} disabled={busy}>
              Cancel
            </Button>
            {!saved ? (
              <Button onClick={() => void save()} disabled={busy || !usable.length}>
                {busy ? <Spinner size={14} /> : null}
                <span className={busy ? 'ml-1.5' : ''}>Save &amp; check safety</span>
              </Button>
            ) : (
              <Button onClick={() => void send()} disabled={busy}>
                {busy ? <Spinner size={14} /> : <PaperAirplaneIcon className="h-4 w-4" />}
                <span className="ml-1.5">Send to pharmacy</span>
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {error && <Callout tone="danger">{error}</Callout>}

        <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
          <Field label="Reason / diagnosis" hint="Shown to the pharmacist">
            <Input
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="e.g. Lower respiratory tract infection"
              disabled={busy}
            />
          </Field>
          <Field label="Priority">
            <Select
              value={priority}
              onChange={(e) => setPriority(e.target.value as PrescriptionPriority)}
              disabled={busy}
            >
              <option value="routine">Routine</option>
              <option value="urgent">Urgent</option>
              <option value="stat">STAT</option>
            </Select>
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">
              Medicines
            </span>
            <Button
              variant="outline"
              onClick={() => setItems((prev) => [...prev, { ...BLANK }])}
              disabled={busy}
            >
              <PlusIcon className="h-4 w-4" />
              <span className="ml-1.5">Add medicine</span>
            </Button>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <div
                key={index}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] p-3"
              >
                <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1.2fr_auto]">
                  <Field label="Medicine">
                    <Input
                      value={item.drugName}
                      onChange={(e) => setItem(index, { drugName: e.target.value })}
                      placeholder="e.g. Amoxicillin"
                      disabled={busy}
                    />
                  </Field>
                  <Field label="Dose">
                    <Input
                      value={item.dosage}
                      onChange={(e) => setItem(index, { dosage: e.target.value })}
                      placeholder="500 mg"
                      disabled={busy}
                    />
                  </Field>
                  <Field label="How often">
                    <Input
                      value={item.frequency}
                      onChange={(e) => setItem(index, { frequency: e.target.value })}
                      placeholder="three times a day"
                      disabled={busy}
                    />
                  </Field>
                  <div className="flex items-end pb-1">
                    <button
                      type="button"
                      onClick={() =>
                        setItems((prev) =>
                          prev.length === 1 ? [{ ...BLANK }] : prev.filter((_, i) => i !== index)
                        )
                      }
                      disabled={busy}
                      aria-label={`Remove ${item.drugName || 'this medicine'}`}
                      className="rounded-lg p-2 text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-danger-light)] hover:text-[var(--color-danger)]"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-4">
                  <Field label="Route">
                    <Select
                      value={item.route}
                      onChange={(e) => setItem(index, { route: e.target.value })}
                      disabled={busy}
                    >
                      {ROUTES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Days" hint="0 = ongoing">
                    <Input
                      type="number"
                      min={0}
                      value={item.durationDays ?? 0}
                      onChange={(e) =>
                        setItem(index, { durationDays: Number(e.target.value) || 0 })
                      }
                      disabled={busy}
                    />
                  </Field>
                  <Field label="Quantity">
                    <Input
                      type="number"
                      min={0}
                      value={item.quantity ?? 0}
                      onChange={(e) => setItem(index, { quantity: Number(e.target.value) || 0 })}
                      disabled={busy}
                    />
                  </Field>
                  <Field label="Generic allowed">
                    <Select
                      value={item.substitutionAllowed ? 'yes' : 'no'}
                      onChange={(e) =>
                        setItem(index, { substitutionAllowed: e.target.value === 'yes' })
                      }
                      disabled={busy}
                    >
                      <option value="yes">Yes</option>
                      <option value="no">No — brand only</option>
                    </Select>
                  </Field>
                </div>

                <Field label="Instructions for the patient" className="mt-3">
                  <Input
                    value={item.instructions}
                    onChange={(e) => setItem(index, { instructions: e.target.value })}
                    placeholder="e.g. Take with food"
                    disabled={busy}
                  />
                </Field>
              </div>
            ))}
          </div>

          {incomplete.length > 0 && (
            <p className="mt-2 text-[0.75rem] text-[var(--color-warning)]">
              {incomplete.map((i) => i.drugName).join(', ')} still needs a dose and how often.
              The pharmacy cannot dispense without both.
            </p>
          )}
        </div>

        <Field label="Note for the pharmacist">
          <Textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything the pharmacy should know"
            disabled={busy}
          />
        </Field>

        {saved && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                Safety check
              </span>
              <Badge tone={saved.safety.passed ? 'success' : 'warning'}>
                {saved.safety.passed
                  ? 'No blocking issues'
                  : `${saved.safety.flags.length} flag(s)`}
              </Badge>
            </div>
            {saved.safety.flags.length === 0 ? (
              <Callout tone="success">
                No interactions, allergy conflicts or duplications found against this patient’s
                record.
              </Callout>
            ) : (
              <SafetyFlagList flags={saved.safety.flags} />
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
