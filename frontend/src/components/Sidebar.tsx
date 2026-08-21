import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Sidebar() {
  const { user } = useAuth();
  
  const links: [string, string][] = [
    ["/inventory", "Inventory"],
  ];

  if (user?.role === "ADMIN" || user?.role === "OPERATIONS_USER") {
    links.push(["/work-orders", "Work Orders"]);
    links.push(["/transfers", "Internal Transfers"]);
  }

  if (user?.role === "ADMIN" || user?.role === "SALES_USER") {
    links.push(["/orders", "Customer Orders"]);
  }

  return (
    <aside className="sidebar">
      <div className="brand">Operations ERP</div>
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
