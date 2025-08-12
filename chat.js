const WebSocket = require('ws');
const readline = require('readline');

function start() {
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
	let role = 'guest';
	let ws;

	const cols = () => Math.max(20, process.stdout.columns || 80);
	const rows = () => Math.max(8, process.stdout.rows || 24);
	const divider = () => '─'.repeat(cols());

	function wrap(line, w) {
		const out = [];
		for (let i = 0; i < line.length; i += w) out.push(line.slice(i, i + w));
		return out;
	}

	const messages = []; 

	function push(from, content) {
		messages.push({ from, content });
		render();
	}

	function render() {
		const savedLine = rl.line;
		const savedCursor = rl.cursor;

		const w = cols();
		const h = rows() - 2;

		let lines = [];
		for (const m of messages) lines = lines.concat(wrap(`${m.from}: ${m.content}`, w));
		lines = lines.slice(-h);

		process.stdout.write('\x1b[2J\x1b[H');
		for (const ln of lines) process.stdout.write(ln + '\n');
		process.stdout.write(divider() + '\n');

		const prompt = `${role}: `;
		process.stdout.write(prompt + savedLine);
		const back = savedLine.length - savedCursor;
		if (back > 0) readline.moveCursor(process.stdout, -back, 0);
	}

	let EXITED = false;

	function hardClear() {
		process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
	}

	function cleanupAndExit(code = 0) {
		if (EXITED) return;
		EXITED = true;
		try { ws?.close(); } catch {}
		try { rl.close(); } catch {}
		hardClear();
		process.exit(code);
	}

	rl.on('SIGINT', () => cleanupAndExit(0));
	process.on('SIGHUP', () => cleanupAndExit(0));
	process.on('SIGTERM', () => cleanupAndExit(0));
	process.stdout.on('resize', render);

	rl.question('Você é owner ou guest? ', (answerRole) => {
		role = (answerRole || 'guest').trim();
		rl.setPrompt(`${role}: `);

		// ws = new WebSocket('ws://localhost:8080');
		ws = new WebSocket('https://websocket-chat-i936.onrender.com/');

		ws.on('open', () => {
			if (role === 'owner') {
				ws.send(JSON.stringify({ type: 'init' }));
			} else {
				rl.question('Digite o sessionId: ', (sessionId) => {
					ws.send(JSON.stringify({ type: 'join', sessionId }));
				});
			}
		});

		ws.on('message', (raw) => {
			const data = JSON.parse(raw);

			if (data.type === 'session_created') {
				push('INFO', `Session ID gerado: ${data.sessionId}`);
			} else if (data.type === 'joined' || data.type === 'guest_joined') {
				push('INFO', 'Conectado! Pode começar a digitar suas mensagens.');
				render(); 
				rl.on('line', (line) => {
					push(role, line);
					ws.send(JSON.stringify({ type: 'message', content: line }));
				});
			} else if (data.type === 'message') {
				const from = String(data.from || '').toLowerCase();
				if (from === String(role).toLowerCase()) return;
				push(data.from, data.content);
			} else if (data.type === 'info') {
				cleanupAndExit(0);
			} else if (data.type === 'error') {
				push('ERRO', data.message || 'Erro');
			}
		});

		ws.on('close', () => cleanupAndExit(0));
		ws.on('error', () => cleanupAndExit(1));
	});
}

start();

