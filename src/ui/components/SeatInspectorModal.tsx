import React from 'react';
import { X, User, BookOpen, AlertTriangle, CheckCircle2, ArrowRightLeft, DoorOpen } from 'lucide-react';
import type { AppState, Plan, SeatingAssignment } from '../../engine/types';
import { adjacent } from '../../engine/engine';

interface SeatInspectorModalProps {
  roomId: string;
  row: number;
  column: number;
  state: AppState;
  plan: Plan;
  onClose: () => void;
  onSelectForSwap: (seat: { roomId: string; row: number; column: number }) => void;
}

export const SeatInspectorModal: React.FC<SeatInspectorModalProps> = ({
  roomId,
  row,
  column,
  state,
  plan,
  onClose,
  onSelectForSwap,
}) => {
  const room = state.rooms.find(r => r.id === roomId);
  const assignment = plan.assignments.find(a => a.roomId === roomId && a.row === row && a.column === column);
  const student = assignment ? state.students.find(s => s.id === assignment.studentId) : null;
  const session = assignment ? state.sessions.find(s => s.id === assignment.sessionId) : null;
  const subject = session ? state.subjects.find(sub => sub.id === session.subjectId) : null;

  const cap = room ? Math.min(room.rows * room.columns, room.capacityOverride ?? room.rows * room.columns) : 0;
  const isBlocked = !room || (row - 1) * room.columns + column > cap || room.status !== 'active';

  // Find neighbors
  const neighbors = [
    { dir: 'North (Row - 1)', r: row - 1, c: column },
    { dir: 'South (Row + 1)', r: row + 1, c: column },
    { dir: 'West (Col - 1)', r: row, c: column - 1 },
    { dir: 'East (Col + 1)', r: row, c: column + 1 },
  ]
    .filter(n => room && n.r >= 1 && n.r <= room.rows && n.c >= 1 && n.c <= room.columns)
    .map(n => {
      const neighborAssign = plan.assignments.find(a => a.roomId === roomId && a.row === n.r && a.column === n.c);
      const nStudent = neighborAssign ? state.students.find(s => s.id === neighborAssign.studentId) : null;
      const nSession = neighborAssign ? state.sessions.find(s => s.id === neighborAssign.sessionId) : null;
      const nSubject = nSession ? state.subjects.find(sub => sub.id === nSession.subjectId) : null;
      const isSameSubject = assignment && neighborAssign && subject?.id === nSubject?.id;
      return {
        ...n,
        assignment: neighborAssign,
        student: nStudent,
        subject: nSubject,
        isSameSubject,
      };
    });

  const hasSameSubjectNeighbor = neighbors.some(n => n.isSameSubject);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-badge"><DoorOpen size={13} /> {room?.name ?? roomId}</span>
            <h3>Seat Inspector · Row {row}, Column {column}</h3>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {isBlocked ? (
            <div className="seat-inspect-alert danger">
              <AlertTriangle size={18} />
              <div>
                <strong>Seat Blocked / Unavailable</strong>
                <p>This seat is excluded by capacity restriction or room status ({room?.status}).</p>
              </div>
            </div>
          ) : assignment && student ? (
            <>
              <div className="student-profile-card">
                <div className="avatar-lg"><User size={24} /></div>
                <div className="student-info-main">
                  <h4>{student.name}</h4>
                  <div className="student-tags">
                    <span className="tag-usn">{student.usn}</span>
                    <span className="tag-subject" style={{ backgroundColor: subject?.color ? `${subject.color}22` : '#e0edff', color: subject?.color || '#2058b8' }}>
                      <BookOpen size={12} /> {subject?.code}: {subject?.name}
                    </span>
                  </div>
                  <p className="session-meta">
                    Session: {session?.date} ({session?.startTime} - {session?.endTime})
                  </p>
                </div>
              </div>

              {hasSameSubjectNeighbor ? (
                <div className="seat-inspect-alert warning">
                  <AlertTriangle size={18} />
                  <div>
                    <strong>Same-Subject Adjacency Detected (Rule S1 Bent)</strong>
                    <p>This student is seated edge-adjacent to another candidate taking {subject?.code}. Consider swapping seats if room capacity allows.</p>
                  </div>
                </div>
              ) : (
                <div className="seat-inspect-alert good">
                  <CheckCircle2 size={18} />
                  <div>
                    <strong>Rule S1 Satisfied</strong>
                    <p>No edge-adjacent neighbors share {subject?.code}. Physical distance maintained.</p>
                  </div>
                </div>
              )}

              <div className="neighbors-section">
                <h5>Adjacent Neighbors (Edge Proximity)</h5>
                <div className="neighbor-grid">
                  {neighbors.map(n => (
                    <div key={n.dir} className={`neighbor-item ${n.isSameSubject ? 'clash' : n.student ? 'occupied' : 'empty'}`}>
                      <span className="neighbor-dir">{n.dir}</span>
                      {n.student ? (
                        <div className="neighbor-student">
                          <strong>{n.student.name} ({n.student.usn.slice(-4)})</strong>
                          <span className={n.isSameSubject ? 'text-clash' : 'text-ok'}>
                            {n.subject?.code} {n.isSameSubject && '⚠️ SAME SUBJECT'}
                          </span>
                        </div>
                      ) : (
                        <span className="muted-text">Empty Seat</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="empty-seat-view">
              <CheckCircle2 size={28} className="text-muted" />
              <h4>Empty Seat Available</h4>
              <p>Row {row}, Column {column} in {room?.name} is vacant and ready for assignment.</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          {!isBlocked && (
            <button
              className="btn btn-primary"
              onClick={() => {
                onSelectForSwap({ roomId, row, column });
                onClose();
              }}
            >
              <ArrowRightLeft size={15} /> Select for Swap
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

