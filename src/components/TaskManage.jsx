import React, { useState, useEffect, useRef } from 'react';
import { useTasks } from '../context/TaskContext';
import { useOrg } from '../context/OrgContext';
import { Table, Button, Modal, Form, Input, Select, DatePicker, Tag, Space, Typography, Popconfirm, Row, Col, Card, TreeSelect, Tooltip, Progress, Statistic, Radio, AutoComplete } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined, WarningOutlined, UserOutlined, TeamOutlined, FilterOutlined, ReloadOutlined, ProjectOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// 假日順延工具函數
const addDaysWithWeekendSkip = (startDate, daysToAdd) => {
  let target = startDate.add(daysToAdd, 'days');
  if (target.day() === 6) target = target.add(2, 'days');
  if (target.day() === 0) target = target.add(1, 'days');
  return target;
};

const TaskManage = () => {
  const { tasks, addTask, updateTask, deleteTask, deleteTasks, resetTasks } = useTasks();
  const { orgs } = useOrg();
  
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [prefillDept, setPrefillDept] = useState(null);
  
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState(null);

  // 多選刪除的狀態
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  // 監聽表單中選擇的部門，以便進行連動人員過濾
  const selectedDemandDept = Form.useWatch('department', form);
  const selectedExecDept = Form.useWatch('executingDepartment', form);

  // 倒數計時狀態：{ [taskId]: 5 }
  const [countdowns, setCountdowns] = useState({});
  const timersRef = useRef({});

  // 判斷是否為總經理或部門經理級，以觸發自動切換優先級
  const checkIfBoss = (name) => {
    if (!name) return false;
    if (name.includes('總經理') || name.includes('經理') || name.includes('處長')) {
      return true;
    }
    const matchedOrg = orgs.find(o => o.name === name);
    if (matchedOrg) {
      const levelNum = parseInt(matchedOrg.level, 10);
      if (levelNum >= 1 && levelNum <= 3) {
        return true;
      }
    }
    return false;
  };

  // 當表單內容改變時，自動偵測並切換優先度，且提供需求端與執行端的關聯性預設同步
  const handleValuesChange = (changedValues, allValues) => {
    // 1. 自動判定需求部門優先度
    if (changedValues.hasOwnProperty('department')) {
      const deptName = changedValues.department;
      if (checkIfBoss(deptName)) {
        form.setFieldsValue({ priority: 'highest' });
      }
    }

    // 2. 關聯性預設同步：當使用者選擇「執行部門」時，如果「需求部門」為空或預設值，則自動帶入相同部門
    if (changedValues.hasOwnProperty('executingDepartment')) {
      const execDept = changedValues.executingDepartment;
      if (!allValues.department || allValues.department === '品質系統部') {
        form.setFieldsValue({ department: execDept });
        if (checkIfBoss(execDept)) {
          form.setFieldsValue({ priority: 'highest' });
        }
      }
    }

    // 3. 關聯性預設同步：當使用者選擇「執行人員」時，如果「需求人員」為空或預設值，則自動帶入相同人員
    if (changedValues.hasOwnProperty('executingPerson')) {
      const execPerson = changedValues.executingPerson;
      if (!allValues.demandPerson || allValues.demandPerson === '邱怡鈞') {
        form.setFieldsValue({ demandPerson: execPerson });
      }
    }
  };

  // 清除特定任務的倒數定時器
  const clearTimer = (taskId) => {
    if (timersRef.current[taskId]) {
      clearInterval(timersRef.current[taskId]);
      delete timersRef.current[taskId];
    }
    setCountdowns(prev => {
      const copy = { ...prev };
      delete copy[taskId];
      return copy;
    });
  };

  // 狀態循環點擊切換邏輯
  const handleCycleStatus = (record) => {
    let nextStatus = 'not_started';
    if (record.status === 'not_started') {
      nextStatus = 'in_progress';
    } else if (record.status === 'in_progress') {
      nextStatus = 'completed';
    } else if (record.status === 'completed') {
      nextStatus = 'not_started';
    }

    updateTask(record.id, { status: nextStatus });

    if (nextStatus === 'completed') {
      startArchiveCountdown(record.id);
    } else {
      clearTimer(record.id);
      updateTask(record.id, { archived: false });
    }
  };

  // 啟動 5 秒倒數歸檔
  const startArchiveCountdown = (taskId) => {
    clearTimer(taskId);

    let secondsLeft = 5;
    setCountdowns(prev => ({ ...prev, [taskId]: secondsLeft }));

    const interval = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft <= 0) {
        clearInterval(interval);
        delete timersRef.current[taskId];
        updateTask(taskId, { archived: true });
        setCountdowns(prev => {
          const copy = { ...prev };
          delete copy[taskId];
          return copy;
        });
      } else {
        setCountdowns(prev => ({ ...prev, [taskId]: secondsLeft }));
      }
    }, 1000);

    timersRef.current[taskId] = interval;
  };

  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(clearInterval);
    };
  }, []);

  // 批量刪除處理
  const handleBulkDelete = () => {
    deleteTasks(selectedRowKeys);
    setSelectedRowKeys([]);
  };

  // 轉換部門 (type === 'org') 形成 TreeSelect 所需的樹狀結構
  const buildTreeSelectDeptData = (orgsList) => {
    const map = {};
    const roots = [];

    const depts = orgsList.filter(o => o.type === 'org');
    depts.forEach(org => {
      map[org.id] = { 
        value: org.name, 
        title: <Space><TeamOutlined />{org.name}</Space>, 
        key: org.id, 
        orgData: org, 
        children: [] 
      };
    });

    depts.forEach(org => {
      if (org.parentId && map[org.parentId]) {
        map[org.parentId].children.push(map[org.id]);
      } else {
        roots.push(map[org.id]);
      }
    });

    const cleanEmptyChildren = (nodes) => {
      nodes.forEach(node => {
        if (node.children.length === 0) {
          delete node.children;
        } else {
          node.children.sort((a, b) => {
            const levelA = parseInt(a.orgData.level || '6', 10);
            const levelB = parseInt(b.orgData.level || '6', 10);
            return levelA - levelB;
          });
          cleanEmptyChildren(node.children);
        }
      });
    };
    cleanEmptyChildren(roots);

    return roots;
  };

  const deptTreeData = buildTreeSelectDeptData(orgs);

  // 取得供需求部門 AutoComplete 使用的選項名稱
  const getDeptAutoCompleteOptions = () => {
    return orgs
      .filter(o => o.type === 'org')
      .map(o => ({ value: o.name }));
  };

  const deptOptions = getDeptAutoCompleteOptions();

  // 根據選擇的部門名稱，動態過濾並取得該部門（及其子部門）底下所有人員 (type === 'person')
  const getPeopleOptions = (selectedDeptName) => {
    const allPeople = orgs.filter(o => o.type === 'person');
    if (!selectedDeptName) {
      return allPeople.map(o => ({ value: o.name, label: o.name }));
    }
    const dept = orgs.find(o => o.name === selectedDeptName);
    if (!dept) {
      return allPeople.map(o => ({ value: o.name, label: o.name }));
    }
    const deptIds = [dept.id];
    const getChildrenIds = (parentId) => {
      orgs.filter(o => o.parentId === parentId && o.type === 'org').forEach(c => {
        deptIds.push(c.id);
        getChildrenIds(c.id);
      });
    };
    getChildrenIds(dept.id);

    return orgs
      .filter(o => o.type === 'person' && deptIds.includes(o.parentId))
      .map(o => ({ value: o.name, label: o.name }));
  };

  // 遞迴取得某個部門底下所有子部門與人員的名單 (包含自己)
  const getDescendantNames = (deptName) => {
    const rootDept = orgs.find(o => o.name === deptName);
    if (!rootDept) return [deptName];

    const names = [deptName];
    const getChildren = (parentId) => {
      const children = orgs.filter(o => o.parentId === parentId);
      children.forEach(c => {
        names.push(c.name);
        getChildren(c.id);
      });
    };
    getChildren(rootDept.id);
    return names;
  };

  // 取得所有「課」級 (level 4) 的部門
  const getSections = () => {
    return orgs.filter(o => o.type === 'org' && o.level === '4');
  };

  const sections = getSections();

  // 計算課別的任務統計數據 (只計算未歸檔 active 的任務)
  const getSectionStats = () => {
    return sections.map(section => {
      const descendants = getDescendantNames(section.name);
      const sectionTasks = tasks.filter(t => descendants.includes(t.executingDepartment) && !t.archived);
      const pending = sectionTasks.filter(t => t.status !== 'completed').length;
      const completed = sectionTasks.filter(t => t.status === 'completed').length;
      const highPriorityPending = sectionTasks.filter(t => t.status !== 'completed' && (t.priority === 'high' || t.priority === 'highest')).length;
      const total = sectionTasks.length;
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        id: section.id,
        name: section.name,
        pending,
        completed,
        highPriorityPending,
        total,
        progress,
        descendants
      };
    });
  };

  const sectionStats = getSectionStats();

  const showModal = (task = null, prefillExecutingDept = null) => {
    setEditingTask(task);
    setPrefillDept(prefillExecutingDept);
    setIsModalVisible(true);
  };

  const handleOk = () => {
    form.validateFields().then(values => {
      const taskToSave = {
        title: values.title,
        startDate: values.dateRange[0].toISOString(),
        endDate: values.dateRange[1].toISOString(),
        department: values.department || '',
        demandPerson: values.demandPerson || '',
        executingDepartment: values.executingDepartment,
        executingPerson: values.executingPerson || '',
        priority: values.priority,
        status: values.status,
        communicated: values.communicated === 'yes',
        remarks: values.remarks || '',
        project: values.project || ''
      };

      if (editingTask) {
        updateTask(editingTask.id, taskToSave);
        if (values.status === 'completed') {
          startArchiveCountdown(editingTask.id);
        } else {
          clearTimer(editingTask.id);
          updateTask(editingTask.id, { archived: false });
        }
      } else {
        addTask(taskToSave);
      }
      setIsModalVisible(false);
    }).catch(info => {
      console.log('Validate Failed:', info);
    });
  };

  // 篩選出最終顯示的任務列表 (永遠排除封存的)
  const getFilteredTasks = () => {
    let result = tasks.filter(t => !t.archived);

    // 課別卡片點選篩選
    if (selectedSectionFilter) {
      const targetSection = sectionStats.find(s => s.name === selectedSectionFilter);
      if (targetSection) {
        result = result.filter(t => targetSection.descendants.includes(t.executingDepartment));
      }
    }

    // 搜尋過濾
    if (searchText) {
      result = result.filter(t => 
        t.title.toLowerCase().includes(searchText.toLowerCase()) ||
        (t.department && t.department.toLowerCase().includes(searchText.toLowerCase())) ||
        (t.demandPerson && t.demandPerson.toLowerCase().includes(searchText.toLowerCase())) ||
        (t.executingDepartment && t.executingDepartment.toLowerCase().includes(searchText.toLowerCase())) ||
        (t.executingPerson && t.executingPerson.toLowerCase().includes(searchText.toLowerCase())) ||
        (t.project && t.project.toLowerCase().includes(searchText.toLowerCase()))
      );
    }

    return result;
  };

  const filteredTasks = getFilteredTasks();

  // 移除首欄勾選，欄位改由 Ant 選取配置處理
  const columns = [
    {
      title: '任務名稱',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <div>
          <strong style={{ color: '#1f2937', textDecoration: record.status === 'completed' ? 'line-through' : 'none', opacity: record.status === 'completed' ? 0.6 : 1 }}>
            {text}
          </strong>
          {record.project && (
            <div style={{ marginTop: 2 }}>
              <Tag color="blue" size="small" icon={<ProjectOutlined style={{ fontSize: 10 }} />}>{record.project}</Tag>
            </div>
          )}
        </div>
      ),
    },
    {
      title: '階段狀態 (點擊切換狀態)',
      dataIndex: 'status',
      key: 'status',
      width: 260,
      render: (status, record) => {
        let tagColor = 'default';
        let emoji = '⚪';
        let text = '尚未開始';

        if (status === 'in_progress') {
          tagColor = 'processing';
          emoji = '🔵';
          text = '進行中';
        } else if (status === 'completed') {
          tagColor = 'success';
          emoji = '🟢';
          text = '已完成';
        }

        const countdown = countdowns[record.id];

        return (
          <Space>
            <Tag 
              color={tagColor} 
              style={{ cursor: 'pointer', padding: '4px 8px', fontSize: 13, userSelect: 'none' }}
              onClick={() => handleCycleStatus(record)}
            >
              {emoji} {text}
            </Tag>
            {countdown !== undefined && (
              <span style={{ color: '#cf1322', fontSize: 11, fontWeight: 'bold' }}>
                ⏱️ {countdown}s 後自動歸檔
              </span>
            )}
          </Space>
        );
      },
    },
    {
      title: '開始日期',
      dataIndex: 'startDate',
      key: 'startDate',
      render: text => {
        const d = dayjs(text);
        const dayMap = ['日', '一', '二', '三', '四', '五', '六'];
        return `${d.format('MM/DD')}(${dayMap[d.day()]})`;
      },
      sorter: (a, b) => new Date(a.startDate) - new Date(b.startDate),
    },
    {
      title: '預計結束',
      dataIndex: 'endDate',
      key: 'endDate',
      render: text => {
        const d = dayjs(text);
        const dayMap = ['日', '一', '二', '三', '四', '五', '六'];
        return `${d.format('MM/DD')}(${dayMap[d.day()]})`;
      },
      sorter: (a, b) => new Date(a.endDate) - new Date(b.endDate),
    },
    {
      title: '需求部門/人員',
      key: 'demand',
      render: (_, record) => {
        const dept = record.department;
        const person = record.demandPerson;
        if (dept && person) {
          return <span>{dept} <span style={{ color: '#8c8c8c', fontSize: 12 }}>({person})</span></span>;
        }
        return dept || person || <span style={{ color: '#bfbfbf' }}>無</span>;
      }
    },
    {
      title: '執行單位/人員',
      key: 'executing',
      render: (_, record) => {
        const dept = record.executingDepartment;
        const person = record.executingPerson;
        return (
          <Space size={4} wrap>
            <Tag color="geekblue" icon={<TeamOutlined />}>{dept}</Tag>
            {person && <Tag color="cyan" icon={<UserOutlined />}>{person}</Tag>}
          </Space>
        );
      }
    },
    {
      title: '優先級',
      dataIndex: 'priority',
      key: 'priority',
      render: priority => {
        let color = 'default';
        let text = '低';
        
        if (priority === 'highest') {
          color = 'magenta';
          text = '🔥 最高';
        } else if (priority === 'high') {
          color = 'red';
          text = '高';
        } else if (priority === 'medium') {
          color = 'orange';
          text = '中';
        }
        return <Tag color={color}>{text}</Tag>;
      }
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button type="text" icon={<EditOutlined />} onClick={() => showModal(record)} />
          <Popconfirm title="確定要刪除此任務？" onConfirm={() => deleteTask(record.id)}>
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 設定時間選擇器的 Presets 快捷選單
  const rangePresets = [
    { label: '預計 3 天 (假日順延)', value: [dayjs(), addDaysWithWeekendSkip(dayjs(), 3)] },
    { label: '預計 1 週', value: [dayjs(), dayjs().add(1, 'week')] },
    { label: '預計 1 個月', value: [dayjs(), dayjs().add(1, 'month')] },
    { label: '預計 3 個月', value: [dayjs(), dayjs().add(3, 'months')] },
  ];

  // 建立多選配置物件
  const rowSelection = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys),
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space direction="vertical" size={2}>
          <Title level={2} style={{ margin: 0 }}>任務指揮中心</Title>
          <Text type="secondary">品質系統部經理專屬：監控下屬課級單位之進行中工作，已完成任務 5 秒後將自動移入側邊欄「歷史任務」</Text>
        </Space>
        <Space>
          <Popconfirm 
            title="確定要重置為預設的 10 筆測試任務嗎？這將覆蓋現有所有任務！" 
            onConfirm={resetTasks}
            okText="確定重置"
            cancelText="取消"
          >
            <Button icon={<ReloadOutlined />} danger>重置 10 筆模擬任務</Button>
          </Popconfirm>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => showModal()}>
            指派新任務
          </Button>
        </Space>
      </div>

      {/* 上方：課級單位工作狀態統計卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {sectionStats.map(section => {
          const isSelected = selectedSectionFilter === section.name;
          return (
            <Col xs={24} sm={12} key={section.id}>
              <Card 
                hoverable
                onClick={() => setSelectedSectionFilter(isSelected ? null : section.name)}
                style={{ 
                  border: isSelected ? '2px solid #1677ff' : '1px solid #f0f0f0',
                  background: isSelected ? '#e6f4ff' : '#fff',
                  transition: 'all 0.3s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <Title level={4} style={{ margin: 0, color: '#1f2937' }}>
                      <TeamOutlined style={{ color: '#fa8c16', marginRight: 8 }} />
                      {section.name}
                    </Title>
                    <Text type="secondary" style={{ fontSize: 12 }}>點擊卡片可快速過濾任務清單</Text>
                  </div>
                  {section.highPriorityPending > 0 && (
                    <Tag color="red" icon={<WarningOutlined />}>
                      {section.highPriorityPending} 件高優先待辦
                    </Tag>
                  )}
                </div>

                <Row gutter={16} style={{ marginTop: 16 }}>
                  <Col span={12}>
                    <Statistic title="待辦任務" value={section.pending} valueStyle={{ color: '#cf1322', fontWeight: 'bold' }} />
                  </Col>
                  <Col span={12}>
                    <Statistic title="已完成" value={section.completed} suffix={`/ ${section.total}`} />
                  </Col>
                </Row>
                
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                    <Text type="secondary">整體進度</Text>
                    <Text strong>{section.progress}%</Text>
                  </div>
                  <Progress percent={section.progress} showInfo={false} strokeColor={section.progress === 100 ? '#52c41a' : '#1677ff'} />
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>

      <Row gutter={[24, 24]}>
        <Col span={24}>
          <Card 
            title={
              <Space size="middle">
                <span>任務追蹤清單</span>
                {selectedSectionFilter && (
                  <Tag color="blue" closable onClose={() => setSelectedSectionFilter(null)} icon={<FilterOutlined />}>
                    正在檢視：{selectedSectionFilter} 及所屬單位的人員
                  </Tag>
                )}
                {/* 批量刪除按鈕 */}
                {selectedRowKeys.length > 0 && (
                  <Popconfirm
                    title={`確定要刪除選取的 ${selectedRowKeys.length} 筆任務嗎？`}
                    onConfirm={handleBulkDelete}
                    okText="確定"
                    cancelText="取消"
                  >
                    <Button type="primary" danger size="small" icon={<DeleteOutlined />}>
                      批量刪除 ({selectedRowKeys.length})
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            } 
            bordered={false} 
            extra={
              <Input.Search 
                placeholder="搜尋任務、部門或人員..." 
                style={{ width: 250 }}
                onChange={e => setSearchText(e.target.value)}
              />
            }
          >
            <Table 
              rowSelection={rowSelection} // 啟用 rowSelection
              columns={columns} 
              dataSource={filteredTasks} 
              rowKey="id" 
              pagination={{ pageSize: 10 }}
              size="middle"
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title={editingTask ? "修改任務指派" : "指派新任務"}
        open={isModalVisible}
        onOk={handleOk}
        onCancel={() => setIsModalVisible(false)}
        okText="發布任務"
        cancelText="取消"
        width={650}
        destroyOnClose
      >
        {isModalVisible && (
          <Form 
            form={form} 
            layout="vertical" 
            key={editingTask ? editingTask.id : 'new'}
            onValuesChange={handleValuesChange}
            initialValues={{
              title: editingTask ? editingTask.title : '',
              dateRange: editingTask ? [dayjs(editingTask.startDate), dayjs(editingTask.endDate)] : [dayjs(), dayjs()],
              department: editingTask ? editingTask.department : '品質系統部',
              demandPerson: editingTask ? editingTask.demandPerson : '邱怡鈞',
              executingDepartment: editingTask ? editingTask.executingDepartment : (prefillDept || undefined),
              executingPerson: editingTask ? editingTask.executingPerson : undefined,
              priority: editingTask ? editingTask.priority : (checkIfBoss('品質系統部') ? 'highest' : 'medium'),
              status: editingTask ? (editingTask.status || 'not_started') : 'not_started',
              communicated: editingTask ? (editingTask.communicated ? 'yes' : 'no') : 'no',
              remarks: editingTask ? (editingTask.remarks || '') : '',
              project: editingTask ? (editingTask.project || '') : ''
            }}
          >
            <Form.Item name="project" label="專案名稱 (隸屬於哪一個大型專案 / 選填)">
              <Input placeholder="例如：2026年年度稽核專案 或 實驗室認證提升計畫" />
            </Form.Item>

            <Form.Item name="title" label="任務名稱" rules={[{ required: true, message: '請輸入任務名稱' }]}>
              <Input placeholder="例如：新版供應商稽核表單製作" />
            </Form.Item>
            
            <Form.Item label="任務期間 (開始 ~ 預計結束)">
              <Form.Item name="dateRange" noStyle rules={[{ required: true, message: '請選擇期間' }]}>
                <RangePicker 
                  presets={rangePresets} 
                  style={{ width: '100%' }} 
                  format={(value) => `${value.format('YYYY-MM-DD')} (${['日','一','二','三','四','五','六'][value.day()]})`}
                />
              </Form.Item>
              <div style={{ marginTop: 8 }}>
                <Space>
                  <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>一鍵快速設定期間：</span>
                  <Button size="small" type="dashed" htmlType="button" onClick={() => form.setFieldsValue({ dateRange: [dayjs(), addDaysWithWeekendSkip(dayjs(), 3)] })}>
                    三天
                  </Button>
                  <Button size="small" type="dashed" htmlType="button" onClick={() => form.setFieldsValue({ dateRange: [dayjs(), dayjs().add(1, 'week')] })}>
                    一週
                  </Button>
                  <Button size="small" type="dashed" htmlType="button" onClick={() => form.setFieldsValue({ dateRange: [dayjs(), dayjs().add(1, 'month')] })}>
                    一個月
                  </Button>
                </Space>
              </div>
            </Form.Item>
            
            {/* 需求端：部門與人員分開 */}
            <div style={{ display: 'flex', gap: '16px' }}>
              <Form.Item name="department" label="需求部門 (支援選擇與手動輸入 / 選填)" style={{ flex: 1 }}>
                <AutoComplete
                  options={deptOptions}
                  placeholder="請輸入或選擇需求部門"
                  filterOption={(inputValue, option) =>
                    option.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                  }
                />
              </Form.Item>

              <Form.Item name="demandPerson" label="需求人員 (支援選擇與手動輸入 / 選填)" style={{ flex: 1 }}>
                <AutoComplete
                  options={getPeopleOptions(selectedDemandDept)}
                  placeholder="請輸入或選擇需求人"
                  filterOption={(inputValue, option) =>
                    option.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                  }
                />
              </Form.Item>
            </div>
            
            {/* 執行端：部門與人員分開，且有連動篩選 */}
            <div style={{ display: 'flex', gap: '16px' }}>
              <Form.Item name="executingDepartment" label="執行部門" rules={[{ required: true, message: '請指定執行部門' }]} style={{ flex: 1 }}>
                <TreeSelect
                  showSearch
                  style={{ width: '100%' }}
                  dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                  treeData={deptTreeData}
                  placeholder="請選擇執行部門"
                  treeDefaultExpandAll
                />
              </Form.Item>

              <Form.Item name="executingPerson" label="執行人員 (落實到人)" rules={[{ required: true, message: '請指定具體負責人' }]} style={{ flex: 1 }}>
                <Select
                  showSearch
                  placeholder="請選擇執行人員"
                  optionFilterProp="children"
                  options={getPeopleOptions(selectedExecDept)}
                />
              </Form.Item>
            </div>
            
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <Form.Item name="priority" label="優先程度" style={{ flex: 1 }}>
                <Select>
                  <Select.Option value="highest">最高</Select.Option>
                  <Select.Option value="high">高</Select.Option>
                  <Select.Option value="medium">中</Select.Option>
                  <Select.Option value="low">低</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item name="status" label="階段狀態" style={{ flex: 1 }}>
                <Radio.Group buttonStyle="solid">
                  <Radio.Button value="not_started">尚未開始</Radio.Button>
                  <Radio.Button value="in_progress">進行中</Radio.Button>
                  <Radio.Button value="completed">已完成</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </div>
            
            <div style={{ display: 'flex', gap: '16px' }}>
              <Form.Item name="communicated" label="是否已溝通" style={{ flex: 1 }}>
                <Select>
                  <Select.Option value="yes">是</Select.Option>
                  <Select.Option value="no">否</Select.Option>
                </Select>
              </Form.Item>
            </div>

            <Form.Item name="remarks" label="備註事項">
              <Input.TextArea rows={3} placeholder="補充說明..." />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default TaskManage;
