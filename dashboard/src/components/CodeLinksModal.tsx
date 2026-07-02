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
import { CopyIcon } from "@/components/Icons";
import type { CodeLinkItem } from "@/types";

interface Props {
	ctx: ClientCtx;
	isOpen: boolean;
	defaultDomain: string;
	onClose: () => void;
}

const DAY_SECONDS = 24 * 60 * 60;

export function CodeLinksModal({ ctx, isOpen, defaultDomain, onClose }: Props) {
	const [domain, setDomain] = useState(defaultDomain);
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
		setDomain((current) => current || defaultDomain);
		setError(null);
		setCopied(null);
	}, [isOpen, defaultDomain]);

	const csvText = useMemo(() => {
		return items
			.map((item) => [item.email, item.inbox_url, item.code_url, item.expires_at].join(","))
			.join("\n");
	}, [items]);

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		setError(null);
		setCopied(null);
		setLoading(true);

		try {
			const result = await api.createCodeLinks(ctx, {
				domain: domain.trim() || undefined,
				count: Math.max(0, Math.floor(count || 0)),
				prefixes: prefixes.trim() || undefined,
				emails: emails.trim() || undefined,
				ttl_seconds: Math.max(1, Math.floor(ttlDays || 1)) * DAY_SECONDS,
				plain: true,
			});
			setItems(result.items);
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
								<TextField name="domain" value={domain} onChange={setDomain} fullWidth>
									<Label>Domain</Label>
									<Input placeholder="example.com" />
									<Description>Used for random addresses and prefixes.</Description>
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

							<div className="grid gap-3 sm:grid-cols-2">
								<TextField name="prefixes" value={prefixes} onChange={setPrefixes} fullWidth>
									<Label>Prefixes</Label>
									<TextArea rows={5} placeholder={"apple01\napple02\nlogin-test"} />
									<Description>One per line. The domain above will be added.</Description>
								</TextField>
								<TextField name="emails" value={emails} onChange={setEmails} fullWidth>
									<Label>Full emails</Label>
									<TextArea rows={5} placeholder={"apple01@example.com\napple02@example.com"} />
									<Description>Use this when you already have exact addresses.</Description>
								</TextField>
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
										<Button
											type="button"
											size="sm"
											variant="ghost"
											onPress={() => void copy(csvText, "batch")}
										>
											<CopyIcon /> Copy all
										</Button>
									</div>
									<div className="max-h-[280px] overflow-y-auto">
										{items.map((item) => (
											<div
												key={item.code_url}
												className="grid gap-2 border-b border-black/5 px-3 py-2 text-sm last:border-b-0 sm:grid-cols-[220px_1fr_auto]"
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
