"use client";

import { useQuery, gql } from "@apollo/client";
import { useParams, useRouter } from "next/navigation";
import {
  Card,
  Descriptions,
  Button,
  Tag,
  Typography,
  Alert,
  Skeleton,
  Space,
} from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

const { Title, Text } = Typography;

const ADMIN_LOG_QUERY = gql`
  query AdminLog($id: ID!) {
    adminLog(id: $id) {
      id
      action
      entityType
      entityId
      message
      userId
      userPhone
      userName
      ipAddress
      userAgent
      metadata
      createdAt
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

export default function LogDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params?.id as string) || "";

  const { data, loading, error } = useQuery(ADMIN_LOG_QUERY, {
    variables: { id },
    fetchPolicy: "network-only",
    skip: !id,
  });

  const log = data?.adminLog;

  const getActionColor = (action: string) => {
    for (const key in ACTION_COLORS) {
      if (action?.toUpperCase().includes(key)) {
        return ACTION_COLORS[key];
      }
    }
    return "default";
  };

  if (loading) {
    return (
      <div>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push("/admin/logs")}
          style={{ marginBottom: 16 }}
        >
          กลับ
        </Button>
        <Card>
          <Skeleton active paragraph={{ rows: 8 }} />
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push("/admin/logs")}
          style={{ marginBottom: 16 }}
        >
          กลับ
        </Button>
        <Alert
          type="error"
          message="โหลดข้อมูล Log ไม่สำเร็จ"
          description={error.message}
          showIcon
        />
      </div>
    );
  }

  if (!log) {
    return (
      <div>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push("/admin/logs")}
          style={{ marginBottom: 16 }}
        >
          กลับ
        </Button>
        <Alert
          type="warning"
          message="ไม่พบข้อมูล Log"
          description="Log ID ที่ระบุไม่มีในระบบ"
          showIcon
        />
      </div>
    );
  }

  return (
    <div>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => router.push("/admin/logs")}
        style={{ marginBottom: 16 }}
      >
        กลับ
      </Button>

      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          รายละเอียด Log
        </Title>
        <Text type="secondary">Activity Log Detail</Text>
      </div>

      {/* Summary Card */}
      <Card
        title="ข้อมูลทั่วไป"
        style={{ marginBottom: 20 }}
      >
        <Descriptions column={2} bordered>
          <Descriptions.Item label="Log ID" span={2}>
            <Text code>{log.id}</Text>
          </Descriptions.Item>

          <Descriptions.Item label="Action">
            <Tag color={getActionColor(log.action)} style={{ fontSize: 14 }}>
              {log.action}
            </Tag>
          </Descriptions.Item>

          <Descriptions.Item label="เวลา">
            {log.createdAt
              ? dayjs(log.createdAt).format("DD/MM/YYYY HH:mm:ss")
              : "-"}
          </Descriptions.Item>

          <Descriptions.Item label="Entity Type">
            {log.entityType ? (
              <Tag>{log.entityType}</Tag>
            ) : (
              <Text type="secondary">-</Text>
            )}
          </Descriptions.Item>

          <Descriptions.Item label="Entity ID">
            {log.entityId ? (
              <Text code>{log.entityId}</Text>
            ) : (
              <Text type="secondary">-</Text>
            )}
          </Descriptions.Item>

          <Descriptions.Item label="Message" span={2}>
            {log.message ? (
              <Text>{log.message}</Text>
            ) : (
              <Text type="secondary">-</Text>
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* User Info Card */}
      {(log.userId || log.userPhone || log.userName) && (
        <Card title="ข้อมูลผู้ใช้" style={{ marginBottom: 20 }}>
          <Descriptions column={2} bordered>
            <Descriptions.Item label="User ID">
              {log.userId ? (
                <Text code>{log.userId}</Text>
              ) : (
                <Text type="secondary">System</Text>
              )}
            </Descriptions.Item>

            <Descriptions.Item label="ชื่อ">
              {log.userName || <Text type="secondary">-</Text>}
            </Descriptions.Item>

            <Descriptions.Item label="เบอร์โทร" span={2}>
              {log.userPhone || <Text type="secondary">-</Text>}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {/* Network Info Card */}
      {(log.ipAddress || log.userAgent) && (
        <Card title="ข้อมูลเครือข่าย" style={{ marginBottom: 20 }}>
          <Descriptions column={1} bordered>
            <Descriptions.Item label="IP Address">
              {log.ipAddress ? (
                <Text code>{log.ipAddress}</Text>
              ) : (
                <Text type="secondary">-</Text>
              )}
            </Descriptions.Item>

            <Descriptions.Item label="User Agent">
              {log.userAgent ? (
                <Text style={{ fontSize: 12, wordBreak: "break-all" }}>
                  {log.userAgent}
                </Text>
              ) : (
                <Text type="secondary">-</Text>
              )}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {/* Metadata Card */}
      {log.metadata && (
        <Card title="Metadata (JSON)">
          <pre
            style={{
              background: "#f5f5f5",
              padding: 16,
              borderRadius: 8,
              overflow: "auto",
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            <code>{log.metadata}</code>
          </pre>
        </Card>
      )}
    </div>
  );
}
