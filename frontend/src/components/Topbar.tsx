import { useAuth } from "../context/AuthContext";

export default function Topbar() {
  const { user, logout } = useAuth();
  return (
    <header className="topbar">
      <div>
        <strong>Operations Portal</strong>
        <span className="muted"> / {user?.name}</span>
      </div>
      <button className="secondary" onClick={logout}>Logout</button>
    </header>
  );
}
