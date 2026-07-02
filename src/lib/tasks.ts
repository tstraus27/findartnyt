export type TaskStatus = 'todo' | 'doing' | 'done';
export type TimeHorizon = 'Today' | 'This Week' | 'Upcoming' | 'Open-ended';

export type Task = {
  id: string;
  title: string;
  notes: string;
  tags: string[];
  list: string;
  createdAt: string;
  dueAt: string | null;
  completed: boolean;
  completedAt: string | null;
  status: TaskStatus;
  archived: boolean;
  subtasks: string[];
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

const parseDue = (dueAt: string): Date => {
  if (dueAt.includes('T')) return new Date(dueAt);
  const [y, m, d] = dueAt.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const formatDateOnly = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const isSameDay = (a: Date, b: Date) =>
  startOfDay(a).getTime() === startOfDay(b).getTime();

const isSameMonth = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

const getWeekStart = (d: Date) => {
  const day = d.getDay();
  const diff = d.getDate() - day;
  return startOfDay(new Date(d.getFullYear(), d.getMonth(), diff));
};

const getWeekEnd = (d: Date) => {
  const start = getWeekStart(d);
  return endOfDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6));
};

const getRollingWeekEnd = (d: Date) => {
  return endOfDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 6));
};

export const computeQuadrant = (task: Task): TimeHorizon => {
  if (!task.dueAt) return 'Open-ended';
  const due = parseDue(task.dueAt);
  const now = new Date();
  if (isSameDay(due, now)) return 'Today';
  const weekStart = getWeekStart(now);
  const weekEnd = getWeekEnd(now);
  const rollingEnd = getRollingWeekEnd(now);
  if (due >= weekStart && due <= weekEnd) return 'This Week';
  if (due > now && due <= rollingEnd) return 'This Week';
  if (isSameMonth(due, now)) return 'Upcoming';
  return 'Open-ended';
};

export const dateForQuadrant = (q: TimeHorizon): string | null => {
  const now = new Date();
  if (q === 'Open-ended') return null;
  if (q === 'Today') return formatDateOnly(now);
  if (q === 'This Week') return formatDateOnly(getRollingWeekEnd(now));
  // Upcoming -> end of current month
  const endOfMonth = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  return formatDateOnly(endOfMonth);
};

export const createTask = (partial: Omit<Task, 'id' | 'createdAt'>): Task => ({
  ...partial,
  id: crypto.randomUUID(),
  createdAt: new Date().toISOString()
});

export const updateTask = (task: Task, patch: Partial<Task>): Task => ({
  ...task,
  ...patch
});

export const deleteTask = (tasks: Task[], id: string): Task[] =>
  tasks.filter((t) => t.id !== id);

export const completeTask = (task: Task): Task =>
  updateTask(task, { status: 'done', completed: true, completedAt: new Date().toISOString() });

export const setDueDate = (task: Task, dueAt: string | null): Task =>
  updateTask(task, { dueAt });

export const setTags = (task: Task, tags: string[]): Task =>
  updateTask(task, { tags });

export const moveList = (task: Task, list: string): Task =>
  updateTask(task, { list });

export const compareByDueThenCreated = (a: Task, b: Task): number => {
  if (a.dueAt && b.dueAt) {
    const d = parseDue(a.dueAt).getTime() - parseDue(b.dueAt).getTime();
    return d !== 0 ? d : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  }
  if (a.dueAt && !b.dueAt) return -1;
  if (!a.dueAt && b.dueAt) return 1;
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
};
