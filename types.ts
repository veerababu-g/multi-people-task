
export enum TaskCategory {
  NEW_LEARNING = 'New Learning',
  REVISION = 'Revision',
  BREAK = 'Break'
}

export interface Task {
  id: string;
  userId: string;
  date: string; // ISO format (YYYY-MM-DD)
  title: string;
  category: TaskCategory;
  topic: string;
  duration: number; // in minutes
  completed: boolean;
  completionPercentage: number;
  startTime: string; // HH:mm
  syncStatus?: 'idle' | 'syncing' | 'success' | 'error';
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  streak: number;
}

export interface DailyStats {
  date: string;
  completedHours: number;
  plannedHours: number;
  completionRate: number;
}

export interface AISuggestion {
  title: string;
  topic: string;
  duration: number;
  category: TaskCategory;
  reason: string;
}
