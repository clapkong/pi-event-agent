// weather.ts — 행사 날씨 (Open-Meteo, API 키 불필요·무료).
// 행사일까지 ≤16일이면 실제 예보, 그 이상(또는 과거)이면 과거 N년의 같은 월-일 평년값.
// "어떤 날을 기준으로 했는지"를 basis/details 에 명시. state.json 의 weather 모양과 호환.
//
// 흐름(아키텍처 결정): 백엔드가 fetch → state.json.weather 에 저장 → 프런트가 REST로 읽어 표시.
//   weather 는 잠금 없는 필드라 update_state(가드 대상) 단일-writer 원칙과 충돌하지 않음.

export interface WeatherResult {
	label: string; // 한국어 날씨 라벨
	temp: string; // 예: "22°C" / "평년 21°C" (state.json weather.temp 가 string)
	pop: number; // 강수확률(%) — 예보=예보확률, 평년=과거 강수일 비율
	stale: boolean; // 예보=false, 평년=true(잠정값 → 예보 도래 시 재기획 신호)
	source: "forecast" | "climatology";
	basis: string; // 어떤 날 기준인지 한 줄(사람용)
	details: Record<string, unknown>;
}

export interface WeatherOpts {
	latitude?: number;
	longitude?: number;
	place?: string; // 영문 도시명 → 지오코딩(Open-Meteo는 영문 도시만; 한글·랜드마크는 ✗ → lat/lon 직접, 예: maps MCP 좌표)
	eventDate: string; // 행사일 YYYY-MM-DD
	today?: Date; // 기준일 주입(테스트용, 기본 now)
}

const FORECAST_HORIZON_DAYS = 16; // Open-Meteo 예보 범위
const CLIMATOLOGY_YEARS = 10; // 평년값 산출에 쓸 과거 연수

function ymd(d: Date): string {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** WMO weather_code → 한국어 라벨. */
function labelFromCode(code: number): string {
	if (code === 0) return "맑음";
	if (code <= 2) return "대체로 맑음";
	if (code === 3) return "흐림";
	if (code <= 48) return "안개";
	if (code <= 57) return "이슬비";
	if (code <= 65) return "비";
	if (code <= 67) return "진눈깨비";
	if (code <= 77) return "눈";
	if (code <= 82) return "소나기";
	if (code <= 86) return "눈 소나기";
	if (code >= 95) return "뇌우";
	return "흐림";
}

async function fetchJson(url: string): Promise<any> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Open-Meteo ${res.status} (${url.split("?")[0]})`);
	return res.json();
}

/** 장소명 → 좌표 (Open-Meteo 지오코딩, 키 불필요). */
async function geocode(place: string): Promise<{ latitude: number; longitude: number; name: string }> {
	const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1&language=ko&format=json`;
	const j = await fetchJson(url);
	const r = j?.results?.[0];
	if (!r) throw new Error(`장소를 찾지 못함: "${place}" (Open-Meteo 지오코더는 영문 도시명만 — 한글·랜드마크는 lat/lon 직접 전달)`);
	return { latitude: r.latitude, longitude: r.longitude, name: r.admin1 ? `${r.name}, ${r.admin1}` : r.name };
}

export async function getWeather(opts: WeatherOpts): Promise<WeatherResult> {
	const eventDate = (opts.eventDate || "").trim();
	if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) throw new Error(`행사일 형식 오류: "${opts.eventDate}" (YYYY-MM-DD 필요)`);
	const event = new Date(`${eventDate}T00:00:00`);
	if (Number.isNaN(event.getTime())) throw new Error(`행사일 파싱 실패: "${eventDate}"`);

	// 위치 결정: lat/lon 우선, 없으면 place 지오코딩
	let lat = opts.latitude;
	let lon = opts.longitude;
	let placeName = opts.place;
	if ((lat == null || lon == null) && opts.place) {
		const g = await geocode(opts.place);
		lat = g.latitude;
		lon = g.longitude;
		placeName = g.name;
	}
	if (lat == null || lon == null) throw new Error("위치 필요: latitude+longitude 또는 place 중 하나");

	const today = opts.today ? new Date(opts.today) : new Date();
	today.setHours(0, 0, 0, 0); // 로컬 자정 기준
	const todayStr = ymd(today);
	const daysUntil = Math.round((event.getTime() - today.getTime()) / 86400000);
	const loc = { latitude: lat, longitude: lon, place: placeName ?? null };

	// ── 분기 ①: 0~16일 → 실제 예보 ──────────────────────────────
	if (daysUntil >= 0 && daysUntil <= FORECAST_HORIZON_DAYS) {
		const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&start_date=${eventDate}&end_date=${eventDate}&timezone=auto`;
		const d = (await fetchJson(url))?.daily;
		if (!d?.time?.length) throw new Error("예보 데이터 없음");
		const code = d.weather_code[0];
		const tmax = d.temperature_2m_max[0];
		const tmin = d.temperature_2m_min[0];
		const pop = Math.round(d.precipitation_probability_max?.[0] ?? 0);
		return {
			label: labelFromCode(code),
			temp: `${Math.round((tmax + tmin) / 2)}°C`,
			pop,
			stale: false,
			source: "forecast",
			basis: `${eventDate} 기상예보`,
			details: { ...loc, eventDate, today: todayStr, daysUntil, weatherCode: code, tempMax: Math.round(tmax), tempMin: Math.round(tmin), pop },
		};
	}

	// ── 분기 ②: 예보 범위 밖(미래 멀거나 과거) → 평년값 ───────────
	const MM = String(event.getMonth() + 1).padStart(2, "0");
	const DD = String(event.getDate()).padStart(2, "0");
	const years = Array.from({ length: CLIMATOLOGY_YEARS }, (_, i) => today.getFullYear() - 1 - i);
	const samples = await Promise.all(
		years.map(async (y) => {
			try {
				const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${y}-${MM}-${DD}&end_date=${y}-${MM}-${DD}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;
				const d = (await fetchJson(url))?.daily;
				const tmax = d?.temperature_2m_max?.[0];
				const tmin = d?.temperature_2m_min?.[0];
				if (tmax == null || tmin == null) return null;
				return { year: y, mean: (tmax + tmin) / 2, precip: d?.precipitation_sum?.[0] ?? 0 };
			} catch {
				return null;
			}
		}),
	);
	const valid = samples.filter((s): s is { year: number; mean: number; precip: number } => s != null);
	if (valid.length === 0) throw new Error("평년값 산출용 과거 데이터를 못 받음");
	const means = valid.map((s) => s.mean);
	const avg = means.reduce((a, b) => a + b, 0) / means.length;
	const rainYears = valid.filter((s) => s.precip >= 1).length;
	const pop = Math.round((rainYears / valid.length) * 100);
	// "과거 평균" 꼬리표는 basis 에서 한 번만 — label·temp 엔 안 붙인다(중복 방지).
	// (기상청 '평년값'=30년 정규가 아니라, 과거 N년 같은 날짜의 단순 평균이므로 '평균값'으로 표기.)
	const label = pop >= 50 ? "강수 잦음" : pop >= 25 ? "강수 가능" : "대체로 맑음";
	const yrs = valid.map((s) => s.year);
	return {
		label,
		temp: `${Math.round(avg)}°C`,
		pop,
		stale: true,
		source: "climatology",
		basis: `과거 ${valid.length}년 같은날 평균값 (예측치)`,
		details: {
			...loc,
			eventDate,
			today: todayStr,
			daysUntil,
			years: yrs,
			tempMean: Math.round(avg),
			tempRange: [Math.round(Math.min(...means)), Math.round(Math.max(...means))],
			rainYears,
			samples: valid.map((s) => ({ year: s.year, mean: Math.round(s.mean * 10) / 10, precip: s.precip })),
		},
	};
}
