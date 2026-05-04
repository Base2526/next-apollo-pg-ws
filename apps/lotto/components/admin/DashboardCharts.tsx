import React from "react";
import { Card, Empty, Row, Col } from "antd";
import { BarChartOutlined, LineChartOutlined } from "@ant-design/icons";

interface BetsPerDay {
  date: string;
  totalAmount: number;
  totalSlips: number;
}

interface UsersGrowth {
  date: string;
  totalUsers: number;
}

interface DashboardChartsProps {
  betsPerDay: BetsPerDay[];
  usersGrowth: UsersGrowth[];
}

export default function DashboardCharts({ betsPerDay = [], usersGrowth = [] }: DashboardChartsProps) {
  // Simple data display for now (can be replaced with actual charts later)
  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>      <Col xs={24} lg={12}>
        <Card title={<span><BarChartOutlined /> ยอดแทง 7 วันล่าสุด</span>}>
          {betsPerDay.length > 0 ? (
            <div style={{ padding: '16px 0' }}>
              {betsPerDay.map((item, index) => (
                <div key={index} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  padding: '8px 0',
                  borderBottom: index < betsPerDay.length - 1 ? '1px solid #f0f0f0' : 'none'
                }}>
                  <span>{new Date(item.date).toLocaleDateString('th-TH')}</span>
                  <span>
                    <strong style={{ color: '#dc2626' }}>{item.totalAmount.toLocaleString()} ฿</strong>
                    <span style={{ marginLeft: 16, color: '#666' }}>({item.totalSlips} โพย)</span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Empty 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="ไม่มีข้อมูล"
              style={{ padding: '40px 0' }}
            />
          )}
        </Card>
      </Col>
      <Col xs={24} lg={12}>
        <Card title={<span><LineChartOutlined /> ผู้ใช้ใหม่ 7 วันล่าสุด</span>}>
          {usersGrowth.length > 0 ? (
            <div style={{ padding: '16px 0' }}>
              {usersGrowth.map((item, index) => (
                <div key={index} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  padding: '8px 0',
                  borderBottom: index < usersGrowth.length - 1 ? '1px solid #f0f0f0' : 'none'
                }}>
                  <span>{new Date(item.date).toLocaleDateString('th-TH')}</span>
                  <span style={{ fontWeight: 600, color: '#3f8600' }}>{item.totalUsers} คน</span>
                </div>
              ))}
            </div>
          ) : (
            <Empty 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="ไม่มีข้อมูล"
              style={{ padding: '40px 0' }}
            />
          )}
        </Card>
      </Col>
    </Row>
  );
}
