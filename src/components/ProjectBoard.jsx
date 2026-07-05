import React, { useState, useEffect, useRef } from 'react';
import { useTasks } from '../context/TaskContext';
import { useOrg } from '../context/OrgContext';
import { Card, Col, Row, Tag, Progress, Space, Typography, Badge, Table, Button, Popconfirm, Modal, Form, Input, Select, DatePicker, TreeSelect, AutoComplete, Tabs, Radio } from 'antd';
import { ProjectOutlined, UserOutlined, TeamOutlined, EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
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

const getDeptTagColor = (dept) => {
  if (!dept) return 'default';
  if (dept.includes('品質系統部')) return 'purple';
  if (dept.includes('品質技術課')) return 'volcano';
  if (dept.includes('品質系統課')) return 'orange';
  if (dept.includes('品質技術組')) return 'blue';
  if (dept.includes('供應商管理組')) return 'cyan';
  if (dept.includes('實驗室')) return 'green';
  return 'geekblue';
};

const ProjectBoard = () => {
  const { tasks, addTask, updateTask, deleteTask, deleteTasks } = useTasks();
  const { orgs } = useOrg();

  // 彈出視窗與表單狀態
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState(null); // null 代表新增，否則代表編輯
  const [prefillProjectName, setPrefillProjectName] = useState(''); // 預填的專案名稱
  const [form] = Form.useForm();
  
  const [activeTab, setActiveTab] = useState(null);

  // 多選刪除的狀態
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  // 倒數計時狀態：{ [taskId]: 5 }
  const [countdowns, setCountdowns] = useState({});
  const timersRef = useRef({});

  // 篩選出有填寫專案名稱的任務
  const projectTasks = tasks.filter(t => t.project && t.project.trim() !== '');

  // 依專案分組
  const projects = {};
  projectTasks.forEach(task => {
    if (!projects[task.project]) {
      projects[task.project] = [];
    }
    projects[task.project].push(task);
  });

  // 僅顯示有「至少一件未封存（進行中/未開始）」任務的專案 Tab
  const projectNames = Object.keys(projects).filter(name => 
    projects[name].some(t => !t.archived)
  );

  // 預設切換至第一個 Tab
  useEffect(() => {
    if (projectNames.length > 0) {
      if (!activeTab || !projectNames.includes(activeTab)) {
        setActiveTab(projectNames[0]);
      }
    } else {
      setActiveTab(null);
    }
  }, [tasks]);

  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(clearInterval);
    };
  }, []);

  // 倒數計時清除
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

  // 循環點擊切換狀態
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

  // 編輯任務彈出視窗
  const showEditModal = (task) => {
    setEditingTask(task);
    setPrefillProjectName('');
    setIsModalVisible(true);
  };

  // 新增任務彈出視窗 (支援預填專案名稱)
  const showAddModal = (projectName = '') => {
    setEditingTask(null);
    setPrefillProjectName(projectName);
    setIsModalVisible(true);
  };

  // 總經理/經理自動判定
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

  const handleValuesChange = (changedValues, allValues) => {
    if (changedValues.hasOwnProperty('department')) {
      const deptName = changedValues.department;
      if (checkIfBoss(deptName)) {
        form.setFieldsValue({ priority: 'highest' });
      }
    }
    if (changedValues.hasOwnProperty('executingDepartment')) {
      const execDept = changedValues.executingDepartment;
      if (!allValues.department || allValues.department === '品質系統部') {
        form.setFieldsValue({ department: execDept });
        if (checkIfBoss(execDept)) {
          form.setFieldsValue({ priority: 'highest' });
        }
      }
    }
    if (changedValues.hasOwnProperty('executingPerson')) {
      const execPerson = changedValues.executingPerson;
      if (!allValues.demandPerson || allValues.demandPerson === '邱怡鈞') {
        form.setFieldsValue({ demandPerson: execPerson });
      }
    }
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

  // 批量刪除處理
  const handleBulkDelete = () => {
    deleteTasks(selectedRowKeys);
    setSelectedRowKeys([]);
  };

  // 組織與選單資料建立
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
          node.children.sort((a, b) => parseInt(a.orgData.level, 10) - parseInt(b.orgData.level, 10));
          cleanEmptyChildren(node.children);
        }
      });
    };
    cleanEmptyChildren(roots);
    return roots;
  };

  const deptTreeData = buildTreeSelectDeptData(orgs);
  const deptOptions = orgs.filter(o => o.type === 'org').map(o => ({ value: o.name }));

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
    return orgs.filter(o => o.type === 'person' && deptIds.includes(o.parentId)).map(o => ({ value: o.name, label: o.name }));
  };

  // 級聯用 Watcher
  const selectedDemandDept = Form.useWatch('department', form);
  const selectedExecDept = Form.useWatch('executingDepartment', form);

  const rangePresets = [
    { label: '預計 3 天 (假日順延)', value: [dayjs(), addDaysWithWeekendSkip(dayjs(), 3)] },
    { label: '預計 1 週', value: [dayjs(), dayjs().add(1, 'week')] },
    { label: '預計 1 個月', value: [dayjs(), dayjs().add(1, 'month')] },
  ];

  // 欄位定義
  const columns = [
    {
      title: '任務名稱',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <strong style={{ color: '#1f2937', textDecoration: record.status === 'completed' ? 'line-through' : 'none', opacity: record.status === 'completed' ? 0.6 : 1 }}>
          {text}
        </strong>
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
                ⏱️ {countdown}s 後自動封存
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
            <Tag color={getDeptTagColor(dept)} icon={<TeamOutlined />}>{dept}</Tag>
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
          <Button type="text" icon={<EditOutlined />} onClick={() => showEditModal(record)} />
          <Popconfirm title="確定要刪除此任務？" onConfirm={() => deleteTask(record.id)}>
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (projectNames.length === 0) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <Space direction="vertical" size={2}>
            <Title level={2} style={{ margin: 0 }}>專案追蹤看板</Title>
            <Text type="secondary">以分頁列表模式檢視與管理各大專案進度與子任務執行狀態</Text>
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => showAddModal()}>
            直接新增專案項目
          </Button>
        </div>
        <Card style={{ textAlign: 'center', padding: '40px 0', border: '1px dashed #d9d9d9', borderRadius: 8 }}>
          <ProjectOutlined style={{ fontSize: 48, color: '#bfbfbf', marginBottom: 16 }} />
          <p style={{ color: '#8c8c8c', fontSize: 16 }}>目前沒有任何大型專案在進行中</p>
          <p style={{ color: '#bfbfbf', fontSize: 13 }}>請點擊右上角按鈕，輸入「專案名稱」指派任務，系統將自動為您生成專案分頁！</p>
        </Card>

        {/* 新增/修改任務對話框 */}
        <Modal
          title={editingTask ? "修改任務指派" : "指派新專案任務"}
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
              initialValues={editingTask ? {
                title: editingTask.title,
                dateRange: [dayjs(editingTask.startDate), dayjs(editingTask.endDate)],
                department: editingTask.department,
                demandPerson: editingTask.demandPerson,
                executingDepartment: editingTask.executingDepartment,
                executingPerson: editingTask.executingPerson,
                priority: editingTask.priority,
                status: editingTask.status || 'not_started',
                communicated: editingTask.communicated ? 'yes' : 'no',
                remarks: editingTask.remarks || '',
                project: editingTask.project || ''
              } : {
                title: '',
                dateRange: [dayjs(), dayjs()],
                department: '品質系統部',
                demandPerson: '邱怡鈞',
                executingDepartment: undefined,
                executingPerson: undefined,
                priority: 'medium',
                status: 'not_started',
                communicated: 'no',
                remarks: '',
                project: prefillProjectName
              }}
            >
              <Form.Item name="project" label="專案名稱 (建立/指派到大專案，例如：2026年年度稽核專案)" rules={[{ required: true, message: '請輸入專案名稱以建立或歸屬大專案' }]}>
                <Input placeholder="請輸入大專案名稱" />
              </Form.Item>

              <Form.Item name="title" label="子任務名稱" rules={[{ required: true, message: '請輸入子任務名稱' }]}>
                <Input placeholder="例如：新版稽核表單修訂" />
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
              
              <div style={{ display: 'flex', gap: '16px' }}>
                <Form.Item name="department" label="需求部門 (選填)" style={{ flex: 1 }}>
                  <AutoComplete
                    options={deptOptions}
                    filterOption={(inputValue, option) =>
                      option.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                    }
                  />
                </Form.Item>

                <Form.Item name="demandPerson" label="需求人員 (選填)" style={{ flex: 1 }}>
                  <AutoComplete
                    options={getPeopleOptions(selectedDemandDept)}
                    filterOption={(inputValue, option) =>
                      option.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                    }
                  />
                </Form.Item>
              </div>
              
              <div style={{ display: 'flex', gap: '16px' }}>
                <Form.Item name="executingDepartment" label="執行部門" rules={[{ required: true, message: '請指定執行部門' }]} style={{ flex: 1 }}>
                  <TreeSelect
                    showSearch
                    style={{ width: '100%' }}
                    dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                    treeData={deptTreeData}
                    treeDefaultExpandAll
                  />
                </Form.Item>

                <Form.Item name="executingPerson" label="執行人員 (落實到人)" rules={[{ required: true, message: '請指定具體負責人' }]} style={{ flex: 1 }}>
                  <Select
                    showSearch
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
                <Input.TextArea rows={3} />
              </Form.Item>
            </Form>
          )}
        </Modal>
      </div>
    );
  }

  // 多選配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys),
  };

  // 建立 Tabs
  const tabItems = projectNames.map(projectName => {
    const list = projects[projectName];
    const completedCount = list.filter(t => t.status === 'completed').length;
    const totalCount = list.length;
    const progress = Math.round((completedCount / totalCount) * 100);
    const activeList = list.filter(t => !t.archived);

    return {
      key: projectName,
      label: (
        <span style={{ fontSize: 14 }}>
          <ProjectOutlined style={{ marginRight: 6 }} />
          {projectName} 
          <Badge 
            count={`${progress}%`} 
            style={{ 
              backgroundColor: progress === 100 ? '#52c41a' : '#1677ff', 
              marginLeft: 8,
              fontSize: 11
            }} 
          />
        </span>
      ),
      children: (
        <div style={{ marginTop: 8 }}>
          {/* 專案進度摘要欄 (新增「在此專案新增子任務」按鈕) */}
          <Card 
            style={{ 
              marginBottom: 20, 
              background: '#fafafa', 
              borderRadius: 8, 
              border: '1px solid #f0f0f0' 
            }}
            bodyStyle={{ padding: '16px 24px' }}
          >
            <Row gutter={[16, 16]} align="middle" justify="space-between">
              <Col xs={24} sm={10}>
                <Space direction="vertical" size={2}>
                  <Title level={4} style={{ margin: 0 }}>{projectName}</Title>
                  <Text type="secondary">
                    本專案共有 {totalCount} 件任務，已完成 {completedCount} 件，未完成 {totalCount - completedCount} 件
                  </Text>
                </Space>
              </Col>
              <Col xs={24} sm={6} style={{ textAlign: 'center' }}>
                <Button type="primary" ghost icon={<PlusOutlined />} onClick={() => showAddModal(projectName)}>
                  新增專案子任務
                </Button>
              </Col>
              <Col xs={24} sm={8}>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 13, color: 'rgba(0,0,0,0.45)', marginRight: 8 }}>整體完成進度:</span>
                  <span style={{ fontWeight: 'bold', fontSize: 16, color: '#1f2937' }}>{progress}%</span>
                  <Progress percent={progress} strokeColor={progress === 100 ? '#52c41a' : '#1677ff'} status={progress === 100 ? 'normal' : 'active'} />
                </div>
              </Col>
            </Row>
          </Card>

          {/* 表格呈現，支援批量刪除按鈕 */}
          <Card 
            bordered={false} 
            bodyStyle={{ padding: 0 }}
            title={
              selectedRowKeys.length > 0 && (
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
              )
            }
          >
            <Table 
              rowSelection={rowSelection} // 啟用多選
              columns={columns} 
              dataSource={activeList} 
              rowKey="id" 
              pagination={{ pageSize: 10 }}
              size="middle"
              locale={{ emptyText: '本專案當前無進行中任務！' }}
            />
          </Card>
        </div>
      )
    };
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <Title level={2} style={{ margin: 0 }}>專案追蹤看板</Title>
          <Text type="secondary">以分頁列表模式切換管理不同的大型專案進度與子任務執行狀態</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => showAddModal()}>
          指派新專案項目
        </Button>
      </div>

      <Tabs 
        type="card"
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        style={{ background: '#fff', borderRadius: 8 }}
      />

      {/* 新增/修改任務對話框 */}
      <Modal
        title={editingTask ? "修改任務指派" : "指派新專案任務"}
        open={isModalVisible}
        onOk={handleOk}
        onCancel={() => setIsModalVisible(false)}
        okText={editingTask ? "發布變更" : "發布任務"}
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
            initialValues={editingTask ? {
              title: editingTask.title,
              dateRange: [dayjs(editingTask.startDate), dayjs(editingTask.endDate)],
              department: editingTask.department,
              demandPerson: editingTask.demandPerson,
              executingDepartment: editingTask.executingDepartment,
              executingPerson: editingTask.executingPerson,
              priority: editingTask.priority,
              status: editingTask.status || 'not_started',
              communicated: editingTask.communicated ? 'yes' : 'no',
              remarks: editingTask.remarks || '',
              project: editingTask.project || ''
            } : {
              title: '',
              dateRange: [dayjs(), dayjs()],
              department: '品質系統部',
              demandPerson: '邱怡鈞',
              executingDepartment: undefined,
              executingPerson: undefined,
              priority: 'medium',
              status: 'not_started',
              communicated: 'no',
              remarks: '',
              project: prefillProjectName
            }}
          >
            <Form.Item name="project" label="專案名稱 (建立/指派到大專案，例如：2026年年度稽核專案)" rules={[{ required: true, message: '請輸入專案名稱以建立或歸屬大專案' }]}>
              <Input placeholder="請輸入大專案名稱" />
            </Form.Item>

            <Form.Item name="title" label="子任務名稱" rules={[{ required: true, message: '請輸入子任務名稱' }]}>
              <Input placeholder="例如：新版稽核表單修訂" />
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
            
            <div style={{ display: 'flex', gap: '16px' }}>
              <Form.Item name="department" label="需求部門 (選填)" style={{ flex: 1 }}>
                <AutoComplete
                  options={deptOptions}
                  filterOption={(inputValue, option) =>
                    option.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                  }
                />
              </Form.Item>

              <Form.Item name="demandPerson" label="需求人員 (選填)" style={{ flex: 1 }}>
                <AutoComplete
                  options={getPeopleOptions(selectedDemandDept)}
                  filterOption={(inputValue, option) =>
                    option.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                  }
                />
              </Form.Item>
            </div>
            
            <div style={{ display: 'flex', gap: '16px' }}>
              <Form.Item name="executingDepartment" label="執行部門" rules={[{ required: true, message: '請指定執行部門' }]} style={{ flex: 1 }}>
                <TreeSelect
                  showSearch
                  style={{ width: '100%' }}
                  dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                  treeData={deptTreeData}
                  treeDefaultExpandAll
                />
              </Form.Item>

              <Form.Item name="executingPerson" label="執行人員 (落實到人)" rules={[{ required: true, message: '請指定具體負責人' }]} style={{ flex: 1 }}>
                <Select
                  showSearch
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
              <Input.TextArea rows={3} />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default ProjectBoard;
