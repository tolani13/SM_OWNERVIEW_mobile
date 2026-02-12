import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Megaphone, Plus, Calendar, Tag, Pin, Edit2, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAnnouncements, useCreateAnnouncement, useUpdateAnnouncement } from "@/hooks/useData";
import type { Announcement, InsertAnnouncement } from "@server/schema";
import { validateRequired, safeTrim, formatDate } from "@/lib/utils-safe";
import { toast } from "react-hot-toast";

export default function Announcements() {
    const { data: announcements = [], isLoading } = useAnnouncements();
    const createAnnouncement = useCreateAnnouncement();
    const updateAnnouncement = useUpdateAnnouncement();

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    // New/Edit announcement form state
    const [newPost, setNewPost] = useState<Partial<InsertAnnouncement>>({ 
        tags: "Studio", 
        isPinned: false,
        date: new Date().toISOString()
    });

    const handleCreate = async () => {
        // Validate required fields
        const validation = validateRequired(
            {
                title: safeTrim(newPost.title),
                content: safeTrim(newPost.content)
            },
            ['title', 'content'],
            {
                title: 'Please enter a title',
                content: 'Please enter content for the announcement'
            }
        );

        if (!validation.isValid) {
            validation.errors.forEach(err => toast.error(err));
            return;
        }
        
        setIsSaving(true);
        try {
            const announcementData = {
                title: safeTrim(newPost.title)!,
                content: safeTrim(newPost.content)!,
                date: newPost.date || new Date().toISOString(),
                tags: newPost.tags || "Studio",
                isPinned: newPost.isPinned || false,
                status: "Active" as const
            };

            if (editingId) {
                // Update existing
                await updateAnnouncement.mutateAsync({
                    id: editingId,
                    data: announcementData
                });
                toast.success('Announcement updated successfully!');
                setEditingId(null);
            } else {
                // Create new
                await createAnnouncement.mutateAsync(announcementData);
                toast.success('Announcement posted successfully!');
            }
            
            setIsCreateOpen(false);
            setNewPost({ tags: "Studio", isPinned: false, date: new Date().toISOString() });
        } catch (error: any) {
            console.error('Save announcement error:', error);
            toast.error(error?.message || 'Failed to save announcement. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const openEdit = (announcement: Announcement) => {
        setNewPost({
            ...announcement,
            date: announcement.date
        });
        setEditingId(announcement.id);
        setIsCreateOpen(true);
    };

    if (isLoading) {
        return (
            <Layout>
                <div className="flex items-center justify-center h-64">
                    <div className="text-muted-foreground">Loading...</div>
                </div>
            </Layout>
        );
    }

    const toggleTag = (tag: string) => {
        const currentTags = (newPost.tags || "").split(',').filter(Boolean);
        const newTags = currentTags.includes(tag) 
            ? currentTags.filter(t => t !== tag)
            : [...currentTags, tag];
        setNewPost({ ...newPost, tags: newTags.join(',') });
    }

    const toTimestamp = (value?: string | Date | null) => {
        if (!value) return 0;
        const ts = new Date(value).getTime();
        return Number.isNaN(ts) ? 0 : ts;
    };

    const sortedAnnouncements = useMemo(() => {
        return [...announcements].sort((a, b) => {
            const aTime = toTimestamp(a.date) || toTimestamp(a.createdAt);
            const bTime = toTimestamp(b.date) || toTimestamp(b.createdAt);
            return bTime - aTime;
        });
    }, [announcements]);

    const pinnedAnnouncements = sortedAnnouncements.filter(a => a.isPinned);
    const regularAnnouncements = sortedAnnouncements.filter(a => !a.isPinned);

    const handleOpenCreate = () => {
        setNewPost({ tags: "Studio", isPinned: false, date: new Date().toISOString().split('T')[0] });
        setEditingId(null);
        setIsCreateOpen(true);
    };

    return (
        <Layout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-display font-bold">Announcements</h1>
                        <p className="text-muted-foreground">Broadcast updates to your studio family.</p>
                    </div>
                    <Button 
                        onClick={handleOpenCreate} 
                        className="bg-primary text-white hover:bg-primary/90"
                        aria-label="Create new announcement"
                    >
                        <Plus className="w-4 h-4 mr-2" /> New Post
                    </Button>
                </div>

                <div className="grid gap-6">
                    {/* Pinned Section */}
                    {pinnedAnnouncements.length > 0 && (
                        <div className="space-y-4">
                            <h2 className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2">
                                <Pin className="w-4 h-4" /> Pinned
                            </h2>
                            {pinnedAnnouncements.map(announcement => (
                                <Card key={announcement.id} className="border-l-4 border-l-primary shadow-md bg-white group relative overflow-hidden">
                                    <div className="h-2 bg-primary w-full origin-left group-hover:scale-x-105 transition-transform" />
                                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => openEdit(announcement)}
                                            aria-label={`Edit ${announcement.title}`}
                                        >
                                            <Edit2 className="w-4 h-4 text-muted-foreground" />
                                        </Button>
                                    </div>
                                    <CardContent className="p-6">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex gap-2 mb-2">
                                                {(announcement.tags || "").split(',').filter(Boolean).map(tag => (
                                                    <Badge key={tag} variant="secondary" className="font-normal text-xs">{tag}</Badge>
                                                ))}
                                            </div>
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {formatDate(announcement.date)}
                                            </span>
                                        </div>
                                        <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                                            <Pin className="w-4 h-4 text-primary fill-primary" />
                                            {announcement.title}
                                        </h3>
                                        <p className="text-muted-foreground">{announcement.content}</p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    {/* Regular List */}
                    <div className="space-y-4">
                        {pinnedAnnouncements.length > 0 && regularAnnouncements.length > 0 && (
                             <h2 className="text-sm font-bold uppercase text-muted-foreground">Recent Updates</h2>
                        )}
                        {regularAnnouncements.length === 0 ? (
                            <Card className="border-dashed bg-white/80">
                                <CardContent className="p-6 text-sm text-muted-foreground">
                                    No recent announcements yet.
                                </CardContent>
                            </Card>
                        ) : (
                            regularAnnouncements.map(announcement => (
                                <Card key={announcement.id} className="border-none shadow-sm hover:shadow-md transition-shadow bg-white group relative overflow-hidden">
                                    <div className="h-2 bg-primary w-full origin-left group-hover:scale-x-105 transition-transform" />
                                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => openEdit(announcement)}
                                            aria-label={`Edit ${announcement.title}`}
                                        >
                                            <Edit2 className="w-4 h-4 text-muted-foreground" />
                                        </Button>
                                    </div>
                                    <CardContent className="p-6">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex gap-2 mb-2">
                                                {(announcement.tags || "").split(',').filter(Boolean).map(tag => (
                                                    <Badge key={tag} variant="secondary" className="font-normal text-xs">{tag}</Badge>
                                                ))}
                                            </div>
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {formatDate(announcement.date)}
                                            </span>
                                        </div>
                                        <h3 className="text-xl font-bold mb-2">{announcement.title}</h3>
                                        <p className="text-muted-foreground">{announcement.content}</p>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                </div>

                {/* Create/Edit Modal */}
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingId ? "Edit Announcement" : "Create Announcement"}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Title</Label>
                                <Input 
                                    placeholder="e.g., Summer Intensive Dates" 
                                    value={newPost.title || ""} 
                                    onChange={e => setNewPost({...newPost, title: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Date</Label>
                                <Input 
                                    type="date"
                                    value={newPost.date ? new Date(newPost.date).toISOString().split('T')[0] : ""} 
                                    onChange={e => setNewPost({...newPost, date: new Date(e.target.value).toISOString()})}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Content</Label>
                                <Textarea 
                                    placeholder="Write your announcement here..." 
                                    value={newPost.content || ""} 
                                    onChange={e => setNewPost({...newPost, content: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Tags</Label>
                                <div className="flex gap-2">
                                    {["Studio", "Competition", "Level"].map(tag => {
                                        const currentTags = (newPost.tags || "").split(',').filter(Boolean);
                                        const isSelected = currentTags.includes(tag);
                                        return (
                                            <Badge 
                                                key={tag} 
                                                variant={isSelected ? "default" : "outline"} 
                                                className="cursor-pointer hover:bg-primary/90"
                                                onClick={() => toggleTag(tag)}
                                            >
                                                {tag}
                                            </Badge>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 border p-3 rounded-lg bg-secondary/10">
                                <Switch 
                                    checked={newPost.isPinned ?? false} 
                                    onCheckedChange={c => setNewPost({...newPost, isPinned: c})}
                                />
                                <Label>Pin to top</Label>
                            </div>
                            <Button 
                                className="w-full bg-primary text-white" 
                                onClick={handleCreate}
                                disabled={isSaving}
                                aria-label="Save announcement"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    editingId ? "Save Changes" : "Post Announcement"
                                )}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </Layout>
    )
}