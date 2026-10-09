import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Cpu,
  DoorOpen,
  FileSpreadsheet,
  GraduationCap,
  LayoutDashboard,
  Menu,
  Printer,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { makeDemoData } from '../engine/demo';
import {
  generatePlan,
  replan,
  restoreRevision,
  safeLoadAppState,
  slotsFor,
  swapSeats,
  validatePlan,
} from '../engine/engine';
import type { AppState, Plan, PlanDiff, PlanRevision, Settings, Student, Room, Invigilator, Registration } from '../engine/types';
import { PAGE_GROUP_MAP, type NavGroup, type Page, type ToastMessage } from './types';

import { DashboardPage } from './pages/DashboardPage';
import { PlannerPage } from './pages/PlannerPage';
import { DisruptionStudioPage } from './pages/DisruptionStudioPage';
import { ValidationPage } from './pages/ValidationPage';
import { StudentsPage } from './pages/StudentsPage';
import { SubjectsSessionsPage } from './pages/SubjectsSessionsPage';
import { RoomsPage } from './pages/RoomsPage';
import { InvigilatorsPage } from './pages/InvigilatorsPage';
import { PrintExportPage } from './pages/PrintExportPage';
import { BenchmarkSettingsPage } from './pages/BenchmarkSettingsPage';
import { CsvImportModal } from './components/EntityModals';

const STORE = 'examflow-state-v1';

function loadState(): { state: AppState | null; bad: boolean } {
  try {
    const raw = localStorage.getItem(STORE);
    return safeLoadAppState(raw);
  } catch {
    return { state: null, bad: true };
  }
}

function download(name: string, content: string, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const initial = useMemo(loadState, []);
  const [state, setState] = useState<AppState | null>(initial.state ?? makeDemoData());
  const [page, setPage] = useState<Page>('Dashboard');
  const [slotId, setSlotId] = useState('');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [mobile, setMobile] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);

  // Disruption preview state
  const [preview, setPreview] = useState<{
    state: AppState;
    plan: Plan;
    diff: PlanDiff;
    before: PlanRevision;
  } | null>(null);

  const notify = (text: string, type: ToastMessage['type'] = 'info') => {
    const msg: ToastMessage = { id: String(Date.now()), text, type };
    setToast(msg);
    setTimeout(() => {
      setToast(curr => (curr?.id === msg.id ? null : curr));
    }, 4500);
  };

  // Sync state with localStorage
  useEffect(() => {
    if (state) {
      try {
        localStorage.setItem(STORE, JSON.stringify(state));
      } catch {
        notify('Browser local storage limit reached. Export your data to avoid loss.', 'warning');
      }
    }
  }, [state]);

  const slots = state ? slotsFor(state) : [];

  useEffect(() => {
    if (slots.length && (!slotId || !slots.some(s => s.id === slotId))) {
      setSlotId(slots[0].id);
    }
  }, [state?.sessions.length]);

  const current = state?.revisions.find(r => r.id === state.currentRevisionId) ?? null;

  // Plan generation
  const handleGenerate = () => {
    if (!state || !slotId) return;
    try {
      const plan = generatePlan(state, slotId, new Date().toISOString());
      const revision: PlanRevision = {
        ...plan,
        id: `REV-${(state.revisions.length + 1).toString().padStart(3, '0')}`,
        parentRevisionId: current?.id,
        createdAt: new Date().toISOString(),
        changeDescription: 'Generated clash-free seating plan',
        slotId,
      };
      setState({
        ...state,
        revisions: [...state.revisions, revision],
        currentRevisionId: revision.id,
      });
      notify(
        `Plan generated in ${plan.computeMs} ms: ${plan.assignments.length} seated, ${plan.unassigned.length} unassigned.`,
        'success'
      );
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not generate plan', 'error');
    }
  };

  // Disaster Replan
  const handleReplan = (disruption: { type: any; id: string; capacity?: number }) => {
    if (!state || !current) {
      notify('Please generate a plan before running disaster replanning.', 'warning');
      return;
    }
    try {
      const result = replan(state, current, disruption, new Date().toISOString());
      setPreview({ ...result, before: current });
      setPage('Disruption Studio');
      notify(`Replan computed in ${result.plan.computeMs} ms! Review before/after comparison.`, 'info');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Replanning failed', 'error');
    }
  };

  const handleAcceptPreview = () => {
    if (!state || !preview) return;
    const r: PlanRevision = {
      ...preview.plan,
      id: `REV-${(state.revisions.length + 1).toString().padStart(3, '0')}`,
      parentRevisionId: preview.before.id,
      createdAt: new Date().toISOString(),
      changeDescription: `Replan Disruption: ${preview.plan.validation.status}`,
      slotId: preview.plan.slotId,
    };
    setState({
      ...preview.state,
      revisions: [...state.revisions, r],
      currentRevisionId: r.id,
    });
    setPreview(null);
    notify(`Revision accepted! Current status: ${r.validation.status}.`, 'success');
  };

  const handleDiscardPreview = () => {
    setPreview(null);
    notify('Disruption preview discarded. Preserved original revision.', 'info');
  };

  // Manual Coordinator Override Seat Swap
  const handleSwapSeats = (
    seatA: { roomId: string; row: number; column: number },
    seatB: { roomId: string; row: number; column: number }
  ) => {
    if (!state || !current) return;
    try {
      const targetPlan = preview ? preview.plan : current;
      const updatedPlan = swapSeats(state, targetPlan, seatA, seatB, new Date().toISOString());

      if (preview) {
        setPreview({ ...preview, plan: updatedPlan });
      } else {
        const rev: PlanRevision = {
          ...updatedPlan,
          id: `REV-${(state.revisions.length + 1).toString().padStart(3, '0')}`,
          parentRevisionId: current.id,
          createdAt: new Date().toISOString(),
          changeDescription: `Manual Coordinator Override [${seatA.roomId}] ➔ [${seatB.roomId}]`,
          slotId: updatedPlan.slotId,
        };
        setState({
          ...state,
          revisions: [...state.revisions, rev],
          currentRevisionId: rev.id,
        });
      }
      notify(
        `Seats swapped! Re-validated in ${updatedPlan.computeMs} ms (${updatedPlan.validation.status}).`,
        'success'
      );
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Swap failed', 'error');
    }
  };

  // Independent Re-validation
  const handleRevalidate = () => {
    if (!state || !current) return;
    const v = validatePlan(state, current);
    setState({
      ...state,
      revisions: state.revisions.map(r => (r.id === current.id ? { ...r, validation: v } : r)),
    });
    notify(`Independent verification: ${v.status} (${v.hardViolations.length} hard, ${v.softViolations.length} soft).`, 'info');
  };

  // CRUD Handlers
  const handleSaveStudent = (data: { usn: string; name: string }, editId?: string) => {
    if (!state) return;
    if (editId) {
      setState({
        ...state,
        students: state.students.map(s => (s.id === editId ? { ...s, ...data } : s)),
      });
      notify(`Updated candidate ${data.usn}.`, 'success');
    } else {
      if (state.students.some(s => s.usn.toLowerCase() === data.usn.toLowerCase())) {
        notify(`Roll number (USN) ${data.usn} already exists.`, 'warning');
        return;
      }
      const newSt: Student = { id: `ST-${Date.now()}`, ...data };
      setState({ ...state, students: [...state.students, newSt] });
      notify(`Candidate ${data.usn} added.`, 'success');
    }
  };

  const handleDeleteStudent = (id: string) => {
    if (!state) return;
    setState({
      ...state,
      students: state.students.filter(s => s.id !== id),
      registrations: state.registrations.filter(r => r.studentId !== id),
    });
    notify('Candidate record deleted.', 'info');
  };

  const handleBulkImport = (newStudents: Student[], newRegistrations: Registration[]) => {
    if (!state) return;
    setState({
      ...state,
      students: [...state.students, ...newStudents],
      registrations: [...state.registrations, ...newRegistrations],
    });
    notify(
      `Imported ${newStudents.length} candidates and registered ${newRegistrations.length} exam enrollments!`,
      'success'
    );
  };

  const handleSaveSubject = (data: { code: string; name: string; color?: string }, editId?: string) => {
    if (!state) return;
    if (editId) {
      setState({
        ...state,
        subjects: state.subjects.map(s => (s.id === editId ? { ...s, ...data } : s)),
      });
      notify(`Subject ${data.code} updated.`, 'success');
    } else {
      const newSub = { id: `SUB-${Date.now()}`, ...data };
      setState({ ...state, subjects: [...state.subjects, newSub] });
      notify(`Subject ${data.code} created.`, 'success');
    }
  };

  const handleDeleteSubject = (id: string) => {
    if (!state) return;
    const sessionIds = state.sessions.filter(s => s.subjectId === id).map(s => s.id);
    setState({
      ...state,
      subjects: state.subjects.filter(s => s.id !== id),
      sessions: state.sessions.filter(s => s.subjectId !== id),
      registrations: state.registrations.filter(r => !sessionIds.includes(r.sessionId)),
    });
    notify('Subject and linked sessions removed.', 'info');
  };

  const handleSaveSession = (
    data: { subjectId: string; date: string; startTime: string; endTime: string },
    editId?: string
  ) => {
    if (!state) return;
    if (editId) {
      setState({
        ...state,
        sessions: state.sessions.map(s => (s.id === editId ? { ...s, ...data } : s)),
      });
      notify('Exam session schedule updated.', 'success');
    } else {
      const newSess = { id: `SESS-${Date.now()}`, ...data };
      setState({ ...state, sessions: [...state.sessions, newSess] });
      notify('Exam session scheduled.', 'success');
    }
  };

  const handleDeleteSession = (id: string) => {
    if (!state) return;
    setState({
      ...state,
      sessions: state.sessions.filter(s => s.id !== id),
      registrations: state.registrations.filter(r => r.sessionId !== id),
    });
    notify('Exam session deleted.', 'info');
  };

  const handleSaveRoom = (
    data: {
      name: string;
      building?: string;
      rows: number;
      columns: number;
      capacityOverride?: number;
      status: Room['status'];
    },
    editId?: string
  ) => {
    if (!state) return;
    if (editId) {
      setState({
        ...state,
        rooms: state.rooms.map(r => (r.id === editId ? { ...r, ...data } : r)),
      });
      notify(`Hall ${data.name} updated.`, 'success');
    } else {
      const newRoom: Room = {
        id: `R-${Date.now()}`,
        unavailableSessionIds: [],
        ...data,
      };
      setState({ ...state, rooms: [...state.rooms, newRoom] });
      notify(`Hall ${data.name} registered.`, 'success');
    }
  };

  const handleDeleteRoom = (id: string) => {
    if (!state) return;
    setState({ ...state, rooms: state.rooms.filter(r => r.id !== id) });
    notify('Hall removed.', 'info');
  };

  const handleToggleRoomStatus = (roomId: string, nextStatus: Room['status']) => {
    if (!state) return;
    setState({
      ...state,
      rooms: state.rooms.map(r => (r.id === roomId ? { ...r, status: nextStatus } : r)),
    });
    notify(`Hall status changed to ${nextStatus}.`, 'info');
  };

  const handleSaveInvigilator = (
    data: {
      staffId: string;
      name: string;
      eligibleBuildings?: string[];
      status: Invigilator['status'];
    },
    editId?: string
  ) => {
    if (!state) return;
    if (editId) {
      setState({
        ...state,
        invigilators: state.invigilators.map(i => (i.id === editId ? { ...i, ...data } : i)),
      });
      notify(`Invigilator ${data.name} updated.`, 'success');
    } else {
      const newInv: Invigilator = {
        id: `INV-${Date.now()}`,
        unavailableSessionIds: [],
        ...data,
      };
      setState({ ...state, invigilators: [...state.invigilators, newInv] });
      notify(`Invigilator ${data.name} added to roster.`, 'success');
    }
  };

  const handleDeleteInvigilator = (id: string) => {
    if (!state) return;
    setState({ ...state, invigilators: state.invigilators.filter(i => i.id !== id) });
    notify('Invigilator removed.', 'info');
  };

  const handleToggleInvigilatorStatus = (invId: string, nextStatus: Invigilator['status']) => {
    if (!state) return;
    setState({
      ...state,
      invigilators: state.invigilators.map(i => (i.id === invId ? { ...i, status: nextStatus } : i)),
    });
    notify(`Invigilator status updated to ${nextStatus}.`, 'info');
  };

  const handleUpdateSettings = (settings: Settings) => {
    if (!state) return;
    setState({ ...state, settings });
    notify('Engine settings saved.', 'success');
  };

  const handleResetDemo = () => {
    setState(makeDemoData());
    setPreview(null);
    setPage('Dashboard');
    notify('Original demo dataset restored (64 candidates, 4 rooms, 5 staff).', 'info');
  };

  if (!state) return null;

  // 5 Navigation Groups strictly adhering to Master Prompt Section 3
  const navSections: {
    group: NavGroup;
    items: { name: Page; icon: any; badge?: string }[];
  }[] = [
    {
      group: 'Overview',
      items: [{ name: 'Dashboard', icon: LayoutDashboard }],
    },
    {
      group: 'Planning Operations',
      items: [
        { name: 'Planner', icon: SlidersHorizontal },
        { name: 'Disruption Studio', icon: RefreshCw },
      ],
    },
    {
      group: 'Data Management',
      items: [
        { name: 'Students', icon: GraduationCap },
        { name: 'Subjects & Sessions', icon: CalendarDays },
        { name: 'Rooms', icon: DoorOpen },
        { name: 'Invigilators', icon: Users },
      ],
    },
    {
      group: 'Validation & Diagnostics',
      items: [
        {
          name: 'Validation',
          icon: ShieldCheck,
          badge: current?.validation.status === 'VALID' ? 'dot-green' : 'dot-amber',
        },
        { name: 'Stress Benchmark', icon: Cpu },
      ],
    },
    {
      group: 'Reports & Exports',
      items: [{ name: 'Print & Notice Board', icon: Printer }],
    },
  ];

  const currentNavGroup = PAGE_GROUP_MAP[page] ?? 'Overview';

  return (
    <div className="app-shell">
      {/* Refined Forest Green Sidebar */}
      <aside className={`sidebar ${mobile ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">
            <BookOpen size={20} />
          </div>
          <div>
            <strong>ExamFlow</strong>
            <span>UNIVERSITY OPERATIONS</span>
          </div>
          <button className="icon-btn mobile-close" onClick={() => setMobile(false)} aria-label="Close navigation">
            <X size={16} />
          </button>
        </div>

        <div className="campus-pill">
          <span className="pulse" /> CONTROLLER OF EXAMS <ChevronDown size={13} />
        </div>

        {navSections.map(section => (
          <div className="nav-group" key={section.group}>
            <p>{section.group}</p>
            {section.items.map(item => (
              <button
                key={item.name}
                onClick={() => {
                  setPage(item.name);
                  setMobile(false);
                }}
                className={`nav-item ${page === item.name ? 'selected' : ''}`}
              >
                <item.icon size={16} />
                <span>{item.name}</span>
                {item.badge && <i className={item.badge} />}
              </button>
            ))}
          </div>
        ))}

        <div className="sidebar-bottom">
          <div className="secure-icon">
            <ShieldCheck size={16} />
          </div>
          <div>
            <b>Local-First Storage</b>
            <span>Zero cloud transmission · Private</span>
          </div>
        </div>
      </aside>

      {/* Main Operations Work Area */}
      <main className="main-area">
        {/* Compact Top Bar */}
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-btn mobile-menu" onClick={() => setMobile(true)} aria-label="Open navigation">
              <Menu size={18} />
            </button>
            <div className="breadcrumb-trail">
              <span className="crumb-root">{currentNavGroup}</span>
              <span className="crumb-slash">/</span>
              <span className="crumb-current">{page}</span>
            </div>

            <div className="topbar-slot-pill">
              <span>Current Slot:</span>
              <b>{slotId ? `Slot 1 (${slotId})` : 'None'}</b>
            </div>

            {current && (
              <div
                className={`topbar-status-badge ${
                  current.validation.status === 'VALID'
                    ? 'valid'
                    : current.validation.status === 'VALID_WITH_WARNINGS'
                    ? 'warning'
                    : 'invalid'
                }`}
              >
                {current.validation.status === 'VALID' ? (
                  <CheckCircle2 size={12} />
                ) : (
                  <AlertTriangle size={12} />
                )}
                <span>{current.validation.status.replaceAll('_', ' ')}</span>
              </div>
            )}
          </div>

          <div className="topbar-right">
            {state.students.some(s => s.usn === 'DEMO0001') && (
              <span className="demo-badge">
                <span /> DEMO DATA
              </span>
            )}
            <span className="offline-tag">
              <span /> OFFLINE ENGINE
            </span>
            <span className="avatar">EF</span>
          </div>
        </header>

        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                UNIVERSITY EXAMINATION CONTROLLER <span>•</span> TEAM 2392608111
              </div>
              <h1>{page}</h1>
              <p>
                {
                  {
                    Dashboard: 'Real-time university examination readiness, capacity utilization, and planning health.',
                    Planner: 'Interactive room seating grids, checkerboard parity interleaving, and manual overrides.',
                    'Disruption Studio': 'Simulate morning hall/staff disruptions with autonomous minimal-displacement replanning.',
                    Validation: 'Authoritative independent constraint verification (H1–H8 & S1) with offending pair drilldowns.',
                    'Print & Notice Board': 'Paper-ready master notice board charts, classroom door slips, attendance sheets, and CSVs.',
                    Students: 'Manage university candidate enrollments, registrations, and smart bulk CSV imports.',
                    'Subjects & Sessions': 'Scheduled courses, exam windows, and grouped overlapping planning slots.',
                    Rooms: 'Physical campus examination halls, desk dimensions, and capacity overrides.',
                    Invigilators: 'Supervising faculty roster, building permissions, and hall assignments.',
                    'Stress Benchmark': 'Live in-browser scalability stress simulations (100–1,000 candidates) and engine rules.',
                  }[page]
                }
              </p>
            </div>

            <div className="heading-actions">
              <button className="btn btn-secondary" onClick={handleResetDemo}>
                <RefreshCw size={14} /> Load Demo Data
              </button>
            </div>
          </div>

          {/* Router Content */}
          {page === 'Dashboard' && (
            <DashboardPage
              state={state}
              current={current}
              slotId={slotId}
              setSlotId={setSlotId}
              setPage={setPage}
              onGenerate={handleGenerate}
              onResetDemo={handleResetDemo}
            />
          )}

          {page === 'Planner' && (
            <PlannerPage
              state={state}
              current={current}
              slotId={slotId}
              setSlotId={setSlotId}
              onGenerate={handleGenerate}
              onRevalidate={handleRevalidate}
              onSwapSeats={handleSwapSeats}
              onGoToDisruptionStudio={() => setPage('Disruption Studio')}
              onPrintHall={() => setPage('Print & Notice Board')}
            />
          )}

          {page === 'Disruption Studio' && (
            <DisruptionStudioPage
              state={state}
              current={current}
              onReplan={handleReplan}
              onAcceptPreview={handleAcceptPreview}
              onDiscardPreview={handleDiscardPreview}
              preview={preview}
            />
          )}

          {page === 'Validation' && (
            <ValidationPage
              state={state}
              current={current}
              onRevalidate={handleRevalidate}
              onGoToPlanner={() => setPage('Planner')}
            />
          )}

          {page === 'Print & Notice Board' && (
            <PrintExportPage
              state={state}
              current={current}
              onDownloadCsv={download}
              onRestoreRevision={revId => {
                setState({ ...state, currentRevisionId: revId });
                notify(`Restored active view to revision ${revId}.`, 'info');
              }}
            />
          )}

          {page === 'Students' && (
            <StudentsPage
              state={state}
              onSaveStudent={handleSaveStudent}
              onDeleteStudent={handleDeleteStudent}
              onOpenCsvImport={() => setCsvImportOpen(true)}
              onDownloadCsv={download}
            />
          )}

          {page === 'Subjects & Sessions' && (
            <SubjectsSessionsPage
              state={state}
              onSaveSubject={handleSaveSubject}
              onDeleteSubject={handleDeleteSubject}
              onSaveSession={handleSaveSession}
              onDeleteSession={handleDeleteSession}
              onPlanSlot={sId => {
                setSlotId(sId);
                setPage('Planner');
              }}
            />
          )}

          {page === 'Rooms' && (
            <RoomsPage
              state={state}
              onSaveRoom={handleSaveRoom}
              onDeleteRoom={handleDeleteRoom}
              onToggleStatus={handleToggleRoomStatus}
              onTriggerDisruption={disruption => {
                handleReplan(disruption);
              }}
            />
          )}

          {page === 'Invigilators' && (
            <InvigilatorsPage
              state={state}
              onSaveInvigilator={handleSaveInvigilator}
              onDeleteInvigilator={handleDeleteInvigilator}
              onToggleStatus={handleToggleInvigilatorStatus}
              onTriggerDisruption={disruption => {
                handleReplan(disruption);
              }}
            />
          )}

          {page === 'Stress Benchmark' && (
            <BenchmarkSettingsPage
              state={state}
              onUpdateSettings={handleUpdateSettings}
              onLoadBenchmarkScenario={benchState => {
                setState(benchState);
                const s = slotsFor(benchState);
                if (s.length) setSlotId(s[0].id);
                setPage('Planner');
                notify('Large benchmark scenario loaded! Click Generate Plan to inspect.', 'success');
              }}
              onResetDemo={handleResetDemo}
            />
          )}
        </div>

        <footer className="app-footer">
          <span>
            ExamFlow <span className="footer-dot">•</span> University Examination Operations Platform
          </span>
          <span>Team 2392608111 · Explainable Seating, Replanned in Seconds</span>
        </footer>
      </main>

      {/* Real-time Operations Toast */}
      {toast && (
        <div className={`toast toast-${toast.type ?? 'info'}`} role="status">
          {toast.type === 'error' || toast.type === 'warning' ? (
            <AlertTriangle size={16} />
          ) : (
            <CheckCircle2 size={16} />
          )}
          <span>{toast.text}</span>
          <button onClick={() => setToast(null)} aria-label="Dismiss notification">
            <X size={14} />
          </button>
        </div>
      )}

      {/* CSV Bulk Importer Modal */}
      {csvImportOpen && (
        <CsvImportModal
          state={state}
          onImport={handleBulkImport}
          onClose={() => setCsvImportOpen(false)}
        />
      )}
    </div>
  );
}
