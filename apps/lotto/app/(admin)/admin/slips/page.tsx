"use client";
import { useState } from "react";
import { useQuery, gql, useMutation } from "@apollo/client";
import { Card, Table, Select, DatePicker, Input, Button, Space, Tag, Typography, Alert, Descriptions, Modal, message } from "antd";
import { SearchOutlined, ClearOutlined, ReloadOutlined, CheckOutlined, RollbackOutlined } from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import { APPROVE_SLIP, REFUND_ORDER } from "../../../../graphql/mutations";
import { STATUS_LABELS, STATUS_COLORS, formatDate, getSlipAdminAction } from "../../../../lib/slipHelpers";

const { RangePicker } = DatePicker;
const { Title } = Typography;

const GET_ADMIN_SLIPS = gql`
  query AdminSlips($filter: AdminSlipFilterInput, $pagination: PaginationInput) {
    adminSlips(filter: $filter, pagination: $pagination) {
      total
      items {
        id
        orderNo
        userId
        userPhone
        userName
        categoryCode
        categoryName
        drawId
        drawName
        drawDate
        totalAmount
        totalWin
        resultStatus
        status
        createdAt
        checkedAt
        closeAt
        items {
          id
          betTypeCode
          betTypeName
          number
          amount
          payoutRate
          possibleWin
          generatedFrom
        }
      }
    }
  }
`;

const GET_LOTTO_CATEGORIES = gql`
  query LottoCategories {
    lottoCategories {
      code
      name_th
      is_active
    }
  }
`;

export default function AdminSlipsPage() {
  const [filter, setFilter] = useState<any>({});
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 });
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  
  // Form states
  const [categoryCode, setCategoryCode] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [resultStatus, setResultStatus] = useState<string | undefined>();
  const [userPhone, setUserPhone] = useState<string>("");

  const { data, loading, error, refetch } = useQuery(GET_ADMIN_SLIPS, {
    variables: { filter, pagination },
    onError: (err) => {
      console.log("[ADMIN_SLIPS_QUERY_DEBUG]", {
        queryVariables: { filter, pagination },
        error: err.message,
        networkError: err.networkError,
        graphQLErrors: err.graphQLErrors,
        timestamp: new Date().toISOString(),
      });
    },
  });

  const [approveSlip, { loading: approving }] = useMutation(APPROVE_SLIP, {
    onCompleted: () => {
      message.success('รับโพยสำเร็จแล้ว');
      refetch();
    },
    onError: (err) => {
      message.error(err.message || 'เกิดข้อผิดพลาดในการรับโพย');
    },
    refetchQueries: ['AdminDashboard', 'LottoDraw', 'AdminDraws', 'AdminSlips'],
  });

  const [refundOrder, { loading: refunding }] = useMutation(REFUND_ORDER, {
    onCompleted: () => {
      message.success('คืนเงินสำเร็จแล้ว');
      refetch();
    },
    onError: (err) => {
      message.error(err.message || 'เกิดข้อผิดพลาดในการคืนเงิน');
    },
    refetchQueries: ['AdminDashboard', 'LottoDraw', 'AdminDraws', 'AdminSlips'],
  });

  const { data: categoriesData } = useQuery(GET_LOTTO_CATEGORIES);
  const categories = categoriesData?.lottoCategories?.filter((c: any) => c.is_active) || [];

  const handleSearch = () => {
    const newFilter: any = {};
    if (categoryCode) newFilter.categoryCode = categoryCode;
    if (dateRange) {
      newFilter.dateFrom = dateRange[0].format('YYYY-MM-DD');
      newFilter.dateTo = dateRange[1].format('YYYY-MM-DD');
    }
    if (resultStatus) newFilter.resultStatus = resultStatus;
    if (userPhone) newFilter.userPhone = userPhone;
    setFilter(newFilter);
    setPagination({ page: 1, pageSize: 20 });
  };

  const handleClearFilter = () => {
    setCategoryCode(undefined);
    setDateRange(null);
    setResultStatus(undefined);
    setUserPhone("");
    setFilter({});
    setPagination({ page: 1, pageSize: 20 });
  };

  const handleTableChange = (pag: any) => {
    setPagination({
      page: pag.current,
      pageSize: pag.pageSize,
    });
  };

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
      width: 150,
      render: (text: string, record: any) => (
        <div>
          <div style={{ fontFamily: 'monospace', fontWeight: 600 }}>{text || `#${record.id}`}</div>
          <div style={{ fontSize: 11, color: '#999' }}>ID: {record.id}</div>
        </div>
      ),
    },
    {
      title: 'ผู้ใช้',
      key: 'user',
      width: 150,
      render: (_: any, record: any) => (
        <div>
          <div style={{ fontWeight: 600 }}>{record.userName || '-'}</div>
          <div style={{ fontSize: 12, color: '#666' }}>{record.userPhone || 'ไม่ระบุ'}</div>
        </div>
      ),
    },
    {
      title: 'ประเภทหวย',
      dataIndex: 'categoryName',
      key: 'categoryName',
      width: 150,
      render: (text: string) => text || '-',
    },
    {
      title: 'งวด',
      key: 'draw',
      width: 200,
      render: (_: any, record: any) => (
        <div>
          <div style={{ fontWeight: 600 }}>{record.drawName || '-'}</div>
          <div style={{ fontSize: 12, color: '#666' }}>
            {formatDate(record.drawDate)}
          </div>
        </div>
      ),
    },
    {
      title: 'ยอดรวม',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 120,
      align: 'right' as const,
      render: (amount: number) => (
        <span style={{ fontWeight: 700, color: '#dc2626' }}>
          {amount?.toLocaleString()} ฿
        </span>
      ),
    },
    {
      title: 'ยอดถูก',
      dataIndex: 'totalWin',
      key: 'totalWin',
      width: 120,
      align: 'right' as const,
      render: (amount: number) => (
        amount > 0 ? (
          <span style={{ fontWeight: 700, color: '#2f8f3a' }}>
            {amount?.toLocaleString()} ฿
          </span>
        ) : <span style={{ color: '#999' }}>-</span>
      ),
    },
    {
      title: 'สถานะ',
      dataIndex: 'resultStatus',
      key: 'resultStatus',
      width: 120,
      render: (status: string) => (
        <Tag color={STATUS_COLORS[status] || 'default'}>
          {STATUS_LABELS[status] || status}
        </Tag>
      ),
    },
    {
      title: 'วันที่ซื้อ',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (text: string) => formatDate(text),
    },
    {
      title: 'การจัดการ',
      key: 'actions',
      width: 150,
      align: 'center' as const,
      fixed: 'right' as const,
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
    },
    {
      title: 'รายการ',
      key: 'items',
      width: 80,
      align: 'center' as const,
      render: (_: any, record: any) => (
        <span style={{ fontWeight: 600, color: '#1890ff' }}>
          {record.items?.length || 0}
        </span>
      ),
    },
  ];

  const expandedRowRender = (record: any) => {
    const itemColumns = [
      {
        title: 'ประเภทแทง',
        dataIndex: 'betTypeName',
        key: 'betTypeName',
        render: (text: string, item: any) => text || item.betTypeCode,
      },
      {
        title: 'เลข',
        dataIndex: 'number',
        key: 'number',
        render: (text: string) => (
          <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700 }}>
            {text}
          </span>
        ),
      },
      {
        title: 'ราคา',
        dataIndex: 'amount',
        key: 'amount',
        align: 'right' as const,
        render: (amount: number) => `${amount?.toLocaleString()} ฿`,
      },
      {
        title: 'อัตราจ่าย',
        dataIndex: 'payoutRate',
        key: 'payoutRate',
        align: 'center' as const,
        render: (rate: number) => (
          <Tag color="green">{rate}x</Tag>
        ),
      },
      {
        title: 'อาจถูก',
        dataIndex: 'possibleWin',
        key: 'possibleWin',
        align: 'right' as const,
        render: (amount: number) => (
          <span style={{ color: '#2f8f3a', fontWeight: 600 }}>
            {amount?.toLocaleString()} ฿
          </span>
        ),
      },
      {
        title: 'หมายเหตุ',
        dataIndex: 'generatedFrom',
        key: 'generatedFrom',
        render: (text: string) => text ? `กลับจาก ${text}` : '-',
      },
    ];

    return (
      <div style={{ padding: '16px 24px', background: '#fafafa' }}>
        <Descriptions size="small" column={3} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="เลขที่โพย">{record.orderNo}</Descriptions.Item>
          <Descriptions.Item label="ผู้ใช้">{record.userPhone || 'ไม่ระบุ'}</Descriptions.Item>
          <Descriptions.Item label="รวมทั้งหมด">
            <span style={{ fontWeight: 700, color: '#dc2626' }}>
              {record.totalAmount?.toLocaleString()} ฿
            </span>
          </Descriptions.Item>
        </Descriptions>
        <Table
          columns={itemColumns}
          dataSource={record.items}
          pagination={false}
          size="small"
          rowKey="id"
          bordered
        />
      </div>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={2} style={{ marginBottom: 24 }}>รายการโพยหวยทั้งหมด</Title>

      {/* Filter Card */}
      <Card style={{ marginBottom: 24 }} title="ตัวกรอง">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space wrap size="middle">
            <div>
              <div style={{ marginBottom: 4, fontSize: 14, fontWeight: 600 }}>ประเภทหวย</div>
              <Select
                placeholder="ทั้งหมด"
                style={{ width: 200 }}
                value={categoryCode}
                onChange={setCategoryCode}
                allowClear
              >
                {categories.map((cat: any) => (
                  <Select.Option key={cat.code} value={cat.code}>
                    {cat.name_th}
                  </Select.Option>
                ))}
              </Select>
            </div>

            <div>
              <div style={{ marginBottom: 4, fontSize: 14, fontWeight: 600 }}>วันที่ซื้อ</div>
              <RangePicker
                value={dateRange}
                onChange={(dates: any) => setDateRange(dates)}
                format="DD/MM/YYYY"
                placeholder={['เริ่มต้น', 'สิ้นสุด']}
              />
            </div>

            <div>
              <div style={{ marginBottom: 4, fontSize: 14, fontWeight: 600 }}>สถานะ</div>
              <Select
                placeholder="ทั้งหมด"
                style={{ width: 150 }}
                value={resultStatus}
                onChange={setResultStatus}
                allowClear
              >
                <Select.Option value="pending">รอตรวจ</Select.Option>
                <Select.Option value="approved">รับโพยแล้ว</Select.Option>
                <Select.Option value="refunded">คืนเงินแล้ว</Select.Option>
                <Select.Option value="rejected">ปฏิเสธ</Select.Option>
                <Select.Option value="won">ถูกรางวัล</Select.Option>
                <Select.Option value="lost">ไม่ถูกรางวัล</Select.Option>
                <Select.Option value="cancelled">ยกเลิก</Select.Option>
              </Select>
            </div>

            <div>
              <div style={{ marginBottom: 4, fontSize: 14, fontWeight: 600 }}>เบอร์โทรผู้ใช้</div>
              <Input
                placeholder="0812345678"
                style={{ width: 180 }}
                value={userPhone}
                onChange={(e) => setUserPhone(e.target.value)}
                onPressEnter={handleSearch}
              />
            </div>
          </Space>

          <Space>
            <Button 
              type="primary" 
              icon={<SearchOutlined />} 
              onClick={handleSearch}
            >
              ค้นหา
            </Button>
            <Button 
              icon={<ClearOutlined />} 
              onClick={handleClearFilter}
            >
              ล้างตัวกรอง
            </Button>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={() => refetch()}
            >
              รีเฟรช
            </Button>
          </Space>
        </Space>
      </Card>

      {/* Error State */}
      {error && (
        <Alert
          message="โหลดรายการโพยหวยไม่สำเร็จ"
          description={error.message}
          type="error"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={data?.adminSlips?.items || []}
          loading={loading}
          rowKey="id"
          pagination={{
            current: pagination.page,
            pageSize: pagination.pageSize,
            total: data?.adminSlips?.total || 0,
            showTotal: (total) => `ทั้งหมด ${total} รายการ`,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          onChange={handleTableChange}
          expandable={{
            expandedRowRender,
            expandedRowKeys,
            onExpandedRowsChange: (keys: any) => setExpandedRowKeys(keys),
          }}
          locale={{
            emptyText: 'ไม่มีรายการโพยหวย',
          }}
          scroll={{ x: 1200 }}
          bordered
        />
      </Card>
    </div>
  );
}
