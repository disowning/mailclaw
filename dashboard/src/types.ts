export interface AttachmentSummary {
	id: string;
	email_id: string;
	filename: string | null;
	mime_type: string | null;
	size: number;
	created_at: number;
}

export interface EmailSummary {
	id: string;
	from_address: string;
	to_address: string;
	subject: string | null;
	received_at: number;
	has_attachments: boolean;
	attachment_count: number;
}

export interface Email extends EmailSummary {
	html_content: string | null;
	text_content: string | null;
	attachments?: AttachmentSummary[];
}

export interface PaginatedEmails<T = EmailSummary> {
	emails: T[];
	total: number;
	limit: number;
	offset: number;
}

export interface EmailFilters {
	from?: string;
	to?: string;
	domain?: string;
	q?: string;
	after?: string;
	before?: string;
	limit?: number;
	offset?: number;
}

export interface SendEmailRequest {
	from: string;
	to: string | string[];
	subject: string;
	html?: string;
	text?: string;
	cc?: string | string[];
	bcc?: string | string[];
	reply_to?: string | string[];
}

export interface SendEmailResponse {
	id: string;
	provider: string;
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

export interface CodeLinkItem {
	email: string;
	inbox_url: string;
	code_url: string;
	expires_at: number;
}

export interface CodeLinkResponse {
	items: CodeLinkItem[];
	total: number;
	expires_at: number;
}

export interface DeleteEmailsResponse {
	deleted: number;
	limit: number;
}

export interface ApiOk<T> {
	success: true;
	data: T;
}

export interface ApiErr {
	success: false;
	error: { code: string; message: string };
}

export type ApiResponse<T> = ApiOk<T> | ApiErr;
