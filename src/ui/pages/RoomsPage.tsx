import React, { useState } from 'react';
import {
  DoorOpen,
  Edit2,
  Eye,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import type { AppState, Room } from '../../engine/types';
import { usable } from '../../engine/engine';
import { RoomModal } from '../components/EntityModals';

interface RoomsPageProps {
  state: AppState;
  onSaveRoom: (
    room: {
      name: string;
      building?: string;
      rows: number;
      columns: number;
      capacityOverride?: number;
      status: Room['status'];
    },
    editId?: string
  ) => void;
  onDeleteRoom: (id: string) => void;
  onToggleStatus: (roomId: string, nextStatus: Room['status']) => void;
  onTriggerDisruption: (disruption: { type: any; id: string }) => void;
}

export const RoomsPage: React.FC<RoomsPageProps> = ({
  state,
  onSaveRoom,
  onDeleteRoom,
  onToggleStatus,
  onTriggerDisruption,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [previewRoom, setPreviewRoom] = useState<Room | null>(null);

  const currentPlan = state.revisions.find(r => r.id === state.currentRevisionId);

  return (
    <div className="rooms-container">
      {/* Header Toolbar */}
      <div className="toolbar panel">
        <div>
          <h2>Examination Halls & Facilities ({state.rooms.length} Halls)</h2>
          <p>Physical campus exam rooms, desk layout matrices, and usable capacity bounds.</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingRoom(null);
            setModalOpen(true);
          }}
        >
          <Plus size={14} /> Add Exam Room
        </button>
      </div>

      {/* Room Cards Grid */}
      <div className="entity-grid">
        {state.rooms.map(room => {
          const cap = usable(room);
          const rawTotal = room.rows * room.columns;
          const assignedInCurrent = currentPlan?.assignments.filter(a => a.roomId === room.id).length ?? 0;
          const occupancyRate = cap > 0 ? Math.round((assignedInCurrent / cap) * 100) : 0;

          return (
            <section className="panel entity-card" key={room.id}>
              <div className="entity-card-head">
                <div className="entity-icon">
                  <DoorOpen size={18} />
                </div>
                <div className="head-right">
                  <span
                    className={`mini-pill ${
                      room.status === 'active' ? 'success' : room.status === 'unavailable' ? 'warning' : 'danger'
                    }`}
                  >
                    {room.status.toUpperCase()}
                  </span>
                  <div className="table-actions">
                    <button
                      className="icon-action-btn"
                      title="Preview physical desk layout"
                      onClick={() => setPreviewRoom(room)}
                    >
                      <Eye size={13} />
                    </button>
                    <button
                      className="icon-action-btn"
                      title="Edit room configuration"
                      onClick={() => {
                        setEditingRoom(room);
                        setModalOpen(true);
                      }}
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      className="icon-action-btn danger"
                      title="Delete room"
                      onClick={() => {
                        if (confirm(`Delete hall ${room.name}? Associated assignments will be invalidated.`)) {
                          onDeleteRoom(room.id);
                        }
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>

              <h3>Hall {room.name}</h3>
              <p>
                {room.building} · {room.rows} rows × {room.columns} cols ({rawTotal} desk matrix)
              </p>

              <div className="capacity-meter">
                <div>
                  <span>Usable Capacity</span>
                  <b>
                    {cap} seats {room.capacityOverride !== undefined && `(${room.capacityOverride} override)`}
                  </b>
                </div>
                <div className="meter">
                  <i style={{ width: `${Math.min(100, occupancyRate)}%` }} />
                </div>
                <span className="meter-note">
                  {assignedInCurrent} candidates seated in current plan ({occupancyRate}% utilization)
                </span>
              </div>

              <div className="entity-actions">
                <button
                  className="btn btn-secondary btn-xs"
                  onClick={() => {
                    const next = room.status === 'active' ? 'withdrawn' : 'active';
                    onToggleStatus(room.id, next);
                  }}
                >
                  {room.status === 'active' ? 'Withdraw Hall' : 'Restore Hall'}
                </button>

                <button
                  className="btn btn-secondary btn-xs"
                  onClick={() => setPreviewRoom(room)}
                >
                  <Eye size={12} /> View Desk Grid
                </button>

                <button
                  className="btn btn-secondary btn-xs"
                  onClick={() => {
                    onTriggerDisruption({
                      type: room.status === 'active' ? 'withdraw-room' : 'restore-room',
                      id: room.id,
                    });
                  }}
                >
                  <RefreshCw size={12} /> Test Replan
                </button>
              </div>
            </section>
          );
        })}
      </div>

      {/* Desk Matrix Preview Modal */}
      {previewRoom && (
        <div className="modal-backdrop" onClick={() => setPreviewRoom(null)}>
          <div className="modal-dialog md" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <span className="modal-badge"><DoorOpen size={12} /> Hall {previewRoom.name}</span>
                <h3>Physical Desk Layout Matrix ({previewRoom.rows} × {previewRoom.columns})</h3>
              </div>
              <button className="icon-btn" onClick={() => setPreviewRoom(null)}><X size={16} /></button>
            </div>

            <div className="modal-body">
              <p className="modal-desc">
                {previewRoom.building} · Physical Matrix: {previewRoom.rows * previewRoom.columns} desks · Usable Limit: {usable(previewRoom)} desks.
                Blocked desks (past usable capacity or inactive room) are highlighted with a dashed cross.
              </p>

              <div className="seat-grid-wrap" style={{ background: '#F8FAF7', borderRadius: '8px', border: '1px solid var(--line)' }}>
                <div
                  className="seat-grid"
                  style={{ gridTemplateColumns: `repeat(${previewRoom.columns}, minmax(36px, 1fr))` }}
                >
                  {Array.from({ length: previewRoom.rows * previewRoom.columns }, (_, idx) => {
                    const row = Math.floor(idx / previewRoom.columns) + 1;
                    const col = (idx % previewRoom.columns) + 1;
                    const cap = usable(previewRoom);
                    const isBlocked = idx >= cap || previewRoom.status !== 'active';

                    return (
                      <div
                        key={idx}
                        className={`seat ${isBlocked ? 'blocked' : 'empty'}`}
                        title={isBlocked ? `Row ${row}, Col ${col} · Blocked Seat` : `Row ${row}, Col ${col} · Usable Desk`}
                      >
                        {isBlocked ? <X size={12} /> : `${row}.${col}`}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPreviewRoom(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <RoomModal
          initial={editingRoom}
          onSave={data => {
            onSaveRoom(data, editingRoom?.id);
            setModalOpen(false);
          }}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
};
