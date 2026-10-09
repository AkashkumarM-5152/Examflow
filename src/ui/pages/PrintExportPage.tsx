import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  CheckCircle2,
  Clock,
  DoorOpen,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  Printer,
  RefreshCw,
  Tag,
  Users,
} from 'lucide-react';
import type { AppState, PlanRevision } from '../../engine/types';
import { csvSafe } from '../../engine/engine';

interface PrintExportPageProps {
  state: AppState;
  current: PlanRevision | null;
  onDownloadCsv: (name: string, content: string) => void;
  onRestoreRevision: (revId: string) => void;
}

export const PrintExportPage: React.FC<PrintExportPageProps> = ({
  state,
  current,
  onDownloadCsv,
  onRestoreRevision,
}) => {
  const [printTab, setPrintTab] = useState<'notice-board' | 'door-slips' | 'attendance' | 'desk-stickers'>(
    'notice-board'
  );
  const [selectedRoom, setSelectedRoom] = useState<string>('all');

  const formatCsv = (rows: string[][]) =>
    rows.map(row => row.map(c => `"${csvSafe(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');

  // Exports
  const handleExportSeatingCsv = () => {
    if (!current) return;
    const rows = [
      ['USN', 'Candidate Name', 'Subject Code', 'Subject Name', 'Session ID', 'Exam Hall', 'Building', 'Row', 'Column'],
      ...current.assignments.map(a => {
        const student = state.students.find(s => s.id === a.studentId);
        const session = state.sessions.find(x => x.id === a.sessionId);
        const subject = state.subjects.find(s => s.id === session?.subjectId);
        const room = state.rooms.find(r => r.id === a.roomId);
        return [
          student?.usn ?? a.studentId,
          student?.name ?? '',
          subject?.code ?? '',
          subject?.name ?? '',
          a.sessionId,
          room?.name ?? a.roomId,
          room?.building ?? '',
          String(a.row),
          String(a.column),
        ];
      }),
    ];
    onDownloadCsv(`examflow-master-seating-${current.slotId}.csv`, formatCsv(rows));
  };

  const handleExportRoomWiseCsv = () => {
    if (!current) return;
    const rows = [
      ['Exam Hall', 'Building', 'Row', 'Column', 'USN', 'Candidate Name', 'Subject Code'],
      ...current.assignments
        .slice()
        .sort((a, b) => a.roomId.localeCompare(b.roomId) || a.row - b.row || a.column - b.column)
        .map(a => {
          const student = state.students.find(s => s.id === a.studentId);
          const session = state.sessions.find(x => x.id === a.sessionId);
          const subject = state.subjects.find(s => s.id === session?.subjectId);
          const room = state.rooms.find(r => r.id === a.roomId);
          return [
            room?.name ?? a.roomId,
            room?.building ?? '',
            String(a.row),
            String(a.column),
            student?.usn ?? a.studentId,
            student?.name ?? '',
            subject?.code ?? '',
          ];
        }),
    ];
    onDownloadCsv(`examflow-room-wise-${current.slotId}.csv`, formatCsv(rows));
  };

  const handleExportInvigilatorsCsv = () => {
    if (!current) return;
    const rows = [
      ['Slot ID', 'Exam Hall', 'Building', 'Staff ID', 'Invigilator Name'],
      ...current.invigilatorAssignments.map(a => {
        const room = state.rooms.find(r => r.id === a.roomId);
        const inv = state.invigilators.find(i => i.id === a.invigilatorId);
        return [a.slotId, room?.name ?? a.roomId, room?.building ?? '', inv?.staffId ?? a.invigilatorId, inv?.name ?? ''];
      }),
    ];
    onDownloadCsv(`examflow-invigilator-roster-${current.slotId}.csv`, formatCsv(rows));
  };

  const handleExportConflictsCsv = () => {
    if (!current) return;
    const rows = [
      ['Category', 'Candidate USN / Hall', 'Session Context', 'Audit Detail'],
      ...current.unassigned.map(u => {
        const student = state.students.find(s => s.id === u.studentId);
        return ['UNASSIGNED_CANDIDATE', student?.usn ?? u.studentId, u.sessionId, `${u.reason}: ${u.detail}`];
      }),
      ...current.uncovered.map(u => {
        const room = state.rooms.find(r => r.id === u.roomId);
        return ['UNCOVERED_HALL', room?.name ?? u.roomId, `${u.assigned}/${u.required} staff`, u.reason];
      }),
      ...current.validation.hardViolations.map(h => ['HARD_VIOLATION', '—', '—', h]),
      ...current.validation.softViolations.map(s => ['SOFT_WARNING', '—', '—', s]),
    ];
    onDownloadCsv(`examflow-conflicts-audit-${current.slotId}.csv`, formatCsv(rows));
  };

  const activeRooms = state.rooms.filter(
    r => current?.assignments.some(a => a.roomId === r.id) || r.status !== 'active'
  );

  const filteredAssignments = current?.assignments.filter(
    a => selectedRoom === 'all' || a.roomId === selectedRoom
  ) ?? [];

  return (
    <div className="print-export-container">
      {/* Official Data Export Center */}
      <section className="panel export-hub-panel">
        <div className="panel-title">
          <div>
            <h2>University Data Export Hub</h2>
            <p>Generate sanitized CSV files for administrative records. Values formula-escaped with apostrophes.</p>
          </div>
          {!current && (
            <span className="mini-pill warning">
              <AlertTriangle size={12} /> Plan generation required to export
            </span>
          )}
        </div>

        <div className="export-grid">
          <div className="export-card">
            <div className="export-icon"><FileSpreadsheet size={20} /></div>
            <h3>Master Seating Plan CSV</h3>
            <p>Complete coordinate-level mapping of all seated candidates, session identifiers, and exam halls.</p>
            <button className="btn btn-secondary" disabled={!current} onClick={handleExportSeatingCsv}>
              <Download size={13} /> Download Master Seating CSV
            </button>
          </div>

          <div className="export-card">
            <div className="export-icon"><DoorOpen size={20} /></div>
            <h3>Room-wise Seating CSV</h3>
            <p>Sorted by Hall, Row, and Column coordinates for door supervisors and hall superintendents.</p>
            <button className="btn btn-secondary" disabled={!current} onClick={handleExportRoomWiseCsv}>
              <Download size={13} /> Download Room-Wise CSV
            </button>
          </div>

          <div className="export-card">
            <div className="export-icon"><Users size={20} /></div>
            <h3>Invigilator Roster CSV</h3>
            <p>Supervising faculty assignments mapped to hall allocations and building clearances.</p>
            <button className="btn btn-secondary" disabled={!current} onClick={handleExportInvigilatorsCsv}>
              <Download size={13} /> Download Faculty Roster CSV
            </button>
          </div>

          <div className="export-card">
            <div className="export-icon"><AlertTriangle size={20} /></div>
            <h3>Conflicts & Exceptions CSV</h3>
            <p>Complete audit of clashing registrations, unassigned candidates, and soft constraint warnings.</p>
            <button className="btn btn-secondary" disabled={!current} onClick={handleExportConflictsCsv}>
              <Download size={13} /> Download Conflicts CSV
            </button>
          </div>
        </div>
      </section>

      {/* Official Exam Morning Printable Documents */}
      <section className="panel printable-sheets-panel">
        <div className="panel-title">
          <div>
            <h2>Exam Morning Paper-Ready Operations Center</h2>
            <p>A4 printable documents styled with clean page breaks. Navigation and buttons hidden in print mode.</p>
          </div>
          <div className="print-actions-top">
            <button className="btn btn-primary" disabled={!current} onClick={() => window.print()}>
              <Printer size={14} /> Print Document / Save as PDF
            </button>
          </div>
        </div>

        {/* Print Tab Selector */}
        <div className="print-tab-bar">
          <button
            className={`print-tab ${printTab === 'notice-board' ? 'active' : ''}`}
            onClick={() => setPrintTab('notice-board')}
          >
            <FileText size={14} /> Master Notice Board Chart
          </button>
          <button
            className={`print-tab ${printTab === 'door-slips' ? 'active' : ''}`}
            onClick={() => setPrintTab('door-slips')}
          >
            <DoorOpen size={14} /> Classroom Door Notices (1 per Hall)
          </button>
          <button
            className={`print-tab ${printTab === 'attendance' ? 'active' : ''}`}
            onClick={() => setPrintTab('attendance')}
          >
            <Users size={14} /> Invigilator Attendance Register
          </button>
          <button
            className={`print-tab ${printTab === 'desk-stickers' ? 'active' : ''}`}
            onClick={() => setPrintTab('desk-stickers')}
          >
            <Tag size={14} /> Desk Admit Stickers
          </button>

          <div className="room-filter-pill">
            <span>Filter Hall:</span>
            <select value={selectedRoom} onChange={e => setSelectedRoom(e.target.value)}>
              <option value="all">All Halls ({activeRooms.length})</option>
              {activeRooms.map(r => (
                <option key={r.id} value={r.id}>
                  Hall {r.name} ({r.building})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Document Rendering Canvas */}
        <div className="printable-canvas">
          {current ? (
            <>
              {/* TAB 1: Master Notice Board */}
              {printTab === 'notice-board' && (
                <div className="print-doc notice-board-doc">
                  <div className="university-header">
                    <h3>OFFICE OF THE CONTROLLER OF EXAMINATIONS</h3>
                    <h4>MASTER CANDIDATE SEATING NOTICE</h4>
                    <p>
                      Date: {state.sessions[0]?.date ?? '2026-11-02'} · Slot ID: {current.slotId} · Revision: {current.id} ({current.validation.status})
                    </p>
                  </div>

                  <table className="print-table">
                    <thead>
                      <tr>
                        <th>USN (Roll Number)</th>
                        <th>Candidate Name</th>
                        <th>Subject Code</th>
                        <th>Examination Hall</th>
                        <th>Desk Coordinate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAssignments
                        .slice()
                        .sort((a, b) => {
                          const usnA = state.students.find(s => s.id === a.studentId)?.usn ?? '';
                          const usnB = state.students.find(s => s.id === b.studentId)?.usn ?? '';
                          return usnA.localeCompare(usnB);
                        })
                        .map(a => {
                          const st = state.students.find(s => s.id === a.studentId);
                          const session = state.sessions.find(x => x.id === a.sessionId);
                          const sub = state.subjects.find(s => s.id === session?.subjectId);
                          const room = state.rooms.find(r => r.id === a.roomId);
                          return (
                            <tr key={a.id}>
                              <td><b className="mono">{st?.usn}</b></td>
                              <td>{st?.name}</td>
                              <td><b>{sub?.code}</b></td>
                              <td>Hall {room?.name} ({room?.building})</td>
                              <td><b>Row {a.row}, Col {a.column}</b></td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 2: Classroom Door Notices */}
              {printTab === 'door-slips' && (
                <div className="print-doc door-slips-doc">
                  {activeRooms
                    .filter(r => selectedRoom === 'all' || r.id === selectedRoom)
                    .map(room => {
                      const roomAssigns = current.assignments.filter(a => a.roomId === room.id);
                      const roomInvigilators = current.invigilatorAssignments
                        .filter(a => a.roomId === room.id)
                        .map(a => state.invigilators.find(i => i.id === a.invigilatorId)?.name)
                        .filter(Boolean);

                      const subs = [
                        ...new Set(
                          roomAssigns.map(
                            a =>
                              state.subjects.find(s => s.id === state.sessions.find(x => x.id === a.sessionId)?.subjectId)
                                ?.code
                          )
                        ),
                      ].filter(Boolean);

                      const rollNumbers = roomAssigns
                        .map(a => state.students.find(s => s.id === a.studentId)?.usn)
                        .filter(Boolean)
                        .sort();

                      return (
                        <div className="door-slip-card" key={room.id}>
                          <div className="slip-header">
                            <h2>UNIVERSITY HALL ENTRANCE NOTICE</h2>
                            <span className="hall-name-huge">HALL {room.name}</span>
                            <p>{room.building}</p>
                          </div>

                          <div className="slip-meta-grid">
                            <div>
                              <span>SCHEDULED COURSES:</span>
                              <b>{subs.join(', ') || 'None'}</b>
                            </div>
                            <div>
                              <span>CANDIDATES ALLOCATED:</span>
                              <b>{roomAssigns.length} Students</b>
                            </div>
                            <div>
                              <span>SUPERVISING INVIGILATOR:</span>
                              <b>{roomInvigilators.join(', ') || 'Staff assignment pending'}</b>
                            </div>
                            <div>
                              <span>TIME WINDOW:</span>
                              <b>10:00 AM – 01:00 PM</b>
                            </div>
                          </div>

                          <div className="slip-range-box" style={{ padding: '8px 10px', background: 'var(--mint)', borderRadius: '5px', marginBottom: '14px', fontSize: '9px' }}>
                            <span>SEATED ROLL NUMBERS:</span>
                            <b style={{ display: 'block', marginTop: '2px', fontFamily: 'monospace' }}>
                              {rollNumbers.length > 0 ? `${rollNumbers[0]} to ${rollNumbers[rollNumbers.length - 1]} (${rollNumbers.length} candidates)` : 'No candidates seated'}
                            </b>
                          </div>

                          <div className="slip-footer">
                            <span>Mobile phones and unauthorized paper strictly prohibited.</span>
                            <span>Revision {current.id}</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              {/* TAB 3: Invigilator Attendance & Answer Booklet Register */}
              {printTab === 'attendance' && (
                <div className="print-doc attendance-doc">
                  {activeRooms
                    .filter(r => selectedRoom === 'all' || r.id === selectedRoom)
                    .map(room => {
                      const roomAssigns = current.assignments
                        .filter(a => a.roomId === room.id)
                        .slice()
                        .sort((a, b) => a.row - b.row || a.column - b.column);
                      const roomInv = current.invigilatorAssignments
                        .filter(a => a.roomId === room.id)
                        .map(a => state.invigilators.find(i => i.id === a.invigilatorId)?.name)
                        .filter(Boolean)
                        .join(', ');

                      return (
                        <div className="attendance-hall-block" key={room.id}>
                          <div className="attendance-head">
                            <h3>HALL {room.name} · CANDIDATE ATTENDANCE & BOOKLET REGISTER</h3>
                            <p>
                              Invigilator: <b>{roomInv || 'Unassigned'}</b> | Candidates: <b>{roomAssigns.length}</b> | Revision: {current.id}
                            </p>
                          </div>

                          <table className="print-table attendance-table">
                            <thead>
                              <tr>
                                <th>Desk Coordinate</th>
                                <th>USN</th>
                                <th>Candidate Name</th>
                                <th>Course</th>
                                <th>Present</th>
                                <th>Absent</th>
                                <th>Answer Booklet Serial No.</th>
                                <th>Candidate Signature</th>
                              </tr>
                            </thead>
                            <tbody>
                              {roomAssigns.map(a => {
                                const st = state.students.find(s => s.id === a.studentId);
                                const session = state.sessions.find(x => x.id === a.sessionId);
                                const sub = state.subjects.find(s => s.id === session?.subjectId);
                                return (
                                  <tr key={a.id}>
                                    <td><b>R{a.row} C{a.column}</b></td>
                                    <td><b className="mono">{st?.usn}</b></td>
                                    <td>{st?.name}</td>
                                    <td>{sub?.code}</td>
                                    <td className="check-box-cell">[ ]</td>
                                    <td className="check-box-cell">[ ]</td>
                                    <td className="blank-line-cell">________________</td>
                                    <td className="blank-line-cell">________________</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                </div>
              )}

              {/* TAB 4: Desk Admit Stickers */}
              {printTab === 'desk-stickers' && (
                <div className="print-doc stickers-doc">
                  <div className="stickers-grid">
                    {filteredAssignments.map(a => {
                      const st = state.students.find(s => s.id === a.studentId);
                      const session = state.sessions.find(x => x.id === a.sessionId);
                      const sub = state.subjects.find(s => s.id === session?.subjectId);
                      const room = state.rooms.find(r => r.id === a.roomId);

                      return (
                        <div className="desk-sticker-card" key={a.id}>
                          <div className="sticker-top">
                            <span className="sticker-hall">Hall {room?.name}</span>
                            <span className="sticker-seat">R{a.row}-C{a.column}</span>
                          </div>
                          <div className="sticker-usn">{st?.usn}</div>
                          <div className="sticker-name">{st?.name}</div>
                          <div className="sticker-sub">{sub?.code}: {sub?.name}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="empty-panel-pad" style={{ padding: '30px', textAlign: 'center' }}>
              <Info size={24} className="text-muted" />
              <p>No active seating plan generated. Generate a plan in Planner to render official printouts.</p>
            </div>
          )}
        </div>
      </section>

      {/* Revision History & Rollback */}
      <section className="panel revision-history-panel">
        <div className="panel-title">
          <div>
            <h2>Plan Revision Audit Trail</h2>
            <p>Every accepted plan and disruption replan recorded with deterministic metadata.</p>
          </div>
        </div>

        <div className="revision-list">
          {[...state.revisions].reverse().map(r => {
            const isCurrent = r.id === state.currentRevisionId;
            return (
              <div className={`revision-row ${isCurrent ? 'rev-current' : ''}`} key={r.id}>
                <div className="revision-mark">
                  <RefreshCw size={15} />
                </div>
                <div className="revision-copy">
                  <b>
                    {r.id} · {r.changeDescription} {isCurrent && <span className="mini-pill success">ACTIVE</span>}
                  </b>
                  <span>
                    {new Date(r.createdAt).toLocaleString()} · {r.assignments.length} seated · {r.computeMs} ms
                  </span>
                </div>
                <span
                  className={`mini-pill ${
                    r.validation.status === 'VALID'
                      ? 'success'
                      : r.validation.status === 'VALID_WITH_WARNINGS'
                      ? 'warning'
                      : 'danger'
                  }`}
                >
                  {r.validation.status}
                </span>
                <button
                  className="btn btn-secondary btn-xs"
                  disabled={isCurrent}
                  onClick={() => onRestoreRevision(r.id)}
                >
                  View / Restore
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
