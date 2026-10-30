import { Badge } from '@/components/common';
import { SEVERITY_STYLE, cn, titleCase } from '@/lib/utils';
import type { MedFlag, MedicationItem, Severity } from '@/types';

/** Normalises a drug name the same way the rules engine does, for matching. */
function key(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b\d+(\.\d+)?\s*(mg|mcg|g|ml|units?|iu)\b.*$/i, '')
    .replace(/\b(tablet|capsule|solution|inhaler|injection|patch|er|xr|sr)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The three-column comparison from the spec. Each row is one medicine, so the
 * eye tracks a drug straight across: what the patient took at home, what they
 * had as an inpatient, and what they go home with.
 */
export function MedComparison({
  preAdmission,
  inpatient,
  discharge,
  flags = [],
}: {
  preAdmission: MedicationItem[];
  inpatient: MedicationItem[];
  discharge: MedicationItem[];
  flags?: MedFlag[];
}) {
  const names = new Map<string, string>();
  for (const list of [preAdmission, inpatient, discharge]) {
    for (const med of list) names.set(key(med.drugName), med.drugName);
  }

  const find = (list: MedicationItem[], k: string) =>
    list.find((m) => key(m.drugName) === k) ?? null;

  const flagFor = (k: string): MedFlag | null =>
    flags.find(
      (f) =>
        key(f.drugA) === k || (f.drugB ? key(f.drugB) === k : false)
    ) ?? null;

  const rows = [...names.entries()].sort(([, a], [, b]) => a.localeCompare(b));

  if (!rows.length) {
    return <p className="text-sm text-muted">No medication lists have been recorded.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-[22%] border-b px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-faint">
              Medicine
            </th>
            {[
              ['Pre-admission', 'The patient’s own list'],
              ['Inpatient', 'Given on the ward'],
              ['Discharge', 'Going home with'],
            ].map(([label, hint]) => (
              <th
                key={label}
                className="w-[26%] border-b px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-faint"
              >
                {label}
                <span className="block text-[10px] font-normal normal-case tracking-normal opacity-80">
                  {hint}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, displayName]) => {
            const pre = find(preAdmission, k);
            const inp = find(inpatient, k);
            const dis = find(discharge, k);
            const flag = flagFor(k);

            return (
              <tr key={k} className="align-top">
                <td
                  className="border-b px-3 py-2.5"
                  style={{
                    background: flag ? SEVERITY_STYLE[flag.severity].bg : undefined,
                  }}
                >
                  <span className="font-medium">{displayName}</span>
                  {(pre ?? inp ?? dis)?.drugClass && (
                    <span className="mt-0.5 block text-[11px] text-faint">
                      {(pre ?? inp ?? dis)!.drugClass}
                    </span>
                  )}
                  {flag && (
                    <Badge
                      className="mt-1.5"
                      style={{
                        background: 'var(--color-surface)',
                        color: SEVERITY_STYLE[flag.severity].color,
                      }}
                    >
                      {titleCase(flag.type)}
                    </Badge>
                  )}
                </td>
                <MedCell med={pre} severity={flag && !dis ? flag.severity : null} />
                <MedCell med={inp} />
                <MedCell
                  med={dis}
                  severity={flag && dis ? flag.severity : null}
                  changed={Boolean(pre && dis && pre.dosage !== dis.dosage)}
                />
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="mt-3 text-xs text-faint">
        A shaded row means the reconciliation agent raised a finding on that medicine. An empty
        discharge cell means the medicine is not on the going-home list.
      </p>
    </div>
  );
}

function MedCell({
  med,
  severity,
  changed,
}: {
  med: MedicationItem | null;
  severity?: Severity | null;
  changed?: boolean;
}) {
  if (!med) {
    return (
      <td className="border-b px-3 py-2.5">
        <span className="text-xs italic text-faint">— not on this list</span>
      </td>
    );
  }

  return (
    <td
      className="border-b px-3 py-2.5"
      style={{ background: severity ? SEVERITY_STYLE[severity].bg : undefined }}
    >
      <span className={cn('block text-sm', changed && 'font-semibold')}>
        {med.dosage || '—'}
        {changed && (
          <span className="ml-1.5 text-[10px] font-medium uppercase tracking-wide text-faint">
            changed
          </span>
        )}
      </span>
      <span className="block text-xs text-muted">{med.frequency || 'frequency not recorded'}</span>
      {med.route && med.route !== 'oral' && (
        <span className="mt-0.5 inline-block rounded bg-[var(--color-surface-muted)] px-1.5 py-0.5 text-[10px] font-medium">
          {med.route}
        </span>
      )}
      {med.notes && <span className="mt-1 block text-[11px] italic text-faint">{med.notes}</span>}
    </td>
  );
}
