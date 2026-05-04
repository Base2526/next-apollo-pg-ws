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
  message,
  Tooltip,
  Statistic,
  Row,
  Col,
  Upload,
} from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  ClearOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { TextArea } = Input;

const ADMIN_WITHDRAWALS_QUERY = gql`
  query AdminWithdrawals($filter: AdminWithdrawalFilterInput, $pagination: PaginationInput) {
    adminWithdrawals(filter: $filter, pagination: $pagination) {
      total
      items {
        id
        userId
        userPhone
        userName
        amount
        bankName
        bankAccountNo
        bankAccountName
        status
        note
        rejectReason
        approvedAt
        createdAt
      }
    }
  }
`;

const APPROVE_WITHDRAWAL_MUTATION = gql`
  mutation ApproveWithdrawal($id: ID!, $adminNote: String, $adminAttachmentUrl: String) {
    approveWithdrawal(id: $id, adminNote: $adminNote, adminAttachmentUrl: $adminAttachmentUrl) {
      id
      status
    }
  }
`;

const REJECT_WITHDRAWAL_MUTATION = gql`
  mutation RejectWithdrawal($id: ID!, $adminNote: String!) {
    rejectWithdrawal(id: $id, adminNote: $adminNote) {
      id
      status
    }
  }
`;

const STATUS_LABELS: Record<string, string> = {
  PENDING: "รอดำเนินการ",
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

export default function AdminWithdrawalsPage() {
  const [filterForm] = Form.useForm();
  const [approveForm] = Form.useForm();
  const [rejectForm] = Form.useForm();

  const [filter, setFilter] = useState<any>({});
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 });
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<any>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);

  const { data, loading, refetch, error } = useQuery(ADMIN_WITHDRAWALS_QUERY, {
    variables: { filter, pagination },
    fetchPolicy: "network-only",
  });

  console.log("[AdminWithdrawals] Query state:", { loading, error: error?.message, data, filter, pagination });

  const [approveWithdrawal, { loading: approving }] = useMutation(APPROVE_WITHDRAWAL_MUTATION, {
    onCompleted: () => {
      message.success("อนุมัติถอนเงินสำเร็จ");
      setApproveModalVisible(false);
      approveForm.resetFields();
      setAttachmentPreview(null);
      refetch();
    },
    onError: (error) => {
      message.error(error.message || "เกิดข้อผิดพลาดในการอนุมัติ");
    },
  });

  const [rejectWithdrawal, { loading: rejecting }] = useMutation(REJECT_WITHDRAWAL_MUTATION, {
    onCompleted: () => {
      message.success("ปฏิเสธรายการถอนเงินแล้ว");
      setRejectModalVisible(false);
      rejectForm.resetFields();
      refetch();
    },
    onError: (error) => {
      message.error(error.message || "เกิดข้อผิดพลาดในการปฏิเสธ");
    },
  });

  const withdrawals = data?.adminWithdrawals?.items || [];
  const total = data?.adminWithdrawals?.total || 0;

  // Stats
  const pendingCount = withdrawals.filter((w: any) => w.status === "PENDING").length;
  const approvedCount = withdrawals.filter((w: any) => w.status === "APPROVED").length;
  const rejectedCount = withdrawals.filter((w: any) => w.status === "REJECTED").length;

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

  const handleApprove = (withdrawal: any) => {
    setSelectedWithdrawal(withdrawal);
    approveForm.setFieldsValue({ adminNote: "โอนเงินเรียบร้อย" });
    setApproveModalVisible(true);
  };

  const handleReject = (withdrawal: any) => {
    setSelectedWithdrawal(withdrawal);
    rejectForm.resetFields();
    setRejectModalVisible(true);
  };

  const handleApproveSubmit = async (values: any) => {
    await approveWithdrawal({
      variables: {
        id: selectedWithdrawal.id,
        adminNote: values.adminNote || "โอนเงินเรียบร้อย",
        adminAttachmentUrl: attachmentPreview || null,
      },
    });
  };

  const handleRejectSubmit = async (values: any) => {
    await rejectWithdrawal({
      variables: {
        id: selectedWithdrawal.id,
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
      title: "ธนาคาร",
      dataIndex: "bankName",
      key: "bankName",
      width: 150,
    },
    {
      title: "เลขบัญชี",
      dataIndex: "bankAccountNo",
      key: "bankAccountNo",
      width: 130,
      render: (accountNo: string) => <Text code>{accountNo}</Text>,
    },
    {
      title: "ชื่อบัญชี",
      dataIndex: "bankAccountName",
      key: "bankAccountName",
      width: 150,
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
      render: (createdAt: string) => createdAt ? dayjs(createdAt).format("DD/MM/YYYY HH:mm") : "-",
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
          รายการถอนเงิน
        </Title>
        <Text type="secondary">จัดการรายการถอนเงินของผู้ใช้</Text>
      </div>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="รอดำเนินการ"
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
              <Select.Option value="PENDING">รอดำเนินการ</Select.Option>
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
          message="โหลดข้อมูลถอนเงินไม่สำเร็จ"
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
          dataSource={withdrawals}
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
        title="ยืนยันอนุมัติถอนเงิน"
        open={approveModalVisible}
        onCancel={() => setApproveModalVisible(false)}
        footer={null}
        width={600}
      >
        {selectedWithdrawal && (
          <div>
            <Alert
              message="กรุณาตรวจสอบข้อมูลก่อนอนุมัติ"
              description="เครดิตถูกหักไปแล้วตอนแจ้งถอน อนุมัติแล้วต้องโอนจริง"
              type="warning"
              showIcon
              style={{ marginBottom: 20 }}
            />

            <Card size="small" style={{ marginBottom: 20, background: "#f9fafb" }}>
              <Space direction="vertical" style={{ width: "100%" }} size="small">
                <div>
                  <Text type="secondary">ผู้ใช้:</Text>
                  <Text strong style={{ marginLeft: 8 }}>
                    {selectedWithdrawal.userName || "-"} ({selectedWithdrawal.userPhone})
                  </Text>
                </div>
                <div>
                  <Text type="secondary">จำนวนเงิน:</Text>
                  <Text strong style={{ marginLeft: 8, fontSize: 18, color: "#dc2626" }}>
                    {Number(selectedWithdrawal.amount).toLocaleString("th-TH", {
                      minimumFractionDigits: 2,
                    })}{" "}
                    ฿
                  </Text>
                </div>
                <div>
                  <Text type="secondary">ธนาคาร:</Text>
                  <Text strong style={{ marginLeft: 8 }}>
                    {selectedWithdrawal.bankName}
                  </Text>
                </div>
                <div>
                  <Text type="secondary">เลขบัญชี:</Text>
                  <Text strong code style={{ marginLeft: 8 }}>
                    {selectedWithdrawal.bankAccountNo}
                  </Text>
                </div>
                <div>
                  <Text type="secondary">ชื่อบัญชี:</Text>
                  <Text strong style={{ marginLeft: 8 }}>
                    {selectedWithdrawal.bankAccountName}
                  </Text>
                </div>
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

              <Form.Item
                name="attachment"
                label="ไฟล์แนบหลักฐานการโอน"
                rules={[{ required: true, message: "กรุณาแนบหลักฐานการโอน" }]}
              >
                <Upload
                  listType="picture-card"
                  maxCount={1}
                  beforeUpload={(file) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                      setAttachmentPreview(e.target?.result as string);
                    };
                    reader.readAsDataURL(file);
                    return false;
                  }}
                  onRemove={() => {
                    setAttachmentPreview(null);
                  }}
                >
                  <div>
                    <UploadOutlined />
                    <div style={{ marginTop: 8, fontSize: 12 }}>อัปโหลดหลักฐาน</div>
                  </div>
                </Upload>
              </Form.Item>

              <Form.Item style={{ marginBottom: 0 }}>
                <Space>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={approving}
                    icon={<CheckCircleOutlined />}
                  >
                    อนุมัติถอนเงิน
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
        title="ปฏิเสธรายการถอนเงิน"
        open={rejectModalVisible}
        onCancel={() => setRejectModalVisible(false)}
        footer={null}
        width={500}
      >
        {selectedWithdrawal && (
          <div>
            <Alert
              message="กรุณาระบุเหตุผลในการปฏิเสธ"
              description="ระบบจะคืนเครดิตให้ผู้ใช้อัตโนมัติ"
              type="error"
              showIcon
              style={{ marginBottom: 20 }}
            />

            <Card size="small" style={{ marginBottom: 20, background: "#fff1f0" }}>
              <Space direction="vertical" style={{ width: "100%" }} size="small">
                <div>
                  <Text type="secondary">ผู้ใช้:</Text>
                  <Text strong style={{ marginLeft: 8 }}>
                    {selectedWithdrawal.userName || "-"} ({selectedWithdrawal.userPhone})
                  </Text>
                </div>
                <div>
                  <Text type="secondary">จำนวนเงิน:</Text>
                  <Text strong style={{ marginLeft: 8, fontSize: 16 }}>
                    {Number(selectedWithdrawal.amount).toLocaleString("th-TH", {
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
                  placeholder="เช่น: ข้อมูลบัญชีไม่ถูกต้อง, ไม่ตรงกับข้อมูลที่ลงทะเบียน"
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
                    ยืนยันปฏิเสธและคืนเครดิต
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
