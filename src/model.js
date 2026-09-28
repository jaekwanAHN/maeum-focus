export const DEFAULT_MESSAGE =
  "지금의 작은 집중이\n내가 바라던 내일을 만들어요.";
export const MAX_SITES = 200;
export function defaults() {
  return { version: 1, enabled: true, message: DEFAULT_MESSAGE, sites: [] };
}
export function normalizeDomain(input) {
  if (
    typeof input !== "string" ||
    !input.trim() ||
    input.length > 2048 ||
    /\s/.test(input.trim())
  )
    throw new Error("사이트 주소를 확인해 주세요. 예: youtube.com");
  let url;
  try {
    url = new URL(
      /^[a-z][a-z\d+.-]*:\/\//i.test(input.trim())
        ? input.trim()
        : `https://${input.trim()}`,
    );
  } catch {
    throw new Error("올바른 사이트 주소를 입력해 주세요.");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("http 또는 https 사이트 주소만 추가할 수 있어요.");
  const domain = url.hostname
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^www\./, "");
  if (
    domain.length > 253 ||
    !domain
      .split(".")
      .every((label) => /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/.test(label)) ||
    (!domain.includes(".") && domain !== "localhost")
  )
    throw new Error("도메인을 확인해 주세요. 예: youtube.com");
  return domain;
}
export function validateMessage(message) {
  if (typeof message !== "string" || !message.trim())
    throw new Error("다시 집중할 나에게 한 문장을 남겨 주세요.");
  if (message.length > 240)
    throw new Error("문구는 240자 이내로 작성해 주세요.");
  return message.trim();
}
export function readState(value) {
  if (value === undefined) return defaults();
  if (
    !value ||
    value.version !== 1 ||
    typeof value.enabled !== "boolean" ||
    !Array.isArray(value.sites) ||
    value.sites.length > MAX_SITES
  )
    throw new Error(
      "저장된 설정을 읽지 못했어요. 확장프로그램을 다시 로드해 주세요.",
    );
  const message = validateMessage(value.message);
  const seen = new Set();
  const sites = value.sites.map((site) => {
    if (
      !site ||
      typeof site.enabled !== "boolean" ||
      normalizeDomain(site.domain) !== site.domain ||
      seen.has(site.domain)
    )
      throw new Error("저장된 사이트 목록을 확인해 주세요.");
    seen.add(site.domain);
    return { domain: site.domain, enabled: site.enabled };
  });
  return { version: 1, enabled: value.enabled, message, sites };
}
export function reduceState(state, action) {
  const next = structuredClone(state);
  switch (action.type) {
    case "setEnabled":
      if (typeof action.enabled !== "boolean")
        throw new Error("집중 모드 설정을 확인해 주세요.");
      next.enabled = action.enabled;
      break;
    case "saveMessage":
      next.message = validateMessage(action.message);
      break;
    case "addSite": {
      const domain = normalizeDomain(action.domain);
      if (next.sites.some((site) => site.domain === domain))
        throw new Error("이미 목록에 있는 사이트예요.");
      if (next.sites.length >= MAX_SITES)
        throw new Error(`사이트는 최대 ${MAX_SITES}개까지 추가할 수 있어요.`);
      next.sites.push({ domain, enabled: true });
      break;
    }
    case "toggleSite": {
      const site = next.sites.find((site) => site.domain === action.domain);
      if (!site) throw new Error("목록에 없는 사이트예요.");
      if (typeof action.enabled !== "boolean")
        throw new Error("차단 설정을 확인해 주세요.");
      site.enabled = action.enabled;
      break;
    }
    case "removeSite":
      next.sites = next.sites.filter((site) => site.domain !== action.domain);
      break;
    default:
      throw new Error("지원하지 않는 요청이에요.");
  }
  return next;
}
export function buildRules(state, baseURL) {
  if (!state.enabled) return [];
  return state.sites
    .filter((site) => site.enabled)
    .sort((a, b) => b.domain.length - a.domain.length)
    .map((site, index) => ({
      id: index + 1,
      priority: state.sites.length - index + 1,
      action: {
        type: "redirect",
        redirect: { url: `${baseURL}?site=${encodeURIComponent(site.domain)}` },
      },
      condition: {
        requestDomains: [site.domain],
        regexFilter: "^https?://",
        resourceTypes: ["main_frame"],
      },
    }));
}
export function matchingSite(state, address) {
  if (!state.enabled) return null;
  let url;
  try {
    url = new URL(address);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(url.protocol)) return null;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  return (
    state.sites
      .filter(
        (s) =>
          s.enabled && (host === s.domain || host.endsWith(`.${s.domain}`)),
      )
      .sort((a, b) => b.domain.length - a.domain.length)[0] ?? null
  );
}
