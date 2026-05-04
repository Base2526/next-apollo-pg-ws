"use client";
import { useState } from "react";
import { useQuery, gql } from "@apollo/client";
import { Card, Table, Input, Select, Button, Space, Tag, Typography, Alert, Empty } from "antd";
import { SearchOutlined, ClearOutlined, ReloadOutlined, UserOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";

const { Title } = Typography;

const GET_ADMIN_USERS = gql`
  query AdminUsers($filter: AdminUserFilterInput, $pagination: PaginationInput) {
    adminUsers(filter: $filter, pagination: $pagination) {
      total
      items {
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

export default function AdminUsersPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<any>({});
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 });
  
  // Form states
  const [search, setSearch] = useState<string>("");
  const [status, setStatus] = useState<string | undefined>();
  const [role, setRole] = useState<string | undefined>();

  const { data, loading, error, refetch } = useQuery(GET_ADMIN_USERS, {
    variables: { filter, pagination },
  });

  const handleSearch = () => {
    const newFilter: any = {};
    if (search) newFilter.search = search;
    if (status) newFilter.status = status;
    if (role) newFilter.role = role;
    setFilter(newFilter);
    setPagination({ page: 1, pageSize: 20 });
  };

  const handleClearFilter = () => {
    setSearch("");
    setStatus(undefined);
    setRole(undefined);
    setFilter({});
    setPagination({ page: 1, pageSize: 20 });
  };

  const handleTableChange = (pag: any) => {
    setPagination({
      page: pag.current,
      pageSize: pag.pageSize,
    });
  };

  const columns = [
    {
      title: 'ผู้ใช้',
      key: 'user',
      width: 250,
      render: (_: any, record: any) => (
        <div>
          <div style={{ fontWeight: 600 }}>{record.name || '-'}</div>
          <div style={{ fontSize: 12, color: '#666' }}>{record.phone || 'ไม่ระบุ'}</div>
        </div>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (role: string) => (
        <Tag color={ROLE_COLORS[role] || 'default'}>
          {ROLE_LABELS[role] || role}
        </Tag>
      ),
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={STATUS_COLORS[status] || 'default'}>
          {STATUS_LABELS[status] || status}
        </Tag>
      ),
    },
    {
      title: 'จำนวนโพย',
      dataIndex: 'totalOrders',
      key: 'totalOrders',
      width: 100,
      align: 'center' as const,
      render: (count: number) => count || 0,
    },
    {
      title: 'ยอดแทงรวม',
      dataIndex: 'totalBetAmount',
      key: 'totalBetAmount',
      width: 150,
      align: 'right' as const,
      render: (amount: number) => (
        <span style={{ fontWeight: 600, color: '#dc2626' }}>
          {amount?.toLocaleString() || 0} ฿
        </span>
      ),
    },
    {
      title: 'วันที่สมัคร',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (text: string) => formatDate(text),
    },
    {
      title: 'การจัดการ',
      key: 'actions',
      width: 120,
      align: 'center' as const,
      fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Button
          type="link"
          icon={<UserOutlined />}
          onClick={() => router.push(`/admin/users/${record.id}`)}
        >
          ดูรายละเอียด
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={2} style={{ marginBottom: 24 }}>ผู้ใช้ทั้งหมด</Title>

      {/* Filter Card */}
      <Card style={{ marginBottom: 24 }} title="ตัวกรอง">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space wrap size="middle">
            <div>
              <div style={{ marginBottom: 4, fontSize: 14, fontWeight: 600 }}>ค้นหา</div>
              <Input
                placeholder="เบอร์โทร / ชื่อ"
                style={{ width: 250 }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onPressEnter={handleSearch}
                prefix={<SearchOutlined />}
              />
            </div>

            <div>
              <div style={{ marginBottom: 4, fontSize: 14, fontWeight: 600 }}>สถานะ</div>
              <Select
                placeholder="ทั้งหมด"
                style={{ width: 150 }}
                value={status}
                onChange={setStatus}
                allowClear
              >
                <Select.Option value="active">ใช้งาน</Select.Option>
                <Select.Option value="disabled">ปิดใช้งาน</Select.Option>
                <Select.Option value="banned">ถูกแบน</Select.Option>
              </Select>
            </div>

            <div>
              <div style={{ marginBottom: 4, fontSize: 14, fontWeight: 600 }}>Role</div>
              <Select
                placeholder="ทั้งหมด"
                style={{ width: 150 }}
                value={role}
                onChange={setRole}
                allowClear
              >
                <Select.Option value="user">ผู้ใช้</Select.Option>
                <Select.Option value="admin">แอดมิน</Select.Option>
              </Select>
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

      {/* Users Table */}
      <Card>
        {error ? (
          <Alert
            type="error"
            message="โหลดรายการผู้ใช้ไม่สำเร็จ"
            description={error.message}
            showIcon
          />
        ) : (
          <Table
            columns={columns}
            dataSource={data?.adminUsers?.items || []}
            loading={loading}
            rowKey="id"
            pagination={{
              current: pagination.page,
              pageSize: pagination.pageSize,
              total: data?.adminUsers?.total || 0,
              showSizeChanger: true,
              showTotal: (total) => `ทั้งหมด ${total} รายการ`,
            }}
            onChange={handleTableChange}
            locale={{
              emptyText: loading ? ' ' : <Empty description="ไม่มีผู้ใช้" />,
            }}
            scroll={{ x: 1400 }}
          />
        )}
      </Card>
    </div>
  );
}
