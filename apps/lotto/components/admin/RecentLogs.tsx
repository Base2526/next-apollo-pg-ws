import React from "react";
import { Card, Table, Tag, Empty } from "antd";
import { HistoryOutlined } from "@ant-design/icons";

// Safe date formatter
function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleString('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return "-";
  }
}

export default function RecentLogs({ logs }: { logs: any[] }) {
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: 'การกระทำ',
      dataIndex: 'action',
      key: 'action',
      render: (action: string) => <Tag color="blue">{action}</Tag>,
    },
    {
      title: 'ผู้ใช้',
      dataIndex: 'userPhone',
      key: 'userPhone',
      render: (phone: string) => phone || '-',
    },
    {
      title: 'วันที่',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => formatDate(date),
    },
  ];

  return (
    <Card 
      title={<span><HistoryOutlined /> ประวัติการกระทำ</span>}
      style={{ marginBottom: 32 }}
    >
      <Table
        dataSource={logs || []}
        columns={columns}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        scroll={{ x: 600 }}
        locale={{
          emptyText: <Empty description="ไม่มีข้อมูล" />,
        }}
      />
    </Card>
  );
}
