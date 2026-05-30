"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, gql } from "@apollo/client";

const LOGIN_MUTATION = gql`
  mutation Login($phone: String!, $password: String!) {
    login(phone: $phone, password: $password) {
      success
      message
      token
      user {
        id
        phone
        name
        role
      }
    }
  }
`;

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [login] = useMutation(LOGIN_MUTATION);

  const validate = () => {
    if (!phone.match(/^\d{9,15}$/)) return "กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง";
    if (!password) return "กรุณากรอกรหัสผ่าน";
    return "";
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setError("");
    const v = validate();
    if (v) return setError(v);
    setLoading(true);
    try {
      const { data } = await login({ variables: { phone, password } });
      if (data?.login?.success && data.login.token) {
        document.cookie = `auth_token=${data.login.token}; path=/;`;
        localStorage.setItem("auth_token", data.login.token);
        localStorage.setItem("auth_user", JSON.stringify(data.login.user));
        
        // Redirect to return URL or homepage
        const redirect = searchParams?.get('redirect');
        if (redirect && !redirect.includes('/login') && !redirect.includes('/admin')) {
          router.replace(redirect);
        } else {
          router.replace("/");
        }
      } else {
        setError(data?.login?.message || "เข้าสู่ระบบไม่สำเร็จ");
      }
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page" style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 12, padding: '32px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#dc2626', textAlign: 'center', marginBottom: 24 }}>เข้าสู่ระบบ</h1>
        
        {error && (
          <div style={{ background: '#fee', border: '1px solid #fcc', borderRadius: 6, padding: '12px 16px', marginBottom: 16, color: '#c00', fontSize: 14 }}>
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 }}>เบอร์โทรศัพท์</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0812345678"
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: 15,
                border: '1px solid #ddd',
                borderRadius: 6,
                outline: 'none'
              }}
            />
          </div>
          
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 }}>รหัสผ่าน</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: 15,
                border: '1px solid #ddd',
                borderRadius: 6,
                outline: 'none'
              }}
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: 12,
              fontSize: 16,
              fontWeight: 700,
              background: loading ? '#999' : '#dc2626',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s'
            }}
          >
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
        
        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 14 }}>
          <a href="/forgot-password" style={{ color: '#666', textDecoration: 'underline' }}>ลืมรหัสผ่าน?</a>
        </div>
      </div>
    </main>
  );
}
