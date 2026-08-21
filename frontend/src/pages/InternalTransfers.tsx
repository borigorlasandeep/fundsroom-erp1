import { FormEvent, useEffect, useState } from "react";
import { api } from "../services/api";
import { InternalTransfer, InventoryItem } from "../types";
import { useAuth } from "../context/AuthContext";

export default function InternalTransfers() {
  const { user } = useAuth();
  const [transfers, setTransfers] = useState<InternalTransfer[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  
  // Form State
  const [form, setForm] = useState({
    sourceLocation: "",
    destinationLocation: "",
    item: "",
    batch: "",
    quantity: "",
  });

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadTransfers() {
    setLoading(true);
    try {
      const res = await api.get("/transfers");
      if (res.data.success) {
        setTransfers(res.data.data);
      }
    } catch (err) {
      console.error("Error loading transfers", err);
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
    loadTransfers();
    loadInventory();
  }, []);

  // Form selections and computed filters
  const uniqueItems = Array.from(new Set(inventory.map(i => i.item)));
  const uniqueLocations = Array.from(new Set(inventory.map(i => i.location)));
  
  // Available batches at selected source location for the selected item
  const availableBatches = inventory
    .filter(i => i.item === form.item && i.location === form.sourceLocation)
    .map(i => i.batch);

  // When item or source location changes, select first available batch
  useEffect(() => {
    if (availableBatches.length > 0) {
      setForm(prev => ({ ...prev, batch: availableBatches[0] }));
    } else {
      setForm(prev => ({ ...prev, batch: "" }));
    }
  }, [form.item, form.sourceLocation]);

  // Set default form values when inventory is loaded
  useEffect(() => {
    if (inventory.length > 0) {
      const firstItem = uniqueItems[0] || "";
      const firstLoc = uniqueLocations[0] || "";
      const nextLoc = uniqueLocations[1] || uniqueLocations[0] || "";
      
      setForm(prev => ({
        ...prev,
        item: firstItem,
        sourceLocation: firstLoc,
        destinationLocation: nextLoc,
      }));
    }
  }, [inventory]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setErrorMessage("");

    try {
      const res = await api.post("/transfers", {
        sourceLocation: form.sourceLocation,
        destinationLocation: form.destinationLocation,
        item: form.item,
        batch: form.batch,
        quantity: Number(form.quantity),
      });

      if (res.data.success) {
        setMessage("Internal stock transfer requested successfully");
        setForm(prev => ({ ...prev, quantity: "" }));
        loadTransfers();
        loadInventory();
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || "Could not request transfer");
    }
  }

  async function handleDispatch(id: number) {
    setMessage("");
    setErrorMessage("");
    try {
      const res = await api.patch(`/transfers/${id}/dispatch`);
      if (res.data.success) {
        setMessage("Transfer stock successfully dispatched (source inventory reduced).");
        loadTransfers();
        loadInventory();
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || "Failed to dispatch transfer");
    }
  }

  async function handleReceive(id: number) {
    setMessage("");
    setErrorMessage("");
    try {
      const res = await api.patch(`/transfers/${id}/receive`);
      if (res.data.success) {
        setMessage("Transfer stock successfully received at destination.");
        loadTransfers();
        loadInventory();
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || "Failed to receive transfer");
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Internal Stock Transfers</h1>
          <p className="muted">Move stock between warehouses. Physical stock decreases on dispatch and increases at destination on receipt.</p>
        </div>
      </div>

      {message && <div className="card" style={{ color: "var(--success)", borderLeft: "4px solid var(--success)", marginBottom: "1rem" }}>{message}</div>}
      {errorMessage && <div className="card" style={{ color: "var(--error)", borderLeft: "4px solid var(--error)", marginBottom: "1rem" }}>{errorMessage}</div>}

      <div className="two-column">
        {/* Create Transfer Request Form */}
        <div className="card form-column">
          <h2>Request Stock Transfer</h2>
          <form onSubmit={handleSubmit}>
            <label>Item</label>
            <select 
              value={form.item} 
              onChange={e => setForm(prev => ({ ...prev, item: e.target.value }))}
              required
            >
              {uniqueItems.map(item => <option key={item} value={item}>{item}</option>)}
            </select>

            <label>Source Location</label>
            <select 
              value={form.sourceLocation} 
              onChange={e => setForm(prev => ({ ...prev, sourceLocation: e.target.value }))}
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
                <option value="" disabled>No batches at source location</option>
              ) : (
                availableBatches.map(b => <option key={b} value={b}>{b}</option>)
              )}
            </select>

            <label>Destination Location</label>
            <select 
              value={form.destinationLocation} 
              onChange={e => setForm(prev => ({ ...prev, destinationLocation: e.target.value }))}
              required
            >
              {uniqueLocations.map(loc => (
                <option key={loc} value={loc} disabled={loc === form.sourceLocation}>
                  {loc} {loc === form.sourceLocation ? "(Source)" : ""}
                </option>
              ))}
            </select>

            <label>Quantity to Transfer</label>
            <input 
              type="number" 
              value={form.quantity} 
              onChange={e => setForm(prev => ({ ...prev, quantity: e.target.value }))} 
              placeholder="e.g. 50"
              min="1"
              required
            />

            <button 
              className="primary" 
              type="submit" 
              style={{ marginTop: "1rem" }}
              disabled={availableBatches.length === 0}
            >
              🚀 Request Transfer
            </button>
          </form>
        </div>

        {/* Transfers List */}
        <div className="card table-column">
          <h2>Stock Transfer Ledger</h2>
          <p className="muted" style={{ marginBottom: "1rem" }}>List of requested, transit, and completed stock transfers.</p>

          {loading ? (
            <p>Loading transfers...</p>
          ) : transfers.length === 0 ? (
            <p>No transfers registered.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Item</th>
                  <th>Batch</th>
                  <th>Qty</th>
                  <th>Route</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map(tr => (
                  <tr key={tr.id}>
                    <td><code>TR-{tr.id}</code></td>
                    <td><strong>{tr.item}</strong></td>
                    <td><code>{tr.batch}</code></td>
                    <td><strong>{tr.quantity}</strong></td>
                    <td>
                      <small className="muted">{tr.sourceLocation}</small>
                      <br />→ {tr.destinationLocation}
                    </td>
                    <td>
                      <span className="badge" style={{
                        backgroundColor: tr.status === "RECEIVED" ? "rgba(40,167,69,0.15)" : tr.status === "DISPATCHED" ? "rgba(255,193,7,0.15)" : "rgba(108,117,125,0.15)",
                        color: tr.status === "RECEIVED" ? "var(--success)" : tr.status === "DISPATCHED" ? "var(--warning)" : "var(--muted)"
                      }}>
                        {tr.status}
                      </span>
                    </td>
                    <td>
                      {tr.status === "REQUESTED" && (
                        <button 
                          className="primary" 
                          onClick={() => handleDispatch(tr.id)}
                          style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                        >
                          📦 Dispatch
                        </button>
                      )}
                      {tr.status === "DISPATCHED" && (
                        <button 
                          className="success-btn" 
                          onClick={() => handleReceive(tr.id)}
                          style={{ 
                            padding: "0.25rem 0.5rem", 
                            fontSize: "0.8rem",
                            backgroundColor: "var(--success)",
                            color: "#fff",
                            border: "none",
                            borderRadius: "var(--radius)",
                            cursor: "pointer"
                          }}
                        >
                          📥 Receive
                        </button>
                      )}
                      {tr.status === "RECEIVED" && (
                        <span className="muted">Completed</span>
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
