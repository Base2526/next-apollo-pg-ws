"use client";
import { useQuery, gql } from "@apollo/client";
import { useParams, useRouter } from "next/navigation";
import { Card, Descriptions, Table, Tag, Typography, Alert, Skeleton, Button, Space, Statistic, Row, Col, Avatar } from "antd";
import { UserOutlined, ArrowLeftOutlined, ShoppingOutlined, WalletOutlined } from "@ant-design/icons";

const { Title } = Typography;

const GET_ADMIN_USER = gql`
  query AdminUser($id: ID!) {
    adminUser(id: $id) {
      id
      phone
      name
      email
      credit
      status
      role
      createdAt
      lastLoginAt
      totalOrders
      totalBetAmount
      slips {
        id
        orderNo
        categoryName
        drawName
        drawDate
        totalAmount
        totalWin
        resultStatus
        createdAt
        items {
          id
          betTypeName
          number
          amount
          payoutRate
          possibleWin
        }
      }
    }
  }
`;

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

const STATUS_LABELS: Record<string, string> = {
  active: "ใช้งาน",
  disabled: "ปิดใช้งาน",
  banned: "ถูกแบน",
};

const STATUS_COLORS: Record<string, string> = {
  active: "green",
  disabled: "orange",
  banned: "red",
};

const ROLE_LABELS: Record<string, string> = {
  user: "ผู้ใช้",
  admin: "แอดมิน",
};

const ROLE_COLORS: Record<string, string> = {
  user: "blue",
  admin: "purple",
};

const RESULT_STATUS_LABELS: Record<string, string> = {
  pending: "รอตรวจ",
  won: "ถูกรางวัล",
  lost: "ไม่ถูกรางวัล",
  cancelled: "ยกเลิก",
  approved: "รับโพยแล้ว",
};

const RESULT_STATUS_COLORS: Record<string, string> = {
  pending: "orange",
  won: "green",
  lost: "default",
  cancelled: "red",
  approved: "green",
};

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = (params?.id as string) || '';

  const { data, loading, error } = useQuery(GET_ADMIN_USER, {
    variables: { id: userId },
    skip: !userId,
  });

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <Skeleton active />
        <Skeleton active style={{ marginTop: 16 }} />
        <Skeleton active style={{ marginTop: 16 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          type="error"
          message="โหลดข้อมูลผู้ใช้ไม่สำเร็จ"
          description={error.message}
          showIcon
        />
      </div>
    );
  }

  if (!data?.adminUser) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          type="warning"
          message="ไม่พบผู้ใช้"
          description="ไม่พบข้อมูลผู้ใช้ในระบบ"
          showIcon
        />
        <Button 
          style={{ marginTop: 16 }}
          onClick={() => router.push('/admin/users')}
        >
          กลับไปหน้ารายการผู้ใช้
        </Button>
      </div>
    );
  }

  const user = data.adminUser;

  const slipColumns = [
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
        <Tag color={RESULT_STATUS_COLORS[status] || 'default'}>
          {RESULT_STATUS_LABELS[status] || status}
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
  ];

  const expandedRowRender = (record: any) => {
    const itemColumns = [
      {
        title: 'ประเภท',
        dataIndex: 'betTypeName',
        key: 'betTypeName',
        render: (text: string) => text || '-',
      },
      {
        title: 'เลข',
        dataIndex: 'number',
        key: 'number',
        render: (text: string) => (
          <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 16 }}>
            {text}
          </span>
        ),
      },
      {
        title: 'ยอดแทง',
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
    ];

    return (
      <div style={{ padding: '16px 24px', background: '#fafafa' }}>
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
      {/* Header */}
      <Space style={{ marginBottom: 24 }}>
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => router.push('/admin/users')}
        >
          กลับ
        </Button>
        <Title level={2} style={{ margin: 0 }}>รายละเอียดผู้ใช้</Title>
      </Space>

      {/* User Profile Card */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={24}>
          <Col span={4}>
            <Avatar size={80} icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
          </Col>
          <Col span={20}>
            <Descriptions column={2} size="middle">
              <Descriptions.Item label="ชื่อ">{user.name || '-'}</Descriptions.Item>
              <Descriptions.Item label="เบอร์โทร">{user.phone || '-'}</Descriptions.Item>
              <Descriptions.Item label="Role">
                <Tag color={ROLE_COLORS[user.role] || 'default'}>
                  {ROLE_LABELS[user.role] || user.role}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="สถานะ">
                <Tag color={STATUS_COLORS[user.status] || 'default'}>
                  {STATUS_LABELS[user.status] || user.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="วันที่สมัคร">
                {formatDate(user.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label="อัพเดทล่าสุด">
                {formatDate(user.lastLoginAt)}
              </Descriptions.Item>
            </Descriptions>
          </Col>
        </Row>
      </Card>

      {/* Summary Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card>
            <Statistic
              title="จำนวนโพยทั้งหมด"
              value={user.totalOrders || 0}
              prefix={<ShoppingOutlined />}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card>
            <Statistic
              title="ยอดแทงรวม"
              value={user.totalBetAmount || 0}
              precision={2}
              suffix="฿"
              valueStyle={{ color: '#dc2626' }}
              prefix={<WalletOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* User Slips Table */}
      <Card title="โพยหวยของผู้ใช้">
        <Table
          columns={slipColumns}
          dataSource={user.slips || []}
          rowKey="id"
          expandable={{
            expandedRowRender,
            rowExpandable: (record) => record.items && record.items.length > 0,
          }}
          pagination={{
            pageSize: 10,
            showTotal: (total) => `ทั้งหมด ${total} รายการ`,
          }}
          locale={{
            emptyText: "ไม่มีโพยหวย",
          }}
          scroll={{ x: 1200 }}
        />
      </Card>
    </div>
  );
}
