import React from "react";
import { Row, Col, Typography, Divider, Space } from "antd";
import {
  FacebookFilled,
  LineOutlined,
  MailOutlined,
  PhoneOutlined,
} from "@ant-design/icons";

const { Link, Text, Title } = Typography;

export default function LottoFooter() {
  return (
    <footer className="lotto-footer-modern">
      <Divider style={{ margin: 0, borderColor: "#e5e7eb" }} />
      <div className="lotto-footer-container">
        <Row gutter={[32, 32]} justify="center" align="top" wrap>
          {/* Brand/About */}
          <Col xs={24} sm={12} md={8} lg={6}>
            <Space direction="vertical" size={8}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 28 }}>🎟️</span>
                <Title level={4} style={{ margin: 0, color: "#dc2626", fontWeight: 900, letterSpacing: -1 }}>
                  หวยรัฐบาลไทย
                </Title>
              </div>
              <Text type="secondary" style={{ fontSize: 15 }}>
                ระบบโพยหวยออนไลน์ ปลอดภัย ใช้งานง่าย
              </Text>
              <Text style={{ fontSize: 13, color: "#888" }}>
                "แทงง่าย จ่ายจริง ดูแลตลอด 24 ชม."
              </Text>
            </Space>
          </Col>

          {/* Menu Links */}
          <Col xs={24} sm={12} md={8} lg={6}>
            <Title level={5} style={{ marginBottom: 12, color: "#222" }}>เมนู</Title>
            <Space direction="vertical" size={4}>
              <Link href="/" className="footer-link">หน้าแรก</Link>
              <Link href="/slips" className="footer-link">โพยหวย</Link>
              <Link href="/deposit" className="footer-link">ฝากเงิน</Link>
              <Link href="/withdraw" className="footer-link">ถอนเงิน</Link>
              <Link href="/results" className="footer-link">ตรวจผลรางวัล</Link>
            </Space>
          </Col>

          {/* Support/Contact */}
          <Col xs={24} sm={12} md={8} lg={6}>
            <Title level={5} style={{ marginBottom: 12, color: "#222" }}>ติดต่อ & ข้อมูล</Title>
            <Space direction="vertical" size={4}>
              <Link href="/contact" className="footer-link">ติดต่อเรา</Link>
              <Link href="/faq" className="footer-link">FAQ</Link>
              <Link href="/terms" className="footer-link">เงื่อนไขการใช้งาน</Link>
              <Link href="/privacy" className="footer-link">นโยบายความเป็นส่วนตัว</Link>
              <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#888" }}>
                <PhoneOutlined /> <span>02-123-4567</span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#888" }}>
                <MailOutlined /> <span>support@lotto.com</span>
              </span>
            </Space>
          </Col>

          {/* Social/Legal */}
          <Col xs={24} sm={12} md={24} lg={6}>
            <Title level={5} style={{ marginBottom: 12, color: "#222" }}>ติดตามเรา</Title>
            <Space size={16} style={{ marginBottom: 10 }}>
              <a href="https://facebook.com" target="_blank" rel="noopener" aria-label="Facebook" className="footer-social">
                <FacebookFilled style={{ fontSize: 22, color: "#1877f3" }} />
              </a>
              <a href="https://line.me" target="_blank" rel="noopener" aria-label="Line" className="footer-social">
                <LineOutlined style={{ fontSize: 22, color: "#06c755" }} />
              </a>
            </Space>
            <Text type="secondary" style={{ fontSize: 13, display: "block", marginTop: 8 }}>
              © {new Date().getFullYear()} Lotto. All rights reserved.
            </Text>
          </Col>
        </Row>
      </div>
    </footer>
  );
}

// --- CSS (add to globals.css) ---
// .lotto-footer-modern { background: #f5f5f5; padding: 40px 0 0 0; margin-top: 40px; }
// .lotto-footer-container { max-width: 1200px; margin: 0 auto; padding: 0 18px; }
// .footer-link { color: #444; font-weight: 600; transition: color 0.15s; }
// .footer-link:hover { color: #dc2626; text-decoration: underline; }
// .footer-social:hover { opacity: 0.8; }
// @media (max-width: 900px) { .lotto-footer-container { padding: 0 6px; } }
// @media (max-width: 600px) { .lotto-footer-modern { padding: 28px 0 0 0; } .footer-link { font-size: 15px; } }
