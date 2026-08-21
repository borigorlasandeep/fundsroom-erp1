import { FormEvent, useEffect, useState } from "react";
import { api } from "../services/api";
import { WorkOrder, User } from "../types";
import { useAuth } from "../context/AuthContext";

export default function WorkOrders() {
  const { user } = useAuth();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [itemsList, setItemsList] = useState<string[]>([]);
  
  // Form State
  const [form, setForm] = useState({
    location: "",
    item: "",
    requiredQty: "",
    assignedUserId: "",
  });

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadWorkOrders() {
    setLoading(true);
    try {
      const res = await api.get("/work-orders");
      if (res.data.success) {
        setWorkOrders(res.data.data);
      }
    } catch (err) {
      console.error("Error loading work orders", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadUsers() {
    try {
      const res = await api.get("/auth/users");
      if (res.data.success) {
        setUsers(res.data.data);
        if (res.data.data.length > 0) {
          setForm(prev => ({ ...prev, assignedUserId: String(res.data.data[0].id) }));
        }
      }
    } catch (err) {
      console.error("Error loading users", err);
    }
  }

  async function loadInventoryData() {
    try {
      const res = await api.get("/inventory");
      if (res.data.success) {
        const inv = res.data.data;
        const uniqueLocations: string[] = Array.from(new Set(inv.map((i: any) => i.location)));
        const uniqueItems: string[] = Array.from(new Set(inv.map((i: any) => i.item)));
        
        setLocations(uniqueLocations);
        setItemsList(uniqueItems);

        setForm(prev => ({
          ...prev,
          location: uniqueLocations[0] || "",
          item: uniqueItems[0] || "",
        }));
      }
    } catch (err) {
      console.error("Error loading inventory metadata", err);
    }
  }

  useEffect(() => {
    loadWorkOrders();
    loadUsers();
    loadInventoryData();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setErrorMessage("");

    try {
      const res = await api.post("/work-orders", {
        location: form.location,
        item: form.item,
        requiredQty: Number(form.requiredQty),
        assignedUserId: Number(form.assignedUserId),
      });

      if (res.data.success) {
        setMessage("Work order created successfully");
        setForm(prev => ({ ...prev, requiredQty: "" }));
        loadWorkOrders();
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || "Could not create work order");
    }
  }

  async function handleStatusChange(woId: number, status: string) {
    setMessage("");
    setErrorMessage("");

    try {
      const res = await api.patch(`/work-orders/${woId}/status`, { status });
      if (res.data.success) {
        setMessage(`Work order status updated to ${status}`);
        loadWorkOrders();
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || "Could not update work order status");
    }
  }

  const isAdmin = user?.role === "ADMIN";

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Work Orders</h1>
          <p className="muted">Assign manufacturing tasks, trace raw material requirements, and resolve shortages.</p>
        </div>
      </div>

      {message && <div className="card" style={{ color: "var(--success)", borderLeft: "4px solid var(--success)", marginBottom: "1rem" }}>{message}</div>}
      {errorMessage && <div className="card" style={{ color: "var(--error)", borderLeft: "4px solid var(--error)", marginBottom: "1rem" }}>{errorMessage}</div>}

      <div className="two-column">
        {/* Work Order Form (Admin only) */}
        {isAdmin ? (
          <div className="card form-column">
            <h2>Create Work Order</h2>
            <form onSubmit={handleSubmit}>
              <label>Location</label>
              <select 
                value={form.location} 
                onChange={e => setForm(prev => ({ ...prev, location: e.target.value }))}
                required
              >
                <option value="" disabled>Select Location</option>
                {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                <option value="Warehouse-3">Warehouse-3 (New Location)</option>
              </select>

              <label>Item</label>
              <select 
                value={form.item} 
                onChange={e => setForm(prev => ({ ...prev, item: e.target.value }))}
                required
              >
                <option value="" disabled>Select Item</option>
                {itemsList.map(item => <option key={item} value={item}>{item}</option>)}
              </select>

              <label>Required Quantity</label>
              <input 
                type="number" 
                value={form.requiredQty} 
                onChange={e => setForm(prev => ({ ...prev, requiredQty: e.target.value }))} 
                placeholder="e.g. 100"
                min="1"
                required
              />

              <label>Assigned User</label>
              <select 
                value={form.assignedUserId} 
                onChange={e => setForm(prev => ({ ...prev, assignedUserId: e.target.value }))}
                required
              >
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>

              <button className="primary" type="submit" style={{ marginTop: "1rem" }}>
                🛠️ Create Work Order
              </button>
            </form>
          </div>
        ) : (
          <div className="card form-column">
            <h2>Work Order Privileges</h2>
            <p className="muted">Only Administrators can create new Work Orders.</p>
            <p>You are logged in as <strong>{user?.name}</strong> with role <code>{user?.role}</code>.</p>
          </div>
        )}

        {/* Work Orders List */}
        <div className="card table-column">
          <h2>Active Work Orders</h2>
          <p className="muted" style={{ marginBottom: "1rem" }}>List of work orders and real-time material shortages.</p>

          {loading ? (
            <p>Loading work orders...</p>
          ) : workOrders.length === 0 ? (
            <p>No work orders found.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Item</th>
                  <th>Location</th>
                  <th style={{ textAlign: "right" }}>Required Qty</th>
                  <th style={{ textAlign: "right" }}>Shortage Qty</th>
                  <th>Assigned User</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {workOrders.map(wo => (
                  <tr key={wo.id}>
                    <td><code>WO-{wo.id}</code></td>
                    <td><strong>{wo.item}</strong></td>
                    <td>{wo.location}</td>
                    <td style={{ textAlign: "right" }}>{wo.requiredQty}</td>
                    <td style={{ 
                      textAlign: "right", 
                      fontWeight: "bold", 
                      color: wo.shortageQty > 0 ? "var(--error)" : "var(--success)" 
                    }}>
                      {wo.status === "COMPLETED" ? 0 : wo.shortageQty}
                    </td>
                    <td>{wo.assignedUser?.name || `ID: ${wo.assignedUserId}`}</td>
                    <td>
                      <span className="badge" style={{
                        backgroundColor: wo.status === "COMPLETED" ? "rgba(40,167,69,0.15)" : wo.status === "IN_PROGRESS" ? "rgba(255,193,7,0.15)" : "rgba(108,117,125,0.15)",
                        color: wo.status === "COMPLETED" ? "var(--success)" : wo.status === "IN_PROGRESS" ? "var(--warning)" : "var(--muted)"
                      }}>
                        {wo.status}
                      </span>
                    </td>
                    <td>
                      {wo.status === "ASSIGNED" && (
                        <button 
                          className="secondary" 
                          onClick={() => handleStatusChange(wo.id, "IN_PROGRESS")}
                          style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                        >
                          ⚡ Start Work
                        </button>
                      )}
                      {wo.status === "IN_PROGRESS" && (
                        <button 
                          className="primary" 
                          onClick={() => handleStatusChange(wo.id, "COMPLETED")}
                          style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                        >
                          ✅ Complete
                        </button>
                      )}
                      {wo.status === "COMPLETED" && (
                        <span className="muted">None</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
