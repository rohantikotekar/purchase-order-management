"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Loader2, Search, Inbox, TrendingUp, AlertCircle, PackageCheck, 
  Sparkles, Trash2, ChevronDown, Check, LayoutGrid, Pencil, X,
  ArrowDownToLine, ArrowUpToLine
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// --- UTILS ---
// Merges Tailwind classes conditionally
function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

// --- TYPES ---
type PO = {
  id: string;
  supplier: string;
  items: string;
  expected_date: string;
  status: string;
  last_updated: string;
};

// Available status options for the dropdown
const STATUSES = ["Unknown", "On Track", "Shipped", "Product Delays", "Shipment Delay"] as const;

// --- COMPONENTS ---

// Reusable card component with glassmorphism effect
const GlassCard = ({ 
  children, 
  className, 
  allowOverflow = false 
}: { 
  children: React.ReactNode; 
  className?: string; 
  allowOverflow?: boolean 
}) => (
  <div className={cn(
    "glass-panel rounded-2xl border border-white/10 shadow-2xl backdrop-blur-3xl relative transition-all duration-300 bg-slate-900/40", 
    allowOverflow ? "overflow-visible" : "overflow-hidden",
    className
  )}>
    {children}
  </div>
);

// Modal dialog for confirming deletion actions
const DeleteConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  poId 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: () => void; 
  poId: string 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-md bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-rose-500/20 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6 text-rose-500" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Delete Purchase Order?</h3>
          <p className="text-slate-400 text-sm mb-6">
            Are you sure you want to delete PO <span className="text-white font-mono">{poId}</span>? <br/>
            This action cannot be undone.
          </p>
          
          <div className="flex gap-3 justify-center">
            <button 
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={onConfirm}
              className="px-4 py-2 rounded-lg text-sm font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-500/20 transition-all"
            >
              Delete Order
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// Dropdown component for selecting order status with color coding
const StatusSelect = ({ currentStatus, onChange }: { currentStatus: string; onChange: (s: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Returns tailwind classes based on status type
  const getStatusColor = (s: string) => {
    if (s === "On Track") return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-[0_0_15px_-5px_rgba(16,185,129,0.4)]";
    if (s === "Shipped") return "bg-blue-500/20 text-blue-300 border-blue-500/30 shadow-[0_0_15px_-5px_rgba(59,130,246,0.4)]";
    if (s.includes("Delay")) return "bg-rose-500/20 text-rose-300 border-rose-500/30 shadow-[0_0_15px_-5px_rgba(244,63,94,0.4)]";
    return "bg-slate-700/50 text-slate-300 border-white/10";
  };

  return (
    <div className="relative" ref={ref}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all duration-300 hover:scale-105 active:scale-95 whitespace-nowrap",
          getStatusColor(currentStatus)
        )}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
        {currentStatus}
        <ChevronDown className="w-3 h-3 opacity-50 ml-1" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            className="absolute left-0 top-full mt-2 w-56 z-[9999] rounded-xl border border-white/10 bg-slate-950 shadow-2xl overflow-hidden ring-1 ring-white/10"
          >
            <div className="p-1">
              {STATUSES.map((status) => (
                <button
                  key={status}
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    onChange(status); 
                    setIsOpen(false); 
                  }}
                  className={cn(
                    "w-full text-left px-4 py-2.5 rounded-lg text-xs font-medium flex items-center justify-between group transition-colors duration-200",
                    currentStatus === status ? "bg-indigo-500/20 text-indigo-300" : "text-slate-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  {status}
                  {currentStatus === status && <Check className="w-3 h-3" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function Dashboard() {
  // --- STATE MANAGEMENT ---
  const [pos, setPos] = useState<PO[]>([]);
  const [emailText, setEmailText] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Search & Filter State
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [focusedInput, setFocusedInput] = useState(false);
  
  // Inline Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempIdValue, setTempIdValue] = useState("");
  const [isSavingId, setIsSavingId] = useState(false);
  
  // Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<string | null>(null);

  // --- SCROLL REFS ---
  const manifestRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null); // Anchor for scrolling to top

  // Configuration Constants
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
  const MAX_CHARS = 1000;
  const MAX_ID_LENGTH = 20;

  // Fetch initial data on mount
  const fetchPOs = async () => {
    try {
      const res = await fetch(`${API_URL}/pos`);
      if (res.ok) setPos(await res.json());
    } catch {}
  };
  useEffect(() => { fetchPOs(); }, []);

  // --- SCROLL ACTIONS ---
  
  // Scrolls window to the very top anchor
  const scrollToDashboard = () => {
    topRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Scrolls to the table section with offset padding
  const scrollToManifest = () => {
    manifestRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // --- DATA HANDLERS ---

  // Sends text to backend for AI parsing
  const handleAIParse = async () => {
    if (!emailText.trim()) {
      toast.warning("Please paste an email first.");
      return;
    }
    if (emailText.length > MAX_CHARS) {
      toast.error(`Email is too long.`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: emailText }),
      });
      const data = await res.json();

      if (res.status === 409) {
          toast.warning(`Order ${data.po?.id || ""} exists.`, {
            style: { border: '1px solid #f59e0b', color: '#f59e0b' }
          });
          setLoading(false);
          return;
      }
      if (!res.ok) {
        toast.error(data.detail || "Parse failed.");
        setLoading(false);
        return; 
      }
      
      toast.success(`Extracted: ${data.po.id}`);
      updatePOList(data.po);
      setEmailText("");
      
      // Auto-scroll to table to show result
      setTimeout(scrollToManifest, 150);

    } catch (error) { 
      toast.error("Connection error.");
    } finally { 
      setLoading(false); 
    }
  };

  // Updates local list with new or edited PO
  const updatePOList = (newPO: PO) => {
    setPos(prev => {
      const idx = prev.findIndex(p => p.id === newPO.id);
      if (idx !== -1) { 
        const c = [...prev]; c[idx] = newPO; return c; 
      }
      return [newPO, ...prev];
    });
  };

  // --- EDITING LOGIC ---

  // Enters edit mode for a specific row
  const startEditingId = (po: PO) => {
    setEditingId(po.id);
    setTempIdValue(po.id);
  };

  const cancelEditingId = () => {
    setEditingId(null);
    setTempIdValue("");
  };

  // Sends rename request (PATCH) to backend
  const saveEditingId = async (originalId: string) => {
    if (tempIdValue.length > MAX_ID_LENGTH) {
        toast.error(`ID cannot exceed ${MAX_ID_LENGTH} characters.`);
        return;
    }

    if (!tempIdValue.trim() || tempIdValue === originalId) {
      cancelEditingId();
      return;
    }

    setIsSavingId(true);
    try {
        const res = await fetch(`${API_URL}/pos/${encodeURIComponent(originalId)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: tempIdValue }),
        });
        
        const data = await res.json();

        if (res.status === 409) {
            toast.error(`ID "${tempIdValue}" already exists.`);
            setIsSavingId(false);
            return;
        }

        if (!res.ok) throw new Error();

        setPos(prev => prev.map(p => p.id === originalId ? { ...p, id: tempIdValue } : p));
        toast.success("ID Updated");
        setEditingId(null);
    } catch {
        toast.error("Failed to update ID");
    } finally {
        setIsSavingId(false);
    }
  };

  // Updates status via backend PATCH request
  const handleStatusUpdate = async (id: string, newStatus: string) => {
    const oldPos = [...pos];
    setPos(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
    toast.info(`Updating status...`);
    
    try {
      const res = await fetch(`${API_URL}/pos/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      toast.success("Status updated.");
    } catch {
      setPos(oldPos); // Revert on error
      toast.error("Failed to update status.");
    }
  };

  // --- DELETE LOGIC ---

  const confirmDelete = (id: string) => {
    setSelectedPO(id);
    setDeleteModalOpen(true);
  };

  // Executes delete API call and updates UI
  const executeDelete = async () => {
    if (!selectedPO) return;
    const oldPos = [...pos];
    setPos(prev => prev.filter(p => p.id !== selectedPO));
    setDeleteModalOpen(false); 

    try {
      const res = await fetch(`${API_URL}/pos/${encodeURIComponent(selectedPO)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success(`Deleted ${selectedPO}`);
    } catch {
      setPos(oldPos); 
      toast.error("Failed to delete.");
    }
  };

  // --- COMPUTED VALUES ---

  // Filter list based on search query and status dropdown
  const filteredPOs = useMemo(() => {
    return pos.filter(p => (statusFilter === "All" || p.status === statusFilter) && 
      (!query || JSON.stringify(p).toLowerCase().includes(query.toLowerCase()))
    );
  }, [pos, query, statusFilter]);

  // Calculate live statistics for dashboard cards
  const stats = [
    { label: "Active Orders", value: pos.length || 0, icon: Inbox, color: "text-white" },
    { label: "On Track", value: pos.filter(p => p.status === "On Track").length || 0, icon: TrendingUp, color: "text-emerald-400" },
    { label: "Critical Delays", value: pos.filter(p => p.status.includes("Delay")).length || 0, icon: AlertCircle, color: "text-rose-400" },
    { label: "Fulfilled", value: pos.filter(p => p.status === "Shipped").length || 0, icon: PackageCheck, color: "text-blue-400" },
  ];

  return (
    <div className="space-y-8 pb-[800px] relative">
      <Toaster position="top-right" theme="dark" richColors />
      
      {/* Invisible anchor for scrolling to top */}
      <div ref={topRef} className="absolute top-0 left-0 w-full h-1 pointer-events-none opacity-0" />

      {/* HEADER SECTION */}
      <header className="space-y-2 pt-0 relative z-10">
        <h1 
            onClick={scrollToDashboard}
            className="text-4xl md:text-5xl font-black tracking-tighter text-white drop-shadow-2xl leading-[0.95] cursor-pointer group flex items-center gap-4 w-fit select-none"
            title="Scroll to Top"
        >
          Purchase <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-cyan-400 to-emerald-400">Command Center</span>
          <ArrowUpToLine className="w-8 h-8 text-slate-600 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0" />
        </h1>
      </header>

      {/* MAIN GRID LAYOUT */}
      <div className="grid lg:grid-cols-12 gap-6 items-stretch">
        
        {/* LEFT COLUMN: PARSER INPUT */}
        <div className="lg:col-span-8 space-y-3 flex flex-col">
           <div className="flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-indigo-400" />
              <h2 className="text-2xl font-black text-white">Parser Engine</h2>
           </div>
           
           <GlassCard className={cn("transition-all duration-500 flex-1 flex flex-col", focusedInput && "ring-1 ring-indigo-500 shadow-[0_0_40px_-10px_rgba(99,102,241,0.3)]")}>
            <div className="bg-[#0B1120] flex-1 flex flex-col relative">
              <textarea
                value={emailText}
                onFocus={() => setFocusedInput(true)}
                onBlur={() => setFocusedInput(false)}
                onChange={(e) => setEmailText(e.target.value)}
                placeholder="Paste a supplier email..."
                className="w-full flex-1 min-h-[220px] bg-transparent border-none p-4 font-mono text-sm text-indigo-100 focus:ring-0 resize-none placeholder:text-slate-700 leading-relaxed selection:bg-indigo-500/30"
              />
              {/* Character counter */}
              <div className={cn("absolute bottom-2 right-4 text-[10px] font-mono font-bold tracking-wider", emailText.length > MAX_CHARS ? "text-rose-500" : "text-slate-600")}>
                  {emailText.length} / {MAX_CHARS} CHARS
              </div>
            </div>
            
            {/* Extraction Button */}
            <div className="p-3 border-t border-white/5 bg-slate-900/80 backdrop-blur">
               <button 
                onClick={handleAIParse} 
                disabled={loading} 
                className={cn("group w-full py-2.5 hover:bg-indigo-50 text-white hover:bg-indigo-500 font-extrabold text-sm rounded-lg shadow-xl transition-all flex items-center justify-center gap-2 relative overflow-hidden", emailText.length > MAX_CHARS ? "bg-slate-500 opacity-50 cursor-not-allowed" : "bg-indigo-600")}
               >
                 {emailText.length <= MAX_CHARS && (<div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:animate-shimmer" />)}
                 {loading ? <Loader2 className="animate-spin w-4 h-4 text-indigo-200" /> : <Sparkles className="w-4 h-4 text-indigo-200" />}
                 {loading ? "Processing..." : emailText.length > MAX_CHARS ? "Input Too Long" : "Run Extraction"}
               </button>
            </div>
          </GlassCard>
        </div>

        {/* RIGHT COLUMN: METRICS CARDS */}
        <div className="lg:col-span-4 space-y-3 flex flex-col">
           <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <h2 className="text-2xl font-black text-white">Metrics</h2>
           </div>
           
           <div className="grid grid-cols-2 gap-3 flex-1 content-start">
            {stats.map((stat, i) => (
              <GlassCard key={i} className="px-4 py-4 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300 flex flex-col justify-between h-32">
                 <div className="relative z-10 flex flex-col gap-2">
                    <stat.icon className="w-5 h-5 opacity-70 text-slate-400" />
                    <div className="text-sm font-bold uppercase tracking-wider text-slate-400">{stat.label}</div>
                 </div>
                 <div className="relative z-10">
                    <span className="text-3xl font-black text-white tracking-tighter">{stat.value}</span>
                 </div>
                 {/* Decorative background icon */}
                 <div className="absolute -right-2 -bottom-2 opacity-5 group-hover:opacity-10 transition-opacity transform scale-150 rotate-12">
                    <stat.icon className="w-16 h-16" />
                 </div>
                 {/* Color bar indicator */}
                 <div className={cn("absolute bottom-0 left-0 h-1 w-full opacity-60", stat.label.includes("Delay") ? "bg-rose-500" : stat.label.includes("Track") ? "bg-emerald-500" : stat.label.includes("Fulfilled") ? "bg-blue-500" : "bg-indigo-500")} />
              </GlassCard>
            ))}
           </div>
        </div>
      </div>

      {/* TABLE SECTION */}
      <div 
        id="manifest" 
        ref={manifestRef} 
        // scroll-mt-32 adds padding when scrolling to this element
        className="scroll-mt-32 mt-6 space-y-4"
      >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            {/* Clickable Header for scrolling */}
            <div 
                onClick={scrollToManifest}
                className="flex items-center gap-4 cursor-pointer group select-none"
                title="Scroll to Manifest"
            >
               <div className="h-10 w-2 bg-gradient-to-b from-cyan-400 to-blue-500 rounded-full shadow-[0_0_20px_rgba(6,182,212,0.6)]" />
               <div className="flex items-center gap-2">
                   <h2 className="text-3xl font-black text-white tracking-tight">Live Manifest</h2>
                   <ArrowDownToLine className="w-5 h-5 text-slate-600 opacity-0 group-hover:opacity-100 transition-all -translate-y-2 group-hover:translate-y-0" />
               </div>
            </div>
            
            {/* Search Bar */}
            <div className="relative group w-full md:w-96">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                <input 
                  value={query} 
                  onChange={e => setQuery(e.target.value)} 
                  placeholder="Search ID, Supplier or Items..." 
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-white/10 rounded-xl text-base text-white focus:ring-1 focus:ring-cyan-400/50 focus:border-cyan-400/50 transition-all shadow-inner" 
                />
            </div>
          </div>
          
          <GlassCard allowOverflow={true} className="flex flex-col border-t-4 border-t-cyan-500/20">
            <div className="w-full overflow-visible">
               <table className="w-full text-left border-collapse">
                  <thead>
                     <tr className="bg-slate-950/30 border-b border-white/10">
                        <th className="px-4 py-5 text-lg font-black text-white uppercase tracking-wider whitespace-nowrap">PO ID</th>
                        <th className="px-4 py-5 text-lg font-black text-white uppercase tracking-wider">Supplier</th>
                        <th className="px-4 py-5 text-lg font-black text-white uppercase tracking-wider">Items</th>
                        <th className="px-4 py-5 text-lg font-black text-white uppercase tracking-wider whitespace-nowrap">Expected Date</th>
                        <th className="px-4 py-5 text-lg font-black text-white uppercase tracking-wider whitespace-nowrap">Status</th>
                        <th className="px-4 py-5 text-lg font-black text-white uppercase tracking-wider text-left whitespace-nowrap">Last Updated</th>
                        <th className="w-16"></th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                     <AnimatePresence>
                        {filteredPOs.length === 0 ? (
                           <tr>
                             <td colSpan={7} className="py-20 text-center">
                               <div className="flex flex-col items-center">
                                 <Inbox className="w-12 h-12 text-slate-600 mb-4" />
                                 <p className="text-xl font-medium text-slate-400">No active orders found</p>
                               </div>
                             </td>
                           </tr>
                        ) : (
                           filteredPOs.map((po, i) => (
                              <motion.tr 
                                key={po.id} 
                                initial={{ opacity: 0, x: -10 }} 
                                animate={{ opacity: 1, x: 0 }} 
                                transition={{ delay: i * 0.05 }}
                                style={{ zIndex: filteredPOs.length - i }}
                                className="group hover:bg-white/[0.02] transition-colors duration-200 relative"
                              >
                                 {/* ID Column with Inline Edit */}
                                 <td className="px-4 py-4 text-sm font-bold text-cyan-300 whitespace-nowrap align-top group/id-cell">
                                   {editingId === po.id ? (
                                     <div className="flex items-center gap-1">
                                       <input 
                                         autoFocus
                                         value={tempIdValue}
                                         onChange={(e) => setTempIdValue(e.target.value)}
                                         className="w-24 bg-slate-950 border border-cyan-500/50 rounded px-1 py-0.5 text-xs text-white focus:outline-none"
                                       />
                                       <button onClick={() => saveEditingId(po.id)} disabled={isSavingId} className="p-1 hover:bg-emerald-500/20 text-emerald-400 rounded"><Check className="w-3 h-3" /></button>
                                       <button onClick={cancelEditingId} className="p-1 hover:bg-rose-500/20 text-rose-400 rounded"><X className="w-3 h-3" /></button>
                                     </div>
                                   ) : (
                                     <div className="flex items-center gap-2 group/id">
                                       <span>{po.id}</span>
                                       <button 
                                         onClick={() => startEditingId(po)} 
                                         className="p-1 hover:bg-white/10 rounded opacity-100 transition-opacity"
                                         title="Edit ID"
                                       >
                                         <Pencil className="w-3 h-3 text-slate-600 hover:text-white" />
                                       </button>
                                     </div>
                                   )}
                                 </td>
                                 
                                 {/* Data Columns */}
                                 <td className="px-4 py-4 text-sm font-bold text-white whitespace-normal break-words max-w-[200px] leading-tight align-top">{po.supplier}</td>
                                 <td className="px-4 py-4 text-sm font-medium text-slate-300 whitespace-normal break-words max-w-[240px] leading-snug align-top">{po.items}</td>
                                 <td className="px-4 py-4 text-sm font-medium text-slate-300 tracking-wide whitespace-nowrap align-top">{po.expected_date}</td>
                                 
                                 {/* Status Dropdown */}
                                 <td className="px-4 py-4 whitespace-nowrap relative align-top">
                                    <StatusSelect 
                                      currentStatus={po.status} 
                                      onChange={(newStatus) => handleStatusUpdate(po.id, newStatus)} 
                                    />
                                 </td>
                                 
                                 <td className="px-4 py-4 text-sm font-medium text-slate-500 whitespace-nowrap text-left align-top">{po.last_updated || "Just now"}</td>
                                 
                                 {/* Delete Action */}
                                 <td className="px-4 py-4 text-right whitespace-nowrap align-top">
                                   <button 
                                     onClick={() => confirmDelete(po.id)} 
                                     className="p-3 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                                   >
                                     <Trash2 className="w-5 h-5" />
                                   </button>
                                 </td>
                              </motion.tr>
                           ))
                        )}
                     </AnimatePresence>
                  </tbody>
               </table>
            </div>
          </GlassCard>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteModalOpen && selectedPO && (
          <DeleteConfirmationModal 
            isOpen={deleteModalOpen} 
            poId={selectedPO} 
            onClose={() => setDeleteModalOpen(false)} 
            onConfirm={executeDelete} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}