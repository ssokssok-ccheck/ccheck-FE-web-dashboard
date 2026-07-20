import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Calendar,
  Check,
  ChevronRight,
  CircleGauge,
  Clock3,
  Gauge,
  Info,
  LayoutDashboard,
  Leaf,
  LineChart,
  ListFilter,
  PackageCheck,
  Recycle,
  Settings,
  Trash2,
  UserRound,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart as ReLineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "./api";
import { POLL_INTERVAL_MS, SHOW_TEST_PANEL, USE_MOCK } from "./config";
import { mockApi, scenarios } from "./mockData";
import type {
  AdminSummary,
  AlertItem,
  AlertsResponse,
  BinCategoryPrediction,
  BinFill,
  BinFillPrediction,
  BinKey,
  CarbonStatistics,
  ClassificationStatus,
  Decision,
  DisplayLatest,
  DisposalLog,
  PaginatedLogs,
  Scenario,
} from "./types";
import {
  binLabels,
  binStatusLabel,
  categoryLabels,
  clampPercent,
  disposalLabel,
  formatCount,
  formatG,
  formatKgFromG,
  formatKgNumberFromG,
  readableDateTime,
  statusLabel,
  successRate,
} from "./utils";

type Page = "dashboard" | "display" | "logs" | "carbon" | "bins" | "alerts";
type LoadState = "loading" | "ready" | "error";
type TrendRange = "day" | "week" | "month";

const client = USE_MOCK ? mockApi : api;
const pageTitles: Record<Page, { title: string; description: string }> = {
  dashboard: { title: "웹 대시보드", description: "AI 기반 분리배출 모니터링 및 탄소 절감 현황" },
  display: { title: "실시간 분류", description: "검사 트레이의 최신 분리배출 안내 화면" },
  logs: { title: "배출 로그", description: "분리배출 기록과 상태를 확인합니다" },
  carbon: { title: "탄소 분석", description: "품목별, 시간대별 탄소 절감량을 분석합니다" },
  bins: { title: "수거함 상태", description: "수거함별 현재 적재량과 수거 필요 여부" },
  alerts: { title: "알림", description: "적재량 경고와 확인이 필요한 알림" },
};

const categoryColors: Record<string, string> = {
  plastic: "#13a93f",
  paper: "#b6c92f",
  can: "#4f8fd9",
  general: "#9ca3af",
  unknown: "#cbd5e1",
};

const navItems: Array<{ page: Page; label: string; icon: typeof LayoutDashboard }> = [
  { page: "dashboard", label: "대시보드", icon: LayoutDashboard },
  { page: "display", label: "실시간 분류", icon: PackageCheck },
  { page: "logs", label: "배출 로그", icon: ListFilter },
  { page: "carbon", label: "탄소 분석", icon: BarChart3 },
  { page: "bins", label: "수거함 상태", icon: Trash2 },
  { page: "alerts", label: "알림", icon: Bell },
];

function pathToPage(): Page {
  const segment = window.location.pathname.replace("/", "") as Page;
  return pageTitles[segment] ? segment : "dashboard";
}

function App() {
  const [page, setPage] = useState<Page>(pathToPage);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [logs, setLogs] = useState<DisposalLog[]>([]);
  const [carbon, setCarbon] = useState<CarbonStatistics | null>(null);
  const [binFill, setBinFill] = useState<BinFill | null>(null);
  const [prediction, setPrediction] = useState<BinFillPrediction | null>(null);
  const [alerts, setAlerts] = useState<AlertsResponse | null>(null);
  const [latest, setLatest] = useState<DisplayLatest | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [trendRange, setTrendRange] = useState<TrendRange>("day");
  const [dateFilter, setDateFilter] = useState("");

  async function refresh() {
    try {
      const [nextSummary, nextLogs, nextCarbon, nextBinFill, nextPrediction, nextAlerts, nextLatest] = await Promise.all([
        client.summary(),
        client.logs({ page: 1, size: 20, date: dateFilter || undefined }),
        client.carbon(),
        client.binFill(),
        client.binFillPrediction(),
        client.alerts({ page: 1, size: 20 }),
        client.latest(),
      ]);
      setSummary(nextSummary);
      setLogs(nextLogs.logs);
      setCarbon(nextCarbon);
      setBinFill(nextBinFill);
      setPrediction(nextPrediction);
      setAlerts(nextAlerts);
      setLatest(nextLatest);
      setState("ready");
      setError("");
    } catch (refreshError) {
      setState("error");
      setError(refreshError instanceof Error ? refreshError.message : "데이터를 불러오지 못했습니다.");
    }
  }

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [dateFilter]);

  useEffect(() => {
    const onPop = () => setPage(pathToPage());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = (next: Page) => {
    setPage(next);
    window.history.pushState(null, "", `/${next}`);
  };

  const readAlert = async (alertId: number) => {
    await client.readAlert(alertId);
    await refresh();
  };

  const applyScenario = async (scenario: Scenario) => {
    if (USE_MOCK) {
      await mockApi.applyScenario(scenario);
      await refresh();
    }
  };

  const pageInfo = pageTitles[page];
  const unreadCount = alerts?.unread_count || summary?.alert_count || 0;

  return (
    <div className="app-shell">
      <Sidebar page={page} unreadCount={unreadCount} onNavigate={navigate} />
      <main className="main-shell">
        <Header
          title={pageInfo.title}
          description={pageInfo.description}
          unreadCount={unreadCount}
          alerts={alerts?.alerts || []}
          open={popoverOpen}
          onToggle={() => setPopoverOpen((value) => !value)}
          onReadAlert={readAlert}
        />
        {state === "loading" && <LoadingState />}
        {state === "error" && <ErrorState message={error} onRetry={refresh} />}
        {state === "ready" && (
          <>
            {page === "dashboard" && (
              <DashboardPage
                summary={summary}
                logs={logs}
                carbon={carbon}
                binFill={binFill}
                alerts={alerts?.alerts || []}
                trendRange={trendRange}
                onTrendRange={setTrendRange}
                onNavigate={navigate}
                onReadAlert={readAlert}
              />
            )}
            {page === "display" && <DisplayPage latest={latest} onApplyScenario={applyScenario} />}
            {page === "logs" && <LogsPage logs={logs} dateFilter={dateFilter} onDateFilter={setDateFilter} />}
            {page === "carbon" && <CarbonPage carbon={carbon} trendRange={trendRange} onTrendRange={setTrendRange} />}
            {page === "bins" && <BinsPage binFill={binFill} prediction={prediction} />}
            {page === "alerts" && <AlertsPage alerts={alerts?.alerts || []} onReadAlert={readAlert} />}
          </>
        )}
      </main>
    </div>
  );
}

function Sidebar({ page, unreadCount, onNavigate }: { page: Page; unreadCount: number; onNavigate: (page: Page) => void }) {
  return (
    <aside className="sidebar">
      <div className="brand-block">
        <img src="/CCheck.jpg" alt="쏙쏙이 CCheck" />
        <strong>쏙쏙이 CCheck</strong>
      </div>
      <nav className="nav-list" aria-label="주요 메뉴">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.page} className={page === item.page ? "active" : ""} onClick={() => onNavigate(item.page)}>
              <Icon size={21} />
              <span>{item.label}</span>
              {item.page === "alerts" && unreadCount > 0 && <b>{unreadCount}</b>}
            </button>
          );
        })}
      </nav>
      <div className="eco-panel">
        <strong>AI로 지구를 지켜요</strong>
        <p>똑똑한 분리배출이 더 깨끗한 미래를 만듭니다.</p>
        <Leaf size={74} />
      </div>
      <div className="profile-row">
        <span>
          <UserRound size={24} />
        </span>
        <div>
          <strong>관리자</strong>
          <p>admin@ccheck.ai</p>
        </div>
        <ChevronRight size={18} />
      </div>
    </aside>
  );
}

function Header({
  title,
  description,
  unreadCount,
  alerts,
  open,
  onToggle,
  onReadAlert,
}: {
  title: string;
  description: string;
  unreadCount: number;
  alerts: AlertItem[];
  open: boolean;
  onToggle: () => void;
  onReadAlert: (id: number) => void;
}) {
  const today = new Date();
  return (
    <header className="top-header">
      <div>
        <h1>
          {title} <Leaf size={24} />
        </h1>
        <p>{description}</p>
      </div>
      <div className="header-actions">
        <div className="date-pill">
          <Calendar size={19} />
          <span>{today.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}</span>
          <Clock3 size={19} />
          <span>{today.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        <button className="icon-button" aria-label="알림 열기" onClick={onToggle}>
          <Bell size={26} />
          {unreadCount > 0 && <b>{unreadCount}</b>}
        </button>
        {open && <AlertPopover alerts={alerts.slice(0, 4)} onReadAlert={onReadAlert} />}
      </div>
    </header>
  );
}

function DashboardPage(props: {
  summary: AdminSummary | null;
  logs: DisposalLog[];
  carbon: CarbonStatistics | null;
  binFill: BinFill | null;
  alerts: AlertItem[];
  trendRange: TrendRange;
  onTrendRange: (range: TrendRange) => void;
  onNavigate: (page: Page) => void;
  onReadAlert: (id: number) => void;
}) {
  const rate = successRate(props.summary?.today_total_count || 0, props.summary?.today_success_count || 0);
  return (
    <section className="dashboard-grid">
      <div className="summary-row">
        <SummaryCard icon={Leaf} label="총 누적 탄소 절감량" value={formatKgFromG(props.summary?.total_carbon_reduction_gco2e)} hint="오늘 추가 절감량 기준" tone="green" />
        <SummaryCard icon={Recycle} label="오늘 배출 건수" value={formatCount(props.summary?.today_total_count)} hint="어제보다 +18건" tone="mint" />
        <SummaryCard icon={Check} label="오늘 분류 성공률" value={`${rate}%`} hint="어제보다 +4%p" tone="green" />
        <SummaryCard icon={Bell} label="알림" value={formatCount(props.summary?.alert_count)} hint="확인 필요" tone="red" />
      </div>
      <div className="chart-row">
        <CarbonContributionChart carbon={props.carbon} />
        <CarbonTrendChart carbon={props.carbon} range={props.trendRange} onRange={props.onTrendRange} />
        <RecentAlerts alerts={props.alerts} onNavigate={() => props.onNavigate("alerts")} onReadAlert={props.onReadAlert} />
      </div>
      <div className="bottom-row">
        <BinFillStatus binFill={props.binFill} compact onNavigate={() => props.onNavigate("bins")} />
        <RecentLogs logs={props.logs.slice(0, 6)} onNavigate={() => props.onNavigate("logs")} />
        <AiInsightCard rate={rate} />
      </div>
    </section>
  );
}

function SummaryCard({ icon: Icon, label, value, hint, tone }: { icon: typeof Leaf; label: string; value: string; hint: string; tone: "green" | "mint" | "red" }) {
  return (
    <article className={`summary-card ${tone}`}>
      <span className="summary-icon">
        <Icon size={34} />
      </span>
      <div>
        <p>
          {label} <Info size={15} />
        </p>
        <strong>{value}</strong>
        <small>{hint}</small>
      </div>
    </article>
  );
}

function CarbonContributionChart({ carbon }: { carbon: CarbonStatistics | null }) {
  const data = (carbon?.by_category || []).filter((item) => item.carbon_reduction_gco2e > 0);
  const total = carbon?.total_carbon_reduction_gco2e || 0;
  return (
    <section className="panel contribution-panel">
      <PanelTitle title="품목별 탄소 감축 기여도" />
      {data.length === 0 ? (
        <EmptyState text="탄소 감축 데이터가 없습니다." />
      ) : (
        <div className="donut-layout">
          <div className="donut-chart-slot">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data} dataKey="carbon_reduction_gco2e" nameKey="label" innerRadius={52} outerRadius={88} paddingAngle={1}>
                  {data.map((entry) => (
                    <Cell key={entry.category} fill={categoryColors[entry.category]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}gCO₂e`, "감축량"]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="donut-center">
            <span>총 절감량</span>
            <strong>{formatKgNumberFromG(total)}</strong>
            <small>kgCO₂e</small>
          </div>
          <div className="legend-list">
            {data.map((item) => (
              <p key={item.category}>
                <i style={{ background: categoryColors[item.category] }} />
                <span>{item.label}</span>
                <b>{formatG(item.carbon_reduction_gco2e)}</b>
              </p>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function CarbonTrendChart({ carbon, range, onRange }: { carbon: CarbonStatistics | null; range: TrendRange; onRange: (range: TrendRange) => void }) {
  const data = useMemo(() => {
    if (range === "day") {
      return (carbon?.by_hour || []).map((item) => ({
        label: item.hour,
        kg: Number((item.carbon_reduction_gco2e / 1000).toFixed(3)),
      }));
    }

    const byDate = [...(carbon?.by_date || [])].sort((a, b) => a.date.localeCompare(b.date));
    if (range === "week") {
      return byDate.slice(-7).map((item) => ({
        label: item.date.slice(5),
        kg: Number((item.carbon_reduction_gco2e / 1000).toFixed(3)),
      }));
    }

    const monthly = byDate.reduce((map, item) => {
      const month = item.date.slice(0, 7);
      map.set(month, (map.get(month) || 0) + item.carbon_reduction_gco2e);
      return map;
    }, new Map<string, number>());

    return Array.from(monthly.entries()).map(([month, value]) => ({
      label: month.slice(2),
      kg: Number((value / 1000).toFixed(3)),
    }));
  }, [carbon, range]);
  const title = range === "day" ? "일일 탄소 절감 추이" : range === "week" ? "주간 탄소 절감 추이" : "월간 탄소 절감 추이";
  return (
    <section className="panel trend-panel">
      <PanelTitle title={title}>
        <div className="segmented">
          {(["day", "week", "month"] as const).map((item) => (
            <button key={item} className={range === item ? "active" : ""} onClick={() => onRange(item)}>
              {item === "day" ? "일간" : item === "week" ? "주간" : "월간"}
            </button>
          ))}
        </div>
      </PanelTitle>
      {data.length === 0 ? (
        <EmptyState text="추이 데이터가 없습니다." />
      ) : (
        <ResponsiveContainer width="100%" height={230}>
          <AreaChart data={data} margin={{ left: 0, right: 18, top: 12, bottom: 0 }}>
            <defs>
              <linearGradient id="greenArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#14aa42" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#14aa42" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 5" stroke="#dce9e1" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
            <Tooltip formatter={(value) => [`${Number(value).toFixed(3)} kgCO₂e`, "탄소 절감량"]} />
            <Area type="monotone" dataKey="kg" stroke="#0aa13c" strokeWidth={3} fill="url(#greenArea)" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}

function BinFillStatus({ binFill, compact = false, onNavigate }: { binFill: BinFill | null; compact?: boolean; onNavigate?: () => void }) {
  const entries = (["plastic", "paper", "can", "general"] as BinKey[]).map((key) => ({
    key,
    fill: clampPercent(binFill?.bin_fill[key]),
    status: binFill?.bin_status[key] || "normal",
  }));
  return (
    <section className={`panel bin-panel ${compact ? "compact" : ""}`}>
      <PanelTitle title="수거함 적재량 상태">
        {onNavigate && <button className="text-button" onClick={onNavigate}>수거함 관리 <ChevronRight size={16} /></button>}
      </PanelTitle>
      <div className="bin-list">
        {entries.map((entry) => (
          <div key={entry.key} className={`bin-row ${entry.status}`}>
            <div className="bin-meta">
              <Trash2 size={22} />
              <strong>{binLabels[entry.key]}</strong>
            </div>
            <div className="progress-track">
              <span style={{ width: `${entry.fill}%` }} />
            </div>
            <b>{entry.fill}%</b>
            <em>{binStatusLabel(entry.status)}</em>
          </div>
        ))}
      </div>
    </section>
  );
}

const confidenceLabels: Record<string, string> = { high: "높음", medium: "보통", low: "낮음" };

function buildPredictionChartData(prediction: BinCategoryPrediction) {
  const points = prediction.history.map((point) => ({
    t: point.created_at,
    actual: point.fill_percent as number | null,
    projected: null as number | null,
  }));
  const lastPoint = points[points.length - 1];
  if (lastPoint && prediction.status === "predicting" && prediction.eta_100_percent_at) {
    lastPoint.projected = lastPoint.actual;
    points.push({ t: prediction.eta_100_percent_at, actual: null, projected: 100 });
  }
  return points;
}

function BinFillPredictionCard({ label, prediction }: { label: string; prediction: BinCategoryPrediction | null }) {
  const data = useMemo(() => (prediction ? buildPredictionChartData(prediction) : []), [prediction]);

  if (!prediction || prediction.status === "insufficient_data") {
    return (
      <div className="prediction-card">
        <div className="prediction-card-head">
          <strong>{label}</strong>
        </div>
        <EmptyState text="예측에 필요한 데이터가 아직 부족합니다." />
      </div>
    );
  }

  return (
    <div className="prediction-card">
      <div className="prediction-card-head">
        <strong>{label}</strong>
        {prediction.confidence && (
          <span className={`confidence-badge ${prediction.confidence}`}>신뢰도 {confidenceLabels[prediction.confidence]}</span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id={`predictionArea-${label}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0aa13c" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#0aa13c" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 5" stroke="#dce9e1" />
          <XAxis dataKey="t" tickFormatter={(value) => readableDateTime(value).slice(5)} tickLine={false} axisLine={false} minTickGap={28} />
          <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={30} />
          <Tooltip
            labelFormatter={(value) => readableDateTime(value as string)}
            formatter={(value: number, name: string) => [`${Number(value).toFixed(1)}%`, name === "actual" ? "실측" : "예측"]}
          />
          <ReferenceLine y={80} stroke="#f08a18" strokeDasharray="4 4" />
          <Area type="monotone" dataKey="actual" stroke="#0aa13c" strokeWidth={3} fill={`url(#predictionArea-${label})`} />
          <Area type="monotone" dataKey="projected" stroke="#0aa13c" strokeWidth={2} strokeDasharray="5 4" fill="none" />
        </AreaChart>
      </ResponsiveContainer>
      {prediction.status === "flat_or_decreasing" && (
        <p className="prediction-note">적재량이 증가하지 않고 있어 도달 시점을 예측할 수 없습니다.</p>
      )}
      {prediction.status === "predicting" && prediction.remaining_throws !== null && (
        <p className="prediction-highlight">
          <Recycle size={16} />
          <span>
            약 <strong>{prediction.remaining_throws}번</strong> 더 배출하면 가득 찹니다
          </span>
        </p>
      )}
      <div className="prediction-metrics">
        <Metric label="시간당 증가율" value={prediction.fill_rate_percent_per_hour !== null ? `${prediction.fill_rate_percent_per_hour}%/h` : "-"} />
        <Metric label="80% 도달 예상" value={readableDateTime(prediction.eta_80_percent_at)} />
        <Metric label="100% 도달 예상" value={readableDateTime(prediction.eta_100_percent_at)} />
        <Metric label="평균 수거 주기" value={prediction.avg_cycle_days !== null ? `약 ${prediction.avg_cycle_days}일` : "데이터 부족"} />
      </div>
    </div>
  );
}

function BinFillPredictionPanel({ prediction }: { prediction: BinFillPrediction | null }) {
  return (
    <section className="panel prediction-panel">
      <PanelTitle title="수거함 포화도 예측" />
      <div className="prediction-grid">
        {(["plastic", "paper", "can", "general"] as BinKey[]).map((key) => (
          <BinFillPredictionCard key={key} label={binLabels[key]} prediction={prediction?.categories[key] ?? null} />
        ))}
      </div>
    </section>
  );
}

function RecentLogs({ logs, onNavigate }: { logs: DisposalLog[]; onNavigate?: () => void }) {
  return (
    <section className="panel logs-panel">
      <PanelTitle title="최근 분리배출 로그">
        {onNavigate && <button className="text-button" onClick={onNavigate}>모두 보기 <ChevronRight size={16} /></button>}
      </PanelTitle>
      <LogsTable logs={logs} />
    </section>
  );
}

function RecentAlerts({ alerts, onNavigate, onReadAlert }: { alerts: AlertItem[]; onNavigate: () => void; onReadAlert: (id: number) => void }) {
  return (
    <section className="panel alerts-panel">
      <PanelTitle title="최근 알림">
        <button className="text-button" onClick={onNavigate}>모두 보기 <ChevronRight size={16} /></button>
      </PanelTitle>
      {alerts.length === 0 ? (
        <EmptyState text="확인할 알림이 없습니다." />
      ) : (
        <div className="alert-list">
          {alerts.slice(0, 3).map((alert) => (
            <button key={alert.id} className={`alert-item ${alert.is_read ? "read" : ""}`} onClick={() => onReadAlert(alert.id)}>
              <AlertTriangle size={24} />
              <span>
                <strong>{alert.message}</strong>
                <small>{readableDateTime(alert.created_at)}</small>
              </span>
              {!alert.is_read && <b>긴급</b>}
            </button>
          ))}
        </div>
      )}
      <button className="settings-button">
        <Settings size={17} /> 알림 설정
      </button>
    </section>
  );
}

function AiInsightCard({ rate }: { rate: number }) {
  return (
    <section className="panel insight-panel">
      <PanelTitle title="오늘의 AI 인사이트" />
      <div className="insight-body">
        <Leaf size={56} />
        <p>
          분리배출 성공률이 <strong>{Math.max(0, 90 - rate)}%</strong> 상승했어요.
        </p>
        <small>계속 잘하고 있어요.</small>
        <div>
          <span>주간 목표 달성률</span>
          <b>85%</b>
        </div>
        <div className="goal-bar"><span /></div>
      </div>
    </section>
  );
}

function DisplayPage({ latest, onApplyScenario }: { latest: DisplayLatest | null; onApplyScenario: (scenario: Scenario) => void }) {
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const lastSpoken = useRef<string | null>(null);
  const status = latest?.status || "waiting";
  const decision = latest?.decision;
  const tone = status === "success" ? "success" : status === "waiting" || status === "recognizing" ? "neutral" : "danger";
  const photo = getItemPhoto(latest?.item);

  useEffect(() => {
    if (!ttsEnabled || !latest?.tts_message || !latest.event_id || lastSpoken.current === latest.event_id || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(latest.tts_message);
    utterance.lang = "ko-KR";
    window.speechSynthesis.speak(utterance);
    lastSpoken.current = latest.event_id;
  }, [latest, ttsEnabled]);

  return (
    <section className={`display-page ${tone}`} data-led={latest?.led_color || "white"}>
      <div className="display-stage">
        <div className="display-status">
          {tone === "success" ? <Check size={26} /> : tone === "danger" ? <AlertTriangle size={26} /> : <Gauge size={26} />}
          <span>{statusLabel(status, decision)}</span>
        </div>
        <h2>{latest?.item || "검사 대기 중"}</h2>
        {photo && (
          <div className="item-photo-frame">
            <img src={photo.src} alt={`${photo.label} 사진`} />
          </div>
        )}
        <p>{latest?.guide || "검사 트레이 위에 분리배출할 물건을 올려주세요."}</p>
        <div className="display-metrics">
          <Metric label="무게" value={`${latest?.weight_g || 0}g`} />
          <Metric label="이번 감소량" value={formatG(latest?.carbon_reduction_gco2e)} />
          <Metric label="누적 감소량" value={formatG(latest?.total_carbon_reduction_gco2e)} />
          <Metric label="LED" value={latest?.led_color || "white"} />
        </div>
        <button className="tts-button" onClick={() => setTtsEnabled((value) => !value)}>
          {ttsEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          TTS {ttsEnabled ? "켜짐" : "꺼짐"}
        </button>
      </div>
      {SHOW_TEST_PANEL && USE_MOCK && <MockScenarioPanel onApplyScenario={onApplyScenario} />}
    </section>
  );
}

function getItemPhoto(item?: string | null): { src: string; label: string } | null {
  const text = item || "";
  if (text.includes("칫솔")) return { src: "/item-photos/toothbrush.png", label: "칫솔" };
  if (text.includes("우유팩") || text.includes("우유 팩")) return { src: "/item-photos/milk-carton.png", label: "우유팩" };
  return null;
}

function LogsPage({ logs, dateFilter, onDateFilter }: { logs: DisposalLog[]; dateFilter: string; onDateFilter: (value: string) => void }) {
  return (
    <section className="page-panel">
      <div className="page-toolbar">
        <label>
          조회 날짜
          <input type="date" value={dateFilter} onChange={(event) => onDateFilter(event.target.value)} />
        </label>
        <button onClick={() => onDateFilter("")}>필터 초기화</button>
      </div>
      <RecentLogs logs={logs} />
    </section>
  );
}

function CarbonPage({ carbon, trendRange, onTrendRange }: { carbon: CarbonStatistics | null; trendRange: TrendRange; onTrendRange: (range: TrendRange) => void }) {
  return (
    <section className="carbon-detail">
      <CarbonContributionChart carbon={carbon} />
      <CarbonTrendChart carbon={carbon} range={trendRange} onRange={onTrendRange} />
      <section className="panel">
        <PanelTitle title="시간대별 감축량" />
        <ResponsiveContainer width="100%" height={260}>
          <ReLineChart data={(carbon?.by_hour || []).map((item) => ({ hour: item.hour, g: item.carbon_reduction_gco2e }))}>
            <CartesianGrid strokeDasharray="3 5" stroke="#dce9e1" />
            <XAxis dataKey="hour" />
            <YAxis />
            <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}gCO₂e`, "감축량"]} />
            <Line dataKey="g" stroke="#0aa13c" strokeWidth={3} dot={{ r: 5 }} />
          </ReLineChart>
        </ResponsiveContainer>
      </section>
    </section>
  );
}

function BinsPage({ binFill, prediction }: { binFill: BinFill | null; prediction: BinFillPrediction | null }) {
  return (
    <section className="page-panel">
      <BinFillStatus binFill={binFill} />
      <BinFillPredictionPanel prediction={prediction} />
      <p className="updated-text">마지막 갱신: {readableDateTime(binFill?.updated_at)}</p>
    </section>
  );
}

function AlertsPage({ alerts, onReadAlert }: { alerts: AlertItem[]; onReadAlert: (id: number) => void }) {
  return (
    <section className="page-panel">
      <div className="alert-list full">
        {alerts.length === 0 ? (
          <EmptyState text="알림이 없습니다." />
        ) : (
          alerts.map((alert) => (
            <button key={alert.id} className={`alert-item ${alert.is_read ? "read" : ""}`} onClick={() => onReadAlert(alert.id)}>
              <AlertTriangle size={24} />
              <span>
                <strong>{alert.message}</strong>
                <small>{alert.bin_label} · {alert.fill}% · {readableDateTime(alert.created_at)}</small>
              </span>
              <b>{alert.is_read ? "읽음" : "확인"}</b>
            </button>
          ))
        )}
      </div>
    </section>
  );
}

function LogsTable({ logs }: { logs: DisposalLog[] }) {
  if (logs.length === 0) return <EmptyState text="분리배출 로그가 없습니다." />;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>날짜</th>
            <th>시간</th>
            <th>품목</th>
            <th>분류 결과</th>
            <th>탄소 절감량</th>
            <th>배출 상태</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.event_id}>
              <td>{log.date}</td>
              <td>{log.time}</td>
              <td>{log.item}</td>
              <td><StatusBadge status={log.status} decision={log.decision} /></td>
              <td>{formatG(log.carbon_reduction_gco2e)}</td>
              <td><StatusBadge label={disposalLabel(log.status, log.decision)} status={log.status} decision={log.decision} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status, decision, label }: { status: ClassificationStatus; decision?: Decision; label?: string }) {
  const text = label || statusLabel(status, decision);
  const className = status === "success" && decision !== "general" ? "success" : status === "hold" || status === "retry" ? "hold" : status === "fail" ? "fail" : decision === "general" ? "general" : "neutral";
  return <span className={`status-badge ${className}`}>{text}</span>;
}

function PanelTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="panel-title">
      <h2>{title} <Info size={15} /></h2>
      {children}
    </div>
  );
}

function AlertPopover({ alerts, onReadAlert }: { alerts: AlertItem[]; onReadAlert: (id: number) => void }) {
  return (
    <div className="alert-popover">
      <strong>최근 알림</strong>
      {alerts.length === 0 ? <EmptyState text="새 알림이 없습니다." /> : alerts.map((alert) => (
        <button key={alert.id} onClick={() => onReadAlert(alert.id)}>
          <Bell size={18} />
          <span>{alert.message}<small>{readableDateTime(alert.created_at)}</small></span>
        </button>
      ))}
    </div>
  );
}

function MockScenarioPanel({ onApplyScenario }: { onApplyScenario: (scenario: Scenario) => void }) {
  return (
    <aside className="mock-panel">
      <strong>테스트 시나리오</strong>
      <div>
        {scenarios.map((scenario) => (
          <button key={scenario.label} onClick={() => onApplyScenario(scenario)}>
            {scenario.label}
          </button>
        ))}
      </div>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function LoadingState() {
  return <div className="state-box"><CircleGauge className="spin" size={36} /><strong>데이터를 불러오는 중입니다.</strong></div>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="state-box error"><AlertTriangle size={36} /><strong>{message}</strong><button onClick={onRetry}>다시 시도</button></div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}

export default App;
