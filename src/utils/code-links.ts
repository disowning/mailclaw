const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;
const MAX_TTL_SECONDS = 90 * 24 * 60 * 60;
const MAX_LINK_COUNT = 1000;

export interface CodeLinkInput {
	to: string;
	exp: number;
}

export interface CodeLinkItem {
	email: string;
	inbox_url: string;
	code_url: string;
	expires_at: number;
}

export interface CodeLinkRequest {
	domain?: string[] | string;
	count?: number;
	prefixes?: string[] | string;
	emails?: string[] | string;
	ttl_seconds?: number;
	expires_at?: number;
	plain?: boolean;
}

export function resolveCodeLinkExpiry(body: CodeLinkRequest, nowSeconds: number): number {
	if (body.expires_at !== undefined) {
		const expiresAt = Math.floor(Number(body.expires_at));
		if (!Number.isFinite(expiresAt) || expiresAt <= nowSeconds) {
			throw new Error("expires_at must be a future Unix timestamp in seconds");
		}
		if (expiresAt - nowSeconds > MAX_TTL_SECONDS) {
			throw new Error("expires_at cannot be more than 90 days in the future");
		}
		return expiresAt;
	}

	const ttl = Math.floor(Number(body.ttl_seconds ?? DEFAULT_TTL_SECONDS));
	if (!Number.isFinite(ttl) || ttl <= 0) {
		throw new Error("ttl_seconds must be greater than 0");
	}
	if (ttl > MAX_TTL_SECONDS) {
		throw new Error("ttl_seconds cannot be greater than 7776000");
	}

	return nowSeconds + ttl;
}

export function resolveCodeLinkEmails(body: CodeLinkRequest): string[] {
	const emails = new Set<string>();

	for (const email of toList(body.emails)) {
		emails.add(normalizeEmail(email));
	}

	const prefixes = toList(body.prefixes);
	if (prefixes.length > 0) {
		const domains = normalizeDomains(body.domain);
		for (const domain of domains) {
			for (const prefix of prefixes) {
				emails.add(`${normalizePrefix(prefix)}@${domain}`);
			}
		}
	}

	const count = Math.floor(Number(body.count ?? 0));
	if (!Number.isFinite(count) || count < 0) {
		throw new Error("count must be a non-negative number");
	}
	if (count > MAX_LINK_COUNT) {
		throw new Error(`Cannot generate more than ${MAX_LINK_COUNT} links at once`);
	}
	if (count > 0) {
		const domains = normalizeDomains(body.domain);
		if (domains.length * count > MAX_LINK_COUNT) {
			throw new Error(`Cannot generate more than ${MAX_LINK_COUNT} links at once`);
		}
		for (const domain of domains) {
			for (let i = 0; i < count; i += 1) {
				emails.add(`${randomPrefix()}@${domain}`);
			}
		}
	}

	if (emails.size === 0) {
		throw new Error("Provide emails, prefixes, or count");
	}
	if (emails.size > MAX_LINK_COUNT) {
		throw new Error(`Cannot generate more than ${MAX_LINK_COUNT} links at once`);
	}

	return [...emails];
}

function toList(value: string[] | string | undefined): string[] {
	if (value === undefined) {
		return [];
	}
	if (Array.isArray(value)) {
		return value;
	}
	return value
		.split(/[\r\n,]+/)
		.map((item) => item.trim())
		.filter(Boolean);
}

function normalizeDomains(value: string[] | string | undefined): string[] {
	const domains = [...new Set(toList(value).map(normalizeDomain))];
	if (domains.length === 0) {
		throw new Error("domain is required when using prefixes or count");
	}
	return domains;
}

export async function signCodeLink(input: CodeLinkInput, secret: string): Promise<string> {
	const key = await importHmacKey(secret);
	const signature = await crypto.subtle.sign("HMAC", key, payloadBytes(input));
	return base64UrlEncode(new Uint8Array(signature));
}

export async function verifyCodeLink(
	input: CodeLinkInput,
	signature: string,
	secret: string,
): Promise<boolean> {
	const expected = await signCodeLink(input, secret);
	return constantTimeEqual(expected, signature);
}

export function buildCodeLinkItem(
	origin: string,
	email: string,
	exp: number,
	sig: string,
	plain: boolean,
): CodeLinkItem {
	const inboxUrl = new URL("/", origin);
	inboxUrl.searchParams.set("to", email);

	const codeUrl = new URL("/api/code", origin);
	codeUrl.searchParams.set("to", email);
	codeUrl.searchParams.set("exp", String(exp));
	codeUrl.searchParams.set("sig", sig);
	if (plain) {
		codeUrl.searchParams.set("plain", "1");
	}

	return {
		email,
		inbox_url: inboxUrl.toString(),
		code_url: codeUrl.toString(),
		expires_at: exp,
	};
}

function normalizeEmail(value: string): string {
	const email = value.trim().toLowerCase();
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		throw new Error(`Invalid email: ${value}`);
	}
	return email;
}

function normalizeDomain(value: string): string {
	const domain = value.trim().toLowerCase().replace(/^@/, "");
	if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
		throw new Error(`Invalid domain: ${value}`);
	}
	return domain;
}

function normalizePrefix(value: string): string {
	const prefix = value.trim().toLowerCase().replace(/@.*$/, "");
	if (!/^[a-z0-9._+-]{1,64}$/i.test(prefix)) {
		throw new Error(`Invalid email prefix: ${value}`);
	}
	return prefix;
}

function randomPrefix(): string {
	const bytes = new Uint8Array(8);
	crypto.getRandomValues(bytes);
	return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
}

function payloadBytes(input: CodeLinkInput): Uint8Array {
	return new TextEncoder().encode(`${input.to}\n${input.exp}`);
}

function base64UrlEncode(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function constantTimeEqual(a: string, b: string): boolean {
	const maxLength = Math.max(a.length, b.length);
	let diff = a.length ^ b.length;

	for (let i = 0; i < maxLength; i += 1) {
		diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
	}

	return diff === 0;
}
