import { useState } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  Modal,
  Select,
  Tabs,
  Textarea,
} from '@/components/common';
import { api } from '@/lib/api';
import { useMutation } from '@/hooks/useApi';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/notificationStore';
import { fmtDateTime, titleCase } from '@/lib/utils';
import type { Admission, ClinicalNote } from '@/types';

const NOTE_TYPES = ['progress', 'assessment', 'consultation', 'procedure', 'nursing'] as const;
type NoteType = (typeof NOTE_TYPES)[number];

const TYPE_TONE: Record<NoteType, 'primary' | 'info' | 'purple' | 'warning' | 'success'> = {
  progress: 'primary',
  assessment: 'info',
  consultation: 'purple',
  procedure: 'warning',
  nursing: 'success',
};

export function NotesTab({
  admission,
  onChanged,
}: {
  admission: Admission | null;
  onChanged: () => void;
}) {
  const [filter, setFilter] = useState<NoteType | 'all'>('all');
  const [composing, setComposing] = useState(false);
  const can = useAuthStore((s) => s.can);

  const notes = (admission?.clinicalNotes ?? []) as ClinicalNote[];
  const filtered = filter === 'all' ? notes : notes.filter((n) => n.type === filter);
  const sorted = [...filtered].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const counts = NOTE_TYPES.reduce(
    (acc, t) => ({ ...acc, [t]: notes.filter((n) => n.type === t).length }),
    {} as Record<string, number>
  );

  if (!admission) {
    return (
      <Card>
        <EmptyState
          title="No active admission"
          detail="Clinical notes are recorded against an admission."
        />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Clinical notes"
        subtitle={`${notes.length} note${notes.length === 1 ? '' : 's'} on ${admission.admissionId}`}
        action={
          can('notes:write') && (
            <Button size="sm" icon={<PlusIcon className="h-4 w-4" />} onClick={() => setComposing(true)}>
              Add note
            </Button>
          )
        }
      />

      <div className="mb-4">
        <Tabs
          tabs={[
            { key: 'all', label: 'All' },
            ...NOTE_TYPES.map((t) => ({ key: t, label: titleCase(t) })),
          ]}
          active={filter}
          onChange={(k) => setFilter(k as NoteType | 'all')}
          counts={{ all: notes.length, ...counts }}
        />
      </div>

      {sorted.length === 0 ? (
        <EmptyState title="No notes of this type" />
      ) : (
        <ol className="relative space-y-4 pl-6">
          <span
            className="absolute bottom-2 left-[7px] top-2 w-px"
            style={{ background: 'var(--color-border)' }}
            aria-hidden
          />
          {sorted.map((note) => (
            <li key={note._id} className="relative">
              <span
                className="absolute -left-6 top-1.5 h-3.5 w-3.5 rounded-full border-2"
                style={{
                  background: 'var(--color-surface)',
                  borderColor: 'var(--color-primary)',
                }}
                aria-hidden
              />
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge tone={TYPE_TONE[note.type as NoteType] ?? 'neutral'}>
                  {titleCase(note.type)}
                </Badge>
                <span className="text-xs font-medium">
                  {typeof note.author === 'object'
                    ? `${(note.author as any).firstName} ${(note.author as any).lastName}`
                    : 'Unknown author'}
                </span>
                <span className="text-xs text-faint">{fmtDateTime(note.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{note.content}</p>
            </li>
          ))}
        </ol>
      )}

      <AddNoteModal
        open={composing}
        onClose={() => setComposing(false)}
        admissionId={admission._id}
        onSaved={onChanged}
      />
    </Card>
  );
}

function AddNoteModal({
  open,
  onClose,
  admissionId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  admissionId: string;
  onSaved: () => void;
}) {
  const [type, setType] = useState<NoteType>('progress');
  const [content, setContent] = useState('');

  const submit = useMutation(async () => {
    await api.post(`/admissions/${admissionId}/notes`, { type, content });
    toast.success('Note added');
    setContent('');
    onClose();
    onSaved();
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a clinical note"
      subtitle="Notes feed the Clinical Summary Agent, so be specific"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submit.pending}>
            Cancel
          </Button>
          <Button
            loading={submit.pending}
            disabled={!content.trim()}
            onClick={() => void submit.mutate()}
          >
            Save note
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Note type" required>
          <Select value={type} onChange={(e) => setType(e.target.value as NoteType)}>
            {NOTE_TYPES.map((t) => (
              <option key={t} value={t}>
                {titleCase(t)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Content" required>
          <Textarea
            rows={8}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Observations, assessment and plan…"
          />
        </Field>
        {submit.error && <ErrorState message={submit.error} />}
      </div>
    </Modal>
  );
}
