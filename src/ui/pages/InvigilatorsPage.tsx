import React, { useState } from 'react';
import {
  Edit2,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from 'lucide-react';
import type { AppState, Invigilator } from '../../engine/types';
import { InvigilatorModal } from '../components/EntityModals';

interface InvigilatorsPageProps {
  state: AppState;
  onSaveInvigilator: (
    inv: { staffId: string; name: string; eligibleBuildings?: string[]; status: Invigilator['status'] },
    editId?: string
  ) => void;
  onDeleteInvigilator: (id: string) => void;
  onToggleStatus: (invId: string, nextStatus: Invigilator['status']) => void;
  onTriggerDisruption: (disruption: { type: any; id: string }) => void;
}

export const InvigilatorsPage: React.FC<InvigilatorsPageProps> = ({
  state,
  onSaveInvigilator,
  onDeleteInvigilator,
  onToggleStatus,
  onTriggerDisruption,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingInv, setEditingInv] = useState<Invigilator | null>(null);

  const currentPlan = state.revisions.find(r => r.id === state.currentRevisionId);

  return (
    <div className="invigilators-container">
      {/* Header Toolbar */}
      <div className="toolbar panel">
        <div>
          <h2>Invigilator & Faculty Roster ({state.invigilators.length})</h2>
          <p>Supervising professors and hall invigilation availability.</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingInv(null);
            setModalOpen(true);
          }}
        >
          <Plus size={15} /> Add Invigilator
        </button>
      </div>

      {/* Invigilators Table */}
      <section className="panel table-panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Staff ID</th>
                <th>Invigilator Name</th>
                <th>Status</th>
                <th>Building Eligibility</th>
                <th>Blacklisted Sessions</th>
                <th>Current Plan Duty</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {state.invigilators.map(inv => {
                const assign = currentPlan?.invigilatorAssignments.find(a => a.invigilatorId === inv.id);
                const room = assign ? state.rooms.find(r => r.id === assign.roomId) : null;

                return (
                  <tr key={inv.id}>
                    <td><b className="mono">{inv.staffId}</b></td>
                    <td><b>{inv.name}</b></td>
                    <td>
                      <span className={`mini-pill ${inv.status === 'active' ? 'success' : 'danger'}`}>
                        {inv.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {inv.eligibleBuildings?.length ? (
                        inv.eligibleBuildings.join(', ')
                      ) : (
                        <span className="muted-text">All University Blocks</span>
                      )}
                    </td>
                    <td>
                      {inv.unavailableSessionIds?.length ? (
                        inv.unavailableSessionIds.map(s => <span key={s} className="mini-pill warning mr-1">{s}</span>)
                      ) : (
                        <span className="muted-text">None (Fully Available)</span>
                      )}
                    </td>
                    <td>
                      {room ? (
                        <span className="room-duty-chip">
                          Hall {room.name} ({room.building})
                        </span>
                      ) : (
                        <span className="muted-text">Standby / Unrostered</span>
                      )}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="btn btn-secondary btn-xs"
                          onClick={() => {
                            const next = inv.status === 'active' ? 'unavailable' : 'active';
                            onToggleStatus(inv.id, next);
                          }}
                        >
                          {inv.status === 'active' ? 'Mark Absent' : 'Restore'}
                        </button>
                        <button
                          className="icon-action-btn"
                          title="Edit staff profile"
                          onClick={() => {
                            setEditingInv(inv);
                            setModalOpen(true);
                          }}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          className="icon-action-btn danger"
                          title="Delete invigilator"
                          onClick={() => {
                            if (confirm(`Delete invigilator ${inv.name}?`)) {
                              onDeleteInvigilator(inv.id);
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
      </section>

      {modalOpen && (
        <InvigilatorModal
          initial={editingInv}
          onSave={data => {
            onSaveInvigilator(data, editingInv?.id);
            setModalOpen(false);
          }}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
};

