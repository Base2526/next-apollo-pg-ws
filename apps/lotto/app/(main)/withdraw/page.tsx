"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, gql } from "@apollo/client";
import {
  Card,
  Form,
  Input,
  InputNumber,
  Button,
  Table,
  Tag,
  Alert,
  Typography,
  Space,
  message,
  Skeleton,
  Radio,
} from "antd";
import {
  BankOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  PlusOutlined,
  StarFilled,
} from "@ant-design/icons";
import Breadcrumb from "../../../components/Breadcrumb";
import dayjs from "dayjs";

const { Title, Text } = Typography;

const CURRENT_USER_QUERY = gql`
  query CurrentUser {
    currentUser {
      id
      credit
    }
  }
`;

const MY_BANK_ACCOUNTS_QUERY = gql`
  query MyBankAccounts {
    myBankAccounts {
      id
      accountName
      bankName
      accountNumber
      isDefault
    }
  }
`;

const MY_WITHDRAWALS_QUERY = gql`
  query MyWithdrawals {
    myWithdrawals {
      id
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
`;

const CREATE_WITHDRAWAL_MUTATION = gql`
  mutation CreateWithdrawal($input: CreateWithdrawalInput!) {
    createWithdrawal(input: $input) {
      id
      amount
      status
      createdAt
    }
  }
`;

const STATUS_LABELS: Record<string, string> = {
  PENDING: "รอดำเนินการ",
  APPROVED: "สำเร็จ",
  REJECTED: "ถูกปฏิเสธ",
  CANCELLED: "ยกเลิก",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "orange",
  APPROVED: "green",
  REJECTED: "red",
  CANCELLED: "default",
};

const MIN_WITHDRAW = 100;

export default function WithdrawPage() {
  const [form] = Form.useForm();
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string | null>(null);

  const { data: userData, loading: userLoading, refetch: refetchUser } = useQuery(CURRENT_USER_QUERY);
  const { data: bankAccountsData, loading: bankAccountsLoading } = useQuery(MY_BANK_ACCOUNTS_QUERY);
  const { data: withdrawalsData, loading: withdrawalsLoading, refetch: refetchWithdrawals } = useQuery(MY_WITHDRAWALS_QUERY);

  const [createWithdrawal, { loading: submitting }] = useMutation(CREATE_WITHDRAWAL_MUTATION, {
    onCompleted: () => {
      message.success("แจ้งถอนเงินสำเร็จ รอแอดมินตรวจสอบ");
      form.resetFields();
      refetchUser();
      refetchWithdrawals();
    },
    onError: (error) => {
      message.error(error.message || "เกิดข้อผิดพลาดในการแจ้งถอนเงิน");
    },
  });

  const userCredit = userData?.currentUser?.credit || 0;
  const withdrawals = withdrawalsData?.myWithdrawals || [];
  const bankAccounts = bankAccountsData?.myBankAccounts || [];
  const canWithdraw = userCredit >= MIN_WITHDRAW;

  // Auto-select default bank account
  useEffect(() => {
    if (bankAccounts.length > 0 && !selectedBankAccountId) {
      const defaultAccount = bankAccounts.find((acc: any) => acc.isDefault);
      if (defaultAccount) {
        setSelectedBankAccountId(defaultAccount.id);
      } else {
        setSelectedBankAccountId(bankAccounts[0].id);
      }
    }
  }, [bankAccounts, selectedBankAccountId]);

  const handleSubmit = async (values: any) => {
    if (!selectedBankAccountId) {
      message.error("กรุณาเลือกบัญชีธนาคาร");
      return;
    }

    const selectedAccount = bankAccounts.find((acc: any) => acc.id === selectedBankAccountId);
    if (!selectedAccount) {
      message.error("ไม่พบบัญชีธนาคารที่เลือก");
      return;
    }

    try {
      await createWithdrawal({
        variables: {
          input: {
            amount: values.amount,
            bankAccountId: selectedBankAccountId,
            bankName: selectedAccount.bankName,
            bankAccountNo: selectedAccount.accountNumber,
            bankAccountName: selectedAccount.accountName,
            note: values.note || null,
          },
        },
      });
    } catch (error) {
      console.error("[Withdraw] Submit error:", error);
    }
  };

  const columns = [
    {
      title: "ยอดถอน",
      dataIndex: "amount",
      key: "amount",
      width: 140,
      render: (amount: number) => (
        <Text strong style={{ fontSize: 16, color: "#dc2626" }}>
          {Number(amount).toLocaleString("th-TH", { minimumFractionDigits: 2 })} ฿
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
      width: 140,
    },
    {
      title: "สถานะ",
      dataIndex: "status",
      key: "status",
      width: 130,
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
      width: 160,
      render: (createdAt: string) => (
        createdAt ? dayjs(createdAt).format("DD/MM/YYYY HH:mm") : "-"
      ),
    },
    {
      title: "วันที่อนุมัติ",
      dataIndex: "approvedAt",
      key: "approvedAt",
      width: 160,
      render: (approvedAt: string) => (
        approvedAt ? dayjs(approvedAt).format("DD/MM/YYYY HH:mm") : "-"
      ),
    },
    {
      title: "หมายเหตุ",
      dataIndex: "rejectReason",
      key: "rejectReason",
      width: 200,
      render: (rejectReason: string) => (
        rejectReason ? <Text type="danger">{rejectReason}</Text> : "-"
      ),
    },
  ];

  // Check if user is logged in
  if (!userData && !userLoading) {
    return (
      <div style={{ background: "#f4f5f7", minHeight: "100vh", padding: "40px 16px" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <Alert
            type="warning"
            message="กรุณาเข้าสู่ระบบ"
            description="คุณต้องเข้าสู่ระบบก่อนทำการถอนเงิน"
            action={
              <Button type="primary" href="/login">
                เข้าสู่ระบบ
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#f4f5f7", minHeight: "100vh", paddingBottom: 40 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 16px" }}>
        {/* Breadcrumb */}
        <div style={{ margin: "0 0 8px 0" }}>
          <Breadcrumb items={[{ label: "หน้าแรก", href: "/" }, { label: "ถอนเงิน" }]} />
        </div>

        {/* Title */}
        <div style={{ marginBottom: 24 }}>
          <Title level={2} style={{ margin: 0, fontSize: 26 }}>
            ถอนเงิน
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            แจ้งถอนเครดิตเข้าบัญชีของคุณ
          </Text>
        </div>

        {/* Loading State */}
        {userLoading && (
          <Card>
            <Skeleton active paragraph={{ rows: 4 }} />
          </Card>
        )}

        {/* Main Layout */}
        {!userLoading && (
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 24 }}>
            {/* Left Column - Credit & Form */}
            <div style={{ flex: "1 1 380px", minWidth: 320 }}>
              {/* Credit Card */}
              <Card
                style={{
                  marginBottom: 20,
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  border: "none",
                  borderRadius: 16,
                }}
                bodyStyle={{ padding: "20px 24px" }}
              >
                <div>
                  <Text
                    style={{
                      color: "#fff",
                      fontSize: 13,
                      display: "block",
                      marginBottom: 4,
                      opacity: 0.9,
                    }}
                  >
                    เครดิตคงเหลือ
                  </Text>
                  <Text
                    style={{
                      color: "#fff",
                      fontSize: 32,
                      fontWeight: 800,
                      lineHeight: 1,
                    }}
                  >
                    {userCredit.toLocaleString("th-TH", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    ฿
                  </Text>
                </div>
              </Card>

              {/* Info Card */}
              <Alert
                message="ข้อมูลสำคัญ"
                description={
                  <ul style={{ margin: "8px 0 0 0", paddingLeft: 20 }}>
                    <li>ถอนขั้นต่ำ {MIN_WITHDRAW} บาท</li>
                    <li>เครดิตจะถูกหักทันที</li>
                    <li>รอแอดมินตรวจสอบแล้วโอนเข้าบัญชี</li>
                  </ul>
                }
                type="info"
                showIcon
                icon={<BankOutlined />}
                style={{ marginBottom: 20, borderRadius: 12 }}
              />

              {/* Insufficient Credit Warning */}
              {!canWithdraw && (
                <Alert
                  message="เครดิตไม่เพียงพอ"
                  description={`คุณมีเครดิต ${userCredit.toFixed(2)} บาท ต้องมีอย่างน้อย ${MIN_WITHDRAW} บาทเพื่อถอนเงิน`}
                  type="error"
                  showIcon
                  style={{ marginBottom: 20, borderRadius: 12 }}
                />
              )}

              {/* Withdraw Form */}
              <Card
                title={<Text strong style={{ fontSize: 15 }}>แบบฟอร์มถอนเงิน</Text>}
                style={{ borderRadius: 16 }}
                bodyStyle={{ padding: "16px 24px" }}
              >
                <Form
                  form={form}
                  layout="vertical"
                  onFinish={handleSubmit}
                >
                  {/* Amount */}
                  <Form.Item
                    name="amount"
                    label={<Text style={{ fontSize: 13 }}>ยอดถอน (บาท)</Text>}
                    rules={[
                      { required: true, message: "กรุณาระบุยอดเงิน" },
                      {
                        validator: (_, value) => {
                          if (!value) {
                            return Promise.resolve();
                          }
                          if (value < MIN_WITHDRAW) {
                            return Promise.reject(
                              `ยอดถอนขั้นต่ำ ${MIN_WITHDRAW} บาท`
                            );
                          }
                          if (value > userCredit) {
                            return Promise.reject(
                              `ยอดถอนต้องไม่เกินเครดิตคงเหลือ (${userCredit.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท)`
                            );
                          }
                          return Promise.resolve();
                        },
                      },
                    ]}
                    style={{ marginBottom: 16 }}
                  >
                    <InputNumber
                      style={{ width: "100%" }}
                      min={MIN_WITHDRAW}
                      max={userCredit}
                      step={100}
                      formatter={(value) =>
                        `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                      }
                      parser={(value) => value!.replace(/\$\s?|(,*)/g, "")}
                      size="large"
                    />
                  </Form.Item>

                  {/* Bank Account Selection */}
                  <Form.Item
                    label={<Text style={{ fontSize: 13 }}>เลือกบัญชีรับเงิน</Text>}
                    required
                    style={{ marginBottom: 16 }}
                  >
                    {bankAccountsLoading ? (
                      <Skeleton active paragraph={{ rows: 1 }} />
                    ) : bankAccounts.length === 0 ? (
                      <Alert
                        type="warning"
                        message="ยังไม่มีบัญชีธนาคาร"
                        description={
                          <div>
                            <div style={{ marginBottom: 8 }}>กรุณาเพิ่มบัญชีธนาคารก่อนถอนเงิน</div>
                            <Button 
                              type="primary" 
                              size="small" 
                              icon={<PlusOutlined />}
                              href="/settings"
                            >
                              ไปเพิ่มบัญชี
                            </Button>
                          </div>
                        }
                        showIcon
                      />
                    ) : (
                      <Radio.Group
                        value={selectedBankAccountId}
                        onChange={(e) => setSelectedBankAccountId(e.target.value)}
                        style={{ width: "100%" }}
                      >
                        <Space direction="vertical" style={{ width: "100%" }} size="small">
                          {bankAccounts.map((account: any) => (
                            <Radio.Button
                              key={account.id}
                              value={account.id}
                              style={{
                                width: "100%",
                                height: "auto",
                                padding: "12px 16px",
                                textAlign: "left",
                                border: selectedBankAccountId === account.id ? "2px solid #1890ff" : "1px solid #d9d9d9",
                                borderRadius: 8,
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <BankOutlined style={{ fontSize: 18, color: "#1890ff" }} />
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <Text strong style={{ fontSize: 14 }}>
                                      {account.accountName}
                                    </Text>
                                    {account.isDefault && (
                                      <Tag color="blue" icon={<StarFilled />} style={{ fontSize: 11, margin: 0 }}>
                                        หลัก
                                      </Tag>
                                    )}
                                  </div>
                                  <Text type="secondary" style={{ fontSize: 12 }}>
                                    {account.bankName} • {account.accountNumber.slice(-4)}
                                  </Text>
                                </div>
                              </div>
                            </Radio.Button>
                          ))}
                        </Space>
                      </Radio.Group>
                    )}
                    <Button
                      type="link"
                      size="small"
                      icon={<PlusOutlined />}
                      href="/settings"
                      style={{ padding: "4px 0", marginTop: 8 }}
                    >
                      จัดการบัญชีธนาคาร
                    </Button>
                  </Form.Item>

                  {/* Note */}
                  <Form.Item
                    name="note"
                    label={<Text style={{ fontSize: 13 }}>หมายเหตุ (ถ้ามี)</Text>}
                    style={{ marginBottom: 20 }}
                  >
                    <Input.TextArea rows={2} placeholder="ระบุข้อมูลเพิ่มเติม..." />
                  </Form.Item>

                  {/* Submit */}
                  <Form.Item style={{ marginBottom: 0 }}>
                    <Button
                      type="primary"
                      htmlType="submit"
                      size="large"
                      block
                      loading={submitting}
                      disabled={!canWithdraw || bankAccounts.length === 0}
                      danger
                      style={{
                        height: 48,
                        fontSize: 16,
                        fontWeight: 600,
                        borderRadius: 8,
                      }}
                    >
                      {!canWithdraw ? "เครดิตไม่เพียงพอ" : bankAccounts.length === 0 ? "ยังไม่มีบัญชีธนาคาร" : "แจ้งถอนเงิน"}
                    </Button>
                  </Form.Item>
                </Form>
              </Card>
            </div>

            {/* Right Column - History */}
            <div style={{ flex: "2 1 600px", minWidth: 0 }}>
              <Card
                title={<Text strong style={{ fontSize: 15 }}>ประวัติการถอนเงิน</Text>}
                style={{ borderRadius: 16 }}
              >
                {withdrawalsLoading ? (
                  <Skeleton active paragraph={{ rows: 3 }} />
                ) : withdrawals.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 0" }}>
                    <Text type="secondary">ยังไม่มีประวัติการถอนเงิน</Text>
                  </div>
                ) : (
                  <Table
                    dataSource={withdrawals}
                    columns={columns}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 1000 }}
                    size="small"
                  />
                )}
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
