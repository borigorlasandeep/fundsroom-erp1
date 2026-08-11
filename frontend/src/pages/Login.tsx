import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@fundsroom.local");
  const [password, setPassword] = useState("Admin@123");
  const [error, setError] = useState("");

  if (user) return <Navigate to="/dashboard" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.message || "Login failed");
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="brand large">Fundsroom ERP</div>
        <p className="muted">Mini ERP + CRM Operations Portal</p>
        <label>Email</label>
        <input value={email} onChange={e => setEmail(e.target.value)} type="email" />
        <label>Password</label>
        <input value={password} onChange={e => setPassword(e.target.value)} type="password" />
        {error && <div className="error">{error}</div>}
        <button className="primary" type="submit">Sign in</button>
        <small className="muted">Demo: admin@fundsroom.local / Admin@123</small>
      </form>
    </div>
  );
}
