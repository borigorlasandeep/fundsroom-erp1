import { useEffect, useState } from "react";
import { api } from "../services/api";
import { InventoryItem, StockLog } from "../types";
import { useAuth } from "../context/AuthContext";

export default function Inventory() {
  const { user } = useAuth();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [logs, setLogs] = useState<StockLog[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "logs">("list");

  async function loadInventory() {
    setLoading(true);
    try {
      const res = await api.get("/inventory");
      if (res.data.success) {
        setInventory(res.data.data);
      }
    } catch (err) {
      console.error("Error loading inventory", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadLogs() {
    try {
      const res = await api.get("/inventory/logs");
      if (res.data.success) {
        setLogs(res.data.data);
      }
    } catch (err) {
      console.error("Error loading stock logs", err);
    }
  }

  useEffect(() => {
    loadInventory();
    if (user?.role === "ADMIN" || user?.role === "OPERATIONS_USER") {
      loadLogs();
    }
  }, [user]);

  const filteredInventory = inventory.filter(item => 
    item.item.toLowerCase().includes(search.toLowerCase()) ||
    item.location.toLowerCase().includes(search.toLowerCase()) ||
    item.batch.toLowerCase().includes(search.toLowerCase()) ||
    item.category.toLowerCase().includes(search.toLowerCase())
  );

  const totalPhysical = inventory.reduce((sum, item) => sum + item.physicalQty, 0);
  const totalReserved = inventory.reduce((sum, item) => sum + item.reservedQty, 0);
  const totalAvailable = inventory.reduce((sum, item) => sum + (item.physicalQty - item.reservedQty), 0);

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Inventory Management</h1>
          <p className="muted">Monitor real-time stock levels, locations, batches, and reservations.</p>
        </div>
        <div style={{ display: "flex", gap: "1rem" }}>
          <button 
            className={viewMode === "list" ? "primary" : "secondary"} 
            onClick={() => setViewMode("list")}
          >
            📋 Stock List
          </button>
          {(user?.role === "ADMIN" || user?.role === "OPERATIONS_USER") && (
            <button 
              className={viewMode === "logs" ? "primary" : "secondary"} 
              onClick={() => {
                setViewMode("logs");
                loadLogs();
              }}
            >
              📜 Stock Logs
            </button>
          )}
        </div>
      </div>

      <div className="summary-cards" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
        <div className="card" style={{ padding: "1rem", textAlign: "center" }}>
          <small className="muted">Total Physical Stock</small>
          <h2 style={{ margin: "0.5rem 0 0 0", color: "var(--primary)" }}>{totalPhysical}</h2>
        </div>
        <div className="card" style={{ padding: "1rem", textAlign: "center" }}>
          <small className="muted">Total Reserved Stock</small>
          <h2 style={{ margin: "0.5rem 0 0 0", color: "var(--warning)" }}>{totalReserved}</h2>
        </div>
        <div className="card" style={{ padding: "1rem", textAlign: "center" }}>
          <small className="muted">Total Available Stock</small>
          <h2 style={{ margin: "0.5rem 0 0 0", color: "var(--success)" }}>{totalAvailable}</h2>
        </div>
      </div>

      {viewMode === "list" ? (
        <div className="card">
          <div style={{ marginBottom: "1rem" }}>
            <input 
              type="text" 
              placeholder="Search by Item, Location, Batch or Category..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: "100%", padding: "0.75rem" }}
            />
          </div>

          {loading ? (
            <p>Loading inventory...</p>
          ) : filteredInventory.length === 0 ? (
            <p>No inventory items found matching your search.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Item Code/Name</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th>Batch Number</th>
                  <th style={{ textAlign: "right" }}>Physical Qty</th>
                  <th style={{ textAlign: "right" }}>Reserved Qty</th>
                  <th style={{ textAlign: "right" }}>Available Qty</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map(item => {
                  const available = item.physicalQty - item.reservedQty;
                  return (
                    <tr key={item.id}>
                      <td><strong>{item.item}</strong></td>
                      <td><span className="badge">{item.category}</span></td>
                      <td>{item.location}</td>
                      <td><code>{item.batch}</code></td>
                      <td style={{ textAlign: "right", fontWeight: "bold" }}>{item.physicalQty}</td>
                      <td style={{ textAlign: "right", color: item.reservedQty > 0 ? "var(--warning)" : "inherit" }}>
                        {item.reservedQty}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: "bold", color: available > 0 ? "var(--success)" : "var(--error)" }}>
                        {available}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="card">
          <h2>Stock Movement Audit Log</h2>
          <p className="muted" style={{ marginBottom: "1rem" }}>Chronological ledger of all inventory transactions and changes.</p>
          
          {logs.length === 0 ? (
            <p>No stock movement logs recorded yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Item</th>
                  <th>Location</th>
                  <th>Batch</th>
                  <th style={{ textAlign: "right" }}>Qty Change</th>
                  <th style={{ textAlign: "right" }}>Reserved Change</th>
                  <th>Transaction Type</th>
                  <th>Reference ID</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td>{new Date(log.createdAt).toLocaleString()}</td>
                    <td><strong>{log.item}</strong></td>
                    <td>{log.location}</td>
                    <td><code>{log.batch}</code></td>
                    <td style={{ 
                      textAlign: "right", 
                      fontWeight: "bold", 
                      color: log.quantity > 0 ? "var(--success)" : log.quantity < 0 ? "var(--error)" : "inherit" 
                    }}>
                      {log.quantity > 0 ? `+${log.quantity}` : log.quantity}
                    </td>
                    <td style={{ 
                      textAlign: "right", 
                      fontWeight: "bold", 
                      color: log.reservedChange > 0 ? "var(--warning)" : log.reservedChange < 0 ? "var(--success)" : "inherit" 
                    }}>
                      {log.reservedChange > 0 ? `+${log.reservedChange}` : log.reservedChange}
                    </td>
                    <td>
                      <span className="badge" style={{ 
                        backgroundColor: log.type.includes("ERROR") || log.type.includes("RELEASE") ? "rgba(220,53,69,0.1)" : "rgba(0,123,255,0.1)" 
                      }}>
                        {log.type}
                      </span>
                    </td>
                    <td><code>{log.referenceId || "-"}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
