import React, { useState } from 'react';
import { X, Upload, AlertTriangle, CheckCircle2, Plus, Download } from 'lucide-react';
import type { AppState, ExamSession, Invigilator, Registration, Room, Student, Subject } from '../../engine/types';
import { parseCsv } from '../../engine/engine';

// --- Student Modal ---
interface StudentModalProps {
  initial?: Student | null;
  onSave: (student: { usn: string; name: string }) => void;
  onClose: () => void;
}

export const StudentModal: React.FC<StudentModalProps> = ({ initial, onSave, onClose }) => {
  const [usn, setUsn] = useState(initial?.usn ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!usn.trim() || !name.trim()) {
      setError('Both USN and Name are required.');
      return;
    }
    onSave({ usn: usn.trim().toUpperCase(), name: name.trim() });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{initial ? 'Edit Student' : 'Add New Student'}</h3>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="form-error"><AlertTriangle size={14} /> {error}</div>}
            <div className="form-group">
              <label>University Seat Number (USN) *</label>
              <input
                value={usn}
                onChange={e => setUsn(e.target.value)}
                placeholder="e.g. 1BM26CS001"
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Full Student Name *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Aarav Sharma"
                required
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Student</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Subject Modal ---
interface SubjectModalProps {
  initial?: Subject | null;
  onSave: (subject: { code: string; name: string; color?: string }) => void;
  onClose: () => void;
}

export const SubjectModal: React.FC<SubjectModalProps> = ({ initial, onSave, onClose }) => {
  const [code, setCode] = useState(initial?.code ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? '#2563eb');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      setError('Both Code and Name are required.');
      return;
    }
    onSave({ code: code.trim().toUpperCase(), name: name.trim(), color });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{initial ? 'Edit Subject' : 'Add Subject'}</h3>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="form-error"><AlertTriangle size={14} /> {error}</div>}
            <div className="form-group">
              <label>Subject Code *</label>
              <input value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. CS201" required autoFocus />
            </div>
            <div className="form-group">
              <label>Subject Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Data Structures & Algorithms" required />
            </div>
            <div className="form-group">
              <label>Badge Color</label>
              <div className="color-picker-row">
                {['#2563eb', '#16a34a', '#d97706', '#9333ea', '#dc2626', '#0891b2'].map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`color-swatch ${color === c ? 'active' : ''}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Subject</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Session Modal ---
interface SessionModalProps {
  initial?: ExamSession | null;
  subjects: Subject[];
  onSave: (session: { subjectId: string; date: string; startTime: string; endTime: string }) => void;
  onClose: () => void;
}

export const SessionModal: React.FC<SessionModalProps> = ({ initial, subjects, onSave, onClose }) => {
  const [subjectId, setSubjectId] = useState(initial?.subjectId ?? subjects[0]?.id ?? '');
  const [date, setDate] = useState(initial?.date ?? '2026-11-02');
  const [startTime, setStartTime] = useState(initial?.startTime ?? '10:00');
  const [endTime, setEndTime] = useState(initial?.endTime ?? '13:00');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectId || !date || !startTime || !endTime) {
      setError('All fields are required.');
      return;
    }
    if (startTime >= endTime) {
      setError('Start time must be before end time.');
      return;
    }
    onSave({ subjectId, date, startTime, endTime });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{initial ? 'Edit Exam Session' : 'Schedule Exam Session'}</h3>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="form-error"><AlertTriangle size={14} /> {error}</div>}
            <div className="form-group">
              <label>Subject *</label>
              <select value={subjectId} onChange={e => setSubjectId(e.target.value)}>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.code} · {s.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Exam Date *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Start Time *</label>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>End Time *</label>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Session</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Room Modal ---
interface RoomModalProps {
  initial?: Room | null;
  onSave: (room: { name: string; building?: string; rows: number; columns: number; capacityOverride?: number; status: Room['status'] }) => void;
  onClose: () => void;
}

export const RoomModal: React.FC<RoomModalProps> = ({ initial, onSave, onClose }) => {
  const [name, setName] = useState(initial?.name ?? '');
  const [building, setBuilding] = useState(initial?.building ?? 'Main Academic Block');
  const [rows, setRows] = useState(initial?.rows ?? 5);
  const [columns, setColumns] = useState(initial?.columns ?? 6);
  const [capacityOverride, setCapacityOverride] = useState<string>(initial?.capacityOverride ? String(initial.capacityOverride) : '');
  const [status, setStatus] = useState<Room['status']>(initial?.status ?? 'active');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Room name is required.');
      return;
    }
    const rNum = Number(rows);
    const cNum = Number(columns);
    if (rNum < 1 || cNum < 1) {
      setError('Rows and Columns must be at least 1.');
      return;
    }
    const cap = capacityOverride.trim() ? Number(capacityOverride) : undefined;
    onSave({
      name: name.trim(),
      building: building.trim(),
      rows: rNum,
      columns: cNum,
      capacityOverride: cap,
      status,
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{initial ? 'Edit Exam Room' : 'Add Exam Room'}</h3>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="form-error"><AlertTriangle size={14} /> {error}</div>}
            <div className="form-group">
              <label>Room Name / Number *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Hall 101" required autoFocus />
            </div>
            <div className="form-group">
              <label>Building / Block</label>
              <input value={building} onChange={e => setBuilding(e.target.value)} placeholder="e.g. Block A" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Rows *</label>
                <input type="number" min="1" max="25" value={rows} onChange={e => setRows(Number(e.target.value))} required />
              </div>
              <div className="form-group">
                <label>Columns *</label>
                <input type="number" min="1" max="25" value={columns} onChange={e => setColumns(Number(e.target.value))} required />
              </div>
            </div>
            <div className="form-group">
              <label>Usable Capacity Override (Optional, max: {rows * columns})</label>
              <input
                type="number"
                min="0"
                max={rows * columns}
                value={capacityOverride}
                onChange={e => setCapacityOverride(e.target.value)}
                placeholder={`Default: ${rows * columns} seats`}
              />
            </div>
            <div className="form-group">
              <label>Room Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as Room['status'])}>
                <option value="active">Active (Available for seating)</option>
                <option value="unavailable">Unavailable (Maintenance / Conflict)</option>
                <option value="withdrawn">Withdrawn (Emergency Out of Service)</option>
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Room</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Invigilator Modal ---
interface InvigilatorModalProps {
  initial?: Invigilator | null;
  onSave: (inv: { staffId: string; name: string; eligibleBuildings?: string[]; status: Invigilator['status'] }) => void;
  onClose: () => void;
}

export const InvigilatorModal: React.FC<InvigilatorModalProps> = ({ initial, onSave, onClose }) => {
  const [staffId, setStaffId] = useState(initial?.staffId ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [building, setBuilding] = useState(initial?.eligibleBuildings?.join(', ') ?? '');
  const [status, setStatus] = useState<Invigilator['status']>(initial?.status ?? 'active');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffId.trim() || !name.trim()) {
      setError('Staff ID and Name are required.');
      return;
    }
    const eligibleBuildings = building.trim()
      ? building.split(',').map(b => b.trim()).filter(Boolean)
      : [];
    onSave({
      staffId: staffId.trim().toUpperCase(),
      name: name.trim(),
      eligibleBuildings,
      status,
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{initial ? 'Edit Invigilator' : 'Add Invigilator'}</h3>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="form-error"><AlertTriangle size={14} /> {error}</div>}
            <div className="form-group">
              <label>Staff ID *</label>
              <input value={staffId} onChange={e => setStaffId(e.target.value)} placeholder="e.g. STAFF09" required autoFocus />
            </div>
            <div className="form-group">
              <label>Full Staff Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Dr. Rajesh Sharma" required />
            </div>
            <div className="form-group">
              <label>Eligible Buildings (Comma separated, empty = all)</label>
              <input value={building} onChange={e => setBuilding(e.target.value)} placeholder="e.g. Block A, Block B" />
            </div>
            <div className="form-group">
              <label>Availability Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as Invigilator['status'])}>
                <option value="active">Active (Available for duty)</option>
                <option value="unavailable">Unavailable (On leave / medical)</option>
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Invigilator</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Smart CSV Import Modal ---
interface CsvImportModalProps {
  state: AppState;
  onImport: (newStudents: Student[], newRegistrations: Registration[]) => void;
  onClose: () => void;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({ state, onImport, onClose }) => {
  const [csvText, setCsvText] = useState('');
  const [parsed, setParsed] = useState<{
    valid: { student: Student; registration?: Registration }[];
    errors: string[];
  } | null>(null);

  const handlePreview = () => {
    if (!csvText.trim()) return;
    const rows = parseCsv(csvText);
    const errors: string[] = [];
    const valid: { student: Student; registration?: Registration }[] = [];

    const existingUsns = new Set(state.students.map(s => s.usn.toLowerCase()));
    const seenUsns = new Set<string>();

    const header = rows[0]?.map(x => x.trim().toLowerCase());
    if (!header || !header.includes('usn') || !header.includes('name')) {
      setParsed({
        valid: [],
        errors: ['Header must contain at least "usn" and "name". Optional: "subject_code", "session_date".'],
      });
      return;
    }

    const ui = header.indexOf('usn');
    const ni = header.indexOf('name');
    const ci = header.indexOf('subject_code');
    const di = header.indexOf('session_date');

    rows.slice(1).forEach((r, i) => {
      const lineNum = i + 2;
      if (r.length !== header.length) {
        errors.push(`Row ${lineNum}: malformed column count (${r.length} fields, expected ${header.length})`);
        return;
      }

      const usn = (r[ui] ?? '').trim().toUpperCase();
      const name = (r[ni] ?? '').trim();
      const subCode = ci >= 0 ? (r[ci] ?? '').trim().toUpperCase() : '';
      const sDate = di >= 0 ? (r[di] ?? '').trim() : '';

      if (!usn || !name) {
        errors.push(`Row ${lineNum}: missing USN or Student Name.`);
        return;
      }
      if (existingUsns.has(usn.toLowerCase()) || seenUsns.has(usn)) {
        errors.push(`Row ${lineNum}: duplicate USN "${usn}".`);
        return;
      }

      seenUsns.add(usn);
      const studentId = `ST_IMP_${Date.now()}_${i + 1}_${usn}`;
      const student: Student = { id: studentId, usn, name };

      let registration: Registration | undefined;
      if (subCode) {
        const subject = state.subjects.find(s => s.code.toLowerCase() === subCode.toLowerCase());
        if (!subject) {
          errors.push(`Row ${lineNum}: Subject code "${subCode}" not recognized in system.`);
          return;
        }
        // Find or map to matching session
        const session = state.sessions.find(
          sess => sess.subjectId === subject.id && (!sDate || sess.date === sDate)
        );
        if (session) {
          registration = {
            id: `REG_IMP_${studentId}_${session.id}`,
            studentId,
            sessionId: session.id,
          };
        } else {
          errors.push(`Row ${lineNum}: No exam session scheduled for subject "${subCode}" on "${sDate || 'any date'}".`);
          return;
        }
      }

      valid.push({ student, registration });
    });

    setParsed({ valid, errors });
  };

  const handleConfirmImport = () => {
    if (!parsed || parsed.valid.length === 0) return;
    const students = parsed.valid.map(v => v.student);
    const registrations = parsed.valid.map(v => v.registration).filter((r): r is Registration => !!r);
    onImport(students, registrations);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog md" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-badge"><Upload size={13} /> Bulk Data</span>
            <h3>Smart CSV Student & Registration Importer</h3>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          <p className="modal-desc">
            Paste or load a CSV with student rosters. Providing <code>subject_code</code> and <code>session_date</code> will automatically register the student for that examination!
          </p>

          <div className="csv-template-bar">
            <span>Header columns: <code>usn,name,subject_code,session_date</code></span>
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                setCsvText(
                  `usn,name,subject_code,session_date\nDEMO9001,"Vikram Malhotra",MATH101,2026-11-02\nDEMO9002,"Priyanka Sen",PHY101,2026-11-02\nDEMO9003,"Anand Verma",CHE101,2026-11-02`
                );
              }}
            >
              Load Sample CSV
            </button>
          </div>

          <textarea
            className="csv-textarea"
            rows={5}
            value={csvText}
            onChange={e => {
              setCsvText(e.target.value);
              setParsed(null);
            }}
            placeholder={'usn,name,subject_code,session_date\n1BM26CS080,"Aarav Mehta",MATH101,2026-11-02\n1BM26CS081,"Bhavna Joshi",PHY101,2026-11-02'}
          />

          <div className="button-row-left">
            <button className="btn btn-secondary" onClick={handlePreview}>
              <Upload size={14} /> Validate & Preview CSV
            </button>
          </div>

          {parsed && (
            <div className="preview-results">
              <div className="preview-summary">
                <span className="badge-pass">
                  <CheckCircle2 size={14} /> {parsed.valid.length} Valid Row(s)
                </span>
                {parsed.errors.length > 0 && (
                  <span className="badge-warn">
                    <AlertTriangle size={14} /> {parsed.errors.length} Issue(s) / Skipped
                  </span>
                )}
              </div>

              {parsed.errors.length > 0 && (
                <div className="csv-errors-list">
                  {parsed.errors.map((err, i) => (
                    <div key={i} className="csv-err-row"><AlertTriangle size={13} /> {err}</div>
                  ))}
                </div>
              )}

              {parsed.valid.length > 0 && (
                <div className="csv-preview-table-wrap">
                  <table className="csv-table">
                    <thead>
                      <tr>
                        <th>USN</th>
                        <th>Student Name</th>
                        <th>Auto-Registration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.valid.slice(0, 5).map((v, i) => (
                        <tr key={i}>
                          <td><b>{v.student.usn}</b></td>
                          <td>{v.student.name}</td>
                          <td>
                            {v.registration ? (
                              <span className="mini-pill success">
                                Session {v.registration.sessionId}
                              </span>
                            ) : (
                              <span className="muted-text">Student Only</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsed.valid.length > 5 && (
                    <p className="table-more-note">+ {parsed.valid.length - 5} more valid rows ready to import</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!parsed || parsed.valid.length === 0}
            onClick={handleConfirmImport}
          >
            Import {parsed?.valid.length ?? 0} Students & Registrations
          </button>
        </div>
      </div>
    </div>
  );
};

