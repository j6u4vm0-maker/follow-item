import React, { useState } from 'react';
import { useTasks } from '../context/TaskContext';
import { Table, Button, Space, Tag, Typography, Card, Popconfirm } from 'antd';
import { DeleteOutlined, UndoOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

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

const HistoryTasks = () => {
  const { tasks, updateTask, deleteTask, deleteTasks } = useTasks();

  // 多選刪除的狀態
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  // 僅篩選出已歸檔 (archived: true) 的歷史任務
  const archivedTasks = tasks.filter(t => t.archived);

  // 還原任務：將狀態設回「進行中」且不封存
  const handleRestore = (id) => {
    updateTask(id, { archived: false, status: 'in_progress' });
  };

  // 批量刪除處理
  const handleBulkDelete = () => {
    deleteTasks(selectedRowKeys);
    setSelectedRowKeys([]);
  };

  const columns = [
    {
      title: '任務名稱',
      dataIndex: 'title',
      key: 'title',
      render: text => <strong style={{ color: '#8c8c8c', textDecoration: 'line-through' }}>{text}</strong>,
    },
    {
      title: '開始日期',
      dataIndex: 'startDate',
      key: 'startDate',
      render: text => {
        const d = dayjs(text);
        const dayMap = ['日', '一', '二', '三', '四', '五', '六'];
        return <span style={{ color: '#8c8c8c' }}>{d.format('MM/DD')}({dayMap[d.day()]})</span>;
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
        return <span style={{ color: '#8c8c8c' }}>{d.format('MM/DD')}({dayMap[d.day()]})</span>;
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
          return <span style={{ color: '#8c8c8c' }}>{dept} ({person})</span>;
        }
        return <span style={{ color: '#8c8c8c' }}>{dept || person || '無'}</span>;
      }
    },
    {
      title: '執行單位/人員',
      key: 'executing',
      render: (_, record) => {
        const dept = record.executingDepartment;
        const person = record.executingPerson;
        return (
          <Space size={4}>
            <Tag color={getDeptTagColor(dept)}>{dept}</Tag>
            {person && <Tag color="default">{person}</Tag>}
          </Space>
        );
      }
    },
    {
      title: '狀態',
      dataIndex: 'status',
      key: 'status',
      render: () => <Tag color="success">已封存</Tag>
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button 
            type="text" 
            icon={<UndoOutlined />} 
            onClick={() => handleRestore(record.id)}
            style={{ color: '#1677ff' }}
          >
            還原任務
          </Button>
          <Popconfirm title="確定要永久刪除此歷史任務？" onConfirm={() => deleteTask(record.id)}>
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 多選配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys),
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Title level={2} style={{ margin: 0 }}>歷史任務歸檔區</Title>
        <Text type="secondary">本區塊存放所有已完成且封存的任務。您可以進行還原、多選刪除或永久刪除。</Text>
      </div>

      <Card 
        title={
          <Space size="middle">
            <span>歷史封存清單</span>
            {selectedRowKeys.length > 0 && (
              <Popconfirm
                title={`確定要永久刪除選取的 ${selectedRowKeys.length} 筆歷史任務嗎？`}
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
      >
        <Table 
          rowSelection={rowSelection} // 啟用多選
          columns={columns} 
          dataSource={archivedTasks} 
          rowKey="id" 
          pagination={{ pageSize: 10 }}
          size="middle"
          locale={{ emptyText: '目前沒有已歸檔的歷史任務' }}
        />
      </Card>
    </div>
  );
};

export default HistoryTasks;
