"use client";

export default function AdminLogoutButton() {
  function handleLogout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    window.location.href = '/admin/login';
  }
  return (
    <button
      style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 700, cursor: 'pointer' }}
      onClick={handleLogout}
    >
      Logout
    </button>
  );
}
