"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  doc, 
  query, 
  writeBatch 
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
  Eye, 
  EyeOff, 
  Globe, 
  X, 
  FileText,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ArrowUpToLine,
  ArrowDownToLine,
  User,
  Users,
  Tag,
  Clock,
  BookOpen,
  Sparkles,
  Layers,
  Mail,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Award
} from "lucide-react";

export interface AuthorItem {
  id?: string;
  name: string;
  email?: string;
  orcid?: string;
  role?: string;
  affiliation?: string;
  imageUrl?: string;
}

export interface ProceedingItem {
  id: string;
  title: string;
  slug?: string;
  authors: AuthorItem[];
  // Legacy single-author fields maintained for backwards-compatibility
  authorName?: string;
  authorEmail?: string;
  authorOrcid?: string;
  authorRole?: string;
  authorImageUrl?: string;
  articleUrl?: string; // Link to full article / paper
  category?: string;
  tags?: string[];
  readTime?: string;
  excerpt?: string;
  descriptionMarkdown: string;
  content?: string;
  coverImageUrl: string;
  displayInFrontend?: boolean;
  status?: "published" | "draft";
  order?: number;
  position?: number;
  createdAt: number;
}

const DEFAULT_AUTHOR: AuthorItem = {
  name: "",
  email: "",
  orcid: "",
  role: "Lead Author",
  affiliation: "HSTU Research Society",
  imageUrl: ""
};

export default function ProceedingsPage() {
  const [posts, setPosts] = useState<ProceedingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "visible" | "hidden">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [expandedAuthorsId, setExpandedAuthorsId] = useState<string | null>(null);
  
  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [orderActionLoading, setOrderActionLoading] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    authors: [ { ...DEFAULT_AUTHOR } ],
    articleUrl: "",
    category: "Computer Science & Engineering",
    tags: "",
    readTime: "",
    excerpt: "",
    coverImageUrl: "",
    descriptionMarkdown: "",
    displayInFrontend: true,
    order: 1,
  });

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "blogs"));
      const snapshot = await getDocs(q);
      const fetched: ProceedingItem[] = [];
      
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        
        // Parse authors array or convert legacy fields
        let authorsList: AuthorItem[] = [];
        if (Array.isArray(data.authors) && data.authors.length > 0) {
          authorsList = data.authors.map((a: any) => ({
            name: a.name || "",
            email: a.email || "",
            orcid: a.orcid || "",
            role: a.role || "",
            affiliation: a.affiliation || "",
            imageUrl: a.imageUrl || ""
          }));
        } else {
          // Backward compatibility: map single author fields
          authorsList = [{
            name: data.authorName || data.author || "HSTU Research Society",
            email: data.authorEmail || data.email || "",
            orcid: data.authorOrcid || data.orcid || "",
            role: data.authorRole || data.role || "Lead Author",
            affiliation: data.affiliation || "HSTU",
            imageUrl: data.authorImageUrl || data.imageUrl || ""
          }];
        }

        fetched.push({
          id: docSnap.id,
          title: data.title || "Untitled Paper",
          slug: data.slug || "",
          authors: authorsList,
          authorName: authorsList[0]?.name || data.authorName || "",
          authorEmail: authorsList[0]?.email || data.authorEmail || "",
          authorOrcid: authorsList[0]?.orcid || data.authorOrcid || "",
          authorRole: authorsList[0]?.role || data.authorRole || "",
          authorImageUrl: authorsList[0]?.imageUrl || data.authorImageUrl || "",
          articleUrl: data.articleUrl || data.link || data.paperUrl || "",
          category: data.category || "General",
          tags: Array.isArray(data.tags) ? data.tags : [],
          readTime: data.readTime || "",
          excerpt: data.excerpt || "",
          descriptionMarkdown: data.descriptionMarkdown || data.content || "",
          coverImageUrl: data.coverImageUrl || "",
          displayInFrontend: data.displayInFrontend !== undefined ? data.displayInFrontend : true,
          status: data.status || "published",
          order: typeof data.order === "number" ? data.order : 9999,
          position: typeof data.position === "number" ? data.position : (typeof data.order === "number" ? data.order : 9999),
          createdAt: data.createdAt || Date.now(),
        });
      });

      // Sort by order ascending
      fetched.sort((a, b) => {
        const orderA = a.position !== undefined ? a.position : (a.order !== undefined ? a.order : 9999);
        const orderB = b.position !== undefined ? b.position : (b.order !== undefined ? b.order : 9999);
        if (orderA !== orderB) return orderA - orderB;
        return b.createdAt - a.createdAt;
      });

      // Normalize sequence to clean integers 1..N
      const normalized = fetched.map((item, idx) => ({
        ...item,
        order: idx + 1,
        position: idx + 1
      }));

      setPosts(normalized);
      setError(null);
    } catch (err: any) {
      console.error("Error fetching proceedings:", err);
      setError("Failed to load proceedings. Check connection or Firestore security rules.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Persist reordered positions
  const persistOrder = async (updatedPosts: ProceedingItem[]) => {
    setIsReordering(true);
    try {
      const batch = writeBatch(db);
      updatedPosts.forEach((p, idx) => {
        const docRef = doc(db, "blogs", p.id);
        batch.update(docRef, { 
          order: idx + 1,
          position: idx + 1 
        });
      });
      await batch.commit();
    } catch (err: any) {
      console.error("Error updating order batch:", err);
      setError("Failed to persist reordering to database.");
      fetchPosts();
    } finally {
      setIsReordering(false);
      setOrderActionLoading(null);
    }
  };

  // Move a post up or down
  const handleMovePost = async (postId: string, direction: "up" | "down", e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isReordering) return;

    const currentIndex = posts.findIndex(p => p.id === postId);
    if (currentIndex === -1) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= posts.length) return;

    setOrderActionLoading(postId);

    const reordered = [...posts];
    const [movedPost] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, movedPost);

    const normalized = reordered.map((p, idx) => ({ ...p, order: idx + 1, position: idx + 1 }));
    setPosts(normalized);

    await persistOrder(normalized);
  };

  // Move a post directly to Top (#1)
  const handleMoveToTop = async (postId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isReordering) return;

    const currentIndex = posts.findIndex(p => p.id === postId);
    if (currentIndex <= 0) return;

    setOrderActionLoading(postId);

    const reordered = [...posts];
    const [movedPost] = reordered.splice(currentIndex, 1);
    reordered.unshift(movedPost);

    const normalized = reordered.map((p, idx) => ({ ...p, order: idx + 1, position: idx + 1 }));
    setPosts(normalized);

    await persistOrder(normalized);
  };

  // Move a post directly to Bottom (Last #)
  const handleMoveToBottom = async (postId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isReordering) return;

    const currentIndex = posts.findIndex(p => p.id === postId);
    if (currentIndex === -1 || currentIndex === posts.length - 1) return;

    setOrderActionLoading(postId);

    const reordered = [...posts];
    const [movedPost] = reordered.splice(currentIndex, 1);
    reordered.push(movedPost);

    const normalized = reordered.map((p, idx) => ({ ...p, order: idx + 1, position: idx + 1 }));
    setPosts(normalized);

    await persistOrder(normalized);
  };

  // Set explicit custom position rank
  const handleSetCustomPosition = async (postId: string, targetRank: number) => {
    if (isNaN(targetRank) || targetRank < 1 || targetRank > posts.length) {
      return;
    }
    const currentIndex = posts.findIndex(p => p.id === postId);
    if (currentIndex === -1 || currentIndex === targetRank - 1) return;

    setOrderActionLoading(postId);

    const reordered = [...posts];
    const [movedPost] = reordered.splice(currentIndex, 1);
    reordered.splice(targetRank - 1, 0, movedPost);

    const normalized = reordered.map((p, idx) => ({ ...p, order: idx + 1, position: idx + 1 }));
    setPosts(normalized);

    await persistOrder(normalized);
  };

  // Authors state helpers in Modal Form
  const handleAddAuthor = () => {
    setFormData(prev => ({
      ...prev,
      authors: [
        ...prev.authors,
        {
          name: "",
          email: "",
          orcid: "",
          role: "Co-Author",
          affiliation: "",
          imageUrl: ""
        }
      ]
    }));
  };

  const handleRemoveAuthor = (index: number) => {
    if (formData.authors.length <= 1) {
      alert("A proceeding paper must have at least one author.");
      return;
    }
    setFormData(prev => ({
      ...prev,
      authors: prev.authors.filter((_, idx) => idx !== index)
    }));
  };

  const handleUpdateAuthor = (index: number, field: keyof AuthorItem, value: string) => {
    setFormData(prev => {
      const updated = [...prev.authors];
      updated[index] = {
        ...updated[index],
        [field]: value
      };
      return { ...prev, authors: updated };
    });
  };

  const handleMoveAuthor = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= formData.authors.length) return;

    setFormData(prev => {
      const updated = [...prev.authors];
      const [item] = updated.splice(index, 1);
      updated.splice(targetIndex, 0, item);
      return { ...prev, authors: updated };
    });
  };

  // Create or update paper
  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert("Article title is required.");
      return;
    }

    // Validate authors
    const validAuthors = formData.authors.filter(a => a.name.trim() !== "");
    if (validAuthors.length === 0) {
      alert("Please provide at least one author name.");
      return;
    }

    try {
      const tagArray = formData.tags
        .split(",")
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const computedSlug = formData.title
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-");

      const primaryAuthor = validAuthors[0];

      const payload = {
        title: formData.title.trim(),
        slug: computedSlug,
        authors: validAuthors,
        // Legacy single-author compatibility fields
        authorName: primaryAuthor.name,
        authorEmail: primaryAuthor.email || "",
        authorOrcid: primaryAuthor.orcid || "",
        authorRole: primaryAuthor.role || "",
        authorImageUrl: primaryAuthor.imageUrl || "",
        articleUrl: formData.articleUrl.trim(),
        category: formData.category.trim() || "General",
        tags: tagArray,
        readTime: formData.readTime.trim() || `${Math.max(1, Math.ceil(formData.descriptionMarkdown.split(/\s+/).length / 200))} min read`,
        excerpt: formData.excerpt.trim() || formData.descriptionMarkdown.slice(0, 160).replace(/[#*`_]/g, ""),
        descriptionMarkdown: formData.descriptionMarkdown,
        coverImageUrl: formData.coverImageUrl.trim() || "https://picsum.photos/seed/paper/800/450",
        displayInFrontend: formData.displayInFrontend,
        order: Number(formData.order) || 1,
        position: Number(formData.order) || 1,
        status: "published",
        updatedAt: Date.now(),
      };

      if (editingId) {
        await updateDoc(doc(db, "blogs", editingId), payload);
      } else {
        await addDoc(collection(db, "blogs"), {
          ...payload,
          createdAt: Date.now(),
        });
      }

      setIsModalOpen(false);
      resetForm();
      fetchPosts();
    } catch (err: any) {
      console.error("Error saving paper:", err);
      alert("Failed to save paper: " + err.message);
    }
  };

  // Toggle display in frontend
  const handleToggleDisplay = async (post: ProceedingItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const newStatus = post.displayInFrontend === false ? true : false;
      const docRef = doc(db, "blogs", post.id);
      await updateDoc(docRef, { displayInFrontend: newStatus });
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, displayInFrontend: newStatus } : p));
    } catch (err) {
      console.error("Error toggling status:", err);
      alert("Failed to update status");
    }
  };

  // Delete paper
  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm("Are you sure you want to delete this proceeding paper?")) return;
    try {
      await deleteDoc(doc(db, "blogs", id));
      setPosts(prev => prev.filter(p => p.id !== id));
      setSelectedIds(prev => prev.filter(item => item !== id));
    } catch (err) {
      console.error("Error deleting paper:", err);
      alert("Failed to delete paper");
    }
  };

  // Bulk Selection Handlers
  const handleSelectAll = () => {
    if (selectedIds.length === filteredPosts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredPosts.map(p => p.id));
    }
  };

  const handleToggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Bulk Actions
  const handleBulkToggleDisplay = async (makeVisible: boolean) => {
    if (selectedIds.length === 0) return;
    setBulkActionLoading(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        const docRef = doc(db, "blogs", id);
        batch.update(docRef, { displayInFrontend: makeVisible });
      });
      await batch.commit();

      setPosts(prev => prev.map(p => 
        selectedIds.includes(p.id) ? { ...p, displayInFrontend: makeVisible } : p
      ));
      setSelectedIds([]);
    } catch (err) {
      console.error("Error updating bulk visibility:", err);
      alert("Bulk update failed.");
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to permanently delete ${selectedIds.length} proceeding papers?`)) return;

    setBulkActionLoading(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        const docRef = doc(db, "blogs", id);
        batch.delete(docRef);
      });
      await batch.commit();

      setPosts(prev => prev.filter(p => !selectedIds.includes(p.id)));
      setSelectedIds([]);
    } catch (err) {
      console.error("Error bulk deleting:", err);
      alert("Bulk delete failed.");
    } finally {
      setBulkActionLoading(false);
    }
  };

  const openEditModal = (post: ProceedingItem) => {
    setEditingId(post.id);
    
    // Parse authors
    let initialAuthors: AuthorItem[] = [];
    if (Array.isArray(post.authors) && post.authors.length > 0) {
      initialAuthors = post.authors.map(a => ({
        name: a.name || "",
        email: a.email || "",
        orcid: a.orcid || "",
        role: a.role || "Co-Author",
        affiliation: a.affiliation || "",
        imageUrl: a.imageUrl || ""
      }));
    } else {
      initialAuthors = [{
        name: post.authorName || "HSTU Author",
        email: post.authorEmail || "",
        orcid: post.authorOrcid || "",
        role: post.authorRole || "Lead Author",
        affiliation: "HSTU",
        imageUrl: post.authorImageUrl || ""
      }];
    }

    setFormData({
      title: post.title || "",
      authors: initialAuthors,
      articleUrl: post.articleUrl || "",
      category: post.category || "Computer Science & Engineering",
      tags: Array.isArray(post.tags) ? post.tags.join(", ") : "",
      readTime: post.readTime || "",
      excerpt: post.excerpt || "",
      coverImageUrl: post.coverImageUrl || "",
      descriptionMarkdown: post.descriptionMarkdown || post.content || "",
      displayInFrontend: post.displayInFrontend !== false,
      order: post.order || 1,
    });
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      title: "",
      authors: [{ ...DEFAULT_AUTHOR }],
      articleUrl: "",
      category: "Computer Science & Engineering",
      tags: "",
      readTime: "",
      excerpt: "",
      coverImageUrl: "",
      descriptionMarkdown: "",
      displayInFrontend: true,
      order: posts.length + 1,
    });
  };

  // Distinct categories
  const categories = Array.from(new Set(posts.map(p => p.category).filter(Boolean))) as string[];

  // Filtered list
  const filteredPosts = posts.filter(post => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      post.title.toLowerCase().includes(q) ||
      post.authors.some(a => 
        (a.name && a.name.toLowerCase().includes(q)) || 
        (a.email && a.email.toLowerCase().includes(q)) ||
        (a.orcid && a.orcid.toLowerCase().includes(q))
      ) ||
      (post.category && post.category.toLowerCase().includes(q)) ||
      (post.tags && post.tags.some(t => t.toLowerCase().includes(q)));

    const matchesStatus = 
      statusFilter === "all" ? true :
      statusFilter === "visible" ? post.displayInFrontend !== false :
      post.displayInFrontend === false;

    const matchesCategory = 
      categoryFilter === "all" ? true : post.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white/70 backdrop-blur-[24px] p-6 rounded-[28px] border border-white/40 shadow-[0_10px_40px_rgba(15,23,42,0.06)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-blue-600 bg-blue-50 border border-blue-100/80 px-2.5 py-0.5 rounded-full">
              Conference Content
            </span>
            <span className="text-[11px] font-bold text-slate-400">HSTU Research Society</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black font-montserrat tracking-tight text-[#0F172A]">
            Proceedings & Papers
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage accepted conference papers, multiple contributing authors, ORCIDs, and full article links.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsReorderModalOpen(true)}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-2xl text-xs font-bold border border-slate-200/80 transition-all shadow-sm"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
            <span>Reorder Papers ({posts.length})</span>
          </button>

          <button
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-5 py-2.5 rounded-2xl text-xs font-bold shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Add Proceeding Paper</span>
          </button>
        </div>
      </div>

      {/* Error notification */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl flex items-center gap-3 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-rose-500 hover:text-rose-700 font-bold">✕</button>
        </div>
      )}

      {/* Control Bar: Search, Filters, Selection summary */}
      <div className="bg-white/60 backdrop-blur-[24px] p-4 rounded-[24px] border border-white/40 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search box */}
          <div className="relative md:col-span-6">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by title, author, email, ORCID, tag, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Visibility filter */}
          <div className="md:col-span-3 flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl px-3 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            >
              <option value="all">All Visibility (Frontend)</option>
              <option value="visible">Live in Frontend Only</option>
              <option value="hidden">Hidden from Frontend</option>
            </select>
          </div>

          {/* Category filter */}
          <div className="md:col-span-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl px-3 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            >
              <option value="all">All Categories ({categories.length})</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSelectAll}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-colors"
            >
              {selectedIds.length === filteredPosts.length && filteredPosts.length > 0 ? (
                <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
              ) : selectedIds.length > 0 ? (
                <MinusSquare className="w-3.5 h-3.5 text-blue-600" />
              ) : (
                <Square className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>
                {selectedIds.length === 0 
                  ? "Select All" 
                  : `Selected (${selectedIds.length}/${filteredPosts.length})`}
              </span>
            </button>

            {selectedIds.length > 0 && (
              <span className="text-xs text-slate-400">
                Bulk actions ready:
              </span>
            )}
          </div>

          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={bulkActionLoading}
                onClick={() => handleBulkToggleDisplay(true)}
                className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Show in Frontend</span>
              </button>

              <button
                type="button"
                disabled={bulkActionLoading}
                onClick={() => handleBulkToggleDisplay(false)}
                className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/80 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span>Hide from Frontend</span>
              </button>

              <button
                type="button"
                disabled={bulkActionLoading}
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected ({selectedIds.length})</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Grid of Proceedings Cards */}
      {loading ? (
        <div className="text-center py-20 bg-white/40 rounded-[28px] border border-white/40">
          <div className="inline-block animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mb-3"></div>
          <p className="text-sm font-semibold text-slate-500">Loading conference papers...</p>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="text-center py-16 bg-white/50 backdrop-blur-[20px] rounded-[28px] border border-dashed border-slate-200 p-8">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">No proceeding papers found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery || statusFilter !== "all" || categoryFilter !== "all"
              ? "Try adjusting your search query or visibility filters."
              : "Get started by adding accepted conference proceedings and papers."}
          </p>
          <button
            type="button"
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="mt-4 inline-flex items-center gap-2 bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add First Proceeding</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPosts.map((post) => {
            const isSelected = selectedIds.includes(post.id);
            const isLive = post.displayInFrontend !== false;
            const displayOrder = post.position || post.order || 1;
            const isFirst = displayOrder === 1;
            const isLast = displayOrder === posts.length;
            const isExpanded = expandedAuthorsId === post.id;
            const primaryAuthor = post.authors[0] || DEFAULT_AUTHOR;
            const coAuthors = post.authors.slice(1);
            const articleLink = post.articleUrl || "";

            return (
              <div
                key={post.id}
                className={`group relative bg-white/70 backdrop-blur-[20px] rounded-[24px] border transition-all duration-200 overflow-hidden flex flex-col justify-between ${
                  isSelected 
                    ? "border-blue-500 ring-2 ring-blue-500/20 shadow-[0_12px_32px_rgba(37,99,235,0.12)]" 
                    : "border-white/60 hover:border-slate-300/80 shadow-[0_8px_30px_rgba(15,23,42,0.04)] hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)]"
                }`}
              >
                <div>
                  {/* Card Cover Header with Checkbox & Status Badges */}
                  <div className="relative h-44 w-full bg-slate-100 overflow-hidden">
                    {post.coverImageUrl ? (
                      <img
                        src={post.coverImageUrl}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "https://picsum.photos/seed/placeholder/800/450";
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-blue-50/50">
                        <FileText className="w-10 h-10 text-slate-300" />
                      </div>
                    )}

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                    {/* Selection Checkbox */}
                    <button
                      type="button"
                      onClick={(e) => handleToggleSelect(post.id, e)}
                      className="absolute top-3 left-3 p-1.5 rounded-xl bg-white/90 backdrop-blur-md shadow-md text-slate-700 hover:text-blue-600 transition-colors z-10"
                      title="Select for bulk actions"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>

                    {/* Order Badge & Category Badge */}
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
                      <span className="text-[10px] font-black tracking-wider bg-black/75 backdrop-blur-md text-white px-2 py-0.5 rounded-lg border border-white/20 shadow-sm flex items-center gap-1">
                        <span>#{displayOrder}</span>
                      </span>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg backdrop-blur-md border shadow-sm flex items-center gap-1 ${
                        isLive 
                          ? "bg-emerald-500/90 text-white border-emerald-400/30" 
                          : "bg-amber-500/90 text-white border-amber-400/30"
                      }`}>
                        <Globe className="w-2.5 h-2.5" />
                        <span>{isLive ? "Live" : "Hidden"}</span>
                      </span>
                    </div>

                    {/* Category on image bottom */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white z-10">
                      <span className="text-[11px] font-extrabold tracking-wide uppercase bg-blue-600/80 backdrop-blur-md px-2.5 py-0.5 rounded-md border border-blue-400/30">
                        {post.category || "General"}
                      </span>
                      {post.readTime && (
                        <span className="text-[10px] font-semibold text-slate-200 flex items-center gap-1 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-md">
                          <Clock className="w-2.5 h-2.5" />
                          {post.readTime}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 space-y-3">
                    {/* Title */}
                    <h3 className="text-sm font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">
                      {post.title}
                    </h3>

                    {/* Excerpt */}
                    {post.excerpt && (
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {post.excerpt}
                      </p>
                    )}

                    {/* Authors Box */}
                    <div className="bg-slate-50/90 rounded-2xl border border-slate-200/80 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-blue-600" />
                          Authors ({post.authors.length})
                        </span>
                        {coAuthors.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setExpandedAuthorsId(isExpanded ? null : post.id)}
                            className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                          >
                            <span>{isExpanded ? "Collapse" : `+${coAuthors.length} co-author${coAuthors.length > 1 ? "s" : ""}`}</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        )}
                      </div>

                      {/* Primary Author */}
                      <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-200/60">
                        <div className="flex items-start gap-2 min-w-0">
                          {primaryAuthor.imageUrl ? (
                            <img
                              src={primaryAuthor.imageUrl}
                              alt={primaryAuthor.name}
                              className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0 mt-0.5"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 font-black text-[10px] shrink-0 mt-0.5">
                              {primaryAuthor.name ? primaryAuthor.name.charAt(0).toUpperCase() : "A"}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {primaryAuthor.name || "Unknown Author"}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">
                              {primaryAuthor.role || "Lead Author"} {primaryAuthor.affiliation ? `• ${primaryAuthor.affiliation}` : ""}
                            </p>
                          </div>
                        </div>

                        {/* Email & ORCID Badges for Primary Author */}
                        <div className="flex items-center gap-1 shrink-0">
                          {primaryAuthor.email && (
                            <a
                              href={`mailto:${primaryAuthor.email}`}
                              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title={`Email: ${primaryAuthor.email}`}
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {primaryAuthor.orcid && (
                            <a
                              href={primaryAuthor.orcid.startsWith("http") ? primaryAuthor.orcid : `https://orcid.org/${primaryAuthor.orcid}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 text-[#a6ce39] hover:bg-[#a6ce39]/10 rounded-lg transition-colors font-bold text-[10px] flex items-center gap-0.5"
                              title={`ORCID: ${primaryAuthor.orcid}`}
                            >
                              <Award className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Expanded Co-authors List */}
                      {isExpanded && coAuthors.length > 0 && (
                        <div className="pt-2 border-t border-slate-200/80 space-y-2 mt-2">
                          {coAuthors.map((ca, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs bg-white p-1.5 rounded-xl border border-slate-100">
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-800 truncate text-[11px]">
                                  {ca.name}
                                </p>
                                <p className="text-[9px] text-slate-400 truncate">
                                  {ca.role || "Co-Author"} {ca.affiliation ? `• ${ca.affiliation}` : ""}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0 ml-2">
                                {ca.email && (
                                  <a
                                    href={`mailto:${ca.email}`}
                                    className="p-1 text-slate-400 hover:text-blue-600 rounded"
                                    title={`Email: ${ca.email}`}
                                  >
                                    <Mail className="w-3 h-3" />
                                  </a>
                                )}
                                {ca.orcid && (
                                  <a
                                    href={ca.orcid.startsWith("http") ? ca.orcid : `https://orcid.org/${ca.orcid}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1 text-[#a6ce39] hover:bg-[#a6ce39]/10 rounded"
                                    title={`ORCID: ${ca.orcid}`}
                                  >
                                    <Award className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Full Article Link Pill */}
                    {articleLink ? (
                      <a
                        href={articleLink}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between w-full px-3 py-2 rounded-xl bg-blue-50/70 hover:bg-blue-100/70 border border-blue-100 text-blue-700 text-xs font-bold transition-colors"
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="truncate">View Full Article / Paper</span>
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </a>
                    ) : (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100 text-slate-400 text-[11px]">
                        <FileText className="w-3 h-3 shrink-0" />
                        <span className="italic">No external full paper URL attached</span>
                      </div>
                    )}

                    {/* Tags */}
                    {post.tags && post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {post.tags.slice(0, 3).map((tag, i) => (
                          <span key={i} className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                            #{tag}
                          </span>
                        ))}
                        {post.tags.length > 3 && (
                          <span className="text-[10px] font-semibold text-slate-400 px-1 py-0.5">
                            +{post.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer: Reordering Controls & Action Buttons */}
                <div className="p-3 bg-slate-50/80 border-t border-slate-100 space-y-2 mt-2">
                  {/* Sequence Position Control */}
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Rank:</span>
                      <select
                        value={displayOrder}
                        disabled={isReordering}
                        onChange={(e) => handleSetCustomPosition(post.id, Number(e.target.value))}
                        className="bg-white border border-slate-200 text-xs font-bold text-slate-800 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                        title="Change position order"
                      >
                        {posts.map((_, idx) => (
                          <option key={idx + 1} value={idx + 1}>
                            #{idx + 1} {idx === 0 ? "(Top)" : idx === posts.length - 1 ? "(Last)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={isFirst || isReordering}
                        onClick={(e) => handleMoveToTop(post.id, e)}
                        className="px-1.5 py-1 rounded bg-white hover:bg-slate-100 text-slate-600 hover:text-blue-600 text-[10px] font-bold border border-slate-200/80 transition-colors disabled:opacity-40 flex items-center gap-0.5"
                        title="Move directly to Top (#1)"
                      >
                        <ArrowUpToLine className="w-3 h-3" /> Top
                      </button>
                      <button
                        type="button"
                        disabled={isFirst || isReordering}
                        onClick={(e) => handleMovePost(post.id, "up", e)}
                        className="p-1 text-slate-500 hover:text-blue-600 bg-white hover:bg-slate-100 rounded border border-slate-200/80 transition-colors disabled:opacity-40"
                        title="Move Up 1 position"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={isLast || isReordering}
                        onClick={(e) => handleMovePost(post.id, "down", e)}
                        className="p-1 text-slate-500 hover:text-blue-600 bg-white hover:bg-slate-100 rounded border border-slate-200/80 transition-colors disabled:opacity-40"
                        title="Move Down 1 position"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={isLast || isReordering}
                        onClick={(e) => handleMoveToBottom(post.id, e)}
                        className="px-1.5 py-1 rounded bg-white hover:bg-slate-100 text-slate-600 hover:text-blue-600 text-[10px] font-bold border border-slate-200/80 transition-colors disabled:opacity-40 flex items-center gap-0.5"
                        title="Move directly to Bottom"
                      >
                        <ArrowDownToLine className="w-3 h-3" /> End
                      </button>
                    </div>
                  </div>

                  {/* Display Switch & Action Buttons */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                    <button
                      type="button"
                      onClick={(e) => handleToggleDisplay(post, e)}
                      className={`text-xs font-bold flex items-center gap-1.5 px-2.5 py-1 rounded-xl transition-colors ${
                        isLive 
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/80" 
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200"
                      }`}
                      title={isLive ? "Visible in frontend (Click to hide)" : "Hidden from frontend (Click to make live)"}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>{isLive ? "Live in Frontend" : "Hidden"}</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(post)}
                        className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors border border-transparent hover:border-blue-200"
                        title="Edit Proceeding Details"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(post.id, e)}
                        className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-transparent hover:border-rose-200"
                        title="Delete Proceeding"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reorder Modal (Drag-free Sequence Manager) */}
      {isReorderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[28px] p-6 sm:p-8 w-full max-w-2xl shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-bold font-montserrat text-[#0F172A]">
                  Reorder Proceedings & Papers
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set the display order of papers in the conference frontend. #1 appears at the very top.
                </p>
              </div>
              <button
                onClick={() => setIsReorderModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-2">
              {posts.map((post, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === posts.length - 1;

                return (
                  <div
                    key={post.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/80 hover:bg-blue-50/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-7 h-7 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xs font-black text-slate-700 shadow-sm shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {post.title}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate flex items-center gap-2">
                          <span>{post.authors[0]?.name || "HSTU RS"}</span>
                          <span>•</span>
                          <span className="bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-semibold">{post.category || "General"}</span>
                          <span>•</span>
                          <span className={post.displayInFrontend !== false ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>
                            {post.displayInFrontend !== false ? "Live" : "Hidden"}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={isFirst || isReordering}
                        onClick={() => handleMoveToTop(post.id)}
                        className="px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:text-blue-600 hover:border-blue-300 rounded-xl transition-all disabled:opacity-30 flex items-center gap-1"
                        title="Move to Top"
                      >
                        <ArrowUpToLine className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Top</span>
                      </button>
                      <button
                        type="button"
                        disabled={isFirst || isReordering}
                        onClick={() => handleMovePost(post.id, "up")}
                        className="p-1.5 bg-white border border-slate-200 text-slate-700 hover:text-blue-600 hover:border-blue-300 rounded-xl transition-all disabled:opacity-30"
                        title="Move Up"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={isLast || isReordering}
                        onClick={() => handleMovePost(post.id, "down")}
                        className="p-1.5 bg-white border border-slate-200 text-slate-700 hover:text-blue-600 hover:border-blue-300 rounded-xl transition-all disabled:opacity-30"
                        title="Move Down"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={isLast || isReordering}
                        onClick={() => handleMoveToBottom(post.id)}
                        className="px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:text-blue-600 hover:border-blue-300 rounded-xl transition-all disabled:opacity-30 flex items-center gap-1"
                        title="Move to Bottom"
                      >
                        <ArrowDownToLine className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Bottom</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {isReordering ? "Saving updates to Firestore..." : "All positions synchronized with database."}
              </span>
              <button
                type="button"
                onClick={() => setIsReorderModalOpen(false)}
                className="px-6 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Proceeding Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[28px] p-6 sm:p-8 w-full max-w-3xl shadow-2xl my-8 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                  Conference Proceedings
                </span>
                <h3 className="text-xl font-bold font-montserrat text-[#0F172A] mt-1">
                  {editingId ? "Edit Proceeding Paper" : "Add New Proceeding Paper"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure title, multiple authors with emails & ORCIDs, and link to full publication article.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrUpdate} className="space-y-6">
              {/* Paper Title */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
                  Paper Title *
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. A Deep Learning Approach for Structural Crack Detection in Concrete Bridges"
                  className="w-full rounded-[16px] border border-slate-200 bg-slate-50 p-3.5 text-sm text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-semibold placeholder:text-slate-400"
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                />
              </div>

              {/* MULTIPLE AUTHORS SECTION */}
              <div className="p-4 sm:p-5 rounded-[24px] bg-blue-50/40 border border-blue-100/90 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-blue-950 uppercase tracking-wider">
                        Authors & Contributors ({formData.authors.length})
                      </h4>
                      <p className="text-[11px] text-blue-800/80">
                        Add individual names, institutional emails, and ORCID iDs for each author.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddAuthor}
                    className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Author</span>
                  </button>
                </div>

                {/* Author Items Cards */}
                <div className="space-y-3.5">
                  {formData.authors.map((author, index) => (
                    <div 
                      key={index} 
                      className="bg-white rounded-2xl p-4 border border-blue-100 shadow-sm space-y-3 relative group"
                    >
                      {/* Author Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black flex items-center justify-center">
                            {index + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            {index === 0 ? "Primary / Lead Author" : `Co-Author #${index + 1}`}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          {/* Reorder Author Buttons */}
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => handleMoveAuthor(index, "up")}
                            className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100 disabled:opacity-30"
                            title="Move Author Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={index === formData.authors.length - 1}
                            onClick={() => handleMoveAuthor(index, "down")}
                            className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100 disabled:opacity-30"
                            title="Move Author Down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          
                          {/* Remove Author */}
                          {formData.authors.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveAuthor(index)}
                              className="p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded ml-1"
                              title="Remove Author"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Author Inputs Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Full Name */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Author Full Name *
                          </label>
                          <input
                            required
                            type="text"
                            placeholder="e.g. Dr. Md. Shahjalal / John Doe"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-semibold placeholder:text-slate-400"
                            value={author.name}
                            onChange={e => handleUpdateAuthor(index, "name", e.target.value)}
                          />
                        </div>

                        {/* Email Address */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span>Email Address</span>
                          </label>
                          <input
                            type="email"
                            placeholder="author@hstu.ac.bd"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                            value={author.email || ""}
                            onChange={e => handleUpdateAuthor(index, "email", e.target.value)}
                          />
                        </div>

                        {/* ORCID iD */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                            <Award className="w-3 h-3 text-[#a6ce39]" />
                            <span>ORCID iD</span>
                            <span className="text-[10px] text-slate-400 font-normal">(0000-0000-0000-0000)</span>
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. 0000-0002-1825-0097"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono placeholder:text-slate-400"
                            value={author.orcid || ""}
                            onChange={e => handleUpdateAuthor(index, "orcid", e.target.value)}
                          />
                        </div>

                        {/* Role / Designation */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Role / Designation
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Lead Researcher / Associate Professor"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                            value={author.role || ""}
                            onChange={e => handleUpdateAuthor(index, "role", e.target.value)}
                          />
                        </div>

                        {/* Affiliation / Department */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Affiliation / Department
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Dept. of CSE, HSTU"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                            value={author.affiliation || ""}
                            onChange={e => handleUpdateAuthor(index, "affiliation", e.target.value)}
                          />
                        </div>

                        {/* Photo URL */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Author Photo URL (Optional)
                          </label>
                          <input
                            type="url"
                            placeholder="https://example.com/author.jpg"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                            value={author.imageUrl || ""}
                            onChange={e => handleUpdateAuthor(index, "imageUrl", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddAuthor}
                  className="w-full py-2.5 border-2 border-dashed border-blue-200 hover:border-blue-400 rounded-2xl text-xs font-bold text-blue-700 bg-white/60 hover:bg-blue-50 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Another Author / Contributor</span>
                </button>
              </div>

              {/* LINK TO FULL ARTICLE / PAPER */}
              <div className="p-4 rounded-[20px] bg-slate-50 border border-slate-200/80 space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                  <span>Link to Full Article / Paper (URL)</span>
                </label>
                <p className="text-[11px] text-slate-500">
                  Provide a direct URL to the published PDF, DOI link (e.g. https://doi.org/...), or external conference archive.
                </p>
                <div className="relative">
                  <input
                    type="url"
                    placeholder="https://doi.org/10.1145/... or https://arxiv.org/abs/... or https://cdn.example.com/paper.pdf"
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                    value={formData.articleUrl}
                    onChange={e => setFormData({...formData, articleUrl: e.target.value})}
                  />
                  {formData.articleUrl && (
                    <a
                      href={formData.articleUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      <span>Test Link</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>

              {/* Category, Tags, Read Time */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
                    Category *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Computer Science, Civil Engineering"
                    className="w-full rounded-[16px] border border-slate-200 bg-slate-50 p-3 text-xs text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
                    Keywords / Tags (Comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="AI, Concrete, IoT, Sensors"
                    className="w-full rounded-[16px] border border-slate-200 bg-slate-50 p-3 text-xs text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={formData.tags}
                    onChange={e => setFormData({...formData, tags: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
                    Read / Presentation Time
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 15 min read / 20 min talk"
                    className="w-full rounded-[16px] border border-slate-200 bg-slate-50 p-3 text-xs text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={formData.readTime}
                    onChange={e => setFormData({...formData, readTime: e.target.value})}
                  />
                </div>
              </div>

              {/* Cover Image URL */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
                  Cover Image / Graphical Abstract URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/cover.jpg"
                  className="w-full rounded-[16px] border border-slate-200 bg-slate-50 p-3 text-xs text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  value={formData.coverImageUrl}
                  onChange={e => setFormData({...formData, coverImageUrl: e.target.value})}
                />
              </div>

              {/* Short Excerpt */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5">
                  Short Excerpt / Abstract Summary
                </label>
                <input
                  type="text"
                  placeholder="Brief 1-2 sentence preview for the card..."
                  className="w-full rounded-[16px] border border-slate-200 bg-slate-50 p-3 text-xs text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  value={formData.excerpt}
                  onChange={e => setFormData({...formData, excerpt: e.target.value})}
                />
              </div>

              {/* Markdown Content */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest">
                    Paper Abstract & Details (Markdown Supported) *
                  </label>
                  <span className="text-[11px] text-blue-600 font-semibold flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Markdown Supported
                  </span>
                </div>
                <textarea
                  required
                  rows={8}
                  className="w-full rounded-[16px] border border-slate-200 bg-slate-50 p-3.5 text-xs font-mono text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all leading-relaxed"
                  value={formData.descriptionMarkdown}
                  onChange={e => setFormData({...formData, descriptionMarkdown: e.target.value})}
                  placeholder="## Abstract&#10;&#10;Enter the paper abstract, methodology overview, and key contributions here...&#10;&#10;### Key Results&#10;- Result 1&#10;- Result 2"
                />
              </div>

              {/* Order Position & Display Switch in Form */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-[20px] border border-slate-200">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Display Sequence Rank (Order) *
                  </label>
                  <p className="text-[11px] text-slate-500 mb-2">
                    #1 places this paper at the very top of the live proceedings.
                  </p>
                  <input
                    type="number"
                    min={1}
                    value={formData.order}
                    onChange={e => setFormData({ ...formData, order: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm font-bold text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Display in Frontend Toggle in Form */}
                <div className="bg-slate-50 p-4 rounded-[20px] border border-slate-200 flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-0.5">
                      Display in Frontend
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Toggle whether this paper is immediately live on the public site.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formData.displayInFrontend}
                    onClick={() => setFormData({ ...formData, displayInFrontend: !formData.displayInFrontend })}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                      formData.displayInFrontend ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        formData.displayInFrontend ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  {editingId ? "Save Paper Updates" : "Create Proceeding Paper"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
