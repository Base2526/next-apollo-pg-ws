import React from "react";
import { Card, Table, Tag, Empty, Button, Modal, message } from "antd";
import { FileTextOutlined, CheckOutlined } from "@ant-design/icons";
import { useMutation } from "@apollo/client";
import { APPROVE_SLIP } from "../../graphql/mutations";
import { STATUS_LABELS, STATUS_COLORS, formatDate } from "../../lib/slipHelpers";

interface RecentSlipsTableProps {
  slips: any[];
  showActions?: boolean;
  onRefetch?: () => void;
}

export default function RecentSlipsTable({ slips, showActions = false, onRefetch }: RecentSlipsTableProps) {
  const [approveSlip, { loading: approving }] = useMutation(APPROVE_SLIP, {
    onCompleted: () => {
      message.success('รับโพยสำเร็จแล้ว');
      if (onRefetch) onRefetch();
    },
    onError: (err) => {
      message.error(err.message || 'เกิดข้อผิดพลาดในการรับโพย');
    },
  });

  const handleApproveSlip = (orderId: string, orderNo: string) => {
    Modal.confirm({
      title: 'ยืนยันการรับโพย',
      content: `ต้องการรับโพยเลขที่ ${orderNo} ใช่หรือไม่?`,
      okText: 'ยืนยันรับโพย',
      cancelText: 'ยกเลิก',
      okButtonProps: { loading: approving },
      onOk: async () => {
        await approveSlip({ variables: { orderId } });
      },
    });
  };

  const columns = [
    {
      title: 'เลขที่โพย',
      dataIndex: 'orderNo',
      key: 'orderNo',
      width: 120,
      render: (text: string, record: any) => (
        <div>
          <div style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 12 }}>{text || `#${record.id}`}</div>
        </div>
      ),
    },
    {
      title: 'ผู้ใช้',
      dataIndex: 'userPhone',
      key: 'userPhone',
      render: (phone: string) => phone || '-',
    },
    {
      title: 'ประเภทหวย',
      dataIndex: 'categoryName',
      key: 'categoryName',
      render: (name: string) => name || '-',
    },
    {
      title: 'ยอดรวม',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (amount: number) => (
        <span style={{ fontWeight: 600, color: '#dc2626' }}>
          {amount?.toLocaleString() || 0} ฿
        </span>
      ),
    },
    {
      title: 'สถานะ',
      dataIndex: 'resultStatus',
      key: 'resultStatus',
      render: (status: string) => (
        <Tag color={STATUS_COLORS[status] || 'default'}>
          {STATUS_LABELS[status] || status}
        </Tag>
      ),
    },
    {
      title: 'วันที่สร้าง',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => formatDate(date),
    },
  ];

  // Add action column if showActions is true
  if (showActions) {
    columns.push({
      title: 'การจัดการ',
      key: 'actions',
      width: 100,
      render: (_: any, record: any) => {
        if (record.resultStatus === 'pending') {
          return (
            <Button
              type="primary"
              icon={<CheckOutlined />}
              size="small"
              onClick={() => handleApproveSlip(record.id, record.orderNo)}
              loading={approving}
            >
              รับโพย
            </Button>
          );
        }
        return <span style={{ color: '#999' }}>-</span>;
      },
    } as any);
  }

  return (
    <Card 
      title={<span><FileTextOutlined /> โพยล่าสุด</span>}
      style={{ marginBottom: 32 }}
    >
      <Table
        dataSource={slips || []}
        columns={columns}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        scroll={{ x: 800 }}
        locale={{
          emptyText: <Empty description="ไม่มีข้อมูล" />,
        }}
      />
    </Card>
  );
}
