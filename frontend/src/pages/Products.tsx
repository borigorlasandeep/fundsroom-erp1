import { FormEvent, useEffect, useState } from "react";
import { api } from "../services/api";
import { Product } from "../types";

type StockMovement = {
  id: number;
  quantity: number;
  type: "IN" | "OUT";
  reason: string;
  createdAt: string;
  createdBy: {
    id: number;
    name: string;
    role: string;
  };
};

export default function Products() {
  const [items, setItems] = useState<Product[]>([]);
  const [form, setForm] = useState({ 
    name: "", sku: "", category: "", unitPrice: "", currentStock: "", minStockQty: "5", warehouse: "Main Warehouse" 
  });
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Details, Edit & Stock Adjustment Modal State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Stock Adjustment Form State
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustType, setAdjustType] = useState<"IN" | "OUT">("IN");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustMessage, setAdjustMessage] = useState("");

  // Edit Product Form State
  const [editForm, setEditForm] = useState({
    name: "", sku: "", category: "", unitPrice: "", minStockQty: "", warehouse: ""
  });

  async function load() {
    const res = await api.get("/products?limit=100");
    setItems(res.data.items);
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setErrorMessage("");
    try {
      await api.post("/products", { 
        ...form, 
        unitPrice: Number(form.unitPrice), 
        currentStock: Number(form.currentStock) || 0, 
        minStockQty: Number(form.minStockQty) 
      });
      setForm({ name: "", sku: "", category: "", unitPrice: "", currentStock: "", minStockQty: "5", warehouse: "Main Warehouse" });
      setMessage("Product added successfully");
      load();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || "Could not add product");
    }
  }

  async function openProductDetails(product: Product) {
    try {
      const movementsRes = await api.get(`/products/${product.id}/stock-movements`);
      setSelectedProduct(product);
      setMovements(movementsRes.data.movements || []);
      setEditForm({
        name: product.name,
        sku: product.sku,
        category: product.category,
        unitPrice: String(product.unitPrice),
        minStockQty: String(product.minStockQty),
        warehouse: product.warehouse
      });
      setIsModalOpen(true);
      setIsEditMode(false);
      setAdjustQty("");
      setAdjustType("IN");
      setAdjustReason("");
      setAdjustMessage("");
    } catch (err: any) {
      alert("Error loading product details");
    }
  }

  async function handleStockAdjustment(e: FormEvent) {
    e.preventDefault();
    if (!selectedProduct) return;
    setAdjustMessage("");
    try {
      await api.post(`/products/${selectedProduct.id}/stock`, {
        quantity: Number(adjustQty),
        type: adjustType,
        reason: adjustReason
      });
      setAdjustQty("");
      setAdjustReason("");
      setAdjustMessage("Stock adjusted successfully");

      // Reload product list to update main inventory stock numbers
      load();

      // Reload product details to update the selected product state and list of movements
      const productRes = await api.get("/products?limit=100");
      const updatedProduct = productRes.data.items.find((p: Product) => p.id === selectedProduct.id);
      if (updatedProduct) setSelectedProduct(updatedProduct);

      const movementsRes = await api.get(`/products/${selectedProduct.id}/stock-movements`);
      setMovements(movementsRes.data.movements || []);
    } catch (err: any) {
      setAdjustMessage(err.response?.data?.message || "Failed to adjust stock");
    }
  }

  async function handleUpdateProduct(e: FormEvent) {
    e.preventDefault();
    if (!selectedProduct) return;
    try {
      const res = await api.put(`/products/${selectedProduct.id}`, {
        ...editForm,
        unitPrice: Number(editForm.unitPrice),
        minStockQty: Number(editForm.minStockQty)
      });
      setSelectedProduct(res.data.product);
      setIsEditMode(false);
      load();
      alert("Product updated successfully");
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to update product");
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Products & Inventory</h1>
          <p className="muted">Manage warehouse catalog items, pricing structures, and real-time stock status.</p>
        </div>
      </div>
      <div className="two-column">
        <form className="panel" onSubmit={submit}>
          <h2>Add Product</h2>
          <div className="form-grid">
            <label>Product name
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </label>
            <label>SKU / Code
              <input required value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} />
            </label>
            <label>Category
              <input required value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
            </label>
            <label>Unit price (₹)
              <input type="number" step="0.01" required value={form.unitPrice} onChange={e => setForm({ ...form, unitPrice: e.target.value })} />
            </label>
            <label>Opening stock
              <input type="number" value={form.currentStock} onChange={e => setForm({ ...form, currentStock: e.target.value })} />
            </label>
            <label>Minimum stock
              <input type="number" required value={form.minStockQty} onChange={e => setForm({ ...form, minStockQty: e.target.value })} />
            </label>
          </div>
          <label style={{ marginBottom: "18px" }}>Warehouse Location
            <input required value={form.warehouse} onChange={e => setForm({ ...form, warehouse: e.target.value })} />
          </label>
          <button className="primary" type="submit">Create Product</button>
          {message && <p className="success">{message}</p>}
          {errorMessage && <p className="error">{errorMessage}</p>}
        </form>

        <div className="panel">
          <h2>Inventory Catalog</h2>
          <div className="table-wrap" style={{ marginTop: "18px" }}>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)" }}>No products cataloged.</td></tr>
                ) : (
                  items.map(p => (
                    <tr key={p.id}>
                      <td><strong>{p.name}</strong></td>
                      <td>{p.sku}</td>
                      <td>{p.category}</td>
                      <td>₹{Number(p.unitPrice).toFixed(2)}</td>
                      <td>{p.currentStock}</td>
                      <td>
                        {p.currentStock <= p.minStockQty ? (
                          <span className="badge inactive">Low Stock ({p.minStockQty} min)</span>
                        ) : (
                          <span className="badge active">Healthy</span>
                        )}
                      </td>
                      <td>
                        <button className="link-action" onClick={() => openProductDetails(p)}>Manage & History</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Dialog */}
      {isModalOpen && selectedProduct && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{isEditMode ? "Edit Product Specifications" : selectedProduct.name}</h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>&times;</button>
            </div>
            <div className="modal-body">
              {isEditMode ? (
                /* Edit Form Mode */
                <form onSubmit={handleUpdateProduct}>
                  <div className="form-grid">
                    <label>Product name
                      <input required value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                    </label>
                    <label>SKU / Code
                      <input required value={editForm.sku} onChange={e => setEditForm({ ...editForm, sku: e.target.value })} />
                    </label>
                    <label>Category
                      <input required value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })} />
                    </label>
                    <label>Unit price (₹)
                      <input type="number" step="0.01" required value={editForm.unitPrice} onChange={e => setEditForm({ ...editForm, unitPrice: e.target.value })} />
                    </label>
                    <label>Minimum stock level
                      <input type="number" required value={editForm.minStockQty} onChange={e => setEditForm({ ...editForm, minStockQty: e.target.value })} />
                    </label>
                    <label>Warehouse location
                      <input required value={editForm.warehouse} onChange={e => setEditForm({ ...editForm, warehouse: e.target.value })} />
                    </label>
                  </div>
                  <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                    <button type="submit" className="primary">Save Changes</button>
                    <button type="button" className="secondary" onClick={() => setIsEditMode(false)}>Cancel</button>
                  </div>
                </form>
              ) : (
                /* View Mode */
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px" }}>
                  <div>
                    <h3>Item Details</h3>
                    <br />
                    <div className="detail-grid">
                      <div className="detail-item"><span>SKU / Code</span><strong>{selectedProduct.sku}</strong></div>
                      <div className="detail-item"><span>Category</span><strong>{selectedProduct.category}</strong></div>
                      <div className="detail-item"><span>Unit Price</span><strong>₹{Number(selectedProduct.unitPrice).toFixed(2)}</strong></div>
                      <div className="detail-item"><span>Current Stock</span><strong>{selectedProduct.currentStock} units</strong></div>
                      <div className="detail-item"><span>Minimum Stock Alert</span><strong>{selectedProduct.minStockQty} units</strong></div>
                      <div className="detail-item"><span>Warehouse Location</span><strong>{selectedProduct.warehouse}</strong></div>
                    </div>
                    <div style={{ marginBottom: "20px" }}>
                      <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase" }}>Stock Status</span>
                      <p style={{ marginTop: "4px" }}>
                        {selectedProduct.currentStock <= selectedProduct.minStockQty ? (
                          <strong className="danger-text">⚠️ Stock alert: Below threshold! Restock advised.</strong>
                        ) : (
                          <strong className="success-text">✅ Stock levels are healthy.</strong>
                        )}
                      </p>
                    </div>
                    <button className="secondary" onClick={() => setIsEditMode(true)}>Edit Product</button>
                    
                    <hr style={{ margin: "24px 0", border: 0, borderTop: "1px solid var(--border-color)" }} />
                    
                    {/* Stock Adjustment Section */}
                    <h3>Adjust Stock Level</h3>
                    <br />
                    <form onSubmit={handleStockAdjustment}>
                      <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "12px", marginBottom: "12px" }}>
                        <label>Adjustment
                          <select value={adjustType} onChange={e => setAdjustType(e.target.value as any)}>
                            <option value="IN">IN (Stock Added)</option>
                            <option value="OUT">OUT (Stock Removed)</option>
                          </select>
                        </label>
                        <label>Quantity
                          <input type="number" min="1" required value={adjustQty} onChange={e => setAdjustQty(e.target.value)} />
                        </label>
                      </div>
                      <label style={{ marginBottom: "12px" }}>Reason for adjustment
                        <input required placeholder="e.g. Received shipment, stock audit, wastage..." value={adjustReason} onChange={e => setAdjustReason(e.target.value)} />
                      </label>
                      <button className="primary" type="submit" style={{ width: "100%" }}>Apply Adjustment</button>
                      {adjustMessage && <p className="success" style={{ padding: "6px", marginTop: "10px" }}>{adjustMessage}</p>}
                    </form>
                  </div>

                  <div>
                    <h3>Stock Movement Log</h3>
                    <br />
                    <div className="log-list" style={{ maxHeight: "480px", overflowY: "auto" }}>
                      {movements.length === 0 ? (
                        <p style={{ fontSize: "13px", color: "var(--text-muted)", textAlign: "center" }}>No stock movements recorded.</p>
                      ) : (
                        movements.map(log => (
                          <div className="log-item" key={log.id}>
                            <div className="log-meta">
                              <span className={log.type === "IN" ? "success-text" : "danger-text"}>
                                <strong>{log.type === "IN" ? "+" : "-"}{log.quantity} units</strong> ({log.type})
                              </span>
                              <span>{new Date(log.createdAt).toLocaleString()}</span>
                            </div>
                            <p className="log-note">{log.reason}</p>
                            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", textAlign: "right" }}>
                              Logged by {log.createdBy?.name || "System"} ({log.createdBy?.role || "Staff"})
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="secondary" onClick={() => setIsModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
