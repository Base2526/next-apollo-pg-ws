"use client";

import { useState } from "react";
import { useQuery, gql } from "@apollo/client";
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Input,
  Select,
  DatePicker,
  Typography,
  Alert,
  Tooltip,
} from "antd";
import {
  ReloadOutlined,
  SearchOutlined,
  ClearOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import Link from "next/link";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const ADMIN_LOGS_QUERY = gql`
  query AdminLogs($filter: AdminLogFilterInput, $pagination: PaginationInput) {
    adminLogs(filter: $filter, pagination: $pagination) {
      total
      items {
        id
        action
        entityType
        entityId
        message
        userId
        userPhone
        userName
        ipAddress
        createdAt
      }
    }
  }
`;

const ACTION_COLORS: Record<string, string> = {
  LOGIN: "blue",
  LOGOUT: "default",
  CREATE: "green",
  UPDATE: "orange",
  DELETE: "red",
  APPROVE: "cyan",
  REJECT: "magenta",
  SYSTEM: "purple",
};

export default function AdminLogsPage() {
  const [filter, setFilter] = useState<any>({});
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 });
  const [tempFilter, setTempFilter] = useState<any>({});

  const { data, loading, error, refetch } = useQuery(ADMIN_LOGS_QUERY, {
    variables: { filter, pagination },
    fetchPolicy: "network-only",
  });

  const logs = data?.adminLogs?.items || [];
  const total = data?.adminLogs?.total || 0;

  const handleSearch = () => {
    setFilter(tempFilter);
    setPagination({ page: 1, pageSize: 20 });
  };

  const handleClear = () => {
    setTempFilter({});
    setFilter({});
    setPagination({ page: 1, pageSize: 20 });
  };

  const getActionColor = (action: string) => {
    for (const key in ACTION_COLORS) {
      if (action?.toUpperCase().includes(key)) {
        return ACTION_COLORS[key];
      }
    }
    return "default";
  };

  const columns = [
    {
      title: "เวลา",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 180,
      render: (createdAt: string) =>
        createdAt ? dayjs(createdAt).format("DD/MM/YYYY HH:mm:ss") : "-",
    },
    {
      title: "ผู้ใช้",
      key: "user",
      width: 150,
      render: (_: any, record: any) => {
        if (record.userName || record.userPhone) {
          return (
            <div>
              <div>
                <Text strong>{record.userName || "-"}</Text>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {record.userPhone || "-"}
                </Text>
              </div>
            </div>
          );
        }
        return <Text type="secondary">System</Text>;
      },
    },
    {
      title: "Action",
      dataIndex: "action",
      key: "action",
      width: 150,
      render: (action: string) => (
        <Tag color={getActionColor(action)}>{action}</Tag>
      ),
    },
    {
      title: "Entity",
      key: "entity",
      width: 150,
      render: (_: any, record: any) => {
        if (record.entityType) {
          return (
            <div>
              <div>
                <Text strong style={{ fontSize: 12 }}>
                  {record.entityType}
                </Text>
              </div>
              {record.entityId && (
                <div>
                  <Text type="secondary" code style={{ fontSize: 11 }}>
                    {record.entityId.substring(0, 8)}...
                  </Text>
                </div>
              )}
            </div>
          );
        }
        return "-";
      },
    },
    {
      title: "Message",
      dataIndex: "message",
      key: "message",
      ellipsis: true,
      render: (message: string) => (
        <Tooltip title={message}>
          <Text>{message || "-"}</Text>
        </Tooltip>
      ),
    },
    {
      title: "IP Address",
      dataIndex: "ipAddress",
      key: "ipAddress",
      width: 130,
      render: (ip: string) => (
        <Text code style={{ fontSize: 12 }}>
          {ip || "-"}
        </Text>
      ),
    },
    {
      title: "การจัดการ",
      key: "action",
      width: 100,
      fixed: "right" as const,
      render: (_: any, record: any) => (
        <Link href={`/admin/logs/${record.id}`}>
          <Button size="small" icon={<EyeOutlined />}>
            ดูรายละเอียด
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          ประวัติการทำงาน
        </Title>
        <Text type="secondary">Activity Logs</Text>
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: 20 }}>
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <Space wrap>
            <Select
              placeholder="Action"
              style={{ width: 150 }}
              allowClear
              value={tempFilter.action}
              onChange={(value) =>
                setTempFilter({ ...tempFilter, action: value })
              }
            >
              <Select.Option value="LOGIN">LOGIN</Select.Option>
              <Select.Option value="CREATE">CREATE</Select.Option>
              <Select.Option value="UPDATE">UPDATE</Select.Option>
              <Select.Option value="DELETE">DELETE</Select.Option>
              <Select.Option value="APPROVE">APPROVE</Select.Option>
              <Select.Option value="REJECT">REJECT</Select.Option>
            </Select>

            <Select
              placeholder="Entity Type"
              style={{ width: 150 }}
              allowClear
              value={tempFilter.entityType}
              onChange={(value) =>
                setTempFilter({ ...tempFilter, entityType: value })
              }
            >
              <Select.Option value="DEPOSIT">DEPOSIT</Select.Option>
              <Select.Option value="WITHDRAWAL">WITHDRAWAL</Select.Option>
              <Select.Option value="SLIP">SLIP</Select.Option>
              <Select.Option value="USER">USER</Select.Option>
            </Select>

            <Input
              placeholder="เบอร์โทรผู้ใช้"
              style={{ width: 180 }}
              value={tempFilter.userPhone}
              onChange={(e) =>
                setTempFilter({ ...tempFilter, userPhone: e.target.value })
              }
            />

            <RangePicker
              format="DD/MM/YYYY"
              placeholder={["วันที่เริ่ม", "วันที่สิ้นสุด"]}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setTempFilter({
                    ...tempFilter,
                    dateFrom: dates[0].format("YYYY-MM-DD"),
                    dateTo: dates[1].format("YYYY-MM-DD"),
                  });
                } else {
                  const { dateFrom, dateTo, ...rest } = tempFilter;
                  setTempFilter(rest);
                }
              }}
            />
          </Space>

          <Space>
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={handleSearch}
            >
              ค้นหา
            </Button>
            <Button icon={<ClearOutlined />} onClick={handleClear}>
              ล้างตัวกรอง
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
              รีเฟรช
            </Button>
          </Space>
        </Space>
      </Card>

      {/* Error State */}
      {error && (
        <Alert
          type="error"
          message="โหลดข้อมูล Logs ไม่สำเร็จ"
          description={error.message}
          style={{ marginBottom: 20 }}
          action={
            <Button onClick={() => refetch()} size="small">
              ลองใหม่
            </Button>
          }
        />
      )}

      {/* Table */}
      <Card>
        <Table
          dataSource={logs}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            total,
            current: pagination.page,
            pageSize: pagination.pageSize,
            showSizeChanger: true,
            showTotal: (total) => `ทั้งหมด ${total} รายการ`,
            onChange: (page, pageSize) => {
              setPagination({ page, pageSize });
            },
          }}
        />
      </Card>
    </div>
  );
}
