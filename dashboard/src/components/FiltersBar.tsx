import { Button, Input, SearchField } from "@heroui/react";
import { useEffect, useState } from "react";
import type { EmailFilters } from "@/types";

interface Props {
	value: EmailFilters;
	onChange: (next: EmailFilters) => void;
	onDeleteFiltered: () => void;
	deleting?: boolean;
}

export function FiltersBar({ value, onChange, onDeleteFiltered, deleting = false }: Props) {
	const [q, setQ] = useState(value.q ?? "");
	const [from, setFrom] = useState(value.from ?? "");
	const [to, setTo] = useState(value.to ?? "");
	const [domain, setDomain] = useState(value.domain ?? "");
	const [after, setAfter] = useState(value.after ?? "");
	const [before, setBefore] = useState(value.before ?? "");

	useEffect(() => {
		setQ(value.q ?? "");
		setFrom(value.from ?? "");
		setTo(value.to ?? "");
		setDomain(value.domain ?? "");
		setAfter(value.after ?? "");
		setBefore(value.before ?? "");
	}, [value.q, value.from, value.to, value.domain, value.after, value.before]);

	function apply() {
		onChange({
			...value,
			q: q.trim() || undefined,
			from: from.trim() || undefined,
			to: to.trim().toLowerCase() || undefined,
			domain: domain.trim().toLowerCase().replace(/^@/, "") || undefined,
			after: after || undefined,
			before: before || undefined,
			offset: 0,
		});
	}

	function clear() {
		setQ("");
		setFrom("");
		setTo("");
		setDomain("");
		setAfter("");
		setBefore("");
		onChange({ limit: value.limit, offset: 0 });
	}

	const hasFilters = Boolean(q || from || to || domain || after || before);

	return (
		<div className="flex flex-wrap items-center gap-2 border-b border-black/5 bg-white px-4 py-3">
			<SearchField className="min-w-[220px] flex-1" value={q} onChange={setQ} onSubmit={apply}>
				<Input placeholder="Search subject, sender, body" />
			</SearchField>
			<Input
				className="w-[220px]"
				placeholder="From: someone@example.com"
				value={from}
				onChange={(e) => setFrom((e.target as HTMLInputElement).value)}
				onKeyDown={(e) => {
					if (e.key === "Enter") apply();
				}}
			/>
			<Input
				className="w-[220px]"
				placeholder="To: name@example.com"
				value={to}
				onChange={(e) => setTo((e.target as HTMLInputElement).value)}
				onKeyDown={(e) => {
					if (e.key === "Enter") apply();
				}}
			/>
			<Input
				className="w-[180px]"
				placeholder="Domain: example.com"
				value={domain}
				onChange={(e) => setDomain((e.target as HTMLInputElement).value)}
				onKeyDown={(e) => {
					if (e.key === "Enter") apply();
				}}
			/>
			<Input
				className="w-[150px]"
				type="date"
				aria-label="After date"
				value={after}
				onChange={(e) => setAfter((e.target as HTMLInputElement).value)}
			/>
			<Input
				className="w-[150px]"
				type="date"
				aria-label="Before date"
				value={before}
				onChange={(e) => setBefore((e.target as HTMLInputElement).value)}
			/>
			<Button variant="secondary" onPress={apply}>
				Apply
			</Button>
			{hasFilters ? (
				<Button variant="ghost" onPress={clear}>
					Clear
				</Button>
			) : null}
			<Button
				variant="danger"
				isDisabled={!hasFilters}
				isPending={deleting}
				onPress={onDeleteFiltered}
			>
				Delete
			</Button>
		</div>
	);
}
