import React, { createContext, useContext, useState, useEffect } from 'react';

const TaskContext = createContext();

export const useTasks = () => useContext(TaskContext);

const API_BASE = 'http://localhost:5000/api';

export const TaskProvider = ({ children }) => {
  const [tasks, setTasks] = useState([]);

  // 從後端獲取任務
  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API_BASE}/tasks`);
      if (!res.ok) throw new Error('Network response was not ok');
      const data = await res.json();
      setTasks(data);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  // 新增任務
  const addTask = async (task) => {
    try {
      const res = await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task),
      });
      if (!res.ok) throw new Error('Failed to add task');
      const data = await res.json();
      setTasks(prev => [...prev, data]);
    } catch (err) {
      console.error('Failed to add task:', err);
    }
  };

  // 更新任務
  const updateTask = async (id, updatedTask) => {
    try {
      const res = await fetch(`${API_BASE}/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTask),
      });
      if (!res.ok) throw new Error('Failed to update task');
      const data = await res.json();
      setTasks(prev => prev.map(t => t.id === id ? data : t));
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  // 刪除單一任務
  const deleteTask = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/tasks/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete task');
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  // 批量刪除任務
  const deleteTasks = async (ids) => {
    try {
      const res = await fetch(`${API_BASE}/tasks/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error('Failed to bulk delete tasks');
      setTasks(prev => prev.filter(t => !ids.includes(t.id)));
    } catch (err) {
      console.error('Failed to bulk delete tasks:', err);
    }
  };

  // 導入多個任務 (迴圈新增)
  const importTasks = async (importedTasks) => {
    try {
      for (const t of importedTasks) {
        await addTask(t);
      }
    } catch (err) {
      console.error('Failed to import tasks:', err);
    }
  };
  
  // 重置任務為模擬任務
  const resetTasks = async () => {
    try {
      const res = await fetch(`${API_BASE}/tasks/reset`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to reset tasks');
      const data = await res.json();
      setTasks(data);
    } catch (err) {
      console.error('Failed to reset tasks:', err);
    }
  };

  return (
    <TaskContext.Provider value={{ tasks, addTask, updateTask, deleteTask, deleteTasks, importTasks, resetTasks }}>
      {children}
    </TaskContext.Provider>
  );
};
