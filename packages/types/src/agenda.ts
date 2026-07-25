export type AgendaAccessLevel = 'OWNER' | 'WRITE' | 'READ';

export type AgendaMemberRecord = {
  id: string;
  agendaId: string;
  userId: string;
  accessLevel: AgendaAccessLevel;
  createdAt: string;
  updatedAt: string;
};

export type AgendaRecord = {
  id: string;
  scopeType: string;
  scopeId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  members?: AgendaMemberRecord[];
  _count?: { members: number };
};

export type AgendaSummaryRecord = {
  id: string;
  name: string;
  description: string | null;
  accessLevel: AgendaAccessLevel | null;
  memberCount: number;
};

export type AgendaBootstrapRecord = {
  hasAccess: boolean;
  agendas: AgendaSummaryRecord[];
};

export type AgendaAccessRecord = {
  hasAccess: boolean;
  accessibleAgendaIds: string[];
};

export type AgendaEventParticipantRecord = {
  id: string;
  userId: string;
};

export type AgendaEventTodoTaskRecord = {
  id: string;
  eventId: string;
  title: string;
  description: string | null;
  completed: boolean;
  completedAt: string | null;
  order: number;
  createdAt?: string;
  updatedAt?: string;
};

export type AgendaEventRecord = {
  id: string;
  agendaId: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  createdById: string | null;
  participants: AgendaEventParticipantRecord[];
  todoTasks: AgendaEventTodoTaskRecord[];
  isParticipant: boolean;
  agendaName: string;
};

export type AgendaTodoTaskRecord = {
  id: string;
  categoryId: string;
  title: string;
  description: string | null;
  completed: boolean;
  completedAt: string | null;
  order: number;
  createdAt?: string;
  updatedAt?: string;
};

export type AgendaTodoCategoryRecord = {
  id: string;
  listId: string;
  name: string;
  order: number;
  tasks: AgendaTodoTaskRecord[];
  createdAt?: string;
  updatedAt?: string;
};

export type AgendaTodoListRecord = {
  id: string;
  agendaId: string;
  name: string;
  order: number;
  categories: AgendaTodoCategoryRecord[];
  createdAt?: string;
  updatedAt?: string;
};

export type AgendaMutationMeta = {
  originClientId?: string;
};

export type AgendaScopeParams = {
  scopeType: string;
  scopeId: string;
};
