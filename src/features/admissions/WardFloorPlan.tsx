import { useMemo } from 'react';
import { cn, patientName } from '@/lib/utils';
import type { Bed, BedStatus, Patient } from '@/types';

/* ═══════════════════════════════════════════════════════════════════════════
   An architectural plan of a ward.

   Rooms sit either side of a central corridor, the way a real inpatient unit
   is laid out. Beds have their heads against the outer wall and face the
   corridor, doors are drawn with the standard swing-arc symbol, and the
   nurses' station is an island in the middle of the corridor.

   All geometry is in SVG user units and the whole plan scales to its
   container, so it stays sharp at any size and prints cleanly.
   ═══════════════════════════════════════════════════════════════════════════ */

const ROOM_W = 176;
const ROOM_H = 132;
const GAP = 10;
const CORRIDOR_H = 88;
const PAD = 26;
const DOOR_W = 30;
const BED_H = 72;

export const BED_PALETTE: Record<
  BedStatus,
  { fill: string; stroke: string; ink: string; label: string }
> = {
  available: {
    fill: 'var(--color-success-light)',
    stroke: 'var(--color-success)',
    ink: 'var(--color-success)',
    label: 'Available',
  },
  occupied: {
    fill: 'var(--color-info-light)',
    stroke: 'var(--color-info)',
    ink: 'var(--color-info)',
    label: 'Occupied',
  },
  reserved: {
    fill: 'var(--color-warning-light)',
    stroke: 'var(--color-warning)',
    ink: 'var(--color-warning)',
    label: 'Reserved',
  },
  maintenance: {
    fill: 'var(--color-surface-sunken)',
    stroke: 'var(--color-text-tertiary)',
    ink: 'var(--color-text-tertiary)',
    label: 'Out of service',
  },
};

/** Equipment drawn beside the bed head, by bed type. */
const EQUIPMENT: Record<Bed['type'], string[]> = {
  icu: ['monitor', 'ventilator'],
  semi_private: ['monitor'],
  private: ['monitor'],
  general: [],
  pediatric: ['cot'],
};

interface Props {
  ward: string;
  beds: Bed[];
  selectedId?: string | null;
  onSelect: (bed: Bed) => void;
}

export function WardFloorPlan({ ward, beds, selectedId, onSelect }: Props) {
  const rooms = useMemo(() => {
    const byRoom = new Map<string, Bed[]>();
    for (const bed of beds) {
      const list = byRoom.get(bed.roomNumber) ?? [];
      list.push(bed);
      byRoom.set(bed.roomNumber, list);
    }
    return [...byRoom.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([roomNumber, roomBeds]) => ({
        roomNumber,
        beds: [...roomBeds].sort((a, b) => a.bedNumber.localeCompare(b.bedNumber)),
      }));
  }, [beds]);

  if (rooms.length === 0) return null;

  // Rooms run down both sides of the corridor, as many per side as fit evenly.
  const cols = Math.ceil(rooms.length / 2);
  const topRooms = rooms.slice(0, cols);
  const bottomRooms = rooms.slice(cols);

  const width = PAD * 2 + cols * ROOM_W + (cols - 1) * GAP;
  const height = PAD * 2 + ROOM_H * 2 + CORRIDOR_H;
  const corridorY = PAD + ROOM_H;
  const corridorMidY = corridorY + CORRIDOR_H / 2;

  let bedIndex = 0;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      style={{ maxHeight: 560 }}
      role="img"
      aria-label={`Floor plan of ${ward}: ${beds.length} beds across ${rooms.length} rooms`}
    >
      <defs>
        {/* Diagonal hatch marks a bed that is out of service, the way a plan
            marks an area under works. */}
        <pattern
          id="fp-hatch"
          width="7"
          height="7"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="7"
            stroke="var(--color-text-tertiary)"
            strokeWidth="1.6"
            opacity="0.45"
          />
        </pattern>

        {/* Corridor floor tiling. */}
        <pattern id="fp-floor" width="26" height="26" patternUnits="userSpaceOnUse">
          <rect width="26" height="26" fill="var(--color-surface-muted)" />
          <path
            d="M26 0V26M0 26H26"
            stroke="var(--color-border)"
            strokeWidth="1"
            opacity="0.55"
          />
        </pattern>

        <filter id="fp-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="0"
            dy="2"
            stdDeviation="2.5"
            floodColor="#101828"
            floodOpacity="0.1"
          />
        </filter>
      </defs>

      {/* ── Corridor ───────────────────────────────────────────────────── */}
      <rect
        x={PAD}
        y={corridorY}
        width={width - PAD * 2}
        height={CORRIDOR_H}
        fill="url(#fp-floor)"
      />
      <line
        x1={PAD}
        y1={corridorMidY}
        x2={width - PAD}
        y2={corridorMidY}
        stroke="var(--color-border-dark)"
        strokeWidth="1.5"
        strokeDasharray="12 10"
        opacity="0.5"
      />

      <NurseStation
        x={PAD + (width - PAD * 2) / 2 - 104}
        y={corridorY + 16}
        width={208}
        height={CORRIDOR_H - 32}
      />

      {/* Staff moving along the corridor — decoration, but it reads as a
          place rather than a diagram. */}
      <Walker y={corridorY + 20} distance={width - PAD * 2} duration={21} delay={0} />
      <Walker y={corridorY + CORRIDOR_H - 20} distance={width - PAD * 2} duration={27} delay={-9} />

      {/* ── Rooms ──────────────────────────────────────────────────────── */}
      {[topRooms, bottomRooms].map((row, rowIdx) =>
        row.map((room, i) => {
          const x = PAD + i * (ROOM_W + GAP);
          const y = rowIdx === 0 ? PAD : corridorY + CORRIDOR_H;
          const isTop = rowIdx === 0;
          const startIndex = bedIndex;
          bedIndex += room.beds.length;

          return (
            <Room
              key={`${rowIdx}-${room.roomNumber}`}
              x={x}
              y={y}
              isTop={isTop}
              roomNumber={room.roomNumber}
              beds={room.beds}
              startIndex={startIndex}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          );
        })
      )}

      {/* ── Wayfinding ─────────────────────────────────────────────────── */}
      <Lift x={width - PAD - 4} y={corridorMidY} />
      <text
        x={PAD + 2}
        y={corridorMidY - 26}
        className="fill-[var(--color-text-tertiary)]"
        style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em' }}
      >
        CORRIDOR
      </text>
    </svg>
  );
}

/* ───────────────────────────────────────────────────────────────────────── */

function Room({
  x,
  y,
  isTop,
  roomNumber,
  beds,
  startIndex,
  selectedId,
  onSelect,
}: {
  x: number;
  y: number;
  isTop: boolean;
  roomNumber: string;
  beds: Bed[];
  startIndex: number;
  selectedId?: string | null;
  onSelect: (bed: Bed) => void;
}) {
  // The door is always on the corridor side, tucked into the right-hand corner
  // so it never clashes with the beds.
  const doorX = x + ROOM_W - 46;
  const doorWallY = isTop ? y + ROOM_H : y;

  const bedW = beds.length === 1 ? 74 : 60;
  const bedGap = 16;
  const bedsWidth = beds.length * bedW + (beds.length - 1) * bedGap;
  const bedsX = x + (ROOM_W - bedsWidth) / 2;
  // Heads go against the outer wall, so the two rows mirror each other.
  const bedsY = isTop ? y + 28 : y + 36;

  const free = beds.filter((b) => b.status === 'available').length;
  const labelY = isTop ? y + 17 : y + ROOM_H - 10;
  const clipId = `fp-room-${isTop ? 't' : 'b'}-${roomNumber}`;

  return (
    <g className="fp-room" style={{ animationDelay: `${startIndex * 28}ms` }}>
      <rect
        x={x}
        y={y}
        width={ROOM_W}
        height={ROOM_H}
        rx={3}
        fill="var(--color-surface)"
        stroke="var(--color-border-dark)"
        strokeWidth={2.5}
      />

      {/* Punch the doorway out of the wall, then draw the swing arc. The whole
          door is clipped to the room so the leaf can only open inwards. */}
      <clipPath id={clipId}>
        <rect x={x} y={y} width={ROOM_W} height={ROOM_H} rx={3} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        <rect
          x={doorX}
          y={doorWallY - 3}
          width={DOOR_W}
          height={6}
          fill="var(--color-surface)"
        />
        <path
          d={
            isTop
              ? `M ${doorX} ${doorWallY - DOOR_W} A ${DOOR_W} ${DOOR_W} 0 0 1 ${doorX + DOOR_W} ${doorWallY}`
              : `M ${doorX} ${doorWallY + DOOR_W} A ${DOOR_W} ${DOOR_W} 0 0 0 ${doorX + DOOR_W} ${doorWallY}`
          }
          fill="none"
          stroke="var(--color-border-dark)"
          strokeWidth={1.1}
          strokeDasharray="3 2.5"
          opacity={0.65}
        />
        <line
          x1={doorX}
          y1={doorWallY}
          x2={doorX}
          y2={isTop ? doorWallY - DOOR_W : doorWallY + DOOR_W}
          stroke="var(--color-border-dark)"
          strokeWidth={2}
          opacity={0.9}
        />
      </g>

      {/* Labels sit on the wall opposite the door, so they never fall under
          the swing arc. */}
      <text
        x={x + 11}
        y={labelY}
        className="fill-[var(--color-text-secondary)]"
        style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em' }}
      >
        {roomNumber}
      </text>
      {free > 0 && (
        <text
          x={x + ROOM_W - 11}
          y={labelY}
          textAnchor="end"
          className="fill-[var(--color-success)]"
          style={{ fontSize: 9, fontWeight: 600 }}
        >
          {free} free
        </text>
      )}

      {beds.map((bed, i) => (
        <BedGlyph
          key={bed._id}
          bed={bed}
          x={bedsX + i * (bedW + bedGap)}
          y={bedsY}
          w={bedW}
          h={BED_H}
          flipped={!isTop}
          equipmentSide={beds.length > 1 && i === 0 ? 'left' : 'right'}
          index={startIndex + i}
          selected={selectedId === bed._id}
          onSelect={onSelect}
        />
      ))}
    </g>
  );
}

/* ───────────────────────────────────────────────────────────────────────── */

function BedGlyph({
  bed,
  x,
  y,
  w,
  h,
  flipped,
  equipmentSide,
  index,
  selected,
  onSelect,
}: {
  bed: Bed;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Bottom-row rooms mirror the bed so its head is against the outer wall. */
  flipped: boolean;
  /** Which outer margin the bedside kit stands in. */
  equipmentSide: 'left' | 'right';
  index: number;
  selected: boolean;
  onSelect: (bed: Bed) => void;
}) {
  const palette = BED_PALETTE[bed.status];
  const patient =
    bed.currentPatientId && typeof bed.currentPatientId === 'object'
      ? (bed.currentPatientId as Patient)
      : null;

  const cx = x + w / 2;
  const cy = y + h / 2;
  const headY = flipped ? y + h - 15 : y + 15;
  const bodyTransform = flipped ? `rotate(180 ${cx} ${cy})` : undefined;
  const equipment = EQUIPMENT[bed.type] ?? [];

  const title = patient
    ? `${patientName(patient)} — ${bed.roomNumber}-${bed.bedNumber}, ${palette.label.toLowerCase()}`
    : `${bed.roomNumber}-${bed.bedNumber} — ${palette.label.toLowerCase()}`;

  return (
    <g
      className={cn('fp-bed', selected && 'is-selected')}
      style={{ animationDelay: `${index * 32 + 120}ms` }}
      onClick={() => onSelect(bed)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(bed);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={title}
    >
      <title>{title}</title>

      {/* Generous invisible hit area — the glyph itself is small. */}
      <rect x={x - 5} y={y - 7} width={w + 10} height={h + 16} fill="transparent" />

      {bed.status === 'available' && (
        <rect
          className="fp-free-halo"
          x={x - 4}
          y={y - 4}
          width={w + 8}
          height={h + 8}
          rx={10}
          fill="var(--color-success)"
        />
      )}

      <g transform={bodyTransform}>
        {/* Headboard */}
        <rect
          x={x + 2}
          y={y - 5}
          width={w - 4}
          height={7}
          rx={3}
          fill={palette.stroke}
          opacity={0.75}
        />
        {/* Mattress */}
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={7}
          fill={palette.fill}
          stroke={palette.stroke}
          strokeWidth={1.6}
          filter="url(#fp-shadow)"
        />
        {/* Pillow */}
        <rect
          x={x + w * 0.17}
          y={y + 6}
          width={w * 0.66}
          height={13}
          rx={5}
          fill="var(--color-surface)"
          stroke={palette.stroke}
          strokeWidth={1}
          opacity={0.9}
        />
        {/* Blanket, with the turned-down fold a made bed has */}
        <path
          d={`M ${x + 1.5} ${y + h * 0.42} H ${x + w - 1.5} V ${y + h - 8} A 6 6 0 0 1 ${x + w - 7.5} ${y + h - 1.5} H ${x + 7.5} A 6 6 0 0 1 ${x + 1.5} ${y + h - 8} Z`}
          fill={palette.stroke}
          opacity={0.16}
        />
        <line
          x1={x + 1.5}
          y1={y + h * 0.42}
          x2={x + w - 1.5}
          y2={y + h * 0.42}
          stroke={palette.stroke}
          strokeWidth={1.2}
          opacity={0.5}
        />

        {bed.status === 'maintenance' && (
          <rect x={x} y={y} width={w} height={h} rx={7} fill="url(#fp-hatch)" />
        )}
      </g>

      {/* ── Overlays, never mirrored, so text stays upright ───────────── */}

      {patient ? (
        <>
          <circle cx={cx} cy={headY} r={9.5} fill={palette.stroke} />
          <text
            x={cx}
            y={headY + 3.2}
            textAnchor="middle"
            fill="#fff"
            style={{ fontSize: 8, fontWeight: 700 }}
          >
            {initialsOf(patient)}
          </text>
          <text
            x={cx}
            y={cy + (flipped ? -6 : 16)}
            textAnchor="middle"
            className="fill-[var(--color-text)]"
            style={{ fontSize: 8.5, fontWeight: 600 }}
          >
            {truncate(patient.demographics.lastName, 10)}
          </text>
        </>
      ) : (
        <text
          x={cx}
          y={cy + 3}
          textAnchor="middle"
          fill={palette.ink}
          style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: '0.03em' }}
        >
          {bed.status === 'maintenance' ? 'SERVICE' : palette.label.toUpperCase()}
        </text>
      )}

      {/* Bed designation, always bottom-left of the glyph */}
      <text
        x={x + 3}
        y={y + h - 4}
        className="fill-[var(--color-text-tertiary)]"
        style={{ fontSize: 7.5, fontWeight: 700 }}
      >
        {bed.bedNumber}
      </text>

      {/* Bedside equipment, on the head wall */}
      {equipment.map((kind, i) => (
        <Equipment
          key={kind}
          kind={kind}
          x={equipmentSide === 'left' ? x - 14 : x + w + 3}
          y={(flipped ? y + h - 16 : y + 4) + i * (flipped ? -16 : 16)}
          active={bed.status === 'occupied'}
          color={palette.stroke}
        />
      ))}
    </g>
  );
}

/** Monitor, ventilator or parent cot beside the bed. */
function Equipment({
  kind,
  x,
  y,
  active,
  color,
}: {
  kind: string;
  x: number;
  y: number;
  active: boolean;
  color: string;
}) {
  if (kind === 'cot') {
    return (
      <rect
        x={x}
        y={y}
        width={9}
        height={13}
        rx={2}
        fill="none"
        stroke="var(--color-text-tertiary)"
        strokeWidth={1.2}
        opacity={0.7}
      />
    );
  }

  return (
    <g opacity={active ? 1 : 0.4}>
      <rect
        x={x}
        y={y}
        width={11}
        height={12}
        rx={2}
        fill="var(--color-surface)"
        stroke={active ? color : 'var(--color-text-tertiary)'}
        strokeWidth={1.2}
      />
      {kind === 'monitor' ? (
        <>
          <path
            d={`M ${x + 1.5} ${y + 7} h 2 l 1.2 -3 l 1.6 5 l 1.4 -3.4 h 2.3`}
            fill="none"
            stroke={active ? color : 'var(--color-text-tertiary)'}
            strokeWidth={1.1}
            strokeLinejoin="round"
          />
          {active && (
            <circle className="fp-vitals" cx={x + 9} cy={y + 2.6} r={1.5} fill={color} />
          )}
        </>
      ) : (
        <>
          <circle
            cx={x + 5.5}
            cy={y + 6}
            r={3}
            fill="none"
            stroke={active ? color : 'var(--color-text-tertiary)'}
            strokeWidth={1.1}
          />
          <line
            x1={x + 5.5}
            y1={y + 6}
            x2={x + 5.5}
            y2={y + 3.4}
            stroke={active ? color : 'var(--color-text-tertiary)'}
            strokeWidth={1.1}
          />
        </>
      )}
    </g>
  );
}

function NurseStation({
  x,
  y,
  width,
  height,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={height / 2}
        fill="var(--color-surface)"
        stroke="var(--color-border-dark)"
        strokeWidth={2}
        filter="url(#fp-shadow)"
      />
      <rect
        x={x + 7}
        y={y + 6}
        width={width - 14}
        height={height - 12}
        rx={(height - 12) / 2}
        fill="var(--color-surface-muted)"
      />
      <text
        x={x + width / 2}
        y={y + height / 2 + 3.5}
        textAnchor="middle"
        className="fill-[var(--color-text-secondary)]"
        style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em' }}
      >
        NURSES' STATION
      </text>
      {/* Two staff at the desk */}
      <circle cx={x + 18} cy={y + height / 2} r={4.5} fill="var(--color-primary)" opacity={0.75} />
      <circle
        cx={x + width - 18}
        cy={y + height / 2}
        r={4.5}
        fill="var(--color-primary)"
        opacity={0.55}
      />
    </g>
  );
}

function Walker({
  y,
  distance,
  duration,
  delay,
}: {
  y: number;
  distance: number;
  duration: number;
  delay: number;
}) {
  return (
    <circle
      className="fp-walker"
      cx={PAD}
      cy={y}
      r={4}
      fill="var(--color-text-tertiary)"
      style={
        {
          '--walk-distance': `${distance}px`,
          '--walk-duration': `${duration}s`,
          '--walk-delay': `${delay}s`,
        } as React.CSSProperties
      }
    />
  );
}

function Lift({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect
        x={x - 22}
        y={y - 15}
        width={22}
        height={30}
        rx={3}
        fill="var(--color-surface)"
        stroke="var(--color-border-dark)"
        strokeWidth={1.8}
      />
      <path
        d={`M ${x - 15} ${y - 4} l 3.5 -5 l 3.5 5 Z M ${x - 15} ${y + 4} l 3.5 5 l 3.5 -5 Z`}
        fill="var(--color-text-tertiary)"
      />
      <text
        x={x - 11}
        y={y + 24}
        textAnchor="middle"
        className="fill-[var(--color-text-tertiary)]"
        style={{ fontSize: 7.5, fontWeight: 600, letterSpacing: '0.06em' }}
      >
        LIFTS
      </text>
    </g>
  );
}

/* ───────────────────────────────────────────────────────────────────────── */

const initialsOf = (p: Patient) =>
  `${p.demographics.firstName?.[0] ?? ''}${p.demographics.lastName?.[0] ?? ''}`.toUpperCase();

const truncate = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;
