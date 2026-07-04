import React, { useState } from 'react';
import { useTasks } from '../context/TaskContext';
import { Calendar, Typography, Radio, Card, Space, ConfigProvider, Modal, Tag, Button } from 'antd';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import updateLocale from 'dayjs/plugin/updateLocale';
import { ProjectOutlined } from '@ant-design/icons';

// 引入 Ant Design 的繁體中文語系包
import zhTW from 'antd/locale/zh_TW';

// 引入 Day.js 繁體中文語系與設定週一為第一天
import 'dayjs/locale/zh-tw';
dayjs.locale('zh-tw');
dayjs.extend(isBetween);
dayjs.extend(updateLocale);

// 設定週一為一週的開始 (weekStart: 1)
dayjs.updateLocale('zh-tw', {
  weekStart: 1
});

const { Title, Text } = Typography;

const CalendarView = () => {
  const { tasks } = useTasks();

  // 1. 標題與網格樣式風格：'google' (經典彩條), 'corporate' (商務黑底), 'minimalist' (極簡邊框)
  const [headerStyle, setHeaderStyle] = useState('google');

  // 2. 事件項目卡片風格：'solid' (滿色卡片), 'stripe' (左側邊線輕底色), 'text' (純文字彩色)
  const [eventStyle, setEventStyle] = useState('stripe');

  // 3. 用於查看詳細內容的彈出視窗狀態
  const [selectedTaskForView, setSelectedTaskForView] = useState(null);

  const getListData = (value) => {
    // 僅在任務的「預計結束日 (endDate)」當天顯示該任務，過程完全不顯示
    const listData = tasks.filter(t => {
      const end = dayjs(t.endDate).startOf('day');
      return value.isSame(end, 'day');
    });
    return listData || [];
  };

  // 事件卡片背景色
  const getEventBgColor = (item, styleMode) => {
    if (styleMode === 'text') return 'transparent';
    
    const isStripe = styleMode === 'stripe';
    if (item.status === 'completed') return isStripe ? '#f6ffed' : '#52c41a';   // 成功綠
    if (item.priority === 'highest') return isStripe ? '#fff0f6' : '#eb2f96';   // 火熱粉
    if (item.priority === 'high') return isStripe ? '#fff1f0' : '#f5222d';      // 警告紅
    if (item.priority === 'medium') return isStripe ? '#fff7e6' : '#fa8c16';    // 警示橘
    return isStripe ? '#f0f5ff' : '#1677ff';                                     // 低/預設藍
  };

  // 事件卡片文字色
  const getEventTextColor = (item, styleMode) => {
    const isSolid = styleMode === 'solid';
    if (isSolid) return '#ffffff'; // 實色背景統一用白色字
    
    if (item.status === 'completed') return '#389e0d';
    if (item.priority === 'highest') return '#c41d7f';
    if (item.priority === 'high') return '#cf1322';
    if (item.priority === 'medium') return '#d46b08';
    return '#1d39c2';
  };

  // 事件卡片邊框色與左側邊線配色
  const getEventBorderColor = (item) => {
    if (item.status === 'completed') return '#b7eb8f';
    if (item.priority === 'highest') return '#ffadd2';
    if (item.priority === 'high') return '#ffa39e';
    if (item.priority === 'medium') return '#ffd591';
    return '#adc6ff';
  };

  const getSolidBorderColor = (item) => {
    if (item.status === 'completed') return '#389e0d';
    if (item.priority === 'highest') return '#c41d7f';
    if (item.priority === 'high') return '#cf1322';
    if (item.priority === 'medium') return '#d46b08';
    return '#1d39c2';
  };

  const handleTaskClick = (e, item) => {
    e.stopPropagation(); // 阻止氣泡事件觸發日期單元格點擊
    setSelectedTaskForView(item);
  };

  const dateCellRender = (value) => {
    const listData = getListData(value);
    return (
      <ul className="events" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {listData.map((item) => {
          const isCompleted = item.status === 'completed';
          const bgColor = getEventBgColor(item, eventStyle);
          const textColor = getEventTextColor(item, eventStyle);
          const borderColor = getEventBorderColor(item);
          const solidBorderColor = getSolidBorderColor(item);

          let cardStyle = {};
          if (eventStyle === 'solid') {
            cardStyle = {
              background: bgColor,
              color: textColor,
              border: `1px solid ${solidBorderColor}`,
              padding: '4px 8px',
              borderRadius: '4px',
              fontWeight: 'bold',
            };
          } else if (eventStyle === 'stripe') {
            cardStyle = {
              background: bgColor,
              color: textColor,
              border: `1px solid ${borderColor}`,
              borderLeft: `4px solid ${solidBorderColor}`,
              padding: '4px 8px',
              borderRadius: '4px',
            };
          } else {
            cardStyle = {
              background: 'transparent',
              color: textColor,
              border: 'none',
              padding: '3px 4px',
              display: 'flex',
              alignItems: 'center',
            };
          }

          return (
            <li 
              key={item.id} 
              onClick={(e) => handleTaskClick(e, item)}
              style={{ 
                textDecoration: isCompleted ? 'line-through' : 'none', 
                opacity: isCompleted ? 0.75 : 1,
                fontSize: '15px', // 放大兩倍
                marginBottom: '4px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: 'block',
                cursor: 'pointer',
                boxShadow: eventStyle !== 'text' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                ...cardStyle
              }}
              title={`點擊查看詳細：${item.title}`}
            >
              {eventStyle === 'text' && (
                <span style={{ 
                  display: 'inline-block', 
                  width: 7, 
                  height: 7, 
                  borderRadius: '50%', 
                  background: solidBorderColor, 
                  marginRight: 6 
                }} />
              )}
              {isCompleted ? '✅ ' : ''}{item.title}
            </li>
          );
        })}
      </ul>
    );
  };

  const cellRender = (current, info) => {
    if (info.type === 'date') {
      return (
        <div style={{ 
          height: '100%', 
          width: '100%', 
          padding: '4px', 
          boxSizing: 'border-box'
        }}>
          {dateCellRender(current)}
        </div>
      );
    }
    return info.originNode;
  };

  const getCalendarClassName = () => {
    if (headerStyle === 'google') return 'cal-style-google';
    if (headerStyle === 'corporate') return 'cal-style-corporate';
    return 'cal-style-minimalist';
  };

  return (
    <ConfigProvider locale={zhTW}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <Space direction="vertical" size={2}>
            <Title level={2} style={{ margin: 0 }}>專案跨期行事曆</Title>
            <Text type="secondary">支援全中文界面。僅顯示任務截止當天，提供多樣化樣式切換面板</Text>
          </Space>
        </div>

        {/* 樣式規劃切換面板 */}
        <Card 
          style={{ marginBottom: 20, background: '#fafafa', borderRadius: 8 }}
          bodyStyle={{ padding: '12px 24px' }}
        >
          <Space size="large" wrap>
            <Space>
              <Text strong>1. 日曆表頭與週末底色樣式：</Text>
              <Radio.Group value={headerStyle} onChange={e => setHeaderStyle(e.target.value)} optionType="button" buttonStyle="solid">
                <Radio.Button value="google">經典簡約 (Google 風格)</Radio.Button>
                <Radio.Button value="corporate">商務深灰黑底</Radio.Button>
                <Radio.Button value="minimalist">極簡上邊框</Radio.Button>
              </Radio.Group>
            </Space>

            <Space>
              <Text strong>2. 事件項目卡片樣式：</Text>
              <Radio.Group value={eventStyle} onChange={e => setEventStyle(e.target.value)} optionType="button" buttonStyle="solid">
                <Radio.Button value="stripe">左側粗邊線輕底 (推薦)</Radio.Button>
                <Radio.Button value="solid">實色滿色底卡</Radio.Button>
                <Radio.Button value="text">無背景純文字</Radio.Button>
              </Radio.Group>
            </Space>
          </Space>
        </Card>

        <div className={getCalendarClassName()} style={{ padding: 24, background: '#fff', borderRadius: 8, border: '1px solid #f0f0f0' }}>
          <Calendar cellRender={cellRender} />
        </div>

        {/* 點擊叫出內容的 Modal */}
        <Modal
          title={
            <Space>
              <ProjectOutlined style={{ color: '#1677ff' }} />
              <span>任務詳細內容</span>
            </Space>
          }
          open={!!selectedTaskForView}
          onCancel={() => setSelectedTaskForView(null)}
          footer={[
            <Button key="close" type="primary" onClick={() => setSelectedTaskForView(null)}>
              關閉
            </Button>
          ]}
          width={500}
        >
          {selectedTaskForView && (
            <div style={{ fontSize: '14px', lineHeight: '2' }}>
              <p><strong>任務名稱：</strong> <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#111827' }}>{selectedTaskForView.title}</span></p>
              {selectedTaskForView.project && <p><strong>所屬專案：</strong> <Tag color="blue">{selectedTaskForView.project}</Tag></p>}
              <p><strong>開始日期：</strong> {dayjs(selectedTaskForView.startDate).format('YYYY-MM-DD (dddd)')}</p>
              <p><strong>預計結束：</strong> {dayjs(selectedTaskForView.endDate).format('YYYY-MM-DD (dddd)')}</p>
              <p>
                <strong>需求部門/人員：</strong> 
                {selectedTaskForView.department || '無'} {selectedTaskForView.demandPerson ? `(${selectedTaskForView.demandPerson})` : ''}
              </p>
              <p>
                <strong>執行單位/人員：</strong> 
                <Tag color="geekblue">{selectedTaskForView.executingDepartment}</Tag> 
                {selectedTaskForView.executingPerson && <Tag color="cyan">{selectedTaskForView.executingPerson}</Tag>}
              </p>
              <p>
                <strong>優先程度：</strong> 
                {selectedTaskForView.priority === 'highest' && <Tag color="magenta">🔥 最高</Tag>}
                {selectedTaskForView.priority === 'high' && <Tag color="red">高</Tag>}
                {selectedTaskForView.priority === 'medium' && <Tag color="orange">中</Tag>}
                {selectedTaskForView.priority === 'low' && <Tag color="green">低</Tag>}
              </p>
              <p>
                <strong>階段狀態：</strong> 
                {selectedTaskForView.status === 'not_started' && <Tag color="default">⚪ 尚未開始</Tag>}
                {selectedTaskForView.status === 'in_progress' && <Tag color="processing">🔵 進行中</Tag>}
                {selectedTaskForView.status === 'completed' && <Tag color="success">🟢 已完成</Tag>}
              </p>
              <p><strong>是否已溝通：</strong> {selectedTaskForView.communicated ? '✅ 是' : '❌ 否'}</p>
              <p><strong>備註事項：</strong></p>
              <div style={{ background: '#f5f5f5', padding: '10px 14px', borderRadius: '6px', whiteSpace: 'pre-wrap', border: '1px solid #f0f0f0' }}>
                {selectedTaskForView.remarks || '無備註'}
              </div>
            </div>
          )}
        </Modal>
      </div>
    </ConfigProvider>
  );
};

export default CalendarView;
