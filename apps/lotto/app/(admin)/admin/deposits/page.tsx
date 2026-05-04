"use client";

import { useState } from "react";
import { useQuery, useMutation, gql } from "@apollo/client";
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Typography,
  Alert,
  Image,
  message,
  Tooltip,
  Statistic,
  Row,
  Col,
} from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
  ClearOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { TextArea } = Input;

const ADMIN_DEPOSITS_QUERY = gql`
  query AdminDeposits($filter: AdminDepositFilterInput, $pagination: PaginationInput) {
    adminDeposits(filter: $filter, pagination: $pagination) {
      total
      items {
        id
        userId
        userPhone
        userName
        amount
        method
        bankName
        bankAccountNo
        bankAccountName
        transferAt
        slipImageUrl
        note
        adminNote
        status
        approvedAt
        createdAt
      }
    }
  }
`;

const APPROVE_DEPOSIT_MUTATION = gql`
  mutation ApproveDeposit($id: ID!, $adminNote: String) {
    approveDeposit(id: $id, adminNote: $adminNote) {
      id
      status
      adminNote
    }
  }
`;

const REJECT_DEPOSIT_MUTATION = gql`
  mutation RejectDeposit($id: ID!, $adminNote: String!) {
    rejectDeposit(id: $id, adminNote: $adminNote) {
      id
      status
      adminNote
    }
  }
`;

const STATUS_LABELS: Record<string, string> = {
  PENDING: "รอตรวจ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ปฏิเสธ",
  CANCELLED: "ยกเลิก",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "orange",
  APPROVED: "green",
  REJECTED: "red",
  CANCELLED: "default",
};

export default function AdminDepositsPage() {
  const [filterForm] = Form.useForm();
  const [approveForm] = Form.useForm();
  const [rejectForm] = Form.useForm();

  const [filter, setFilter] = useState<any>({});
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 });
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedDeposit, setSelectedDeposit] = useState<any>(null);

  const { data, loading, refetch, error } = useQuery(ADMIN_DEPOSITS_QUERY, {
    variables: { filter, pagination },
    fetchPolicy: "network-only",
  });

  console.log("[AdminDeposits] Query state:", { loading, error: error?.message, data, filter, pagination });

  const [approveDeposit, { loading: approving }] = useMutation(APPROVE_DEPOSIT_MUTATION, {
    onCompleted: () => {
      message.success("อนุมัติฝากเงินสำเร็จ");
      setApproveModalVisible(false);
      approveForm.resetFields();
      refetch();
    },
    onError: (error) => {
      message.error(error.message || "เกิดข้อผิดพลาดในการอนุมัติ");
    },
  });

  const [rejectDeposit, { loading: rejecting }] = useMutation(REJECT_DEPOSIT_MUTATION, {
    onCompleted: () => {
      message.success("ปฏิเสธรายการฝากเงินแล้ว");
      setRejectModalVisible(false);
      rejectForm.resetFields();
      refetch();
    },
    onError: (error) => {
      message.error(error.message || "เกิดข้อผิดพลาดในการปฏิเสธ");
    },
  });

  const deposits = data?.adminDeposits?.items || [];
  const total = data?.adminDeposits?.total || 0;

  console.log("[AdminDeposits] Query state:", { loading, data, filter, pagination });

  // Stats
  const pendingCount = deposits.filter((d: any) => d.status === "PENDING").length;
  const approvedCount = deposits.filter((d: any) => d.status === "APPROVED").length;
  const rejectedCount = deposits.filter((d: any) => d.status === "REJECTED").length;

  const handleSearch = (values: any) => {
    const newFilter: any = {};

    if (values.status) {
      newFilter.status = values.status;
    }

    if (values.userPhone) {
      newFilter.userPhone = values.userPhone;
    }

    if (values.dateRange && values.dateRange.length === 2) {
      newFilter.dateFrom = values.dateRange[0].format("YYYY-MM-DD");
      newFilter.dateTo = values.dateRange[1].format("YYYY-MM-DD");
    }

    setFilter(newFilter);
    setPagination({ page: 1, pageSize: 20 });
  };

  const handleClearFilter = () => {
    filterForm.resetFields();
    setFilter({});
    setPagination({ page: 1, pageSize: 20 });
  };

  const handleApprove = (deposit: any) => {
    setSelectedDeposit(deposit);
    approveForm.setFieldsValue({ adminNote: "ยอดเข้าถูกต้อง" });
    setApproveModalVisible(true);
  };

  const handleReject = (deposit: any) => {
    setSelectedDeposit(deposit);
    rejectForm.resetFields();
    setRejectModalVisible(true);
  };

  const handleApproveSubmit = async (values: any) => {
    await approveDeposit({
      variables: {
        id: selectedDeposit.id,
        adminNote: values.adminNote || "ยอดเข้าถูกต้อง",
      },
    });
  };

  const handleRejectSubmit = async (values: any) => {
    await rejectDeposit({
      variables: {
        id: selectedDeposit.id,
        adminNote: values.adminNote,
      },
    });
  };

  const columns = [
    {
      title: "เลขที่",
      dataIndex: "id",
      key: "id",
      width: 100,
      render: (id: string) => (
        <Tooltip title={id}>
          <Text code style={{ fontSize: 11 }}>
            {id.substring(0, 8)}...
          </Text>
        </Tooltip>
      ),
    },
    {
      title: "ผู้ใช้",
      key: "user",
      width: 150,
      render: (_: any, record: any) => (
        <div>
          <div>
            <Text strong>{record.userName || "-"}</Text>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.userPhone}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: "จำนวนเงิน",
      dataIndex: "amount",
      key: "amount",
      width: 130,
      render: (amount: number) => (
        <Text strong style={{ fontSize: 16, color: "#dc2626" }}>
          {Number(amount).toLocaleString("th-TH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{" "}
          ฿
        </Text>
      ),
    },
    {
      title: "วิธีฝาก",
      dataIndex: "method",
      key: "method",
      width: 120,
      render: (method: string) => (
        <Tag color="blue">{method === "BANK_TRANSFER" ? "โอนธนาคาร" : "QR Code"}</Tag>
      ),
    },
    {
      title: "วันเวลาโอน",
      dataIndex: "transferAt",
      key: "transferAt",
      width: 150,
      render: (transferAt: string) =>
        transferAt
          ? dayjs(transferAt).format("DD/MM/YYYY HH:mm")
          : <Text type="secondary">-</Text>,
    },
    {
      title: "สลิป",
      dataIndex: "slipImageUrl",
      key: "slipImageUrl",
      width: 80,
      render: (slipImageUrl: string) =>
        slipImageUrl ? (
          <Image
            src={slipImageUrl}
            width={40}
            height={40}
            style={{ objectFit: "cover", borderRadius: 4 }}
            preview={{ mask: <EyeOutlined /> }}
          />
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: "สถานะ",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: string) => (
        <Tag
          color={STATUS_COLORS[status]}
          icon={
            status === "PENDING" ? (
              <ClockCircleOutlined />
            ) : status === "APPROVED" ? (
              <CheckCircleOutlined />
            ) : (
              <CloseCircleOutlined />
            )
          }
        >
          {STATUS_LABELS[status]}
        </Tag>
      ),
    },
    {
      title: "วันที่แจ้ง",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 140,
      render: (createdAt: string) => dayjs(createdAt).format("DD/MM/YYYY HH:mm"),
    },
    {
      title: "การจัดการ",
      key: "action",
      width: 180,
      fixed: "right" as const,
      render: (_: any, record: any) => {
        if (record.status === "PENDING") {
          return (
            <Space size="small">
              <Button
                type="primary"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleApprove(record)}
              >
                อนุมัติ
              </Button>
              <Button
                danger
                size="small"
                icon={<CloseCircleOutlined />}
                onClick={() => handleReject(record)}
              >
                ปฏิเสธ
              </Button>
            </Space>
          );
        }
        return <Text type="secondary">-</Text>;
      },
    },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          รายการฝากเงิน
        </Title>
        <Text type="secondary">จัดการรายการฝากเงินของผู้ใช้</Text>
      </div>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="รอตรวจสอบ"
              value={pendingCount}
              valueStyle={{ color: "#faad14" }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="อนุมัติแล้ว"
              value={approvedCount}
              valueStyle={{ color: "#52c41a" }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="ปฏิเสธ"
              value={rejectedCount}
              valueStyle={{ color: "#ff4d4f" }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: 20 }}>
        <Form form={filterForm} layout="inline" onFinish={handleSearch}>
          <Form.Item name="status" style={{ marginBottom: 8 }}>
            <Select placeholder="สถานะ" style={{ width: 150 }} allowClear>
              <Select.Option value="">ทั้งหมด</Select.Option>
              <Select.Option value="PENDING">รอตรวจ</Select.Option>
              <Select.Option value="APPROVED">อนุมัติแล้ว</Select.Option>
              <Select.Option value="REJECTED">ปฏิเสธ</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="userPhone" style={{ marginBottom: 8 }}>
            <Input placeholder="เบอร์โทร" style={{ width: 180 }} />
          </Form.Item>
          <Form.Item name="dateRange" style={{ marginBottom: 8 }}>
            <RangePicker format="DD/MM/YYYY" placeholder={["วันที่เริ่ม", "วันที่สิ้นสุด"]} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 8 }}>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
              ค้นหา
            </Button>
          </Form.Item>
          <Form.Item style={{ marginBottom: 8 }}>
            <Button onClick={handleClearFilter} icon={<ClearOutlined />}>
              ล้างตัวกรอง
            </Button>
          </Form.Item>
          <Form.Item style={{ marginBottom: 8 }}>
            <Button onClick={() => refetch()} icon={<ReloadOutlined />}>
              รีเฟรช
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* Error State */}
      {error && (
        <Alert
          type="error"
          message="โหลดข้อมูลฝากเงินไม่สำเร็จ"
          description={error.message}
          style={{ marginBottom: 20 }}
          action={
            <Button onClick={() => refetch()}>
              ลองใหม่
            </Button>
          }
        />
      )}

      {/* Table */}
      <Card>
        <Table
          dataSource={deposits}
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

      {/* Approve Modal */}
      <Modal
        title="ยืนยันอนุมัติฝากเงิน"
        open={approveModalVisible}
        onCancel={() => setApproveModalVisible(false)}
        footer={null}
        width={600}
      >
        {selectedDeposit && (
          <div>
            <Alert
              message="กรุณาตรวจสอบข้อมูลก่อนอนุมัติ"
              description="ระบบจะปรับยอดเครดิตของผู้ใช้อัตโนมัติ"
              type="warning"
              showIcon
              style={{ marginBottom: 20 }}
            />

            <Card size="small" style={{ marginBottom: 20, background: "#f9fafb" }}>
              <Space direction="vertical" style={{ width: "100%" }} size="small">
                <div>
                  <Text type="secondary">ผู้ใช้:</Text>
                  <Text strong style={{ marginLeft: 8 }}>
                    {selectedDeposit.userName || "-"} ({selectedDeposit.userPhone})
                  </Text>
                </div>
                <div>
                  <Text type="secondary">จำนวนเงิน:</Text>
                  <Text strong style={{ marginLeft: 8, fontSize: 18, color: "#dc2626" }}>
                    {Number(selectedDeposit.amount).toLocaleString("th-TH", {
                      minimumFractionDigits: 2,
                    })}{" "}
                    ฿
                  </Text>
                </div>
                <div>
                  <Text type="secondary">เวลาโอน:</Text>
                  <Text strong style={{ marginLeft: 8 }}>
                    {selectedDeposit.transferAt
                      ? dayjs(selectedDeposit.transferAt).format("DD/MM/YYYY HH:mm")
                      : "-"}
                  </Text>
                </div>
                <div>
                  <Text type="secondary">ช่องทาง:</Text>
                  <Text strong style={{ marginLeft: 8 }}>
                    {selectedDeposit.method === "BANK_TRANSFER" ? "โอนธนาคาร" : "QR Code"}
                  </Text>
                </div>
                {selectedDeposit.slipImageUrl && (
                  <div>
                    <Text type="secondary">สลิป:</Text>
                    <div style={{ marginTop: 8 }}>
                      <Image
                        src={selectedDeposit.slipImageUrl}
                        width={200}
                        style={{ borderRadius: 8 }}
                      />
                    </div>
                  </div>
                )}
              </Space>
            </Card>

            <Form form={approveForm} layout="vertical" onFinish={handleApproveSubmit}>
              <Form.Item
                name="adminNote"
                label="ข้อความจากแอดมิน"
                rules={[{ required: false }]}
              >
                <TextArea rows={3} placeholder="ระบุข้อความ (ถ้ามี)" />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0 }}>
                <Space>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={approving}
                    icon={<CheckCircleOutlined />}
                  >
                    อนุมัติและปรับเครดิต
                  </Button>
                  <Button onClick={() => setApproveModalVisible(false)}>ยกเลิก</Button>
                </Space>
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        title="ปฏิเสธรายการฝากเงิน"
        open={rejectModalVisible}
        onCancel={() => setRejectModalVisible(false)}
        footer={null}
        width={500}
      >
        {selectedDeposit && (
          <div>
            <Alert
              message="กรุณาระบุเหตุผลในการปฏิเสธ"
              description="ระบบจะไม่ปรับยอดเครดิตของผู้ใช้"
              type="error"
              showIcon
              style={{ marginBottom: 20 }}
            />

            <Card size="small" style={{ marginBottom: 20, background: "#fff1f0" }}>
              <Space direction="vertical" style={{ width: "100%" }} size="small">
                <div>
                  <Text type="secondary">ผู้ใช้:</Text>
                  <Text strong style={{ marginLeft: 8 }}>
                    {selectedDeposit.userName || "-"} ({selectedDeposit.userPhone})
                  </Text>
                </div>
                <div>
                  <Text type="secondary">จำนวนเงิน:</Text>
                  <Text strong style={{ marginLeft: 8, fontSize: 16 }}>
                    {Number(selectedDeposit.amount).toLocaleString("th-TH", {
                      minimumFractionDigits: 2,
                    })}{" "}
                    ฿
                  </Text>
                </div>
              </Space>
            </Card>

            <Form form={rejectForm} layout="vertical" onFinish={handleRejectSubmit}>
              <Form.Item
                name="adminNote"
                label="เหตุผลการปฏิเสธ"
                rules={[{ required: true, message: "กรุณาระบุเหตุผล" }]}
              >
                <TextArea
                  rows={4}
                  placeholder="เช่น: ยอดเงินไม่ตรง, สลิปไม่ชัดเจน, หลักฐานไม่ถูกต้อง"
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0 }}>
                <Space>
                  <Button
                    danger
                    type="primary"
                    htmlType="submit"
                    loading={rejecting}
                    icon={<CloseCircleOutlined />}
                  >
                    ยืนยันปฏิเสธ
                  </Button>
                  <Button onClick={() => setRejectModalVisible(false)}>ยกเลิก</Button>
                </Space>
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
}
