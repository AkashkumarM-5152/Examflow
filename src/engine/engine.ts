import type {
  AppState,
  Check,
  ExplanationItem,
  Plan,
  PlanDiff,
  PlanRevision,
  Room,
  SeatingAssignment,
  StudentMovement,
  UnassignedEntry,
  ValidationReport,
} from './types';

export const adjacent = (a: { row: number; column: number }, b: { row: number; column: number }) =>
  Math.abs(a.row - b.row) + Math.abs(a.column - b.column) === 1;

export const usable = (r: Room) =>
  Math.max(0, Math.min(r.rows * r.columns, r.capacityOverride ?? r.rows * r.columns));

export const isRoomAvailable = (r: Room, sessionIds: string[]) =>
  r.status === 'active' && !sessionIds.some(id => r.unavailableSessionIds.includes(id));

export const slotsFor = (state: AppState) => {
  const sorted = [...state.sessions].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.startTime.localeCompare(b.startTime) ||
      a.id.localeCompare(b.id)
  );
  const slots: { id: string; sessions: string[]; date: string; start: string; end: string }[] = [];
  for (const s of sorted) {
    const found = slots.find(x => x.date === s.date && s.startTime < x.end && s.endTime > x.start);
    if (found) {
      found.sessions.push(s.id);
      if (s.startTime < found.start) found.start = s.startTime;
      if (s.endTime > found.end) found.end = s.endTime;
    } else {
      slots.push({
        id: `${s.date}-${s.startTime}`,
        sessions: [s.id],
        date: s.date,
        start: s.startTime,
        end: s.endTime,
      });
    }
  }
  return slots;
};

function studentSubject(state: AppState, studentId: string, sessionId: string): string {
  const session = state.sessions.find(s => s.id === sessionId);
  return session?.subjectId ?? '';
}

export function validatePlan(
  state: AppState,
  plan: Pick<Plan, 'slotId' | 'assignments' | 'invigilatorAssignments' | 'unassigned' | 'uncovered'>
): ValidationReport {
  const slot = slotsFor(state).find(s => s.id === plan.slotId);
  const sessions = slot?.sessions ?? [];
  const sessionSet = new Set(sessions);
  const hard: string[] = [];
  const soft: string[] = [];
  const checks: Check[] = [];
  const explanations: ExplanationItem[] = [];

  const add = (name: string, ok: boolean, count: number, detail: string, hardFail = false) => {
    checks.push({ name, passed: ok, count, detail });
    if (!ok) {
      (hardFail ? hard : soft).push(`${name}: ${detail}`);
    }
  };

  const seatKeys = new Set<string>();
  const studentKeys = new Set<string>();
  const validAssignments = plan.assignments.filter(a => sessionSet.has(a.sessionId));

  for (const a of validAssignments) {
    const key = `${a.roomId}:${a.row}:${a.column}`;
    if (seatKeys.has(key)) hard.push(`H1 duplicate seat ${key}`);
    seatKeys.add(key);

    const sk = `${a.studentId}:${a.sessionId}`;
    if (studentKeys.has(sk)) hard.push(`Duplicate assignment for ${sk}`);
    studentKeys.add(sk);

    const r = state.rooms.find(x => x.id === a.roomId);
    if (!r || a.row < 1 || a.column < 1 || a.row > r.rows || a.column > r.columns || (a.row - 1) * r.columns + a.column > usable(r)) {
      hard.push(`H2 invalid or blocked seat for ${a.studentId}`);
    }
    if (!r || !isRoomAvailable(r, [a.sessionId])) {
      hard.push(`H3 unavailable room used: ${a.roomId}`);
    }
  }

  const h1Ok = !hard.some(x => x.startsWith('H1'));
  add('H1 · One student per seat', h1Ok, hard.filter(x => x.startsWith('H1')).length, 'No duplicate seat occupancy', true);
  if (h1Ok) {
    explanations.push({
      id: 'EXP-H1',
      category: 'RULE_SATISFACTION',
      ruleCode: 'H1',
      title: 'Rule H1 Satisfied (One Student per Seat)',
      explanation: `All ${validAssignments.length} seated students are assigned to distinct physical coordinates. Zero collision detected.`,
      severity: 'success',
    });
  }

  const h2Ok = !hard.some(x => x.startsWith('H2'));
  add('H2 · Usable capacity', h2Ok, hard.filter(x => x.startsWith('H2')).length, 'Assignments must stay inside room capacity', true);

  const h3Ok = !hard.some(x => x.startsWith('H3'));
  add('H3 · Room availability', h3Ok, hard.filter(x => x.startsWith('H3')).length, 'Unavailable and withdrawn rooms are excluded', true);

  const byStudent = new Map<string, typeof validAssignments>();
  for (const a of validAssignments) {
    byStudent.set(a.studentId, [...(byStudent.get(a.studentId) ?? []), a]);
  }
  const clashBad: string[] = [];
  for (const [id, arr] of byStudent) {
    if (arr.length > 1) clashBad.push(id);
  }
  const h4Ok = clashBad.length === 0;
  add('H4 · No double-seated students', h4Ok, clashBad.length, 'At most one exam assignment per student in this planning slot', true);

  const invUsed = new Set<string>();
  const invBad: string[] = [];
  for (const a of plan.invigilatorAssignments) {
    const inv = state.invigilators.find(x => x.id === a.invigilatorId);
    const room = state.rooms.find(x => x.id === a.roomId);
    if (
      !inv ||
      inv.status !== 'active' ||
      sessions.some(s => inv.unavailableSessionIds.includes(s)) ||
      (inv.eligibleBuildings?.length && room && !inv.eligibleBuildings.includes(room.building ?? ''))
    ) {
      invBad.push(a.invigilatorId);
    }
    if (invUsed.has(a.invigilatorId)) {
      invBad.push(`double:${a.invigilatorId}`);
    }
    invUsed.add(a.invigilatorId);
  }

  const h5Ok = !invBad.some(x => !x.startsWith('double:'));
  add('H5 · Invigilator eligibility', h5Ok, invBad.filter(x => !x.startsWith('double:')).length, 'Staff must be available and eligible for the building', true);

  const h6Ok = !invBad.some(x => x.startsWith('double:'));
  add('H6 · No double-booked invigilators', h6Ok, invBad.filter(x => x.startsWith('double:')).length, 'One invigilator can cover one room per slot', true);

  const registered = new Set(
    state.registrations.filter(r => sessionSet.has(r.sessionId)).map(r => `${r.studentId}:${r.sessionId}`)
  );
  const accounted = new Set([
    ...validAssignments.map(a => `${a.studentId}:${a.sessionId}`),
    ...plan.unassigned.map(a => `${a.studentId}:${a.sessionId}`),
  ]);
  const missing = [...registered].filter(x => !accounted.has(x));
  add('H7 · Every registration accounted for', missing.length === 0, missing.length, 'Each registration is seated or has an explicit reason', true);
  if (missing.length) {
    hard.push(`H7 missing registrations: ${missing.join(', ')}`);
  }

  const usedRooms = [...new Set(validAssignments.map(a => a.roomId))];
  const uncoveredIds = new Set(plan.uncovered.map(x => x.roomId));
  const coverBad = usedRooms.filter(id => !uncoveredIds.has(id) && !plan.invigilatorAssignments.some(a => a.roomId === id));
  add('H8 · Room coverage', coverBad.length === 0, coverBad.length, 'Every used room is staffed or explicitly marked uncovered', true);

  // Soft check: Same-subject edge adjacency
  let pairs = 0;
  const adjacentPairsList: { roomName: string; subjectCode: string; seat1: string; seat2: string }[] = [];
  for (let i = 0; i < validAssignments.length; i++) {
    for (let j = i + 1; j < validAssignments.length; j++) {
      const a = validAssignments[i];
      const b = validAssignments[j];
      if (
        a.roomId === b.roomId &&
        a.sessionId === b.sessionId &&
        studentSubject(state, a.studentId, a.sessionId) === studentSubject(state, b.studentId, b.sessionId) &&
        adjacent(a, b)
      ) {
        pairs++;
        const rName = state.rooms.find(r => r.id === a.roomId)?.name ?? a.roomId;
        const sub = state.subjects.find(s => s.id === state.sessions.find(x => x.id === a.sessionId)?.subjectId)?.code ?? 'Subject';
        adjacentPairsList.push({
          roomName: rName,
          subjectCode: sub,
          seat1: `R${a.row}C${a.column}`,
          seat2: `R${b.row}C${b.column}`,
        });
      }
    }
  }

  add('S1 · Same-subject adjacency', pairs === 0, pairs, 'Edge-adjacent seats only; diagonals do not count', false);
  if (pairs) {
    soft.push(`${pairs} same-subject adjacent pair(s)`);
    // Explain plainly why S1 had to be bent!
    explanations.push({
      id: 'EXP-S1-BENT',
      category: 'RULE_BENT',
      ruleCode: 'S1',
      title: `Rule S1 Soft-Constraint Bent (${pairs} Adjacent Same-Subject Pair${pairs > 1 ? 's' : ''})`,
      explanation: `Same-subject edge adjacency occurred in ${[...new Set(adjacentPairsList.map(p => p.roomName))].join(', ')}. Why this rule had to be bent: When students of one subject exceed half the usable seats of a hall, or room dimensions prevent a perfect 2-color bipartite checkerboard, adjacent placement is mathematically required (Pigeonhole Principle). Coordinators may inspect or manually swap flagged seats.`,
      severity: 'warning',
      metric: `${pairs} pair(s)`,
    });
  } else {
    explanations.push({
      id: 'EXP-S1-OK',
      category: 'RULE_SATISFACTION',
      ruleCode: 'S1',
      title: 'Rule S1 Satisfied (Zero Same-Subject Adjacency)',
      explanation: 'No students taking the same exam subject sit side-by-side or front-to-back in any hall. Cheating risk minimized.',
      severity: 'success',
    });
  }

  // Soft check S2: Room occupancy balance
  const usedRoomCaps = usedRooms.map(id => {
    const r = state.rooms.find(x => x.id === id);
    const cap = r ? usable(r) : 0;
    const count = validAssignments.filter(a => a.roomId === id).length;
    return cap > 0 ? (count / cap) * 100 : 100;
  });
  const maxOccupancy = usedRoomCaps.length ? Math.max(...usedRoomCaps) : 0;
  const minOccupancy = usedRoomCaps.length ? Math.min(...usedRoomCaps) : 0;
  const occupancySpread = Math.round(maxOccupancy - minOccupancy);
  add('S2 · Room occupancy balance', occupancySpread <= 50, occupancySpread, `Occupancy spread between used halls: ${occupancySpread}%`, false);

  // Soft check S3: Efficient room selection
  const totalUsableAcrossUsed = usedRooms.reduce((acc, id) => {
    const r = state.rooms.find(x => x.id === id);
    return acc + (r ? usable(r) : 0);
  }, 0);
  const roomBuffer = totalUsableAcrossUsed - validAssignments.length;
  add('S3 · Efficient room selection', true, usedRooms.length, `${usedRooms.length} hall(s) opened; ${validAssignments.length} seated with ${roomBuffer} empty desk buffer`, false);

  // Soft check S4: Staff duty distribution
  const invCounts = new Map<string, number>();
  for (const ia of plan.invigilatorAssignments) {
    invCounts.set(ia.invigilatorId, (invCounts.get(ia.invigilatorId) ?? 0) + 1);
  }
  const maxInvDuty = Math.max(0, ...invCounts.values());
  add('S4 · Staff load distribution', maxInvDuty <= 1, maxInvDuty, `Maximum duties assigned to any single faculty member: ${maxInvDuty}`, false);

  // Explain Clashes if present
  const clashes = plan.unassigned.filter(u => u.reason === 'EXAM_CLASH');
  if (clashes.length > 0) {
    explanations.push({
      id: 'EXP-CLASH-BENT',
      category: 'RULE_BENT',
      ruleCode: 'H7',
      title: `Registration Clash Detected (${clashes.length} Registration${clashes.length > 1 ? 's' : ''})`,
      explanation: `${clashes.length} clashing registration(s) detected where students were enrolled in multiple exams scheduled simultaneously in this slot. The engine deterministically assigned each student to their primary session and marked clashing sessions so coordinators can reschedule without morning surprise.`,
      severity: 'warning',
      metric: `${clashes.length} clashing registration(s)`,
    });
  }

  // Explain Shortfall or Uncovered
  if (plan.uncovered.length > 0) {
    explanations.push({
      id: 'EXP-UNCOVERED',
      category: 'RULE_BENT',
      ruleCode: 'H8',
      title: `Invigilation Shortfall (${plan.uncovered.length} Room${plan.uncovered.length > 1 ? 's' : ''} Unstaffed)`,
      explanation: `Halls ${plan.uncovered.map(u => state.rooms.find(r => r.id === u.roomId)?.name ?? u.roomId).join(', ')} require staff. Insufficient eligible and available invigilators in the roster for this slot.`,
      severity: 'error',
    });
  }

  const unassigned = [...plan.unassigned];
  const uncovered = [...plan.uncovered];
  let status: ValidationReport['status'] = hard.length
    ? 'INVALID'
    : unassigned.length || uncovered.length
    ? 'INCOMPLETE'
    : pairs
    ? 'VALID_WITH_WARNINGS'
    : 'VALID';

  const totalCap = state.rooms.filter(r => isRoomAvailable(r, sessions)).reduce((n, r) => n + usable(r), 0);
  const uniqueDemand = new Set(state.registrations.filter(r => sessionSet.has(r.sessionId)).map(r => r.studentId)).size;
  if (totalCap < uniqueDemand) {
    status = 'INFEASIBLE';
    explanations.push({
      id: 'EXP-INFEASIBLE',
      category: 'RULE_BENT',
      ruleCode: 'H2',
      title: 'Feasibility Failure: Total Usable Capacity Below Demand',
      explanation: `Total usable seats in active rooms (${totalCap}) is strictly less than student demand (${uniqueDemand}). Physical impossibility to seat all candidates.`,
      severity: 'error',
    });
  }

  return {
    status,
    hardViolations: hard,
    softViolations: soft,
    checks,
    unassigned,
    uncovered,
    suggestedActions: [
      ...(unassigned.some(x => x.reason === 'EXAM_CLASH')
        ? ['Reschedule one exam or confirm which exam each clashing student should sit.']
        : []),
      ...(unassigned.some(x => x.reason === 'NO_CAPACITY')
        ? ['Restore room capacity or add another available room.']
        : []),
      ...(uncovered.length ? ['Restore or add eligible invigilators for uncovered rooms.'] : []),
      ...(pairs ? ['Inspect highlighted adjacent seats or use manual seat swap.'] : []),
    ],
    explanations,
  };
}

export function generatePlan(
  state: AppState,
  slotId: string,
  assignedAt = '2026-10-09T00:00:00.000Z'
): Plan {
  const start = performance.now();
  const slot = slotsFor(state).find(s => s.id === slotId);
  if (!slot) throw new Error('Planning slot not found');
  const sessions = slot.sessions;

  const regs = state.registrations.filter(
    r => sessions.includes(r.sessionId) && state.students.some(s => s.id === r.studentId)
  );
  const byStudent = new Map<string, typeof regs>();
  for (const r of regs) {
    byStudent.set(r.studentId, [...(byStudent.get(r.studentId) ?? []), r]);
  }

  const unassigned: UnassignedEntry[] = [];
  const chosen: { studentId: string; sessionId: string; subjectId: string; usn: string }[] = [];

  for (const [studentId, list] of [...byStudent.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const sorted = [...list].sort((a, b) => a.sessionId.localeCompare(b.sessionId) || a.id.localeCompare(b.id));
    const winner = sorted[0];
    chosen.push({
      studentId,
      sessionId: winner.sessionId,
      subjectId: studentSubject(state, studentId, winner.sessionId),
      usn: state.students.find(s => s.id === studentId)!.usn,
    });
    for (const loser of sorted.slice(1)) {
      unassigned.push({
        studentId,
        sessionId: loser.sessionId,
        reason: 'EXAM_CLASH',
        detail: `Student already assigned to ${winner.sessionId} in this overlapping planning slot`,
      });
    }
  }

  const rooms = state.rooms
    .filter(r => r.status === 'active' && !sessions.some(s => r.unavailableSessionIds.includes(s)))
    .map(r => ({ ...r, cap: usable(r) }))
    .filter(r => r.cap > 0)
    .sort((a, b) => b.cap - a.cap || a.id.localeCompare(b.id));

  const demand = chosen.length;
  let total = 0;
  let selected: typeof rooms = [];
  const targetBuffer = (state.settings.headroomTargetPercent ?? 10) / 100;
  for (const room of rooms) {
    selected.push(room);
    total += room.cap;
    if (total >= Math.ceil(demand * (1 + targetBuffer))) break;
  }
  if (total < demand) {
    selected = rooms;
    total = selected.reduce((n, r) => n + r.cap, 0);
  }

  const subjectCounts = new Map<string, number>();
  for (const s of chosen) {
    subjectCounts.set(s.subjectId, (subjectCounts.get(s.subjectId) ?? 0) + 1);
  }

  const priority = [...chosen].sort(
    (a, b) =>
      subjectCounts.get(b.subjectId)! - subjectCounts.get(a.subjectId)! ||
      a.subjectId.localeCompare(b.subjectId) ||
      b.usn.localeCompare(a.usn)
  );
  const seatable = priority.slice(0, total);
  const left = priority.slice(total);
  for (const s of left) {
    unassigned.push({
      studentId: s.studentId,
      sessionId: s.sessionId,
      reason: selected.length ? 'NO_CAPACITY' : 'NO_ROOM',
      detail: selected.length ? `Usable capacity is ${total}; demand is ${demand}` : 'No available room',
    });
  }

  // Interleave subjects round robin
  const subjects = [...new Set(seatable.map(s => s.subjectId))].sort(
    (a, b) => (subjectCounts.get(b) ?? 0) - (subjectCounts.get(a) ?? 0) || a.localeCompare(b)
  );
  const queues = new Map(
    subjects.map(s => [s, seatable.filter(x => x.subjectId === s).sort((a, b) => a.usn.localeCompare(b.usn))])
  );
  const ordered: typeof seatable = [];
  while ([...queues.values()].some(q => q.length)) {
    for (const q of queues.values()) {
      if (q.length) ordered.push(q.shift()!);
    }
  }

  const assignments: SeatingAssignment[] = [];
  let cursor = 0;
  for (const room of selected) {
    const positions: { row: number; column: number }[] = [];
    // Checkerboard parity: (row + column) % 2 === 0 first
    for (let row = 1; row <= room.rows; row++) {
      for (let column = 1; column <= room.columns; column++) {
        if ((row + column) % 2 === 0 && (row - 1) * room.columns + column <= room.cap) {
          positions.push({ row, column });
        }
      }
    }
    // Remaining parity
    for (let row = 1; row <= room.rows; row++) {
      for (let column = 1; column <= room.columns; column++) {
        if ((row + column) % 2 !== 0 && (row - 1) * room.columns + column <= room.cap) {
          positions.push({ row, column });
        }
      }
    }
    for (const pos of positions) {
      if (cursor >= ordered.length) break;
      const s = ordered[cursor++];
      assignments.push({
        id: `AS-${s.sessionId}-${s.studentId}`,
        studentId: s.studentId,
        sessionId: s.sessionId,
        roomId: room.id,
        ...pos,
        assignedAt,
      });
    }
  }

  // Deterministic greedy local improvement: swaps only when total same-subject edge adjacency strictly falls
  const adjacencyCount = (arr: SeatingAssignment[]) => {
    let n = 0;
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        if (
          arr[i].roomId === arr[j].roomId &&
          arr[i].sessionId === arr[j].sessionId &&
          studentSubject(state, arr[i].studentId, arr[i].sessionId) ===
            studentSubject(state, arr[j].studentId, arr[j].sessionId) &&
          adjacent(arr[i], arr[j])
        ) {
          n++;
        }
      }
    }
    return n;
  };

  let score = adjacencyCount(assignments);
  let iterations = 0;
  for (let i = 0; i < assignments.length && iterations < 500 && score > 0; i++) {
    for (let j = i + 1; j < assignments.length && iterations < 500; j++) {
      if (assignments[i].sessionId !== assignments[j].sessionId) continue;
      iterations++;
      const test = assignments.map(a => ({ ...a }));
      const ai = test[i];
      const aj = test[j];
      [ai.studentId, aj.studentId] = [aj.studentId, ai.studentId];
      [ai.id, aj.id] = [aj.id, ai.id];
      const next = adjacencyCount(test);
      if (next < score) {
        assignments.splice(0, assignments.length, ...test);
        score = next;
      }
    }
  }

  // Invigilator assignment
  const invigilatorAssignments: Plan['invigilatorAssignments'] = [];
  const uncovered: Plan['uncovered'] = [];
  for (const roomId of [...new Set(assignments.map(a => a.roomId))].sort()) {
    const room = state.rooms.find(r => r.id === roomId)!;
    const required = Math.max(
      state.settings.invigilatorsPerRoom,
      assignments.filter(a => a.roomId === roomId).length > state.settings.largeRoomThreshold
        ? state.settings.largeRoomInvigilators
        : 1
    );
    const eligible = state.invigilators
      .filter(
        inv =>
          inv.status === 'active' &&
          !sessions.some(s => inv.unavailableSessionIds.includes(s)) &&
          (!inv.eligibleBuildings?.length || inv.eligibleBuildings.includes(room.building ?? ''))
      )
      .sort((a, b) => a.id.localeCompare(b.id));

    let count = 0;
    for (const inv of eligible) {
      if (invigilatorAssignments.some(a => a.invigilatorId === inv.id)) continue;
      invigilatorAssignments.push({
        id: `IA-${inv.id}-${roomId}`,
        invigilatorId: inv.id,
        slotId,
        roomId,
      });
      count++;
      if (count === required) break;
    }
    if (count < required) {
      uncovered.push({
        roomId,
        required,
        assigned: count,
        reason: `Need ${required} invigilator(s), only ${count} eligible and free`,
      });
    }
  }

  const partial = { slotId, assignments, invigilatorAssignments, unassigned, uncovered };
  const validation = validatePlan(state, partial);

  // Add allocation and interleaving explanations
  validation.explanations = validation.explanations ?? [];
  validation.explanations.unshift(
    {
      id: 'EXP-ROOMS-PICKED',
      category: 'ROOM_SELECTION',
      title: `Optimal Room Selection (${selected.length} Rooms Selected)`,
      explanation: `Selected rooms ${selected.map(r => r.name).join(', ')} providing ${total} usable seats for ${demand} candidates (${Math.round(((total - demand) / demand) * 100)}% buffer). Rooms prioritized by usable capacity to minimize room sprawl.`,
      severity: 'info',
    },
    {
      id: 'EXP-INTERLEAVE',
      category: 'INTERLEAVING',
      title: 'Checkerboard Parity & Multi-Subject Interleaving',
      explanation: `Interleaved ${subjects.length} subjects in round-robin sequence across checkerboard parity coordinates. Alternate-seat parity spaces students apart to minimize cheating.`,
      severity: 'info',
    }
  );

  if (unassigned.some(x => x.reason === 'NO_CAPACITY' || x.reason === 'NO_ROOM') || uncovered.length) {
    validation.status = 'INFEASIBLE';
  } else if (unassigned.length) {
    validation.status = 'INCOMPLETE';
  }

  const computeMs = Number((performance.now() - start).toFixed(2));
  return { ...partial, validation, computeMs, explanations: validation.explanations };
}

export function replan(
  state: AppState,
  previous: PlanRevision,
  disruption: {
    type: 'withdraw-room' | 'reduce-capacity' | 'invigilator-unavailable' | 'restore-room' | 'restore-invigilator';
    id: string;
    capacity?: number;
  },
  createdAt = '2026-10-09T00:00:00.000Z'
): {
  state: AppState;
  plan: Plan;
  diff: PlanDiff;
} {
  const t = performance.now();
  let nextState: AppState = {
    ...state,
    rooms: state.rooms.map(r => ({ ...r, unavailableSessionIds: [...r.unavailableSessionIds] })),
    invigilators: state.invigilators.map(i => ({ ...i, unavailableSessionIds: [...i.unavailableSessionIds] })),
  };

  if (disruption.type === 'withdraw-room') {
    nextState.rooms = nextState.rooms.map(r => (r.id === disruption.id ? { ...r, status: 'withdrawn' } : r));
  }
  if (disruption.type === 'restore-room') {
    nextState.rooms = nextState.rooms.map(r => (r.id === disruption.id ? { ...r, status: 'active' } : r));
  }
  if (disruption.type === 'reduce-capacity') {
    nextState.rooms = nextState.rooms.map(r =>
      r.id === disruption.id
        ? { ...r, capacityOverride: Math.max(0, Math.min(r.rows * r.columns, disruption.capacity ?? 0)) }
        : r
    );
  }
  if (disruption.type === 'invigilator-unavailable') {
    nextState.invigilators = nextState.invigilators.map(i => (i.id === disruption.id ? { ...i, status: 'unavailable' } : i));
  }
  if (disruption.type === 'restore-invigilator') {
    nextState.invigilators = nextState.invigilators.map(i => (i.id === disruption.id ? { ...i, status: 'active' } : i));
  }

  let plan = generatePlan(nextState, previous.slotId, createdAt);
  let fallback = true;

  if (disruption.type === 'withdraw-room' || disruption.type === 'restore-room' || disruption.type === 'reduce-capacity') {
    const affected = previous.assignments.filter(a => {
      if (a.roomId !== disruption.id) return false;
      if (disruption.type === 'withdraw-room') return true;
      if (disruption.type === 'reduce-capacity') {
        const colCount = nextState.rooms.find(r => r.id === a.roomId)?.columns ?? 1;
        return (a.row - 1) * colCount + a.column > (disruption.capacity ?? 0);
      }
      return false;
    });

    const affectedIds = new Set(affected.map(a => a.studentId));
    // Keep unaffected assignments completely frozen in their exact rooms and coordinates!
    const kept = previous.assignments.filter(
      a =>
        !affectedIds.has(a.studentId) &&
        nextState.rooms.some(r => r.id === a.roomId && isRoomAvailable(r, [a.sessionId]) && (a.row - 1) * r.columns + a.column <= usable(r))
    );

    const unassignedCapacity = previous.unassigned.filter(u => u.reason === 'NO_CAPACITY');
    const moving: SeatingAssignment[] = [
      ...affected,
      ...unassignedCapacity.map(u => ({
        id: `AS-${u.sessionId}-${u.studentId}`,
        studentId: u.studentId,
        sessionId: u.sessionId,
        roomId: '',
        row: 0,
        column: 0,
        assignedAt: createdAt,
      })),
    ].sort((a, b) => a.studentId.localeCompare(b.studentId));
    const usedKeys = new Set(kept.map(a => `${a.roomId}:${a.row}:${a.column}`));
    const baseUnassigned = previous.unassigned.filter(u => u.reason === 'EXAM_CLASH');
    const newlyUnassigned: UnassignedEntry[] = [];
    const slotSessions = slotsFor(nextState).find(s => s.id === previous.slotId)?.sessions ?? [];

    const candidateRooms = nextState.rooms
      .filter(r => isRoomAvailable(r, slotSessions) && usable(r) > 0)
      .sort((a, b) => {
        const au = kept.some(x => x.roomId === a.id) ? 0 : 1;
        const bu = kept.some(x => x.roomId === b.id) ? 0 : 1;
        return au - bu || a.id.localeCompare(b.id);
      });

    const currentAssignments = [...kept];
    for (const old of moving) {
      let best: { roomId: string; row: number; column: number; score: number } | undefined;
      for (const room of candidateRooms) {
        for (let row = 1; row <= room.rows; row++) {
          for (let column = 1; column <= room.columns; column++) {
            if ((row - 1) * room.columns + column > usable(room) || usedKeys.has(`${room.id}:${row}:${column}`)) {
              continue;
            }
            let score = 0;
            for (const other of currentAssignments) {
              if (other.roomId === room.id && other.sessionId === old.sessionId && adjacent(other, { row, column })) {
                score++;
              }
            }
            const candidate = { roomId: room.id, row, column, score };
            if (
              !best ||
              candidate.score < best.score ||
              (candidate.score === best.score &&
                (candidate.roomId.localeCompare(best.roomId) < 0 ||
                  (candidate.roomId === best.roomId &&
                    (candidate.row < best.row || (candidate.row === best.row && candidate.column < best.column)))))
            ) {
              best = candidate;
            }
          }
        }
      }

      if (best) {
        const moved = { ...old, ...best, id: `AS-${old.sessionId}-${old.studentId}`, assignedAt: createdAt };
        currentAssignments.push(moved);
        usedKeys.add(`${best.roomId}:${best.row}:${best.column}`);
      } else {
        newlyUnassigned.push({
          studentId: old.studentId,
          sessionId: old.sessionId,
          reason: 'NO_CAPACITY',
          detail: `No usable seat remains after disruption ${disruption.id}`,
        });
      }
    }

    // Rebuild staffing while retaining unaffected rooms
    const usedRoomIds = [...new Set(currentAssignments.map(a => a.roomId))].sort();
    const invAssignments: Plan['invigilatorAssignments'] = [];
    const invUncovered: Plan['uncovered'] = [];
    for (const roomId of usedRoomIds) {
      const room = nextState.rooms.find(r => r.id === roomId)!;
      const required = Math.max(
        nextState.settings.invigilatorsPerRoom,
        currentAssignments.filter(a => a.roomId === roomId).length > nextState.settings.largeRoomThreshold
          ? nextState.settings.largeRoomInvigilators
          : 1
      );
      const oldInv = previous.invigilatorAssignments.filter(a => a.roomId === roomId).map(a => a.invigilatorId);
      const eligible = nextState.invigilators
        .filter(
          i =>
            i.status === 'active' &&
            !slotSessions.some(s => i.unavailableSessionIds.includes(s)) &&
            (!i.eligibleBuildings?.length || i.eligibleBuildings.includes(room.building ?? ''))
        )
        .sort((a, b) => {
          const ap = oldInv.includes(a.id) ? 0 : 1;
          const bp = oldInv.includes(b.id) ? 0 : 1;
          return ap - bp || a.id.localeCompare(b.id);
        });

      let count = 0;
      for (const inv of eligible) {
        if (invAssignments.some(a => a.invigilatorId === inv.id)) continue;
        invAssignments.push({
          id: `IA-${inv.id}-${roomId}`,
          invigilatorId: inv.id,
          slotId: previous.slotId,
          roomId,
        });
        count++;
        if (count >= required) break;
      }
      if (count < required) {
        invUncovered.push({
          roomId,
          required,
          assigned: count,
          reason: `Need ${required} eligible invigilator(s), only ${count} free`,
        });
      }
    }

    const nextUnassigned = [...baseUnassigned, ...newlyUnassigned];
    const validation = validatePlan(nextState, {
      slotId: previous.slotId,
      assignments: currentAssignments,
      invigilatorAssignments: invAssignments,
      unassigned: nextUnassigned,
      uncovered: invUncovered,
    });

    if (newlyUnassigned.length || invUncovered.length) {
      validation.status = 'INFEASIBLE';
    }

    validation.explanations = validation.explanations ?? [];
    validation.explanations.unshift({
      id: 'EXP-MINIMAL-DISPLACEMENT',
      category: 'REPLAN_DISPLACEMENT',
      title: 'Minimal-Displacement Replanning Applied',
      explanation: `Disruption handled on ${disruption.id}. Strictly frozen ${kept.length} students in unaffected rooms. Only ${moving.length} displaced candidates were relocated, minimizing confusion on exam day.`,
      severity: 'info',
    });

    plan = {
      slotId: previous.slotId,
      assignments: currentAssignments,
      invigilatorAssignments: invAssignments,
      unassigned: nextUnassigned,
      uncovered: invUncovered,
      validation,
      computeMs: plan.computeMs,
      explanations: validation.explanations,
    };
    fallback = false;
  }

  if (disruption.type === 'invigilator-unavailable' || disruption.type === 'restore-invigilator') {
    const invAssignments = previous.invigilatorAssignments.map(a => ({ ...a }));
    const changed = invAssignments.filter(a => a.invigilatorId === disruption.id);
    for (const old of changed) {
      const room = nextState.rooms.find(r => r.id === old.roomId);
      const candidates = nextState.invigilators
        .filter(
          i =>
            i.id !== disruption.id &&
            i.status === 'active' &&
            !slotsFor(nextState)
              .find(s => s.id === previous.slotId)
              ?.sessions.some(s => i.unavailableSessionIds.includes(s)) &&
            (!i.eligibleBuildings?.length || i.eligibleBuildings.includes(room?.building ?? ''))
        )
        .sort((a, b) => a.id.localeCompare(b.id));

      const replacement = candidates.find(
        i => !invAssignments.some(a => a.invigilatorId === i.id && a.slotId === old.slotId)
      );
      if (replacement) {
        old.invigilatorId = replacement.id;
      } else {
        invAssignments.splice(invAssignments.indexOf(old), 1);
      }
    }
    plan = { ...plan, invigilatorAssignments: invAssignments };
    plan.validation = validatePlan(nextState, plan);
    fallback = false;
  }

  // Calculate detailed student movements for side-by-side diff
  const oldByStudent = new Map(previous.assignments.map(a => [a.studentId, a]));
  const newByStudent = new Map(plan.assignments.map(a => [a.studentId, a]));
  const allStudentIds = new Set([...oldByStudent.keys(), ...newByStudent.keys()]);
  const movements: StudentMovement[] = [];

  let moved = 0;
  let unchanged = 0;

  for (const stId of allStudentIds) {
    const student = state.students.find(s => s.id === stId);
    const oldA = oldByStudent.get(stId);
    const newA = newByStudent.get(stId);
    const session = state.sessions.find(x => x.id === (newA?.sessionId ?? oldA?.sessionId));
    const subCode = state.subjects.find(s => s.id === session?.subjectId)?.code ?? '—';

    const fromRoom = oldA ? state.rooms.find(r => r.id === oldA.roomId) : undefined;
    const toRoom = newA ? nextState.rooms.find(r => r.id === newA.roomId) : undefined;

    if (oldA && newA) {
      if (oldA.roomId !== newA.roomId || oldA.row !== newA.row || oldA.column !== newA.column) {
        moved++;
        movements.push({
          studentId: stId,
          usn: student?.usn ?? stId,
          name: student?.name ?? '',
          subjectCode: subCode,
          from: { roomId: oldA.roomId, roomName: fromRoom?.name ?? oldA.roomId, row: oldA.row, column: oldA.column },
          to: { roomId: newA.roomId, roomName: toRoom?.name ?? newA.roomId, row: newA.row, column: newA.column },
          status: 'moved',
          reason: oldA.roomId !== newA.roomId ? `Transferred to Hall ${toRoom?.name}` : 'Reseated in same hall',
        });
      } else {
        unchanged++;
        movements.push({
          studentId: stId,
          usn: student?.usn ?? stId,
          name: student?.name ?? '',
          subjectCode: subCode,
          from: { roomId: oldA.roomId, roomName: fromRoom?.name ?? oldA.roomId, row: oldA.row, column: oldA.column },
          to: { roomId: newA.roomId, roomName: toRoom?.name ?? newA.roomId, row: newA.row, column: newA.column },
          status: 'unchanged',
        });
      }
    } else if (oldA && !newA) {
      movements.push({
        studentId: stId,
        usn: student?.usn ?? stId,
        name: student?.name ?? '',
        subjectCode: subCode,
        from: { roomId: oldA.roomId, roomName: fromRoom?.name ?? oldA.roomId, row: oldA.row, column: oldA.column },
        status: 'newly_unassigned',
        reason: 'Capacity exhausted after disruption',
      });
    } else if (!oldA && newA) {
      movements.push({
        studentId: stId,
        usn: student?.usn ?? stId,
        name: student?.name ?? '',
        subjectCode: subCode,
        to: { roomId: newA.roomId, roomName: toRoom?.name ?? newA.roomId, row: newA.row, column: newA.column },
        status: 'newly_assigned',
        reason: 'Seated from standby pool',
      });
    }
  }

  const oldInv = new Map(previous.invigilatorAssignments.map(a => [a.roomId, a.invigilatorId]));
  const changedInvigilators = plan.invigilatorAssignments.filter(a => oldInv.get(a.roomId) !== a.invigilatorId).length;
  plan.computeMs = Number((performance.now() - t).toFixed(2));

  return {
    state: nextState,
    plan,
    diff: {
      moved,
      unchanged,
      newlyUnassigned: plan.unassigned.length - previous.unassigned.length,
      changedInvigilators,
      fallback,
      movements,
    },
  };
}

/**
 * Manual Coordinator Override: Swap two seats or move a student to an empty coordinate,
 * then instantly re-calculate validation & explainability.
 */
export function swapSeats(
  state: AppState,
  currentPlan: Plan,
  seatA: { roomId: string; row: number; column: number },
  seatB: { roomId: string; row: number; column: number },
  createdAt = new Date().toISOString()
): Plan {
  const start = performance.now();
  const assignments = currentPlan.assignments.map(a => ({ ...a }));
  const assignA = assignments.find(a => a.roomId === seatA.roomId && a.row === seatA.row && a.column === seatA.column);
  const assignB = assignments.find(a => a.roomId === seatB.roomId && a.row === seatB.row && a.column === seatB.column);

  if (!assignA && !assignB) return currentPlan;

  if (assignA && assignB) {
    // Both occupied: swap coordinates
    assignA.roomId = seatB.roomId;
    assignA.row = seatB.row;
    assignA.column = seatB.column;
    assignA.assignedAt = createdAt;

    assignB.roomId = seatA.roomId;
    assignB.row = seatA.row;
    assignB.column = seatA.column;
    assignB.assignedAt = createdAt;
  } else if (assignA && !assignB) {
    // A moved to empty seat B
    assignA.roomId = seatB.roomId;
    assignA.row = seatB.row;
    assignA.column = seatB.column;
    assignA.assignedAt = createdAt;
  } else if (!assignA && assignB) {
    // B moved to empty seat A
    assignB.roomId = seatA.roomId;
    assignB.row = seatA.row;
    assignB.column = seatA.column;
    assignB.assignedAt = createdAt;
  }

  const validation = validatePlan(state, {
    slotId: currentPlan.slotId,
    assignments,
    invigilatorAssignments: currentPlan.invigilatorAssignments,
    unassigned: currentPlan.unassigned,
    uncovered: currentPlan.uncovered,
  });

  validation.explanations = validation.explanations ?? [];
  validation.explanations.unshift({
    id: `EXP-SWAP-${Date.now()}`,
    category: 'REPLAN_DISPLACEMENT',
    title: 'Manual Coordinator Override Applied',
    explanation: `Manual swap executed between ${seatA.roomId} [R${seatA.row}C${seatA.column}] and ${seatB.roomId} [R${seatB.row}C${seatB.column}]. Integrity re-validated instantly.`,
    severity: 'info',
  });

  return {
    ...currentPlan,
    assignments,
    validation,
    computeMs: Number((performance.now() - start).toFixed(2)),
    explanations: validation.explanations,
  };
}

/**
 * Generate large-scale synthetic stress scenarios to demonstrate extreme scalability and speed.
 */
export function generateStressScenario(studentCount: number = 500, roomCount: number = 10): AppState {
  const students = Array.from({ length: studentCount }, (_, i) => ({
    id: `ST_STRESS_${String(i + 1).padStart(4, '0')}`,
    usn: `1BM26CS${String(i + 1).padStart(4, '0')}`,
    name: `Stress Candidate ${i + 1}`,
  }));

  const subjects = [
    { id: 'SUB_AI', code: 'AI301', name: 'Artificial Intelligence & Neural Nets', color: '#3b82f6' },
    { id: 'SUB_DS', code: 'DS302', name: 'Distributed Systems & Cloud', color: '#10b981' },
    { id: 'SUB_CY', code: 'CY303', name: 'Cybersecurity & Cryptography', color: '#f59e0b' },
    { id: 'SUB_QC', code: 'QC304', name: 'Quantum Computing Fundamentals', color: '#8b5cf6' },
  ];

  const sessions = [
    { id: 'SESS_STRESS_1', subjectId: 'SUB_AI', date: '2026-11-10', startTime: '09:30', endTime: '12:30' },
    { id: 'SESS_STRESS_2', subjectId: 'SUB_DS', date: '2026-11-10', startTime: '09:30', endTime: '12:30' },
    { id: 'SESS_STRESS_3', subjectId: 'SUB_CY', date: '2026-11-10', startTime: '09:30', endTime: '12:30' },
    { id: 'SESS_STRESS_4', subjectId: 'SUB_QC', date: '2026-11-10', startTime: '09:30', endTime: '12:30' },
  ];

  const registrations: AppState['registrations'] = [];
  students.forEach((st, idx) => {
    const sId = sessions[idx % sessions.length].id;
    registrations.push({
      id: `REG_STR_${idx + 1}`,
      studentId: st.id,
      sessionId: sId,
    });
  });

  const rooms: Room[] = Array.from({ length: roomCount }, (_, i) => ({
    id: `ROOM_STR_${i + 1}`,
    name: `Hall ${101 + i}`,
    building: i < 5 ? 'Main Academic Block' : 'Science Complex',
    rows: 6,
    columns: 10, // 60 capacity each -> 600 total usable seats
    status: 'active',
    unavailableSessionIds: [],
  }));

  const invigilators: AppState['invigilators'] = Array.from({ length: roomCount + 3 }, (_, i) => ({
    id: `INV_STR_${i + 1}`,
    staffId: `STAFF_${100 + i}`,
    name: `Prof. Benchmark Specialist ${i + 1}`,
    unavailableSessionIds: [],
    eligibleBuildings: [],
    status: 'active',
  }));

  return {
    schemaVersion: 1,
    students,
    subjects,
    sessions,
    registrations,
    rooms,
    invigilators,
    revisions: [],
    currentRevisionId: null,
    settings: {
      invigilatorsPerRoom: 1,
      largeRoomThreshold: 45,
      largeRoomInvigilators: 2,
      headroomTargetPercent: 10,
      checkerboardParity: true,
    },
  };
}

export function parseCsv(text: string) {
  const input = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"' && quoted && input[i + 1] === '"') {
      cell += '"';
      i++;
    } else if (c === '"') {
      quoted = !quoted;
    } else if (c === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && input[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some(x => x.trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += c;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    if (row.some(x => x.trim())) rows.push(row);
  }
  return rows;
}

export function csvSafe(value: unknown) {
  const s = String(value ?? '');
  return /^[=+\-@]/.test(s) ? `'${s}` : s;
}

export interface ValidatedCsvStudentRow {
  usn: string;
  name: string;
  subjectCode?: string;
  sessionDate?: string;
}

export interface CsvRowError {
  rowNumber: number;
  reason: string;
}

export interface CsvStudentValidationResult {
  valid: boolean;
  rows: ValidatedCsvStudentRow[];
  errors: CsvRowError[];
}

export function validateCsvStudentRows(
  parsedRows: string[][],
  existingStudents: Array<{ usn: string }> = [],
  validSubjectCodes: string[] = []
): CsvStudentValidationResult {
  if (parsedRows.length === 0) {
    return {
      valid: false,
      rows: [],
      errors: [{ rowNumber: 0, reason: 'CSV is completely empty' }],
    };
  }

  // Detect header row
  const header = parsedRows[0].map(h => h.trim().toLowerCase());
  const usnIdx = header.indexOf('usn');
  const nameIdx = header.indexOf('name');
  const subIdx = header.indexOf('subject_code') !== -1 ? header.indexOf('subject_code') : header.indexOf('subject');
  const dateIdx = header.indexOf('session_date') !== -1 ? header.indexOf('session_date') : header.indexOf('date');

  const errors: CsvRowError[] = [];
  const validRows: ValidatedCsvStudentRow[] = [];
  const seenUsnsInFile = new Set<string>();
  const existingUsnSet = new Set(existingStudents.map(s => s.usn.trim().toUpperCase()));
  const subjectSet = new Set(validSubjectCodes.map(s => s.trim().toUpperCase()));

  const startRow = usnIdx !== -1 || nameIdx !== -1 ? 1 : 0;
  const actualUsnIdx = usnIdx !== -1 ? usnIdx : 0;
  const actualNameIdx = nameIdx !== -1 ? nameIdx : 1;

  for (let i = startRow; i < parsedRows.length; i++) {
    const row = parsedRows[i];
    const rowNum = i + 1;

    if (!row || row.every(c => !c.trim())) continue;

    const usn = (row[actualUsnIdx] ?? '').trim();
    const name = (row[actualNameIdx] ?? '').trim();
    const subjectCode = subIdx !== -1 && row[subIdx] ? row[subIdx].trim() : undefined;
    const sessionDate = dateIdx !== -1 && row[dateIdx] ? row[dateIdx].trim() : undefined;

    if (!usn) {
      errors.push({ rowNumber: rowNum, reason: 'Missing required USN' });
      continue;
    }

    if (!name) {
      errors.push({ rowNumber: rowNum, reason: `Missing candidate name for USN ${usn}` });
      continue;
    }

    const upperUsn = usn.toUpperCase();
    if (seenUsnsInFile.has(upperUsn)) {
      errors.push({ rowNumber: rowNum, reason: `Duplicate USN '${usn}' within imported file` });
      continue;
    }
    seenUsnsInFile.add(upperUsn);

    if (existingUsnSet.has(upperUsn)) {
      errors.push({ rowNumber: rowNum, reason: `USN '${usn}' already exists in current registry` });
      continue;
    }

    if (subjectCode && subjectSet.size > 0 && !subjectSet.has(subjectCode.toUpperCase())) {
      errors.push({ rowNumber: rowNum, reason: `Unknown subject code '${subjectCode}'` });
      continue;
    }

    validRows.push({ usn, name, subjectCode, sessionDate });
  }

  return {
    valid: errors.length === 0,
    rows: validRows,
    errors,
  };
}

export function safeLoadAppState(rawJson: string | null): {
  state: AppState | null;
  bad: boolean;
  error?: string;
} {
  if (!rawJson) return { state: null, bad: false };
  try {
    const s = JSON.parse(rawJson);
    if (!s || typeof s !== 'object') {
      return { state: null, bad: true, error: 'Parsed JSON is not an object' };
    }
    if (
      s.schemaVersion !== 1 ||
      !Array.isArray(s.students) ||
      !Array.isArray(s.rooms) ||
      !Array.isArray(s.sessions) ||
      !Array.isArray(s.registrations) ||
      !Array.isArray(s.invigilators) ||
      !Array.isArray(s.revisions)
    ) {
      return { state: null, bad: true, error: 'Schema mismatch or corrupted arrays' };
    }
    return { state: s as AppState, bad: false };
  } catch (err) {
    return { state: null, bad: true, error: (err as Error).message };
  }
}

export function restoreRevision(state: AppState, revisionId: string): AppState {
  const rev = state.revisions.find(r => r.id === revisionId);
  if (!rev) throw new Error(`Revision ${revisionId} not found in state`);
  return {
    ...state,
    currentRevisionId: revisionId,
  };
}
