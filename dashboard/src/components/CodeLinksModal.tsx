import {
	Button,
	Description,
	Input,
	Label,
	Modal,
	NumberField,
	TextArea,
	TextField,
} from "@heroui/react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { ApiError, api, type ClientCtx } from "@/api/client";
import { CopyIcon, DownloadIcon } from "@/components/Icons";
import type { CodeLinkItem } from "@/types";

interface Props {
	ctx: ClientCtx;
	isOpen: boolean;
	defaultDomain: string;
	onClose: () => void;
}

const DAY_SECONDS = 24 * 60 * 60;
const SAVED_DOMAINS_KEY = "mailclaw:code-link-domains";

function csvCell(value: string | number): string {
	const text = String(value);
	if (!/[",\n\r]/.test(text)) return text;
	return `"${text.replace(/"/g, '""')}"`;
}

function parseDomains(value: string): string[] {
	return [
		...new Set(
			value
				.split(/[\s,]+/)
				.map((item) => item.trim().toLowerCase().replace(/^@/, ""))
				.filter(Boolean),
		),
	];
}

function parseList(value: string): string[] {
	return value
		.split(/[\r\n,;\t]+/)
		.map((item) => item.trim())
		.filter(Boolean);
}

function loadSavedDomains(defaultDomain: string): string[] {
	const defaults = parseDomains(defaultDomain);
	try {
		const raw = localStorage.getItem(SAVED_DOMAINS_KEY);
		const parsed = raw ? (JSON.parse(raw) as string[]) : [];
		return [...new Set([...defaults, ...parsed.flatMap(parseDomains)])];
	} catch {
		return defaults;
	}
}

function saveDomains(domains: string[]) {
	localStorage.setItem(SAVED_DOMAINS_KEY, JSON.stringify(domains));
}

export function CodeLinksModal({ ctx, isOpen, defaultDomain, onClose }: Props) {
	const [domainsText, setDomainsText] = useState(defaultDomain);
	const [savedDomains, setSavedDomains] = useState<string[]>(() => loadSavedDomains(defaultDomain));
	const [selectedDomains, setSelectedDomains] = useState<string[]>(() =>
		parseDomains(defaultDomain),
	);
	const [count, setCount] = useState(3);
	const [ttlDays, setTtlDays] = useState(7);
	const [prefixes, setPrefixes] = useState("");
	const [emails, setEmails] = useState("");
	const [items, setItems] = useState<CodeLinkItem[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [copied, setCopied] = useState<string | null>(null);

	useEffect(() => {
		if (!isOpen) return;
		const nextSaved = loadSavedDomains(defaultDomain);
		setSavedDomains(nextSaved);
		setDomainsText((current) => current || nextSaved[0] || defaultDomain);
		setSelectedDomains((current) => (current.length > 0 ? current : nextSaved.slice(0, 1)));
		setError(null);
		setCopied(null);
	}, [isOpen, defaultDomain]);

	const typedDomains = useMemo(() => parseDomains(domainsText), [domainsText]);
	const activeDomains = useMemo(() => {
		if (selectedDomains.length > 0) return selectedDomains;
		return typedDomains;
	}, [selectedDomains, typedDomains]);
	const prefixCount = useMemo(() => parseList(prefixes).length, [prefixes]);
	const fullEmailCount = useMemo(() => parseList(emails).length, [emails]);
	const uniquePrefixCount = useMemo(
		() => new Set(parseList(prefixes).map((item) => item.toLowerCase().replace(/@.*$/, ""))).size,
		[prefixes],
	);
	const uniqueFullEmailCount = useMemo(
		() => new Set(parseList(emails).map((item) => item.toLowerCase())).size,
		[emails],
	);
	const expectedCount =
		activeDomains.length * (prefixCount + Math.max(0, Math.floor(count || 0))) + fullEmailCount;
	const expectedUniqueCount =
		activeDomains.length * (uniquePrefixCount + Math.max(0, Math.floor(count || 0))) +
		uniqueFullEmailCount;

	const csvText = useMemo(() => {
		const header = "email,inbox_url,code_url,expires_at";
		const rows = items.map((item) =>
			[item.email, item.inbox_url, item.code_url, item.expires_at].map(csvCell).join(","),
		);
		return [header, ...rows].join("\n");
	}, [items]);

	const txtText = useMemo(() => {
		return items
			.map((item) =>
				[
					`Email: ${item.email}`,
					`Inbox: ${item.inbox_url}`,
					`Code: ${item.code_url}`,
					`Expires: ${new Date(item.expires_at * 1000).toLocaleString()}`,
				].join("\n"),
			)
			.join("\n\n");
	}, [items]);

	function download(text: string, filename: string, type: string) {
		const blob = new Blob([text], { type });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		a.remove();
		setTimeout(() => URL.revokeObjectURL(url), 5000);
	}

	function filename(ext: "csv" | "txt"): string {
		const safeDomain = (activeDomains.join("_") || "code-links").replace(/[^a-z0-9.-]+/gi, "-");
		const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
		return `${safeDomain}-${stamp}.${ext}`;
	}

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		setError(null);
		setCopied(null);
		setLoading(true);

		try {
			const result = await api.createCodeLinks(ctx, {
				domain: activeDomains,
				count: Math.max(0, Math.floor(count || 0)),
				prefixes: prefixes.trim() || undefined,
				emails: emails.trim() || undefined,
				ttl_seconds: Math.max(1, Math.floor(ttlDays || 1)) * DAY_SECONDS,
				plain: true,
			});
			setItems(result.items);
			if (typedDomains.length > 0) {
				const nextSaved = [...new Set([...savedDomains, ...typedDomains])];
				setSavedDomains(nextSaved);
				saveDomains(nextSaved);
			}
		} catch (err) {
			const msg = err instanceof ApiError ? `${err.code}: ${err.message}` : String(err);
			setError(msg);
		} finally {
			setLoading(false);
		}
	}

	async function copy(value: string, label: string) {
		await navigator.clipboard.writeText(value);
		setCopied(label);
	}

	function toggleDomain(domain: string) {
		setSelectedDomains((current) =>
			current.includes(domain) ? current.filter((item) => item !== domain) : [...current, domain],
		);
	}

	function saveTypedDomains() {
		if (typedDomains.length === 0) return;
		const nextSaved = [...new Set([...savedDomains, ...typedDomains])];
		setSavedDomains(nextSaved);
		saveDomains(nextSaved);
		setSelectedDomains((current) => [...new Set([...current, ...typedDomains])]);
		setCopied(`${typedDomains.length} domain(s)`);
	}

	function selectOnly(domain: string) {
		setSelectedDomains([domain]);
		setDomainsText(domain);
	}

	function selectAllDomains() {
		setSelectedDomains(savedDomains);
	}

	function clearSelectedDomains() {
		setSelectedDomains([]);
	}

	return (
		<Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
			<Modal.Container placement="center">
				<Modal.Dialog className="w-full sm:max-w-[860px]">
					<Modal.CloseTrigger />
					<Modal.Header>
						<Modal.Heading>Code links</Modal.Heading>
					</Modal.Header>
					<form onSubmit={handleSubmit}>
						<Modal.Body className="flex max-h-[76vh] flex-col gap-4 overflow-y-auto">
							<div className="grid gap-3 sm:grid-cols-[1fr_140px_140px]">
								<TextField name="domains" value={domainsText} onChange={setDomainsText} fullWidth>
									<Label>Domains</Label>
									<TextArea rows={3} placeholder={"grokghibli.com\nmusicaldown.pro"} />
									<Description>
										Add or paste domains here, then save them. Selected saved domains are used.
									</Description>
								</TextField>
								<NumberField
									value={count}
									onChange={(v) => setCount(Number.isNaN(v) ? 0 : v)}
									minValue={0}
									maxValue={1000}
								>
									<Label>Random</Label>
									<Input />
								</NumberField>
								<NumberField
									value={ttlDays}
									onChange={(v) => setTtlDays(Number.isNaN(v) ? 7 : v)}
									minValue={1}
									maxValue={90}
								>
									<Label>Days</Label>
									<Input />
								</NumberField>
							</div>

							<div className="flex flex-wrap items-center gap-2 text-xs text-black/55">
								<span>
									{savedDomains.length} saved, {activeDomains.length} selected
								</span>
								{savedDomains.map((domain) => (
									<Button
										key={domain}
										type="button"
										size="sm"
										variant={selectedDomains.includes(domain) ? "secondary" : "ghost"}
										onPress={() => toggleDomain(domain)}
										onDoubleClick={() => selectOnly(domain)}
									>
										{domain}
									</Button>
								))}
								<Button type="button" size="sm" variant="ghost" onPress={selectAllDomains}>
									All
								</Button>
								<Button type="button" size="sm" variant="ghost" onPress={clearSelectedDomains}>
									None
								</Button>
								<Button type="button" size="sm" variant="ghost" onPress={saveTypedDomains}>
									Save domains
								</Button>
							</div>

							<div className="grid gap-3 sm:grid-cols-2">
								<TextField name="prefixes" value={prefixes} onChange={setPrefixes} fullWidth>
									<Label>Prefixes</Label>
									<TextArea rows={5} placeholder={"apple01\napple02\nlogin-test"} />
									<Description>{prefixCount} imported username(s).</Description>
								</TextField>
								<TextField name="emails" value={emails} onChange={setEmails} fullWidth>
									<Label>Full emails</Label>
									<TextArea rows={5} placeholder={"apple01@example.com\napple02@example.com"} />
									<Description>{fullEmailCount} imported exact address(es).</Description>
								</TextField>
							</div>

							<div className="text-xs text-black/50">
								Imported total: {expectedCount}. Expected unique output: {expectedUniqueCount}{" "}
								link(s) across {activeDomains.length} selected domain(s).
							</div>

							{error ? (
								<div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
									{error}
								</div>
							) : null}

							{items.length > 0 ? (
								<div className="overflow-hidden rounded-lg border border-black/10 bg-white">
									<div className="flex items-center justify-between border-b border-black/5 px-3 py-2">
										<div className="text-sm font-medium">{items.length} link(s)</div>
										<div className="flex gap-1">
											<Button
												type="button"
												size="sm"
												variant="ghost"
												onPress={() => download(txtText, filename("txt"), "text/plain")}
											>
												<DownloadIcon /> TXT
											</Button>
											<Button
												type="button"
												size="sm"
												variant="ghost"
												onPress={() => download(csvText, filename("csv"), "text/csv")}
											>
												<DownloadIcon /> CSV
											</Button>
											<Button
												type="button"
												size="sm"
												variant="ghost"
												onPress={() => void copy(csvText, "batch")}
											>
												<CopyIcon /> Copy
											</Button>
										</div>
									</div>
									<div className="max-h-[280px] overflow-y-auto">
										{items.map((item) => (
											<div
												key={item.code_url}
												className="grid gap-3 border-b border-black/5 px-3 py-2 text-sm last:border-b-0 sm:grid-cols-[270px_1fr_auto]"
											>
												<div className="min-w-0 font-medium text-black/80">
													<div className="truncate">{item.email}</div>
													<div className="text-xs text-black/45">
														Expires {new Date(item.expires_at * 1000).toLocaleString()}
													</div>
												</div>
												<div className="min-w-0 text-xs text-black/55">
													<div className="truncate">{item.code_url}</div>
												</div>
												<div className="flex gap-1">
													<Button
														type="button"
														size="sm"
														variant="ghost"
														isIconOnly
														aria-label="Copy email"
														onPress={() => void copy(item.email, item.email)}
													>
														<CopyIcon />
													</Button>
													<Button
														type="button"
														size="sm"
														variant="ghost"
														onPress={() => void copy(item.code_url, item.email)}
													>
														Code
													</Button>
												</div>
											</div>
										))}
									</div>
								</div>
							) : null}

							{copied ? <div className="text-xs text-black/50">Copied {copied}</div> : null}
						</Modal.Body>
						<Modal.Footer>
							<Button type="button" variant="tertiary" slot="close">
								Close
							</Button>
							<Button type="submit" isPending={loading}>
								{({ isPending }) => (isPending ? "Generating..." : "Generate")}
							</Button>
						</Modal.Footer>
					</form>
				</Modal.Dialog>
			</Modal.Container>
		</Modal.Backdrop>
	);
}
