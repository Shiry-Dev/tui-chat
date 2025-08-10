const WebSocket = require('ws');
const readline = require('readline');

function start() {

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const termWidth = () => Math.max(20, process.stdout.columns || 80);

  function clearInputArea() {
    const width = termWidth();
    const promptLen = (rl._prompt || '').length;
    const cur = rl.cursor;
    const cursorRow = Math.floor((promptLen + cur) / width);
    if (cursorRow > 0) readline.moveCursor(process.stdout, 0, -cursorRow);
    readline.cursorTo(process.stdout, 0);
    readline.clearScreenDown(process.stdout);
  }

  function repaintInput(savedLine, savedCursor) {
    const prompt = rl._prompt || '';
    process.stdout.write(prompt + savedLine);
    const back = savedLine.length - savedCursor;
    if (back > 0) readline.moveCursor(process.stdout, -back, 0);
  }

  rl.question('Você é owner ou guest? ', (role) => {
    const ws = new WebSocket('ws://localhost:8080');

    ws.on('open', () => {
      if (role === 'owner') {
        ws.send(JSON.stringify({ type: 'init' }));
      } else {
        rl.question('Digite o sessionId: ', (sessionId) => {
          ws.send(JSON.stringify({ type: 'join', sessionId }));
        });
      }
    });

    ws.on('message', (msg) => {
      const data = JSON.parse(msg);
      if (data.type === 'session_created') {
        console.log(`Session ID gerado: ${data.sessionId}`);
      } else if (data.type === 'joined' || data.type === 'guest_joined') {
        console.log('Conectado! Pode começar a digitar suas mensagens.');
        rl.setPrompt(`${role}: `);
        rl.prompt();
        rl.on('line', (line) => {
          ws.send(JSON.stringify({ type: 'message', content: line }));
          rl.prompt();
        });
      } else if (data.type === 'message') {
        const savedLine = rl.line;
        const savedCursor = rl.cursor;

        clearInputArea();
        process.stdout.write(`${data.from}: ${data.content}\n`);
        repaintInput(savedLine, savedCursor);
      } else if (data.type === 'info') {
        console.clear();
        console.log(`[INFO] ${data.message}`);
        ws.close();
        rl.close();
        setTimeout(() => start(), 1000);
      } else if (data.type === 'error') {
        console.error(`[ERRO] ${data.message}`);
      }
    });
  });
}

start();

