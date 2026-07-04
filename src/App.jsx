import React, { useState } from 'react';
import { Layout, Menu, Typography, ConfigProvider, theme } from 'antd';
import {
  DashboardOutlined,
  CalendarOutlined,
  UnorderedListOutlined,
  TeamOutlined,
  SettingOutlined,
  HistoryOutlined,
  ProjectOutlined,
} from '@ant-design/icons';
import Dashboard from './components/Dashboard';
import CalendarView from './components/CalendarView';
import TaskManage from './components/TaskManage';
import OrgManage from './components/OrgManage';
import Settings from './components/Settings';
import HistoryTasks from './components/HistoryTasks';
import ProjectBoard from './components/ProjectBoard'; // 引入專案看板

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const menuItems = [
    { key: 'dashboard', icon: <DashboardOutlined />, label: '儀表板' },
    { key: 'calendar', icon: <CalendarOutlined />, label: '行事曆' },
    { key: 'tasks', icon: <UnorderedListOutlined />, label: '任務追蹤' },
    { key: 'projects', icon: <ProjectOutlined />, label: '專案看板' }, // 新增專案看板選單
    { key: 'history', icon: <HistoryOutlined />, label: '歷史任務' },
    { key: 'org', icon: <TeamOutlined />, label: '組織管理' },
    { key: 'settings', icon: <SettingOutlined />, label: '系統設定' },
  ];

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1677ff',
          fontFamily: 'Inter, sans-serif',
          borderRadius: 8,
          fontSize: 16, // 全域字體放大為 16px
        },
        algorithm: theme.defaultAlgorithm,
      }}
    >
      <Layout style={{ minHeight: '100vh' }}>
        <Sider 
          theme="dark" 
          width={250} 
          breakpoint="lg" 
          collapsedWidth="0"
          style={{ paddingTop: 16 }}
        >
          <div style={{ padding: '0 24px', marginBottom: 32 }}>
            <Title level={3} style={{ color: '#fff', margin: 0 }}>TaskSync</Title>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>NEXUS PORTAL</div>
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[activeTab]}
            onClick={(e) => setActiveTab(e.key)}
            items={menuItems}
          />
        </Sider>
        
        <Layout>
          <Header style={{ padding: '0 24px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', zIndex: 1 }}>
            <div style={{ fontWeight: 600, color: '#1677ff' }}>SYSTEM ACTIVE • TASK MANAGEMENT GATEWAY</div>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>GLOBAL STATUS / OPERATIONAL</div>
          </Header>
          
          <Content style={{ margin: '24px', background: '#fff', padding: '24px', borderRadius: '8px', overflowY: 'auto' }}>
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'calendar' && <CalendarView />}
            {activeTab === 'tasks' && <TaskManage />}
            {activeTab === 'projects' && <ProjectBoard />}
            {activeTab === 'history' && <HistoryTasks />}
            {activeTab === 'org' && <OrgManage />}
            {activeTab === 'settings' && <Settings />}
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}

export default App;
