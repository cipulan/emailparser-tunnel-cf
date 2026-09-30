import PostalMime from 'postal-mime';

interface Env {
TELEGRAM_BOT_TOKEN: string;
	TELEGRAM_CHAT_ID: string;
	TELEGRAM_TOPIC_ID?: string;
	WA_API_URL?: string;
	WA_API_KEY?: string;
	WA_GROUP_ID?: string;
	WA_SESSION?: string;
	WA_ENABLED?: string;
}

export default {
	async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
		const telegramBotToken = env.TELEGRAM_BOT_TOKEN;
		const telegramChatId = env.TELEGRAM_CHAT_ID;
		const telegramTopicId = env.TELEGRAM_TOPIC_ID;

		if (!telegramBotToken || !telegramChatId) {
			console.error('Missing Telegram configuration');
			return;
		}

		try {
			const parser = new PostalMime();
			const email = await parser.parse(message.raw);

			// Check for forwarded content
			const forwarded = parseForwardedMail(email.text || email.html || '');

			// Use original details if available, otherwise fall back to current email headers
			const subject = forwarded.subject || email.subject || '(No Subject)';
			const date = forwarded.date || '';

			// Extract tunnel health details if available
			const tunnelDetails = parseTunnelDetails(email.text || email.html || '');

			let telegramMessage = `🚇 *${escapeMarkdown(tunnelDetails.title || subject)}*\n` +
				`\n` +
				`*Tunnel details:*\n` +
				`*Name:* ${escapeMarkdown(tunnelDetails.name)}\n` +
				`*ID:* ${escapeMarkdown(tunnelDetails.id)}\n` +
				`*New status:* ${escapeMarkdown(tunnelDetails.newStatus)}`;

			if (date) {
				telegramMessage += `\n\n_Date:_ ${escapeMarkdown(date)}`;
			}

			await sendToTelegram(telegramBotToken, telegramChatId, telegramTopicId, telegramMessage);

			await sendToWhatsApp(env.WA_API_URL, env.WA_API_KEY, env.WA_GROUP_ID, telegramMessage, env.WA_SESSION, env.WA_ENABLED);

		} catch (error) {
			console.error('Error parsing email or sending to Telegram:', error);
			// Optional: send error notification to Telegram or log it
		}
	}
};

export function parseTunnelDetails(content: string): {
	title: string,
	name: string,
	id: string,
	newStatus: string
} {
	// Defaults
	let title = '';
	let name = 'N/A';
	let id = 'N/A';
	let newStatus = 'N/A';

	if (!content) return { title, name, id, newStatus };

	// Normalize: strip HTML tags (keep line breaks), collapse whitespace
	const normalized = content
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/p>|<\/div>|<\/li>|<\/tr>/gi, '\n')
		.replace(/<[^>]*>/g, '')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&')
		.replace(/&#39;|&#x27;/g, "'")
		.replace(/[ \t]+/g, ' ');

	// Title: first line like "Tunnel tunnel-name is now degraded"
	const titleMatch = normalized.match(/^\s*Tunnel\s+.+?\s+is\s+now\s+.+$/m);
	if (titleMatch) title = titleMatch[0].trim();

	// Name
	const nameMatch = normalized.match(/(?:^|\n)\s*(?:-\s*)?Name:\s*([^\r\n]+)/);
	if (nameMatch && nameMatch[1]) name = nameMatch[1].trim();

	// ID
	const idMatch = normalized.match(/(?:^|\n)\s*(?:-\s*)?ID:\s*([^\r\n]+)/);
	if (idMatch && idMatch[1]) id = idMatch[1].trim();

	// New status
	const statusMatch = normalized.match(/(?:^|\n)\s*(?:-\s*)?New status:\s*([^\r\n]+)/);
	if (statusMatch && statusMatch[1]) newStatus = statusMatch[1].trim();

	return { title, name, id, newStatus };
}

function parseForwardedMail(content: string): { from?: string, subject?: string, date?: string } {
	let from, subject, date;

	// Normalize content to help with matching
	// Replace <br> with newlines
	const normalized = content.replace(/<br\s*\/?>/gi, '\n');

	// Regex for "From" / "Dari" in forwarded block
	const fromMatch = normalized.match(/(?:Dari|From):\s*(.*?)(\r?\n|$)/i);
	if (fromMatch && fromMatch[1]) {
		// Remove HTML tags and extra whitespace
		from = fromMatch[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
		// Decode HTML entities (basic ones)
		from = from.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
	}

	// Regex for "Date" / "Tanggal"
	const dateMatch = normalized.match(/(?:Date|Tanggal|Sent):\s*(.*?)(\r?\n|$)/i);
	if (dateMatch && dateMatch[1]) {
		date = dateMatch[1].replace(/<[^>]*>/g, '').trim();
	}

	// Regex for "Subject" - Handle potential multi-line subjects
	// We look for Subject: ... then either To: or Date: or just end of line if it's the last header
	const subjectMatch = normalized.match(/Subject:\s*([\s\S]*?)(\r?\n(?:To|Date|Dari|Sent):|\r?\n\r?\n|$)/i);
	if (subjectMatch && subjectMatch[1]) {
		subject = subjectMatch[1].replace(/<[^>]*>/g, '').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
	}

	return { from, subject, date };
}

async function sendToTelegram(token: string, chatId: string, topicId: string | undefined, text: string) {
	const url = `https://api.telegram.org/bot${token}/sendMessage`;
	const body: Record<string, unknown> = {
		chat_id: chatId,
		text: text,
		parse_mode: 'Markdown'
	};

	if (topicId) {
		body.message_thread_id = topicId;
	}

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.error(`Telegram API error: ${response.status} ${response.statusText} - ${errorText}`);
	}
}

function escapeMarkdown(text: string): string {
    if (!text) return '';
	// 'Markdown' (v1) supports *bold*, _italic_, [text](url), `code`, ```pre```
    // We should allow some marks if they are intended, but since we are wrapping values, 
    // it's safest to escape everything that could break the format headers.
    // However, for values like "RP. 10.000", * or _ are rare.
	return text.replace(/[_*`\\[]/g, '\\$&');
}


async function sendToWhatsApp(apiUrl: string | undefined, apiKey: string | undefined, groupId: string | undefined, text: string, session?: string, enabled?: string) {
	if (enabled !== 'true') {
		return;
	}
	if (!apiUrl || !apiKey || !groupId) {
		console.error('Missing WhatsApp configuration, skipping');
		return;
	}
	const url = apiUrl.replace(/\/$/, '') + '/api/sendText';
	try {
		const resp = await fetch(url, {
			method: 'POST',
			headers: {
				'accept': 'application/json',
				'X-Api-Key': apiKey,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				chatId: groupId,
				text: text,
				session: session || 'default',
			}),
		});
		if (!resp.ok) {
			console.error('WhatsApp send failed:', resp.status, await resp.text());
		}
	} catch (error) {
		console.error('Error sending to WhatsApp:', error);
	}
}
