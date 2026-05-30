import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import type { MiddlewareHandler } from "npm:hono/types";
import type { User } from "jsr:@supabase/supabase-js@2.49.8";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as kv from "./kv_store.tsx";

const KV_SENSOR_LATEST = "sensor:latest";
const KV_SENSOR_HISTORY = "sensor:history";
const KV_ALERTS = "alerts:list";
const KV_ADMIN_CONFIG = "admin:config";
const MAX_SENSOR_HISTORY = 2000;

type SensorReading = { receivedAt: string; data: Record<string, unknown> };
type AlertRow = {
  id: string;
  type: string;
  severity: string;
  message: string;
  sensorData?: unknown;
  createdAt: string;
  resolved: boolean;
  resolvedAt?: string;
};

function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type AppEnv = { Variables: { user: User } };

const app = new Hono<AppEnv>();

app.use("*", logger(console.log));
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const jwt = authHeader.slice(7);
  const { data: { user }, error } = await serviceClient().auth.getUser(jwt);
  if (error || !user) return c.json({ error: "Unauthorized" }, 401);
  c.set("user", user);
  await next();
};

const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const jwt = authHeader.slice(7);
  const { data: { user }, error } = await serviceClient().auth.getUser(jwt);
  if (error || !user) return c.json({ error: "Unauthorized" }, 401);
  if (user.user_metadata?.role !== "admin") {
    return c.json({ error: "Forbidden" }, 403);
  }
  c.set("user", user);
  await next();
};

app.get("/health", (c) => c.json({ status: "ok" }));

// --- Auth ---

app.get("/auth/me", requireAuth, (c) => {
  const user = c.get("user");
  return c.json({
    id: user.id,
    email: user.email,
    name: user.user_metadata?.name ?? null,
    role: user.user_metadata?.role ?? "user",
  });
});

app.post("/auth/signup", requireAdmin, async (c) => {
  let body: {
    email?: string;
    password?: string;
    name?: string;
    role?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const { email, password, name, role } = body;
  if (!email || !password) {
    return c.json({ error: "email and password required" }, 400);
  }
  const admin = serviceClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: name ?? "", role: role ?? "user" },
  });
  if (error) return c.json({ error: error.message }, 400);
  return c.json({
    user: { id: data.user.id, email: data.user.email },
  });
});

// --- Sensor (ESP32 peut POST sans JWT ; lecture protégée) ---

app.post("/sensor-data", async (c) => {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const data =
    raw !== null && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : { payload: raw };
  const receivedAt = new Date().toISOString();
  const reading: SensorReading = { receivedAt, data };
  await kv.set(KV_SENSOR_LATEST, reading);

  const prev = (await kv.get(KV_SENSOR_HISTORY)) as SensorReading[] | null;
  const history = Array.isArray(prev) ? prev : [];
  history.push(reading);
  const trimmed = history.slice(-MAX_SENSOR_HISTORY);
  await kv.set(KV_SENSOR_HISTORY, trimmed);

  return c.json({ ok: true, receivedAt });
});

app.get("/sensor-data/latest", requireAuth, async (c) => {
  const latest = (await kv.get(KV_SENSOR_LATEST)) as SensorReading | null;
  return c.json(latest ?? null);
});

app.get("/sensor-data/history", requireAuth, async (c) => {
  const hours = Math.min(
    Math.max(Number(c.req.query("hours")) || 24, 1),
    168,
  );
  const limit = Math.min(Math.max(Number(c.req.query("limit")) || 100, 1), 500);
  const history = (await kv.get(KV_SENSOR_HISTORY)) as SensorReading[] | null;
  const list = Array.isArray(history) ? history : [];
  const cutoff = Date.now() - hours * 3600_000;
  const filtered = list
    .filter((r) => new Date(r.receivedAt).getTime() >= cutoff)
    .sort(
      (a, b) =>
        new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime(),
    )
    .slice(0, limit);
  return c.json({ readings: filtered });
});

// --- Alerts ---

app.get("/alerts", requireAuth, async (c) => {
  const raw = (await kv.get(KV_ALERTS)) as AlertRow[] | null;
  const alerts = Array.isArray(raw) ? raw : [];
  return c.json({ alerts });
});

app.post("/alerts", requireAuth, async (c) => {
  let body: {
    type?: string;
    severity?: string;
    message?: string;
    sensorData?: unknown;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const { type, severity, message, sensorData } = body;
  if (!type || !severity || !message) {
    return c.json({ error: "type, severity and message required" }, 400);
  }
  const raw = (await kv.get(KV_ALERTS)) as AlertRow[] | null;
  const alerts = Array.isArray(raw) ? raw : [];
  const row: AlertRow = {
    id: crypto.randomUUID(),
    type,
    severity,
    message,
    sensorData,
    createdAt: new Date().toISOString(),
    resolved: false,
  };
  alerts.unshift(row);
  await kv.set(KV_ALERTS, alerts.slice(0, 500));
  return c.json({ alert: row });
});

app.put("/alerts/:alertId/resolve", requireAuth, async (c) => {
  const alertId = c.req.param("alertId");
  const raw = (await kv.get(KV_ALERTS)) as AlertRow[] | null;
  const alerts = Array.isArray(raw) ? raw : [];
  const idx = alerts.findIndex((a) => a.id === alertId);
  if (idx === -1) return c.json({ error: "Alert not found" }, 404);
  const now = new Date().toISOString();
  alerts[idx] = {
    ...alerts[idx],
    resolved: true,
    resolvedAt: now,
  };
  await kv.set(KV_ALERTS, alerts);
  return c.json({ alert: alerts[idx] });
});

// --- Stats ---

app.get("/stats", requireAuth, async (c) => {
  const latest = (await kv.get(KV_SENSOR_LATEST)) as SensorReading | null;
  const history = (await kv.get(KV_SENSOR_HISTORY)) as SensorReading[] | null;
  const rawAlerts = (await kv.get(KV_ALERTS)) as AlertRow[] | null;
  const alerts = Array.isArray(rawAlerts) ? rawAlerts : [];
  const totalReadings = Array.isArray(history) ? history.length : 0;
  const alertsOpen = alerts.filter((a) => !a.resolved).length;
  return c.json({
    latest: latest ?? null,
    totalReadings,
    alertsOpen,
    alertsTotal: alerts.length,
    lastUpdated: latest?.receivedAt ?? null,
  });
});

// --- Admin ---

app.get("/admin/users", requireAdmin, async (c) => {
  const { data, error } = await serviceClient().auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) return c.json({ error: error.message }, 500);
  const users = data.users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.user_metadata?.name ?? null,
    role: u.user_metadata?.role ?? null,
    created_at: u.created_at,
  }));
  return c.json({ users });
});

app.delete("/admin/users/:userId", requireAdmin, async (c) => {
  const userId = c.req.param("userId");
  const { error } = await serviceClient().auth.admin.deleteUser(userId);
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ ok: true });
});

app.get("/admin/config", requireAdmin, async (c) => {
  const config = (await kv.get(KV_ADMIN_CONFIG)) as Record<
    string,
    unknown
  > | null;
  return c.json(config ?? {});
});

app.put("/admin/config", requireAdmin, async (c) => {
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const existing =
    ((await kv.get(KV_ADMIN_CONFIG)) as Record<string, unknown> | null) ?? {};
  const merged = { ...existing, ...body };
  await kv.set(KV_ADMIN_CONFIG, merged);
  return c.json(merged);
});

Deno.serve(app.fetch);
