
"use client";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Modal } from "antd";
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

	const menuItems = [
		{ path: "/admin/dashboard", label: "Dashboard" },
		{ path: "/admin/users", label: "Users" },
		{ path: "/admin/slips", label: "Slips" },
		{ path: "/admin/draws", label: "Draws" },
		{ path: "/admin/deposits", label: "Deposits" },
		{ path: "/admin/withdrawals", label: "Withdrawals" },
		{ path: "/admin/logs", label: "Logs" },
		{ path: "/admin/lotto-config", label: "Config" }
	];

	return (
		<div style={{
			position: 'sticky',
			top: 0,
			background: '#ffffff',
			borderBottom: '1px solid #e8e8e8',
			boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
			zIndex: 50
		}}>
			<div style={{
				maxWidth: '1600px',
				margin: '0 auto',
				padding: '0 20px',
				height: '60px',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'space-between'
			}}>
				{/* Logo / Admin Label */}
				<div style={{
					display: 'flex',
					alignItems: 'center',
					gap: '8px',
					fontSize: '16px',
					fontWeight: 600,
					color: '#262626',
					minWidth: '100px'
				}}>
					<span style={{ fontSize: '18px' }}>🔐</span>
					<span>Admin</span>
				</div>

				{/* Navigation Menu */}
				<nav style={{
					display: 'flex',
					alignItems: 'center',
					gap: '8px',
					flex: 1,
					justifyContent: 'center',
					overflowX: 'auto',
					msOverflowStyle: 'none',
					scrollbarWidth: 'none',
					padding: '0 20px'
				}}>
					{menuItems.map((item) => {
						const active = isActive(item.path);
						return (
							<Link
								key={item.path}
								href={item.path}
								style={{
									padding: '6px 12px',
									fontSize: '14px',
									fontWeight: active ? 500 : 400,
									color: active ? '#1677ff' : '#595959',
									background: active ? '#e6f4ff' : 'transparent',
									borderRadius: '6px',
									textDecoration: 'none',
									whiteSpace: 'nowrap',
									transition: 'all 0.2s ease',
									cursor: 'pointer',
									display: 'inline-block'
								}}
								onMouseEnter={(e) => {
									if (!active) {
										e.currentTarget.style.background = '#f5f5f5';
										e.currentTarget.style.color = '#262626';
									}
								}}
								onMouseLeave={(e) => {
									if (!active) {
										e.currentTarget.style.background = 'transparent';
										e.currentTarget.style.color = '#595959';
									}
								}}
							>
								{item.label}
							</Link>
						);
					})}
				</nav>

				{/* Logout Button */}
				<button
					onClick={handleLogout}
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '6px',
						padding: '6px 12px',
						fontSize: '13px',
						fontWeight: 500,
						color: '#ff4d4f',
						background: '#fff',
						border: '1px solid #ff4d4f',
						borderRadius: '6px',
						cursor: 'pointer',
						transition: 'all 0.2s ease',
						minWidth: '90px',
						justifyContent: 'center'
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.background = '#fff1f0';
						e.currentTarget.style.borderColor = '#ff7875';
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.background = '#fff';
						e.currentTarget.style.borderColor = '#ff4d4f';
					}}
				>
					<LogoutOutlined style={{ fontSize: '13px' }} />
					<span>Logout</span>
				</button>
			</div>

			{/* Hide scrollbar on menu */}
			<style jsx>{`
				nav::-webkit-scrollbar {
					display: none;
				}
			`}</style>
		</div>
	);
}
