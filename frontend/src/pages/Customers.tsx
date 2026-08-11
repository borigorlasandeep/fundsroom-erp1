import { FormEvent, useEffect, useState } from "react";
import { api } from "../services/api";
import { Customer } from "../types";

type FollowUp = {
  id: number;
  note: string;
  followUpDate: string | null;
  createdAt: string;
};

export default function Customers() {
  const [items, setItems] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "", mobile: "", email: "", businessName: "", gstNumber: "",
    type: "RETAIL", address: "", status: "LEAD", notes: ""
  });
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Details & Edit Modal State
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerFollowUps, setCustomerFollowUps] = useState<FollowUp[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Follow-up Form State
  const [followUpNote, setFollowUpNote] = useState("");
  const [followUpDateInput, setFollowUpDateInput] = useState("");
  const [followUpMessage, setFollowUpMessage] = useState("");

  // Edit Customer Form State
  const [editForm, setEditForm] = useState({
    name: "", mobile: "", email: "", businessName: "", gstNumber: "",
    type: "RETAIL", address: "", status: "LEAD", notes: ""
  });

  async function load() {
    const res = await api.get(`/customers?limit=50&search=${encodeURIComponent(search)}`);
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
      await api.post("/customers", form);
      setForm({ name: "", mobile: "", email: "", businessName: "", gstNumber: "", type: "RETAIL", address: "", status: "LEAD", notes: "" });
      setMessage("Customer added successfully");
      load();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || "Could not add customer");
    }
  }

  async function openCustomerDetails(customer: Customer) {
    try {
      const res = await api.get(`/customers/${customer.id}`);
      setSelectedCustomer(res.data.customer);
      setCustomerFollowUps(res.data.customer.followUps || []);
      setEditForm({
        name: res.data.customer.name,
        mobile: res.data.customer.mobile,
        email: res.data.customer.email || "",
        businessName: res.data.customer.businessName,
        gstNumber: res.data.customer.gstNumber || "",
        type: res.data.customer.type,
        address: res.data.customer.address,
        status: res.data.customer.status,
        notes: res.data.customer.notes || ""
      });
      setIsModalOpen(true);
      setIsEditMode(false);
      setFollowUpNote("");
      setFollowUpDateInput("");
      setFollowUpMessage("");
    } catch (err: any) {
      alert("Error loading customer details");
    }
  }

  async function handleAddFollowUp(e: FormEvent) {
    e.preventDefault();
    if (!selectedCustomer) return;
    setFollowUpMessage("");
    try {
      const res = await api.post(`/customers/${selectedCustomer.id}/follow-ups`, {
        note: followUpNote,
        followUpDate: followUpDateInput || undefined
      });
      setFollowUpNote("");
      setFollowUpDateInput("");
      setFollowUpMessage("Follow-up added successfully");
      
      // Reload customer details to show the new follow-up
      const updatedRes = await api.get(`/customers/${selectedCustomer.id}`);
      setSelectedCustomer(updatedRes.data.customer);
      setCustomerFollowUps(updatedRes.data.customer.followUps || []);
      
      // Reload main table to show updated status or dates if changed
      load();
    } catch (err: any) {
      setFollowUpMessage(err.response?.data?.message || "Failed to add follow-up");
    }
  }

  async function handleUpdateCustomer(e: FormEvent) {
    e.preventDefault();
    if (!selectedCustomer) return;
    try {
      const res = await api.put(`/customers/${selectedCustomer.id}`, editForm);
      setSelectedCustomer(res.data.customer);
      setIsEditMode(false);
      load();
      alert("Customer updated successfully");
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to update customer");
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Customers CRM</h1>
          <p className="muted">Manage customer database, status pipeline, and follow-up activities.</p>
        </div>
      </div>
      <div className="two-column">
        <form className="panel" onSubmit={submit}>
          <h2>Add Customer</h2>
          <div className="form-grid">
            <label>Customer name
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </label>
            <label>Mobile number
              <input required value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} />
            </label>
            <label>Email
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </label>
            <label>Business name
              <input required value={form.businessName} onChange={e => setForm({ ...form, businessName: e.target.value })} />
            </label>
            <label>GST number
              <input value={form.gstNumber} onChange={e => setForm({ ...form, gstNumber: e.target.value })} />
            </label>
            <label>Type
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                <option value="RETAIL">Retail</option>
                <option value="WHOLESALE">Wholesale</option>
                <option value="DISTRIBUTOR">Distributor</option>
              </select>
            </label>
            <label>Status
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="LEAD">Lead</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </label>
            <label>Address
              <input required value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            </label>
          </div>
          <label style={{ marginBottom: "18px" }}>Notes
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
          </label>
          <button className="primary" type="submit">Create Customer</button>
          {message && <p className="success">{message}</p>}
          {errorMessage && <p className="error">{errorMessage}</p>}
        </form>

        <div className="panel">
          <div className="table-header">
            <h2>Customer Database</h2>
            <input 
              placeholder="Search..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              onKeyDown={e => e.key === "Enter" && load()} 
            />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Business Name</th>
                  <th>Mobile</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)" }}>No customers found. Press Enter in search box to refresh.</td></tr>
                ) : (
                  items.map(c => (
                    <tr key={c.id}>
                      <td><strong>{c.name}</strong></td>
                      <td>{c.businessName}</td>
                      <td>{c.mobile}</td>
                      <td><span className={`badge ${c.type.toLowerCase()}`}>{c.type}</span></td>
                      <td><span className={`badge ${c.status.toLowerCase()}`}>{c.status}</span></td>
                      <td>
                        <button className="link-action" onClick={() => openCustomerDetails(c)}>View & Log</button>
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
      {isModalOpen && selectedCustomer && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{isEditMode ? "Edit Customer Details" : selectedCustomer.name}</h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>&times;</button>
            </div>
            <div className="modal-body">
              {isEditMode ? (
                /* Edit Form Mode */
                <form onSubmit={handleUpdateCustomer}>
                  <div className="form-grid">
                    <label>Customer name
                      <input required value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                    </label>
                    <label>Mobile number
                      <input required value={editForm.mobile} onChange={e => setEditForm({ ...editForm, mobile: e.target.value })} />
                    </label>
                    <label>Email address
                      <input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
                    </label>
                    <label>Business name
                      <input required value={editForm.businessName} onChange={e => setEditForm({ ...editForm, businessName: e.target.value })} />
                    </label>
                    <label>GSTIN number
                      <input value={editForm.gstNumber} onChange={e => setEditForm({ ...editForm, gstNumber: e.target.value })} />
                    </label>
                    <label>Customer type
                      <select value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value })}>
                        <option value="RETAIL">Retail</option>
                        <option value="WHOLESALE">Wholesale</option>
                        <option value="DISTRIBUTOR">Distributor</option>
                      </select>
                    </label>
                    <label>Status
                      <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                        <option value="LEAD">Lead</option>
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                      </select>
                    </label>
                    <label>Address
                      <input required value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} />
                    </label>
                  </div>
                  <label style={{ marginBottom: "18px" }}>Internal notes
                    <textarea value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} rows={3} />
                  </label>
                  <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                    <button type="submit" className="primary">Save Changes</button>
                    <button type="button" className="secondary" onClick={() => setIsEditMode(false)}>Cancel</button>
                  </div>
                </form>
              ) : (
                /* View Mode */
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "30px" }}>
                  <div>
                    <h3>Profile Overview</h3>
                    <br />
                    <div className="detail-grid">
                      <div className="detail-item"><span>Business Name</span><strong>{selectedCustomer.businessName}</strong></div>
                      <div className="detail-item"><span>Contact Mobile</span><strong>{selectedCustomer.mobile}</strong></div>
                      <div className="detail-item"><span>Email</span><strong>{selectedCustomer.email || "N/A"}</strong></div>
                      <div className="detail-item"><span>GSTIN</span><strong>{selectedCustomer.gstNumber || "N/A"}</strong></div>
                      <div className="detail-item"><span>Customer Type</span><strong><span className={`badge ${selectedCustomer.type.toLowerCase()}`}>{selectedCustomer.type}</span></strong></div>
                      <div className="detail-item"><span>Status</span><strong><span className={`badge ${selectedCustomer.status.toLowerCase()}`}>{selectedCustomer.status}</span></strong></div>
                      <div className="detail-item"><span>Next Follow-up</span><strong>{selectedCustomer.followUpDate ? new Date(selectedCustomer.followUpDate).toLocaleDateString() : "Not scheduled"}</strong></div>
                    </div>
                    <div style={{ marginBottom: "20px" }}>
                      <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase" }}>Address</span>
                      <p style={{ marginTop: "4px", fontSize: "14px", fontWeight: "500" }}>{selectedCustomer.address}</p>
                    </div>
                    <div style={{ marginBottom: "20px" }}>
                      <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase" }}>General Notes</span>
                      <p style={{ marginTop: "4px", fontSize: "14px", fontWeight: "500", background: "var(--secondary)", padding: "10px", borderRadius: "6px" }}>{selectedCustomer.notes || "No notes available."}</p>
                    </div>
                    <button className="secondary" onClick={() => setIsEditMode(true)}>Edit Profile</button>
                  </div>

                  <div>
                    <h3>Follow-up Journal</h3>
                    <br />
                    
                    {/* Log New Follow-up */}
                    <form onSubmit={handleAddFollowUp} style={{ marginBottom: "24px" }}>
                      <label>New Follow-up Note
                        <textarea required placeholder="Log call/email details..." value={followUpNote} onChange={e => setFollowUpNote(e.target.value)} rows={2} />
                      </label>
                      <label style={{ marginTop: "10px" }}>Next Follow-up Date (Optional)
                        <input type="date" value={followUpDateInput} onChange={e => setFollowUpDateInput(e.target.value)} />
                      </label>
                      <button className="primary" type="submit" style={{ marginTop: "12px", width: "100%" }}>Add Follow-up</button>
                      {followUpMessage && <p className="success" style={{ padding: "6px", marginTop: "10px" }}>{followUpMessage}</p>}
                    </form>

                    {/* Follow-up history */}
                    <div className="log-list" style={{ maxHeight: "300px", overflowY: "auto" }}>
                      {customerFollowUps.length === 0 ? (
                        <p style={{ fontSize: "13px", color: "var(--text-muted)", textAlign: "center" }}>No prior follow-ups recorded.</p>
                      ) : (
                        customerFollowUps.map(log => (
                          <div className="log-item" key={log.id}>
                            <div className="log-meta">
                              <span>{new Date(log.createdAt).toLocaleString()}</span>
                              {log.followUpDate && <span>Next: {new Date(log.followUpDate).toLocaleDateString()}</span>}
                            </div>
                            <p className="log-note">{log.note}</p>
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
