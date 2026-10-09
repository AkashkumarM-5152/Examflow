import React, { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  Clock,
  Edit2,
  Plus,
  Trash2,
} from 'lucide-react';
import type { AppState, ExamSession, Subject } from '../../engine/types';
import { slotsFor } from '../../engine/engine';
import { SessionModal, SubjectModal } from '../components/EntityModals';

interface SubjectsSessionsPageProps {
  state: AppState;
  onSaveSubject: (sub: { code: string; name: string; color?: string }, editId?: string) => void;
  onDeleteSubject: (id: string) => void;
  onSaveSession: (sess: { subjectId: string; date: string; startTime: string; endTime: string }, editId?: string) => void;
  onDeleteSession: (id: string) => void;
  onPlanSlot: (slotId: string) => void;
}

export const SubjectsSessionsPage: React.FC<SubjectsSessionsPageProps> = ({
  state,
  onSaveSubject,
  onDeleteSubject,
  onSaveSession,
  onDeleteSession,
  onPlanSlot,
}) => {
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<ExamSession | null>(null);

  const slots = slotsFor(state);

  return (
    <div className="subjects-sessions-container">
      {/* Subjects Section */}
      <section className="panel table-panel">
        <div className="panel-title">
          <div>
            <h2>University Exam Subjects ({state.subjects.length})</h2>
            <p>Courses and code identifiers used for seating interleaving.</p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditingSubject(null);
              setSubjectModalOpen(true);
            }}
          >
            <Plus size={15} /> Add Subject
          </button>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Subject Name</th>
                <th>Color Badge</th>
                <th>Exam Sessions</th>
                <th>Registrations</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {state.subjects.map(s => {
                const sessions = state.sessions.filter(sess => sess.subjectId === s.id);
                const regs = state.registrations.filter(r =>
                  sessions.some(sess => sess.id === r.sessionId)
                );
                return (
                  <tr key={s.id}>
                    <td><b className="mono">{s.code}</b></td>
                    <td>{s.name}</td>
                    <td>
                      <span
                        className="color-pill"
                        style={{ backgroundColor: s.color ?? '#2563eb' }}
                      />
                    </td>
                    <td>{sessions.length} scheduled</td>
                    <td>{regs.length} enrolled</td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="icon-action-btn"
                          title="Edit subject"
                          onClick={() => {
                            setEditingSubject(s);
                            setSubjectModalOpen(true);
                          }}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          className="icon-action-btn danger"
                          title="Delete subject"
                          onClick={() => {
                            if (confirm(`Delete subject ${s.code}? Associated sessions and registrations will also be removed.`)) {
                              onDeleteSubject(s.id);
                            }
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Exam Sessions & Planning Slots Section */}
      <section className="panel table-panel">
        <div className="panel-title">
          <div>
            <h2>Scheduled Exam Sessions ({state.sessions.length})</h2>
            <p>Date and time schedules. Overlapping sessions are grouped into planning slots.</p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditingSession(null);
              setSessionModalOpen(true);
            }}
          >
            <Plus size={15} /> Schedule Session
          </button>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Session ID</th>
                <th>Subject</th>
                <th>Exam Date</th>
                <th>Time Window</th>
                <th>Enrollments</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {state.sessions.map(sess => {
                const subject = state.subjects.find(s => s.id === sess.subjectId);
                const regCount = state.registrations.filter(r => r.sessionId === sess.id).length;
                return (
                  <tr key={sess.id}>
                    <td><b className="mono">{sess.id}</b></td>
                    <td>
                      <b>{subject?.code}</b>: {subject?.name}
                    </td>
                    <td>{sess.date}</td>
                    <td>
                      <span className="time-pill">
                        <Clock size={12} /> {sess.startTime} - {sess.endTime}
                      </span>
                    </td>
                    <td>{regCount} students</td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="icon-action-btn"
                          title="Edit session"
                          onClick={() => {
                            setEditingSession(sess);
                            setSessionModalOpen(true);
                          }}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          className="icon-action-btn danger"
                          title="Delete session"
                          onClick={() => {
                            if (confirm(`Delete exam session ${sess.id}?`)) {
                              onDeleteSession(sess.id);
                            }
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Planning Slots Card Grid */}
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Planning Slots (Overlapping Windows)</h2>
            <p>Sessions occurring simultaneously are planned together to prevent clashes.</p>
          </div>
        </div>

        <div className="session-cards">
          {slots.map((s, i) => {
            const uniqueStudents = new Set(
              state.registrations.filter(r => s.sessions.includes(r.sessionId)).map(r => r.studentId)
            ).size;

            return (
              <div className="session-card" key={s.id}>
                <div className="session-card-top">
                  <span className="mini-pill">SLOT {i + 1}</span>
                  <b>{s.date}</b>
                </div>
                <div className="session-card-title">{s.start}–{s.end}</div>

                <div className="session-items-list">
                  {s.sessions.map(id => {
                    const session = state.sessions.find(x => x.id === id);
                    const subject = state.subjects.find(x => x.id === session?.subjectId);
                    const count = state.registrations.filter(r => r.sessionId === id).length;
                    return (
                      <div className="session-item" key={id}>
                        <div>
                          <b>{id} · {subject?.code}</b>
                          <span>{subject?.name}</span>
                        </div>
                        <span className="mini-pill">{count} candidates</span>
                      </div>
                    );
                  })}
                </div>

                <div className="session-card-foot">
                  <b>{uniqueStudents} Unique Candidates</b>
                  <button className="btn btn-primary btn-sm" onClick={() => onPlanSlot(s.id)}>
                    Plan This Slot →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {subjectModalOpen && (
        <SubjectModal
          initial={editingSubject}
          onSave={data => {
            onSaveSubject(data, editingSubject?.id);
            setSubjectModalOpen(false);
          }}
          onClose={() => setSubjectModalOpen(false)}
        />
      )}

      {sessionModalOpen && (
        <SessionModal
          initial={editingSession}
          subjects={state.subjects}
          onSave={data => {
            onSaveSession(data, editingSession?.id);
            setSessionModalOpen(false);
          }}
          onClose={() => setSessionModalOpen(false)}
        />
      )}
    </div>
  );
};

