import React, { createContext, useContext, useState, useEffect } from 'react';

const OrgContext = createContext();

export const useOrg = () => useContext(OrgContext);

const API_BASE = 'http://localhost:5000/api';

export const OrgProvider = ({ children }) => {
  const [orgs, setOrgs] = useState([]);

  // 從後端獲取組織資料
  const fetchOrgs = async () => {
    try {
      const res = await fetch(`${API_BASE}/orgs`);
      if (!res.ok) throw new Error('Network response was not ok');
      const data = await res.json();
      setOrgs(data);
    } catch (err) {
      console.error('Failed to fetch orgs:', err);
    }
  };

  useEffect(() => {
    fetchOrgs();
  }, []);

  // 新增組織節點
  const addOrg = async (org) => {
    try {
      const res = await fetch(`${API_BASE}/orgs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(org),
      });
      if (!res.ok) throw new Error('Failed to add org');
      const data = await res.json();
      setOrgs(prev => [...prev, data]);
    } catch (err) {
      console.error('Failed to add org node:', err);
    }
  };

  // 更新組織節點
  const updateOrg = async (id, updatedOrg) => {
    try {
      const res = await fetch(`${API_BASE}/orgs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedOrg),
      });
      if (!res.ok) throw new Error('Failed to update org node');
      const data = await res.json();
      setOrgs(prev => prev.map(o => o.id === id ? data : o));
    } catch (err) {
      console.error('Failed to update org node:', err);
    }
  };

  // 刪除組織節點及下屬 (後端已實作 recursive 刪除，故本地直接過濾掉傳回的刪除 ID)
  const deleteOrg = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/orgs/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete org node');
      const result = await res.json();
      const deletedIds = result.deletedIds || [id];
      setOrgs(prev => prev.filter(o => !deletedIds.includes(o.id)));
    } catch (err) {
      console.error('Failed to delete org node:', err);
    }
  };

  // 導入資料 (批次新增)
  const importOrgs = async (importedOrgs) => {
    try {
      for (const o of importedOrgs) {
        await addOrg(o);
      }
    } catch (err) {
      console.error('Failed to import orgs:', err);
    }
  };

  // 重置組織資料為預設
  const resetOrgs = async () => {
    try {
      const res = await fetch(`${API_BASE}/orgs/reset`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to reset orgs');
      const data = await res.json();
      setOrgs(data);
    } catch (err) {
      console.error('Failed to reset orgs:', err);
    }
  };

  return (
    <OrgContext.Provider value={{ orgs, addOrg, updateOrg, deleteOrg, importOrgs, resetOrgs }}>
      {children}
    </OrgContext.Provider>
  );
};
