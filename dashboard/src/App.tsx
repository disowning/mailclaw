import { Button } from "@heroui/react";
import { useCallback, useMemo, useState } from "react";
import { ApiError, api, type ClientCtx } from "@/api/client";
import { CodeLinksModal } from "@/components/CodeLinksModal";
import { type ComposeDraft, ComposeModal } from "@/components/ComposeModal";
import { EmailDetail } from "@/components/EmailDetail";
import { FiltersBar } from "@/components/FiltersBar";
import { GearIcon, LinkIcon, MailIcon, PencilIcon, RefreshIcon } from "@/components/Icons";
import { InboxList } from "@/components/InboxList";
import { SettingsModal } from "@/components/SettingsModal";
import { SetupScreen } from "@/components/SetupScreen";
import { useEmails } from "@/hooks/useEmails";
import { type DashboardConfig, isConfigured, loadConfig, saveConfig } from "@/lib/config";
import { formatDate } from "@/lib/format";
import type { Email, EmailFilters } from "@/types";

const DEFAULT_FILTERS: EmailFilters = { limit: 50, offset: 0 };

function initialFilters(): EmailFilters {
	if (typeof window === "undefined") return DEFAULT_FILTERS;
	const params = new URLSearchParams(window.location.search);
	return {
		...DEFAULT_FILTERS,
		from: params.get("from") || undefined,
		to: params.get("to") || undefined,
		domain: params.get("domain") || undefined,
		q: params.get("q") || undefined,
		after: params.get("after") || undefined,
		before: params.get("before") || undefined,
	};
}

function domainFromConfig(config: DashboardConfig): string {
	const fromDomain = config.defaultFrom.split("@")[1]?.trim();
	if (fromDomain) return fromDomain;

	try {
		return new URL(config.host || window.location.origin).hostname.replace(/^mail\./, "");
	} catch {
		return "";
	}
}

export default function App() {
	const [config, setConfig] = useState<DashboardConfig>(() => loadConfig());
	const [filters, setFilters] = useState<EmailFilters>(() => initialFilters());
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [composeDraft, setComposeDraft] = useState<ComposeDraft | null>(null);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [codeLinksOpen, setCodeLinksOpen] = useState(false);
	const [deletingFiltered, setDeletingFiltered] = useState(false);
	const [refreshKey, setRefreshKey] = useState(0);

	const ctx: ClientCtx = useMemo(
		() => ({ host: config.host, token: config.apiToken }),
		[config.host, config.apiToken],
	);

	const onNewEmail = useCallback(() => {
		// Currently no per-email action; bump key if a select callback was needed.
		setRefreshKey((k) => k + 1);
	}, []);

	const { data, loading, error, lastFetched, refresh } = useEmails(
		ctx,
		config,
		filters,
		onNewEmail,
	);

	if (!isConfigured(config)) {
		return (
			<SetupScreen
				initial={config}
				onSave={(cfg) => {
					saveConfig(cfg);
					setConfig(cfg);
				}}
			/>
		);
	}

	function persist(cfg: DashboardConfig) {
		saveConfig(cfg);
		setConfig(cfg);
	}

	function handleReply(email: Email) {
		setComposeDraft({
			to: email.from_address,
			subject: email.subject?.startsWith("Re:") ? email.subject : `Re: ${email.subject ?? ""}`,
			body: `\n\n--- On ${new Date(email.received_at).toLocaleString()}, ${email.from_address} wrote ---\n${
				email.text_content ?? ""
			}`,
			from: config.defaultFrom || email.to_address,
		});
	}

	async function handleDeleteFiltered() {
		const hasFilters = Boolean(
			filters.from || filters.to || filters.domain || filters.q || filters.after || filters.before,
		);
		if (!hasFilters) {
			window.alert("Set a filter before deleting emails.");
			return;
		}

		const target =
			filters.to ||
			(filters.domain ? `*@${filters.domain}` : filters.from || filters.q || "current filters");
		const ok = window.confirm(
			`Delete all email(s) matching ${target} in batches of 500? This cannot be undone.`,
		);
		if (!ok) return;

		setDeletingFiltered(true);
		try {
			let totalDeleted = 0;
			for (let batch = 0; batch < 100; batch += 1) {
				const result = await api.deleteFiltered(ctx, { ...filters, limit: 500, offset: 0 });
				totalDeleted += result.deleted;
				if (result.deleted < result.limit) break;
			}
			setSelectedId(null);
			await refresh();
			window.alert(`Deleted ${totalDeleted} email(s).`);
		} catch (err) {
			const msg = err instanceof ApiError ? `${err.code}: ${err.message}` : String(err);
			window.alert(msg);
		} finally {
			setDeletingFiltered(false);
		}
	}

	return (
		<div className="flex h-screen flex-col bg-[#f6f8fa]">
			<header className="flex items-center gap-3 border-b border-black/5 bg-white px-4 py-2.5">
				<div className="flex items-center gap-2">
					<img src="/logo.svg" alt="MailClaw" className="h-8 w-8" />
					<div className="text-lg font-semibold tracking-tight text-black/85">MailClaw</div>
				</div>
				<div className="ml-2 hidden text-xs text-black/50 sm:block">
					{lastFetched ? `Updated ${formatDate(lastFetched)}` : "—"}
					{config.refreshSeconds > 0 ? ` · auto-refresh ${config.refreshSeconds}s` : ""}
				</div>
				<div className="ml-auto flex items-center gap-2">
					<Button size="sm" variant="ghost" onPress={() => void refresh()} isPending={loading}>
						<RefreshIcon /> Refresh
					</Button>
					<Button
						size="sm"
						onPress={() =>
							setComposeDraft({
								to: "",
								subject: "",
								body: "",
								from: config.defaultFrom,
							})
						}
					>
						<PencilIcon /> Compose
					</Button>
					<Button size="sm" variant="secondary" onPress={() => setCodeLinksOpen(true)}>
						<LinkIcon /> Codes
					</Button>
					<Button
						size="sm"
						variant="ghost"
						isIconOnly
						onPress={() => setSettingsOpen(true)}
						aria-label="Settings"
					>
						<GearIcon />
					</Button>
				</div>
			</header>

			<div className="flex min-h-0 flex-1">
				<aside className="flex w-[380px] min-w-[320px] flex-col border-r border-black/5">
					<FiltersBar
						value={filters}
						onChange={setFilters}
						onDeleteFiltered={handleDeleteFiltered}
						deleting={deletingFiltered}
					/>
					<InboxList
						key={refreshKey}
						data={data}
						loading={loading}
						error={error}
						selectedId={selectedId}
						onSelect={(e) => setSelectedId(e.id)}
						onPage={(offset) => setFilters((f) => ({ ...f, offset }))}
					/>
				</aside>

				<main className="min-w-0 flex-1">
					{selectedId ? (
						<EmailDetail
							ctx={ctx}
							emailId={selectedId}
							onBack={() => setSelectedId(null)}
							onDeleted={() => {
								setSelectedId(null);
								void refresh();
							}}
							onReply={handleReply}
						/>
					) : (
						<EmptyState />
					)}
				</main>
			</div>

			<ComposeModal
				ctx={ctx}
				defaultFrom={config.defaultFrom}
				draft={composeDraft}
				onClose={(sent) => {
					setComposeDraft(null);
					if (sent) void refresh();
				}}
			/>

			<SettingsModal
				isOpen={settingsOpen}
				config={config}
				onClose={() => setSettingsOpen(false)}
				onSave={persist}
				onSignOut={() => {
					setConfig(loadConfig());
					setSettingsOpen(false);
				}}
			/>

			<CodeLinksModal
				ctx={ctx}
				isOpen={codeLinksOpen}
				defaultDomain={domainFromConfig(config)}
				onClose={() => setCodeLinksOpen(false)}
			/>
		</div>
	);
}

function EmptyState() {
	return (
		<div className="flex h-full flex-col items-center justify-center gap-3 text-black/40">
			<MailIcon width={56} height={56} />
			<div className="text-sm">Select an email to read</div>
		</div>
	);
}
