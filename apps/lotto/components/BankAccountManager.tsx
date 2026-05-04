"use client";

import { useState } from "react";
import { useQuery, useMutation, gql } from "@apollo/client";
import {
  Card,
  Button,
  Modal,
  Form,
  Input,
  message,
  Space,
  Tag,
  Popconfirm,
  Empty,
  Skeleton,
} from "antd";
import {
  BankOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  StarFilled,
  StarOutlined,
} from "@ant-design/icons";

const MY_BANK_ACCOUNTS_QUERY = gql`
  query MyBankAccounts {
    myBankAccounts {
      id
      accountName
      bankName
      accountNumber
      isDefault
      createdAt
    }
  }
`;

const CREATE_BANK_ACCOUNT_MUTATION = gql`
  mutation CreateBankAccount($input: CreateBankAccountInput!) {
    createBankAccount(input: $input) {
      id
      accountName
      bankName
      accountNumber
      isDefault
    }
  }
`;

const UPDATE_BANK_ACCOUNT_MUTATION = gql`
  mutation UpdateBankAccount($id: ID!, $input: UpdateBankAccountInput!) {
    updateBankAccount(id: $id, input: $input) {
      id
      accountName
      bankName
      accountNumber
    }
  }
`;

const DELETE_BANK_ACCOUNT_MUTATION = gql`
  mutation DeleteBankAccount($id: ID!) {
    deleteBankAccount(id: $id)
  }
`;

const SET_DEFAULT_BANK_ACCOUNT_MUTATION = gql`
  mutation SetDefaultBankAccount($id: ID!) {
    setDefaultBankAccount(id: $id)
  }
`;

export default function BankAccountManager() {
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);

  const { data, loading, refetch } = useQuery(MY_BANK_ACCOUNTS_QUERY, {
    fetchPolicy: "network-only",
  });

  const [createBankAccount, { loading: creating }] = useMutation(
    CREATE_BANK_ACCOUNT_MUTATION,
    {
      onCompleted: () => {
        message.success("เพิ่มบัญชีธนาคารสำเร็จ");
        setModalVisible(false);
        form.resetFields();
        refetch();
      },
      onError: (error) => {
        message.error(error.message || "เกิดข้อผิดพลาด");
      },
    }
  );

  const [updateBankAccount, { loading: updating }] = useMutation(
    UPDATE_BANK_ACCOUNT_MUTATION,
    {
      onCompleted: () => {
        message.success("แก้ไขบัญชีธนาคารสำเร็จ");
        setModalVisible(false);
        setEditingAccount(null);
        form.resetFields();
        refetch();
      },
      onError: (error) => {
        message.error(error.message || "เกิดข้อผิดพลาด");
      },
    }
  );

  const [deleteBankAccount] = useMutation(DELETE_BANK_ACCOUNT_MUTATION, {
    onCompleted: () => {
      message.success("ลบบัญชีธนาคารสำเร็จ");
      refetch();
    },
    onError: (error) => {
      message.error(error.message || "เกิดข้อผิดพลาด");
    },
  });

  const [setDefaultBankAccount] = useMutation(
    SET_DEFAULT_BANK_ACCOUNT_MUTATION,
    {
      onCompleted: () => {
        message.success("ตั้งเป็นบัญชีหลักสำเร็จ");
        refetch();
      },
      onError: (error) => {
        message.error(error.message || "เกิดข้อผิดพลาด");
      },
    }
  );

  const accounts = data?.myBankAccounts || [];

  const handleAdd = () => {
    setEditingAccount(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (account: any) => {
    setEditingAccount(account);
    form.setFieldsValue({
      accountName: account.accountName,
      bankName: account.bankName,
      accountNumber: account.accountNumber,
    });
    setModalVisible(true);
  };

  const handleSubmit = async (values: any) => {
    if (editingAccount) {
      await updateBankAccount({
        variables: {
          id: editingAccount.id,
          input: values,
        },
      });
    } else {
      await createBankAccount({
        variables: {
          input: values,
        },
      });
    }
  };

  const handleDelete = async (id: string) => {
    await deleteBankAccount({
      variables: { id },
    });
  };

  const handleSetDefault = async (id: string) => {
    await setDefaultBankAccount({
      variables: { id },
    });
  };

  const maskAccountNumber = (number: string) => {
    if (number.length <= 4) return number;
    return "x".repeat(number.length - 4) + number.slice(-4);
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAdd}
          size="middle"
        >
          เพิ่มบัญชี
        </Button>
      </div>

      {loading ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : accounts.length === 0 ? (
        <Empty
          description="ยังไม่มีบัญชีธนาคาร"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ padding: "40px 0" }}
        >
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} size="large">
            เพิ่มบัญชีแรก
          </Button>
        </Empty>
      ) : (
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          {accounts.map((account: any) => (
            <Card
              key={account.id}
              size="small"
              style={{
                borderRadius: 12,
                border: account.isDefault
                  ? "2px solid #1890ff"
                  : "1px solid #d9d9d9",
                background: account.isDefault ? "#f0f7ff" : "#fff",
              }}
              bodyStyle={{ padding: "16px 20px" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                    <BankOutlined style={{ fontSize: 24, color: "#1890ff" }} />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 16,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 4,
                        }}
                      >
                        {account.accountName}
                        {account.isDefault && (
                          <Tag color="blue" icon={<StarFilled />}>
                            บัญชีหลัก
                          </Tag>
                        )}
                      </div>
                      <div style={{ fontSize: 14, color: "#666" }}>
                        {account.bankName} •{" "}
                        <span style={{ fontFamily: "monospace", letterSpacing: 1 }}>
                          {maskAccountNumber(account.accountNumber)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <Space size="small">
                  {!account.isDefault && (
                    <Button
                      size="middle"
                      icon={<StarOutlined />}
                      onClick={() => handleSetDefault(account.id)}
                    >
                      ตั้งเป็นหลัก
                    </Button>
                  )}
                  <Button
                    size="middle"
                    icon={<EditOutlined />}
                    onClick={() => handleEdit(account)}
                  />
                  <Popconfirm
                    title="ยืนยันการลบบัญชี?"
                    description="คุณแน่ใจหรือไม่ที่จะลบบัญชีธนาคารนี้?"
                    onConfirm={() => handleDelete(account.id)}
                    okText="ลบ"
                    cancelText="ยกเลิก"
                    okButtonProps={{ danger: true }}
                  >
                    <Button size="middle" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              </div>
            </Card>
          ))}
        </Space>
      )}

      <Modal
        title={
          <span style={{ fontSize: 18, fontWeight: 600 }}>
            {editingAccount ? "แก้ไขบัญชีธนาคาร" : "เพิ่มบัญชีธนาคารใหม่"}
          </span>
        }
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingAccount(null);
          form.resetFields();
        }}
        footer={null}
        width={540}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="accountName"
            label={<span style={{ fontWeight: 600 }}>ชื่อบัญชี</span>}
            rules={[{ required: true, message: "กรุณาระบุชื่อบัญชี" }]}
          >
            <Input placeholder="นายสมชาย ใจดี" size="large" />
          </Form.Item>

          <Form.Item
            name="bankName"
            label={<span style={{ fontWeight: 600 }}>ธนาคาร</span>}
            rules={[{ required: true, message: "กรุณาระบุชื่อธนาคาร" }]}
          >
            <Input placeholder="ธนาคารกสิกรไทย" size="large" />
          </Form.Item>

          <Form.Item
            name="accountNumber"
            label={<span style={{ fontWeight: 600 }}>เลขบัญชี</span>}
            rules={[
              { required: true, message: "กรุณาระบุเลขบัญชี" },
              {
                pattern: /^[0-9-]+$/,
                message: "รูปแบบเลขบัญชีไม่ถูกต้อง",
              },
            ]}
          >
            <Input placeholder="1234567890" size="large" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={creating || updating}
                icon={<CheckCircleOutlined />}
                size="large"
              >
                {editingAccount ? "บันทึก" : "เพิ่มบัญชี"}
              </Button>
              <Button
                size="large"
                onClick={() => {
                  setModalVisible(false);
                  setEditingAccount(null);
                  form.resetFields();
                }}
              >
                ยกเลิก
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
