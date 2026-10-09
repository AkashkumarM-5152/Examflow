import { describe, it, expect } from 'vitest';
import { makeDemoData } from './demo';
import {
  adjacent,
  generatePlan,
  parseCsv,
  csvSafe,
  validateCsvStudentRows,
  safeLoadAppState,
  restoreRevision,
  slotsFor,
  usable,
  validatePlan,
  replan,
  swapSeats,
  generateStressScenario,
} from './engine';
import type { PlanRevision } from './types';

describe('ExamFlow Engine Formal Regression Suite (Master Section F)', () => {
  // 1. Deterministic plan generation
  it('1. Deterministic plan generation: identical inputs produce identical outputs with stable tie-breakers', () => {
    const s = makeDemoData();
    const slot = slotsFor(s)[0].id;
    const a = generatePlan(s, slot, '2026-11-02T10:00:00.000Z');
    const b = generatePlan(s, slot, '2026-11-02T10:00:00.000Z');

    expect(a.assignments).toEqual(b.assignments);
    expect(a.unassigned).toEqual(b.unassigned);
    expect(a.invigilatorAssignments).toEqual(b.invigilatorAssignments);
    expect(a.validation.status).toBe(b.validation.status);
    expect(a.validation.hardViolations).toEqual(b.validation.hardViolations);
  });

  // 2. Unique seat assignments and usable capacity
  it('2. Unique seat assignments and usable capacity: positive coordinates within room capacity and active status', () => {
    const s = makeDemoData();
    const slot = slotsFor(s)[0].id;
    const p = generatePlan(s, slot);

    expect(p.assignments.length).toBe(60);
    // Every seated student appears exactly once
    const studentIds = p.assignments.map(a => a.studentId);
    expect(new Set(studentIds).size).toBe(p.assignments.length);

    // Every physical seat coordinate is unique
    const seatKeys = p.assignments.map(a => `${a.roomId}:${a.row}:${a.column}`);
    expect(new Set(seatKeys).size).toBe(p.assignments.length);

    // Coordinate bounds and room active check
    for (const a of p.assignments) {
      const r = s.rooms.find(x => x.id === a.roomId)!;
      expect(r.status).toBe('active');
      expect(a.row).toBeGreaterThanOrEqual(1);
      expect(a.column).toBeGreaterThanOrEqual(1);
      expect(a.row).toBeLessThanOrEqual(r.rows);
      expect(a.column).toBeLessThanOrEqual(r.columns);
      const deskIndex = (a.row - 1) * r.columns + a.column;
      expect(deskIndex).toBeLessThanOrEqual(usable(r));
    }
  });

  // 3. Exam-clash detection
  it('3. Exam-clash detection: simultaneous registrations isolated deterministically with EXAM_CLASH reason', () => {
    const s = makeDemoData();
    const slot = slotsFor(s)[0].id;
    const p = generatePlan(s, slot);

    const clashes = p.unassigned.filter(u => u.reason === 'EXAM_CLASH');
    expect(clashes).toHaveLength(2);
    // ST0003 (USN DEMO0003) has REG-CLASH-P and ST0030 (USN DEMO0030) has REG-CLASH-M
    const clashingStudentIds = clashes.map(c => c.studentId).sort();
    expect(clashingStudentIds).toEqual(['ST0003', 'ST0030']);

    // The primary registrations must be seated
    expect(p.assignments.filter(a => a.studentId === 'ST0003')).toHaveLength(1);
    expect(p.assignments.filter(a => a.studentId === 'ST0030')).toHaveLength(1);
  });

  // 4. Exact orthogonal adjacency counts, including a diagonal non-conflict case
  it('4. Exact orthogonal adjacency counts, including diagonal non-conflict case', () => {
    // Edge neighbours are adjacent
    expect(adjacent({ row: 1, column: 1 }, { row: 1, column: 2 })).toBe(true); // Horizontal
    expect(adjacent({ row: 1, column: 1 }, { row: 2, column: 1 })).toBe(true); // Vertical
    expect(adjacent({ row: 2, column: 2 }, { row: 1, column: 2 })).toBe(true);
    expect(adjacent({ row: 2, column: 2 }, { row: 2, column: 1 })).toBe(true);

    // Diagonals do NOT count as adjacent
    expect(adjacent({ row: 1, column: 1 }, { row: 2, column: 2 })).toBe(false);
    expect(adjacent({ row: 1, column: 2 }, { row: 2, column: 1 })).toBe(false);

    // Non-adjacent seats spaced 2 units apart
    expect(adjacent({ row: 1, column: 1 }, { row: 1, column: 3 })).toBe(false);
    expect(adjacent({ row: 1, column: 1 }, { row: 3, column: 1 })).toBe(false);
  });

  // 5. Unavailable room and invigilator enforcement
  it('5. Unavailable room and invigilator enforcement: withdrawn rooms and unavailable staff never assigned', () => {
    const s = makeDemoData();
    s.rooms[0].status = 'withdrawn';
    s.rooms[1].unavailableSessionIds = ['S1', 'S2', 'S3'];
    s.invigilators[0].status = 'unavailable';
    s.invigilators[1].unavailableSessionIds = ['S1', 'S2', 'S3'];

    const p = generatePlan(s, slotsFor(s)[0].id);

    // Excluded rooms must not have any assignments
    expect(p.assignments.every(a => a.roomId !== s.rooms[0].id && a.roomId !== s.rooms[1].id)).toBe(true);

    // Excluded invigilators must not have any duties
    expect(
      p.invigilatorAssignments.every(
        ia => ia.invigilatorId !== s.invigilators[0].id && ia.invigilatorId !== s.invigilators[1].id
      )
    ).toBe(true);
  });

  // 6. Independent validation of deliberately corrupted plans
  it('6. Independent validation of deliberately corrupted plans: catches duplicate seats, overcapacity, and double-booking', () => {
    const s = makeDemoData();
    const slot = slotsFor(s)[0].id;
    const base = generatePlan(s, slot);

    // Tamper 1: Duplicate physical seat (violates H1)
    const tamperedSeat = {
      ...base,
      assignments: [...base.assignments, { ...base.assignments[0], studentId: 'DEMO9999', id: 'TAMPER_SEAT' }],
    };
    const v1 = validatePlan(s, tamperedSeat);
    expect(v1.status).toBe('INVALID');
    expect(v1.hardViolations.some(h => h.includes('H1'))).toBe(true);

    // Tamper 2: Exceeding room capacity (violates H2)
    const tamperedCap = {
      ...base,
      assignments: [...base.assignments, { ...base.assignments[0], id: 'TAMPER_CAP', row: 99, column: 99 }],
    };
    const v2 = validatePlan(s, tamperedCap);
    expect(v2.status).toBe('INVALID');
    expect(v2.hardViolations.some(h => h.includes('H2'))).toBe(true);

    // Tamper 3: Assignment to a withdrawn room (violates H3)
    const tamperedWithdrawnState = {
      ...s,
      rooms: s.rooms.map(r => (r.id === base.assignments[0].roomId ? { ...r, status: 'withdrawn' as const } : r)),
    };
    const v3 = validatePlan(tamperedWithdrawnState, base);
    expect(v3.status).toBe('INVALID');
    expect(v3.hardViolations.some(h => h.includes('H3'))).toBe(true);

    // Tamper 4: Double-seated student in same slot (violates H4)
    const tamperedDoubleStudent = {
      ...base,
      assignments: [
        ...base.assignments,
        { ...base.assignments[0], id: 'TAMPER_DOUBLE', row: 1, column: 1, roomId: 'R2' },
      ],
    };
    const v4 = validatePlan(s, tamperedDoubleStudent);
    expect(v4.status).toBe('INVALID');
    expect(v4.hardViolations.some(h => h.includes('H4'))).toBe(true);
  });

  // 7. Minimal-change room withdrawal and invigilator replacement
  it('7. Minimal-change room withdrawal and invigilator replacement: freezes unaffected seats and staff', () => {
    const s = makeDemoData();
    const slot = slotsFor(s)[0].id;
    const initialPlan = generatePlan(s, slot);
    const revision: PlanRevision = {
      ...initialPlan,
      id: 'REV-001',
      createdAt: '2026-10-09T00:00:00.000Z',
      changeDescription: 'Initial Generated Plan',
    };

    // Withdraw Room R1 (A-101)
    const replanResult = replan(s, revision, { type: 'withdraw-room', id: 'R1' });
    expect(replanResult.state.rooms.find(r => r.id === 'R1')?.status).toBe('withdrawn');
    expect(replanResult.plan.assignments.every(a => a.roomId !== 'R1')).toBe(true);

    // Unaffected students originally seated in R2, R3, R4 MUST remain frozen in their exact rooms, rows, and columns
    const initialNonR1 = initialPlan.assignments.filter(a => a.roomId !== 'R1');
    for (const init of initialNonR1) {
      const match = replanResult.plan.assignments.find(a => a.studentId === init.studentId);
      expect(match).toBeDefined();
      expect(match?.roomId).toBe(init.roomId);
      expect(match?.row).toBe(init.row);
      expect(match?.column).toBe(init.column);
    }

    // Invigilator replacement retains unaffected staffing
    const initialStaff = initialPlan.invigilatorAssignments;
    if (initialStaff.length > 0) {
      const staffToWithdraw = initialStaff[0].invigilatorId;
      const staffReplan = replan(s, revision, {
        type: 'invigilator-unavailable',
        id: staffToWithdraw,
      });

      // Staff member was successfully replaced or dropped
      expect(staffReplan.plan.invigilatorAssignments.every(ia => ia.invigilatorId !== staffToWithdraw)).toBe(true);

      // Other staff assignments remained untouched
      const unaffectedStaff = initialStaff.slice(1);
      for (const unaffected of unaffectedStaff) {
        const found = staffReplan.plan.invigilatorAssignments.find(ia => ia.roomId === unaffected.roomId);
        if (found) {
          expect(found.invigilatorId).toBe(unaffected.invigilatorId);
        }
      }
    }
  });

  // 8. The exact 60-demand / 45-capacity / 15-shortfall scenario
  it('8. The exact 60-demand / 45-capacity / 15-shortfall scenario: A-101 then A-102 withdrawn yields exactly 15 shortfall', () => {
    const s = makeDemoData();
    const slot = slotsFor(s)[0].id;

    // Phase 1: Initial plan seats 60 unique candidates across 4 rooms (total capacity 99)
    const plan0 = generatePlan(s, slot);
    expect(plan0.assignments.length).toBe(60);
    expect(plan0.unassigned.filter(u => u.reason === 'EXAM_CLASH')).toHaveLength(2);

    const rev0: PlanRevision = {
      ...plan0,
      id: 'REV-000',
      createdAt: '2026-10-09T00:00:00.000Z',
      changeDescription: 'Initial',
    };

    // Phase 2: Withdraw Room A-101 (R1, capacity 30) -> Leaves 69 usable seats across A-102 (24), B-201 (25), B-202 (20)
    // Demand = 60 <= 69. Result remains feasible!
    const step2 = replan(s, rev0, { type: 'withdraw-room', id: 'R1' });
    const capAfterR1 = step2.state.rooms.filter(r => r.status === 'active').reduce((acc, r) => acc + usable(r), 0);
    expect(capAfterR1).toBe(69);
    expect(step2.plan.assignments.length).toBe(60);
    expect(step2.plan.unassigned.filter(u => u.reason === 'NO_CAPACITY')).toHaveLength(0);

    const rev1: PlanRevision = {
      ...step2.plan,
      id: 'REV-001',
      createdAt: '2026-10-09T00:01:00.000Z',
      changeDescription: 'Withdrew A-101',
    };

    // Phase 3: Also withdraw Room A-102 (R2, capacity 24) -> Leaves exactly 45 usable seats: B-201 (25) + B-202 (20)
    // Demand = 60 > 45 usable capacity.
    const step3 = replan(step2.state, rev1, { type: 'withdraw-room', id: 'R2' });
    const capAfterR1AndR2 = step3.state.rooms.filter(r => r.status === 'active').reduce((acc, r) => acc + usable(r), 0);
    expect(capAfterR1AndR2).toBe(45);

    // Exact hackathon expectations:
    // - Must seat at most 45 students
    expect(step3.plan.assignments.length).toBe(45);

    // - Must report a shortfall of EXACTLY 15 students
    const shortfall = step3.plan.unassigned.filter(u => u.reason === 'NO_CAPACITY');
    expect(shortfall.length).toBe(15);

    // - Must NEVER claim the incomplete plan is valid
    expect(['INFEASIBLE', 'INCOMPLETE']).toContain(step3.plan.validation.status);
    expect(step3.plan.validation.status).not.toBe('VALID');
    expect(step3.plan.validation.status).not.toBe('VALID_WITH_WARNINGS');

    // Phase 4: Restoring room permits another genuine planning attempt
    const rev2: PlanRevision = {
      ...step3.plan,
      id: 'REV-002',
      createdAt: '2026-10-09T00:02:00.000Z',
      changeDescription: 'Withdrew A-102',
    };
    const step4 = replan(step3.state, rev2, { type: 'restore-room', id: 'R1' });
    const capAfterRestore = step4.state.rooms.filter(r => r.status === 'active').reduce((acc, r) => acc + usable(r), 0);
    expect(capAfterRestore).toBe(75); // B-201 (25) + B-202 (20) + A-101 (30) = 75
    expect(step4.plan.assignments.length).toBe(60); // All 60 candidates seated again!
    expect(step4.plan.unassigned.filter(u => u.reason === 'NO_CAPACITY')).toHaveLength(0);
  });

  // 9. CSV parsing, validation and safe export
  it('9. CSV parsing, validation and safe export: handles BOM, CRLF, quotes, formula escaping, and row validation', () => {
    // Parser handles UTF-8 BOM, quoted commas, and CRLF
    const csvContent = '\uFEFFusn,name,subject_code\r\n"USN01","Doe, Jane",SUB1\r\n"USN02","Smith, Bob",SUB2\r\n';
    const parsed = parseCsv(csvContent);
    expect(parsed).toEqual([
      ['usn', 'name', 'subject_code'],
      ['USN01', 'Doe, Jane', 'SUB1'],
      ['USN02', 'Smith, Bob', 'SUB2'],
    ]);

    // Row-level validation detects errors before commit
    const invalidCsv = [
      ['usn', 'name', 'subject_code'],
      ['', 'Missing USN Student', 'SUB1'], // Missing USN
      ['USN03', '', 'SUB1'], // Missing name
      ['USN04', 'Valid Student', 'UNKNOWN_SUB'], // Unknown subject
      ['USN05', 'Duplicate Student 1', 'SUB1'],
      ['USN05', 'Duplicate Student 2', 'SUB1'], // Duplicate in file
    ];
    const validation = validateCsvStudentRows(invalidCsv, [{ usn: 'EXISTING_USN' }], ['SUB1', 'SUB2']);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.reason.includes('Missing required USN'))).toBe(true);
    expect(validation.errors.some(e => e.reason.includes('Missing candidate name'))).toBe(true);
    expect(validation.errors.some(e => e.reason.includes('Unknown subject code'))).toBe(true);
    expect(validation.errors.some(e => e.reason.includes('Duplicate USN'))).toBe(true);

    // Formula injection escaping (RFC-style protection against =,+,-,@ spreadsheet execution)
    expect(csvSafe('=1+1')).toBe("'=1+1");
    expect(csvSafe('+cmd|')).toBe("'+cmd|");
    expect(csvSafe('-1234')).toBe("'-1234");
    expect(csvSafe('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvSafe('Normal Text')).toBe('Normal Text');
  });

  // 10. Persistence recovery and revision restoration
  it('10. Persistence recovery and revision restoration: safely recovers from corrupted JSON and restores revisions', () => {
    // Graceful recovery from null
    expect(safeLoadAppState(null)).toEqual({ state: null, bad: false });

    // Graceful recovery from malformed JSON syntax
    const badJson = safeLoadAppState('{ unclosed json');
    expect(badJson.bad).toBe(true);
    expect(badJson.state).toBeNull();

    // Graceful recovery from schema version mismatch or missing arrays
    const corruptSchema = safeLoadAppState('{"schemaVersion": 99, "students": "not-an-array"}');
    expect(corruptSchema.bad).toBe(true);
    expect(corruptSchema.state).toBeNull();

    // Valid recovery from well-formed state
    const demo = makeDemoData();
    const validLoad = safeLoadAppState(JSON.stringify(demo));
    expect(validLoad.bad).toBe(false);
    expect(validLoad.state?.students.length).toBe(demo.students.length);

    // Revision restoration switches active revision deterministically
    const revision: PlanRevision = {
      ...generatePlan(demo, slotsFor(demo)[0].id),
      id: 'REV-099',
      createdAt: '2026-10-09T00:00:00.000Z',
      changeDescription: 'Test Revision',
    };
    const stateWithRev = { ...demo, revisions: [revision], currentRevisionId: null };
    const restored = restoreRevision(stateWithRev, 'REV-099');
    expect(restored.currentRevisionId).toBe('REV-099');
  });

  // 11. Plain-English explainability logs
  it('11. Plain-English explainability logs: generates human rationale for Pigeonhole principle and room choice', () => {
    const s = makeDemoData();
    const slot = slotsFor(s)[0].id;
    const p = generatePlan(s, slot);

    expect(p.explanations).toBeDefined();
    expect(p.explanations!.length).toBeGreaterThan(0);

    const hasRuleSatisfied = p.explanations!.some(e => e.category === 'RULE_SATISFACTION');
    const hasRoomSelection = p.explanations!.some(e => e.category === 'ROOM_SELECTION');
    expect(hasRuleSatisfied).toBe(true);
    expect(hasRoomSelection).toBe(true);
  });

  // 12. Manual coordinator seat swap override
  it('12. Manual coordinator seat swap override: immediately revalidates integrity', () => {
    const s = makeDemoData();
    const slot = slotsFor(s)[0].id;
    const p = generatePlan(s, slot);
    const a1 = p.assignments[0];
    const a2 = p.assignments[1];

    const swapped = swapSeats(
      s,
      p,
      { roomId: a1.roomId, row: a1.row, column: a1.column },
      { roomId: a2.roomId, row: a2.row, column: a2.column }
    );

    expect(swapped.assignments.length).toBe(p.assignments.length);
    const newA1 = swapped.assignments.find(a => a.studentId === a1.studentId)!;
    expect(newA1.row).toBe(a2.row);
    expect(newA1.column).toBe(a2.column);
    expect(swapped.validation.checks.every(c => !c.name.startsWith('H1') || c.passed)).toBe(true);
  });

  // 13. High-scale synthetic stress benchmarking
  it('13. High-scale synthetic stress benchmarking: computes 200+ student plan in milliseconds', () => {
    const stressState = generateStressScenario(200, 5);
    const slots = slotsFor(stressState);
    expect(slots.length).toBe(1);

    const t0 = performance.now();
    const plan = generatePlan(stressState, slots[0].id);
    const elapsed = performance.now() - t0;

    expect(plan.assignments.length).toBe(200);
    expect(elapsed).toBeLessThan(1000); // Super fast execution under 1 second
  });
});
