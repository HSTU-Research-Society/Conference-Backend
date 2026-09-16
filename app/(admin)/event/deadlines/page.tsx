"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { 
  collection, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  doc, 
  writeBatch,
  query
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  Trash2, 
  Edit2, 
  Plus, 
  Search, 
  CheckSquare, 
  Square, 
  MinusSquare, 
  X, 
  AlertCircle,
  ArrowUp,
  ArrowDown,
  ArrowUpToLine,
  ArrowDownToLine,
  Calendar,
  Clock,
  Sparkles,
  Send,
  CheckCircle2,
  FileText,
  Award,
  Flag,
  Bell,
  Bookmark,
  Users,
  Globe,
  GraduationCap,
  Copy,
  Check,
  Download,
  RotateCcw,
  SlidersHorizontal,
  Layers,
  CalendarCheck
} from "lucide-react";

export type MilestoneStatus = "completed" | "upcoming" | "deadline" | "highlight";

export interface Milestone {
  id: string;
  title: string;
  date: string;
  time?: string;
  isoDate: string;
  description: string;
  status: MilestoneStatus;
  icon: string;
  order: number;
  createdAt?: number;
  updatedAt?: number;
}

// Visual icons available in the conference template
const ICON_OPTIONS = [
  { name: "Sparkles", label: "Sparkles", desc: "Launch / Announcement", icon: Sparkles },
  { name: "Send", label: "Send", desc: "Submissions Open", icon: Send },
  { name: "AlertCircle", label: "Alert Circle", desc: "Submission Deadline", icon: AlertCircle },
  { name: "CheckCircle2", label: "Check Circle", desc: "Acceptance / Approval", icon: CheckCircle2 },
  { name: "FileText", label: "File Text", desc: "Full Paper / Camera Ready", icon: FileText },
  { name: "Award", label: "Award", desc: "Registration / Awards", icon: Award },
  { name: "Flag", label: "Flag", desc: "Conference Date / Milestones", icon: Flag },
  { name: "Calendar", label: "Calendar", desc: "General Schedule", icon: Calendar },
  { name: "Clock", label: "Clock", desc: "Time Cutoff", icon: Clock },
  { name: "Bell", label: "Bell", desc: "Notice / Alert", icon: Bell },
  { name: "Bookmark", label: "Bookmark", desc: "Key Session", icon: Bookmark },
  { name: "Users", label: "Users", desc: "Committee / Keynotes", icon: Users },
  { name: "Globe", label: "Globe", desc: "Virtual / International", icon: Globe },
  { name: "GraduationCap", label: "Graduation", desc: "Academic Session", icon: GraduationCap },
];

// 9 Standard Milestones from ICTSET 2027
const DEFAULT_ICTSET_MILESTONES: Omit<Milestone, "createdAt" | "updatedAt">[] = [
  {
    id: "announcement",
    title: "Event Announcement Date",
    date: "October 15, 2026",
    time: "10:00 AM UTC",
    isoDate: "20261015T100000Z",
    description: "Official launch of ICTSET 2027, website unveiling, tracks disclosure, and initial call for committee members.",
    status: "completed",
    icon: "Sparkles",
    order: 1,
  },
  {
    id: "abstract-start",
    title: "Abstract Submission Commencement",
    date: "November 01, 2026",
    time: "00:00 UTC",
    isoDate: "20261101T000000Z",
    description: "Portal opens for initial abstract proposals, extended summaries, and thematic track submissions.",
    status: "upcoming",
    icon: "Send",
    order: 2,
  },
  {
    id: "abstract-deadline",
    title: "Abstract Submission Deadline",
    date: "December 15, 2026",
    time: "23:59 UTC",
    isoDate: "20261215T235900Z",
    description: "Strict cutoff for all initial abstract submissions through the online conference portal.",
    status: "deadline",
    icon: "AlertCircle",
    order: 3,
  },
  {
    id: "abstract-acceptance",
    title: "Abstract Acceptance Notification",
    date: "January 10, 2027",
    time: "18:00 UTC",
    isoDate: "20270110T180000Z",
    description: "Authors will receive peer review feedback and decisions regarding their abstract proposals.",
    status: "upcoming",
    icon: "CheckCircle2",
    order: 4,
  },
  {
    id: "full-paper-start",
    title: "Full Paper Submission Commencement",
    date: "January 15, 2027",
    time: "00:00 UTC",
    isoDate: "20270115T000000Z",
    description: "Submission system opens for full manuscripts adhering to official conference formatting templates.",
    status: "upcoming",
    icon: "FileText",
    order: 5,
  },
  {
    id: "full-paper-deadline",
    title: "Full Paper Submission Deadline",
    date: "March 01, 2027",
    time: "23:59 UTC",
    isoDate: "20270301T235900Z",
    description: "Final deadline for full research papers, technical reports, and survey submissions.",
    status: "deadline",
    icon: "AlertCircle",
    order: 6,
  },
  {
    id: "registration-deadline",
    title: "Registration Deadline",
    date: "March 25, 2027",
    time: "23:59 UTC",
    isoDate: "20270325T235900Z",
    description: "Early bird and author registration deadline to guarantee inclusion in the official conference proceedings.",
    status: "deadline",
    icon: "Award",
    order: 7,
  },
  {
    id: "camera-ready",
    title: "Camera Ready Submission Deadline",
    date: "April 10, 2027",
    time: "23:59 UTC",
    isoDate: "20270410T235900Z",
    description: "Final submission of revised papers incorporating reviewer feedback with copyright authorization.",
    status: "deadline",
    icon: "FileText",
    order: 8,
  },
  {
    id: "conference-date",
    title: "Conference Date",
    date: "May 14 – 16, 2027",
    time: "09:00 AM UTC",
    isoDate: "20270514T090000Z",
    description: "Inaugural edition of ICTSET 2027 featuring keynote addresses, technical oral sessions, and workshop tracks.",
    status: "highlight",
    icon: "Flag",
    order: 9,
  },
];

const STATUS_CONFIG: Record<MilestoneStatus, { label: string; badgeClass: string; dotClass: string; bgSoft: string }> = {
  completed: {
    label: "Completed",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dotClass: "bg-emerald-500",
    bgSoft: "bg-emerald-500/10",
  },
  upcoming: {
    label: "Upcoming",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    dotClass: "bg-blue-500",
    bgSoft: "bg-blue-500/10",
  },
  deadline: {
    label: "Deadline",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
    dotClass: "bg-rose-500",
    bgSoft: "bg-rose-500/10",
  },
  highlight: {
    label: "Highlight",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    dotClass: "bg-amber-500",
    bgSoft: "bg-amber-500/10",
  },
};

function renderMilestoneIcon(iconName: string, className: string = "w-5 h-5") {
  const match = ICON_OPTIONS.find(i => i.name.toLowerCase() === (iconName || "").toLowerCase());
  const IconComp = match ? match.icon : Calendar;
  return <IconComp className={className} />;
}

// Slug generator
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Convert date + time inputs to iCalendar compact ISO string (YYYYMMDDTHHMMSSZ)
function computeIsoDateString(rawDate: string, rawTime: string): string {
  if (!rawDate) return "";
  try {
    const parts = rawDate.split("-");
    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1].padStart(2, "0");
      const day = parts[2].padStart(2, "0");
      let hours = "00";
      let minutes = "00";
      if (rawTime) {
        const timeParts = rawTime.split(":");
        if (timeParts.length >= 2) {
          hours = timeParts[0].padStart(2, "0");
          minutes = timeParts[1].padStart(2, "0");
        }
      }
      return `${year}${month}${day}T${hours}${minutes}00Z`;
    }
  } catch {
    // fallback
  }
  return "";
}

export default function DeadlinesPage() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Reorder loading
  const [isReordering, setIsReordering] = useState(false);
  const [orderActionLoading, setOrderActionLoading] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    id: "",
    title: "",
    date: "",
    time: "",
    isoDate: "",
    description: "",
    status: "upcoming" as MilestoneStatus,
    icon: "Calendar",
    order: 1,
  });

  // Optional helper fields for date picker convenience
  const [pickerDate, setPickerDate] = useState("");
  const [pickerTime, setPickerTime] = useState("");

  const fetchMilestones = useCallback(async () => {
    setLoading(true);
    try {
      // Check primary "milestones", fallback to "deadlines"
      let snap = await getDocs(query(collection(db, "milestones")));
      if (snap.empty) {
        snap = await getDocs(query(collection(db, "deadlines")));
      }

      const list = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: data.id || d.id,
          title: data.title || "",
          date: data.date || "",
          time: data.time || "",
          isoDate: data.isoDate || "",
          description: data.description || "",
          status: (data.status as MilestoneStatus) || "upcoming",
          icon: data.icon || "Calendar",
          order: typeof data.order === "number" ? data.order : 999,
          createdAt: data.createdAt || 0,
          updatedAt: data.updatedAt || 0,
        } as Milestone;
      });

      // Sort by order ascending, then by createdAt
      list.sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return (a.createdAt || 0) - (b.createdAt || 0);
      });

      setMilestones(list);
      setError(null);
    } catch (err: any) {
      console.error("Error fetching milestones:", err);
      setError(err.message || "Failed to load milestones. Check database permissions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMilestones();
  }, [fetchMilestones]);

  // Filtered milestones
  const filteredMilestones = useMemo(() => {
    return milestones.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (item.title || "").toLowerCase().includes(q);
        const matchId = (item.id || "").toLowerCase().includes(q);
        const matchDate = (item.date || "").toLowerCase().includes(q);
        const matchDesc = (item.description || "").toLowerCase().includes(q);
        return matchTitle || matchId || matchDate || matchDesc;
      }
      return true;
    });
  }, [milestones, statusFilter, searchQuery]);

  // Persist updated array order to Firestore
  const persistOrder = async (updatedList: Milestone[]) => {
    setIsReordering(true);
    try {
      const batch = writeBatch(db);
      updatedList.forEach((item, index) => {
        const newOrder = index + 1;
        const itemRef1 = doc(db, "milestones", item.id);
        const itemRef2 = doc(db, "deadlines", item.id);
        batch.update(itemRef1, { order: newOrder, updatedAt: Date.now() });
        batch.update(itemRef2, { order: newOrder, updatedAt: Date.now() });
      });
      await batch.commit();
      setMilestones(updatedList.map((m, idx) => ({ ...m, order: idx + 1 })));
    } catch (err: any) {
      console.error("Error saving new order:", err);
      alert("Failed to update milestone order: " + err.message);
      fetchMilestones();
    } finally {
      setIsReordering(false);
      setOrderActionLoading(null);
    }
  };

  // Move 1 position up or down
  const handleMoveMilestone = async (id: string, direction: "up" | "down", e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isReordering) return;

    const currentIndex = milestones.findIndex((m) => m.id === id);
    if (currentIndex === -1) return;
    if (direction === "up" && currentIndex === 0) return;
    if (direction === "down" && currentIndex === milestones.length - 1) return;

    setOrderActionLoading(id);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    const reordered = [...milestones];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    await persistOrder(reordered);
  };

  // Move directly to top
  const handleMoveToTop = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isReordering) return;
    const currentIndex = milestones.findIndex((m) => m.id === id);
    if (currentIndex <= 0) return;

    setOrderActionLoading(id);
    const reordered = [...milestones];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.unshift(moved);

    await persistOrder(reordered);
  };

  // Move directly to bottom
  const handleMoveToBottom = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isReordering) return;
    const currentIndex = milestones.findIndex((m) => m.id === id);
    if (currentIndex === -1 || currentIndex === milestones.length - 1) return;

    setOrderActionLoading(id);
    const reordered = [...milestones];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.push(moved);

    await persistOrder(reordered);
  };

  // Selection handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const handleSelectAllVisible = () => {
    const visibleIds = filteredMilestones.map((m) => m.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to permanently delete ${selectedIds.length} milestone(s)?`)) return;

    setBulkLoading(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach((id) => {
        batch.delete(doc(db, "milestones", id));
        batch.delete(doc(db, "deadlines", id));
      });
      await batch.commit();

      setMilestones((prev) => prev.filter((m) => !selectedIds.includes(m.id)));
      setSelectedIds([]);
      alert(`Deleted ${selectedIds.length} milestone(s) successfully.`);
    } catch (err: any) {
      console.error("Bulk delete error:", err);
      alert("Failed to delete milestones: " + err.message);
    } finally {
      setBulkLoading(false);
    }
  };

  // Bulk status update
  const handleBulkStatusChange = async (newStatus: MilestoneStatus) => {
    if (selectedIds.length === 0) return;
    setBulkLoading(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach((id) => {
        batch.update(doc(db, "milestones", id), { status: newStatus, updatedAt: Date.now() });
        batch.update(doc(db, "deadlines", id), { status: newStatus, updatedAt: Date.now() });
      });
      await batch.commit();

      setMilestones((prev) =>
        prev.map((m) => (selectedIds.includes(m.id) ? { ...m, status: newStatus } : m))
      );
      setSelectedIds([]);
      alert(`Updated ${selectedIds.length} milestone(s) to "${STATUS_CONFIG[newStatus].label}".`);
    } catch (err: any) {
      console.error("Bulk status error:", err);
      alert("Failed to update milestones: " + err.message);
    } finally {
      setBulkLoading(false);
    }
  };

  // Quick toggle single milestone status
  const handleQuickStatusCycle = async (milestone: Milestone, e: React.MouseEvent) => {
    e.stopPropagation();
    const cycleOrder: MilestoneStatus[] = ["upcoming", "deadline", "completed", "highlight"];
    const nextIndex = (cycleOrder.indexOf(milestone.status) + 1) % cycleOrder.length;
    const nextStatus = cycleOrder[nextIndex];

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "milestones", milestone.id), { status: nextStatus, updatedAt: Date.now() });
      batch.update(doc(db, "deadlines", milestone.id), { status: nextStatus, updatedAt: Date.now() });
      await batch.commit();

      setMilestones((prev) =>
        prev.map((m) => (m.id === milestone.id ? { ...m, status: nextStatus } : m))
      );
    } catch (err: any) {
      console.error("Error cycling status:", err);
      alert("Failed to update status: " + err.message);
    }
  };

  // Open modal for Create
  const handleOpenCreateModal = () => {
    setEditingId(null);
    setPickerDate("");
    setPickerTime("");
    setFormData({
      id: "",
      title: "",
      date: "",
      time: "23:59 UTC",
      isoDate: "",
      description: "",
      status: "upcoming",
      icon: "Calendar",
      order: milestones.length + 1,
    });
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEditModal = (item: Milestone) => {
    setEditingId(item.id);
    setPickerDate("");
    setPickerTime("");
    setFormData({
      id: item.id,
      title: item.title,
      date: item.date,
      time: item.time || "",
      isoDate: item.isoDate || "",
      description: item.description || "",
      status: item.status,
      icon: item.icon || "Calendar",
      order: item.order || 1,
    });
    setIsModalOpen(true);
  };

  // Handle title change with auto slug suggestion
  const handleTitleChange = (val: string) => {
    const updated: any = { title: val };
    if (!editingId && (!formData.id || formData.id === slugify(formData.title))) {
      updated.id = slugify(val);
    }
    setFormData((prev) => ({ ...prev, ...updated }));
  };

  // Helper to sync picker date to human-readable date & isoDate
  const handlePickerDateApply = () => {
    if (!pickerDate) return;
    try {
      const [y, m, d] = pickerDate.split("-").map(Number);
      const dateObj = new Date(y, m - 1, d);
      const formatted = dateObj.toLocaleDateString("en-US", {
        month: "long",
        day: "2-digit",
        year: "numeric",
      });

      const computedIso = computeIsoDateString(pickerDate, pickerTime || "00:00");
      const formattedTime = pickerTime ? `${pickerTime} UTC` : formData.time || "23:59 UTC";

      setFormData((prev) => ({
        ...prev,
        date: formatted,
        time: formattedTime,
        isoDate: computedIso || prev.isoDate,
      }));
    } catch {
      // ignore
    }
  };

  // Save Milestone
  const handleSaveMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalId = (formData.id || slugify(formData.title)).trim();
    if (!finalId) {
      alert("Milestone Identifier (Slug ID) is required.");
      return;
    }
    if (!formData.title.trim()) {
      alert("Title is required.");
      return;
    }
    if (!formData.date.trim()) {
      alert("Date is required.");
      return;
    }

    setSaving(true);
    try {
      const payload: Milestone = {
        id: finalId,
        title: formData.title.trim(),
        date: formData.date.trim(),
        time: formData.time.trim() || undefined,
        isoDate: formData.isoDate.trim() || (finalId.includes("T") ? finalId : "20261015T100000Z"),
        description: formData.description.trim(),
        status: formData.status,
        icon: formData.icon || "Calendar",
        order: Number(formData.order) || milestones.length + 1,
        createdAt: editingId ? (milestones.find((m) => m.id === editingId)?.createdAt || Date.now()) : Date.now(),
        updatedAt: Date.now(),
      };

      // If ID changed during edit, clean up previous doc
      if (editingId && editingId !== finalId) {
        await deleteDoc(doc(db, "milestones", editingId));
        await deleteDoc(doc(db, "deadlines", editingId));
      }

      // Sync write to both collections
      await setDoc(doc(db, "milestones", finalId), payload);
      await setDoc(doc(db, "deadlines", finalId), payload);

      setIsModalOpen(false);
      fetchMilestones();
    } catch (err: any) {
      console.error("Error saving milestone:", err);
      alert("Failed to save milestone: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Delete single milestone
  const handleDeleteMilestone = async (id: string) => {
    if (!confirm(`Are you sure you want to permanently delete milestone "${id}"?`)) return;
    try {
      await deleteDoc(doc(db, "milestones", id));
      await deleteDoc(doc(db, "deadlines", id));
      setMilestones((prev) => prev.filter((m) => m.id !== id));
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    } catch (err: any) {
      alert("Failed to delete milestone: " + err.message);
    }
  };

  // Seed Default Milestones (ICTSET 2027)
  const handleSeedDefaults = async () => {
    if (milestones.length > 0) {
      if (!confirm("This will load the 9 standard ICTSET 2027 milestones into your database. Existing milestones with matching IDs will be refreshed. Continue?")) {
        return;
      }
    }

    setLoading(true);
    try {
      const batch = writeBatch(db);
      const now = Date.now();

      DEFAULT_ICTSET_MILESTONES.forEach((item) => {
        const payload: Milestone = {
          ...item,
          createdAt: now,
          updatedAt: now,
        };
        batch.set(doc(db, "milestones", item.id), payload);
        batch.set(doc(db, "deadlines", item.id), payload);
      });

      await batch.commit();
      alert("Successfully seeded ICTSET 2027 conference milestones!");
      fetchMilestones();
    } catch (err: any) {
      console.error("Error seeding milestones:", err);
      alert("Failed to seed milestones: " + err.message);
      setLoading(false);
    }
  };

  // Export JSON (for frontend code or backup)
  const handleExportJSON = () => {
    const exportData = milestones.map(({ id, title, date, time, isoDate, description, status, icon }) => ({
      id,
      title,
      date,
      ...(time ? { time } : {}),
      isoDate,
      description,
      status,
      icon,
    }));

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `conference-milestones-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Copy TypeScript code snippet
  const handleCopyCodeSnippet = () => {
    const cleanList = milestones.map((m) => `  {
    id: '${m.id}',
    title: '${m.title.replace(/'/g, "\\'")}',
    date: '${m.date.replace(/'/g, "\\'")}',
    ${m.time ? `time: '${m.time.replace(/'/g, "\\'")}',\n    ` : ""}isoDate: '${m.isoDate}',
    description: '${m.description.replace(/'/g, "\\'")}',
    status: '${m.status}',
    icon: ${m.icon},
  }`).join(",\n");

    const tsSnippet = `export interface Milestone {
  id: string;
  title: string;
  date: string;
  time?: string;
  isoDate: string;
  description: string;
  status: 'completed' | 'upcoming' | 'deadline' | 'highlight';
  icon: typeof Calendar;
}

export const MILESTONES: Milestone[] = [
${cleanList}
];`;

    navigator.clipboard.writeText(tsSnippet);
    setCopiedId("ts-snippet");
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="flex flex-col h-full font-inter">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-2xl lg:text-3xl font-montserrat font-bold text-[#0F172A] tracking-tight">
                Event Deadlines & Milestones
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Manage timeline dates, cutoff times, calendar exports, and status badges for <span className="font-semibold text-slate-700">/events/deadlines</span>.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleExportJSON}
            disabled={milestones.length === 0}
            className="h-11 px-4 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
            title="Download JSON array"
          >
            <Download className="w-4 h-4 text-slate-500" />
            Export JSON
          </button>

          <button
            type="button"
            onClick={handleCopyCodeSnippet}
            disabled={milestones.length === 0}
            className="h-11 px-4 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
            title="Copy TypeScript snippet"
          >
            {copiedId === "ts-snippet" ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <Copy className="w-4 h-4 text-slate-500" />
            )}
            {copiedId === "ts-snippet" ? "Copied TS Code" : "Copy TS Code"}
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="h-11 px-5 rounded-xl bg-[#F59E0B] text-white font-semibold text-xs flex items-center gap-2 hover:scale-[1.02] shadow-[0_10px_30px_rgba(245,158,11,0.25)] transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Milestone
          </button>
        </div>
      </div>

      {/* Database error alert if any */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl mb-4 text-sm shrink-0 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Control Bar: Filters, Search, and Bulk Actions */}
      <div className="bg-white/70 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-4 mb-5 shrink-0 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by title, slug, date, description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-hide">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline">
              Status:
            </span>
            {(["all", "upcoming", "deadline", "completed", "highlight"] as const).map((st) => {
              const isActive = statusFilter === st;
              const count = st === "all" ? milestones.length : milestones.filter((m) => m.status === st).length;
              return (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    isActive
                      ? "bg-[#0F172A] text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                  }`}
                >
                  <span className="capitalize">{st}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive ? "bg-white/20 text-white" : "bg-white text-slate-500"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selection & Bulk Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAllVisible}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 font-medium transition-colors"
            >
              {filteredMilestones.length > 0 && filteredMilestones.every((m) => selectedIds.includes(m.id)) ? (
                <CheckSquare className="w-4 h-4 text-amber-500" />
              ) : selectedIds.length > 0 ? (
                <MinusSquare className="w-4 h-4 text-amber-500" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>
                {selectedIds.length > 0 ? `${selectedIds.length} selected` : "Select All Visible"}
              </span>
            </button>

            {selectedIds.length > 0 && (
              <button
                onClick={handleClearSelection}
                className="text-slate-400 hover:text-slate-600 underline text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {selectedIds.length > 0 ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Mark Selected As:
              </span>
              {(["upcoming", "deadline", "completed", "highlight"] as MilestoneStatus[]).map((st) => (
                <button
                  key={st}
                  onClick={() => handleBulkStatusChange(st)}
                  disabled={bulkLoading}
                  className="px-2.5 py-1 rounded-md text-[11px] font-bold capitalize border bg-white hover:bg-slate-50 transition-colors shadow-2xs"
                >
                  {STATUS_CONFIG[st].label}
                </button>
              ))}

              <button
                onClick={handleBulkDelete}
                disabled={bulkLoading}
                className="px-3 py-1 rounded-md text-[11px] font-bold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete ({selectedIds.length})
              </button>
            </div>
          ) : (
            <div className="text-[11px] text-slate-400 font-medium">
              Showing {filteredMilestones.length} of {milestones.length} total milestones • Drag or use arrows to order timeline
            </div>
          )}
        </div>
      </div>

      {/* Main List Container */}
      <div className="flex-1 overflow-y-auto pb-12 space-y-3.5 pr-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-medium">Loading conference deadlines & milestones...</p>
          </div>
        ) : filteredMilestones.length === 0 ? (
          <div className="bg-white/60 backdrop-blur-md border border-slate-200/80 rounded-3xl p-12 text-center shadow-xs">
            <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-4 shadow-sm">
              <CalendarCheck className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {searchQuery ? "No matching milestones found" : "No Milestones Configured Yet"}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-6">
              {searchQuery
                ? `No milestone matches your query "${searchQuery}". Try clearing the filter.`
                : "You can create custom milestone items or load the pre-configured ICTSET 2027 conference timeline with 1-click."}
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleSeedDefaults}
                className="h-11 px-5 rounded-xl bg-[#0F172A] text-white font-semibold text-xs flex items-center gap-2 hover:bg-slate-800 transition-all shadow-sm"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                Load ICTSET 2027 Milestones (9 Items)
              </button>
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="h-11 px-5 rounded-xl bg-[#F59E0B] text-white font-semibold text-xs flex items-center gap-2 hover:scale-[1.02] shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                Create New Milestone
              </button>
            </div>
          </div>
        ) : (
          filteredMilestones.map((item, index) => {
            const isSelected = selectedIds.includes(item.id);
            const statusStyle = STATUS_CONFIG[item.status] || STATUS_CONFIG.upcoming;
            const isFirst = index === 0;
            const isLast = index === filteredMilestones.length - 1;

            return (
              <div
                key={item.id}
                className={`group relative bg-white/70 backdrop-blur-md border rounded-2xl p-4 sm:p-5 transition-all duration-200 hover:shadow-md ${
                  isSelected
                    ? "border-amber-400 bg-amber-50/40 shadow-xs"
                    : "border-slate-200/80 hover:border-slate-300"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  {/* Left: Checkbox + Sequence Number + Icon + Core Info */}
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    {/* Checkbox */}
                    <button
                      type="button"
                      onClick={() => handleToggleSelect(item.id)}
                      className="mt-1 text-slate-400 hover:text-amber-500 shrink-0 transition-colors"
                      aria-label="Select item"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-amber-500" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>

                    {/* Order Pill */}
                    <div className="hidden md:flex flex-col items-center justify-center shrink-0 w-8 h-8 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs mt-0.5" title={`Position order: #${item.order}`}>
                      #{item.order}
                    </div>

                    {/* Icon Avatar */}
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 border border-slate-200/60 shadow-2xs ${statusStyle.bgSoft} text-slate-800`}>
                      {renderMilestoneIcon(item.icon, "w-5 h-5")}
                    </div>

                    {/* Text Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap mb-1">
                        <h4 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                          {item.title}
                        </h4>

                        {/* Status Badge with Click-to-cycle */}
                        <button
                          type="button"
                          onClick={(e) => handleQuickStatusCycle(item, e)}
                          title="Click to cycle status (Upcoming -> Deadline -> Completed -> Highlight)"
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border transition-transform hover:scale-105 ${statusStyle.badgeClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dotClass}`}></span>
                          {statusStyle.label}
                        </button>

                        {/* ID tag */}
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 font-medium">
                          id: {item.id}
                        </span>
                      </div>

                      {/* Date & Time Row */}
                      <div className="flex items-center gap-4 text-xs text-slate-600 mb-2 flex-wrap font-medium">
                        <span className="flex items-center gap-1.5 text-slate-900 font-semibold">
                          <Calendar className="w-3.5 h-3.5 text-amber-500" />
                          {item.date}
                        </span>

                        {item.time && (
                          <span className="flex items-center gap-1.5 text-slate-500">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {item.time}
                          </span>
                        )}

                        {item.isoDate && (
                          <span className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px]" title="Calendar export ISO string">
                            <Flag className="w-3 h-3 text-slate-300" />
                            ISO: {item.isoDate}
                          </span>
                        )}

                        <span className="text-slate-400 text-[11px]">
                          Icon: <span className="font-semibold text-slate-600">{item.icon}</span>
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-3xl">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  {/* Right: Actions (Move up/down, Edit, Delete) */}
                  <div className="flex items-center gap-1.5 sm:self-center shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    {/* Reorder Buttons */}
                    <div className="flex items-center bg-slate-100 rounded-xl p-0.5 mr-1 border border-slate-200">
                      <button
                        type="button"
                        onClick={(e) => handleMoveToTop(item.id, e)}
                        disabled={isFirst || isReordering}
                        title="Move to top (#1)"
                        className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 rounded-lg hover:bg-white transition-all"
                      >
                        <ArrowUpToLine className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleMoveMilestone(item.id, "up", e)}
                        disabled={isFirst || isReordering}
                        title="Move Up"
                        className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 rounded-lg hover:bg-white transition-all"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleMoveMilestone(item.id, "down", e)}
                        disabled={isLast || isReordering}
                        title="Move Down"
                        className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 rounded-lg hover:bg-white transition-all"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleMoveToBottom(item.id, e)}
                        disabled={isLast || isReordering}
                        title="Move to bottom"
                        className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 rounded-lg hover:bg-white transition-all"
                      >
                        <ArrowDownToLine className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(item)}
                      className="p-2 rounded-xl text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-1 text-xs font-semibold"
                      title="Edit milestone"
                    >
                      <Edit2 className="w-4 h-4" />
                      <span className="hidden md:inline">Edit</span>
                    </button>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => handleDeleteMilestone(item.id)}
                      className="p-2 rounded-xl text-red-500 hover:bg-red-50 transition-colors flex items-center gap-1 text-xs font-semibold"
                      title="Delete milestone"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="hidden md:inline">Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-[#020617]/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 w-full max-w-2xl shadow-2xl my-8 relative animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div>
                <h3 className="text-xl font-bold font-montserrat text-[#0F172A]">
                  {editingId ? "Edit Milestone" : "Add Conference Milestone"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Populate timeline dates, badges, and export attributes for the frontend deadlines page.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMilestone} className="space-y-5">
              {/* Title & Slug ID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Milestone Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Abstract Submission Deadline"
                    value={formData.title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-[#0F172A] outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Identifier (Slug ID) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. abstract-deadline"
                    value={formData.id}
                    onChange={(e) => setFormData({ ...formData, id: slugify(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-mono text-[#0F172A] outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all"
                  />
                  <span className="text-[10px] text-slate-400">Used as the unique key in the frontend collection.</span>
                </div>
              </div>

              {/* Date & Time fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Display Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. December 15, 2026 or May 14 – 16, 2027"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-[#0F172A] outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Time (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 23:59 UTC"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-[#0F172A] outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all"
                  />
                </div>
              </div>

              {/* Date Picker Auto-Fill Helper */}
              <div className="p-3.5 bg-amber-50/60 border border-amber-200/70 rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    Quick Date & ISO Generator
                  </span>
                  <span className="text-[10px] text-amber-700">Auto-formats text & iCalendar values</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                  <input
                    type="date"
                    value={pickerDate}
                    onChange={(e) => setPickerDate(e.target.value)}
                    className="bg-white border border-amber-200 rounded-lg p-2 text-xs text-slate-700 outline-none"
                  />
                  <input
                    type="time"
                    value={pickerTime}
                    onChange={(e) => setPickerTime(e.target.value)}
                    className="bg-white border border-amber-200 rounded-lg p-2 text-xs text-slate-700 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handlePickerDateApply}
                    disabled={!pickerDate}
                    className="bg-amber-600 text-white rounded-lg p-2 text-xs font-bold hover:bg-amber-700 transition-colors disabled:opacity-40"
                  >
                    Apply to Fields
                  </button>
                </div>
              </div>

              {/* ISO Date for Calendar Export & Order */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    ISO Date (Calendar Export) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. 20261215T235900Z"
                    value={formData.isoDate}
                    onChange={(e) => setFormData({ ...formData, isoDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-mono text-[#0F172A] outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all"
                  />
                  <span className="text-[10px] text-slate-400">Used by iCalendar/Google Calendar export links (format: YYYYMMDDTHHMMSSZ).</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Sequence Order #
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.order}
                    onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 1 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-[#0F172A] outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all"
                  />
                </div>
              </div>

              {/* Status Segmented Control */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Status Category <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {(["upcoming", "deadline", "completed", "highlight"] as MilestoneStatus[]).map((st) => {
                    const isSelected = formData.status === st;
                    const style = STATUS_CONFIG[st];
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setFormData({ ...formData, status: st })}
                        className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                          isSelected
                            ? `${style.badgeClass} ring-2 ring-amber-500/30 shadow-xs font-bold`
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 font-medium"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${style.dotClass}`}></span>
                          <span className="text-xs uppercase tracking-wider">{style.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Icon Selector Grid */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Icon Selection <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-xs font-medium text-slate-500">
                    Selected: <span className="font-bold text-slate-800">{formData.icon}</span>
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl max-h-48 overflow-y-auto">
                  {ICON_OPTIONS.map((opt) => {
                    const isSelected = formData.icon.toLowerCase() === opt.name.toLowerCase();
                    const IconComp = opt.icon;
                    return (
                      <button
                        key={opt.name}
                        type="button"
                        onClick={() => setFormData({ ...formData, icon: opt.name })}
                        className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 text-center transition-all ${
                          isSelected
                            ? "bg-amber-500 text-white border-amber-600 shadow-sm font-bold"
                            : "bg-white border-slate-200/80 text-slate-700 hover:bg-slate-100"
                        }`}
                        title={`${opt.label}: ${opt.desc}`}
                      >
                        <IconComp className="w-5 h-5 shrink-0" />
                        <span className="text-[10px] truncate max-w-full">{opt.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Milestone Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Detailed instructions or description of the milestone (e.g. Strict cutoff for initial abstract proposals...)"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-[#0F172A] outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all resize-none"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 h-12 rounded-xl bg-white border border-slate-200 font-bold text-xs text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 h-12 rounded-xl bg-[#F59E0B] font-bold text-xs text-white shadow-[0_10px_30px_rgba(245,158,11,0.25)] hover:scale-[1.02] transition-all disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingId ? "Update Milestone" : "Save Milestone"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
