"use client";
import Link from "next/link";
import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Dropdown, Avatar, Space } from "antd";
import { UserOutlined, SettingOutlined, LogoutOutlined } from "@ant-design/icons";
import { Modal } from "antd";
import { logout } from "../lib/logout";

export default function LottoHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthPage = pathname === "/login" || pathname === "/forgot-password";

  const isActiveLink = (path: string) => pathname === path;

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key === "settings") {
      router.push("/settings");
    } else if (key === "logout") {
      Modal.confirm({
        title: "ยืนยันออกจากระบบ",
        content: "คุณต้องการออกจากระบบใช่หรือไม่?",
        okText: "ออกจากระบบ",
        cancelText: "ยกเลิก",
        okButtonProps: { danger: true },
        icon: <LogoutOutlined style={{ color: '#dc2626' }} />,
        onOk: () => {
          logout();
        },
      });
    }
  };

  const menuItems = [
    {
      key: "settings",
      icon: <SettingOutlined style={{ fontSize: 16 }} />,
      label: "Settings",
    },
    {
      key: "logout",
      icon: <LogoutOutlined style={{ fontSize: 16 }} />,
      label: "Logout",
    },
  ];

  return (
    <header className="lotto-header-bar">
      <div className="lotto-header-shell">
        <div className="lotto-header-left">
          <Link href="/" className="lotto-brand-link">
            <span className="lotto-brand-icon">🎟️</span>
            <span className="lotto-brand-title">หวยรัฐบาลไทย</span>
          </Link>
        </div>
        {!isAuthPage && (
          <div className="lotto-header-right">
            <nav className="lotto-header-nav">
              <Link href="/" className={`lotto-header-link ${isActiveLink("/") ? "active" : ""}`}>หน้าแรก</Link>
              <Link href="/slips" className={`lotto-header-link ${isActiveLink("/slips") ? "active" : ""}`}>โพยหวย</Link>
              <Link href="/deposit" className={`lotto-header-link ${isActiveLink("/deposit") ? "active" : ""}`}>ฝากเงิน</Link>
              <Link href="/withdraw" className={`lotto-header-link ${isActiveLink("/withdraw") ? "active" : ""}`}>ถอนเงิน</Link>
              <Link href="/results" className={`lotto-header-link ${isActiveLink("/results") ? "active" : ""}`}>ตรวจผลรางวัล</Link>
            </nav>
            <div className="lotto-header-profile">
              <Dropdown
                menu={{ items: menuItems, onClick: handleMenuClick }}
                placement="bottomRight"
                trigger={["click"]}
                overlayClassName="lotto-profile-dropdown"
              >
                <Space>
                  <Avatar 
                    size={36} 
                    icon={<UserOutlined />} 
                    style={{ 
                      cursor: "pointer", 
                      background: "#ef4444",
                      color: "#ffffff"
                    }} 
                  />
                </Space>
              </Dropdown>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
