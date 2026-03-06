
import React, { useState, useEffect } from 'react';
import { Task, TaskCategory } from '../types';
import { TOPICS } from '../constants';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Partial<Task>) => void;
  editTask?: Task | null;
}

const TaskModal: React.FC<TaskModalProps> = ({ isOpen, onClose, onSave, editTask }) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TaskCategory>(TaskCategory.NEW_LEARNING);
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState(60);
  const [startTime, setStartTime] = useState('09:00');

  useEffect(() => {
    if (editTask) {
      setTitle(editTask.title);
      setCategory(editTask.category);
      setTopic(editTask.topic);
      setDuration(editTask.duration);
      setStartTime(editTask.startTime);
    } else {
      setTitle('');
      setCategory(TaskCategory.NEW_LEARNING);
      setTopic(TOPICS[TaskCategory.NEW_LEARNING][0]);
      setDuration(60);
      setStartTime('09:00');
    }
  }, [editTask, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">{editTask ? 'Edit Task' : 'Add New Task'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Task Title</label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              placeholder="e.g. Study Concurrency in Java"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
              <select 
                value={category}
                onChange={(e) => {
                  const newCat = e.target.value as TaskCategory;
                  setCategory(newCat);
                  setTopic(TOPICS[newCat][0] || '');
                }}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                {Object.values(TaskCategory).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Topic</label>
              <select 
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                {TOPICS[category].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
                <option value="Custom">Custom Topic</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Duration (Min)</label>
              <input 
                type="number" 
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                min="5"
                step="5"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Time</label>
              <input 
                type="time" 
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-200 transition-colors font-medium"
          >
            Cancel
          </button>
          <button 
            onClick={() => onSave({ title, category, topic, duration, startTime })}
            className="px-6 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all font-bold"
          >
            Save Task
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskModal;
