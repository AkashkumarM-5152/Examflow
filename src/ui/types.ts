export type Page =
  | 'Dashboard'
  | 'Planner'
  | 'Disruption Studio'
  | 'Students'
  | 'Subjects & Sessions'
  | 'Rooms'
  | 'Invigilators'
  | 'Validation'
  | 'Stress Benchmark'
  | 'Print & Notice Board';

export type NavGroup =
  | 'Overview'
  | 'Planning Operations'
  | 'Data Management'
  | 'Validation & Diagnostics'
  | 'Reports & Exports';

export interface ToastMessage {
  id: string;
  text: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}

export const PAGE_GROUP_MAP: Record<Page, NavGroup> = {
  Dashboard: 'Overview',
  Planner: 'Planning Operations',
  'Disruption Studio': 'Planning Operations',
  Students: 'Data Management',
  'Subjects & Sessions': 'Data Management',
  Rooms: 'Data Management',
  Invigilators: 'Data Management',
  Validation: 'Validation & Diagnostics',
  'Stress Benchmark': 'Validation & Diagnostics',
  'Print & Notice Board': 'Reports & Exports',
};
