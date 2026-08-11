import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Sidebar() {
  const { user } = useAuth();
  const links = [
    ["/dashboard", "Dashboard"],
    ["/customers", "Customers"],
    ["/products", "Products"],
    ["/challans", "Sales Challans"]
  ];

  return (
    <aside className="sidebar">
      <div className="brand">Fundsroom ERP</div>
      <div className="role-badge">{user?.role}</div>
      <nav>
        {links.map(([to, label]) => (
          <NavLink key={to} to={to} className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
