const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

let db;

// 初始化資料庫與連線
async function initDb() {
  db = await open({
    filename: path.join(__dirname, 'database.sqlite'),
    driver: sqlite3.Database
  });

  // 1. 建立組織架構表 (orgs)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS orgs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      level TEXT,
      parentId TEXT
    )
  `);

  // 2. 建立任務表 (tasks)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      department TEXT,
      demandPerson TEXT,
      executingDepartment TEXT NOT NULL,
      executingPerson TEXT NOT NULL,
      priority TEXT NOT NULL,
      status TEXT NOT NULL,
      communicated INTEGER DEFAULT 0,
      remarks TEXT,
      project TEXT,
      archived INTEGER DEFAULT 0
    )
  `);

  // 3. 預設組織種子資料 (Seeding)
  const orgCount = await db.get('SELECT COUNT(*) as count FROM orgs');
  if (orgCount.count === 0) {
    const initialOrgs = [
      { id: 'o1', type: 'org', name: '品質系統部', level: '3', parentId: null },
      { id: 'o2', type: 'org', name: '品質技術課', level: '4', parentId: 'o1' },
      { id: 'o3', type: 'org', name: '品質技術組', level: '5', parentId: 'o2' },
      { id: 'o4', type: 'org', name: '供應商管理組', level: '5', parentId: 'o2' },
      { id: 'o5', type: 'org', name: '品質系統課', level: '4', parentId: 'o1' },
      { id: 'o6', type: 'org', name: '實驗室', level: '5', parentId: 'o5' },
      
      { id: 'p1', type: 'person', name: '邱怡鈞', parentId: 'o1' },
      { id: 'p2', type: 'person', name: '黃偉澤', parentId: 'o3' },
      { id: 'p3', type: 'person', name: '鄧啟宏', parentId: 'o4' },
      { id: 'p4', type: 'person', name: '黃沛芊', parentId: 'o4' },
      { id: 'p5', type: 'person', name: '林桂如', parentId: 'o6' },
      { id: 'p6', type: 'person', name: '李義勇', parentId: 'o5' }
    ];

    const stmt = await db.prepare('INSERT INTO orgs (id, type, name, level, parentId) VALUES (?, ?, ?, ?, ?)');
    for (const org of initialOrgs) {
      await stmt.run(org.id, org.type, org.name, org.level, org.parentId);
    }
    await stmt.finalize();
    console.log('Seeded default orgs successfully.');
  }

  // 4. 預設任務種子資料 (Seeding)
  const taskCount = await db.get('SELECT COUNT(*) as count FROM tasks');
  if (taskCount.count === 0) {
    const today = new Date();
    
    const getFutureDate = (days) => {
      const d = new Date(today);
      d.setDate(today.getDate() + days);
      return d.toISOString();
    };

    const initialTasks = [
      {
        id: 't1',
        title: '品質系統部年度稽核計畫書撰寫',
        startDate: today.toISOString(),
        endDate: getFutureDate(7),
        department: '品質系統部', 
        demandPerson: '邱怡鈞',
        executingDepartment: '品質系統部', 
        executingPerson: '邱怡鈞',
        priority: 'highest',
        status: 'in_progress',
        communicated: 1,
        remarks: '經理級發起，高層關注，請於週五前交初稿',
        project: '2026年年度稽核專案',
        archived: 0
      },
      {
        id: 't2',
        title: '第一階段內部稽核問卷發放與回收',
        startDate: getFutureDate(1),
        endDate: getFutureDate(7),
        department: '品質技術課',
        demandPerson: '',
        executingDepartment: '品質技術組',
        executingPerson: '黃偉澤',
        priority: 'high',
        status: 'not_started',
        communicated: 1,
        remarks: '各單位窗口已確認',
        project: '2026年年度稽核專案',
        archived: 0
      },
      {
        id: 't3',
        title: '外部供應商稽核表單修訂',
        startDate: today.toISOString(),
        endDate: getFutureDate(1),
        department: '品質技術課',
        demandPerson: '',
        executingDepartment: '供應商管理組',
        executingPerson: '鄧啟宏',
        priority: 'medium',
        status: 'completed',
        communicated: 1,
        remarks: '修改條款比照最新 ISO 規章',
        project: '2026年年度稽核專案',
        archived: 1
      },
      {
        id: 't4',
        title: '實驗室精密儀器年度校正檢驗',
        startDate: today.toISOString(),
        endDate: getFutureDate(1),
        department: '品質系統課',
        demandPerson: '',
        executingDepartment: '實驗室',
        executingPerson: '林桂如',
        priority: 'medium',
        status: 'not_started',
        communicated: 0,
        remarks: '需預約外部校正廠商',
        project: '實驗室認證提升計畫',
        archived: 0
      },
      {
        id: 't5',
        title: 'TAF ISO/IEC 17025 增項認證文件準備',
        startDate: today.toISOString(),
        endDate: getFutureDate(30),
        department: '總經理室', 
        demandPerson: '總經理',
        executingDepartment: '實驗室',
        executingPerson: '林桂如',
        priority: 'highest',
        status: 'in_progress',
        communicated: 1,
        remarks: '總經理交辦重點專案，需準時提報進度',
        project: '實驗室認證提升計畫',
        archived: 0
      },
      {
        id: 't6',
        title: '關鍵供應商 A 廠現場稽核報告撰寫',
        startDate: today.toISOString(),
        endDate: getFutureDate(7),
        department: '品質技術課',
        demandPerson: '',
        executingDepartment: '供應商管理組',
        executingPerson: '黃沛芊',
        priority: 'high',
        status: 'in_progress',
        communicated: 1,
        remarks: '涉及重大品質風險追蹤',
        project: '供應商年度輔導專案',
        archived: 0
      },
      {
        id: 't7',
        title: '供應商 B 廠改善對策缺失回覆審查',
        startDate: today.toISOString(),
        endDate: getFutureDate(1),
        department: '品質系統部',
        demandPerson: '邱怡鈞',
        executingDepartment: '供應商管理組',
        executingPerson: '鄧啟宏',
        priority: 'highest',
        status: 'completed',
        communicated: 1,
        remarks: '廠商已提交改善報告',
        project: '供應商年度輔導專案',
        archived: 1
      },
      {
        id: 't8',
        title: '整理下週一主管週報與 KPI 提報資料',
        startDate: today.toISOString(),
        endDate: getFutureDate(1),
        department: '品質系統部',
        demandPerson: '邱怡鈞',
        executingDepartment: '品質系統部',
        executingPerson: '邱怡鈞',
        priority: 'highest',
        status: 'in_progress',
        communicated: 1,
        remarks: '例行性報告準備',
        project: '',
        archived: 0
      },
      {
        id: 't9',
        title: '回覆客戶 C 廠品質異常矯正預防措施報告 (CAPA)',
        startDate: today.toISOString(),
        endDate: getFutureDate(7),
        department: '品質系統部',
        demandPerson: '',
        executingDepartment: '品質技術組',
        executingPerson: '李義勇',
        priority: 'high',
        status: 'not_started',
        communicated: 0,
        remarks: '需會簽研發單位確認原因分析',
        project: '',
        archived: 0
      },
      {
        id: 't10',
        title: '整理 ISO 9001 品質手冊新版草案印發準備',
        startDate: getFutureDate(1),
        endDate: getFutureDate(7),
        department: '品質系統課',
        demandPerson: '',
        executingDepartment: '品質系統課',
        executingPerson: '李義勇',
        priority: 'medium',
        status: 'not_started',
        communicated: 0,
        remarks: '僅供內部傳閱確認',
        project: '',
        archived: 0
      }
    ];

    const stmt = await db.prepare(`
      INSERT INTO tasks (
        id, title, startDate, endDate, department, demandPerson, 
        executingDepartment, executingPerson, priority, status, 
        communicated, remarks, project, archived
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const task of initialTasks) {
      await stmt.run(
        task.id, task.title, task.startDate, task.endDate, task.department, task.demandPerson,
        task.executingDepartment, task.executingPerson, task.priority, task.status,
        task.communicated, task.remarks, task.project, task.archived
      );
    }
    await stmt.finalize();
    console.log('Seeded default tasks successfully.');
  }
}

// ----------------------------------------
// 任務相關 API
// ----------------------------------------

// 1. 取得所有任務
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await db.all('SELECT * FROM tasks');
    // 轉換 sqlite 的 0/1 回布林值
    const formatted = tasks.map(t => ({
      ...t,
      communicated: t.communicated === 1,
      archived: t.archived === 1
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. 新增任務
app.post('/api/tasks', async (req, res) => {
  try {
    const t = req.body;
    const newId = t.id || Date.now().toString();
    await db.run(`
      INSERT INTO tasks (
        id, title, startDate, endDate, department, demandPerson, 
        executingDepartment, executingPerson, priority, status, 
        communicated, remarks, project, archived
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      newId, t.title, t.startDate, t.endDate, t.department || '', t.demandPerson || '',
      t.executingDepartment, t.executingPerson || '', t.priority, t.status || 'not_started',
      t.communicated ? 1 : 0, t.remarks || '', t.project || '', t.archived ? 1 : 0
    ]);
    const saved = await db.get('SELECT * FROM tasks WHERE id = ?', [newId]);
    res.json({
      ...saved,
      communicated: saved.communicated === 1,
      archived: saved.archived === 1
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. 更新任務
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const t = req.body;
    
    // 取得現有任務，做欄位合併
    const existing = await db.get('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const title = t.hasOwnProperty('title') ? t.title : existing.title;
    const startDate = t.hasOwnProperty('startDate') ? t.startDate : existing.startDate;
    const endDate = t.hasOwnProperty('endDate') ? t.endDate : existing.endDate;
    const department = t.hasOwnProperty('department') ? t.department : existing.department;
    const demandPerson = t.hasOwnProperty('demandPerson') ? t.demandPerson : existing.demandPerson;
    const executingDepartment = t.hasOwnProperty('executingDepartment') ? t.executingDepartment : existing.executingDepartment;
    const executingPerson = t.hasOwnProperty('executingPerson') ? t.executingPerson : existing.executingPerson;
    const priority = t.hasOwnProperty('priority') ? t.priority : existing.priority;
    const status = t.hasOwnProperty('status') ? t.status : existing.status;
    const communicated = t.hasOwnProperty('communicated') ? (t.communicated ? 1 : 0) : existing.communicated;
    const remarks = t.hasOwnProperty('remarks') ? t.remarks : existing.remarks;
    const project = t.hasOwnProperty('project') ? t.project : existing.project;
    const archived = t.hasOwnProperty('archived') ? (t.archived ? 1 : 0) : existing.archived;

    await db.run(`
      UPDATE tasks SET
        title = ?, startDate = ?, endDate = ?, department = ?, demandPerson = ?,
        executingDepartment = ?, executingPerson = ?, priority = ?, status = ?,
        communicated = ?, remarks = ?, project = ?, archived = ?
      WHERE id = ?
    `, [
      title, startDate, endDate, department, demandPerson,
      executingDepartment, executingPerson, priority, status,
      communicated, remarks, project, archived, id
    ]);

    const updated = await db.get('SELECT * FROM tasks WHERE id = ?', [id]);
    res.json({
      ...updated,
      communicated: updated.communicated === 1,
      archived: updated.archived === 1
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. 刪除單一任務
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.run('DELETE FROM tasks WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. 批量刪除任務
app.post('/api/tasks/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid task IDs' });
    }
    const placeholders = ids.map(() => '?').join(',');
    await db.run(`DELETE FROM tasks WHERE id IN (${placeholders})`, ids);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. 重置所有任務為模擬任務
app.post('/api/tasks/reset', async (req, res) => {
  try {
    await db.run('DELETE FROM tasks');
    // 重新呼叫 initDb 來種入預設資料（因為此時資料庫 count 為 0 即可自動重刷）
    await initDb();
    const tasks = await db.all('SELECT * FROM tasks');
    const formatted = tasks.map(t => ({
      ...t,
      communicated: t.communicated === 1,
      archived: t.archived === 1
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------
// 組織架構相關 API
// ----------------------------------------

// 1. 取得所有組織節點
app.get('/api/orgs', async (req, res) => {
  try {
    const orgs = await db.all('SELECT * FROM orgs');
    res.json(orgs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. 新增組織節點
app.post('/api/orgs', async (req, res) => {
  try {
    const o = req.body;
    const newId = o.id || Date.now().toString();
    await db.run(`
      INSERT INTO orgs (id, type, name, level, parentId) VALUES (?, ?, ?, ?, ?)
    `, [newId, o.type, o.name, o.level || null, o.parentId || null]);
    const saved = await db.get('SELECT * FROM orgs WHERE id = ?', [newId]);
    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. 更新組織節點 (支援名稱變更時聯動更新 tasks 中的對應值)
app.put('/api/orgs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const o = req.body;

    const existing = await db.get('SELECT * FROM orgs WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Org node not found' });
    }

    const type = o.hasOwnProperty('type') ? o.type : existing.type;
    const name = o.hasOwnProperty('name') ? o.name : existing.name;
    const level = o.hasOwnProperty('level') ? o.level : existing.level;
    const parentId = o.hasOwnProperty('parentId') ? o.parentId : existing.parentId;

    const oldName = existing.name;

    await db.run(`
      UPDATE orgs SET type = ?, name = ?, level = ?, parentId = ? WHERE id = ?
    `, [type, name, level, parentId, id]);

    // 若名稱改變，級聯更新任務資料表中相應的部門與人員名稱
    if (name !== oldName) {
      if (type === 'org') {
        await db.run('UPDATE tasks SET department = ? WHERE department = ?', [name, oldName]);
        await db.run('UPDATE tasks SET executingDepartment = ? WHERE executingDepartment = ?', [name, oldName]);
      } else if (type === 'person') {
        await db.run('UPDATE tasks SET demandPerson = ? WHERE demandPerson = ?', [name, oldName]);
        await db.run('UPDATE tasks SET executingPerson = ? WHERE executingPerson = ?', [name, oldName]);
      }
    }

    // 級聯自我修復：只要修改人員，就自動將該人員所有任務的「執行部門」與「需求部門」與其當前隸屬部門同步
    if (type === 'person') {
      if (parentId) {
        const parentDept = await db.get('SELECT name FROM orgs WHERE id = ?', [parentId]);
        if (parentDept) {
          const newDeptName = parentDept.name;
          // 級聯更新執行部門
          await db.run('UPDATE tasks SET executingDepartment = ? WHERE executingPerson = ?', [newDeptName, name]);
          // 級聯更新需求部門
          await db.run('UPDATE tasks SET department = ? WHERE demandPerson = ?', [newDeptName, name]);
        }
      }
    }

    const updated = await db.get('SELECT * FROM orgs WHERE id = ?', [id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. 刪除組織節點及 recursive 下屬節點 (遞迴下架)
app.delete('/api/orgs/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 遞迴取得所有子孫節點 ID
    const getDescendants = async (parentId) => {
      const children = await db.all('SELECT id FROM orgs WHERE parentId = ?', [parentId]);
      let desc = [...children];
      for (const child of children) {
        const subDesc = await getDescendants(child.id);
        desc = [...desc, ...subDesc];
      }
      return desc;
    };

    const descendants = await getDescendants(id);
    const allIdsToDelete = [id, ...descendants.map(d => d.id)];

    const placeholders = allIdsToDelete.map(() => '?').join(',');
    await db.run(`DELETE FROM orgs WHERE id IN (${placeholders})`, allIdsToDelete);

    res.json({ success: true, deletedIds: allIdsToDelete });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. 重置組織為預設組織
app.post('/api/orgs/reset', async (req, res) => {
  try {
    await db.run('DELETE FROM orgs');
    await initDb();
    const orgs = await db.all('SELECT * FROM orgs');
    res.json(orgs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 啟動伺服器並初始化資料庫
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize SQLite database:', err);
});
