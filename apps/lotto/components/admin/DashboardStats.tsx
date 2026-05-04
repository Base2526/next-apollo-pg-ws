import React from "react";
import { Card, Statistic, Row, Col } from "antd";
import { UserOutlined, FileTextOutlined, DollarOutlined, RiseOutlined } from "@ant-design/icons";

export default function DashboardStats({ stats }: { stats: any }) {
  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title="Total Users"
            value={stats?.totalUsers ?? 0}
            prefix={<UserOutlined />}
            valueStyle={{ color: '#3f8600' }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title="Total Slips"
            value={stats?.totalSlips ?? 0}
            prefix={<FileTextOutlined />}
            valueStyle={{ color: '#1890ff' }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title="Total Bets Amount"
            value={stats?.totalAmount ?? 0}
            prefix={<DollarOutlined />}
            valueStyle={{ color: '#cf1322' }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title="Today Bets"
            value={stats?.todayAmount ?? 0}
            prefix={<RiseOutlined />}
            valueStyle={{ color: '#fa8c16' }}
          />
        </Card>
      </Col>
    </Row>
  );
}
