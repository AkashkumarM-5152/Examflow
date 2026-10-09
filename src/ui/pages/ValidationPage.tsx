import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  DoorOpen,
  Info,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Users,
  XCircle,
} from 'lucide-react';
import type { AppState, PlanRevision } from '../../engine/types';
import { adjacent } from '../../engine/engine';

interface ValidationPageProps {
  state: AppState;
  current: PlanRevision | null;
  onRevalidate: () => void;
  onGoToPlanner: () => void;
}

export const ValidationPage: React.FC<ValidationPageProps> = ({
  state,
  current,
  onRevalidate,
  onGoToPlanner,
}) => {
  // Find clashing adjacent pairs (S1)
  const clashingPairs: {
    roomName: string;
    subjectCode: string;
    student1: { usn: string; name: string; seat: string };
    student2: { usn: string; name: string; seat: string };
  }[] = [];

  if (current) {
    const assignments = current.assignments;
    for (let i = 0; i < assignments.length; i++) {
      for (let j = i + 1; j < assignments.length; j++) {
        const a = assignments[i];
        const b = assignments[j];
        if (
          a.roomId === b.roomId &&
          a.sessionId === b.sessionId &&
          adjacent(a, b)
        ) {
          const room = state.rooms.find(r => r.id === a.roomId);
          const session = state.sessions.find(s => s.id === a.sessionId);
          const subject = state.subjects.find(sub => sub.id === session?.subjectId);
          const st1 = state.students.find(s => s.id === a.studentId);
          const st2 = state.students.find(s => s.id === b.studentId);
          clashingPairs.push({
            roomName: room?.name ?? a.roomId,
            subjectCode: subject?.code ?? '—',
            student1: {
              usn: st1?.usn ?? a.studentId,
              name: st1?.name ?? '',
              seat: `R${a.row} C${a.column}`,
            },
            student2: {
              usn: st2?.usn ?? b.studentId,
              name: st2?.name ?? '',
              seat: `R${b.row} C${b.column}`,
            },
          });
        }
      }
    }
  }

  return (
    <div className="validation-container">
      {/* Overall Integrity Banner */}
      <div className="validation-summary panel">
        <div
          className={`large-status ${
            current?.validation.status === 'VALID'
              ? 'green'
              : current?.validation.status === 'VALID_WITH_WARNINGS'
              ? 'amber'
              : 'red'
          }`}
        >
          {current?.validation.status === 'VALID' ? (
            <ShieldCheck size={28} />
          ) : current?.validation.status === 'VALID_WITH_WARNINGS' ? (
            <ShieldAlert size={28} />
          ) : (
            <XCircle size={28} />
          )}
        </div>

        <div className="summary-copy">
          <span className="summary-label">INDEPENDENT VALIDATOR STATUS</span>
          <h2>{current ? current.validation.status.replaceAll('_', ' ') : 'Not Validated'}</h2>
          <p>
            {current
              ? `Derived independently from ${current.validation.hardViolations.length} hard violations, ${current.validation.softViolations.length} soft warnings, ${current.unassigned.length} unassigned candidates, and ${current.uncovered.length} uncovered halls.`
              : 'Generate a plan in the planner to trigger automated independent constraint verification.'}
          </p>
        </div>

        <button className="btn btn-secondary" disabled={!current} onClick={onRevalidate}>
          <RefreshCw size={14} /> Run Independent Re-Validation
        </button>
      </div>

      {current && (
        <>
          {/* Individual Constraint Checklist (H1 - H8 and S1) */}
          <section className="panel">
            <div className="panel-title">
              <div>
                <h2>Independent Constraint Suite (H1–H8 & S1)</h2>
                <p>Pure mathematical checks recomputed from raw assignments, not copied from generator.</p>
              </div>
            </div>

            <div className="checks-list">
              {current.validation.checks.map(c => (
                <div className="check-row" key={c.name}>
                  <div className={`check-icon ${c.passed ? 'pass' : 'fail'}`}>
                    {c.passed ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                  </div>

                  <div className="check-copy">
                    <b>{c.name}</b>
                    <span>{c.detail}</span>
                  </div>

                  <div className="check-count">
                    <b>{c.count}</b>
                    <span className={c.passed ? 'text-ok' : 'text-issue'}>
                      {c.passed ? 'PASSED' : 'ISSUE'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Offending Seat Pairs Drilldown (Rule S1) */}
          {clashingPairs.length > 0 && (
            <section className="panel clashing-pairs-panel" style={{ marginTop: '16px' }}>
              <div className="panel-title">
                <div>
                  <h2>Soft Constraint Offending Pairs (Rule S1 Adjacency Drilldown)</h2>
                  <p>
                    Edge-adjacent seats occupied by candidates sitting the same subject. Diagonals do not count.
                  </p>
                </div>
                <button className="text-btn" onClick={onGoToPlanner}>
                  Jump to Seating Grid →
                </button>
              </div>

              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Exam Hall</th>
                      <th>Subject Code</th>
                      <th>Candidate 1</th>
                      <th>Seat Coordinate 1</th>
                      <th>Candidate 2</th>
                      <th>Seat Coordinate 2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clashingPairs.map((p, idx) => (
                      <tr key={idx}>
                        <td><b>Hall {p.roomName}</b></td>
                        <td><span className="mini-pill">{p.subjectCode}</span></td>
                        <td>
                          <b className="mono">{p.student1.usn}</b> ({p.student1.name})
                        </td>
                        <td><span className="coord-badge">{p.student1.seat}</span></td>
                        <td>
                          <b className="mono">{p.student2.usn}</b> ({p.student2.name})
                        </td>
                        <td><span className="coord-badge">{p.student2.seat}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Unassigned Registrations & Uncovered Rooms */}
          <div className="two-panels">
            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2>Unassigned Candidates ({current.unassigned.length})</h2>
                  <p>Every unassigned candidate carries an explicit, documented reason.</p>
                </div>
              </div>

              <div className="exception-list">
                {current.unassigned.length > 0 ? (
                  current.unassigned.map((u, i) => {
                    const student = state.students.find(s => s.id === u.studentId);
                    return (
                      <div className="exception-row" key={i}>
                        <AlertTriangle size={15} />
                        <div>
                          <b>
                            {student?.usn ?? u.studentId} · {student?.name}
                          </b>
                          <span>
                            <span className="mini-pill warning">{u.reason}</span> {u.detail}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="muted-pad">All registered candidates are successfully assigned to seats.</p>
                )}
              </div>
            </section>

            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2>Uncovered Exam Halls ({current.uncovered.length})</h2>
                  <p>Active halls lacking required invigilator staffing coverage.</p>
                </div>
              </div>

              <div className="exception-list">
                {current.uncovered.length > 0 ? (
                  current.uncovered.map(u => {
                    const room = state.rooms.find(r => r.id === u.roomId);
                    return (
                      <div className="exception-row" key={u.roomId}>
                        <Users size={15} />
                        <div>
                          <b>
                            Hall {room?.name ?? u.roomId} ({room?.building})
                          </b>
                          <span>
                            Assigned {u.assigned} of {u.required} required staff. {u.reason}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="muted-pad">All used halls have 100% required invigilation coverage.</p>
                )}
              </div>
            </section>
          </div>

          {/* Suggested Corrective Actions */}
          {current.validation.suggestedActions.length > 0 && (
            <section className="panel" style={{ marginTop: '16px' }}>
              <div className="panel-title">
                <div>
                  <h2>Recommended Corrective Actions</h2>
                  <p>Specific operational interventions to resolve flagged issues.</p>
                </div>
              </div>

              <ul className="action-list">
                {current.validation.suggestedActions.map((action, i) => (
                  <li key={i}>{action}</li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
};
