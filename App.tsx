
import React, { useState, useEffect, useMemo } from 'react';
import { User, Task, DailyStats, TaskCategory, AISuggestion } from './types';
import { USERS, TARGET_DAILY_HOURS } from './constants';
import CircularProgress from './components/CircularProgress';
import TaskModal from './components/TaskModal';
import HistoryHeatmap from './components/HistoryHeatmap';
import { getTaskSuggestions } from './geminiService';
import { saveTaskToGoogleSheet } from './googleSheetService';

const App: React.FC = () => {
  const [activeUserId, setActiveUserId] = useState<string>(USERS[0].id);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; error?: string } | null>(null);

  const currentUser = useMemo(() => USERS.find(u => u.id === activeUserId)!, [activeUserId]);
  const today = new Date().toISOString().split('T')[0];

  const fetchTasks = async () => {
    try {
      const statusRes = await fetch('/api/db-status');
      const status = await statusRes.json();
      setDbStatus(status);
      
      if (!status.connected) return;

      const response = await fetch(`/api/tasks/${activeUserId}`);
      if (response.ok) {
        const data = await response.json();
        setTasks(data.map((t: any) => ({ ...t, syncStatus: 'idle' })));
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [activeUserId]);

  const userTasksToday = useMemo(() => 
    tasks.filter(t => t.userId === activeUserId && t.date === today)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
  , [tasks, activeUserId, today]);

  const stats = useMemo(() => {
    const learningTasks = userTasksToday.filter(t => t.category !== TaskCategory.BREAK);
    
    const plannedMins = learningTasks.reduce((acc, t) => acc + t.duration, 0);
    const completedMins = learningTasks.reduce((acc, t) => acc + (t.completed ? t.duration : 0), 0);
    const completionRate = plannedMins > 0 ? (completedMins / plannedMins) * 100 : 0;
    
    return {
      plannedMins,
      completedMins,
      completionRate,
      plannedHours: (plannedMins / 60).toFixed(1),
      completedHours: (completedMins / 60).toFixed(1),
      targetHours: TARGET_DAILY_HOURS
    };
  }, [userTasksToday]);

  const historyStats = useMemo(() => {
    const userHistory = tasks.filter(t => t.userId === activeUserId);
    const dateGroups = userHistory.reduce((acc, task) => {
      if (!acc[task.date]) acc[task.date] = [];
      acc[task.date].push(task);
      return acc;
    }, {} as Record<string, Task[]>);

    return Object.entries(dateGroups).map(([date, dayTasks]) => {
      const learningDayTasks = dayTasks.filter(t => t.category !== TaskCategory.BREAK);
      const pMins = learningDayTasks.reduce((acc, t) => acc + t.duration, 0);
      const cMins = learningDayTasks.reduce((acc, t) => acc + (t.completed ? t.duration : 0), 0);
      return {
        date,
        plannedHours: pMins / 60,
        completedHours: cMins / 60,
        completionRate: pMins > 0 ? (cMins / pMins) * 100 : 0
      };
    });
  }, [tasks, activeUserId]);

  const currentStreak = useMemo(() => {
    const sortedDates = historyStats
      .filter(s => s.completionRate > 50) 
      .map(s => s.date)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    let streak = 0;
    let checkDate = new Date();
    
    for (let i = 0; i < sortedDates.length; i++) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (sortedDates.includes(dateStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (i === 0) {
        checkDate.setDate(checkDate.getDate() - 1);
        const yestStr = checkDate.toISOString().split('T')[0];
        if (sortedDates.includes(yestStr)) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      } else {
        break;
      }
    }
    return streak;
  }, [historyStats]);

  const handleAddTask = async (taskData: Partial<Task>) => {
    if (editingTask) {
      const updatedTask = { ...editingTask, ...taskData };
      try {
        const response = await fetch(`/api/tasks/${editingTask.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedTask),
        });
        if (response.ok) {
          setTasks(prev => prev.map(t => t.id === editingTask.id ? updatedTask as Task : t));
        }
      } catch (err) {
        console.error('Failed to update task:', err);
      }
    } else {
      const newTask: Task = {
        id: crypto.randomUUID(),
        userId: activeUserId,
        date: today,
        completed: false,
        completionPercentage: 0,
        syncStatus: 'idle',
        ...taskData as any
      };
      try {
        const response = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newTask),
        });
        if (response.ok) {
          setTasks(prev => [...prev, newTask]);
        }
      } catch (err) {
        console.error('Failed to create task:', err);
      }
    }
    setIsModalOpen(false);
    setEditingTask(null);
  };

  const syncTask = async (task: Task) => {
    if (!task.completed) return;
    
    // Set status to syncing
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, syncStatus: 'syncing' } : t));
    
    const success = await saveTaskToGoogleSheet(task, currentUser.name);
    
    setTasks(prev => prev.map(t => 
      t.id === task.id ? { ...t, syncStatus: success ? 'success' : 'error' } : t
    ));
  };

  const toggleTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updatedTask = { ...task, completed: !task.completed, syncStatus: 'idle' as const };
    
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTask),
      });
      
      if (response.ok) {
        setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
        if (updatedTask.completed) {
          setTimeout(() => syncTask(updatedTask), 100);
        }
      }
    } catch (err) {
      console.error('Failed to toggle task:', err);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (confirm("Delete this task?")) {
      try {
        const response = await fetch(`/api/tasks/${taskId}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          setTasks(prev => prev.filter(t => t.id !== taskId));
        }
      } catch (err) {
        console.error('Failed to delete task:', err);
      }
    }
  };

  const handleAiSuggest = async () => {
    setIsAiLoading(true);
    const existingTopics = Array.from(new Set(userTasksToday.map(t => t.topic)));
    const suggestions = await getTaskSuggestions(currentUser.name, existingTopics);
    setAiSuggestions(suggestions);
    setIsAiLoading(false);
  };

  const addAiTask = async (suggestion: AISuggestion) => {
    const newTask: Task = {
      id: crypto.randomUUID(),
      userId: activeUserId,
      date: today,
      title: suggestion.title,
      category: suggestion.category,
      topic: suggestion.topic,
      duration: suggestion.duration,
      completed: false,
      completionPercentage: 0,
      syncStatus: 'idle',
      startTime: "10:00"
    };
    
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask),
      });
      if (response.ok) {
        setTasks(prev => [...prev, newTask]);
        setAiSuggestions(prev => prev.filter(s => s !== suggestion));
      }
    } catch (err) {
      console.error('Failed to add AI task:', err);
    }
  };

  return (
    <div className="min-h-screen pb-20 max-w-6xl mx-auto px-4 sm:px-6">
      {dbStatus && !dbStatus.connected && (
        <div className="bg-rose-50 border-b border-rose-100 px-4 py-2 text-rose-600 text-xs font-bold flex items-center justify-center gap-2 animate-in slide-in-from-top duration-500">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          Database Offline: {dbStatus.error}. Please check your DATABASE_URL environment variable.
        </div>
      )}
      <header className="sticky top-0 z-40 bg-slate-50/80 backdrop-blur-md pt-6 pb-4 border-b border-slate-200">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex bg-slate-200 p-1 rounded-xl shadow-inner">
            {USERS.map(user => (
              <button
                key={user.id}
                onClick={() => setActiveUserId(user.id)}
                className={`flex items-center gap-3 px-6 py-2 rounded-lg transition-all font-bold ${
                  activeUserId === user.id 
                  ? 'bg-white text-indigo-600 shadow-sm scale-[1.02]' 
                  : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <img src={user.avatar} className="w-6 h-6 rounded-full ring-2 ring-indigo-50" alt="" />
                {user.name}
              </button>
            ))}
          </div>
          <div className="text-right">
            <h1 className="text-lg font-bold text-slate-800">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h1>
            <p className="text-sm text-slate-500 font-medium">Focused Learning Mode</p>
          </div>
        </div>
      </header>

      <main className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-6">
          <div className="glass-card p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">Core Learning</h2>
            <p className="text-xs text-slate-400 mb-6 font-medium">(Excludes breaks)</p>
            <CircularProgress percentage={stats.completionRate} size={160} />
            <div className="mt-8 grid grid-cols-2 gap-8 w-full">
              <div className="text-center">
                <span className="block text-2xl font-black text-slate-800">{stats.completedHours}h</span>
                <span className="text-xs font-bold text-slate-400 uppercase">Actual</span>
              </div>
              <div className="text-center border-l border-slate-100">
                <span className="block text-2xl font-black text-slate-800">{stats.plannedHours}h</span>
                <span className="text-xs font-bold text-slate-400 uppercase">Planned</span>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-slate-100 w-full flex justify-between items-center">
              <span className="text-slate-600 font-bold flex items-center gap-2">
                <span className="text-orange-500">🔥</span> {currentStreak} Day Streak
              </span>
              <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full">Goal: 6h/day</span>
            </div>
          </div>

          <HistoryHeatmap stats={historyStats} />

          <div className="bg-indigo-600 p-6 rounded-2xl shadow-lg shadow-indigo-200 text-white relative overflow-hidden group">
            <div className="relative z-10">
              <h3 className="font-bold text-lg">AI Tutor Suggestions</h3>
              <p className="text-indigo-100 text-sm mt-1">Generate optimized learning tasks based on your progress.</p>
              <button 
                onClick={handleAiSuggest}
                disabled={isAiLoading}
                className="mt-4 w-full bg-white text-indigo-600 py-2.5 rounded-xl font-black text-sm shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isAiLoading ? (
                  <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : '🪄 Suggest Tasks'}
              </button>
            </div>
          </div>

          {aiSuggestions.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Suggested for today</h3>
              {aiSuggestions.map((s, idx) => (
                <div key={idx} className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm flex justify-between items-start gap-4 animate-in slide-in-from-right-4 duration-300">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600">{s.topic}</span>
                      <span className="text-xs text-slate-400 font-medium">{s.duration} min</span>
                    </div>
                    <h4 className="font-bold text-slate-800 mt-1">{s.title}</h4>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{s.reason}</p>
                  </div>
                  <button 
                    onClick={() => addAiTask(s)}
                    className="p-2 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-black text-slate-800">Your Schedule</h2>
            <button 
              onClick={() => { setEditingTask(null); setIsModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-lg shadow-slate-200 hover:bg-slate-800 active:scale-95 transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
              Add Task
            </button>
          </div>

          {userTasksToday.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
              <p className="text-slate-500 font-bold">No tasks planned for today</p>
            </div>
          ) : (
            <div className="space-y-4 relative">
              <div className="absolute left-8 top-8 bottom-8 w-0.5 bg-slate-100 -z-10 hidden sm:block"></div>
              
              {userTasksToday.map((task) => {
                const isBreak = task.category === TaskCategory.BREAK;
                return (
                  <div 
                    key={task.id}
                    className={`group flex flex-col sm:flex-row gap-4 items-start sm:items-center p-4 sm:p-5 bg-white rounded-2xl border transition-all duration-300 ${
                      task.completed 
                      ? 'border-emerald-100 bg-emerald-50/20 opacity-80' 
                      : isBreak 
                        ? 'border-amber-100 bg-amber-50/10 shadow-sm'
                        : 'border-slate-100 shadow-sm hover:shadow-md'
                    }`}
                  >
                    <div className="hidden sm:flex flex-col items-center justify-center w-16 text-xs font-black text-slate-400">
                      {task.startTime}
                    </div>

                    <div className="flex-1 flex gap-4 w-full">
                      <button 
                        onClick={() => toggleTask(task.id)}
                        className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                          task.completed 
                          ? 'bg-emerald-500 border-emerald-500 text-white' 
                          : isBreak
                            ? 'border-amber-200 text-transparent hover:border-amber-400'
                            : 'border-slate-200 text-transparent hover:border-indigo-400'
                        }`}
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                      </button>

                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${
                            task.category === TaskCategory.NEW_LEARNING ? 'bg-blue-100 text-blue-700' :
                            task.category === TaskCategory.REVISION ? 'bg-emerald-100 text-emerald-700' :
                            isBreak ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {task.category}
                          </span>
                          <span className="text-xs font-bold text-slate-400">{task.topic} • {task.duration} min</span>
                          
                          {/* Google Sheets Sync Indicator */}
                          {task.completed && (
                            <div className="flex items-center gap-1 ml-2">
                              {task.syncStatus === 'syncing' && (
                                <svg className="animate-spin h-3 w-3 text-indigo-400" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                              )}
                              {task.syncStatus === 'success' && (
                                <span title="Synced to Google Sheets" className="text-emerald-500">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M5.5 13a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 13H11V9.413l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13H5.5z"/><path d="M9 13h2v5a1 1 0 11-2 0v-5z"/></svg>
                                </span>
                              )}
                              {task.syncStatus === 'error' && (
                                <button onClick={() => syncTask(task)} title="Sync failed. Click to retry." className="text-rose-500">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd"/></svg>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        <h3 className={`text-base font-bold transition-all ${
                          task.completed ? 'line-through text-slate-400' : isBreak ? 'text-amber-900' : 'text-slate-800'
                        }`}>
                          {task.title}
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingTask(task); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5M16.242 19.121l3.757-3.757a2.121 2.121 0 000-3L16.242 8.636a2.121 2.121 0 00-3 0l-3.757 3.757a2.121 2.121 0 000 3l3.757 3.757a2.121 2.121 0 003 0z"/></svg>
                      </button>
                      <button onClick={() => deleteTask(task.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <TaskModal 
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingTask(null); }}
        onSave={handleAddTask}
        editTask={editingTask}
      />
    </div>
  );
};

export default App;
