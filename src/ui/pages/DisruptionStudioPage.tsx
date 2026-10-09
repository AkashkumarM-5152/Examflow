import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  DoorOpen,
  HelpCircle,
  History,
  Info,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
  XCircle,
  Zap,
} from 'lucide-react';
import type { AppState, Plan, PlanDiff, PlanRevision, Room } from '../../engine/types';
import { usable } from '../../engine/engine';

interface DisruptionStudioPageProps {
  state: AppState;
  current: PlanRevision | null;
  onReplan: (disruption: { type: any; id: string; capacity?: number }) => void;
  onAcceptPreview: () => void;
  onDiscardPreview: () => void;
  preview: { state: AppState; plan: Plan; diff: PlanDiff; before: PlanRevision } | null;
}

export const DisruptionStudioPage: React.FC<DisruptionStudioPageProps> = ({
  state,
  current,
  onReplan,
  onAcceptPreview,
  onDiscardPreview,
  preview,
}) => {
  const [disruptionType, setDisruptionType] = useState<
    'withdraw-room' | 'reduce-capacity' | 'invigilator-unavailable' | 'restore-room' | 'restore-invigilator'
  >('withdraw-room');
  const [targetId, setTargetId] = useState<string>('R1');
  const [capacityReduction, setCapacityReduction] = useState<string>('15');

  // Movement diff filtering
  const [diffFilter, setDiffFilter] = useState<'all' | 'moved' | 'unchanged' | 'newly_unassigned'>('moved');
  const [diffSearch, setDiffSearch] = useState('');

  // 1-Click Disaster Presets
  const handleApplyPreset = (preset: 'ac-failure' | 'faculty-absent' | 'water-leak' | 'infeasible') => {
    if (preset === 'ac-failure') {
      setDisruptionType('withdraw-room');
      setTargetId('R1');
      onReplan({ type: 'withdraw-room', id: 'R1' });
    } else if (preset === 'faculty-absent') {
      setDisruptionType('invigilator-unavailable');
      setTargetId('INV02');
      onReplan({ type: 'invigilator-unavailable', id: 'INV02' });
    } else if (preset === 'water-leak') {
      setDisruptionType('reduce-capacity');
      setTargetId('R3');
      setCapacityReduction('10');
      onReplan({ type: 'reduce-capacity', id: 'R3', capacity: 10 });
    } else if (preset === 'infeasible') {
      setDisruptionType('withdraw-room');
      setTargetId('R2');
      onReplan({ type: 'withdraw-room', id: 'R2' });
    }
  };

  // Calculate affected assignments *before* running replan (Step 2)
  const calculateAffectedPreview = () => {
    if (!current) return { count: 0, details: 'No active plan.' };

    if (disruptionType === 'withdraw-room') {
      const room = state.rooms.find(r => r.id === targetId);
      const affected = current.assignments.filter(a => a.roomId === targetId);
      return {
        count: affected.length,
        details: `Closing Hall ${room?.name ?? targetId} will displace ${affected.length} seated student(s).`,
      };
    } else if (disruptionType === 'reduce-capacity') {
      const room = state.rooms.find(r => r.id === targetId);
      const newCap = Number(capacityReduction);
      const colCount = room?.columns ?? 1;
      const affected = current.assignments.filter(
        a => a.roomId === targetId && (a.row - 1) * colCount + a.column > newCap
      );
      return {
        count: affected.length,
        details: `Capping Hall ${room?.name} to ${newCap} seats will displace ${affected.length} student(s) seated beyond row/column threshold.`,
      };
    } else if (disruptionType === 'invigilator-unavailable') {
      const inv = state.invigilators.find(i => i.id === targetId);
      const assignedRooms = current.invigilatorAssignments.filter(a => a.invigilatorId === targetId);
      return {
        count: assignedRooms.length,
        details: `Staff member ${inv?.name} is currently supervising ${assignedRooms.length} room(s). Replan will assign an eligible substitute.`,
      };
    } else {
      return {
        count: 0,
        details: `Restoring ${targetId} back to active university availability.`,
      };
    }
  };

  const affectedInfo = calculateAffectedPreview();

  const filteredMovements = (preview?.diff.movements ?? []).filter(m => {
    if (diffFilter !== 'all' && m.status !== diffFilter) return false;
    if (diffSearch.trim()) {
      const q = diffSearch.toLowerCase();
      return (
        m.usn.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        m.subjectCode.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="disruption-studio-container">
      {/* 6-Step Guided Workflow Tracker */}
      <div className="panel disruption-panel">
        <div className="panel-title">
          <div>
            <h2>Disruption & Fast Replanning Studio</h2>
            <p>
              Autonomous minimal-displacement replanner: keeps unaffected students frozen in their exact seats.
            </p>
          </div>
          {preview && (
            <span className="compute-pill">
              <Clock size={11} /> Replan computed in {preview.plan.computeMs} ms
            </span>
          )}
        </div>

        <div className="guided-steps-tracker">
          <div className="guide-step active">
            <span className="guide-step-num">1</span>
            <span>Select Disruption</span>
          </div>
          <span className="guide-step-arrow">→</span>

          <div className={`guide-step ${targetId ? 'active' : ''}`}>
            <span className="guide-step-num">2</span>
            <span>Preview Affected</span>
          </div>
          <span className="guide-step-arrow">→</span>

          <div className={`guide-step ${preview ? 'active' : ''}`}>
            <span className="guide-step-num">3</span>
            <span>Run Engine</span>
          </div>
          <span className="guide-step-arrow">→</span>

          <div className={`guide-step ${preview ? 'active' : ''}`}>
            <span className="guide-step-num">4</span>
            <span>Before / After Comparison</span>
          </div>
          <span className="guide-step-arrow">→</span>

          <div className={`guide-step ${preview ? 'active' : ''}`}>
            <span className="guide-step-num">5</span>
            <span>Decision Audit</span>
          </div>
          <span className="guide-step-arrow">→</span>

          <div className={`guide-step ${preview ? 'active' : ''}`}>
            <span className="guide-step-num">6</span>
            <span>Accept / Revert</span>
          </div>
        </div>

        {/* 1-Click Disaster Scenarios */}
        <div className="presets-container">
          <span className="presets-label">⚡ Exam Morning Presets:</span>
          <div className="preset-buttons">
            <button
              className="preset-btn"
              onClick={() => handleApplyPreset('ac-failure')}
              title="Hall A-101 AC Failure: Withdraw Hall A-101"
            >
              Hall A-101 AC Failure (Withdraw)
            </button>
            <button
              className="preset-btn"
              onClick={() => handleApplyPreset('faculty-absent')}
              title="Faculty illness: Rohan Verma absent"
            >
              Faculty Illness (Rohan Verma)
            </button>
            <button
              className="preset-btn"
              onClick={() => handleApplyPreset('water-leak')}
              title="Water leak in B-201: Reduce to 10 seats"
            >
              Water Leak: Cap B-201 to 10 Desks
            </button>
            <button
              className="preset-btn warn"
              onClick={() => handleApplyPreset('infeasible')}
              title="Capacity crunch: Demonstrates infeasible state"
            >
              Withdraw Hall A-102 (Capacity Crunch)
            </button>
          </div>
        </div>

        {/* Step 1 & 2: Form & Impact Preview */}
        <div className="disruption-form">
          <div className="control-field">
            <label>STEP 1: SELECT DISRUPTION EVENT</label>
            <select
              value={disruptionType}
              onChange={e => {
                const val = e.target.value as any;
                setDisruptionType(val);
                setTargetId(val.includes('invigilator') ? state.invigilators[0]?.id ?? 'INV02' : state.rooms[0]?.id ?? 'R1');
              }}
            >
              <option value="withdraw-room">Withdraw Room (Emergency Hall Closure)</option>
              <option value="reduce-capacity">Reduce Usable Capacity (Partial Closure)</option>
              <option value="invigilator-unavailable">Make Invigilator Unavailable (Absenteeism)</option>
              <option value="restore-room">Restore Hall to Service</option>
              <option value="restore-invigilator">Restore Invigilator Availability</option>
            </select>
          </div>

          <div className="control-field">
            <label>{disruptionType.includes('invigilator') ? 'TARGET INVIGILATOR' : 'TARGET EXAM HALL'}</label>
            <select value={targetId} onChange={e => setTargetId(e.target.value)}>
              {disruptionType.includes('invigilator')
                ? state.invigilators.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.name} ({inv.staffId}) · {inv.status}
                    </option>
                  ))
                : state.rooms.map(room => (
                    <option key={room.id} value={room.id}>
                      Hall {room.name} ({room.building}) · {room.status}
                    </option>
                  ))}
            </select>
          </div>

          {disruptionType === 'reduce-capacity' && (
            <div className="control-field">
              <label>NEW USABLE CAPACITY</label>
              <input
                type="number"
                min="0"
                value={capacityReduction}
                onChange={e => setCapacityReduction(e.target.value)}
              />
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={() =>
              onReplan({
                type: disruptionType,
                id: targetId,
                capacity: Number(capacityReduction),
              })
            }
          >
            <Zap size={14} /> STEP 3: Replan in Seconds
          </button>
        </div>

        {/* Step 2 Impact Notice */}
        <div className="affected-preview-box">
          <Info size={16} />
          <div>
            <strong>Step 2 Impact Assessment (Pre-Replan):</strong>
            <span>{affectedInfo.details}</span>
          </div>
        </div>

        {/* Step 4 & 5: Before / After Comparison */}
        {preview && (
          <div className="diff-preview-section">
            <div className="before-after">
              <div className="compare-card">
                <span>BEFORE DISRUPTION</span>
                <b>{preview.before.validation.status.replaceAll('_', ' ')}</b>
                <p>
                  {preview.before.assignments.length} seated · {preview.before.unassigned.length} unassigned ·{' '}
                  {preview.before.validation.hardViolations.length} hard violations
                </p>
              </div>

              <div className="compare-arrow">→</div>

              <div
                className={`compare-card after ${
                  preview.plan.validation.status === 'VALID'
                    ? 'valid'
                    : preview.plan.validation.status === 'VALID_WITH_WARNINGS'
                    ? 'warning'
                    : 'invalid'
                }`}
              >
                <span>REPLAN RESULT (NEW REVISION)</span>
                <b>{preview.plan.validation.status.replaceAll('_', ' ')}</b>
                <p>
                  {preview.plan.assignments.length} seated · {preview.plan.unassigned.length} unassigned ·{' '}
                  {preview.plan.validation.hardViolations.length} hard violations
                </p>
              </div>
            </div>

            {/* Actual Computed Values Grid */}
            <div className="diff-grid">
              <div className="diff-item highlight">
                <span>Students Moved</span>
                <b>{preview.diff.moved}</b>
              </div>
              <div className="diff-item">
                <span>Seats Unchanged (Frozen)</span>
                <b>{preview.diff.unchanged}</b>
              </div>
              <div className="diff-item">
                <span>Newly Unassigned</span>
                <b>{preview.diff.newlyUnassigned}</b>
              </div>
              <div className="diff-item">
                <span>Invigilator Changes</span>
                <b>{preview.diff.changedInvigilators}</b>
              </div>
              <div className="diff-item">
                <span>Elapsed Replan Time</span>
                <b>{preview.plan.computeMs} ms</b>
              </div>
            </div>

            {/* Step 5: Explaining Changes & Minimal-Displacement Proof */}
            <div className="movement-audit-box">
              <div className="audit-header">
                <h4>Step 5: Student Movement Log (Minimal-Displacement Audit)</h4>
                <div className="audit-controls">
                  <div className="filter-pills">
                    <button
                      className={`pill-btn ${diffFilter === 'moved' ? 'active' : ''}`}
                      onClick={() => setDiffFilter('moved')}
                    >
                      Moved ({preview.diff.moved})
                    </button>
                    <button
                      className={`pill-btn ${diffFilter === 'unchanged' ? 'active' : ''}`}
                      onClick={() => setDiffFilter('unchanged')}
                    >
                      Unchanged ({preview.diff.unchanged})
                    </button>
                    <button
                      className={`pill-btn ${diffFilter === 'newly_unassigned' ? 'active' : ''}`}
                      onClick={() => setDiffFilter('newly_unassigned')}
                    >
                      Newly Unassigned ({preview.diff.newlyUnassigned})
                    </button>
                    <button
                      className={`pill-btn ${diffFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setDiffFilter('all')}
                    >
                      All ({preview.diff.movements.length})
                    </button>
                  </div>

                  <div className="search-mini">
                    <Search size={12} />
                    <input
                      placeholder="Search USN / Name..."
                      value={diffSearch}
                      onChange={e => setDiffSearch(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="table-scroll max-h-table">
                <table>
                  <thead>
                    <tr>
                      <th>Candidate USN</th>
                      <th>Candidate Name</th>
                      <th>Subject</th>
                      <th>Original Hall & Coordinate</th>
                      <th>New Replaced Seat</th>
                      <th>Movement Status</th>
                      <th>Algorithmic Explanation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMovements.slice(0, 20).map(m => (
                      <tr key={m.studentId}>
                        <td><b className="mono">{m.usn}</b></td>
                        <td>{m.name}</td>
                        <td><span className="mini-pill">{m.subjectCode}</span></td>
                        <td>
                          {m.from ? `${m.from.roomName} [R${m.from.row} C${m.from.column}]` : '—'}
                        </td>
                        <td>
                          {m.to ? (
                            `${m.to.roomName} [R${m.to.row} C${m.to.column}]`
                          ) : (
                            <span className="mini-pill danger">Unseated (No Capacity)</span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`mini-pill ${
                              m.status === 'moved'
                                ? 'warning'
                                : m.status === 'unchanged'
                                ? 'success'
                                : 'danger'
                            }`}
                          >
                            {m.status.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <span className="text-muted">{m.reason ?? 'Unaffected room frozen'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredMovements.length > 20 && (
                <p className="table-more-note">Showing first 20 of {filteredMovements.length} candidate movement entries.</p>
              )}
            </div>

            {/* Step 6: Accept or Revert */}
            <div className="button-row">
              <button className="btn btn-secondary" onClick={onDiscardPreview}>
                Discard Replan (Revert to Original)
              </button>
              <button className="btn btn-primary" onClick={onAcceptPreview}>
                <CheckCircle2 size={14} /> Accept Revision & Apply to University Operations
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

