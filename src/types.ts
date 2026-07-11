export type Category = "plastic" | "paper" | "can" | "general" | "unknown";
export type Decision = "plastic" | "paper" | "can" | "general" | "hold" | null;
export type ClassificationStatus = "waiting" | "recognizing" | "success" | "hold" | "retry" | "fail";
export type BinKey = "plastic" | "paper" | "can" | "general";
export type BinStatus = "normal" | "warning" | "need_collection";

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error: null | { code?: string; message?: string };
}

export interface DisplayLatest {
  event_id: string | null;
  device_id: string;
  item: string | null;
  category: Category | null;
  decision: Decision;
  status: ClassificationStatus;
  guide: string;
  tts_message: string | null;
  led_color: string;
  weight_g: number;
  carbon_reduction_gco2e: number;
  total_carbon_reduction_gco2e: number;
  created_at: string | null;
}

export interface AdminSummary {
  total_carbon_reduction_gco2e: number;
  total_carbon_reduction_kgco2e?: number;
  today_total_count: number;
  today_success_count: number;
  today_hold_count: number;
  alert_count: number;
  updated_at: string;
}

export interface DisposalLog {
  id: number;
  event_id: string;
  date: string;
  time: string;
  item: string;
  category: Category;
  decision: Decision;
  status: ClassificationStatus;
  weight_g: number;
  carbon_reduction_gco2e: number;
  created_at: string;
}

export interface PaginatedLogs {
  logs: DisposalLog[];
  pagination: { page: number; size: number; total_count: number };
}

export interface CarbonStatistics {
  total_carbon_reduction_gco2e: number;
  total_carbon_reduction_kgco2e?: number;
  by_category: Array<{
    category: Category;
    label: string;
    carbon_reduction_gco2e: number;
    carbon_reduction_kgco2e?: number;
  }>;
  by_hour: Array<{ hour: string; carbon_reduction_gco2e: number; carbon_reduction_kgco2e?: number }>;
  by_date: Array<{ date: string; carbon_reduction_gco2e: number; carbon_reduction_kgco2e?: number }>;
}

export interface BinFill {
  device_id: string;
  bin_fill: Record<BinKey, number>;
  bin_status: Record<BinKey, BinStatus>;
  updated_at: string | null;
}

export interface AlertItem {
  id: number;
  bin: BinKey;
  bin_label: string;
  fill: number;
  level: "warning" | "urgent" | string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface AlertsResponse {
  alerts: AlertItem[];
  unread_count: number;
  pagination: { page: number; size: number; total_count: number };
}

export interface Scenario {
  label: string;
  item: string;
  category: Category;
  decision: Decision;
  status: ClassificationStatus;
  weight_g: number;
  is_wet?: boolean;
  has_content?: boolean;
}
