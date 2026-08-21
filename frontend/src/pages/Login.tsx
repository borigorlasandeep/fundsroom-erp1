import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@fundsroom.local");
  const [password, setPassword] = useState("Admin@123");
  const [error, setError] = useState("");

  if (user) return <Navigate to="/inventory" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      navigate("/inventory");
    } catch (err: any) {
      setError(err.response?.data?.message || "Login failed");
    }
  }

  function handleQuickLogin(roleEmail: string, rolePass: string) {
    setEmail(roleEmail);
    setPassword(rolePass);
    setError("");
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="brand large">Operations ERP</div>
        <p className="muted">Mini Operations & Inventory Portal</p>
        
        <label>Email</label>
        <input value={email} onChange={e => setEmail(e.target.value)} type="email" required />
        
        <label>Password</label>
        <input value={password} onChange={e => setPassword(e.target.value)} type="password" required />
        
        {error && <div className="error">{error}</div>}
        
        <button className="primary" type="submit">Sign in</button>

        <div className="quick-login-section" style={{ marginTop: "1.5rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
          <small className="muted" style={{ display: "block", marginBottom: "0.5rem", textAlign: "center" }}>Quick Login for Roles</small>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <button 
              type="button" 
              className="secondary" 
              onClick={() => handleQuickLogin("admin@fundsroom.local", "Admin@123")}
              style={{ padding: "0.25rem", fontSize: "0.85rem" }}
            >
              🔑 Admin User (Work Orders, Transfers, Orders)
            </button>
            <button 
              type="button" 
              className="secondary" 
              onClick={() => handleQuickLogin("ops@fundsroom.local", "Ops@123")}
              style={{ padding: "0.25rem", fontSize: "0.85rem" }}
            >
              🔑 Operations User (Inventory & Transfers)
            </button>
            <button 
              type="button" 
              className="secondary" 
              onClick={() => handleQuickLogin("sales@fundsroom.local", "Sales@123")}
              style={{ padding: "0.25rem", fontSize: "0.85rem" }}
            >
              🔑 Sales User (Customer Orders & Reservations)
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
