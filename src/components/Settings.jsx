import React from 'react';
import { useTasks } from '../context/TaskContext';
import { useOrg } from '../context/OrgContext';
import { Card, Button, Typography, Upload, message, Alert, Row, Col } from 'antd';
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const Settings = () => {
  const { tasks, importTasks } = useTasks();
  const { orgs, importOrgs } = useOrg();

  const handleExport = () => {
    const data = {
      tasks,
      orgs,
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Nexus_Sync_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    message.success('資料庫備份檔下載成功');
  };

  const customRequest = ({ file, onSuccess, onError }) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.tasks && data.orgs) {
          importTasks(data.tasks);
          importOrgs(data.orgs);
          message.success('資料庫成功還原！');
          onSuccess("ok");
        } else {
          message.error('檔案格式驗證失敗，不是合法的備份檔案。');
          onError(new Error("Invalid format"));
        }
      } catch (err) {
        message.error('檔案讀取失敗！');
        onError(err);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div>
      <Title level={2} style={{ marginBottom: 24 }}>系統資料設定</Title>
      
      <Row gutter={[24, 24]}>
        <Col xs={24} md={12}>
          <Card 
            title="匯出備份資料 EXPORT" 
            actions={[
              <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>
                執行下載程序
              </Button>
            ]}
          >
            <Text>將目前的任務狀態與組織架構完整封裝並下載為 JSON 備份檔。強烈建議在進行重大變更前執行此操作。</Text>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card 
            title="系統還原 RESTORE" 
            actions={[
              <Upload accept=".json" customRequest={customRequest} showUploadList={false}>
                <Button danger icon={<UploadOutlined />}>選擇檔案並執行覆蓋</Button>
              </Upload>
            ]}
          >
            <Alert 
              message="警告：此操作不可逆" 
              description="透過上傳先前的 JSON 備份檔來覆蓋目前的資料庫狀態，這將會完全覆蓋您目前的資料庫。" 
              type="warning" 
              showIcon 
              style={{ marginBottom: 16 }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Settings;
