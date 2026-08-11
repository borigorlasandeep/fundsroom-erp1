import { useEffect, useState } from "react";
import { api } from "../services/api";

export default function Dashboard() {
  const [stats, setStats] = useState({ customers: 0, products: 0, challans: 0, lowStock: 0 });

  useEffect(() => {
    Promise.all([
      api.get("/customers?limit=1"),
      api.get("/products?limit=100"),
      api.get("/challans?limit=1")
    ]).then(([customers, products, challans]) => {
      setStats({
        customers: customers.data.pagination.total,
        products: products.data.pagination.total,
        challans: challans.data.pagination.total,
        lowStock: products.data.items.filter((p: any) => p.currentStock <= p.minStockQty).length
      });
    });
  }, []);

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">Overview of ERP and CRM operations.</p>
        </div>
      </div>
      <div className="stats-grid">
        <div className="stat-card"><span>Customers</span><strong>{stats.customers}</strong></div>
        <div className="stat-card"><span>Products</span><strong>{stats.products}</strong></div>
        <div className="stat-card"><span>Sales Challans</span><strong>{stats.challans}</strong></div>
        <div className="stat-card warning"><span>Low Stock</span><strong>{stats.lowStock}</strong></div>
      </div>
      <div className="panel">
        <h2>Business Flow</h2>
        <div className="flow">
          <span>Customer CRM</span><b>→</b><span>Product Inventory</span><b>→</b><span>Sales Challan</span><b>→</b><span>Stock OUT</span>
        </div>
      </div>
    </>
  );
}
