import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  DoorOpen,
  Eye,
  EyeOff,
  Flame,
  HelpCircle,
  Info,
  Layers,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
  Zap,
} from 'lucide-react';
import type { AppState, Plan, PlanRevision, Room, SeatingAssignment } from '../../engine/types';
import { adjacent, slotsFor, usable } from '../../engine/engine';
import { SeatInspectorModal } from '../components/SeatInspectorModal';

interface PlannerPageProps {
  state: AppState;
  current: PlanRevision | null;
  slotId: string;
  setSlotId: (id: string) => void;
  onGenerate: () => void;
  onRevalidate: () => void;
  onSwapSeats: (
    seatA: { roomId: string; row: number; column: number },
    seatB: { roomId: string; row: number; column: number }
  ) => void;
  onGoToDisruptionStudio: () => void;
  onPrintHall: (roomId?: string) => void;
}

export const PlannerPage: React.FC<PlannerPageProps> = ({
  state,
  current,
  slotId,
  setSlotId,
  onGenerate,
  onRevalidate,
  onSwapSeats,
  onGoToDisruptionStudio,
  onPrintHall,
}) => {
  const slots = slotsFor(state);
  const activeSlot = slots.find(s => s.id === slotId) ?? slots[0];
  const activeSessionIds = activeSlot?.sessions ?? [];
  const slotRegistrations = state.registrations.filter(r => activeSessionIds.includes(r.sessionId));
  const uniqueDemand = new Set(slotRegistrations.map(r => r.studentId)).size;

  const totalUsableSeats = state.rooms
    .filter(r => r.status === 'active')
    .reduce((n, r) => n + usable(r), 0);

  const [activeRoomTab, setActiveRoomTab] = useState<string>('all');
  const [highlightClashes, setHighlightClashes] = useState(true);
  const [swapMode, setSwapMode] = useState(false);
  const [swapSeatA, setSwapSeatA] = useState<{ roomId: string; row: number; column: number } | null>(null);

  // Search filter across seats
  const [assignmentSearch, setAssignmentSearch] = useState('');

  // Selected seat for detail panel / modal (accessible alternative to hover)
  const [selectedSeat, setSelectedSeat] = useState<{ roomId: string; row: number; column: number } | null>(null);
  const [inspectModalOpen, setInspectModalOpen] = useState(false);

  // Calculate clashing seat coordinates
  const clashingSeatKeys = new Set<string>();
  if (current) {
    for (let i = 0; i < current.assignments.length; i++) {
      for (let j = i + 1; j < current.assignments.length; j++) {
        const a = current.assignments[i];
        const b = current.assignments[j];
        if (
          a.roomId === b.roomId &&
          a.sessionId === b.sessionId &&
          adjacent(a, b)
        ) {
          clashingSeatKeys.add(`${a.roomId}:${a.row}:${a.column}`);
          clashingSeatKeys.add(`${b.roomId}:${b.row}:${b.column}`);
        }
      }
    }
  }

  // Active rooms in use
  const activeRooms = state.rooms.filter(
    r => (current?.assignments.some(a => a.roomId === r.id) || r.status !== 'active')
  );

  const handleSeatClick = (roomId: string, row: number, column: number) => {
    if (swapMode) {
      if (!swapSeatA) {
        setSwapSeatA({ roomId, row, column });
      } else {
        if (swapSeatA.roomId === roomId && swapSeatA.row === row && swapSeatA.column === column) {
          setSwapSeatA(null);
        } else {
          onSwapSeats(swapSeatA, { roomId, row, column });
          setSwapSeatA(null);
        }
      }
    } else {
      setSelectedSeat({ roomId, row, column });
      setInspectModalOpen(true);
    }
  };

  // Check if seat matches search query
  const seatMatchesSearch = (roomId: string, row: number, column: number) => {
    if (!assignmentSearch.trim() || !current) return false;
    const q = assignmentSearch.toLowerCase();
    const assignment = current.assignments.find(a => a.roomId === roomId && a.row === row && a.column === column);
    if (!assignment) return false;
    const student = state.students.find(s => s.id === assignment.studentId);
    const session = state.sessions.find(x => x.id === assignment.sessionId);
    const subject = session ? state.subjects.find(sub => sub.id === session.subjectId) : null;
    const room = state.rooms.find(r => r.id === roomId);

    return (
      student?.usn.toLowerCase().includes(q) ||
      student?.name.toLowerCase().includes(q) ||
      subject?.code.toLowerCase().includes(q) ||
      room?.name.toLowerCase().includes(q)
    );
  };

  return (
    <div className="planner-container">
      {/* Pre-generation Demand vs Usable Capacity Summary */}
      <div className="planner-controls panel">
        <div className="control-field">
          <label>EXAMINATION PLANNING SLOT</label>
          <select value={slotId} onChange={e => setSlotId(e.target.value)}>
            {slots.map((s, i) => (
              <option key={s.id} value={s.id}>
                Slot {i + 1} · {s.date} ({s.start}–{s.end}) · {s.sessions.length} sessions
              </option>
            ))}
          </select>
        </div>

        <div className="demand-chip">
          <span>Candidate Demand</span>
          <b>{uniqueDemand}</b>
        </div>

        <div className="demand-chip">
          <span>Usable Hall Desks</span>
          <b>{totalUsableSeats}</b>
        </div>

        <div className="demand-chip">
          <span>Capacity Buffer</span>
          <b style={{ color: totalUsableSeats >= uniqueDemand ? 'var(--green)' : 'var(--red)' }}>
            {totalUsableSeats >= uniqueDemand
              ? `+${Math.round(((totalUsableSeats - uniqueDemand) / Math.max(1, uniqueDemand)) * 100)}%`
              : 'DEFICIT'}
          </b>
        </div>

        <div className="button-group">
          <button className="btn btn-primary" onClick={onGenerate}>
            <Zap size={15} /> Generate Plan
          </button>
          <button className="btn btn-secondary" disabled={!current} onClick={onRevalidate}>
            <RefreshCw size={14} /> Re-validate
          </button>
        </div>
      </div>

      {current ? (
        <>
          {/* Plan Result Summary Strip */}
          <div
            className={`result-strip ${
              current.validation.status === 'VALID'
                ? 'valid'
                : current.validation.status === 'VALID_WITH_WARNINGS'
                ? 'warning'
                : 'invalid'
            }`}
          >
            <div className="result-icon">
              {current.validation.status === 'VALID' ? (
                <CheckCircle2 size={20} />
              ) : current.validation.status === 'VALID_WITH_WARNINGS' ? (
                <AlertTriangle size={20} />
              ) : (
                <AlertTriangle size={20} />
              )}
            </div>

            <div>
              <div className="result-title-row">
                <b>Plan Status: {current.validation.status.replaceAll('_', ' ')}</b>
              </div>
              <span>
                {current.assignments.length} seated · {current.unassigned.length} unassigned ·{' '}
                {current.uncovered.length} uncovered halls ·{' '}
                {clashingSeatKeys.size / 2} adjacent same-subject pair(s)
              </span>
            </div>

            <div className="result-meta">
              <span>GENERATION TIME</span>
              <b>{current.computeMs} ms</b>
            </div>

            <button className="btn btn-secondary btn-sm" onClick={onGoToDisruptionStudio}>
              <RefreshCw size={13} /> Disruption Replan Studio →
            </button>
          </div>

          {/* Interactive Workspace Toolbar */}
          <div className="visualizer-toolbar">
            <div className="toolbar-left">
              <span className="toolbar-label">Room View:</span>
              <button
                className={`tab-chip ${activeRoomTab === 'all' ? 'active' : ''}`}
                onClick={() => setActiveRoomTab('all')}
              >
                All Active Halls ({activeRooms.length})
              </button>
              {activeRooms.map(r => (
                <button
                  key={r.id}
                  className={`tab-chip ${activeRoomTab === r.id ? 'active' : ''}`}
                  onClick={() => setActiveRoomTab(r.id)}
                >
                  {r.name}
                </button>
              ))}
            </div>

            <div className="toolbar-right">
              {/* Assignment Search Input */}
              <div className="search-field-planner">
                <Search size={14} className="text-muted" />
                <input
                  placeholder="Search USN, student, subject..."
                  value={assignmentSearch}
                  onChange={e => setAssignmentSearch(e.target.value)}
                />
                {assignmentSearch && (
                  <button className="icon-btn-inline" onClick={() => setAssignmentSearch('')}>
                    <X size={12} />
                  </button>
                )}
              </div>

              <button
                className={`btn btn-secondary ${highlightClashes ? 'active-toggle' : ''}`}
                onClick={() => setHighlightClashes(!highlightClashes)}
                title="Highlight edge-adjacent same-subject seats with pulsing red outline"
              >
                {highlightClashes ? <Flame size={14} className="text-warn" /> : <EyeOff size={14} />}
                {highlightClashes ? 'Highlight Clashes: ON' : 'Highlight Clashes: OFF'}
              </button>

              <button
                className={`btn btn-secondary ${swapMode ? 'active-swap-mode' : ''}`}
                onClick={() => {
                  setSwapMode(!swapMode);
                  setSwapSeatA(null);
                }}
                title="Click two seats to swap students with instant sub-millisecond revalidation"
              >
                <ArrowRightLeft size={14} />
                {swapMode ? (swapSeatA ? 'Click Target Seat...' : 'Swap Mode: Active') : 'Manual Swap Mode'}
              </button>

              <button
                className="btn btn-secondary"
                onClick={() => onPrintHall(activeRoomTab === 'all' ? undefined : activeRoomTab)}
              >
                <Printer size={14} /> Print Room Charts
              </button>
            </div>
          </div>

          {swapMode && (
            <div className="swap-instruction-banner">
              <Info size={16} />
              <span>
                {swapSeatA
                  ? `Seat Selected: Hall ${swapSeatA.roomId} [R${swapSeatA.row} C${swapSeatA.column}]. Now click any other seat (or vacant desk) to swap candidates!`
                  : 'Manual Coordinator Override: Click any seat to pick it, then click another seat to execute swap. Integrity re-validated immediately!'}
              </span>
              {swapSeatA && (
                <button className="text-btn text-white" onClick={() => setSwapSeatA(null)}>
                  Cancel Selection
                </button>
              )}
            </div>
          )}

          {/* Academic Subtle Subject Legend */}
          <div className="legend-row">
            <span><i className="seat-dot sub1" /> MATH101 (Mathematics)</span>
            <span><i className="seat-dot sub2" /> PHY101 (Physics)</span>
            <span><i className="seat-dot sub3" /> CHE101 (Chemistry)</span>
            <span><i className="seat-dot sub4" /> ENG101 (English)</span>
            <span><i className="seat-dot empty" /> Vacant Desk</span>
            <span><i className="seat-dot blocked" /> Blocked / Inactive</span>
            {highlightClashes && (
              <span className="clash-legend-item">
                <i className="seat-dot clash-pulse" /> ⚠️ Same-Subject Edge Adjacent (Rule S1)
              </span>
            )}
          </div>

          {/* Room Seating Grid Layout */}
          <div className="room-grid">
            {activeRooms
              .filter(r => activeRoomTab === 'all' || r.id === activeRoomTab)
              .map(room => {
                const roomAssignments = current.assignments.filter(a => a.roomId === room.id);
                const cap = usable(room);
                const roomInvigilators = current.invigilatorAssignments
                  .filter(a => a.roomId === room.id)
                  .map(a => state.invigilators.find(i => i.id === a.invigilatorId)?.name)
                  .filter(Boolean);

                return (
                  <section className="panel room-card" key={room.id}>
                    <div className="room-card-head">
                      <div>
                        <div className="room-name">
                          <DoorOpen size={16} />
                          <b>Hall {room.name}</b>
                          {room.status !== 'active' && (
                            <span className="mini-pill danger">{room.status.toUpperCase()}</span>
                          )}
                        </div>
                        <span>
                          {room.building} · Grid: {room.rows} rows × {room.columns} cols
                        </span>
                      </div>

                      <div className="room-occupancy">
                        <b>{roomAssignments.length}</b>
                        <span>/ {cap} seats ({cap > 0 ? Math.round((roomAssignments.length / cap) * 100) : 0}%)</span>
                      </div>
                    </div>

                    <div className="seat-grid-wrap">
                      <div
                        className="seat-grid"
                        style={{ gridTemplateColumns: `repeat(${room.columns}, minmax(36px, 1fr))` }}
                      >
                        {Array.from({ length: room.rows * room.columns }, (_, idx) => {
                          const row = Math.floor(idx / room.columns) + 1;
                          const col = (idx % room.columns) + 1;
                          const isBlocked = idx >= cap || room.status !== 'active';
                          const assignment = roomAssignments.find(a => a.row === row && a.column === col);
                          const student = assignment ? state.students.find(s => s.id === assignment.studentId) : null;
                          const session = assignment ? state.sessions.find(x => x.id === assignment.sessionId) : null;
                          const subject = session ? state.subjects.find(s => s.id === session.subjectId) : null;

                          const seatKey = `${room.id}:${row}:${col}`;
                          const isClashing = highlightClashes && clashingSeatKeys.has(seatKey);
                          const isSwapSelected =
                            swapSeatA &&
                            swapSeatA.roomId === room.id &&
                            swapSeatA.row === row &&
                            swapSeatA.column === col;
                          const isSearchMatch = seatMatchesSearch(room.id, row, col);

                          let colorClass = 'empty';
                          if (isBlocked) colorClass = 'blocked';
                          else if (assignment && subject) {
                            if (subject.code.startsWith('MATH')) colorClass = 'filled sub1';
                            else if (subject.code.startsWith('PHY')) colorClass = 'filled sub2';
                            else if (subject.code.startsWith('CHE')) colorClass = 'filled sub3';
                            else colorClass = 'filled sub4';
                          }

                          return (
                            <button
                              key={idx}
                              type="button"
                              className={`seat ${colorClass} ${isClashing ? 'clash-glow' : ''} ${
                                isSwapSelected ? 'swap-selected' : ''
                              } ${isSearchMatch ? 'search-match' : ''}`}
                              onClick={() => handleSeatClick(room.id, row, col)}
                              title={
                                isBlocked
                                  ? 'Blocked / unavailable seat'
                                  : student
                                  ? `${student.name} (${student.usn}) · ${subject?.code} · Row ${row}, Col ${col}${
                                      isClashing ? ' [⚠️ SAME SUBJECT ADJACENT]' : ''
                                    }`
                                  : `Row ${row}, Col ${col} · Vacant Desk`
                              }
                            >
                              {isBlocked ? (
                                <X size={11} />
                              ) : student ? (
                                <div className="seat-content">
                                  <span className="seat-usn">{student.usn.slice(-4)}</span>
                                  <span className="seat-sub">{subject?.code?.slice(0, 3)}</span>
                                </div>
                              ) : (
                                <span className="seat-coord">{row}.{col}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="room-card-foot">
                      <div className="staff-roster-tag">
                        <Users size={13} />
                        <span>
                          {roomInvigilators.length > 0
                            ? `Supervising: ${roomInvigilators.join(', ')}`
                            : '⚠️ Uncovered hall (No staff)'}
                        </span>
                      </div>
                      <span className="small-status">
                        {roomAssignments.length > 0 ? 'Active Examination' : 'Vacant Hall'}
                      </span>
                    </div>
                  </section>
                );
              })}
          </div>

          {/* Explainability Engine & Decision Trail */}
          <section className="panel explainability-panel">
            <div className="panel-title">
              <div>
                <div className="explain-badge">
                  <Sparkles size={13} /> EXPLAINABILITY ENGINE & DECISION AUDIT
                </div>
                <h2>Rule Explainability & Algorithmic Rationale</h2>
                <p>
                  ExamFlow details every trade-off, room selection reason, and plainly proves any bent rule with mathematical justifications.
                </p>
              </div>
            </div>

            <div className="explanations-grid">
              {(current.explanations ?? current.validation.explanations ?? []).map(exp => (
                <div key={exp.id} className={`exp-card ${exp.severity}`}>
                  <div className="exp-card-header">
                    <div className="exp-icon">
                      {exp.severity === 'success' ? (
                        <CheckCircle2 size={15} />
                      ) : exp.severity === 'warning' ? (
                        <AlertTriangle size={15} />
                      ) : (
                        <Info size={15} />
                      )}
                    </div>
                    <strong>{exp.title}</strong>
                    {exp.metric && <span className="exp-metric">{exp.metric}</span>}
                  </div>
                  <p className="exp-body">{exp.explanation}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <div className="panel empty-panel-pad">
          <CheckCircle2 size={30} className="text-muted" />
          <h3>No Seating Plan Generated for This Slot</h3>
          <p>Click "Generate Plan" above to seat students according to hard rules and checkerboard parity.</p>
        </div>
      )}

      {/* Seat Inspector Modal (Accessible alternative to hover-only) */}
      {inspectModalOpen && selectedSeat && current && (
        <SeatInspectorModal
          roomId={selectedSeat.roomId}
          row={selectedSeat.row}
          column={selectedSeat.column}
          state={state}
          plan={current}
          onClose={() => setInspectModalOpen(false)}
          onSelectForSwap={seat => {
            setSwapMode(true);
            setSwapSeatA(seat);
          }}
        />
      )}
    </div>
  );
};
