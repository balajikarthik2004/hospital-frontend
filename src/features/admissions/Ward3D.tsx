import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type MutableRefObject,
} from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { ContactShadows, Html, OrbitControls } from '@react-three/drei';
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  CanvasTexture,
  DoubleSide,
  MOUSE,
  PCFSoftShadowMap,
} from 'three';
import type { Group, Mesh, Texture } from 'three';
import { patientName } from '@/lib/utils';
import type { Bed, BedStatus, Patient } from '@/types';

/* ═══════════════════════════════════════════════════════════════════════════
   The live ward, seen from directly above.

   This is a *plan* view, not a dollhouse: the camera is orthographic, locked
   overhead, and can only be panned and zoomed. Nothing orbits. That is a
   deliberate trade — an orbiting camera makes a ward look impressive once and
   unreadable thereafter, because every re-orientation costs the viewer the
   mental map they had just built. A fixed overhead frame means room 102 is
   always in the same place, which is what a charge nurse glancing at a wall
   display actually needs.

   The geometry is generated rather than loaded: every bed, wall, monitor and
   person is built from primitives at run time. That keeps the view weightless
   (no model downloads, nothing to license, nothing to cache-bust), lets the
   colours track the app's own palette exactly, and means a ward of any shape
   can be drawn from the bed records alone.

   Because the camera looks straight down, the figures are proportioned for
   that one angle: what you read is the crown of the head, the shoulders, the
   role tab on each shoulder and the swing of the arms. Everything below chest
   height is detail you will never see, so it stays cheap.

   Units are metres. Walls are low so the rooms stay open from above.
   ═══════════════════════════════════════════════════════════════════════════ */

const ROOM_W = 4.4;
const ROOM_D = 3.3;
const CORRIDOR = 2.4;
const ROOM_GAP = 0.22;
const WALL_H = 1.05;
const WALL_T = 0.1;
const DOOR_W = 1.1;
const DOOR_MARGIN = 0.35;

const BED_W = 0.95;
const BED_L = 2.0;

/** Walking lane either side of the nurses' station, inside the corridor. */
const LANE = 0.92;

/** Height of the focus scrim. Anything taller than this stays lit. */
const SCRIM_Y = 1.1;

interface Palette {
  floor: string;
  roomFloor: string;
  corridor: string;
  wall: string;
  wallEdge: string;
  frame: string;
  linen: string;
  desk: string;
  chair: string;
  text: string;
  scrim: string;
  backdrop: string;
}

/* The ward is lit, so these are not the flat UI tokens — a pigment under a
   key light reads lighter and more saturated than the same hex in a badge.
   They are the app's warm neutrals shifted for that, which is also what
   stops the ward looking like a blue screensaver bolted onto a warm app. */
const LIGHT: Palette = {
  // Warm sheet vinyl, the flooring actually used on wards.
  floor: '#E4E0D7',
  roomFloor: '#F2EFE9',
  corridor: '#D6D0C5',
  // Walls sit just off white: pure white blows out under the key light and
  // the rooms lose their edges.
  wall: '#F7F5F1',
  wallEdge: '#B2ABA0',
  frame: '#8A8278',
  linen: '#FFFFFF',
  desk: '#EBE7E0',
  chair: '#C6BFB4',
  text: '#1D1B19',
  scrim: '#F4F2EE',
  backdrop: '#FAF9F7',
};

const DARK: Palette = {
  floor: '#1A1816',
  roomFloor: '#262321',
  corridor: '#141211',
  wall: '#2C2926',
  wallEdge: '#4A443D',
  frame: '#6B645B',
  linen: '#4A443D',
  desk: '#2C2926',
  chair: '#37322C',
  text: '#F7F6F3',
  scrim: '#100F0E',
  backdrop: '#100F0E',
};

const STATUS_COLOR: Record<BedStatus, string> = {
  available: '#3DA66B',
  occupied: '#4A74B0',
  reserved: '#C2901F',
  maintenance: '#8B8378',
};

const STATUS_LABEL: Record<BedStatus, string> = {
  available: 'Available',
  occupied: 'Occupied',
  reserved: 'Reserved',
  maintenance: 'Out of service',
};

/* ── The care team ───────────────────────────────────────────────────────
   Role colours are kept clear of the four bed-status colours so a person is
   never mistaken for a bed state at a glance. */

type Role = 'nurse' | 'doctor' | 'aide' | 'porter';

const ROLE: Record<Role, { label: string; color: string; top: string; bottom: string }> = {
  nurse: { label: 'Nurse', color: '#14B8A6', top: '#17A99C', bottom: '#0E7A72' },
  doctor: { label: 'Doctor', color: '#8B5CF6', top: '#F4F6FB', bottom: '#49546A' },
  aide: { label: 'Care assistant', color: '#EC4899', top: '#D94E91', bottom: '#8E2E60' },
  porter: { label: 'Porter', color: '#F97316', top: '#E0721C', bottom: '#49546A' },
};

const SKIN = ['#F1C9AB', '#DDA477', '#B9784C', '#8A5730', '#5F3A22', '#E7B493'];
const HAIR = ['#2A2017', '#13100C', '#5B3B23', '#8C6D47', '#A8732C', '#9AA3AE'];

type HairStyle = 'short' | 'bun' | 'tied' | 'cap';

interface Tone {
  skin: string;
  hair: string;
  style: HairStyle;
}

/** "Aisha Rahman" → "A. Rahman": a full name collides with the next bed. */
function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0][0]}. ${parts[parts.length - 1]}` : full;
}

/** Tracks the app's light/dark class so the scene repaints with the theme. */
function useIsDark() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const observer = new MutationObserver(() =>
      setDark(document.documentElement.classList.contains('dark'))
    );
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

/* ── Light pools ──────────────────────────────────────────────────────────
   Looking straight down, the thing that most says "this room is lit" is not
   the shading on the walls — it is the pool each ceiling fixture throws on
   the floor. Real lights would be the honest way to do that, but a ward is
   fifteen-odd rooms and fifteen shadow-casting lights is not a frame budget
   anyone should spend on a wall display.

   So the pools are painted: one radial-gradient texture, built once, drawn
   additively on a quad a few millimetres above the floor. From this camera
   it is indistinguishable from the real thing, and it costs one draw call
   per room. */
function makePoolTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  // Falls off fast at first and then lingers — a hard core with a soft skirt,
  // the way a recessed fixture actually lands on a floor. A plain linear
  // ramp reads as a sticker.
  g.addColorStop(0, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.40)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.10)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}

/** One ceiling fixture's pool on the floor. */
function LightPool({
  x,
  z,
  size,
  texture,
  opacity,
}: {
  x: number;
  z: number;
  size: number;
  texture: Texture;
  opacity: number;
}) {
  return (
    <mesh position={[x, 0.014, z]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        blending={AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

/* ═══ Layout ═══════════════════════════════════════════════════════════════ */

interface Placed {
  bed: Bed;
  x: number;
  z: number;
  /** PI for the lower row, whose beds face the other way. */
  rotation: number;
  roomNumber: string;
}

interface RoomBox {
  roomNumber: string;
  cx: number;
  /** Z of the outer wall and of the corridor-side wall. */
  zOuter: number;
  zInner: number;
  isTop: boolean;
}

interface Plan {
  boxes: RoomBox[];
  placed: Placed[];
  width: number;
  depth: number;
  deskW: number;
}

function layout(beds: Bed[]): Plan {
  const byRoom = new Map<string, Bed[]>();
  for (const bed of beds) {
    const list = byRoom.get(bed.roomNumber) ?? [];
    list.push(bed);
    byRoom.set(bed.roomNumber, list);
  }
  const rooms = [...byRoom.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([roomNumber, roomBeds]) => ({
      roomNumber,
      beds: [...roomBeds].sort((a, b) => a.bedNumber.localeCompare(b.bedNumber)),
    }));

  const cols = Math.max(1, Math.ceil(rooms.length / 2));
  const pitch = ROOM_W + ROOM_GAP;
  const width = cols * ROOM_W + (cols - 1) * ROOM_GAP;

  const boxes: RoomBox[] = [];
  const placed: Placed[] = [];

  rooms.forEach((room, i) => {
    const isTop = i < cols;
    const col = isTop ? i : i - cols;
    const cx = -width / 2 + ROOM_W / 2 + col * pitch;

    const zInner = isTop ? -CORRIDOR / 2 : CORRIDOR / 2;
    const zOuter = isTop ? zInner - ROOM_D : zInner + ROOM_D;
    boxes.push({ roomNumber: room.roomNumber, cx, zOuter, zInner, isTop });

    const n = room.beds.length;
    room.beds.forEach((bed, b) => {
      // Two beds sit either side of the room's centre line; one sits on it.
      const offset = n === 1 ? 0 : (b === 0 ? -1 : 1) * (ROOM_W / 4);
      // The head goes against the outer wall, so the rows mirror each other.
      const z = isTop ? zOuter + BED_L / 2 + 0.4 : zOuter - BED_L / 2 - 0.4;
      placed.push({
        bed,
        x: cx + offset,
        z,
        rotation: isTop ? 0 : Math.PI,
        roomNumber: room.roomNumber,
      });
    });
  });

  return {
    boxes,
    placed,
    width,
    depth: CORRIDOR + ROOM_D * 2,
    deskW: Math.min(5.2, Math.max(2.4, width * 0.3)),
  };
}

const doorX = (box: RoomBox) => box.cx + ROOM_W / 2 - DOOR_MARGIN - DOOR_W / 2;
const laneZ = (box: RoomBox) => (box.isTop ? -LANE : LANE);
const insideZ = (box: RoomBox) => box.zInner + (box.isTop ? -0.55 : 0.55);

/** The spot a carer stands on to work at a bed — head end, away from the monitor. */
function bedside(p: Placed) {
  const dir = p.rotation === 0 ? 1 : -1;
  return {
    x: p.x + dir * -(BED_W / 2 + 0.46),
    z: p.z + dir * -0.28,
    faceX: p.x,
    faceZ: p.z,
  };
}

/* ═══ Rounds ═══════════════════════════════════════════════════════════════
   Every member of the team walks a closed loop of waypoints built from the
   ward's own geometry, so the simulation re-plans itself whenever the bed
   list changes. Dwell times are what sell it: real ward work is mostly
   standing still at a bedside, punctuated by brisk walks. */

interface Waypoint {
  x: number;
  z: number;
  /** Seconds to stand here. Zero means walk straight through. */
  dwell: number;
  activity: string;
  faceX?: number;
  faceZ?: number;
}

interface StaffDef {
  id: string;
  name: string;
  role: Role;
  tone: Tone;
  speed: number;
  phase: number;
  route: Waypoint[];
  /** Rooms this person covers, for the roster panel. */
  covering: string[];
}

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const toneFor = (seed: string): Tone => {
  const h = hash(seed);
  const styles: HairStyle[] = ['short', 'bun', 'tied', 'short'];
  return {
    skin: SKIN[h % SKIN.length],
    hair: HAIR[(h >>> 4) % HAIR.length],
    style: styles[(h >>> 8) % styles.length],
  };
};

// The same nurses the staff directory lists, so the ward view and the
// user list are never telling two different stories about who is on.
const NURSE_NAMES = ['Meera Iyer', 'Kiran Rao', 'Pooja Desai', 'Sneha Menon', 'Simran Kaur'];
const NURSE_TASKS = [
  'Observations',
  'Medication round',
  'Repositioning',
  'IV and line check',
  'Comfort round',
];

function buildCareTeam(plan: Plan): StaffDef[] {
  const { boxes, placed, deskW } = plan;
  if (!boxes.length) return [];

  // Keep clear of the station's footprint when crossing the corridor.
  const stationHalf = deskW / 2 + 0.6;

  const bedsByRoom = new Map<string, Placed[]>();
  for (const p of placed) {
    const list = bedsByRoom.get(p.roomNumber) ?? [];
    list.push(p);
    bedsByRoom.set(p.roomNumber, list);
  }

  /** Two extra waypoints that walk around the station when swapping lanes. */
  const cross = (
    from: { x: number; z: number },
    to: { x: number; z: number },
    activity: string
  ): Waypoint[] => {
    if (from.z * to.z > 0) return [];
    const mid = (from.x + to.x) / 2;
    const x = Math.abs(mid) > stationHalf ? mid : (mid >= 0 ? 1 : -1) * stationHalf;
    return [
      { x, z: from.z, dwell: 0, activity },
      { x, z: to.z, dwell: 0, activity },
    ];
  };

  /** Walk in, work each bed in turn, walk out. */
  const visit = (
    box: RoomBox,
    beds: Placed[],
    task: (p: Placed, i: number) => { text: string; dwell: number },
    cur: { x: number; z: number }
  ): Waypoint[] => {
    const out: Waypoint[] = [];
    const lane = laneZ(box);
    const dx = doorX(box);
    const heading = `Walking to room ${box.roomNumber}`;

    out.push(...cross(cur, { x: dx, z: lane }, heading));
    out.push({ x: dx, z: lane, dwell: 0, activity: heading });
    out.push({ x: dx, z: insideZ(box), dwell: 0, activity: heading });

    beds.forEach((p, i) => {
      const spot = bedside(p);
      const { text, dwell } = task(p, i);
      out.push({ ...spot, dwell, activity: text });
    });

    out.push({ x: dx, z: insideZ(box), dwell: 0, activity: `Leaving room ${box.roomNumber}` });
    out.push({ x: dx, z: lane, dwell: 0, activity: `Leaving room ${box.roomNumber}` });
    return out;
  };

  /** Chain a sequence of room visits into one closed loop through the station. */
  const loop = (
    start: Waypoint,
    rooms: RoomBox[],
    task: (p: Placed, i: number, room: RoomBox) => { text: string; dwell: number } | null,
    returning: string
  ): Waypoint[] => {
    const route: Waypoint[] = [start];
    let cur = { x: start.x, z: start.z };
    const push = (w: Waypoint) => {
      route.push(w);
      cur = { x: w.x, z: w.z };
    };

    for (const box of rooms) {
      const beds = (bedsByRoom.get(box.roomNumber) ?? []).slice(0, 2);
      const jobs = beds
        .map((p, i) => ({ p, job: task(p, i, box) }))
        .filter((e): e is { p: Placed; job: { text: string; dwell: number } } => e.job !== null);
      if (!jobs.length) continue;
      for (const w of visit(box, jobs.map((j) => j.p), (_p, i) => jobs[i].job, cur)) push(w);
    }

    if (route.length === 1) return [];
    for (const w of cross(cur, { x: start.x, z: start.z }, returning)) push(w);
    return route;
  };

  const team: StaffDef[] = [];

  /* ── Nurses: each owns a handful of rooms and cycles them ─────────────── */
  const nurseCount = Math.max(2, Math.min(5, Math.ceil(boxes.length / 2)));
  for (let i = 0; i < nurseCount; i += 1) {
    const rooms = boxes.filter((_, r) => r % nurseCount === i);
    if (!rooms.length) continue;

    const stationX = ((i - (nurseCount - 1) / 2) / Math.max(1, nurseCount)) * deskW * 0.8;
    const stationZ = i % 2 === 0 ? -LANE : LANE;
    const start: Waypoint = {
      x: stationX,
      z: stationZ,
      dwell: 7 + (i % 3) * 1.5,
      activity: 'Charting at the station',
      faceX: stationX,
      faceZ: 0,
    };

    const route = loop(
      start,
      rooms,
      (p, b) => ({
        text: `${NURSE_TASKS[(i + b) % NURSE_TASKS.length]} · Bed ${p.roomNumber}-${p.bed.bedNumber}`,
        dwell: p.bed.status === 'occupied' ? 7 + ((hash(p.bed._id) % 5) as number) : 3.5,
      }),
      'Back to the station'
    );
    if (route.length < 2) continue;

    const name = NURSE_NAMES[i % NURSE_NAMES.length];
    team.push({
      id: `nurse-${i}`,
      name,
      role: 'nurse',
      tone: toneFor(`nurse${name}`),
      speed: 0.92,
      phase: i * 1.7,
      route,
      covering: rooms.map((r) => r.roomNumber),
    });
  }

  /* ── Doctor: a ward round over the occupied beds only ─────────────────── */
  const roundRooms = boxes.filter((b) =>
    (bedsByRoom.get(b.roomNumber) ?? []).some((p) => p.bed.status === 'occupied')
  );
  if (roundRooms.length) {
    const start: Waypoint = {
      x: -0.4,
      z: LANE,
      dwell: 8,
      activity: 'Reviewing notes at the station',
      faceX: -0.4,
      faceZ: 0,
    };
    const route = loop(
      start,
      roundRooms.slice(0, 5),
      (p) =>
        p.bed.status === 'occupied'
          ? {
              text: `Ward round · Bed ${p.roomNumber}-${p.bed.bedNumber}`,
              dwell: 11 + (hash(p.bed._id) % 6),
            }
          : null,
      'Back to the station'
    );
    if (route.length > 1) {
      team.push({
        id: 'doctor-0',
        name: 'Dr Ananya Sharma',
        role: 'doctor',
        tone: toneFor('doctorSharma'),
        speed: 0.82,
        phase: 0.6,
        route,
        covering: roundRooms.slice(0, 5).map((r) => r.roomNumber),
      });
    }
  }

  /* ── Care assistant: meals, linen, mobility ───────────────────────────── */
  const aideRooms = boxes.filter((_, i) => i % 2 === 1);
  if (aideRooms.length) {
    const start: Waypoint = {
      x: 1.5,
      z: -LANE,
      dwell: 6,
      activity: 'Restocking the trolley',
      faceX: 1.5,
      faceZ: 0,
    };
    const route = loop(
      start,
      aideRooms.slice(0, 4),
      (p, b) => ({
        text:
          p.bed.status === 'occupied'
            ? `${b % 2 === 0 ? 'Meal assistance' : 'Linen change'} · Bed ${p.roomNumber}-${p.bed.bedNumber}`
            : `Making up bed ${p.roomNumber}-${p.bed.bedNumber}`,
        dwell: 6 + (hash(p.bed._id) % 4),
      }),
      'Returning to the trolley'
    );
    if (route.length > 1) {
      team.push({
        id: 'aide-0',
        name: 'Asha Pawar',
        role: 'aide',
        tone: toneFor('aidePawar'),
        speed: 0.88,
        phase: 2.4,
        route,
        covering: aideRooms.slice(0, 4).map((r) => r.roomNumber),
      });
    }
  }

  /* ── Porter: out-of-service beds first, then terminal cleans ──────────── */
  const serviceRooms = boxes.filter((b) =>
    (bedsByRoom.get(b.roomNumber) ?? []).some(
      (p) => p.bed.status === 'maintenance' || p.bed.status === 'available'
    )
  );
  if (serviceRooms.length) {
    const start: Waypoint = {
      x: -2.0,
      z: -LANE,
      dwell: 9,
      activity: 'Waiting on a transfer request',
      faceX: -2.0,
      faceZ: 0,
    };
    const route = loop(
      start,
      serviceRooms.slice(0, 4),
      (p) =>
        p.bed.status === 'maintenance'
          ? { text: `Servicing bed ${p.roomNumber}-${p.bed.bedNumber}`, dwell: 13 }
          : p.bed.status === 'available'
            ? { text: `Terminal clean · Bed ${p.roomNumber}-${p.bed.bedNumber}`, dwell: 8 }
            : null,
      'Returning to the corridor'
    );
    if (route.length > 1) {
      team.push({
        id: 'porter-0',
        name: 'Ravi Shinde',
        role: 'porter',
        tone: toneFor('porterShinde'),
        speed: 1.0,
        phase: 3.9,
        route,
        covering: serviceRooms.slice(0, 4).map((r) => r.roomNumber),
      });
    }
  }

  return team;
}

/* ═══ Live activity ════════════════════════════════════════════════════════
   The figures move every frame, but their *activity* only changes every few
   seconds. Routing that through React state would re-render the whole canvas
   sixty times a second, so it goes through a tiny external store instead and
   only the roster panel subscribes. */

interface ActivityBus {
  set: (id: string, activity: string) => void;
  subscribe: (listener: () => void) => () => void;
  get: () => Record<string, string>;
}

function createActivityBus(): ActivityBus {
  let snapshot: Record<string, string> = {};
  const listeners = new Set<() => void>();
  return {
    set(id, activity) {
      if (snapshot[id] === activity) return;
      snapshot = { ...snapshot, [id]: activity };
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    get: () => snapshot,
  };
}

type Positions = MutableRefObject<Map<string, [number, number]>>;

/* ═══ People ═══════════════════════════════════════════════════════════════ */

interface Gait {
  /** 0 standing, 1 walking at full stride. Tracks real speed, so the feet
      never slide: the animation is driven by the motion, not beside it. */
  walk: number;
  /** Signed heading error in radians. Drives lean and where the head looks. */
  turn: number;
  phase: number;
}

/** Cadence in steps per second at full stride — a shade under walking pace. */
const CADENCE = 2.35;

/* ── Proportions ───────────────────────────────────────────────────────────
   A 1.72 m adult at roughly seven and a half heads. These are joint heights
   in metres measured from the floor, so the skeleton can be read and
   corrected without running it. The figure faces +Z. */

const HIP_Y = 0.95;
const KNEE_Y = 0.47;
const SHOULDER_Y = 1.42;
const ELBOW_Y = 1.11;
const HEAD_Y = 1.6;
const HIP_HALF = 0.105;
const SHOULDER_HALF = 0.195;

/**
 * An articulated figure: pelvis and chest counter-rotate, legs bend at the
 * knee, arms bend at the elbow, and the head leads the turn.
 *
 * Everything here is tuned for one camera angle — straight down. From above a
 * walk is legible almost entirely through three things: the shoulders
 * counter-rotating against the hips, the forearms sweeping past the body, and
 * the small sideways weight shift onto each stance leg. Those get the most
 * attention. The knees and ankles are correct mainly so the shadow is.
 */
function StandingFigure({ role, tone, gait }: { role: Role; tone: Tone; gait: Gait }) {
  const root = useRef<Group>(null);
  const pelvis = useRef<Group>(null);
  const chest = useRef<Group>(null);
  const head = useRef<Group>(null);
  const thighL = useRef<Group>(null);
  const thighR = useRef<Group>(null);
  const shinL = useRef<Group>(null);
  const shinR = useRef<Group>(null);
  const upperL = useRef<Group>(null);
  const upperR = useRef<Group>(null);
  const foreL = useRef<Group>(null);
  const foreR = useRef<Group>(null);

  const kit = ROLE[role];

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const w = gait.walk;
    const th = t * CADENCE * Math.PI + gait.phase;

    // ── Legs. Positive rotation.x swings a limb backwards, so a forward
    //    swing is negative. The knee only ever flexes one way.
    const legSwing = 0.56 * w;
    if (thighL.current) thighL.current.rotation.x = -Math.sin(th) * legSwing;
    if (thighR.current) thighR.current.rotation.x = -Math.sin(th + Math.PI) * legSwing;
    // The knee flexes through the swing phase and straightens just before the
    // foot lands. Without it the legs scissor like a pair of compasses.
    const flex = (phase: number) => Math.max(0, Math.sin(phase + 1.15)) * 1.15 * w;
    if (shinL.current) shinL.current.rotation.x = flex(th);
    if (shinR.current) shinR.current.rotation.x = flex(th + Math.PI);

    // ── Arms, opposed to the legs, the elbow carrying more bend on the
    //    forward swing. This is the clearest motion from overhead.
    const armSwing = 0.5 * w;
    const idle = Math.sin(t * 1.05 + gait.phase) * 0.05 * (1 - w);
    if (upperL.current) upperL.current.rotation.x = Math.sin(th) * armSwing + idle;
    if (upperR.current) upperR.current.rotation.x = Math.sin(th + Math.PI) * armSwing - idle;
    const elbow = (phase: number) => (0.25 + Math.max(0, -Math.sin(phase)) * 0.5) * w;
    if (foreL.current) foreL.current.rotation.x = -elbow(th);
    if (foreR.current) foreR.current.rotation.x = -elbow(th + Math.PI);

    // ── Pelvis and chest counter-rotate about the spine. Real walking is a
    //    twist, not a slide, and from overhead that twist is the illusion.
    const twist = 0.16 * w;
    if (pelvis.current) pelvis.current.rotation.y = Math.sin(th) * twist;
    if (chest.current) {
      chest.current.rotation.y = -Math.sin(th) * twist * 1.5;
      chest.current.rotation.z = -gait.turn * 0.1;
      chest.current.rotation.x = -0.035 * w;
    }

    // ── Weight shift and bob: the body rises twice per stride, over each
    //    stance leg, and sways laterally onto it.
    if (root.current) {
      root.current.position.y = (Math.abs(Math.sin(th)) - 0.5) * 0.022 * w;
      root.current.position.x = Math.sin(th) * 0.022 * w;
      root.current.rotation.z = Math.sin(th) * 0.02 * w;
    }

    // ── The head leads: people look into a corner before they walk round it.
    if (head.current) {
      const look = Math.max(-0.7, Math.min(0.7, gait.turn));
      head.current.rotation.y += (look - head.current.rotation.y) * 0.1;
      head.current.rotation.x = Math.sin(th * 2) * 0.012 * w;
    }
  });

  const skin = <meshStandardMaterial color={tone.skin} roughness={0.78} />;
  const cloth = <meshStandardMaterial color={kit.top} roughness={0.9} />;
  const trouser = <meshStandardMaterial color={kit.bottom} roughness={0.92} />;

  return (
    <group ref={root}>
      {/* ═══ Lower body ═══ */}
      <group ref={pelvis} position={[0, HIP_Y, 0]}>
        <mesh position={[0, -0.04, 0]} scale={[1.18, 1, 0.78]} castShadow>
          <capsuleGeometry args={[0.135, 0.1, 4, 12]} />
          {trouser}
        </mesh>

        {[
          { thigh: thighL, shin: shinL, x: -HIP_HALF },
          { thigh: thighR, shin: shinR, x: HIP_HALF },
        ].map(({ thigh, shin, x }) => (
          <group key={x} ref={thigh} position={[x, 0, 0]}>
            <mesh position={[0, -(HIP_Y - KNEE_Y) / 2, 0]} castShadow>
              <capsuleGeometry args={[0.083, HIP_Y - KNEE_Y - 0.17, 4, 10]} />
              {trouser}
            </mesh>
            <group ref={shin} position={[0, -(HIP_Y - KNEE_Y), 0]}>
              <mesh position={[0, -(KNEE_Y - 0.09) / 2, 0]} castShadow>
                <capsuleGeometry args={[0.068, KNEE_Y - 0.09 - 0.14, 4, 10]} />
                {trouser}
              </mesh>
              <mesh position={[0, -KNEE_Y + 0.12, 0.055]} castShadow>
                <boxGeometry args={[0.1, 0.065, 0.245]} />
                <meshStandardMaterial color="#F1F5F9" roughness={0.65} />
              </mesh>
            </group>
          </group>
        ))}
      </group>

      {/* ═══ Upper body ═══ */}
      <group ref={chest} position={[0, HIP_Y, 0]}>
        {/* Abdomen into chest, flattened front-to-back so the silhouette from
            above is an ellipse rather than a tube. */}
        <mesh position={[0, 0.14, 0]} scale={[1.16, 1, 0.74]} castShadow>
          <capsuleGeometry args={[0.135, 0.12, 4, 12]} />
          {cloth}
        </mesh>
        <mesh position={[0, 0.33, 0]} scale={[1.3, 1, 0.72]} castShadow receiveShadow>
          <capsuleGeometry args={[0.155, 0.18, 5, 14]} />
          {cloth}
        </mesh>

        {/* Deltoids round off the shoulder line the camera actually sees */}
        {[-SHOULDER_HALF, SHOULDER_HALF].map((x) => (
          <mesh
            key={x}
            position={[x, SHOULDER_Y - HIP_Y - 0.02, 0]}
            scale={[1, 0.9, 0.95]}
            castShadow
          >
            <sphereGeometry args={[0.082, 14, 12]} />
            {cloth}
          </mesh>
        ))}

        {/* Role tabs: the one marker guaranteed visible from directly above */}
        {[-SHOULDER_HALF, SHOULDER_HALF].map((x) => (
          <mesh key={'tab' + x} position={[x, SHOULDER_Y - HIP_Y + 0.045, 0]} castShadow>
            <boxGeometry args={[0.1, 0.028, 0.15]} />
            <meshStandardMaterial
              color={kit.color}
              roughness={0.45}
              emissive={kit.color}
              emissiveIntensity={0.3}
            />
          </mesh>
        ))}

        {/* Arms: upper arm from the shoulder, forearm from the elbow */}
        {[
          { upper: upperL, fore: foreL, x: -SHOULDER_HALF - 0.025 },
          { upper: upperR, fore: foreR, x: SHOULDER_HALF + 0.025 },
        ].map(({ upper, fore, x }) => (
          <group key={x} ref={upper} position={[x, SHOULDER_Y - HIP_Y, 0]}>
            <mesh position={[0, -(SHOULDER_Y - ELBOW_Y) / 2, 0]} castShadow>
              <capsuleGeometry args={[0.055, SHOULDER_Y - ELBOW_Y - 0.11, 4, 10]} />
              {cloth}
            </mesh>
            <group ref={fore} position={[0, -(SHOULDER_Y - ELBOW_Y), 0]}>
              <mesh position={[0, -0.12, 0]} castShadow>
                <capsuleGeometry args={[0.046, 0.15, 4, 10]} />
                {role === 'doctor' ? cloth : skin}
              </mesh>
              <mesh position={[0, -0.25, 0.01]} scale={[1, 1.1, 0.75]} castShadow>
                <sphereGeometry args={[0.048, 12, 10]} />
                {skin}
              </mesh>
            </group>
          </group>
        ))}

        <mesh position={[0, 0.52, -0.005]} rotation={[0.12, 0, 0]}>
          <cylinderGeometry args={[0.048, 0.056, 0.1, 10]} />
          {skin}
        </mesh>

        {/* ═══ Head ═══ */}
        <group ref={head} position={[0, HEAD_Y - HIP_Y, 0]}>
          {/* The cranium is an ellipsoid, longer front-to-back than wide. A
              plain sphere reads as a ball bearing from directly above. */}
          <mesh scale={[0.95, 1.08, 1.06]} castShadow>
            <sphereGeometry args={[0.0975, 20, 16]} />
            {skin}
          </mesh>
          <mesh position={[0, -0.055, 0.012]} scale={[0.82, 0.7, 0.92]} castShadow>
            <sphereGeometry args={[0.088, 16, 12]} />
            {skin}
          </mesh>
          {[-0.088, 0.088].map((x) => (
            <mesh key={x} position={[x, -0.004, -0.004]} scale={[0.4, 1, 0.7]}>
              <sphereGeometry args={[0.03, 8, 8]} />
              {skin}
            </mesh>
          ))}
          {/* Hair: the crown is the largest surface an overhead camera ever
              sees of a person, so it carries most of the individuality. */}
          <mesh position={[0, 0.006, -0.006]} scale={[1, 1.03, 1.07]} castShadow>
            <sphereGeometry args={[0.1015, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
            <meshStandardMaterial color={tone.hair} roughness={0.96} />
          </mesh>
          {tone.style === 'bun' && (
            <mesh position={[0, 0.03, -0.088]} scale={[1, 0.9, 0.9]} castShadow>
              <sphereGeometry args={[0.05, 14, 12]} />
              <meshStandardMaterial color={tone.hair} roughness={0.96} />
            </mesh>
          )}
          {tone.style === 'tied' && (
            <mesh position={[0, -0.05, -0.1]} rotation={[0.35, 0, 0]} castShadow>
              <capsuleGeometry args={[0.038, 0.16, 4, 10]} />
              <meshStandardMaterial color={tone.hair} roughness={0.96} />
            </mesh>
          )}
          {role === 'porter' && (
            <>
              <mesh position={[0, 0.072, 0]} castShadow>
                <cylinderGeometry args={[0.108, 0.112, 0.05, 18]} />
                <meshStandardMaterial color={kit.color} roughness={0.75} />
              </mesh>
              <mesh position={[0, 0.058, 0.115]} castShadow>
                <boxGeometry args={[0.185, 0.022, 0.105]} />
                <meshStandardMaterial color={kit.color} roughness={0.75} />
              </mesh>
            </>
          )}
        </group>

        {/* ═══ Role kit ═══ */}
        {role === 'doctor' && (
          <>
            {/* Open coat: two front panels rather than a barrel, so it hangs */}
            {[-1, 1].map((side) => (
              <mesh
                key={side}
                position={[side * 0.1, -0.07, 0.085]}
                rotation={[0, 0, side * 0.04]}
                castShadow
              >
                <boxGeometry args={[0.17, 0.42, 0.035]} />
                {cloth}
              </mesh>
            ))}
            <mesh position={[0, 0.47, 0.012]} rotation={[Math.PI / 2.1, 0, 0]}>
              <torusGeometry args={[0.1, 0.014, 8, 24, Math.PI * 1.45]} />
              <meshStandardMaterial color="#1E293B" roughness={0.35} metalness={0.35} />
            </mesh>
            <mesh position={[0.06, 0.28, 0.1]}>
              <cylinderGeometry args={[0.025, 0.025, 0.012, 12]} />
              <meshStandardMaterial color="#CBD5E1" metalness={0.7} roughness={0.25} />
            </mesh>
          </>
        )}
        {role === 'nurse' && (
          <>
            <mesh position={[0, 0.44, 0.07]} rotation={[0.3, 0, 0]}>
              <torusGeometry args={[0.095, 0.0075, 6, 20, Math.PI]} />
              <meshStandardMaterial color={kit.color} roughness={0.7} />
            </mesh>
            <mesh position={[0, 0.3, 0.115]} rotation={[0.12, 0, 0]} castShadow>
              <boxGeometry args={[0.07, 0.098, 0.01]} />
              <meshStandardMaterial color="#F8FAFC" roughness={0.55} />
            </mesh>
            <mesh position={[-0.085, 0.28, 0.108]}>
              <boxGeometry args={[0.075, 0.002, 0.06]} />
              <meshStandardMaterial color={kit.bottom} roughness={0.9} />
            </mesh>
          </>
        )}
        {role === 'porter' && (
          <mesh position={[0, 0.2, 0]} scale={[1.34, 1, 0.78]}>
            <cylinderGeometry args={[0.158, 0.158, 0.075, 18, 1, true]} />
            <meshStandardMaterial
              color="#FDE047"
              roughness={0.5}
              emissive="#FDE047"
              emissiveIntensity={0.28}
              side={DoubleSide}
            />
          </mesh>
        )}
        {role === 'aide' && (
          <mesh position={[0, 0.16, 0.108]} castShadow>
            <boxGeometry args={[0.28, 0.4, 0.016]} />
            <meshStandardMaterial color="#F8FAFC" roughness={0.92} />
          </mesh>
        )}
      </group>
    </group>
  );
}

/** Someone sitting beside a bed. Visitors are what make a ward look occupied. */
function SeatedFigure({ tone, shirt }: { tone: Tone; shirt: string }) {
  const body = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (body.current) {
      body.current.rotation.x = Math.sin(clock.elapsedTime * 0.7 + tone.skin.length) * 0.02;
    }
  });
  return (
    <group>
      {/* Thighs forward, shins down */}
      {[-0.095, 0.095].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.46, 0.14]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <capsuleGeometry args={[0.072, 0.22, 3, 8]} />
            <meshStandardMaterial color="#5A6B82" roughness={0.9} />
          </mesh>
          <mesh position={[x, 0.24, 0.27]} castShadow>
            <capsuleGeometry args={[0.065, 0.26, 3, 8]} />
            <meshStandardMaterial color="#5A6B82" roughness={0.9} />
          </mesh>
        </group>
      ))}
      <group ref={body}>
        <mesh position={[0, 0.74, 0.03]} scale={[1.25, 1, 0.75]} castShadow>
          <capsuleGeometry args={[0.165, 0.2, 4, 12]} />
          <meshStandardMaterial color={shirt} roughness={0.9} />
        </mesh>
        <mesh position={[0, 1.0, 0.03]} scale={[1, 1.05, 1.08]} castShadow>
          <sphereGeometry args={[0.1, 14, 12]} />
          <meshStandardMaterial color={tone.skin} roughness={0.82} />
        </mesh>
        <mesh position={[0, 1.005, 0.026]} scale={[1, 0.96, 1.06]} castShadow>
          <sphereGeometry args={[0.108, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
          <meshStandardMaterial color={tone.hair} roughness={0.95} />
        </mesh>
      </group>
    </group>
  );
}

/* ═══ The walker ═══════════════════════════════════════════════════════════ */

/** Signed shortest angle from `from` to `to`, in (-PI, PI]. */
const angleTo = (from: number, to: number) => {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};

const shortestTurn = (from: number, to: number, rate: number) => {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return from + d * Math.min(1, rate);
};

function Staff({
  def,
  index,
  focus,
  selected,
  onSelect,
  bus,
  positions,
}: {
  def: StaffDef;
  index: number;
  focus: boolean;
  selected: boolean;
  onSelect: (id: string | null) => void;
  bus: ActivityBus;
  positions: Positions;
}) {
  const group = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const pulse = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const kit = ROLE[def.role];
  const gait = useRef<Gait>({ walk: 0, turn: 0, phase: def.phase }).current;

  const nav = useRef({
    i: 1 % def.route.length,
    x: def.route[0].x,
    z: def.route[0].z,
    yaw: 0,
    dwell: def.route[0].dwell,
    // Stagger the team so they do not all set off on the same frame.
    delay: def.phase * 0.9,
  });

  useEffect(() => {
    bus.set(def.id, def.route[0].activity);
    nav.current = {
      i: 1 % def.route.length,
      x: def.route[0].x,
      z: def.route[0].z,
      yaw: 0,
      dwell: def.route[0].dwell,
      delay: def.phase * 0.9,
    };
  }, [bus, def]);

  useFrame(({ clock }, delta) => {
    const g = group.current;
    if (!g) return;
    const s = nav.current;
    const step = Math.min(delta, 0.05);

    // How fast this person is actually travelling, this frame. The gait is
    // driven from it rather than from a boolean, which is what stops the feet
    // skating: stride rate and ground speed come from the same number.
    let speed = 0;

    if (s.delay > 0) {
      s.delay -= step;
    } else if (s.dwell > 0) {
      s.dwell -= step;
      const wp = def.route[(s.i - 1 + def.route.length) % def.route.length];
      if (wp.faceX !== undefined && wp.faceZ !== undefined) {
        const want = Math.atan2(wp.faceX - s.x, wp.faceZ - s.z);
        gait.turn = angleTo(s.yaw, want);
        s.yaw = shortestTurn(s.yaw, want, step * 3.5);
      } else {
        gait.turn *= 0.9;
      }
      if (s.dwell <= 0) {
        bus.set(def.id, def.route[s.i].activity);
      }
    } else {
      const wp = def.route[s.i];
      const dx = wp.x - s.x;
      const dz = wp.z - s.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.05) {
        s.x = wp.x;
        s.z = wp.z;
        if (wp.dwell > 0) {
          s.dwell = wp.dwell;
          s.i = (s.i + 1) % def.route.length;
        } else {
          s.i = (s.i + 1) % def.route.length;
          bus.set(def.id, def.route[s.i].activity);
        }
      } else {
        const want = Math.atan2(dx, dz);
        const err = angleTo(s.yaw, want);
        gait.turn = err;
        s.yaw = shortestTurn(s.yaw, want, step * 6);

        // Turn first, then walk. Nobody rounds a corner by sliding sideways
        // into it, and a figure that does is the single most obvious tell
        // that it is not a person.
        const aligned = Math.max(0, 1 - Math.abs(err) / 1.0);
        // Ease out over the last half metre so arrivals settle rather than
        // stop dead, and ease in off the mark after a turn.
        const approach = Math.min(1, dist / 0.55);
        speed = def.speed * aligned * (0.3 + 0.7 * approach);

        const travel = Math.min(dist, speed * step);
        s.x += (dx / dist) * travel;
        s.z += (dz / dist) * travel;
      }
    }

    // Smooth the stride towards the speed actually achieved.
    gait.walk += (speed / def.speed - gait.walk) * 0.12;

    g.position.set(s.x, 0, s.z);
    g.rotation.y = s.yaw;
    positions.current.set(def.id, [s.x, s.z]);

    // The halo pulses only while the person is standing and working, which is
    // exactly when you want your eye pulled to them.
    if (pulse.current) {
      const working = gait.walk < 0.25 ? 1 : 0;
      const t = (clock.elapsedTime * 0.55) % 1;
      const scale = 1 + t * 0.85;
      pulse.current.scale.setScalar(scale);
      const mat = pulse.current.material as { opacity: number };
      mat.opacity = working * (1 - t) * (selected ? 0.55 : 0.3);
    }
    if (ring.current) {
      const mat = ring.current.material as { opacity: number };
      const want = selected ? 0.95 : hovered ? 0.8 : focus ? 0.65 : 0.4;
      mat.opacity += (want - mat.opacity) * 0.15;
    }
  });

  const label = `${def.name} · ${kit.label}`;

  return (
    <group
      ref={group}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = '';
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onSelect(selected ? null : def.id);
      }}
    >
      {/* Widened in plan but barely in height. At the zoom that fits a whole
          ward on screen a real 44 cm shoulder span is about ten pixels, which
          is not a person — it is a speck. Stretching X and Z only buys back
          the legibility without making anyone look like a giant, because an
          overhead camera cannot read height anyway. */}
      <group scale={[1.4, 1.05, 1.4]}>
        <StandingFigure role={def.role} tone={def.tone} gait={gait} />
      </group>

      {/* Click target — the figure itself is too thin to hit reliably from
          this distance, so an invisible cylinder stands in for it. */}
      <mesh position={[0, 0.85, 0]} visible={false}>
        <cylinderGeometry args={[0.55, 0.55, 1.85, 8]} />
      </mesh>

      {/* Floor halo */}
      <mesh ref={ring} position={[0, 0.016, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.42, 0.6, 40]} />
        <meshBasicMaterial color={kit.color} transparent opacity={0.4} depthWrite={false} />
      </mesh>
      <mesh ref={pulse} position={[0, 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.58, 0.7, 40]} />
        <meshBasicMaterial color={kit.color} transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* In focus mode the halo is lifted above the scrim so it still reads
          when the ward beneath it is dimmed. */}
      {focus && (
        <mesh position={[0, SCRIM_Y + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.46, 0.64, 40]} />
          <meshBasicMaterial
            color={kit.color}
            transparent
            opacity={selected ? 0.85 : 0.55}
            depthWrite={false}
          />
        </mesh>
      )}

      {(hovered || selected || focus) && (
        <Html
          position={[0, 1.86 + (index % 3) * 0.34, 0]}
          center
          style={{ pointerEvents: 'none', userSelect: 'none' }}
          zIndexRange={[24, 10]}
        >
          <div
            style={{
              transform: 'translateY(-6px)',
              whiteSpace: 'nowrap',
              borderRadius: 999,
              border: `1px solid ${kit.color}`,
              background: 'color-mix(in srgb, var(--color-surface) 92%, transparent)',
              boxShadow: '0 6px 16px rgba(16,24,40,0.18)',
              padding: '3px 9px',
              fontSize: 11,
              fontWeight: 600,
              lineHeight: 1.35,
              color: 'var(--color-text)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: kit.color,
                flex: 'none',
              }}
            />
            {hovered || selected ? label : def.name}
          </div>
        </Html>
      )}
    </group>
  );
}

/* ═══ Fixtures ═════════════════════════════════════════════════════════════ */

function Chair({ palette }: { palette: Palette }) {
  return (
    <group>
      <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.46, 0.06, 0.44]} />
        <meshStandardMaterial color={palette.chair} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.66, -0.2]} castShadow>
        <boxGeometry args={[0.46, 0.4, 0.06]} />
        <meshStandardMaterial color={palette.chair} roughness={0.85} />
      </mesh>
      {[
        [-0.19, -0.17],
        [0.19, -0.17],
        [-0.19, 0.17],
        [0.19, 0.17],
      ].map(([x, z]) => (
        <mesh key={`${x}:${z}`} position={[x, 0.21, z]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, 0.42, 6]} />
          <meshStandardMaterial color={palette.frame} roughness={0.6} metalness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

function Room({ box, palette }: { box: RoomBox; palette: Palette }) {
  const { cx, zOuter, zInner, isTop } = box;
  const zMid = (zOuter + zInner) / 2;
  const leftLen = ROOM_W - DOOR_W - DOOR_MARGIN;

  const wall = (
    key: string,
    args: [number, number, number],
    position: [number, number, number]
  ) => (
    <group key={key}>
      <mesh position={position} castShadow receiveShadow>
        <boxGeometry args={args} />
        <meshStandardMaterial color={palette.wall} roughness={0.9} metalness={0} />
      </mesh>
      {/* Darker coping along the top edge — it is what makes the plan legible
          when you look straight down at the ward. */}
      <mesh position={[position[0], WALL_H + 0.015, position[2]]}>
        <boxGeometry args={[args[0] + 0.015, 0.03, args[2] + 0.015]} />
        <meshStandardMaterial color={palette.wallEdge} roughness={0.8} />
      </mesh>
    </group>
  );

  return (
    <group>
      <mesh position={[cx, 0.009, zMid]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM_W - WALL_T, ROOM_D - WALL_T]} />
        <meshStandardMaterial color={palette.roomFloor} roughness={1} />
      </mesh>

      {wall('outer', [ROOM_W, WALL_H, WALL_T], [cx, WALL_H / 2, zOuter])}
      {wall('left', [WALL_T, WALL_H, ROOM_D], [cx - ROOM_W / 2, WALL_H / 2, zMid])}
      {wall('right', [WALL_T, WALL_H, ROOM_D], [cx + ROOM_W / 2, WALL_H / 2, zMid])}
      {wall(
        'inner-a',
        [leftLen, WALL_H, WALL_T],
        [cx - ROOM_W / 2 + leftLen / 2, WALL_H / 2, zInner]
      )}
      {wall(
        'inner-b',
        [DOOR_MARGIN, WALL_H, WALL_T],
        [cx + ROOM_W / 2 - DOOR_MARGIN / 2, WALL_H / 2, zInner]
      )}

      {/* A door leaf standing open into the room */}
      <mesh
        position={[
          cx + ROOM_W / 2 - DOOR_MARGIN - DOOR_W + 0.03,
          WALL_H / 2,
          zInner + (isTop ? -DOOR_W / 2 : DOOR_W / 2),
        ]}
        castShadow
      >
        <boxGeometry args={[0.05, WALL_H * 0.95, DOOR_W]} />
        <meshStandardMaterial color={palette.wallEdge} roughness={0.8} />
      </mesh>

      <Html
        position={[cx - ROOM_W / 2 + 0.52, 0.02, zInner + (isTop ? -0.42 : 0.42)]}
        center
        style={{ pointerEvents: 'none', userSelect: 'none' }}
        zIndexRange={[6, 1]}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: palette.text,
            opacity: 0.45,
            whiteSpace: 'nowrap',
          }}
        >
          {box.roomNumber}
        </span>
      </Html>
    </group>
  );
}

function BedsideMonitor({
  x,
  z,
  on,
  color,
  palette,
}: {
  x: number;
  z: number;
  on: boolean;
  color: string;
  palette: Palette;
}) {
  const screen = useRef<Mesh>(null);

  // The screen pulses like a monitor that is actually tracking something.
  useFrame(({ clock }) => {
    if (!screen.current || !on) return;
    const mat = screen.current.material as { emissiveIntensity?: number };
    const t = clock.elapsedTime % 2.2;
    mat.emissiveIntensity = t > 1.85 ? 1.6 : 0.6;
  });

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.8, 8]} />
        <meshStandardMaterial color={palette.frame} metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.9, 0]} castShadow>
        <boxGeometry args={[0.3, 0.24, 0.14]} />
        <meshStandardMaterial color={palette.desk} roughness={0.6} />
      </mesh>
      {/* Angled up, because from overhead a vertical screen is an edge. */}
      <mesh ref={screen} position={[0, 1.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.26, 0.12]} />
        <meshStandardMaterial
          color={on ? color : palette.wallEdge}
          emissive={on ? color : '#000000'}
          emissiveIntensity={on ? 0.6 : 0}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/**
 * The bedside locker every bed on every ward has: a waist-high cabinet with
 * a drawer and a jug of water on top. Read from above it is a small bright
 * rectangle beside the bed, which is exactly the cue that stops a row of
 * beds looking like a furniture showroom.
 */
function BedsideCabinet({ x, z, palette }: { x: number; z: number; palette: Palette }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.42, 0.6, 0.42]} />
        <meshStandardMaterial color={palette.desk} roughness={0.62} metalness={0.06} />
      </mesh>
      {/* Top surface, a shade lighter so the edge catches from overhead */}
      <mesh position={[0, 0.605, 0]} castShadow>
        <boxGeometry args={[0.45, 0.02, 0.45]} />
        <meshStandardMaterial color={palette.linen} roughness={0.45} metalness={0.08} />
      </mesh>
      {/* Drawer pull */}
      <mesh position={[0, 0.42, 0.212]} castShadow>
        <boxGeometry args={[0.2, 0.02, 0.012]} />
        <meshStandardMaterial color={palette.frame} roughness={0.3} metalness={0.85} />
      </mesh>
      {/* Water jug */}
      <mesh position={[0.1, 0.68, -0.06]} castShadow>
        <cylinderGeometry args={[0.055, 0.048, 0.13, 12]} />
        <meshStandardMaterial
          color="#DCE8F0"
          roughness={0.18}
          metalness={0.02}
          transparent
          opacity={0.82}
        />
      </mesh>
    </group>
  );
}

function IVStand({ x, z, palette }: { x: number; z: number; palette: Palette }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.018, 0.018, 1.4, 6]} />
        <meshStandardMaterial color={palette.frame} metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.3, 0.07]} castShadow>
        <capsuleGeometry args={[0.045, 0.12, 3, 8]} />
        <meshStandardMaterial color="#CFE4F5" roughness={0.3} transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.1, 0.16, 12]} />
        <meshStandardMaterial color={palette.frame} roughness={0.5} />
      </mesh>
    </group>
  );
}

/* ═══ Beds ═════════════════════════════════════════════════════════════════ */

function BedModel({
  placed,
  palette,
  selected,
  focus,
  onSelect,
}: {
  placed: Placed;
  palette: Palette;
  selected: boolean;
  focus: boolean;
  onSelect: (bed: Bed) => void;
}) {
  const { bed, x, z, rotation } = placed;
  const [hovered, setHovered] = useState(false);
  const group = useRef<Group>(null);
  const chest = useRef<Mesh>(null);

  const color = STATUS_COLOR[bed.status];
  const patient =
    bed.currentPatientId && typeof bed.currentPatientId === 'object'
      ? (bed.currentPatientId as Patient)
      : null;
  const tone = useMemo(() => toneFor(bed._id), [bed._id]);
  const seed = useMemo(() => hash(bed._id), [bed._id]);
  const visitor = patient !== null && seed % 3 === 0;
  const lift = hovered || selected ? 0.09 : 0;

  useFrame(({ clock }) => {
    if (group.current) {
      // A free bed breathes very slightly, so spare capacity is what moves.
      const idle =
        bed.status === 'available' ? Math.sin(clock.elapsedTime * 1.4 + x) * 0.012 : 0;
      group.current.position.y += (lift + idle - group.current.position.y) * 0.15;
    }
    // And an occupied one breathes literally.
    if (chest.current) {
      const breath = 1 + Math.sin(clock.elapsedTime * 0.95 + seed) * 0.035;
      chest.current.scale.set(1, breath, 1);
    }
  });

  const enter = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  };
  const leave = () => {
    setHovered(false);
    document.body.style.cursor = '';
  };

  const bedLabel = `Bed ${bed.roomNumber}-${bed.bedNumber}`;

  return (
    <group
      ref={group}
      position={[x, 0, z]}
      rotation={[0, rotation, 0]}
      onPointerOver={enter}
      onPointerOut={leave}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onSelect(bed);
      }}
    >
      {/* Frame. A hospital bed is powder-coated steel, so it takes a
          specular hit off the key light; at metalness 0.15 it was reading as
          moulded plastic, which is most of why the ward looked like a toy. */}
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[BED_W, 0.22, BED_L]} />
        <meshStandardMaterial color={palette.frame} roughness={0.38} metalness={0.72} />
      </mesh>

      {/* Legs, on castors — polished chrome rather than painted. */}
      {[
        [-BED_W / 2 + 0.1, -BED_L / 2 + 0.12],
        [BED_W / 2 - 0.1, -BED_L / 2 + 0.12],
        [-BED_W / 2 + 0.1, BED_L / 2 - 0.12],
        [BED_W / 2 - 0.1, BED_L / 2 - 0.12],
      ].map(([lx, lz], i) => (
        <group key={i}>
          <mesh position={[lx, 0.12, lz]} castShadow>
            <cylinderGeometry args={[0.032, 0.032, 0.17, 10]} />
            <meshStandardMaterial color={palette.frame} roughness={0.26} metalness={0.9} />
          </mesh>
          <mesh position={[lx, 0.035, lz]} castShadow>
            <sphereGeometry args={[0.038, 10, 8]} />
            <meshStandardMaterial color="#2E2B28" roughness={0.75} metalness={0.2} />
          </mesh>
        </group>
      ))}

      {/* Mattress */}
      <mesh position={[0, 0.47, 0]} castShadow receiveShadow>
        <boxGeometry args={[BED_W - 0.06, 0.16, BED_L - 0.08]} />
        <meshStandardMaterial color={palette.linen} roughness={0.95} />
      </mesh>

      {/* Blanket over the lower two thirds, tinted by status */}
      <mesh position={[0, 0.57, 0.33]} castShadow>
        <boxGeometry args={[BED_W - 0.02, 0.08, BED_L * 0.62]} />
        <meshStandardMaterial
          color={color}
          roughness={0.85}
          transparent
          opacity={bed.status === 'maintenance' ? 0.35 : 0.82}
        />
      </mesh>

      {/* Pillow */}
      <mesh position={[0, 0.6, -BED_L / 2 + 0.33]} castShadow>
        <boxGeometry args={[0.56, 0.11, 0.3]} />
        <meshStandardMaterial color={palette.linen} roughness={1} />
      </mesh>

      {/* ── The patient ──────────────────────────────────────────────────
          From overhead the readable parts are the face, the hair on the
          pillow, the shoulders and the two arms resting on the blanket. */}
      {patient && (
        <group>
          <mesh ref={chest} position={[0, 0.62, 0.02]} scale={[1, 1, 1]} castShadow>
            <capsuleGeometry args={[0.145, 0.52, 4, 10]} />
            <meshStandardMaterial color={color} roughness={0.95} transparent opacity={0.72} />
          </mesh>
          {/* Shoulders above the blanket line */}
          <mesh position={[0, 0.63, -BED_L / 2 + 0.6]} scale={[1.45, 0.85, 1]} castShadow>
            <sphereGeometry args={[0.165, 14, 12]} />
            <meshStandardMaterial color={palette.linen} roughness={0.95} />
          </mesh>
          {/* Arms laid over the covers */}
          {[-0.27, 0.27].map((ax) => (
            <mesh
              key={ax}
              position={[ax, 0.655, -BED_L / 2 + 0.95]}
              rotation={[Math.PI / 2, 0, 0]}
              castShadow
            >
              <capsuleGeometry args={[0.05, 0.3, 3, 8]} />
              <meshStandardMaterial color={tone.skin} roughness={0.85} />
            </mesh>
          ))}
          {/* Head and hair on the pillow */}
          <mesh position={[0, 0.69, -BED_L / 2 + 0.34]} scale={[1, 1.02, 1.06]} castShadow>
            <sphereGeometry args={[0.102, 16, 14]} />
            <meshStandardMaterial color={tone.skin} roughness={0.82} />
          </mesh>
          <mesh
            position={[0, 0.685, -BED_L / 2 + 0.3]}
            scale={[1.1, 0.9, 1.1]}
            rotation={[-0.25, 0, 0]}
            castShadow
          >
            <sphereGeometry args={[0.112, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
            <meshStandardMaterial color={tone.hair} roughness={0.95} />
          </mesh>
        </group>
      )}

      {/* Headboard */}
      <mesh position={[0, 0.56, -BED_L / 2 - 0.02]} castShadow>
        <boxGeometry args={[BED_W, 0.52, 0.07]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.1} />
      </mesh>

      {/* Footboard */}
      <mesh position={[0, 0.48, BED_L / 2 + 0.02]} castShadow>
        <boxGeometry args={[BED_W, 0.34, 0.06]} />
        <meshStandardMaterial color={palette.frame} roughness={0.42} metalness={0.55} />
      </mesh>

      <BedsideCabinet x={BED_W / 2 + 0.34} z={0.5} palette={palette} />

      {/* The over-bed table, parked across the lower half the way they are
          left between meals. Two of the most recognisable objects on a ward
          from above are this and the cabinet, and neither was here. */}
      {patient && (
        <group position={[0, 0, BED_L / 2 - 0.42]}>
          <mesh position={[0, 0.79, 0]} castShadow receiveShadow>
            <boxGeometry args={[BED_W + 0.16, 0.035, 0.42]} />
            <meshStandardMaterial color="#C9B99C" roughness={0.55} metalness={0.05} />
          </mesh>
          <mesh position={[BED_W / 2 + 0.3, 0.4, 0]} castShadow>
            <cylinderGeometry args={[0.028, 0.028, 0.78, 8]} />
            <meshStandardMaterial color={palette.frame} roughness={0.26} metalness={0.9} />
          </mesh>
          <mesh position={[BED_W / 2 + 0.3, 0.02, 0]} castShadow>
            <boxGeometry args={[0.34, 0.03, 0.3]} />
            <meshStandardMaterial color={palette.frame} roughness={0.35} metalness={0.8} />
          </mesh>
        </group>
      )}

      <BedsideMonitor
        x={BED_W / 2 + 0.3}
        z={-BED_L / 2 + 0.1}
        on={bed.status === 'occupied'}
        color={color}
        palette={palette}
      />

      {patient && (bed.type === 'icu' || seed % 2 === 0) && (
        <IVStand x={BED_W / 2 + 0.3} z={-BED_L / 2 + 0.62} palette={palette} />
      )}

      {/* A visitor's chair, and sometimes someone in it */}
      {patient && (
        <group position={[-(BED_W / 2 + 0.52), 0, 0.42]} rotation={[0, Math.PI / 2, 0]}>
          <Chair palette={palette} />
          {visitor && (
            <group position={[0, 0, -0.06]}>
              <SeatedFigure tone={toneFor(`${bed._id}v`)} shirt="#7C8DA6" />
            </group>
          )}
        </group>
      )}

      {/* Status ring on the floor */}
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[BED_W * 0.78, BED_W * 0.92, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={selected ? 0.9 : hovered ? 0.6 : 0.28}
          depthWrite={false}
        />
      </mesh>

      {/* In people mode the patient gets a marker above the scrim too — the
          point of the mode is everyone in the ward, not just the staff. */}
      {focus && patient && (
        <group position={[0, SCRIM_Y + 0.02, -BED_L / 2 + 0.34]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.2, 24]} />
            <meshBasicMaterial color={color} transparent opacity={0.3} depthWrite={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
            <ringGeometry args={[0.2, 0.26, 28]} />
            <meshBasicMaterial color={color} transparent opacity={0.75} depthWrite={false} />
          </mesh>
          <Html center position={[0, 0.06, 0]} style={{ pointerEvents: 'none' }} zIndexRange={[22, 8]}>
            <div
              style={{
                whiteSpace: 'nowrap',
                borderRadius: 999,
                border: `1px solid ${color}`,
                background: 'color-mix(in srgb, var(--color-surface) 92%, transparent)',
                padding: '2px 8px',
                fontSize: 10.5,
                fontWeight: 600,
                color: 'var(--color-text)',
                transform: 'translateY(-16px)',
              }}
            >
              {shortName(patientName(patient))}
            </div>
          </Html>
        </group>
      )}

      {(hovered || selected) && (
        <Html
          position={[0, 1.4, 0]}
          center
          style={{ pointerEvents: 'none' }}
          zIndexRange={[30, 12]}
        >
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 10,
              boxShadow: '0 8px 20px rgba(16,24,40,0.2)',
              padding: '7px 11px',
              whiteSpace: 'nowrap',
              fontSize: 12.5,
              transform: `rotate(${-rotation}rad)`,
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>
              {patient ? patientName(patient) : bedLabel}
            </div>
            <div style={{ color, fontSize: 11, fontWeight: 600, marginTop: 1 }}>
              {STATUS_LABEL[bed.status]}
              {patient ? ` · ${bed.roomNumber}-${bed.bedNumber}` : ''}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

function NursesStation({ palette, deskW }: { palette: Palette; deskW: number }) {
  return (
    <group>
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[deskW, 0.9, 1.1]} />
        <meshStandardMaterial color={palette.desk} roughness={0.75} />
      </mesh>
      {/* Counter lip */}
      <mesh position={[0, 0.93, 0]} castShadow>
        <boxGeometry args={[deskW + 0.16, 0.07, 1.26]} />
        <meshStandardMaterial color={palette.wallEdge} roughness={0.5} metalness={0.2} />
      </mesh>
      {/* Two screens, laid back so they catch the overhead camera */}
      {[-deskW / 4, deskW / 4].map((sx, i) => (
        <group key={i} position={[sx, 1.02, -0.1]} rotation={[-Math.PI / 2.6, 0, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.42, 0.28, 0.03]} />
            <meshStandardMaterial color="#1E293B" roughness={0.4} />
          </mesh>
          <mesh position={[0, 0, 0.02]}>
            <planeGeometry args={[0.37, 0.23]} />
            <meshStandardMaterial
              color="#1E90A0"
              emissive="#1E90A0"
              emissiveIntensity={0.55}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
      <Html
        position={[0, 0.98, 0]}
        center
        style={{ pointerEvents: 'none', userSelect: 'none' }}
        zIndexRange={[6, 1]}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.14em',
            color: palette.text,
            opacity: 0.4,
            whiteSpace: 'nowrap',
          }}
        >
          NURSES&rsquo; STATION
        </span>
      </Html>
    </group>
  );
}

/* ═══ Camera ═══════════════════════════════════════════════════════════════ */

interface ViewApi {
  fit: () => void;
  zoomBy: (factor: number) => void;
  centerOn: (x: number, z: number) => void;
}

/**
 * Frames the whole ward in an orthographic plan and hands the overlay buttons
 * a small API. The camera sits directly overhead; the 0.001 of Z is only
 * there to give the look-at a stable up vector.
 */
function PlanCamera({
  plan,
  gutter,
  apiRef,
  controlsRef,
}: {
  plan: Plan;
  /** Pixels on the right covered by the roster, excluded from the frame. */
  gutter: number;
  apiRef: MutableRefObject<ViewApi | null>;
  controlsRef: MutableRefObject<any>;
}) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const { width, depth } = plan;

  const fit = useCallback(() => {
    // Fit to the space the overlays leave free, not to the whole canvas, so
    // the ward never slides behind the roster or under the legend. The roster
    // itself only exists on wide canvases; below that there is no gutter.
    const g = size.width >= 1000 ? gutter : 0;
    const availW = Math.max(160, size.width - g - 48);
    const availH = Math.max(160, size.height - 188);
    const zoom = Math.max(6, Math.min(availW / width, availH / depth));
    // Screen centre sits half a gutter to the right of the free area's
    // centre, so the target shifts by that much to compensate.
    const targetX = g / (2 * zoom);

    camera.position.set(targetX, 42, 0.001);
    (camera as unknown as { zoom: number }).zoom = zoom;
    camera.updateProjectionMatrix();
    controlsRef.current?.target.set(targetX, 0, 0);
    controlsRef.current?.update();
  }, [camera, controlsRef, gutter, size.width, size.height, width, depth]);

  const zoomBy = useCallback(
    (factor: number) => {
      const c = camera as unknown as { zoom: number };
      c.zoom = Math.min(260, Math.max(10, c.zoom * factor));
      camera.updateProjectionMatrix();
    },
    [camera]
  );

  const centerOn = useCallback(
    (x: number, z: number) => {
      controlsRef.current?.target.set(x, 0, z);
      camera.position.set(x, 42, z + 0.001);
      controlsRef.current?.update();
    },
    [camera, controlsRef]
  );

  useEffect(() => {
    apiRef.current = { fit, zoomBy, centerOn };
  }, [apiRef, fit, zoomBy, centerOn]);

  // Re-frame when the ward changes shape or the canvas is resized.
  useEffect(() => {
    fit();
  }, [fit]);

  return null;
}

/* ═══ Scene ════════════════════════════════════════════════════════════════ */

function Scene({
  plan,
  team,
  palette,
  gutter,
  selectedId,
  focus,
  selectedStaff,
  onSelect,
  onSelectStaff,
  bus,
  positions,
  apiRef,
}: {
  plan: Plan;
  team: StaffDef[];
  palette: Palette;
  gutter: number;
  selectedId?: string | null;
  focus: boolean;
  selectedStaff: string | null;
  onSelect: (bed: Bed) => void;
  onSelectStaff: (id: string | null) => void;
  bus: ActivityBus;
  positions: Positions;
  apiRef: MutableRefObject<ViewApi | null>;
}) {
  const controlsRef = useRef<any>(null);
  const { boxes, placed, width, depth, deskW } = plan;

  // One texture for every pool in the ward, disposed with the scene.
  const pool = useMemo(() => makePoolTexture(), []);
  useEffect(() => () => pool.dispose(), [pool]);

  // A run of fixtures down the middle of the corridor, roughly one every
  // three metres, centred so the ward does not end on a half-lit gap.
  const corridorPools = useMemo(() => {
    const spacing = 3.2;
    const count = Math.max(1, Math.round(width / spacing));
    const span = (count - 1) * spacing;
    return Array.from({ length: count }, (_, i) => -span / 2 + i * spacing);
  }, [width]);

  // The pools are additive, so on a dark ward they do the lighting almost
  // single-handedly and have to be stronger; on a light one the floor is
  // already bright and the same value would blow it out.
  const poolOpacity = palette.backdrop === DARK.backdrop ? 0.5 : 0.3;

  return (
    <>
      {/* Deliberately under-lit ambient: the shading is what gives the model
          its depth, and a bright fill flattens every wall into the floor.
          Looking straight down, the key light is also the only thing that
          tells you anything has height at all — hence the long shadows. */}
      <ambientLight intensity={0.34} />
      {/* Cool overhead, warm bounce off the floor. Hospital fixtures are
          cold and the floor is warm vinyl, and carrying both temperatures
          is most of why a real ward photograph does not look monochrome. */}
      <hemisphereLight
        intensity={0.5}
        color="#EAF2FF"
        groundColor={palette.floor}
      />
      <directionalLight
        position={[width * 0.3, 15, depth * 0.85]}
        intensity={1.7}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-width * 0.7}
        shadow-camera-right={width * 0.7}
        shadow-camera-top={depth * 0.9}
        shadow-camera-bottom={-depth * 0.9}
        shadow-camera-far={48}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
        shadow-radius={3}
      />
      {/* A dim fill from the opposite corner so the shadow side of a figure
          is dark rather than black. One key light alone makes every person
          read as a cut-out. */}
      <directionalLight
        position={[-width * 0.4, 9, -depth * 0.6]}
        intensity={0.34}
        color="#CFE0F5"
      />

      {/* Floor and corridor runner */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width + 3, depth + 2.4]} />
        {/* Sheet vinyl is sealed, not matte: dropping roughness off 1.0 lets
            it catch the key light the way a mopped floor does. */}
        <meshStandardMaterial color={palette.floor} roughness={0.72} metalness={0.04} />
      </mesh>
      <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width + 3, CORRIDOR]} />
        <meshStandardMaterial color={palette.corridor} roughness={0.62} metalness={0.04} />
      </mesh>

      {/* Ceiling fixtures: one pool per room, and a run down the corridor. */}
      {boxes.map((box) => (
        <LightPool
          key={`pool-${box.isTop ? 't' : 'b'}-${box.roomNumber}`}
          x={box.cx}
          z={(box.zOuter + box.zInner) / 2}
          size={ROOM_W * 1.15}
          texture={pool}
          opacity={poolOpacity}
        />
      ))}
      {corridorPools.map((x) => (
        <LightPool
          key={`pool-c-${x}`}
          x={x}
          z={0}
          size={CORRIDOR * 1.5}
          texture={pool}
          opacity={poolOpacity * 0.8}
        />
      ))}

      {boxes.map((box) => (
        <Room key={`${box.isTop ? 't' : 'b'}-${box.roomNumber}`} box={box} palette={palette} />
      ))}

      <NursesStation palette={palette} deskW={deskW} />

      {placed.map((p) => (
        <BedModel
          key={p.bed._id}
          placed={p}
          palette={palette}
          selected={selectedId === p.bed._id}
          focus={focus}
          onSelect={onSelect}
        />
      ))}

      <ContactShadows
        position={[0, 0.004, 0]}
        scale={Math.max(width, depth) * 1.35}
        opacity={0.32}
        blur={2.4}
        far={4}
      />

      {/* People mode: a veil at chest height. Because it writes no depth but
          still tests it, everything shorter than SCRIM_Y is dimmed and every
          head and shoulder punches straight through. */}
      {focus && (
        <mesh
          position={[0, SCRIM_Y, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={() => null}
          renderOrder={1}
        >
          <planeGeometry args={[width + 8, depth + 8]} />
          <meshBasicMaterial
            color={palette.scrim}
            transparent
            opacity={0.74}
            depthWrite={false}
          />
        </mesh>
      )}

      {team.map((def, i) => (
        <Staff
          key={def.id}
          def={def}
          index={i}
          focus={focus}
          selected={selectedStaff === def.id}
          onSelect={onSelectStaff}
          bus={bus}
          positions={positions}
        />
      ))}

      <PlanCamera plan={plan} gutter={gutter} apiRef={apiRef} controlsRef={controlsRef} />

      {/* Pan and zoom only. The view never rotates — see the note at the top
          of this file. */}
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableRotate={false}
        enablePan
        enableZoom
        screenSpacePanning
        zoomSpeed={0.9}
        panSpeed={0.9}
        minZoom={10}
        maxZoom={260}
        mouseButtons={{ LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }}
      />
    </>
  );
}

/* ═══ View ═════════════════════════════════════════════════════════════════ */

export default function Ward3DView({
  ward,
  beds,
  selectedId,
  onSelect,
}: {
  ward: string;
  beds: Bed[];
  selectedId?: string | null;
  onSelect: (bed: Bed) => void;
}) {
  const dark = useIsDark();
  const palette = dark ? DARK : LIGHT;

  const plan = useMemo(() => layout(beds), [beds]);
  const team = useMemo(() => buildCareTeam(plan), [plan]);

  const bus = useMemo(() => createActivityBus(), []);
  const positions = useRef(new Map<string, [number, number]>());
  const apiRef = useRef<ViewApi | null>(null);

  const [focus, setFocus] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const [rosterOpen, setRosterOpen] = useState(true);

  const activities = useSyncExternalStore(bus.subscribe, bus.get, bus.get);
  const gutter = rosterOpen && team.length > 0 ? 252 : 0;

  const free = beds.filter((b) => b.status === 'available').length;
  const occupied = beds.filter((b) => b.status === 'occupied').length;
  const patients = beds.filter(
    (b) => b.currentPatientId && typeof b.currentPatientId === 'object'
  ).length;

  // Release the pointer cursor if the view unmounts mid-hover.
  useEffect(() => () => void (document.body.style.cursor = ''), []);

  const locate = useCallback((id: string) => {
    const at = positions.current.get(id);
    if (at) apiRef.current?.centerOn(at[0], at[1]);
  }, []);

  return (
    <div
      className="relative overflow-hidden rounded-xl border"
      style={{
        borderColor: 'var(--color-border)',
        background: palette.backdrop,
        height: 640,
      }}
    >
      <Canvas
        orthographic
        // Soft shadows rather than hard-edged ones. From directly overhead
        // the shadow *is* the depth cue, and a stair-stepped edge is the
        // single thing that most makes a generated scene look generated.
        shadows={{ type: PCFSoftShadowMap }}
        dpr={[1, 2]}
        camera={{ position: [0, 42, 0.001], zoom: 40, near: 0.1, far: 120 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          // Filmic response instead of a linear clip. Linen and the lit
          // floor are the brightest things here and they were clipping to
          // flat white, which is why they read as paper rather than fabric.
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
      >
        <Scene
          plan={plan}
          team={team}
          palette={palette}
          gutter={gutter}
          selectedId={selectedId}
          focus={focus}
          selectedStaff={selectedStaff}
          onSelect={onSelect}
          onSelectStaff={setSelectedStaff}
          bus={bus}
          positions={positions}
          apiRef={apiRef}
        />
      </Canvas>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3.5">
        <div
          className="rounded-lg border px-3 py-2 backdrop-blur"
          style={{
            background: 'color-mix(in srgb, var(--color-surface) 84%, transparent)',
            borderColor: 'var(--color-border)',
          }}
        >
          <p
            className="text-[0.625rem] font-semibold uppercase tracking-[0.12em]"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            Live plan view
          </p>
          <p
            className="mt-0.5 text-[0.8125rem] font-semibold"
            style={{ color: 'var(--color-text)' }}
          >
            {ward}
          </p>
          <p className="mt-0.5 text-[0.6875rem]" style={{ color: 'var(--color-text-secondary)' }}>
            {beds.length} beds · {occupied} occupied · {free} free · {team.length} staff on shift
          </p>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFocus((f) => !f)}
            className="rounded-lg border px-2.5 py-1.5 text-[0.6875rem] font-semibold backdrop-blur transition-colors"
            style={{
              background: focus
                ? 'var(--color-primary, #14B8A6)'
                : 'color-mix(in srgb, var(--color-surface) 84%, transparent)',
              borderColor: focus ? 'transparent' : 'var(--color-border)',
              color: focus ? '#fff' : 'var(--color-text-secondary)',
            }}
            aria-pressed={focus}
            title="Dim the ward and highlight everyone in it"
          >
            {focus ? 'People mode: on' : 'Highlight people'}
          </button>

          <div
            className="flex overflow-hidden rounded-lg border backdrop-blur"
            style={{
              background: 'color-mix(in srgb, var(--color-surface) 84%, transparent)',
              borderColor: 'var(--color-border)',
            }}
          >
            {[
              { label: '−', title: 'Zoom out', run: () => apiRef.current?.zoomBy(1 / 1.25) },
              { label: '+', title: 'Zoom in', run: () => apiRef.current?.zoomBy(1.25) },
              { label: '⤢', title: 'Fit the ward', run: () => apiRef.current?.fit() },
            ].map((b) => (
              <button
                key={b.title}
                type="button"
                onClick={b.run}
                title={b.title}
                aria-label={b.title}
                className="px-2.5 py-1.5 text-[0.8125rem] leading-none transition-colors hover:bg-[var(--color-surface-sunken)]"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {b.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setRosterOpen((o) => !o)}
            className="hidden rounded-lg border px-2.5 py-1.5 text-[0.6875rem] font-semibold backdrop-blur transition-colors lg:block"
            style={{
              background: 'color-mix(in srgb, var(--color-surface) 84%, transparent)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-secondary)',
            }}
            aria-pressed={rosterOpen}
          >
            {rosterOpen ? 'Hide team' : 'Care team'}
          </button>
        </div>
      </div>

      {/* ── Care team roster ───────────────────────────────────────────── */}
      {rosterOpen && team.length > 0 && (
        <aside
          className="absolute right-3.5 top-[5.75rem] hidden w-[236px] flex-col overflow-hidden rounded-xl border backdrop-blur lg:flex"
          style={{
            background: 'color-mix(in srgb, var(--color-surface) 88%, transparent)',
            borderColor: 'var(--color-border)',
            maxHeight: 'calc(100% - 9.5rem)',
          }}
        >
          <div
            className="flex-none border-b px-3 py-2"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <p
              className="text-[0.625rem] font-semibold uppercase tracking-[0.12em]"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              On the floor now
            </p>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {team.map((member) => {
              const kit = ROLE[member.role];
              const active = selectedStaff === member.id;
              return (
                <li key={member.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStaff(active ? null : member.id);
                      if (!active) locate(member.id);
                    }}
                    className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors"
                    style={{
                      background: active
                        ? 'color-mix(in srgb, var(--color-surface-sunken) 90%, transparent)'
                        : 'transparent',
                    }}
                  >
                    <span
                      className="mt-1 h-2.5 w-2.5 flex-none rounded-full"
                      style={{ background: kit.color }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className="block truncate text-[0.75rem] font-semibold"
                        style={{ color: 'var(--color-text)' }}
                      >
                        {member.name}
                      </span>
                      <span
                        className="block text-[0.625rem] font-medium uppercase tracking-[0.08em]"
                        style={{ color: kit.color }}
                      >
                        {kit.label}
                      </span>
                      <span
                        className="mt-0.5 block text-[0.6875rem] leading-snug"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        {activities[member.id] ?? 'Coming on shift'}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p
            className="flex-none border-t px-3 py-2 text-[0.625rem]"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-tertiary)' }}
          >
            {patients} patient{patients === 1 ? '' : 's'} on the ward · click a name to follow
          </p>
        </aside>
      )}

      {/* ── Legend ─────────────────────────────────────────────────────── */}
      <div
        className="pointer-events-none absolute bottom-3.5 left-3.5 rounded-lg border px-3 py-2 backdrop-blur"
        style={{
          background: 'color-mix(in srgb, var(--color-surface) 84%, transparent)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {(Object.keys(STATUS_COLOR) as BedStatus[]).map((status) => (
            <span
              key={status}
              className="flex items-center gap-1.5 text-[0.6875rem] font-medium"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: STATUS_COLOR[status] }}
                aria-hidden
              />
              {STATUS_LABEL[status]}
            </span>
          ))}
        </div>
        <div
          className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 border-t pt-1.5"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {(Object.keys(ROLE) as Role[]).map((role) => (
            <span
              key={role}
              className="flex items-center gap-1.5 text-[0.6875rem] font-medium"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: ROLE[role].color }}
                aria-hidden
              />
              {ROLE[role].label}
            </span>
          ))}
        </div>
      </div>

      <span
        className="pointer-events-none absolute bottom-3.5 right-3.5 rounded-lg border px-2.5 py-1.5 text-[0.6875rem] backdrop-blur"
        style={{
          background: 'color-mix(in srgb, var(--color-surface) 84%, transparent)',
          borderColor: 'var(--color-border)',
          color: 'var(--color-text-tertiary)',
        }}
      >
        Drag to pan · scroll to zoom · click a bed or a person
      </span>
    </div>
  );
}
