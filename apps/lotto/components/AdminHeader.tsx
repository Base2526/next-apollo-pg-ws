
"use client";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Button, Modal } from "antd";
import { LogoutOutlined } from "@ant-design/icons";

export default function AdminHeader() {
	const router = useRouter();
	const pathname = usePathname();

	const handleLogout = () => {
		Modal.confirm({
			title: "ยืนยันออกจากระบบ",
			content: "คุณต้องการออกจากระบบ Admin ใช่หรือไม่?",
			okText: "ออกจากระบบ",
			cancelText: "ยกเลิก",
			okButtonProps: { danger: true },
			icon: <LogoutOutlined style={{ color: '#dc2626' }} />,
			onOk: () => {
				localStorage.removeItem("admin_token");
				localStorage.removeItem("lotto_admin_token");
				router.push("/admin/login");
			},
		});
	};

	const isActive = (path: string) => pathname === path;

	return (
		<div className="admin-layout">
			<div className="admin-menu-bar">
				<div className="admin-menu-title">🔐 Admin</div>
				<nav className="admin-menu-nav">
					<Link href="/admin/dashboard" className={`admin-menu-link ${isActive("/admin/dashboard") ? "admin-menu-link--active" : ""}`}>
						Dashboard
					</Link>
					<Link href="/admin/users" className={`admin-menu-link ${isActive("/admin/users") ? "admin-menu-link--active" : ""}`}>
						Users
					</Link>
					<Link href="/admin/slips" className={`admin-menu-link ${isActive("/admin/slips") ? "admin-menu-link--active" : ""}`}>
						Slips
					</Link>
					<Link href="/admin/deposits" className={`admin-menu-link ${isActive("/admin/deposits") ? "admin-menu-link--active" : ""}`}>
						Deposits
					</Link>
				<Link href="/admin/withdrawals" className={`admin-menu-link ${isActive("/admin/withdrawals") ? "admin-menu-link--active" : ""}`}>
					Withdrawals
				</Link>

					<Link href="/admin/logs" className={`admin-menu-link ${isActive("/admin/logs") ? "admin-menu-link--active" : ""}`}>
						Logs
					</Link>
				</nav>
				<Button 
					danger 
					type="primary"
					icon={<LogoutOutlined />}
					onClick={handleLogout}
				>
					Logout
				</Button>
			</div>
		</div>
	);
}
