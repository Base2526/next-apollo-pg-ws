"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, gql } from "@apollo/client";
import { 
  Card, 
  Form, 
  InputNumber, 
  DatePicker, 
  Upload, 
  Button, 
  Alert, 
  Skeleton, 
  Typography, 
  Space, 
  Tag, 
  Empty, 
  message,
  Input,
  Table,
  Row,
  Col,
  Radio
} from "antd";
import { 
  UploadOutlined, 
  CopyOutlined, 
  CheckCircleOutlined, 
  ClockCircleOutlined, 
  CloseCircleOutlined,
  BankOutlined,
  QrcodeOutlined,
  DownloadOutlined,
  WarningOutlined
} from "@ant-design/icons";
import Breadcrumb from "../../../components/Breadcrumb";

const { Title, Text } = Typography;
const { TextArea } = Input;

const CURRENT_USER_QUERY = gql`
  query CurrentUser {
    currentUser {
      id
      credit
    }
  }
`;

const DEPOSIT_METHODS_QUERY = gql`
  query DepositMethods {
    depositMethods {
      id
      code
      nameTh
      description
      minAmount
      maxAmount
      bankName
      bankAccountNo
      bankAccountName
      qrImageUrl
    }
  }
`;

const MY_DEPOSITS_QUERY = gql`
  query MyDeposits {
    myDeposits(limit: 10, offset: 0) {
      id
      amount
      method
      transferAt
      slipImageUrl
      status
      createdAt
    }
  }
`;

const CREATE_DEPOSIT_MUTATION = gql`
  mutation CreateDeposit($input: CreateDepositInput!) {
    createDeposit(input: $input) {
      id
      amount
      status
      createdAt
    }
  }
`;

const STATUS_LABELS: Record<string, string> = {
  PENDING: "รอตรวจสอบ",
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

export default function DepositPage() {
  const [form] = Form.useForm();
  const [selectedMethod, setSelectedMethod] = useState<any>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [qrCountdown, setQrCountdown] = useState<number>(600); // 10 minutes in seconds
  const [qrExpired, setQrExpired] = useState<boolean>(false);

  const { data: userData, refetch: refetchUser } = useQuery(CURRENT_USER_QUERY);
  const { data: methodsData, loading: methodsLoading, error: methodsError } = useQuery(DEPOSIT_METHODS_QUERY);
  const { data: depositsData, loading: depositsLoading, refetch: refetchDeposits } = useQuery(MY_DEPOSITS_QUERY);
  
  const [createDeposit, { loading: submitting }] = useMutation(CREATE_DEPOSIT_MUTATION, {
    onCompleted: () => {
      message.success("ส่งคำขอฝากเงินสำเร็จ รอแอดมินตรวจสอบ");
      form.resetFields();
      setSlipPreview(null);
      refetchDeposits();
      refetchUser();
    },
    onError: (error) => {
      message.error(error.message || "เกิดข้อผิดพลาดในการส่งคำขอฝากเงิน");
    },
  });

  const methods = methodsData?.depositMethods || [];
  const deposits = depositsData?.myDeposits || [];
  const userCredit = userData?.currentUser?.credit || 0;

  // Set initial selected method
  useEffect(() => {
    if (methods.length > 0 && !selectedMethod) {
      setSelectedMethod(methods[0]);
    }
  }, [methods, selectedMethod]);

  // QR Countdown timer
  useEffect(() => {
    if (selectedMethod?.code === 'QR_TRANSFER' && qrCountdown > 0 && !qrExpired) {
      const timer = setInterval(() => {
        setQrCountdown((prev) => {
          if (prev <= 1) {
            setQrExpired(true);
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [selectedMethod, qrCountdown, qrExpired]);

  // Reset countdown when method changes to QR
  useEffect(() => {
    if (selectedMethod?.code === 'QR_TRANSFER') {
      setQrCountdown(600);
      setQrExpired(false);
    }
  }, [selectedMethod?.code]);

  const handleMethodChange = (methodCode: string) => {
    const method = methods.find((m: any) => m.code === methodCode);
    setSelectedMethod(method);
    form.setFieldValue('method', methodCode);
  };

  const handleDownloadQR = () => {
    if (!selectedMethod?.qrImageUrl) return;
    const link = document.createElement('a');
    link.href = selectedMethod.qrImageUrl;
    link.download = `QR-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success('ดาวน์โหลด QR Code สำเร็จ');
  };

  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleCopyAccount = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success("คัดลอกเรียบร้อย");
  };

  const handleSubmit = async (values: any) => {
    try {
      const transferDateTime = values.transferDate && values.transferTime
        ? `${values.transferDate.format('YYYY-MM-DD')} ${values.transferTime.format('HH:mm:ss')}`
        : null;

      await createDeposit({
        variables: {
          input: {
            amount: values.amount,
            method: values.method,
            transferAt: transferDateTime,
            slipImageUrl: slipPreview || null,
            note: values.note || null,
          },
        },
      });
    } catch (error) {
      console.error("[Deposit] Submit error:", error);
    }
  };

  // History table columns
  const historyColumns = [
    {
      title: 'จำนวนเงิน',
      dataIndex: 'amount',
      key: 'amount',
      width: 140,
      render: (amount: number) => (
        <Text strong style={{ fontSize: 16, color: '#dc2626' }}>
          {Number(amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿
        </Text>
      ),
    },
    {
      title: 'ช่องทาง',
      dataIndex: 'method',
      key: 'method',
      width: 120,
      render: (method: string) => (
        <Tag color="blue">{method === 'BANK_TRANSFER' ? 'โอนธนาคาร' : 'QR Code'}</Tag>
      ),
    },
    {
      title: 'วันที่โอน',
      dataIndex: 'transferAt',
      key: 'transferAt',
      width: 160,
      render: (transferAt: string) => (
        transferAt ? new Date(transferAt).toLocaleString('th-TH', { 
          dateStyle: 'short', 
          timeStyle: 'short' 
        }) : '-'
      ),
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status: string) => (
        <Tag color={STATUS_COLORS[status]} icon={
          status === 'PENDING' ? <ClockCircleOutlined /> :
          status === 'APPROVED' ? <CheckCircleOutlined /> :
          <CloseCircleOutlined />
        }>
          {STATUS_LABELS[status]}
        </Tag>
      ),
    },
    {
      title: 'แจ้งเมื่อ',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (createdAt: string) => (
        new Date(createdAt).toLocaleString('th-TH', { 
          dateStyle: 'short', 
          timeStyle: 'short' 
        })
      ),
    },
  ];

  // Check if user is logged in
  if (!userData && !methodsLoading) {
    return (
      <div style={{ background: "#f4f5f7", minHeight: "100vh", padding: "40px 16px" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <Alert
            type="warning"
            message="กรุณาเข้าสู่ระบบ"
            description="คุณต้องเข้าสู่ระบบก่อนทำการฝากเงิน"
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
          <Breadcrumb items={[{ label: "หน้าแรก", href: "/" }, { label: "ฝากเงิน" }]} />
        </div>

        {/* Title */}
        <div style={{ margin: "0 0 16px 0" }}>
          <Title level={2} style={{ margin: 0, fontSize: 26 }}>ฝากเงิน</Title>
          <Text type="secondary" style={{ fontSize: 14 }}>แจ้งหลักฐานการโอนเงิน</Text>
        </div>

        {/* Loading State */}
        {methodsLoading && (
          <Card>
            <Skeleton active paragraph={{ rows: 4 }} />
          </Card>
        )}

        {/* Error State */}
        {methodsError && (
          <Alert
            type="error"
            message="โหลดข้อมูลฝากเงินไม่สำเร็จ"
            description={methodsError.message}
            action={
              <Button onClick={() => window.location.reload()}>
                ลองใหม่
              </Button>
            }
          />
        )}

        {/* No Methods */}
        {!methodsLoading && !methodsError && methods.length === 0 && (
          <Card>
            <Empty description="ยังไม่มีช่องทางฝากเงิน" />
          </Card>
        )}

        {/* Two Column Layout */}
        {!methodsLoading && !methodsError && methods.length > 0 && (
          <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
            {/* Left Column */}
            <Col xs={24} lg={10}>
              {/* Compact Credit Card */}
              <Card 
                style={{ 
                  marginBottom: 16, 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                  border: 'none',
                  borderRadius: 16
                }}
                bodyStyle={{ padding: '20px 24px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <Text style={{ color: '#fff', fontSize: 13, display: 'block', marginBottom: 4, opacity: 0.9 }}>
                      เครดิตคงเหลือ
                    </Text>
                    <Text style={{ color: '#fff', fontSize: 32, fontWeight: 800, lineHeight: 1 }}>
                      {userCredit.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿
                    </Text>
                  </div>
                </div>
              </Card>

              {/* Method Selection - Card Style */}
              <Card 
                title={<Text strong style={{ fontSize: 15 }}>เลือกช่องทางฝากเงิน</Text>}
                style={{ marginBottom: 16, borderRadius: 16 }}
                bodyStyle={{ padding: '12px 16px' }}
              >
                <Space direction="vertical" style={{ width: '100%' }} size={12}>
                  {methods.map((method: any) => (
                    <Card
                      key={method.code}
                      hoverable
                      size="small"
                      style={{
                        border: selectedMethod?.code === method.code ? '2px solid #1890ff' : '1px solid #d9d9d9',
                        borderRadius: 12,
                        cursor: 'pointer',
                        background: selectedMethod?.code === method.code ? '#f0f8ff' : '#fff',
                      }}
                      bodyStyle={{ padding: '12px 16px' }}
                      onClick={() => handleMethodChange(method.code)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ 
                          fontSize: 24, 
                          color: selectedMethod?.code === method.code ? '#1890ff' : '#8c8c8c' 
                        }}>
                          {method.code === 'BANK_TRANSFER' ? <BankOutlined /> : <QrcodeOutlined />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>
                            {method.nameTh}
                          </div>
                          <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                            {method.minAmount}฿ - {method.maxAmount.toLocaleString()}฿
                          </div>
                        </div>
                        <Radio checked={selectedMethod?.code === method.code} />
                      </div>
                    </Card>
                  ))}
                </Space>
              </Card>

              {/* Bank Info or QR Payment Section */}
              {selectedMethod && selectedMethod.code === 'BANK_TRANSFER' && (
                <Card 
                  title={<Text strong style={{ fontSize: 15 }}>ข้อมูลบัญชี</Text>}
                  style={{ borderRadius: 16 }}
                  bodyStyle={{ padding: '16px' }}
                >
                  <Space direction="vertical" style={{ width: '100%' }} size={8}>
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>ธนาคาร</Text>
                      <div><Text strong style={{ fontSize: 14 }}>{selectedMethod.bankName}</Text></div>
                    </div>
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>ชื่อบัญชี</Text>
                      <div><Text strong style={{ fontSize: 14 }}>{selectedMethod.bankAccountName}</Text></div>
                    </div>
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>เลขบัญชี</Text>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                        <Text strong code style={{ fontSize: 15, flex: 1 }}>
                          {selectedMethod.bankAccountNo}
                        </Text>
                        <Button
                          size="small"
                          icon={<CopyOutlined />}
                          onClick={() => handleCopyAccount(selectedMethod.bankAccountNo)}
                        >
                          คัดลอก
                        </Button>
                      </div>
                    </div>
                  </Space>
                </Card>
              )}

              {/* QR Payment Section */}
              {selectedMethod && selectedMethod.code === 'QR_TRANSFER' && (
                <div>
                  <Card 
                    style={{ 
                      borderRadius: 16, 
                      marginBottom: 16,
                      background: '#f9fafb'
                    }}
                    bodyStyle={{ padding: '24px' }}
                  >
                    {/* Amount Display */}
                    <div style={{ textAlign: 'center', marginBottom: 20 }}>
                      <Text type="secondary" style={{ fontSize: 14, display: 'block', marginBottom: 8 }}>ยอดเงินที่ต้องชำระ</Text>
                      {form.getFieldValue('amount') ? (
                        <Text style={{ fontSize: 36, fontWeight: 700, color: '#1890ff' }}>
                          ฿{form.getFieldValue('amount').toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </Text>
                      ) : (
                        <Text type="secondary" style={{ fontSize: 16 }}>กรุณาระบุจำนวนเงินก่อนสร้าง QR</Text>
                      )}
                    </div>

                    {/* QR Code Display */}
                    {form.getFieldValue('amount') && selectedMethod.qrImageUrl && (
                      <div style={{ 
                        background: '#fff', 
                        padding: '24px', 
                        borderRadius: 12, 
                        textAlign: 'center',
                        border: '1px solid #e5e7eb',
                        marginBottom: 16
                      }}>
                        {/* PromptPay Logo placeholder */}
                        <div style={{ marginBottom: 12 }}>
                          <QrcodeOutlined style={{ fontSize: 32, color: '#1890ff' }} />
                          <div style={{ fontSize: 13, color: '#8c8c8c', marginTop: 4 }}>Thai QR Payment</div>
                        </div>

                        {/* QR Image */}
                        <img
                          src={selectedMethod.qrImageUrl}
                          alt="QR Code Payment"
                          style={{ 
                            maxWidth: 240, 
                            width: '100%',
                            border: '2px solid #e5e7eb', 
                            borderRadius: 8,
                            marginBottom: 16
                          }}
                        />

                        {/* Warning */}
                        <Alert
                          message="QR Code นี้ใช้ได้ครั้งเดียวเท่านั้น"
                          type="warning"
                          showIcon
                          style={{ marginBottom: 12, fontSize: 12 }}
                        />

                        {/* Download Button */}
                        <Button
                          type="primary"
                          icon={<DownloadOutlined />}
                          onClick={handleDownloadQR}
                          size="large"
                          block
                        >
                          ดาวน์โหลด QR Code
                        </Button>
                      </div>
                    )}

                    {/* Countdown & Status */}
                    {form.getFieldValue('amount') && (
                      <div style={{ textAlign: 'center' }}>
                        <Space direction="vertical" size={8}>
                          {/* Countdown Timer */}
                          <div>
                            <ClockCircleOutlined style={{ marginRight: 8, color: qrExpired ? '#ff4d4f' : '#faad14' }} />
                            <Text strong style={{ fontSize: 18, color: qrExpired ? '#ff4d4f' : '#faad14' }}>
                              {qrExpired ? 'หมดเวลา' : formatCountdown(qrCountdown)}
                            </Text>
                          </div>

                          {/* Status */}
                          {qrExpired ? (
                            <Alert
                              message="QR Code หมดอายุ"
                              description="กรุณาสร้างรายการใหม่"
                              type="error"
                              showIcon
                            />
                          ) : (
                            <Text type="secondary" style={{ fontSize: 13 }}>
                              <CheckCircleOutlined style={{ marginRight: 6, color: '#52c41a' }} />
                              กำลังรอโอน...
                            </Text>
                          )}
                        </Space>
                      </div>
                    )}
                  </Card>

                  {/* Instructions */}
                  {form.getFieldValue('amount') && (
                    <Card 
                      title={
                        <Space>
                          <WarningOutlined style={{ color: '#faad14' }} />
                          <Text strong style={{ fontSize: 14 }}>วิธีการชำระเงิน</Text>
                        </Space>
                      }
                      style={{ borderRadius: 16, marginBottom: 16 }}
                      bodyStyle={{ padding: '16px' }}
                      size="small"
                    >
                      <Space direction="vertical" size={8} style={{ width: '100%' }}>
                        <div>
                          <Text style={{ fontSize: 13 }}>1. กด "ดาวน์โหลด" รูป QR ลงในโทรศัพท์</Text>
                        </div>
                        <div>
                          <Text style={{ fontSize: 13 }}>2. เปิดแอปธนาคารเพื่อสแกน QR</Text>
                        </div>
                        <div>
                          <Text style={{ fontSize: 13 }}>3. ใช้บัญชีที่สมัครเติมเงินเท่านั้น</Text>
                        </div>
                        <div>
                          <Text type="danger" style={{ fontSize: 13 }}>
                            ⚠️ ห้ามสแกนจากประวัติรายการโอน
                          </Text>
                        </div>
                        <div>
                          <Text type="danger" style={{ fontSize: 13 }}>
                            ⚠️ ห้ามใช้ QR หมดอายุ
                          </Text>
                        </div>
                      </Space>
                    </Card>
                  )}
                </div>
              )}
            </Col>

            {/* Right Column - Form */}
            <Col xs={24} lg={14}>
              <Card 
                title={<Text strong style={{ fontSize: 15 }}>แบบฟอร์มฝากเงิน</Text>}
                style={{ borderRadius: 16 }}
                bodyStyle={{ padding: '16px 24px' }}
              >
                <Form
                  form={form}
                  layout="vertical"
                  onFinish={handleSubmit}
                  initialValues={{ method: methods[0]?.code }}
                >
                  <Form.Item name="method" hidden>
                    <Input />
                  </Form.Item>

                  {/* Amount */}
                  <Form.Item
                    name="amount"
                    label={<Text style={{ fontSize: 13 }}>จำนวนเงิน (บาท)</Text>}
                    rules={[
                      { required: true, message: "กรุณาระบุจำนวนเงิน" },
                      {
                        validator: (_, value) => {
                          if (!selectedMethod) return Promise.resolve();
                          if (value < selectedMethod.minAmount) {
                            return Promise.reject(`จำนวนเงินขั้นต่ำ ${selectedMethod.minAmount}฿`);
                          }
                          if (value > selectedMethod.maxAmount) {
                            return Promise.reject(`จำนวนเงินสูงสุด ${selectedMethod.maxAmount.toLocaleString()}฿`);
                          }
                          return Promise.resolve();
                        },
                      },
                    ]}
                    style={{ marginBottom: 16 }}
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      min={selectedMethod?.minAmount || 100}
                      max={selectedMethod?.maxAmount || 500000}
                      step={100}
                      formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={(value) => value!.replace(/\$\s?|(,*)/g, '')}
                      size="large"
                    />
                  </Form.Item>

                  {/* Date and Time - Same Row (only for BANK_TRANSFER) */}
                  {selectedMethod?.code === 'BANK_TRANSFER' && (
                    <Row gutter={12}>
                      <Col xs={24} sm={14}>
                        <Form.Item
                          name="transferDate"
                          label={<Text style={{ fontSize: 13 }}>วันที่โอน</Text>}
                          rules={[{ required: true, message: "เลือกวันที่" }]}
                          style={{ marginBottom: 16 }}
                        >
                          <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={10}>
                        <Form.Item
                          name="transferTime"
                          label={<Text style={{ fontSize: 13 }}>เวลาที่โอน</Text>}
                          rules={[{ required: true, message: "เลือกเวลา" }]}
                          style={{ marginBottom: 16 }}
                        >
                          <DatePicker.TimePicker style={{ width: '100%' }} format="HH:mm" />
                        </Form.Item>
                      </Col>
                    </Row>
                  )}

                  {/* Slip Upload - Compact */}
                  <Form.Item
                    name="slip"
                    label={
                      <Space>
                        <Text style={{ fontSize: 13 }}>แนบสลิปโอนเงิน</Text>
                        {selectedMethod?.code === 'QR_TRANSFER' && (
                          <Tag color="blue" style={{ fontSize: 11 }}>หลังสแกน QR แล้ว</Tag>
                        )}
                      </Space>
                    }
                    rules={[{ required: true, message: "กรุณาแนบสลิปโอนเงิน" }]}
                    style={{ marginBottom: 16 }}
                  >
                    <Upload
                      listType="picture-card"
                      maxCount={1}
                      beforeUpload={(file) => {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                          setSlipPreview(e.target?.result as string);
                        };
                        reader.readAsDataURL(file);
                        return false;
                      }}
                      onRemove={() => {
                        setSlipPreview(null);
                      }}
                    >
                      <div>
                        <UploadOutlined />
                        <div style={{ marginTop: 8, fontSize: 12 }}>
                          {selectedMethod?.code === 'QR_TRANSFER' ? 'คลิก อัปโหลดสลิป' : 'อัปโหลดสลิป'}
                        </div>
                      </div>
                    </Upload>
                  </Form.Item>

                  {/* Note */}
                  <Form.Item 
                    name="note" 
                    label={<Text style={{ fontSize: 13 }}>หมายเหตุ (ถ้ามี)</Text>}
                    style={{ marginBottom: 20 }}
                  >
                    <TextArea rows={2} placeholder="ระบุข้อมูลเพิ่มเติม..." />
                  </Form.Item>

                  {/* Submit Button */}
                  <Form.Item style={{ marginBottom: 0 }}>
                    {qrExpired && selectedMethod?.code === 'QR_TRANSFER' && (
                      <Alert
                        message="QR Code หมดอายุแล้ว"
                        description="กรุณาเลือกช่องทางการฝากใหม่เพื่อสร้าง QR Code ใหม่"
                        type="error"
                        showIcon
                        style={{ marginBottom: 12 }}
                      />
                    )}
                    <Button
                      type="primary"
                      htmlType="submit"
                      size="large"
                      block
                      loading={submitting}
                      disabled={qrExpired && selectedMethod?.code === 'QR_TRANSFER'}
                      style={{ height: 48, fontSize: 16, fontWeight: 600, borderRadius: 8 }}
                    >
                      {selectedMethod?.code === 'QR_TRANSFER' ? 'ยืนยันการชำระเงิน' : 'แจ้งหลักฐานการโอนเงิน'}
                    </Button>
                  </Form.Item>
                </Form>
              </Card>
            </Col>
          </Row>
        )}

        {/* Deposit History - Full Width Table */}
        <Card 
          title={<Text strong style={{ fontSize: 15 }}>ประวัติการฝากเงิน</Text>}
          style={{ borderRadius: 16 }}
        >
          {depositsLoading ? (
            <Skeleton active paragraph={{ rows: 3 }} />
          ) : deposits.length === 0 ? (
            <Empty description="ยังไม่มีประวัติการฝากเงิน" style={{ padding: '20px 0' }} />
          ) : (
            <Table
              dataSource={deposits}
              columns={historyColumns}
              rowKey="id"
              pagination={false}
              size="small"
            />
          )}
        </Card>
      </div>
    </div>
  );
}
