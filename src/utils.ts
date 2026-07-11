import type { BinKey, BinStatus, Category, ClassificationStatus, Decision } from "./types";

export const categoryLabels: Record<Category, string> = {
  plastic: "플라스틱",
  paper: "종이",
  can: "캔",
  general: "일반쓰레기",
  unknown: "알 수 없음",
};

export const binLabels: Record<BinKey, string> = {
  plastic: "플라스틱함",
  paper: "종이함",
  can: "캔함",
  general: "일반쓰레기함",
};

export const carbonFactors: Record<Category, number> = {
  plastic: 1.65,
  paper: 0.3,
  can: 8.12,
  general: 0,
  unknown: 0,
};

export function nowText(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}:${pad(date.getSeconds())}`;
}

export function readableDateTime(value?: string | null): string {
  if (!value) return "데이터 없음";
  return value.replace("T", " ").slice(0, 16);
}

export function formatG(value: number | null | undefined): string {
  return `${Number(value || 0).toFixed(1)}gCO2e`;
}

export function formatKgFromG(value: number | null | undefined): string {
  const kg = Number(value || 0) / 1000;
  return `${kg >= 1 ? kg.toFixed(1) : kg.toFixed(3)} kgCO2e`;
}

export function formatKgNumberFromG(value: number | null | undefined): string {
  const kg = Number(value || 0) / 1000;
  return kg >= 1 ? kg.toFixed(1) : kg.toFixed(3);
}

export function formatCount(value: number | null | undefined): string {
  return `${Number(value || 0).toLocaleString("ko-KR")}건`;
}

export function clampPercent(value: number | null | undefined): number {
  return Math.max(0, Math.min(100, Number(value || 0)));
}

export function successRate(total: number, success: number): number {
  if (!total) return 0;
  return Math.round((success / total) * 100);
}

export function binStatus(fill: number): BinStatus {
  if (fill >= 80) return "need_collection";
  if (fill >= 60) return "warning";
  return "normal";
}

export function binStatusLabel(status: BinStatus): string {
  return status === "need_collection" ? "수거 필요" : status === "warning" ? "보통" : "여유";
}

export function statusLabel(status: ClassificationStatus, decision?: Decision): string {
  if (status === "success" && decision === "general") return "일반쓰레기";
  if (status === "success") return "성공";
  if (status === "hold") return "보류";
  if (status === "retry") return "재시도";
  if (status === "fail") return "실패";
  if (status === "recognizing") return "인식 중";
  return "대기";
}

export function disposalLabel(status: ClassificationStatus, decision?: Decision): string {
  if (status === "success" && decision && decision !== "general") return "분리배출";
  if (status === "success" && decision === "general") return "일반배출";
  if (status === "hold" || status === "retry") return "재시도";
  if (status === "fail") return "일반배출";
  return "대기";
}

export function guideFor(decision: Decision, status: ClassificationStatus, scenarioText = ""): string {
  if (status === "waiting") return "검사 트레이 위에 분리배출할 물건을 올려주세요.";
  if (status === "recognizing") return "품목을 인식 중입니다.";
  if (status === "hold" && scenarioText.includes("남아")) return "내용물이 남아 있습니다. 비운 후 다시 배출해주세요.";
  if (status === "hold" && scenarioText.includes("젖은")) return "수분이 감지되었습니다. 물기를 제거한 후 다시 배출해주세요.";
  if (status === "fail") return "안전한 방법으로 별도 배출이 필요합니다.";
  if (decision === "plastic") return "플라스틱함에 배출해주세요.";
  if (decision === "paper") return "종이함에 배출해주세요.";
  if (decision === "can") return "캔함에 배출해주세요.";
  if (decision === "general") return "일반쓰레기함에 배출해주세요.";
  return "대시보드에 표시된 분리배출 방법을 확인해주세요.";
}

export function ledFor(decision: Decision, status: ClassificationStatus): string {
  if (status === "hold" || status === "retry" || status === "fail") return "red";
  if (decision === "plastic") return "green";
  if (decision === "paper") return "blue";
  if (decision === "can") return "yellow";
  if (decision === "general") return "gray";
  return "white";
}

export function shouldAccumulate(status: ClassificationStatus, decision: Decision): boolean {
  return status === "success" && decision !== "general" && decision !== "hold";
}
