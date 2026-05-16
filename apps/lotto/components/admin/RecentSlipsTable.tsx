import React from "react";
import { Card, Table, Tag, Empty, Button, Modal, message } from "antd";
import { FileTextOutlined, CheckOutlined, RollbackOutlined } from "@ant-design/icons";
import { useMutation } from "@apollo/client";
import { APPROVE_SLIP, REFUND_ORDER } from "../../graphql/mutations";
import { getSlipStatusLabel, getSlipStatusColor, formatDate, getSlipAdminAction } from "../../lib/slipHelpers";

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
    refetchQueries: ['AdminDashboard', 'LottoDraw', 'AdminDraws'],
  });

  const [refundOrder, { loading: refunding }] = useMutation(REFUND_ORDER, {
    onCompleted: () => {
      message.success('คืนเงินสำเร็จแล้ว');
      if (onRefetch) onRefetch();
    },
    onError: (err) => {
      message.error(err.message || 'เกิดข้อผิดพลาดในการคืนเงิน');
    },
    refetchQueries: ['AdminDashboard', 'LottoDraw', 'AdminDraws'],
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

  const handleRefundOrder = (orderId: string, orderNo: string) => {
    Modal.confirm({
      title: 'ยืนยันการคืนเงิน',
      content: `ต้องการคืนเงินให้โพยเลขที่ ${orderNo} ใช่หรือไม่?`,
      okText: 'ยืนยันคืนเงิน',
      cancelText: 'ยกเลิก',
      okButtonProps: { loading: refunding, danger: true },
      onOk: async () => {
        await refundOrder({ 
          variables: { 
            orderId,
            reason: 'Admin คืนเงินด้วยตัวเอง (หมดเวลารับโพย)' 
          } 
        });
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
      title: 'งวด / รอบ',
      key: 'drawInfo',
      width: 150,
      render: (_: any, record: any) => {
        // Priority: Use drawNameTh if available
        if (record.drawNameTh) {
          return <span style={{ fontSize: 12 }}>{record.drawNameTh}</span>;
        }

        // Fallback based on category
        if (record.categoryCode === 'YEEKEE_VIP' && record.roundNo) {
          return <span style={{ fontSize: 12 }}>รอบที่ {record.roundNo}</span>;
        }

        if (record.categoryCode === 'THAI_GOVERNMENT' && record.drawDate) {
          // Format date - handle epoch ms, ISO, or YYYY-MM-DD
          const formatDrawDate = (value: any) => {
            if (!value) return '-';
            
            const raw = String(value).trim();
            
            // Handle epoch milliseconds (10-13 digits)
            if (/^\d{10,13}$/.test(raw)) {
              const ms = raw.length === 10 ? Number(raw) * 1000 : Number(raw);
              const d = new Date(ms);
              if (!isNaN(d.getTime())) {
                return d.toLocaleDateString('th-TH', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                });
              }
            }
            
            // Handle ISO or YYYY-MM-DD
            const d = new Date(raw);
            if (!isNaN(d.getTime())) {
              return d.toLocaleDateString('th-TH', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              });
            }
            
            return '-';
          };

          return <span style={{ fontSize: 12 }}>งวดวันที่ {formatDrawDate(record.drawDate)}</span>;
        }

        // Show draw code if available
        if (record.drawCode) {
          return <span style={{ fontSize: 12, color: '#6b7280' }}>{record.drawCode}</span>;
        }

        return '-';
      },
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
      key: 'status',
      render: (_: any, record: any) => {
        const label = getSlipStatusLabel(record.status || 'pending', record.resultStatus);
        const color = getSlipStatusColor(record.status || 'pending', record.resultStatus);
        return (
          <Tag color={color}>
            {label}
          </Tag>
        );
      },
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
      width: 150,
      render: (_: any, record: any) => {
        const actionInfo = getSlipAdminAction(record.status, record.resultStatus, record.closeAt);

        // Show approve button
        if (actionInfo.type === 'APPROVE') {
          return (
            <Button
              type="primary"
              icon={<CheckOutlined />}
              size="small"
              onClick={() => handleApproveSlip(record.id, record.orderNo)}
              loading={approving}
            >
              {actionInfo.label}
            </Button>
          );
        }

        // Show refund button
        if (actionInfo.type === 'REFUND') {
          return (
            <Button
              danger
              icon={<RollbackOutlined />}
              size="small"
              onClick={() => handleRefundOrder(record.id, record.orderNo)}
              loading={refunding}
            >
              {actionInfo.label}
            </Button>
          );
        }

        // Show status tag
        if (actionInfo.type === 'APPROVED' || actionInfo.type === 'REFUNDED' || actionInfo.type === 'REJECTED') {
          return <Tag color={actionInfo.color}>{actionInfo.label}</Tag>;
        }

        // Default: show "-"
        return <span style={{ color: '#999' }}>{actionInfo.label}</span>;
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
