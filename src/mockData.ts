import type {
  AdminSummary,
  AlertItem,
  AlertsResponse,
  BinCategoryPrediction,
  BinFill,
  BinFillPrediction,
  BinKey,
  CarbonStatistics,
  Confidence,
  DisplayLatest,
  DisposalLog,
  PaginatedLogs,
  Scenario,
} from "./types";
import {
  binLabels,
  binStatus,
  carbonFactors,
  categoryLabels,
  disposalLabel,
  guideFor,
  ledFor,
  nowText,
  shouldAccumulate,
} from "./utils";

const baseTime = new Date("2026-07-05T14:20:00");

export const scenarios: Scenario[] = [
  { label: "물 남은 페트병", item: "물 남은 페트병", category: "plastic", decision: "hold", status: "hold", weight_g: 18, has_content: true },
  { label: "비운 페트병", item: "페트병", category: "plastic", decision: "plastic", status: "success", weight_g: 15 },
  { label: "마른 종이컵", item: "마른 종이컵", category: "paper", decision: "paper", status: "success", weight_g: 5 },
  { label: "젖은 종이컵", item: "젖은 종이컵", category: "paper", decision: "hold", status: "hold", weight_g: 7, is_wet: true },
  { label: "영수증", item: "영수증", category: "general", decision: "general", status: "success", weight_g: 2 },
  { label: "음료가 남아있는 캔", item: "음료가 남아있는 캔", category: "can", decision: "hold", status: "hold", weight_g: 24, has_content: true },
  { label: "비운 캔", item: "캔", category: "can", decision: "can", status: "success", weight_g: 14 },
  { label: "깨진 소주병", item: "깨진 소주병", category: "general", decision: "general", status: "fail", weight_g: 120 },
  { label: "칫솔", item: "칫솔", category: "general", decision: "general", status: "success", weight_g: 9 },
  { label: "우유팩", item: "우유팩", category: "paper", decision: "paper", status: "success", weight_g: 18 },
];

function makeLog(id: number, scenario: Scenario, minuteOffset: number): DisposalLog {
  const date = new Date(baseTime.getTime() + minuteOffset * 60_000);
  const created = nowText(date);
  const carbon =
    shouldAccumulate(scenario.status, scenario.decision) && scenario.decision
      ? Number((scenario.weight_g * carbonFactors[scenario.category]).toFixed(1))
      : 0;
  return {
    id,
    event_id: `mock_${String(id).padStart(4, "0")}`,
    date: created.slice(0, 10),
    time: created.slice(11, 16),
    item: scenario.item,
    category: scenario.category,
    decision: scenario.decision,
    status: scenario.status,
    weight_g: scenario.weight_g,
    carbon_reduction_gco2e: carbon,
    created_at: created,
  };
}

const seedLogs = [
  makeLog(1, scenarios[0], 0),
  makeLog(2, scenarios[1], -4),
  makeLog(3, scenarios[2], -8),
  makeLog(4, scenarios[3], -11),
  makeLog(5, scenarios[4], -13),
  makeLog(6, scenarios[7], -16),
].sort((a, b) => b.created_at.localeCompare(a.created_at));

const seedBinFill: BinFill = {
  device_id: "trash_sorter_001",
  bin_fill: { plastic: 82, paper: 63, can: 45, general: 71 },
  bin_status: { plastic: "need_collection", paper: "warning", can: "normal", general: "warning" },
  updated_at: "2026-07-05 14:32:00",
};

const seedAlerts: AlertItem[] = [
  {
    id: 1,
    bin: "plastic",
    bin_label: "플라스틱함",
    fill: 82,
    level: "warning",
    message: "플라스틱함 적재량 82%, 수거 필요",
    is_read: false,
    created_at: "2026-07-05 14:32:00",
  },
  {
    id: 2,
    bin: "paper",
    bin_label: "종이함",
    fill: 80,
    level: "warning",
    message: "종이함 적재량 80%, 수거 필요",
    is_read: false,
    created_at: "2026-07-05 09:45:00",
  },
];

function addHours(base: string, hours: number): string {
  return nowText(new Date(new Date(base.replace(" ", "T")).getTime() + hours * 3_600_000));
}

function buildCategoryPrediction(
  current: number,
  ratePerHour: number,
  r2: number,
  latestAt: string,
  avgCycleDays: number | null,
  avgPercentPerThrow: number | null,
): BinCategoryPrediction {
  const sampleSize = 6;
  const history = Array.from({ length: sampleSize }, (_, i) => {
    const stepsBack = sampleSize - 1 - i;
    return {
      created_at: addHours(latestAt, -stepsBack * 3),
      fill_percent: Number(Math.max(0, Math.min(100, current - ratePerHour * stepsBack * 3)).toFixed(1)),
    };
  });
  const confidence: Confidence = r2 >= 0.7 ? "high" : r2 >= 0.4 ? "medium" : "low";
  const etaFor = (target: number) => {
    if (current >= target) return latestAt;
    return addHours(latestAt, (target - current) / ratePerHour);
  };
  const status = current >= 100 ? "already_over_threshold" : ratePerHour <= 0 ? "flat_or_decreasing" : "predicting";
  const remainingThrows =
    status === "already_over_threshold" ? 0 : status === "predicting" && avgPercentPerThrow ? Math.ceil((100 - current) / avgPercentPerThrow) : null;
  return {
    current_fill_percent: current,
    sample_size: sampleSize,
    window_start_at: history[0].created_at,
    latest_at: latestAt,
    fill_rate_percent_per_hour: ratePerHour,
    r_squared: r2,
    confidence,
    status,
    eta_80_percent_at: status === "predicting" ? etaFor(80) : status === "already_over_threshold" ? latestAt : null,
    eta_100_percent_at: status === "predicting" ? etaFor(100) : status === "already_over_threshold" ? latestAt : null,
    avg_cycle_days: avgCycleDays,
    remaining_throws: remainingThrows,
    history,
  };
}

function binFillPrediction(): BinFillPrediction {
  const latestAt = binFill.updated_at || nowText();
  return {
    device_id: binFill.device_id,
    generated_at: nowText(),
    categories: {
      plastic: buildCategoryPrediction(binFill.bin_fill.plastic, 1.8, 0.93, latestAt, 18, 1.2),
      paper: buildCategoryPrediction(binFill.bin_fill.paper, 0.9, 0.55, latestAt, 18, 0.9),
      can: buildCategoryPrediction(binFill.bin_fill.can, -0.1, 0.2, latestAt, null, null),
      general: buildCategoryPrediction(binFill.bin_fill.general, 1.1, 0.5, latestAt, 18, 1.0),
    },
  };
}

let logs = [...seedLogs];
let binFill = { ...seedBinFill };
let alerts = [...seedAlerts];
let latest = latestFromLog(logs[0]);

function latestFromLog(log: DisposalLog): DisplayLatest {
  const guide = guideFor(log.decision, log.status, log.item);
  return {
    event_id: log.event_id,
    device_id: "trash_sorter_001",
    item: log.item,
    category: log.category,
    decision: log.decision,
    status: log.status,
    guide,
    tts_message: log.status === "success" ? "분리수거에 성공했습니다." : "대시보드에 표시된 분리배출 방법을 확인해주세요.",
    led_color: ledFor(log.decision, log.status),
    weight_g: log.weight_g,
    carbon_reduction_gco2e: log.carbon_reduction_gco2e,
    total_carbon_reduction_gco2e: totalCarbon(),
    created_at: log.created_at,
  };
}

function totalCarbon(): number {
  return Number(logs.reduce((sum, log) => sum + log.carbon_reduction_gco2e, 0).toFixed(1));
}

function summary(): AdminSummary {
  const total = logs.length;
  const success = logs.filter((log) => log.status === "success").length;
  const hold = logs.filter((log) => log.status === "hold").length;
  return {
    total_carbon_reduction_gco2e: totalCarbon(),
    total_carbon_reduction_kgco2e: Number((totalCarbon() / 1000).toFixed(3)),
    today_total_count: total,
    today_success_count: success,
    today_hold_count: hold,
    alert_count: alerts.filter((alert) => !alert.is_read).length,
    updated_at: nowText(),
  };
}

function carbonStats(): CarbonStatistics {
  const byCategory = (["plastic", "paper", "can", "general"] as const).map((category) => ({
    category,
    label: categoryLabels[category],
    carbon_reduction_gco2e: Number(logs.filter((log) => log.category === category).reduce((sum, log) => sum + log.carbon_reduction_gco2e, 0).toFixed(1)),
    carbon_reduction_kgco2e: 0,
  }));
  const byHour = Array.from(
    logs.reduce((map, log) => {
      const hour = `${log.created_at.slice(11, 13)}:00`;
      map.set(hour, (map.get(hour) || 0) + log.carbon_reduction_gco2e);
      return map;
    }, new Map<string, number>()),
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, value]) => ({ hour, carbon_reduction_gco2e: Number(value.toFixed(1)), carbon_reduction_kgco2e: Number((value / 1000).toFixed(3)) }));
  const byDate = Array.from(
    logs.reduce((map, log) => {
      map.set(log.date, (map.get(log.date) || 0) + log.carbon_reduction_gco2e);
      return map;
    }, new Map<string, number>()),
  ).map(([date, value]) => ({ date, carbon_reduction_gco2e: Number(value.toFixed(1)), carbon_reduction_kgco2e: Number((value / 1000).toFixed(3)) }));
  return {
    total_carbon_reduction_gco2e: totalCarbon(),
    total_carbon_reduction_kgco2e: Number((totalCarbon() / 1000).toFixed(3)),
    by_category: byCategory,
    by_hour: byHour,
    by_date: byDate,
  };
}

export const mockApi = {
  latest: async () => ({ ...latest, total_carbon_reduction_gco2e: totalCarbon() }),
  summary: async () => summary(),
  logs: async ({ page = 1, size = 20, date }: { page?: number; size?: number; date?: string } = {}): Promise<PaginatedLogs> => {
    const filtered = date ? logs.filter((log) => log.date === date) : logs;
    return { logs: filtered.slice((page - 1) * size, page * size), pagination: { page, size, total_count: filtered.length } };
  },
  carbon: async () => carbonStats(),
  binFill: async () => binFill,
  binFillPrediction: async () => binFillPrediction(),
  alerts: async ({ page = 1, size = 20, unreadOnly = false }: { page?: number; size?: number; unreadOnly?: boolean } = {}): Promise<AlertsResponse> => {
    const filtered = unreadOnly ? alerts.filter((alert) => !alert.is_read) : alerts;
    return {
      alerts: filtered.slice((page - 1) * size, page * size),
      unread_count: alerts.filter((alert) => !alert.is_read).length,
      pagination: { page, size, total_count: filtered.length },
    };
  },
  readAlert: async (alertId: number) => {
    alerts = alerts.map((alert) => (alert.id === alertId ? { ...alert, is_read: true } : alert));
    return { id: alertId, is_read: true, updated_at: nowText() };
  },
  applyScenario: async (scenario: Scenario) => {
    const id = logs.length ? Math.max(...logs.map((log) => log.id)) + 1 : 1;
    const log = makeLog(id, scenario, id);
    if (!logs.some((existing) => existing.event_id === log.event_id)) logs = [log, ...logs];
    latest = latestFromLog(log);
    return latest;
  },
  setBinFill: async (next: Record<BinKey, number>) => {
    binFill = {
      device_id: "trash_sorter_001",
      bin_fill: next,
      bin_status: {
        plastic: binStatus(next.plastic),
        paper: binStatus(next.paper),
        can: binStatus(next.can),
        general: binStatus(next.general),
      },
      updated_at: nowText(),
    };
    (Object.keys(next) as BinKey[]).forEach((key) => {
      if (next[key] >= 80 && !alerts.some((alert) => !alert.is_read && alert.bin === key)) {
        alerts = [
          {
            id: Math.max(0, ...alerts.map((alert) => alert.id)) + 1,
            bin: key,
            bin_label: binLabels[key],
            fill: next[key],
            level: "warning",
            message: `${binLabels[key]} 적재량 ${next[key]}%, 수거 필요`,
            is_read: false,
            created_at: nowText(),
          },
          ...alerts,
        ];
      }
    });
    return binFill;
  },
};