import { mulberry32, randInt } from "./rng";
import {
  type DungeonEdge,
  type DungeonGenerationParams,
  type DungeonMapData,
  type DungeonPoint,
  type DungeonRoom,
} from "./schema";

// Algoritmo BSP per layout dungeon "costruito dall'uomo":
// 1. Si parte da una partizione che copre tutta la griglia.
// 2. Si splitta ricorsivamente in due sotto-partizioni (axis-aligned)
//    fino a raggiungere `roomCount` foglie o l'impossibilita' di
//    splittare (sotto-partizioni < minRoomSize + padding).
// 3. In ogni foglia si scava una stanza random entro [min,max].
// 4. Si connettono i fratelli risalendo l'albero: ogni nodo interno
//    crea un edge tra il rappresentante della sotto-foglia sinistra
//    e quello della destra. Risultato: albero (sempre connesso, niente
//    isolate).
// 5. Si assegnano i ruoli (entry/boss/treasure/trick) con euristiche
//    topologiche.

interface Partition {
  x: number;
  y: number;
  w: number;
  h: number;
  left?: Partition;
  right?: Partition;
  room?: DungeonRoom;
}

export function generateBspDungeon(params: DungeonGenerationParams): DungeonMapData {
  // Seed 0 e' valido ma mulberry32(0) e' degenere; bump silenzioso a 1.
  const rng = mulberry32(params.seed || 1);

  const root: Partition = {
    x: 0,
    y: 0,
    w: params.gridWidth,
    h: params.gridHeight,
  };

  const leaves: Partition[] = [root];
  // Padding 1 cella su ogni lato della stanza dentro la foglia BSP
  // -> ogni foglia deve essere almeno minRoomSize + 2 di lato.
  const minLeafSize = params.minRoomSize + 2;

  while (leaves.length < params.roomCount) {
    // Splitta sempre la foglia piu' grande tra quelle splittabili:
    // distribuisce le stanze in modo piu' uniforme rispetto a una scelta
    // random.
    const splittable = leaves
      .filter((leaf) => canSplit(leaf, minLeafSize))
      .sort((a, b) => b.w * b.h - a.w * a.h);
    const target = splittable[0];
    if (!target) break;
    const [a, b] = split(target, rng, minLeafSize);
    target.left = a;
    target.right = b;
    const idx = leaves.indexOf(target);
    leaves.splice(idx, 1, a, b);
  }

  const rooms: DungeonRoom[] = [];
  leaves.forEach((leaf, index) => {
    const room = carveRoom(leaf, rng, params, `room-${index}`);
    leaf.room = room;
    rooms.push(room);
  });

  const edges: DungeonEdge[] = [];
  let edgeCounter = 0;
  connectPartition(root, rng, edges, () => `edge-${edgeCounter++}`);

  assignRoomKinds(rooms, edges);

  return {
    version: 1,
    algorithm: "bsp",
    params,
    rooms,
    edges,
    grid: { width: params.gridWidth, height: params.gridHeight },
  };
}

function canSplit(p: Partition, minLeafSize: number): boolean {
  return p.w >= minLeafSize * 2 || p.h >= minLeafSize * 2;
}

function split(
  p: Partition,
  rng: () => number,
  minLeafSize: number,
): [Partition, Partition] {
  const canSplitHorizontal = p.h >= minLeafSize * 2;
  const canSplitVertical = p.w >= minLeafSize * 2;
  let horizontal: boolean;
  if (canSplitHorizontal && canSplitVertical) {
    // Preferisci splittare lungo la dimensione piu' lunga per evitare
    // foglie sottili e lunghe (corridoi mascherati da stanze).
    if (p.h > p.w) horizontal = true;
    else if (p.w > p.h) horizontal = false;
    else horizontal = rng() < 0.5;
  } else if (canSplitHorizontal) {
    horizontal = true;
  } else {
    horizontal = false;
  }

  if (horizontal) {
    const splitAt = randInt(rng, minLeafSize, p.h - minLeafSize);
    return [
      { x: p.x, y: p.y, w: p.w, h: splitAt },
      { x: p.x, y: p.y + splitAt, w: p.w, h: p.h - splitAt },
    ];
  }
  const splitAt = randInt(rng, minLeafSize, p.w - minLeafSize);
  return [
    { x: p.x, y: p.y, w: splitAt, h: p.h },
    { x: p.x + splitAt, y: p.y, w: p.w - splitAt, h: p.h },
  ];
}

function carveRoom(
  leaf: Partition,
  rng: () => number,
  params: DungeonGenerationParams,
  id: string,
): DungeonRoom {
  const padding = 1;
  const innerW = Math.max(1, leaf.w - padding * 2);
  const innerH = Math.max(1, leaf.h - padding * 2);
  const maxW = Math.max(1, Math.min(params.maxRoomSize, innerW));
  const maxH = Math.max(1, Math.min(params.maxRoomSize, innerH));
  const minW = Math.min(params.minRoomSize, maxW);
  const minH = Math.min(params.minRoomSize, maxH);
  const w = randInt(rng, minW, maxW);
  const h = randInt(rng, minH, maxH);
  const ox = leaf.x + padding + randInt(rng, 0, innerW - w);
  const oy = leaf.y + padding + randInt(rng, 0, innerH - h);
  return {
    id,
    x: ox,
    y: oy,
    w,
    h,
    kind: "standard",
    centerX: ox + w / 2,
    centerY: oy + h / 2,
  };
}

function connectPartition(
  p: Partition,
  rng: () => number,
  edges: DungeonEdge[],
  nextEdgeId: () => string,
): DungeonRoom {
  if (p.room) return p.room;
  if (!p.left || !p.right) {
    throw new Error("BSP partition has neither room nor children");
  }
  const leftRep = connectPartition(p.left, rng, edges, nextEdgeId);
  const rightRep = connectPartition(p.right, rng, edges, nextEdgeId);
  edges.push({
    id: nextEdgeId(),
    fromRoomId: leftRep.id,
    toRoomId: rightRep.id,
    path: manhattanPath(leftRep, rightRep, rng),
  });
  // Sceglie random quale dei due rappresenta la sotto-radice piu' in
  // alto: piccola asimmetria che genera junction di grado > 2.
  return rng() < 0.5 ? leftRep : rightRep;
}

function manhattanPath(a: DungeonRoom, b: DungeonRoom, rng: () => number): DungeonPoint[] {
  const ax = a.centerX;
  const ay = a.centerY;
  const bx = b.centerX;
  const by = b.centerY;
  if (rng() < 0.5) {
    return [
      { x: ax, y: ay },
      { x: bx, y: ay },
      { x: bx, y: by },
    ];
  }
  return [
    { x: ax, y: ay },
    { x: ax, y: by },
    { x: bx, y: by },
  ];
}

function assignRoomKinds(rooms: DungeonRoom[], edges: DungeonEdge[]): void {
  if (rooms.length === 0) return;
  const adjacency = new Map<string, Set<string>>();
  for (const room of rooms) adjacency.set(room.id, new Set());
  for (const edge of edges) {
    adjacency.get(edge.fromRoomId)?.add(edge.toRoomId);
    adjacency.get(edge.toRoomId)?.add(edge.fromRoomId);
  }

  // Entry: stanza piu' in alto a sinistra. Deterministico, indipendente
  // dal seed (rispetta il contratto "stesso input -> stesso output").
  const entry = [...rooms].sort((a, b) => a.y - b.y || a.x - b.x)[0];
  if (!entry) return;
  entry.kind = "entry";

  // BFS distanze dal entry. La stanza piu' lontana diventa boss.
  const distance = new Map<string, number>();
  const queue: string[] = [entry.id];
  distance.set(entry.id, 0);
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const here = distance.get(current);
    if (here === undefined) continue;
    for (const next of adjacency.get(current) ?? []) {
      if (!distance.has(next)) {
        distance.set(next, here + 1);
        queue.push(next);
      }
    }
  }

  let bossId: string | undefined;
  let maxDistance = -1;
  for (const [id, d] of distance) {
    if (id === entry.id) continue;
    if (d > maxDistance) {
      maxDistance = d;
      bossId = id;
    }
  }
  const bossRoom = rooms.find((room) => room.id === bossId);
  if (bossRoom) bossRoom.kind = "boss";

  // Treasure: dead-end (degree 1) piu' lontano, evitando entry e boss.
  const treasureCandidates = rooms
    .filter((room) => {
      if (room.id === entry.id || room.id === bossId) return false;
      return (adjacency.get(room.id)?.size ?? 0) === 1;
    })
    .sort((a, b) => (distance.get(b.id) ?? 0) - (distance.get(a.id) ?? 0));
  const treasureRoom = treasureCandidates[0];
  if (treasureRoom) treasureRoom.kind = "treasure";

  // Trick: junction (grado >= 3) non gia' assegnato. Se non esiste
  // junction puro, ripiega sulla stanza di grado massimo escludendo
  // entry/boss/treasure.
  const trickCandidates = rooms
    .filter(
      (room) =>
        room.id !== entry.id &&
        room.id !== bossId &&
        room.id !== treasureRoom?.id,
    )
    .sort(
      (a, b) =>
        (adjacency.get(b.id)?.size ?? 0) - (adjacency.get(a.id)?.size ?? 0),
    );
  const trickRoom = trickCandidates[0];
  if (trickRoom && (adjacency.get(trickRoom.id)?.size ?? 0) >= 3) {
    trickRoom.kind = "trick";
  }
}
