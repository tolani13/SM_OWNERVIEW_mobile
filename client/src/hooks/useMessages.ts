import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";

export type MessagingConversationType = "broadcast" | "direct";

export type ConversationSummary = {
  id: string;
  type: MessagingConversationType;
  name: string | null;
  allowParentReplies: boolean;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
};

export type ConversationMessage = {
  id: string;
  conversationId: string;
  studioId: string;
  senderUserId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

type DirectConversationResponse = {
  conversation: {
    id: string;
    studioId: string;
    type: MessagingConversationType;
    name: string | null;
    allowParentReplies: boolean;
    createdByUserId: string;
    createdAt: string;
    updatedAt: string;
    archivedAt: string | null;
  };
  firstMessage: ConversationMessage | null;
};

type BroadcastConversationResponse = {
  id: string;
  studioId: string;
  type: MessagingConversationType;
  name: string | null;
  allowParentReplies: boolean;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

const MESSAGING_HEADERS = {
  "Content-Type": "application/json",
} as const;

function buildActorHeaders(user: { id: string; name: string; role: string } | null): HeadersInit {
  if (!user) return MESSAGING_HEADERS;
  return {
    ...MESSAGING_HEADERS,
    "x-user-id": user.id,
    "x-user-name": user.name,
    "x-user-role": user.role,
  };
}

async function readErrorText(res: Response): Promise<string> {
  const text = await res.text();
  if (!text) return `Request failed: ${res.status}`;

  try {
    const parsed = JSON.parse(text) as { error?: unknown };
    if (typeof parsed.error === "string" && parsed.error.trim()) {
      return parsed.error;
    }
  } catch {
    // no-op
  }

  return text;
}

async function fetchWithUser<T>(
  url: string,
  user: { id: string; name: string; role: string } | null,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...buildActorHeaders(user),
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    throw new Error(await readErrorText(res));
  }

  return res.json() as Promise<T>;
}

export function useConversations() {
  const { currentUser } = useAuth();

  return useQuery({
    queryKey: ["messaging", "conversations", currentUser?.id ?? null],
    queryFn: async () =>
      fetchWithUser<ConversationSummary[]>("/api/messages/conversations", currentUser),
    enabled: Boolean(currentUser),
    placeholderData: [],
  });
}

export function useConversationMessages(
  conversationId: string | null,
  options?: { limit?: number; before?: string; after?: string },
) {
  const { currentUser } = useAuth();

  return useQuery({
    queryKey: ["messaging", "conversation", conversationId ?? null, options ?? null],
    queryFn: async () => {
      const query = new URLSearchParams();
      if (typeof options?.limit === "number") query.set("limit", String(options.limit));
      if (options?.before) query.set("before", options.before);
      if (options?.after) query.set("after", options.after);

      const suffix = query.toString() ? `?${query.toString()}` : "";
      return fetchWithUser<ConversationMessage[]>(
        `/api/messages/conversations/${conversationId}${suffix}`,
        currentUser,
      );
    },
    enabled: Boolean(currentUser && conversationId),
    placeholderData: [],
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  return useMutation({
    mutationFn: async (input: { conversationId: string; body: string }) =>
      fetchWithUser<ConversationMessage>(
        `/api/messages/conversations/${input.conversationId}/messages`,
        currentUser,
        {
          method: "POST",
          body: JSON.stringify({ body: input.body }),
        },
      ),
    onSuccess: (_message, variables) => {
      queryClient.invalidateQueries({ queryKey: ["messaging", "conversations"] });
      queryClient.invalidateQueries({
        queryKey: ["messaging", "conversation", variables.conversationId],
      });
    },
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  return useMutation({
    mutationFn: async (input: { conversationId: string; lastReadMessageId: string }) =>
      fetchWithUser<{ updatedAt: string }>(
        `/api/messages/conversations/${input.conversationId}/read`,
        currentUser,
        {
          method: "POST",
          body: JSON.stringify({ lastReadMessageId: input.lastReadMessageId }),
        },
      ),
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({ queryKey: ["messaging", "conversations"] });
      queryClient.invalidateQueries({
        queryKey: ["messaging", "conversation", variables.conversationId],
      });
    },
  });
}

export function useCreateDirectConversation() {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  return useMutation({
    mutationFn: async (input: { targetUserId: string; initialMessage?: string }) =>
      fetchWithUser<DirectConversationResponse>(
        "/api/messages/conversations/direct",
        currentUser,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messaging", "conversations"] });
    },
  });
}

export function useCreateBroadcastConversation() {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      name: string;
      allowParentReplies: boolean;
      target: "all_guardians" | "class";
      classId?: string;
      initialMessage?: string;
    }) =>
      fetchWithUser<BroadcastConversationResponse>(
        "/api/messages/conversations/broadcast",
        currentUser,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messaging", "conversations"] });
    },
  });
}
