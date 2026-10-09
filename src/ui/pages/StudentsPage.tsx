import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit2,
  FileSpreadsheet,
  GraduationCap,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import type { AppState, Student } from '../../engine/types';
import { StudentModal } from '../components/EntityModals';

interface StudentsPageProps {
  state: AppState;
  onSaveStudent: (student: { usn: string; name: string }, editId?: string) => void;
  onDeleteStudent: (id: string) => void;
  onOpenCsvImport: () => void;
  onDownloadCsv: (name: string, content: string) => void;
}

export const StudentsPage: React.FC<StudentsPageProps> = ({
  state,
  onSaveStudent,
  onDeleteStudent,
  onOpenCsvImport,
  onDownloadCsv,
}) => {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'registered' | 'unregistered'>('all');
  const [sortBy, setSortBy] = useState<'usn' | 'name' | 'regs'>('usn');
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 15;

  const [modalOpen, setModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  const currentPlan = state.revisions.find(r => r.id === state.currentRevisionId);

  // Filter & Search
  let processed = state.students.filter(s => {
    const q = search.toLowerCase();
    const matchesSearch = s.usn.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
    if (!matchesSearch) return false;

    const count = state.registrations.filter(r => r.studentId === s.id).length;
    if (filterType === 'registered' && count === 0) return false;
    if (filterType === 'unregistered' && count > 0) return false;
    return true;
  });

  // Sorting
  processed.sort((a, b) => {
    if (sortBy === 'usn') return a.usn.localeCompare(b.usn);
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    const countA = state.registrations.filter(r => r.studentId === a.id).length;
    const countB = state.registrations.filter(r => r.studentId === b.id).length;
    return countB - countA;
  });

  const totalPages = Math.ceil(processed.length / pageSize) || 1;
  const paged = processed.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

  const unregisteredCount = state.students.filter(
    s => !state.registrations.some(r => r.studentId === s.id)
  ).length;

  const handleExportCsv = () => {
    const rows = [
      ['USN', 'Candidate Name', 'Course Registrations', 'Assigned Room', 'Seat Coordinate'],
      ...state.students.map(s => {
        const regCount = state.registrations.filter(r => r.studentId === s.id).length;
        const assign = currentPlan?.assignments.find(a => a.studentId === s.id);
        const room = assign ? state.rooms.find(r => r.id === assign.roomId)?.name : '';
        const seat = assign ? `R${assign.row} C${assign.column}` : '';
        return [s.usn, s.name, String(regCount), room ?? '', seat];
      }),
    ];
    const csvContent = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\r\n');
    onDownloadCsv('examflow-students-directory.csv', csvContent);
  };

  const handleDownloadTemplate = () => {
    const template = 'usn,name,subject_code,session_date\n1BM26CS001,"Aarav Sharma",MATH101,2026-11-02\n1BM26CS002,"Aditi Rao",PHY101,2026-11-02';
    onDownloadCsv('examflow-students-template.csv', template);
  };

  return (
    <div className="students-container">
      {/* Top Action Toolbar */}
      <div className="toolbar panel">
        <div className="search-box">
          <Search size={15} />
          <input
            placeholder="Search candidate by name or USN..."
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPageIndex(0);
            }}
          />
        </div>

        <div className="filter-pills">
          <button
            className={`pill-btn ${filterType === 'all' ? 'active' : ''}`}
            onClick={() => { setFilterType('all'); setPageIndex(0); }}
          >
            All ({state.students.length})
          </button>
          <button
            className={`pill-btn ${filterType === 'registered' ? 'active' : ''}`}
            onClick={() => { setFilterType('registered'); setPageIndex(0); }}
          >
            Registered ({state.students.length - unregisteredCount})
          </button>
          <button
            className={`pill-btn ${filterType === 'unregistered' ? 'active' : ''}`}
            onClick={() => { setFilterType('unregistered'); setPageIndex(0); }}
          >
            Unregistered ({unregisteredCount})
          </button>
        </div>

        <button className="btn btn-secondary" onClick={handleDownloadTemplate} title="Download CSV template format">
          <Download size={14} /> CSV Template
        </button>

        <button className="btn btn-secondary" onClick={onOpenCsvImport}>
          <Upload size={14} /> Bulk CSV Import
        </button>

        <button className="btn btn-secondary" onClick={handleExportCsv}>
          <ArrowDownToLine size={14} /> Export CSV
        </button>

        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingStudent(null);
            setModalOpen(true);
          }}
        >
          <Plus size={15} /> Add Student
        </button>
      </div>

      {unregisteredCount > 0 && filterType !== 'registered' && (
        <div className="affected-preview-box" style={{ margin: '0 0 16px' }}>
          <AlertTriangle size={15} />
          <div>
            <strong>Registration Warning:</strong>
            <span>
              {unregisteredCount} student record(s) have zero course registrations. These students will not be seated until enrolled in exam sessions.
            </span>
          </div>
        </div>
      )}

      {/* Student Directory Table */}
      <section className="panel table-panel">
        <div className="panel-title">
          <div>
            <h2>Student Directory ({processed.length} candidates)</h2>
            <p>University student roster with registration counts and seating assignments.</p>
          </div>

          <div className="sort-controls">
            <span className="toolbar-label">Sort by:</span>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
              <option value="usn">USN (Roll Number)</option>
              <option value="name">Candidate Name</option>
              <option value="regs">Registrations Count</option>
            </select>
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>USN</th>
                <th>Candidate Full Name</th>
                <th>Course Registrations</th>
                <th>Current Plan Seat</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(s => {
                const count = state.registrations.filter(r => r.studentId === s.id).length;
                const a = currentPlan?.assignments.find(x => x.studentId === s.id);
                const room = a ? state.rooms.find(r => r.id === a.roomId) : null;
                const session = a ? state.sessions.find(x => x.id === a.sessionId) : null;
                const subject = session ? state.subjects.find(sub => sub.id === session.subjectId) : null;

                return (
                  <tr key={s.id}>
                    <td><b className="mono">{s.usn}</b></td>
                    <td>{s.name}</td>
                    <td>
                      {count > 0 ? (
                        <span className="mini-pill success">{count} session{count !== 1 ? 's' : ''}</span>
                      ) : (
                        <span className="mini-pill warning">⚠️ 0 Registrations</span>
                      )}
                    </td>
                    <td>
                      {a ? (
                        <div className="table-assign-chip">
                          <span className="room-chip">Hall {room?.name ?? a.roomId}</span>
                          <span className="seat-chip">R{a.row} C{a.column}</span>
                          <span className="sub-chip">{subject?.code}</span>
                        </div>
                      ) : (
                        <span className="muted-text">Not Seated</span>
                      )}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="icon-action-btn"
                          title="Edit candidate profile"
                          onClick={() => {
                            setEditingStudent(s);
                            setModalOpen(true);
                          }}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          className="icon-action-btn danger"
                          title="Delete candidate"
                          onClick={() => {
                            if (confirm(`Permanently delete student ${s.name} (${s.usn})? Related registrations will also be removed.`)) {
                              onDeleteStudent(s.id);
                            }
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="pagination-bar">
          <span>
            Showing {paged.length > 0 ? pageIndex * pageSize + 1 : 0} to{' '}
            {Math.min((pageIndex + 1) * pageSize, processed.length)} of {processed.length} candidates
          </span>
          <div className="pagination-controls">
            <button
              className="btn btn-secondary btn-xs"
              disabled={pageIndex === 0}
              onClick={() => setPageIndex(p => Math.max(0, p - 1))}
            >
              <ChevronLeft size={13} /> Previous
            </button>
            <span className="page-indicator">
              Page {pageIndex + 1} of {totalPages}
            </span>
            <button
              className="btn btn-secondary btn-xs"
              disabled={pageIndex >= totalPages - 1}
              onClick={() => setPageIndex(p => Math.min(totalPages - 1, p + 1))}
            >
              Next <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </section>

      {modalOpen && (
        <StudentModal
          initial={editingStudent}
          onSave={data => {
            onSaveStudent(data, editingStudent?.id);
            setModalOpen(false);
          }}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
};
