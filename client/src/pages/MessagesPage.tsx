import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Plus, Send } from "lucide-react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  useConversations,
  useConversationMessages,
  useCreateBroadcastConversation,
  useCreateDirectConversation,
  useMarkRead,
  useSendMessage,
} from "@/hooks/useMessages";

type BroadcastTarget = "all_guardians" | "class";

// Mock recipients data - TODO: Replace with real user list from API
type Recipient = {
  id: string;
  name: string;
  role: string;
};

export default function MessagesPage() {
  const { currentUser } = useAuth();
  const actorRole = currentUser?.role ?? "parent";
  const isGuardian = actorRole === "parent";
  const canCreateBroadcast = actorRole === "owner" || actorRole === "manager" || actorRole === "staff";

  const {
    data: conversations = [],
    isLoading: loadingConversations,
    error: conversationsError,
  } = useConversations();

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [draftBody, setDraftBody] = useState("");
  const [isBroadcastDialogOpen, setBroadcastDialogOpen] = useState(false);
  const [isStartConversationDialogOpen, setIsStartConversationDialogOpen] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null);
  const [broadcastDraft, setBroadcastDraft] = useState<{
    name: string;
    allowParentReplies: boolean;
    target: BroadcastTarget;
    classId: string;
    initialMessage: string;
  }>({
    name: "",
    allowParentReplies: false,
    target: "all_guardians",
    classId: "",
    initialMessage: "",
  });

  // Mock recipients list - TODO: Replace with real user list from API
  const mockRecipients: Recipient[] = [
    { id: "parent-1", name: "Sarah Johnson", role: "parent" },
    { id: "parent-2", name: "Michael Chen", role: "parent" },
    { id: "staff-1", name: "Emma Rodriguez", role: "staff" },
    { id: "manager-1", name: "David Kim", role: "manager" },
    { id: "owner-1", name: "Lisa Thompson", role: "owner" },
  ];

  useEffect(() => {
    if (!conversations.length) {
      setSelectedConversationId(null);
      return;
    }

    if (!selectedConversationId || !conversations.some((c) => c.id === selectedConversationId)) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, selectedConversationId]);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  );

  const {
    data: messages = [],
    isLoading: loadingMessages,
    error: messagesError,
  } = useConversationMessages(selectedConversationId);

  const sendMessage = useSendMessage();
  const markRead = useMarkRead();
  const createBroadcast = useCreateBroadcastConversation();
  const createDirectConversation = useCreateDirectConversation();

  useEffect(() => {
    if (!selectedConversationId || messages.length === 0) {
      return;
    }

    const latest = messages[messages.length - 1];
    if (!latest?.id) return;

    void markRead.mutateAsync({
      conversationId: selectedConversationId,
      lastReadMessageId: latest.id,
    });
  }, [selectedConversationId, messages]);

  const handleSendMessage = async () => {
    if (!selectedConversationId) return;
    const body = draftBody.trim();
    if (!body) return;

    try {
      await sendMessage.mutateAsync({
        conversationId: selectedConversationId,
        body,
      });
      setDraftBody("");
    } catch {
      // handled by UI error state from mutation
    }
  };

  const handleCreateBroadcast = async () => {
    const name = broadcastDraft.name.trim();
    if (!name) return;

    try {
      const created = await createBroadcast.mutateAsync({
        name,
        allowParentReplies: broadcastDraft.allowParentReplies,
        target: broadcastDraft.target,
        classId: broadcastDraft.target === "class" ? broadcastDraft.classId.trim() : undefined,
        initialMessage: broadcastDraft.initialMessage.trim() || undefined,
      });

      setSelectedConversationId(created.id);
      setBroadcastDialogOpen(false);
      setBroadcastDraft({
        name: "",
        allowParentReplies: false,
        target: "all_guardians",
        classId: "",
        initialMessage: "",
      });
    } catch {
      // handled by mutation state
    }
  };

  const handleStartConversation = async () => {
    if (selectedRecipient) {
      try {
        const result = await createDirectConversation.mutateAsync({
          targetUserId: selectedRecipient.id,
        });

        // Update the conversation list by refetching
        // The conversation should now appear in the list
        setSelectedConversationId(result.conversation.id);
        
        // Reset and close the dialog
        setSelectedRecipient(null);
        setIsStartConversationDialogOpen(false);
      } catch (error) {
        console.error("Error creating conversation:", error);
        // Optionally show an error message to the user
      }
    }
  };

 return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-display font-bold">Messages</h1>
            <p className="text-muted-foreground">
              Band-style text messaging for owners/staff and guardians.
            </p>
          </div>

          <div className="flex gap-2">
            {canCreateBroadcast ? (
              <Dialog open={isBroadcastDialogOpen} onOpenChange={setBroadcastDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" /> New broadcast
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create broadcast conversation</DialogTitle>
                    <DialogDescription>
                      Send a text-only broadcast to all guardians or guardians for a class.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Broadcast name</Label>
                      <Input
                        value={broadcastDraft.name}
                        onChange={(event) =>
                          setBroadcastDraft((prev) => ({ ...prev, name: event.target.value }))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Target</Label>
                      <select
                        className="h-10 w-full rounded-md border px-3 text-sm bg-background"
                        value={broadcastDraft.target}
                        onChange={(event) =>
                          setBroadcastDraft((prev) => ({
                            ...prev,
                            target: event.target.value as BroadcastTarget,
                          }))
                        }
                      >
                        <option value="all_guardians">All guardians</option>
                        <option value="class">Class guardians</option>
                      </select>
                    </div>

                    {broadcastDraft.target === "class" ? (
                      <div className="space-y-2">
                        <Label>Class ID</Label>
                        <Input
                          value={broadcastDraft.classId}
                          onChange={(event) =>
                            setBroadcastDraft((prev) => ({ ...prev, classId: event.target.value }))
                          }
                          placeholder="Enter class id"
                        />
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between rounded-md border p-3">
                      <div>
                        <p className="text-sm font-medium">Allow parent replies</p>
                        <p className="text-xs text-muted-foreground">
                          If disabled, guardian replies to this broadcast are rejected.
                        </p>
                      </div>
                      <Switch
                        checked={broadcastDraft.allowParentReplies}
                        onCheckedChange={(checked) =>
                          setBroadcastDraft((prev) => ({ ...prev, allowParentReplies: checked }))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Initial message (optional)</Label>
                      <Textarea
                        rows={3}
                        value={broadcastDraft.initialMessage}
                        onChange={(event) =>
                          setBroadcastDraft((prev) => ({ ...prev, initialMessage: event.target.value }))
                        }
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setBroadcastDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateBroadcast} disabled={createBroadcast.isPending}>
                        Create
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            ) : null}
            
            <Button onClick={() => setIsStartConversationDialogOpen(true)}>
              <MessageSquare className="w-4 h-4 mr-2" /> Start Conversation
            </Button>
          </div>
        </div>

        {/* Start Conversation Dialog */}
        <Dialog open={isStartConversationDialogOpen} onOpenChange={setIsStartConversationDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Start New Conversation</DialogTitle>
              <DialogDescription>
                Select a recipient to start a new conversation with.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Select Recipient</Label>
                <div className="max-h-60 overflow-auto border rounded-md">
                  {mockRecipients.map((recipient) => (
                    <button
                      key={recipient.id}
                      type="button"
                      className={`w-full text-left p-3 hover:bg-accent transition ${
                        selectedRecipient?.id === recipient.id ? 'bg-accent' : ''
                      }`}
                      onClick={() => setSelectedRecipient(recipient)}
                    >
                      <div className="font-medium">{recipient.name}</div>
                      <div className="text-sm text-muted-foreground capitalize">{recipient.role}</div>
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsStartConversationDialogOpen(false);
                    setSelectedRecipient(null);
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleStartConversation}
                  disabled={!selectedRecipient}
                >
                  Continue
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <div className="grid gap-6 lg:grid-cols-[340px,1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Conversations
              </CardTitle>
              <CardDescription>
                {isGuardian
                  ? "You can only see conversations you participate in."
                  : "Broadcast and direct conversation summaries."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {conversationsError ? (
                <p className="text-sm text-destructive">Failed to load conversations.</p>
              ) : loadingConversations ? (
                <p className="text-sm text-muted-foreground">Loading conversations...</p>
              ) : conversations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No conversations yet.</p>
              ) : (
                conversations.map((conversation) => {
                  const isSelected = selectedConversationId === conversation.id;
                  const displayName =
                    conversation.name ||
                    (conversation.type === "direct" ? "Direct conversation" : "Broadcast");

                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => setSelectedConversationId(conversation.id)}
                      className={`w-full rounded-md border p-3 text-left transition ${
                        isSelected ? "border-primary ring-2 ring-primary/30" : "hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{displayName}</p>
                        {conversation.unreadCount > 0 ? (
                          <Badge variant="destructive">{conversation.unreadCount}</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground truncate">
                        {conversation.lastMessagePreview || "No messages yet"}
                      </p>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{selectedConversation?.name || "Conversation"}</CardTitle>
              <CardDescription>
                {selectedConversation
                  ? `${selectedConversation.type} · ${selectedConversation.allowParentReplies ? "parent replies enabled" : "parent replies disabled"}`
                  : "Select a conversation to view messages."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedConversationId ? (
                <p className="text-sm text-muted-foreground">No conversation selected.</p>
              ) : messagesError ? (
                <p className="text-sm text-destructive">Failed to load messages.</p>
              ) : loadingMessages ? (
                <p className="text-sm text-muted-foreground">Loading messages...</p>
              ) : (
                <>
                  <div className="max-h-[480px] space-y-3 overflow-auto pr-1">
                    {messages.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No messages yet.</p>
                    ) : (
                      messages.map((message) => {
                        const mine = message.senderUserId === currentUser?.id;
                        return (
                          <div
                            key={message.id}
                            className={`rounded-md border p-3 ${mine ? "bg-primary/5 border-primary/30" : ""}`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{message.body}</p>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {new Date(message.createdAt).toLocaleString()}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="border-t pt-3 space-y-3">
                    <Textarea
                      value={draftBody}
                      onChange={(event) => setDraftBody(event.target.value)}
                      placeholder="Type a text-only message..."
                      rows={3}
                    />
                    <div className="flex justify-end">
                      <Button onClick={handleSendMessage} disabled={sendMessage.isPending}>
                        <Send className="h-4 w-4 mr-2" /> Send
                      </Button>
                    </div>
                    {sendMessage.error ? (
                      <p className="text-sm text-destructive">
                        {sendMessage.error instanceof Error
                          ? sendMessage.error.message
                          : "Unable to send message."}
                      </p>
                    ) : null}
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
