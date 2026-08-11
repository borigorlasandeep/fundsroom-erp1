import { FormEvent, useEffect, useState } from "react";
import { api } from "../services/api";

type Customer = { id: number; name: string; businessName: string; address: string; mobile: string; email: string | null };
type Product = { id: number; name: string; sku: string; currentStock: number; unitPrice: number };

type ChallanItem = {
  id: number;
  productId: number;
  productName: string;
  sku: string;
  unitPrice: number;
  quantity: number;
};

type Challan = {
  id: number;
  challanNumber: string;
  customerId: number;
  totalQuantity: number;
  status: "DRAFT" | "CONFIRMED" | "CANCELLED";
  createdById: number;
  createdAt: string;
  customer: Customer;
  createdBy: {
    name: string;
    role: string;
  };
  items: ChallanItem[];
};

export default function Challans() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [challans, setChallans] = useState<Challan[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [items, setItems] = useState<{ productId: number; quantity: number }[]>([]);
  const [status, setStatus] = useState<"DRAFT" | "CONFIRMED">("CONFIRMED");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Details Modal State
  const [selectedChallan, setSelectedChallan] = useState<Challan | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  async function load() {
    const [c, p, ch] = await Promise.all([
      api.get("/customers?limit=100"),
      api.get("/products?limit=100"),
      api.get("/challans?limit=100")
    ]);
    setCustomers(c.data.items);
    setProducts(p.data.items);
    setChallans(ch.data.items);
  }

  useEffect(() => {
    load();
  }, []);

  function addItem() {
    if (!productId) return;
    const prodId = Number(productId);
    const qty = Number(quantity);
    
    // Check if product is already in the list
    const existingIndex = items.findIndex(item => item.productId === prodId);
    if (existingIndex > -1) {
      const newItems = [...items];
      newItems[existingIndex].quantity += qty;
      setItems(newItems);
    } else {
      setItems([...items, { productId: prodId, quantity: qty }]);
    }
    
    setProductId("");
    setQuantity("1");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setErrorMessage("");
    try {
      const res = await api.post("/challans", { 
        customerId: Number(customerId), 
        items, 
        status 
      });
      setMessage(`Challan ${res.data.challan.challanNumber} created successfully`);
      setItems([]);
      setCustomerId("");
      load();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || "Could not create challan");
    }
  }

  async function openChallanDetails(challan: Challan) {
    try {
      const res = await api.get(`/challans/${challan.id}`);
      setSelectedChallan(res.data.challan);
      setIsModalOpen(true);
    } catch (err: any) {
      alert("Error loading challan details");
    }
  }

  async function handleUpdateStatus(newStatus: "CONFIRMED" | "CANCELLED") {
    if (!selectedChallan) return;
    try {
      const res = await api.patch(`/challans/${selectedChallan.id}/status`, { status: newStatus });
      alert(`Challan has been ${newStatus.toLowerCase()} successfully.`);
      setIsModalOpen(false);
      setSelectedChallan(null);
      load();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to update challan status");
    }
  }

  function handlePrint() {
    window.print();
  }

  // Calculate invoice totals
  const invoiceSubtotal = selectedChallan?.items.reduce((sum, item) => sum + (Number(item.unitPrice) * item.quantity), 0) || 0;
  const invoiceTax = invoiceSubtotal * 0.18; // 18% GST standard
  const invoiceTotal = invoiceSubtotal + invoiceTax;

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Sales Challans</h1>
          <p className="muted">Generate draft and confirmed challans, review pending orders, and print invoices.</p>
        </div>
      </div>
      <div className="two-column">
        <form className="panel" onSubmit={submit}>
          <h2>Create Challan</h2>
          <label style={{ marginBottom: "14px" }}>Customer
            <select value={customerId} onChange={e => setCustomerId(e.target.value)} required>
              <option value="">Select customer</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name} — {c.businessName}</option>
              ))}
            </select>
          </label>
          
          <div className="inline-form">
            <label>Product
              <select value={productId} onChange={e => setProductId(e.target.value)}>
                <option value="">Select product</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.currentStock} available)</option>
                ))}
              </select>
            </label>
            <label>Qty
              <input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} />
            </label>
            <button type="button" className="secondary add-btn" onClick={addItem}>Add</button>
          </div>
          
          <div className="item-list">
            {items.length === 0 ? (
              <p style={{ padding: "14px", fontSize: "13px", color: "var(--text-muted)", textAlign: "center" }}>No products added yet.</p>
            ) : (
              items.map((item, index) => {
                const p = products.find(x => x.id === item.productId);
                return (
                  <div className="item-row" key={index}>
                    <span><strong>{p?.name}</strong> <span className="muted">({p?.sku})</span> &times; {item.quantity}</span>
                    <button type="button" className="link-danger" onClick={() => setItems(items.filter((_, i) => i !== index))}>Remove</button>
                  </div>
                );
              })
            )}
          </div>
          
          <label style={{ marginBottom: "18px" }}>Status
            <select value={status} onChange={e => setStatus(e.target.value as any)}>
              <option value="CONFIRMED">Confirmed (Reduces Inventory)</option>
              <option value="DRAFT">Draft Challan (Save Order)</option>
            </select>
          </label>
          
          <button className="primary" type="submit" disabled={!customerId || !items.length}>Create Challan</button>
          {message && <p className="success">{message}</p>}
          {errorMessage && <p className="error">{errorMessage}</p>}
        </form>

        <div className="panel">
          <h2>Sales Challan Registry</h2>
          <div className="table-wrap" style={{ marginTop: "18px" }}>
            <table>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Customer</th>
                  <th>Total Qty</th>
                  <th>Status</th>
                  <th>Created Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {challans.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)" }}>No challans recorded.</td></tr>
                ) : (
                  challans.map(c => (
                    <tr key={c.id}>
                      <td><strong>{c.challanNumber}</strong></td>
                      <td>{c.customer?.name} ({c.customer?.businessName})</td>
                      <td>{c.totalQuantity} items</td>
                      <td>
                        <span className={`badge ${c.status.toLowerCase()}`}>{c.status}</span>
                      </td>
                      <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                      <td>
                        <button className="link-action" onClick={() => openChallanDetails(c)}>View & Invoice</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Dialog for Challan Details & Invoicing */}
      {isModalOpen && selectedChallan && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Sales Challan Details</h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>&times;</button>
            </div>
            <div className="modal-body">
              {/* Print-Only Header (styled via @media print to only show on printed paper/PDF) */}
              <div className="invoice-print-header">
                <div>
                  <h1 style={{ fontSize: "28px", color: "var(--primary)", marginBottom: "4px" }}>Fundsroom Infotech Pvt. Ltd.</h1>
                  <p className="muted">ERP Operations Hub & Wholesale Distribution</p>
                  <p style={{ marginTop: "6px" }}>B/406, Corporate Towers, Vadodara, Gujarat - 390007</p>
                  <p>Support: +91 89603 22672 | operations@fundsroom.local</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <h1 style={{ fontSize: "24px", color: "var(--text-primary)", marginBottom: "4px" }}>TAX INVOICE</h1>
                  <p style={{ fontSize: "14px" }}><strong>Challan No:</strong> {selectedChallan.challanNumber}</p>
                  <p><strong>Status:</strong> {selectedChallan.status}</p>
                  <p><strong>Date:</strong> {new Date(selectedChallan.createdAt).toLocaleString()}</p>
                </div>
              </div>

              {/* Grid Metadata */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px", marginBottom: "30px" }}>
                <div>
                  <h3 style={{ fontSize: "16px", borderBottom: "1px solid var(--border-color)", paddingBottom: "6px", marginBottom: "12px" }}>Billed To:</h3>
                  <div className="detail-item" style={{ marginBottom: "6px" }}>
                    <span>Customer Name</span>
                    <strong>{selectedChallan.customer?.name}</strong>
                  </div>
                  <div className="detail-item" style={{ marginBottom: "6px" }}>
                    <span>Business Name</span>
                    <strong>{selectedChallan.customer?.businessName}</strong>
                  </div>
                  <div className="detail-item" style={{ marginBottom: "6px" }}>
                    <span>Contact Info</span>
                    <strong>{selectedChallan.customer?.mobile} {selectedChallan.customer?.email ? `| ${selectedChallan.customer?.email}` : ""}</strong>
                  </div>
                  <div className="detail-item">
                    <span>Shipping Address</span>
                    <strong>{selectedChallan.customer?.address}</strong>
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: "16px", borderBottom: "1px solid var(--border-color)", paddingBottom: "6px", marginBottom: "12px" }}>Order Information:</h3>
                  <div className="detail-item" style={{ marginBottom: "6px" }}>
                    <span>Challan Number</span>
                    <strong>{selectedChallan.challanNumber}</strong>
                  </div>
                  <div className="detail-item" style={{ marginBottom: "6px" }}>
                    <span>Current Status</span>
                    <strong>
                      <span className={`badge ${selectedChallan.status.toLowerCase()}`}>{selectedChallan.status}</span>
                    </strong>
                  </div>
                  <div className="detail-item" style={{ marginBottom: "6px" }}>
                    <span>Issued Date</span>
                    <strong>{new Date(selectedChallan.createdAt).toLocaleString()}</strong>
                  </div>
                  <div className="detail-item">
                    <span>Authorized Creator</span>
                    <strong>{selectedChallan.createdBy?.name} ({selectedChallan.createdBy?.role})</strong>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <h3 style={{ fontSize: "16px", marginBottom: "12px" }}>Products Included</h3>
              <div className="table-wrap" style={{ marginBottom: "20px" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Product Name</th>
                      <th>SKU / Code</th>
                      <th style={{ textAlign: "right" }}>Unit Price</th>
                      <th style={{ textAlign: "center" }}>Quantity</th>
                      <th style={{ textAlign: "right" }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedChallan.items.map(item => (
                      <tr key={item.id}>
                        <td><strong>{item.productName}</strong></td>
                        <td>{item.sku}</td>
                        <td style={{ textAlign: "right" }}>₹{Number(item.unitPrice).toFixed(2)}</td>
                        <td style={{ textAlign: "center" }}>{item.quantity}</td>
                        <td style={{ textAlign: "right" }}><strong>₹{(Number(item.unitPrice) * item.quantity).toFixed(2)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Invoice Totals */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ width: "300px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border-color)" }}>
                    <span>Subtotal:</span>
                    <strong>₹{invoiceSubtotal.toFixed(2)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border-color)" }}>
                    <span>GST (18%):</span>
                    <strong>₹{invoiceTax.toFixed(2)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: "16px", color: "var(--text-primary)" }}>
                    <span><strong>Grand Total:</strong></span>
                    <strong>₹{invoiceTotal.toFixed(2)}</strong>
                  </div>
                </div>
              </div>

              {/* Insufficient Stock Warning in details */}
              {selectedChallan.status === "DRAFT" && (
                <div style={{ marginTop: "24px", padding: "16px", background: "var(--color-warning-bg)", border: "1px solid rgba(245, 158, 11, 0.15)", borderRadius: "8px" }}>
                  <strong className="warning-text">⚠️ Order in Draft State</strong>
                  <p style={{ fontSize: "13px", marginTop: "4px" }}>
                    Stock is currently NOT reserved for this order. Confirming the challan will validate inventory availability, permanently reduce stock, and record an outgoing movement.
                  </p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              {/* Draft Operations */}
              {selectedChallan.status === "DRAFT" && (
                <>
                  <button className="primary" onClick={() => handleUpdateStatus("CONFIRMED")}>Confirm & Release Stock</button>
                  <button className="danger-btn" onClick={() => handleUpdateStatus("CANCELLED")}>Cancel Order</button>
                </>
              )}
              
              <button className="secondary" onClick={handlePrint}>Print Invoice</button>
              <button className="secondary" onClick={() => setIsModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
