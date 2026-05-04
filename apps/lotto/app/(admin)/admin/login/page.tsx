"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { gql, useMutation } from "@apollo/client";

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

export default function AdminLoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const [login, { loading }] = useMutation(LOGIN_MUTATION);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const { data } = await login({ variables: { phone, password } });
      if (!data?.login?.token) throw new Error(data?.login?.message || "Invalid response");
      document.cookie = `token=${data.login.token}; path=/`;
      if (data.login.user.role === "admin") {
        router.replace("/admin/dashboard");
      } else {
        setError("ไม่มีสิทธิ์เข้าใช้งานหลังบ้าน");
      }
    } catch (err: any) {
      setError(err.message || "Login failed");
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: "80px auto", background: "#fff", padding: 32, borderRadius: 12, boxShadow: "0 2px 12px #0001" }}>
      <h2 style={{ marginBottom: 24, textAlign: "center" }}>Admin Login</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 18 }}>
          <input
            type="text"
            placeholder="เบอร์โทรศัพท์"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            style={{ width: "100%", padding: 10, fontSize: 16, borderRadius: 6, border: "1px solid #ccc" }}
            required
          />
        </div>
        <div style={{ marginBottom: 18 }}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ width: "100%", padding: 10, fontSize: 16, borderRadius: 6, border: "1px solid #ccc" }}
            required
          />
        </div>
        {error && <div style={{ color: "#dc2626", marginBottom: 12 }}>{error}</div>}
        <button type="submit" style={{ width: "100%", padding: 12, fontSize: 17, fontWeight: 700, background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }} disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
}
