import React, { useState, useEffect, useRef } from 'react';
import { useTasks } from '../context/TaskContext';
import { useOrg } from '../context/OrgContext';
import { Card, Row, Col, Statistic, Table, Checkbox, Tag, Space, Typography, Tooltip } from 'antd';
import { CheckCircleOutlined, SyncOutlined, AlertOutlined, WarningOutlined, TeamOutlined, UserOutlined, ProjectOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';

dayjs.extend(isBetween);

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

const Dashboard = () => {
  const { tasks, updateTask } = useTasks();
  const { orgs } = useOrg();

  // 倒數計時與定時器狀態 (與 TaskManage 同步)
  const [countdowns, setCountdowns] = useState({});
  const timersRef = useRef({});

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

  const handleToggleComplete = (record) => {
    if (record.status === 'completed') {
      clearTimer(record.id);
      updateTask(record.id, { status: 'in_progress', archived: false });
    } else {
      updateTask(record.id, { status: 'completed' });
      startArchiveCountdown(record.id);
    }
  };

  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(clearInterval);
    };
  }, []);

  // 本週任務：篩選出本週執行中且未歸檔的任務 (依照當前 locale 設定，星期一為第一天)
  const startOfWeek = dayjs().startOf('week');
  const endOfWeek = dayjs().endOf('week');

  const weekTasks = tasks.filter(t => {
    if (t.archived) return false;
    const taskStart = dayjs(t.startDate).startOf('day');
    const taskEnd = dayjs(t.endDate).endOf('day');
    // 判斷任務區間與本週區間是否有重疊
    return !(taskStart.isAfter(endOfWeek) || taskEnd.isBefore(startOfWeek));
  });

  // 分類大類一：品質技術課大類 (包含品質技術課、品質技術組、供應商管理組)
  const techTasks = weekTasks.filter(t => 
    ['品質技術課', '品質技術組', '供應商管理組'].includes(t.executingDepartment)
  );
  const techCompleted = techTasks.filter(t => t.status === 'completed');
  const techProgress = techTasks.length > 0 ? Math.round((techCompleted.length / techTasks.length) * 100) : 100;

  // 分類大類二：品質系統課大類 (包含品質系統部、品質系統課、實驗室)
  const sysTasks = weekTasks.filter(t => 
    ['品質系統部', '品質系統課', '實驗室'].includes(t.executingDepartment)
  );
  const sysCompleted = sysTasks.filter(t => t.status === 'completed');
  const sysProgress = sysTasks.length > 0 ? Math.round((sysCompleted.length / sysTasks.length) * 100) : 100;

  const columns = [
    {
      title: '完成',
      key: 'quickComplete',
      width: 60,
      align: 'center',
      render: (_, record) => (
        <Checkbox 
          checked={record.status === 'completed'} 
          onChange={() => handleToggleComplete(record)}
        />
      ),
    },
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
                ⏱️ {countdown}s 後封存
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
    }
  ];

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Title level={2} style={{ margin: 0, color: '#1677ff' }}>NEXUS SYNC PORTAL</Title>
        <Text type="secondary">品質系統部中央指揮官戰情室</Text>
      </div>

      {/* 上方：三欄橫向卡片 Dashboard 看板 */}
      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={8}>
          <Card hoverable style={{ borderLeft: '4px solid #1677ff' }}>
            <Statistic
              title="本週任務總覽 (跨期執行)"
              value={weekTasks.length}
              prefix={<SyncOutlined spin={weekTasks.length > 0} />}
              valueStyle={{ color: '#1677ff', fontWeight: 'bold' }}
            />
            <Text type="success" style={{ fontSize: 12 }}><CheckCircleOutlined /> 部門運作順暢</Text>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card hoverable style={{ borderLeft: '4px solid #cf1322' }}>
            <Statistic
              title="高危險未完成任務"
              value={tasks.filter(t => t.priority === 'high' && t.status !== 'completed').length}
              suffix="件"
              prefix={<AlertOutlined />}
              valueStyle={{ color: '#cf1322', fontWeight: 'bold' }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>請各組主管優先跟進</Text>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card hoverable style={{ borderLeft: '4px solid #faad14' }}>
            <Statistic
              title="未溝通追蹤項目"
              value={tasks.filter(t => !t.communicated && !t.archived).length}
              suffix="件"
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#faad14', fontWeight: 'bold' }}
            />
            <Text type="warning" style={{ fontSize: 12 }}>需於今日安排溝通會議</Text>
          </Card>
        </Col>
      </Row>

      {/* 下方：大類一 - 品質技術課 本週任務表格 */}
      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card 
            title={
              <Space>
                <TeamOutlined style={{ color: '#fa8c16' }} />
                <span style={{ fontSize: '16px', fontWeight: 'bold' }}>品質技術課及所屬單位 - 本週任務清單</span>
                <Tag color="orange">本週任務完成率 {techProgress}%</Tag>
              </Space>
            } 
            bordered={false}
          >
            <Table 
              columns={columns} 
              dataSource={techTasks} 
              rowKey="id" 
              pagination={false}
              size="middle"
              locale={{ emptyText: '本週品質技術課無執行中任務！' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 下方：大類二 - 品質系統課 本週任務表格 */}
      <Row gutter={[24, 24]}>
        <Col span={24}>
          <Card 
            title={
              <Space>
                <TeamOutlined style={{ color: '#1890ff' }} />
                <span style={{ fontSize: '16px', fontWeight: 'bold' }}>品質系統課及所屬單位 - 本週任務清單</span>
                <Tag color="blue">本週任務完成率 {sysProgress}%</Tag>
              </Space>
            } 
            bordered={false}
          >
            <Table 
              columns={columns} 
              dataSource={sysTasks} 
              rowKey="id" 
              pagination={false}
              size="middle"
              locale={{ emptyText: '本週品質系統課無執行中任務！' }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
