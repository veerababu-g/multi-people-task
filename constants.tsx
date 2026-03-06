
import React from 'react';
import { User, TaskCategory } from './types';

export const USERS: User[] = [
  {
    id: 'veerababu',
    name: 'Veerababu',
    avatar: 'https://picsum.photos/seed/veera/200',
    streak: 0
  },
  {
    id: 'dinesh',
    name: 'Dinesh',
    avatar: 'https://picsum.photos/seed/dinesh/200',
    streak: 0
  }
];

export const TOPICS = {
  [TaskCategory.NEW_LEARNING]: ['Java', 'Python', 'ML', 'AI', 'System Design', 'Algorithms'],
  [TaskCategory.REVISION]: ['Full Stack', 'React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Tailwind'],
  [TaskCategory.BREAK]: ['Short Break', 'Long Break', 'Exercise', 'Lunch']
};

export const TARGET_DAILY_HOURS = 6;
