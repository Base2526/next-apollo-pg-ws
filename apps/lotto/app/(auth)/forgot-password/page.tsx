"use client";
import { useMutation, gql } from "@apollo/client";
const FORGOT_PASSWORD_MUTATION = gql`
  mutation ForgotPassword($phone: String!) {
    forgotPassword(phone: $phone) {
      success
      message
    }
  }
`;
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const [forgotPassword] = useMutation(FORGOT_PASSWORD_MUTATION);

  const validate = () => {
    if (!phone.match(/^\d{9,15}$/)) return "กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง";
    return "";
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    const v = validate();
    if (v) return setError(v);
    setLoading(true);
    try {
      const { data } = await forgotPassword({ variables: { phone } });
      if (data?.forgotPassword?.success) {
        setSuccess(true);
      } else {
        setError(data?.forgotPassword?.message || "เกิดข้อผิดพลาด");
      }
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1 style={{ color: '#dc2626', fontSize: 32, fontWeight: 900, textAlign: 'center', marginBottom: 8 }}>ลืมรหัสผ่าน</h1>
        <div style={{ color: '#6b7280', textAlign: 'center', marginBottom: 24, fontSize: 16 }}>กรอกเบอร์โทรศัพท์เพื่อรับวิธีตั้งรหัสผ่านใหม่</div>
        {error && (
          <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 10, padding: '10px 0', marginBottom: 16, textAlign: 'center', fontWeight: 700 }}>{error}</div>
        )}
        {success ? (
          <div style={{ background: '#e0fce6', color: '#15803d', borderRadius: 10, padding: '14px 0', marginBottom: 16, textAlign: 'center', fontWeight: 700, fontSize: 17 }}>
            ส่งคำขอเรียบร้อยแล้ว กรุณาตรวจสอบข้อความของคุณ
          </div>
        ) : null}
      </section>
    </main>
  );
}
