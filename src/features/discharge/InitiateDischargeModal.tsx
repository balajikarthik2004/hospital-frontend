import { useState } from 'react';
import { Button, EmptyState, ErrorState, LoadingPane, Modal } from '@/components/common';
import { api } from '@/lib/api';
import { useApi, useMutation } from '@/hooks/useApi';
import { toast } from '@/store/notificationStore';
import { cn, fmtDate, patientAge, patientName } from '@/lib/utils';
import type { Admission, DischargePackage, Patient } from '@/types';

export function InitiateDischargeModal({
  open,
  onClose,
  onCreated,
  admissionId,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (packageId: string) => void;
  /** When given, the modal confirms that one admission instead of offering a list. */
  admissionId?: string;
}) {
  const [selected, setSelected] = useState<string | null>(admissionId ?? null);

  const { data, loading } = useApi<{ admissions: Admission[] }>(
    open && !admissionId ? '/admissions/active' : null
  );
  const { data: packagesData } = useApi<{ dischargePackages: DischargePackage[] }>(
    open ? '/discharge?limit=200' : null
  );

  const withPackage = new Set(
    (packagesData?.dischargePackages ?? []).map((p) => String(p.admissionId?._id ?? p.admissionId))
  );

  const eligible = (data?.admissions ?? []).filter((a) => !withPackage.has(String(a._id)));

  const initiate = useMutation(async (id: string) => {
    const { data: res } = await api.post<{ dischargePackage: DischargePackage }>(
      '/discharge/initiate',
      { admissionId: id }
    );
    toast.success(
      'Discharge initiated',
      'The agents are preparing the package — progress streams in live.'
    );
    return res.dischargePackage;
  });

  const submit = async () => {
    if (!selected) return;
    const pkg = await initiate.mutate(selected);
    if (pkg) {
      onClose();
      onCreated(pkg._id);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Initiate discharge"
      subtitle="The orchestrator will run all five agents and produce a draft package for review"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={initiate.pending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={initiate.pending} disabled={!selected}>
            Run the agents
          </Button>
        </>
      }
    >
      {initiate.error && <ErrorState message={initiate.error} />}

      {admissionId ? (
        <p className="text-sm text-muted">
          This starts the agent pipeline for the current admission. Nothing is finalised — every
          section comes back as a draft that a clinician must review and sign.
        </p>
      ) : loading ? (
        <LoadingPane label="Loading active admissions" />
      ) : eligible.length === 0 ? (
        <EmptyState
          title="Every active admission already has a package"
          detail="Open the discharge queue to continue one that is in progress."
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            Choose the admission to prepare. Only active admissions without an existing package
            are listed.
          </p>
          <ul className="space-y-2">
            {eligible.map((admission) => {
              const patient = admission.patientId as Patient;
              const isSelected = selected === admission._id;
              return (
                <li key={admission._id}>
                  <button
                    type="button"
                    onClick={() => setSelected(admission._id)}
                    className={cn(
                      'w-full rounded-lg border p-3 text-left transition-colors',
                      isSelected
                        ? 'border-primary-600 bg-[var(--color-primary-50)]'
                        : 'hover:border-primary-600'
                    )}
                    style={{ borderColor: isSelected ? undefined : 'var(--color-border)' }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{patientName(patient)}</p>
                        <p className="truncate text-xs text-muted">
                          {admission.admittingDiagnosis}
                        </p>
                      </div>
                      <div className="shrink-0 text-right text-xs text-faint">
                        <div>{patient?.patientId}</div>
                        <div>{patient ? `${patientAge(patient)}y` : ''}</div>
                      </div>
                    </div>
                    <p className="mt-1.5 text-xs text-faint">
                      {admission.bed.ward} {admission.bed.roomNumber}-{admission.bed.bedNumber} ·
                      admitted {fmtDate(admission.admissionDate)}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Modal>
  );
}
