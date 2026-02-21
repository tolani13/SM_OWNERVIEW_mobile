import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, MessageCircle, Plus, Send, ShieldCheck, Users, CheckCheck } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "react-hot-toast";
import { useAuth } from "@/lib/auth";
import {
  type ChatActorContext,
  type NewThreadParticipantInput,
  useChatThreadMessages,
  useChatThreadReadSummary,
  useChatThreads,
  useCreateChatMessage,
  useCreateChatThread,
  useMarkChatMessageRead,
} from "@/hooks/useData";

type ThreadType = "direct_parent_staff" | "compchat" | "group_broadcast";

export default function MessagesOwnerViewMobile() {
  const { currentUser } = useAuth();

  const actor = useMemo<ChatActorContext | null>(() => {
    if (!currentUser) return null;
    return {
      id: currentUser.id,
      name: currentUser.name,
      role: currentUser.role,
      studioKey: currentUser.studioKey,
    };
  }, [currentUser]);

  const actorRole = actor?.role ?? "parent";

  const canCreateCompChat = actorRole === "owner" || actorRole === "manager";
  const canSendCompChatBroadcast = canCreateCompChat;

  const { data: threads = [], isLoading: loadingThreads, error: threadsError } = useChatThreads(actor ?? undefined);
  const createThread = useCreateChatThread();
  const createMessage = useCreateChatMessage();
  const markRead = useMarkChatMessageRead();

  const [selectedThreadId, setSelectedThreadId] = useState<string>("");
  const [openNewThread, setOpenNewThread] = useState(false);

  const [threadDraft, setThreadDraft] = useState({
    title: "",
    type: "direct_parent_staff" as ThreadType,
    isTimeSensitive: false,
    expiresAt: "",
    parentId: "parent-1",
    parentName: "Parent User",
  });

  const [messageDraft, setMessageDraft] = useState("");
  const [sendAsStaffBroadcast, setSendAsStaffBroadcast] = useState(false);

  const selectedThread = useMemo(
    () => threads.find((t) => t.id === selectedThreadId) || null,
    [threads, selectedThreadId],
  );

  const safeSelectedThreadId = selectedThread?.id;

  useEffect(() => {
    if (!threads.length) {
      if (selectedThreadId) setSelectedThreadId("");
      return;
    }

    if (!threads.some((thread) => thread.id === selectedThreadId)) {
      setSelectedThreadId(threads[0].id);
    }
  }, [threads, selectedThreadId]);

  const {
    data: messages = [],
    isLoading: loadingMessages,
    error: messagesError,
  } = useChatThreadMessages(safeSelectedThreadId, actor ?? undefined);
  const {
    data: readSummary = {},
    error: readSummaryError,
  } = useChatThreadReadSummary(safeSelectedThreadId, actor ?? undefined);

  const grouped = useMemo(() => {
    return {
      all: threads,
      compchat: threads.filter((t) => t.type === "compchat"),
      direct: threads.filter((t) => t.type === "direct_parent_staff"),
    };
  }, [threads]);

  const handleCreateThread = async () => {
    if (!actor) {
      toast.error("You must be signed in to create a thread");
      return;
    }

    if (!threadDraft.title.trim()) return toast.error("Thread title is required");
    if (threadDraft.type === "compchat" && !canCreateCompChat) {
      return toast.error("Only owner/manager can create CompChat broadcasts");
    }

    try {
      const participants: NewThreadParticipantInput[] =
        threadDraft.type === "direct_parent_staff"
          ? [
              {
                participantId: threadDraft.parentId,
                participantName: threadDraft.parentName,
                participantRole: "parent",
                authorized: true,
              },
            ]
          : [
              {
                participantId: "parent-1",
                participantName: "Parent User",
                participantRole: "parent",
                authorized: true,
              },
            ];

      const created = await createThread.mutateAsync({
        actor,
        data: {
          title: threadDraft.title.trim(),
          type: threadDraft.type,
          staffOnlyBroadcast: threadDraft.type === "compchat",
          isTimeSensitive: threadDraft.isTimeSensitive,
          expiresAt: threadDraft.expiresAt ? new Date(threadDraft.expiresAt).toISOString() : null,
          participants,
        },
      });

      toast.success("Thread created");
      setSelectedThreadId(created.id);
      setOpenNewThread(false);
      setThreadDraft({
        title: "",
        type: "direct_parent_staff",
        isTimeSensitive: false,
        expiresAt: "",
        parentId: "parent-1",
        parentName: "Parent User",
      });
    } catch (error: any) {
      toast.error(error?.message || "Failed to create thread");
    }
  };

  const handleSendMessage = async () => {
    if (!actor) {
      toast.error("You must be signed in to send a message");
      return;
    }

    if (!selectedThread) return;
    if (!messageDraft.trim()) return toast.error("Message cannot be empty");

    if (sendAsStaffBroadcast && !canSendCompChatBroadcast) {
      return toast.error("Only owner/manager can send CompChat broadcasts");
    }

    try {
      await createMessage.mutateAsync({
        actor,
        threadId: selectedThread.id,
        data: {
          threadId: selectedThread.id,
          senderId: actor.id,
          senderName: actor.name,
          senderRole: actor.role,
          body: messageDraft.trim(),
          isStaffBroadcast: sendAsStaffBroadcast,
        },
      });
      setMessageDraft("");
    } catch (error: any) {
      toast.error(error?.message || "Failed to send message");
    }
  };

  const handleMarkThreadRead = async () => {
    if (!actor) {
      toast.error("You must be signed in to mark messages read");
      return;
    }

    if (!selectedThread) {
      toast.error("Select a thread first");
      return;
    }

    if (!messages.length) {
      toast("No messages to mark as read");
      return;
    }

    try {
      await Promise.all(
        messages.map((m) =>
          markRead.mutateAsync({
            messageId: m.id,
            threadId: selectedThread.id,
            actor,
          }),
        ),
      );
      toast.success("Marked as read");
    } catch (error: any) {
      toast.error(error?.message || "Failed to mark read");
    }
  };

  const renderThreadList = (items: typeof threads) => {
    if (items.length === 0) {
      return <Card><CardContent className="p-6 text-sm text-muted-foreground">No threads yet.</CardContent></Card>;
    }

    return (
      <div className="space-y-3">
        {items.map((thread) => (
          <Card
            key={thread.id}
            className={`cursor-pointer transition ${selectedThreadId === thread.id ? "ring-2 ring-primary" : ""}`}
            onClick={() => setSelectedThreadId(thread.id)}
          >
            <CardHeader className="py-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{thread.title}</CardTitle>
                  <CardDescription className="capitalize">{thread.type.replace(/_/g, " ")}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {thread.staffOnlyBroadcast ? <Badge><ShieldCheck className="w-3 h-3 mr-1" />Staff Broadcast</Badge> : null}
                  {thread.isTimeSensitive ? <Badge className="bg-amber-500 text-white"><AlertTriangle className="w-3 h-3 mr-1" />Time Sensitive</Badge> : null}
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-display font-bold">Messages / CompChat</h1>
            <p className="text-muted-foreground">
              Parent ↔ studio chat with owner/manager-controlled CompChat broadcasts and read tracking.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="capitalize">
              Signed in as: {currentUser?.name ?? "Unknown"} ({currentUser?.role ?? "guest"})
            </Badge>

            <Dialog open={openNewThread} onOpenChange={setOpenNewThread}>
              <DialogTrigger asChild>
                <Button disabled={!actor}>
                  <Plus className="w-4 h-4 mr-2" /> New Thread
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Chat Thread</DialogTitle>
                  <DialogDescription>
                    CompChat is owner/manager initiated. Parents can still reply inside authorized threads.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={threadDraft.title} onChange={(e) => setThreadDraft({ ...threadDraft, title: e.target.value })} />
                  </div>

                  <div className="space-y-2">
                    <Label>Type</Label>
                    <select
                      className="h-10 w-full rounded-md border px-3 text-sm bg-background"
                      value={threadDraft.type}
                      onChange={(e) => setThreadDraft({ ...threadDraft, type: e.target.value as ThreadType })}
                    >
                      <option value="direct_parent_staff">Direct Parent + Staff</option>
                      <option value="compchat" disabled={!canCreateCompChat}>CompChat (Owner/Manager Broadcast)</option>
                      <option value="group_broadcast">Group Broadcast</option>
                    </select>
                  </div>

                  {threadDraft.type === "direct_parent_staff" ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Parent ID</Label>
                        <Input value={threadDraft.parentId} onChange={(e) => setThreadDraft({ ...threadDraft, parentId: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Parent Name</Label>
                        <Input value={threadDraft.parentName} onChange={(e) => setThreadDraft({ ...threadDraft, parentName: e.target.value })} />
                      </div>
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="text-sm font-medium">Time Sensitive</p>
                      <p className="text-xs text-muted-foreground">Use for urgent communications.</p>
                    </div>
                    <Switch
                      checked={threadDraft.isTimeSensitive}
                      onCheckedChange={(v) => setThreadDraft({ ...threadDraft, isTimeSensitive: v })}
                    />
                  </div>

                  {threadDraft.isTimeSensitive ? (
                    <div className="space-y-2">
                      <Label>Expires At</Label>
                      <Input
                        type="datetime-local"
                        value={threadDraft.expiresAt}
                        onChange={(e) => setThreadDraft({ ...threadDraft, expiresAt: e.target.value })}
                      />
                    </div>
                  ) : null}

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setOpenNewThread(false)}>Cancel</Button>
                    <Button onClick={handleCreateThread}>Create</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 items-start">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="w-4 h-4" /> Threads</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="all">
                <TabsList className="mb-4">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="compchat">CompChat</TabsTrigger>
                  <TabsTrigger value="direct">Direct</TabsTrigger>
                </TabsList>
                {threadsError ? (
                  <p className="text-sm text-destructive">Unable to load threads. Try again.</p>
                ) : loadingThreads ? (
                  <p className="text-sm text-muted-foreground">Loading threads...</p>
                ) : (
                  <>
                    <TabsContent value="all">{renderThreadList(grouped.all)}</TabsContent>
                    <TabsContent value="compchat">{renderThreadList(grouped.compchat)}</TabsContent>
                    <TabsContent value="direct">{renderThreadList(grouped.direct)}</TabsContent>
                  </>
                )}
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MessageCircle className="w-4 h-4" /> Conversation</CardTitle>
              <CardDescription>
                {selectedThread ? selectedThread.title : "Select a thread to view messages"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedThread ? (
                <p className="text-sm text-muted-foreground">Pick a thread from the left to start messaging.</p>
              ) : (
                <>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleMarkThreadRead}
                      disabled={!messages.length || markRead.isPending}
                    >
                      <CheckCheck className="w-4 h-4 mr-2" /> Mark Thread Read
                    </Button>
                  </div>

                  <div className="space-y-3 max-h-[420px] overflow-auto pr-1">
                    {messagesError ? (
                      <p className="text-sm text-destructive">Unable to load this conversation.</p>
                    ) : readSummaryError ? (
                      <p className="text-sm text-destructive">Unable to load read status.</p>
                    ) : loadingMessages ? (
                      <p className="text-sm text-muted-foreground">Loading messages...</p>
                    ) : messages.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No messages yet.</p>
                    ) : (
                      messages.map((m) => {
                        const reads = readSummary[m.id];
                        return (
                          <div key={m.id} className="rounded-md border p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium">
                                {m.senderName} <span className="text-xs text-muted-foreground">({m.senderRole})</span>
                              </p>
                              <div className="flex items-center gap-2">
                                {m.isStaffBroadcast ? <Badge><ShieldCheck className="w-3 h-3 mr-1" />Broadcast</Badge> : null}
                                <span className="text-xs text-muted-foreground">{new Date(m.createdAt).toLocaleString()}</span>
                              </div>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                            <p className="text-xs text-muted-foreground">
                              Read: {reads?.count ?? 0}
                              {reads?.readers?.length ? ` • ${reads.readers.join(", ")}` : ""}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="space-y-3 pt-2 border-t">
                    <Textarea
                      rows={3}
                      value={messageDraft}
                      onChange={(e) => setMessageDraft(e.target.value)}
                      placeholder="Type your message..."
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={sendAsStaffBroadcast}
                          onCheckedChange={setSendAsStaffBroadcast}
                          disabled={!canSendCompChatBroadcast}
                        />
                        <span className="text-sm">Send as CompChat broadcast</span>
                      </div>
                      <Button onClick={handleSendMessage} disabled={createMessage.isPending || !actor}>
                        <Send className="w-4 h-4 mr-2" /> Send
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
