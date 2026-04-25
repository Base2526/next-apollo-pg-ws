import { scannerLog } from "../scanner/logger";

type LineSendResult = {
  ok: boolean;
  channel: "messaging-api" | "notify" | "none";
  status?: number;
  body?: string;
};

function lineNotifyToken(): string {
  return process.env.WHALE_LINE_NOTIFY_TOKEN || "";
}

function lineMessagingToken(): string {
  return process.env.WHALE_LINE_CHANNEL_ACCESS_TOKEN || "";
}

function lineMessagingUserId(): string {
  return process.env.WHALE_LINE_USER_ID || "";
}

async function sendWithMessagingApi(message: string): Promise<LineSendResult> {
  const token = lineMessagingToken();
  const userId = lineMessagingUserId();
  if (!token || !userId) return { ok: false, channel: "none" };

  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: "text", text: message.slice(0, 4900) }],
    }),
  });

  const body = await response.text().catch(() => "");
  return {
    ok: response.ok,
    channel: "messaging-api",
    status: response.status,
    body,
  };
}

async function sendWithNotify(message: string): Promise<LineSendResult> {
  const token = lineNotifyToken();
  if (!token) return { ok: false, channel: "none" };

  const payload = new URLSearchParams({ message: message.slice(0, 900) });
  const response = await fetch("https://notify-api.line.me/api/notify", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      Authorization: `Bearer ${token}`,
    },
    body: payload.toString(),
  });

  const body = await response.text().catch(() => "");
  return {
    ok: response.ok,
    channel: "notify",
    status: response.status,
    body,
  };
}

export async function sendLineAlertMessage(message: string): Promise<LineSendResult> {
  const messagingRes = await sendWithMessagingApi(message);
  if (messagingRes.ok) return messagingRes;

  const notifyRes = await sendWithNotify(message);
  if (notifyRes.ok) return notifyRes;

  const reason = messagingRes.channel !== "none" ? messagingRes : notifyRes;
  scannerLog("warn", "line alert not sent", {
    channel: reason.channel,
    status: reason.status,
    body: reason.body?.slice(0, 300),
    hasMessagingToken: Boolean(lineMessagingToken()),
    hasMessagingUser: Boolean(lineMessagingUserId()),
    hasNotifyToken: Boolean(lineNotifyToken()),
  });

  return reason;
}
