"use client";
import { Card, Avatar, Typography, Descriptions, Button, Divider, Tag, Skeleton, Alert } from "antd";
import { UserOutlined } from "@ant-design/icons";
import { useQuery, gql } from "@apollo/client";
import React, { use, useEffect } from "react";
import BankAccountManager from "../../../components/BankAccountManager";

const { Title } = Typography;

const Q_CURRENT_USER = gql`
  query CurrentUser {
    currentUser {
      id
      name
      phone
      email
      createdAt
      avatarUrl
      credit
      status
      role
      lastLogin
    }
  }
`;

export default function SettingsPage() {
  const { data, loading, error } = useQuery(Q_CURRENT_USER);
  const user = data?.currentUser;

  useEffect(() => {
    if (error) {
      console.error("Error fetching current user:", error);
    }

    console.log("Current user data:", data);
  }, [loading, error]);

  return (
    <div style={{ background: "#f5f5f5", minHeight: "100vh", paddingBottom: 40 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
        <Title level={2} style={{ marginBottom: 32, fontSize: 28 }}>
          ตั้งค่าโปรไฟล์
        </Title>
        
        {/* 2-Column Layout */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
          gap: 24,
          alignItems: "start"
        }}>
          {/* Left Column - Profile Card */}
          <Card style={{ borderRadius: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
        {loading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : error ? (
          <Alert
            type="error"
            title="เกิดข้อผิดพลาดในการโหลดข้อมูลผู้ใช้"
            description={process.env.NODE_ENV !== "production" && error.message}
            action={
              <Button onClick={() => window.location.reload()} block>
                ลองใหม่
              </Button>
            }
          />
        ) : !user ? (
          <Alert
            type="warning"
            message="ไม่พบข้อมูลผู้ใช้"
            action={
              <Button onClick={() => window.location.reload()} size="small">
                ลองใหม่
              </Button>
            }
          />
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
              <Avatar size={80} src={user.avatarUrl || undefined} icon={<UserOutlined />} style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", marginBottom: 16 }} />
              <div style={{ fontWeight: 700, fontSize: 22 }}>{user.name || user.phone || "-"}</div>
              <Tag color={user.status === "active" ? "success" : "error"} style={{ marginTop: 8 }}>
                {user.status === "active" ? "ใช้งานอยู่" : "ปิดใช้งาน"}
              </Tag>
            </div>
            
            {/* Credit Highlight */}
            <div style={{ 
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              borderRadius: 12,
              padding: "20px",
              textAlign: "center",
              marginBottom: 24
            }}>
              <div style={{ color: "#fff", opacity: 0.9, fontSize: 13, marginBottom: 4 }}>เครดิตคงเหลือ</div>
              <div style={{ color: "#fff", fontSize: 32, fontWeight: 800 }}>
                {user.credit != null ? `${Number(user.credit).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "0.00"} ฿
              </div>
            </div>

            <Descriptions column={1} size="middle" labelStyle={{ fontWeight: 600, color: "#666" }} contentStyle={{ color: "#000" }}>
              <Descriptions.Item label="เบอร์โทร">{user.phone || "-"}</Descriptions.Item>
              <Descriptions.Item label="อีเมล">{user.email || "-"}</Descriptions.Item>
              <Descriptions.Item label="วันที่สมัครสมาชิก">{user.createdAt ? new Date(user.createdAt).toLocaleDateString("th-TH") : "-"}</Descriptions.Item>
              <Descriptions.Item label="เข้าสู่ระบบล่าสุด">{user.lastLogin ? new Date(user.lastLogin).toLocaleString("th-TH") : "-"}</Descriptions.Item>
              <Descriptions.Item label="ประเภทผู้ใช้">
                <Tag color={user.role === 'admin' ? 'red' : 'blue'}>{user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้ทั่วไป'}</Tag>
              </Descriptions.Item>
            </Descriptions>
            <Divider />
            <Button type="primary" size="large" block disabled>
              แก้ไขโปรไฟล์
            </Button>
          </>
        )}
      </Card>

      {/* Right Column - Bank Accounts Card */}
      {!loading && user && (
        <Card 
          title={<span style={{ fontSize: 18, fontWeight: 600 }}>บัญชีธนาคารของฉัน</span>}
          style={{ borderRadius: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
          bodyStyle={{ padding: "20px" }}
        >
          <BankAccountManager />
        </Card>
      )}
        </div>
      </div>
    </div>
  );
}
