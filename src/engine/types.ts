export type RoomStatus = 'active'|'unavailable'|'withdrawn';
export type PlanStatus = 'VALID'|'VALID_WITH_WARNINGS'|'INCOMPLETE'|'INFEASIBLE'|'INVALID';
export interface Student {id:string;usn:string;name:string}
export interface Subject {id:string;code:string;name:string}
export interface ExamSession {id:string;subjectId:string;date:string;startTime:string;endTime:string}
export interface Registration {id:string;studentId:string;sessionId:string}
export interface Room {id:string;name:string;building?:string;rows:number;columns:number;capacityOverride?:number;status:RoomStatus;unavailableSessionIds:string[]}
export interface Invigilator {id:string;staffId:string;name:string;unavailableSessionIds:string[];eligibleBuildings?:string[];status:'active'|'unavailable'}
export interface SeatingAssignment {id:string;studentId:string;sessionId:string;roomId:string;row:number;column:number;assignedAt:string}
export interface InvigilatorAssignment {id:string;invigilatorId:string;slotId:string;roomId:string}
export interface UnassignedEntry {studentId:string;sessionId:string;reason:'NO_CAPACITY'|'EXAM_CLASH'|'NO_ROOM'|'OTHER';detail:string}
export interface UncoveredRoom {roomId:string;required:number;assigned:number;reason:string}
export interface Check {name:string;passed:boolean;count:number;detail:string}
export interface ValidationReport {status:PlanStatus;hardViolations:string[];softViolations:string[];checks:Check[];unassigned:UnassignedEntry[];uncovered:UncoveredRoom[];suggestedActions:string[]}
export interface PlanRevision {id:string;parentRevisionId?:string;createdAt:string;changeDescription:string;slotId:string;assignments:SeatingAssignment[];invigilatorAssignments:InvigilatorAssignment[];unassigned:UnassignedEntry[];uncovered:UncoveredRoom[];validation:ValidationReport;computeMs:number}
export interface Settings {invigilatorsPerRoom:number;largeRoomThreshold:number;largeRoomInvigilators:number}
export interface AppState {schemaVersion:number;students:Student[];subjects:Subject[];sessions:ExamSession[];registrations:Registration[];rooms:Room[];invigilators:Invigilator[];revisions:PlanRevision[];currentRevisionId:string|null;settings:Settings}
export interface Plan {slotId:string;assignments:SeatingAssignment[];invigilatorAssignments:InvigilatorAssignment[];unassigned:UnassignedEntry[];uncovered:UncoveredRoom[];validation:ValidationReport;computeMs:number}
