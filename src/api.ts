import { API_BASE_URL } from "./config";
import type {
  AdminSummary,
  AlertsResponse,
  ApiEnvelope,
  BinFill,
  BinFillPrediction,
  CarbonStatistics,
  DisplayLatest,
  PaginatedLogs,
} from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!payload.success) throw new Error(payload.error?.message || "API 요청에 실패했습니다.");
  return payload.data;
}

export const api = {
  latest: () => request<DisplayLatest>("/api/display/latest"),
  summary: () => request<AdminSummary>("/api/admin/summary"),
  logs: (params: { date?: string; page?: number; size?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.date) query.set("date", params.date);
    if (params.page) query.set("page", String(params.page));
    if (params.size) query.set("size", String(params.size));
    return request<PaginatedLogs>(`/api/admin/disposal-logs?${query.toString()}`);
  },
  carbon: (params: { from?: string; to?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.from) query.set("from", params.from);
    if (params.to) query.set("to", params.to);
    return request<CarbonStatistics>(`/api/admin/carbon-statistics?${query.toString()}`);
  },
  binFill: () => request<BinFill>("/api/admin/bin-fill"),
  binFillPrediction: () => request<BinFillPrediction>("/api/admin/bin-fill-prediction"),
  alerts: (params: { unreadOnly?: boolean; page?: number; size?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.unreadOnly !== undefined) query.set("unread_only", String(params.unreadOnly));
    if (params.page) query.set("page", String(params.page));
    if (params.size) query.set("size", String(params.size));
    return request<AlertsResponse>(`/api/admin/alerts?${query.toString()}`);
  },
  readAlert: (alertId: number) => request<{ id: number; is_read: boolean; updated_at: string }>(`/api/admin/alerts/${alertId}/read`, { method: "PATCH" }),
};
