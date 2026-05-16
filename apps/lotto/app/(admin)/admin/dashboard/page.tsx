"use client";
import { useQuery, gql } from "@apollo/client";
import { Typography, Spin, Alert } from "antd";
import DashboardStats from "../../../../components/admin/DashboardStats";
import DashboardCharts from "../../../../components/admin/DashboardCharts";
import RecentSlipsTable from "../../../../components/admin/RecentSlipsTable";
import RecentLogs from "../../../../components/admin/RecentLogs";

const { Title } = Typography;

const ADMIN_DASHBOARD = gql`
  query AdminDashboard {
    adminDashboard {
      totalUsers
      totalSlips
      totalBetAmount
      todayBets
      betsPerDay {
        date
        totalAmount
        totalSlips
      }
      usersGrowth {
        date
        totalUsers
      }
      recentSlips {
        id
        orderNo
        userPhone
        categoryCode
        categoryName
        drawCode
        drawNameTh
        drawDate
        roundNo
        totalAmount
        status
        resultStatus
        createdAt
        closeAt
      }
      recentLogs {
        id
        action
        userPhone
        createdAt
      }
    }
  }
`;

export default function DashboardPage() {
  const { data, loading, error, refetch } = useQuery(ADMIN_DASHBOARD);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          type="error"
          message="โหลดข้อมูล Dashboard ไม่สำเร็จ"
          description={error.message}
          showIcon
        />
      </div>
    );
  }

  const dashboard = data?.adminDashboard;

  return (
    <div style={{ padding: 24 }}>
      <Title level={2} style={{ marginBottom: 24 }}>Admin Dashboard</Title>
      <DashboardStats stats={{
        totalUsers: dashboard?.totalUsers,
        totalSlips: dashboard?.totalSlips,
        totalAmount: dashboard?.totalBetAmount,
        todayAmount: dashboard?.todayBets,
      }} />
      <DashboardCharts 
        betsPerDay={dashboard?.betsPerDay || []} 
        usersGrowth={dashboard?.usersGrowth || []} 
      />
      <RecentSlipsTable 
        slips={dashboard?.recentSlips || []} 
        showActions={true}
        onRefetch={() => refetch()}
      />
      <RecentLogs logs={dashboard?.recentLogs || []} />
    </div>
  );
}
