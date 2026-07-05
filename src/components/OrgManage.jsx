import React, { useState } from 'react';
import { useOrg } from '../context/OrgContext';
import { useTasks } from '../context/TaskContext';
import { Table, Button, Modal, Form, Input, Select, Space, Typography, Popconfirm, Tag, Radio } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined, TeamOutlined } from '@ant-design/icons';

const { Title } = Typography;

const OrgManage = () => {
  const { orgs, addOrg, updateOrg, deleteOrg, resetOrgs } = useOrg();
  const { fetchTasks } = useTasks();
  
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingOrg, setEditingOrg] = useState(null);
  const [form] = Form.useForm();

  // 使用 Ant Design 的 useWatch 監聽表單中的 type 欄位，這能 100% 確保反應與元件狀態同步
  const currentType = Form.useWatch('type', form) || 'org';

  const showModal = (org = null) => {
    setEditingOrg(org);
    setIsModalVisible(true);
  };

  // 監聽 editingOrg 與顯示狀態，強制在打開時更新或重置 Form 欄位，解決 Ant Design 表單快取舊值的問題
  React.useEffect(() => {
    if (isModalVisible) {
      if (editingOrg) {
        form.setFieldsValue({
          type: editingOrg.type || 'org',
          name: editingOrg.name,
          level: editingOrg.level || (editingOrg.type === 'person' ? '6' : '4'),
          parentId: editingOrg.parentId || undefined
        });
      } else {
        form.resetFields();
      }
    }
  }, [editingOrg, isModalVisible, form]);

  const handleOk = () => {
    form.validateFields().then(async (values) => {
      if (values.parentId === 'none' || !values.parentId) {
        values.parentId = null;
      }
      if (editingOrg) {
        await updateOrg(editingOrg.id, values);
      } else {
        await addOrg(values);
      }
      // 聯動重載：強制刷新任務清單，確保更新後的部門/人員名稱即時渲染於所有任務相關元件
      await fetchTasks();
      setIsModalVisible(false);
    });
  };

  const buildOrgTree = (orgsList) => {
    const map = {};
    const roots = [];

    orgsList.forEach(org => {
      map[org.id] = { ...org, children: [] };
    });

    orgsList.forEach(org => {
      if (org.parentId && map[org.parentId]) {
        if (org.id !== org.parentId) {
          map[org.parentId].children.push(map[org.id]);
        } else {
          roots.push(map[org.id]);
        }
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
            const levelA = parseInt(a.level || '6', 10);
            const levelB = parseInt(b.level || '6', 10);
            if (levelA !== levelB) {
              return levelA - levelB;
            }
            if (a.type !== b.type) {
              return a.type === 'org' ? -1 : 1;
            }
            return a.name.localeCompare(b.name, 'zh-Hant');
          });
          cleanEmptyChildren(node.children);
        }
      });
    };
    cleanEmptyChildren(roots);

    roots.sort((a, b) => {
      const levelA = parseInt(a.level || '6', 10);
      const levelB = parseInt(b.level || '6', 10);
      if (levelA !== levelB) return levelA - levelB;
      return a.name.localeCompare(b.name, 'zh-Hant');
    });

    return roots;
  };

  const orgTreeData = buildOrgTree(orgs);

  const columns = [
    {
      title: '名稱',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          {record.type === 'person' ? <UserOutlined style={{ color: '#1677ff' }} /> : <TeamOutlined style={{ color: '#fa8c16' }} />}
          <strong style={{ color: record.type === 'person' ? '#1677ff' : '#1f2937' }}>{text}</strong>
        </Space>
      ),
    },
    {
      title: '分類/職稱',
      dataIndex: 'type',
      key: 'type',
      render: (type, record) => {
        if (type === 'person') {
          const titleMap = {
            '1': '總經理',
            '2': '處長',
            '3': '部經理',
            '4': '課長',
            '5': '組長',
            '6': '工程師/專員'
          };
          return <Tag color="blue">人員 ({titleMap[record.level] || '成員'})</Tag>;
        }
        
        const levelMap = {
          '1': { text: '總公司', color: 'purple' },
          '2': { text: '處 Division', color: 'cyan' },
          '3': { text: '部 Department', color: 'geekblue' },
          '4': { text: '課 Section', color: 'orange' },
          '5': { text: '組 Team', color: 'magenta' },
        };
        const mapped = levelMap[record.level] || { text: '單位', color: 'default' };
        return <Tag color={mapped.color}>{mapped.text}</Tag>;
      },
    },
    {
      title: '隸屬單位',
      key: 'parent',
      render: (_, record) => {
        if (!record.parentId) return <span style={{ color: '#bfbfbf' }}>-</span>;
        const parent = orgs.find(o => o.id === record.parentId);
        return parent ? parent.name : <span style={{ color: '#bfbfbf' }}>-</span>;
      }
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button type="text" icon={<EditOutlined />} onClick={() => showModal(record)} />
          <Popconfirm title={`確定要刪除此${record.type === 'person' ? '人員' : '單位'}？（若為單位將連同底下人員與子單位一起刪除）`} onConfirm={() => deleteOrg(record.id)}>
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>組織架構與人員管理</Title>
        <Space>
          <Popconfirm title="確定要重置為預設架構嗎？這將覆蓋現有組織樹！" onConfirm={resetOrgs}>
            <Button danger>重置預設組織</Button>
          </Popconfirm>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => showModal()}>
            新增 部門 / 人員
          </Button>
        </Space>
      </div>

      <Table 
        columns={columns} 
        dataSource={orgTreeData} 
        rowKey="id" 
        pagination={{ pageSize: 50 }}
        defaultExpandAllRows={true}
      />

      <Modal
        title={editingOrg ? `修改${currentType === 'person' ? '人員' : '部門'}` : "新增單位或人員"}
        open={isModalVisible}
        onOk={handleOk}
        onCancel={() => setIsModalVisible(false)}
        okText="儲存"
        cancelText="取消"
        destroyOnClose
      >
        {isModalVisible && (
          <Form 
            form={form} 
            layout="vertical" 
            key={editingOrg ? editingOrg.id : 'new'}
            initialValues={{
              type: editingOrg ? (editingOrg.type || 'org') : 'org',
              name: editingOrg ? editingOrg.name : '',
              level: editingOrg ? (editingOrg.level || '6') : '4',
              parentId: editingOrg ? (editingOrg.parentId || undefined) : undefined
            }}
          >
            <Form.Item name="type" label="項目類型">
              <Radio.Group buttonStyle="solid">
                <Radio.Button value="org"><TeamOutlined /> 組織/部門</Radio.Button>
                <Radio.Button value="person"><UserOutlined /> 具體人員</Radio.Button>
              </Radio.Group>
            </Form.Item>

            <Form.Item name="name" label={currentType === 'person' ? "人員姓名" : "部門名稱"} rules={[{ required: true, message: '請輸入名稱' }]}>
              <Input placeholder={currentType === 'person' ? "例如：邱怡鈞" : "例如：品質技術課"} />
            </Form.Item>
            
            <Form.Item name="level" label={currentType === 'person' ? "職稱等級" : "組織層級"} rules={[{ required: true, message: '請選擇層級' }]}>
              {currentType === 'person' ? (
                <Select>
                  <Select.Option value="1">總經理</Select.Option>
                  <Select.Option value="2">處長</Select.Option>
                  <Select.Option value="3">經理</Select.Option>
                  <Select.Option value="4">課長</Select.Option>
                  <Select.Option value="5">組長</Select.Option>
                  <Select.Option value="6">一般工程師/專員</Select.Option>
                </Select>
              ) : (
                <Select>
                  <Select.Option value="1">總公司</Select.Option>
                  <Select.Option value="2">處 Division</Select.Option>
                  <Select.Option value="3">部 Department</Select.Option>
                  <Select.Option value="4">課 Section</Select.Option>
                  <Select.Option value="5">組 Team</Select.Option>
                </Select>
              )}
            </Form.Item>

            <Form.Item name="parentId" label="隸屬單位 (歸屬在哪個部門下)">
              <Select allowClear placeholder="請選擇隸屬的上級單位 (可留空)">
                <Select.Option value="none">-- 無 (最上層) --</Select.Option>
                {orgs.filter(o => o.type === 'org').map(org => {
                  if (editingOrg && org.id === editingOrg.id) return null;
                  return (
                    <Select.Option key={org.id} value={org.id}>
                      {org.name}
                    </Select.Option>
                  );
                })}
              </Select>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default OrgManage;
