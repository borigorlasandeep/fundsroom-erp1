import { FormEvent, useEffect, useState } from "react";
import { api } from "../services/api";
import { CustomerOrder, InventoryItem } from "../types";
import { useAuth } from "../context/AuthContext";

export default function CustomerOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  // Form State
  const [form, setForm] = useState({
    customerName: "",
    item: "",
    location: "",
    batch: "",
    quantity: "",
  });

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadOrders() {
    setLoading(true);
    try {
      const res = await api.get("/orders");
      if (res.data.success) {
        setOrders(res.data.data);
      }
    } catch (err) {
      console.error("Error loading orders", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadInventory() {
    try {
      const res = await api.get("/inventory");
      if (res.data.success) {
        setInventory(res.data.data);
      }
    } catch (err) {
      console.error("Error loading inventory", err);
    }
  }

  useEffect(() => {
    loadOrders();
    loadInventory();
  }, []);

  // Form selections and computed filters
  const uniqueItems = Array.from(new Set(inventory.map(i => i.item)));
  const uniqueLocations = Array.from(new Set(inventory.map(i => i.location)));
  
  // Available batches at selected location for the selected item
  const availableBatches = inventory
    .filter(i => i.item === form.item && i.location === form.location)
    .map(i => i.batch);

  // Update selected batch when item or location changes
  useEffect(() => {
    if (availableBatches.length > 0) {
      setForm(prev => ({ ...prev, batch: availableBatches[0] }));
    } else {
      setForm(prev => ({ ...prev, batch: "" }));
    }
  }, [form.item, form.location]);

  // Set default values when inventory is loaded
  useEffect(() => {
    if (inventory.length > 0) {
      setForm(prev => ({
        ...prev,
        item: uniqueItems[0] || "",
        location: uniqueLocations[0] || "",
      }));
    }
  }, [inventory]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setErrorMessage("");

    try {
      const res = await api.post("/orders", {
        customerName: form.customerName,
        item: form.item,
        location: form.location,
        batch: form.batch,
        quantity: Number(form.quantity),
      });

      if (res.data.success) {
        setMessage("Customer order created and stock reserved successfully!");
        setForm(prev => ({ ...prev, customerName: "", quantity: "" }));
        loadOrders();
        loadInventory();
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || "Could not reserve stock for order");
    }
  }

  async function handleComplete(id: number) {
    setMessage("");
    setErrorMessage("");
    try {
      const res = await api.patch(`/orders/${id}/complete`);
      if (res.data.success) {
        setMessage("Customer order marked complete. Reserved stock dispatched.");
        loadOrders();
        loadInventory();
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || "Failed to complete order");
    }
  }

  async function handleCancel(id: number) {
    setMessage("");
    setErrorMessage("");
    try {
      const res = await api.patch(`/orders/${id}/cancel`);
      if (res.data.success) {
        setMessage("Customer order cancelled. Reserved stock successfully released back to inventory.");
        loadOrders();
        loadInventory();
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || "Failed to cancel order");
    }
  }

  const isSalesOrAdmin = user?.role === "ADMIN" || user?.role === "SALES_USER";

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Customer Orders & Reservations</h1>
          <p className="muted">Create orders and reserve stock. Stock reservation protects inventory and guarantees availability.</p>
        </div>
      </div>

      {message && <div className="card" style={{ color: "var(--success)", borderLeft: "4px solid var(--success)", marginBottom: "1rem" }}>{message}</div>}
      {errorMessage && <div className="card" style={{ color: "var(--error)", borderLeft: "4px solid var(--error)", marginBottom: "1rem" }}>{errorMessage}</div>}

      <div className="two-column">
        {/* Create Order / Reservation Form */}
        {isSalesOrAdmin ? (
          <div className="card form-column">
            <h2>Reserve Customer Order</h2>
            <form onSubmit={handleSubmit}>
              <label>Customer Name</label>
              <input 
                type="text" 
                value={form.customerName} 
                onChange={e => setForm(prev => ({ ...prev, customerName: e.target.value }))} 
                placeholder="Enter Customer/Company Name"
                required
              />

              <label>Item</label>
              <select 
                value={form.item} 
                onChange={e => setForm(prev => ({ ...prev, item: e.target.value }))}
                required
              >
                {uniqueItems.map(item => <option key={item} value={item}>{item}</option>)}
              </select>

              <label>Location</label>
              <select 
                value={form.location} 
                onChange={e => setForm(prev => ({ ...prev, location: e.target.value }))}
                required
              >
                {uniqueLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
              </select>

              <label>Batch</label>
              <select 
                value={form.batch} 
                onChange={e => setForm(prev => ({ ...prev, batch: e.target.value }))}
                required
              >
                {availableBatches.length === 0 ? (
                  <option value="" disabled>No batches available</option>
                ) : (
                  availableBatches.map(b => <option key={b} value={b}>{b}</option>)
                )}
              </select>

              <label>Quantity to Reserve</label>
              <input 
                type="number" 
                value={form.quantity} 
                onChange={e => setForm(prev => ({ ...prev, quantity: e.target.value }))} 
                placeholder="e.g. 10"
                min="1"
                required
              />

              <button 
                className="primary" 
                type="submit" 
                style={{ marginTop: "1rem" }}
                disabled={availableBatches.length === 0}
              >
                🔒 Reserve & Create Order
              </button>
            </form>
          </div>
        ) : (
          <div className="card form-column">
            <h2>Sales Privileges Required</h2>
            <p className="muted">Only Sales users or Administrators can create customer orders and reserve stock.</p>
            <p>You are logged in as <strong>{user?.name}</strong> with role <code>{user?.role}</code>.</p>
          </div>
        )}

        {/* Customer Orders List */}
        <div className="card table-column">
          <h2>Sales Orders Ledger</h2>
          <p className="muted" style={{ marginBottom: "1rem" }}>List of stock reservations and customer order completion status.</p>

          {loading ? (
            <p>Loading orders...</p>
          ) : orders.length === 0 ? (
            <p>No customer orders registered.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Customer</th>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Stock Source</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order.id}>
                    <td><code>CO-{order.id}</code></td>
                    <td><strong>{order.customerName}</strong></td>
                    <td>{order.item}</td>
                    <td><strong>{order.quantity}</strong></td>
                    <td>
                      <small className="muted">{order.location}</small>
                      <br /><code>{order.batch}</code>
                    </td>
                    <td>
                      <span className="badge" style={{
                        backgroundColor: order.status === "COMPLETED" ? "rgba(40,167,69,0.15)" : order.status === "CANCELLED" ? "rgba(220,53,69,0.15)" : "rgba(255,193,7,0.15)",
                        color: order.status === "COMPLETED" ? "var(--success)" : order.status === "CANCELLED" ? "var(--error)" : "var(--warning)"
                      }}>
                        {order.status}
                      </span>
                    </td>
                    <td>
                      {order.status === "RESERVED" && isSalesOrAdmin && (
                        <div style={{ display: "flex", gap: "0.25rem" }}>
                          <button 
                            className="primary" 
                            onClick={() => handleComplete(order.id)}
                            style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                          >
                            🚀 Ship
                          </button>
                          <button 
                            className="secondary" 
                            onClick={() => handleCancel(order.id)}
                            style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem", color: "var(--error)", borderColor: "rgba(220,53,69,0.3)" }}
                          >
                            ❌ Cancel
                          </button>
                        </div>
                      )}
                      {order.status === "RESERVED" && !isSalesOrAdmin && (
                        <span className="muted">Restricted</span>
                      )}
                      {order.status !== "RESERVED" && (
                        <span className="muted">-</span>
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
