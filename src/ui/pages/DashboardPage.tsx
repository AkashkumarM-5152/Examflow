import React from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock,
  DoorOpen,
  GraduationCap,
  History,
  Layers,
  Printer,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  Zap,
} from 'lucide-react';
import type { AppState, PlanRevision } from '../../engine/types';
import { slotsFor, usable } from '../../engine/engine';
import type { Page } from '../types';

interface DashboardPageProps {
  state: AppState;
  current: PlanRevision | null;
  slotId: string;
  setSlotId: (id: string) => void;
  setPage: (page: Page) => void;
  onGenerate: () => void;
  onResetDemo: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  state,
  current,
  slotId,
  setSlotId,
  setPage,
  onGenerate,
  onResetDemo,
}) => {
  const slots = slotsFor(state);
  const activeSlot = slots.find(s => s.id === slotId) ?? slots[0];
  const activeSessionIds = activeSlot?.sessions ?? [];
  const slotRegistrations = state.registrations.filter(r => activeSessionIds.includes(r.sessionId));
  const uniqueDemand = new Set(slotRegistrations.map(r => r.studentId)).size;

  const totalSeats = state.rooms
    .filter(r => r.status === 'active')
    .reduce((n, r) => n + usable(r), 0);

  const availableStaff = state.invigilators.filter(
    i => i.status === 'active' && !i.unavailableSessionIds.some(id => activeSessionIds.includes(id))
  ).length;

  const assignedCount = current?.assignments.length ?? 0;
  const unassignedCount = current?.unassigned.length ?? 0;
  const overallUtilization = totalSeats > 0 ? Math.round((assignedCount / totalSeats) * 100) : 0;
  const hardViolations = current?.validation.hardViolations.length ?? 0;
  const softViolations = current?.validation.softViolations.length ?? 0;

  // Unresolved issues list
  const clashes = current?.unassigned.filter(u => u.reason === 'EXAM_CLASH') ?? [];
  const capacityShortages = current?.unassigned.filter(u => u.reason === 'NO_CAPACITY' || u.reason === 'NO_ROOM') ?? [];
  const uncoveredHalls = current?.uncovered ?? [];

  return (
    <div className="dashboard-container">
      {/* Real-time Status Banner */}
      <div className="status-banner">
        <div
          className={`status-symbol ${
            current && ['VALID', 'VALID_WITH_WARNINGS'].includes(current.validation.status)
              ? 'good'
              : current && ['INVALID', 'INFEASIBLE'].includes(current.validation.status)
              ? 'bad'
              : ''
          }`}
        >
          {current?.validation.status === 'VALID' ? (
            <ShieldCheck size={22} />
          ) : current?.validation.status === 'VALID_WITH_WARNINGS' ? (
            <AlertTriangle size={22} />
          ) : (
            <Activity size={22} />
          )}
        </div>

        <div className="status-copy">
          <div className="status-header-row">
            <strong>
              {current
                ? `Active Plan Status: ${current.validation.status.replaceAll('_', ' ')}`
                : 'No Seating Plan Generated for Current Slot'}
            </strong>
            {current && (
              <span className="compute-pill">
                <Clock size={11} /> {current.computeMs} ms
              </span>
            )}
          </div>
          <span>
            {current
              ? `${assignedCount} students seated · ${unassignedCount} unassigned · ${uncoveredHalls.length} uncovered rooms · computed at ${new Date(
                  current.createdAt
                ).toLocaleTimeString()}`
              : 'Configure student rosters, halls, and invigilator availability, then generate an optimal plan.'}
          </span>
        </div>

        <div className="heading-actions">
          {current ? (
            <button className="btn btn-primary" onClick={() => setPage('Planner')}>
              Open Seating Planner <ArrowRight size={14} />
            </button>
          ) : (
            <button className="btn btn-primary" onClick={onGenerate}>
              <Zap size={14} /> Generate Plan Now
            </button>
          )}
        </div>
      </div>

      {/* KPI Operations Cards */}
      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-icon forest"><GraduationCap size={18} /></div>
          <div className="metric-label">REGISTERED CANDIDATES</div>
          <div className="metric-value">{state.students.length}</div>
          <div className="metric-note">{state.registrations.length} course registrations across university</div>
        </div>

        <div className="metric-card">
          <div className="metric-icon emerald"><BookOpen size={18} /></div>
          <div className="metric-label">EXAM SUBJECTS</div>
          <div className="metric-value">{state.subjects.length}</div>
          <div className="metric-note">{state.sessions.length} scheduled exam sessions</div>
        </div>

        <div className="metric-card">
          <div className="metric-icon gold"><DoorOpen size={18} /></div>
          <div className="metric-label">USABLE CAPACITY</div>
          <div className="metric-value">{totalSeats}</div>
          <div className="metric-note">
            {state.rooms.filter(r => r.status === 'active').length} active halls ({overallUtilization}% utilized)
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon dark"><Users size={18} /></div>
          <div className="metric-label">AVAILABLE FACULTY</div>
          <div className="metric-value">{availableStaff}</div>
          <div className="metric-note">{state.invigilators.length} total staff in supervisory roster</div>
        </div>
      </div>

      {/* Operational Demand vs Capacity & Room Utilisation Visualisation */}
      <div className="dashboard-grid">
        {/* Capacity Demand Analysis */}
        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>Demand vs. Usable Capacity (Slot 1)</h2>
              <p>Physical desk supply against enrolled candidate demand.</p>
            </div>
            <span className="mini-pill success">
              {totalSeats >= uniqueDemand ? 'Surplus Capacity' : 'Capacity Deficit'}
            </span>
          </div>

          <div className="capacity-visual-panel">
            <div className="capacity-bars-wrap">
              <div className="cap-bar-row">
                <span className="cap-bar-label">Candidate Demand</span>
                <div className="cap-bar-track">
                  <div
                    className="cap-bar-fill assigned"
                    style={{
                      width: `${Math.min(100, (uniqueDemand / Math.max(1, totalSeats)) * 100)}%`,
                    }}
                  />
                </div>
                <span className="cap-bar-val">{uniqueDemand}</span>
              </div>

              <div className="cap-bar-row">
                <span className="cap-bar-label">Usable Hall Desks</span>
                <div className="cap-bar-track">
                  <div className="cap-bar-fill capacity" style={{ width: '100%' }} />
                </div>
                <span className="cap-bar-val">{totalSeats}</span>
              </div>

              {current && (
                <div className="cap-bar-row">
                  <span className="cap-bar-label">Seated in Current Plan</span>
                  <div className="cap-bar-track">
                    <div
                      className="cap-bar-fill assigned"
                      style={{
                        width: `${Math.min(100, (assignedCount / Math.max(1, totalSeats)) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="cap-bar-val">{assignedCount}</span>
                </div>
              )}
            </div>

            {/* Individual Room Utilisation Bars */}
            <div className="room-util-list">
              <span className="eyebrow">Individual Room Occupancy:</span>
              <div className="cap-bar-row">
                {state.rooms.map(room => {
                  const cap = usable(room);
                  const seated = current?.assignments.filter(a => a.roomId === room.id).length ?? 0;
                  const pct = cap > 0 ? Math.round((seated / cap) * 100) : 0;
                  return (
                    <div key={room.id} className="room-mini-bar" style={{ flex: 1, minWidth: '90px' }}>
                      <div className="room-mini-head">
                        <b>{room.name}</b>
                        <span>{seated}/{cap} ({pct}%)</span>
                      </div>
                      <div className="cap-bar-track" style={{ height: '7px' }}>
                        <div
                          className="cap-bar-fill assigned"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Planning Readiness & Actionable Signals */}
        <section className="panel readiness-panel">
          <div className="panel-title">
            <div>
              <h2>Examination Morning Readiness</h2>
              <p>Integrity signals that require coordinator attention.</p>
            </div>
          </div>

          <div className="readiness-list">
            <div className="readiness-row">
              <CheckCircle2 size={16} className={totalSeats >= uniqueDemand ? 'icon-good' : 'icon-warn'} />
              <div>
                <b>Hall Capacity Buffer</b>
                <span>
                  {totalSeats} usable desks configured for {uniqueDemand} unique candidates ({totalSeats - uniqueDemand >= 0 ? `+${totalSeats - uniqueDemand} surplus` : `${totalSeats - uniqueDemand} short`})
                </span>
              </div>
              <span className={`readiness-state ${totalSeats >= uniqueDemand ? 'good' : 'warn'}`}>
                {totalSeats >= uniqueDemand ? 'ADEQUATE' : 'SHORTAGE'}
              </span>
            </div>

            <div className="readiness-row">
              <AlertTriangle size={16} className={clashes.length === 0 ? 'icon-good' : 'icon-warn'} />
              <div>
                <b>Session Registration Clashes</b>
                <span>
                  {clashes.length > 0
                    ? `${clashes.length} candidate(s) enrolled in concurrent exams; primary scheduled, secondary isolated`
                    : 'Zero concurrent exam clashes detected'}
                </span>
              </div>
              <span className={`readiness-state ${clashes.length === 0 ? 'good' : 'warn'}`}>
                {clashes.length === 0 ? 'NO CLASH' : 'ISOLATED'}
              </span>
            </div>

            <div className="readiness-row">
              <Users size={16} className={uncoveredHalls.length === 0 ? 'icon-good' : 'icon-warn'} />
              <div>
                <b>Invigilation Staff Coverage</b>
                <span>
                  {uncoveredHalls.length > 0
                    ? `${uncoveredHalls.length} room(s) require staff roster allocations`
                    : `${availableStaff} faculty members available to supervise`}
                </span>
              </div>
              <span className={`readiness-state ${uncoveredHalls.length === 0 ? 'good' : 'warn'}`}>
                {uncoveredHalls.length === 0 ? 'STAFFED' : 'SHORTAGE'}
              </span>
            </div>

            <div className="readiness-row">
              <ShieldCheck size={16} className={hardViolations === 0 ? 'icon-good' : 'icon-warn'} />
              <div>
                <b>Hard Constraint Verification</b>
                <span>
                  {hardViolations === 0
                    ? `All 8 physical hard constraints satisfied (${softViolations} soft adjacency warning(s))`
                    : `${hardViolations} hard rule violation(s) require intervention`}
                </span>
              </div>
              <span className={`readiness-state ${hardViolations === 0 ? 'good' : 'warn'}`}>
                {hardViolations === 0 ? 'VALID' : 'VIOLATIONS'}
              </span>
            </div>
          </div>

          <div className="readiness-foot">
            <span className="legend-dot amber" />
            <span>Violations are surfaced plainly; invalid plans are never marked valid.</span>
          </div>
        </section>
      </div>

      {/* Slots Overview & Revision Activity Timeline */}
      <div className="dashboard-grid">
        {/* Planning Slots Selection */}
        <section className="panel overview-panel">
          <div className="panel-title">
            <div>
              <h2>Upcoming Planning Slots</h2>
              <p>Exam sessions with overlapping times clustered into operational planning slots.</p>
            </div>
            <span className="mini-pill">{slots.length} Active Slots</span>
          </div>

          <div className="slot-list">
            {slots.map((s, idx) => {
              const count = state.registrations.filter(r => s.sessions.includes(r.sessionId)).length;
              const uniqueCount = new Set(
                state.registrations.filter(r => s.sessions.includes(r.sessionId)).map(r => r.studentId)
              ).size;
              const isSelected = s.id === slotId;
              const subCodes = s.sessions
                .map(id => state.subjects.find(sub => sub.id === state.sessions.find(x => x.id === id)?.subjectId)?.code)
                .filter(Boolean)
                .join(', ');

              return (
                <button
                  key={s.id}
                  className={`slot-row ${isSelected ? 'slot-active' : ''}`}
                  onClick={() => setSlotId(s.id)}
                >
                  <div className="slot-date">
                    <b>{new Date(`${s.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}</b>
                    <span>{new Date(`${s.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                  </div>
                  <div className="slot-info">
                    <strong>
                      Slot {idx + 1}
                      <span className="mini-pill">{s.sessions.length} session{s.sessions.length > 1 ? 's' : ''}</span>
                    </strong>
                    <span>{s.start}–{s.end} · {subCodes}</span>
                  </div>
                  <div className="slot-demand">
                    <b>{uniqueCount}</b>
                    <span>candidates</span>
                  </div>
                  <span className="arrow">↗</span>
                </button>
              );
            })}
          </div>

          <div className="panel-footer">
            <span>Selected Slot: <b>{activeSlot?.date ?? '—'}</b> ({uniqueDemand} candidates)</span>
            <button className="text-btn" onClick={() => setPage('Subjects & Sessions')}>
              Manage Sessions & Slots →
            </button>
          </div>
        </section>

        {/* Real Activity / Revision History Timeline */}
        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>Recent Operations Timeline</h2>
              <p>Audited chronological log of plan generation and replanning events.</p>
            </div>
            <span className="mini-pill">{state.revisions.length} Revisions</span>
          </div>

          <div className="activity-timeline-list">
            {state.revisions.length > 0 ? (
              [...state.revisions].reverse().slice(0, 4).map(rev => (
                <div key={rev.id} className="timeline-item">
                  <div className="timeline-dot" />
                  <div className="timeline-content">
                    <div className="timeline-head">
                      <strong>{rev.changeDescription}</strong>
                      <span className="timeline-time">{new Date(rev.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <span className="timeline-meta">
                      {rev.id} · {rev.assignments.length} seated · {rev.validation.status} ({rev.computeMs} ms)
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-timeline-pad">
                <History size={20} className="text-muted" />
                <p>No revisions recorded yet. Generate a plan to begin operations audit.</p>
              </div>
            )}
          </div>

          <div className="panel-footer">
            <span>Local persistence schema v1</span>
            <button className="text-btn" onClick={() => setPage('Print & Notice Board')}>
              View Full Revision History →
            </button>
          </div>
        </section>
      </div>

      {/* Operational Quick Actions */}
      <section className="panel quick-panel">
        <div className="panel-title">
          <div>
            <h2>Operations Quick Launch</h2>
            <p>Immediate entry points for university examination officers.</p>
          </div>
        </div>

        <div className="quick-actions">
          <button className="quick-action" onClick={() => setPage('Planner')}>
            <div className="quick-icon"><SlidersHorizontal size={17} /></div>
            <div>
              <b>Interactive Seating Grid</b>
              <span>Visual room charts with live swap & clash glow.</span>
            </div>
            <span className="quick-arrow">↗</span>
          </button>

          <button className="quick-action" onClick={() => setPage('Disruption Studio')}>
            <div className="quick-icon"><RefreshCw size={17} /></div>
            <div>
              <b>Disruption Replan Studio</b>
              <span>Withdraw halls or staff with side-by-side diff.</span>
            </div>
            <span className="quick-arrow">↗</span>
          </button>

          <button className="quick-action" onClick={() => setPage('Validation')}>
            <div className="quick-icon"><ShieldCheck size={17} /></div>
            <div>
              <b>Constraint Verification</b>
              <span>Audit H1–H8 hard rules and S1 soft adjacency.</span>
            </div>
            <span className="quick-arrow">↗</span>
          </button>

          <button className="quick-action" onClick={() => setPage('Print & Notice Board')}>
            <div className="quick-icon"><Printer size={17} /></div>
            <div>
              <b>Notice Board Exports</b>
              <span>Master charts, classroom door slips, and CSVs.</span>
            </div>
            <span className="quick-arrow">↗</span>
          </button>

          <button className="quick-action" onClick={() => setPage('Stress Benchmark')}>
            <div className="quick-icon"><Zap size={17} /></div>
            <div>
              <b>Scalability Stress Test</b>
              <span>Simulate 500+ candidates in milliseconds.</span>
            </div>
            <span className="quick-arrow">↗</span>
          </button>
        </div>
      </section>
    </div>
  );
};
