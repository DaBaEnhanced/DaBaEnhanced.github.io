'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');

const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const host = process.argv[3] || '127.0.0.1';
const port = Number(process.argv[4] || 8123);

const types = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.png': 'image/png',
	'.wav': 'audio/wav',
	'.atlas': 'application/octet-stream',
	'.bin': 'application/octet-stream',
	'.cells': 'application/octet-stream',
};

function send(res, code, body) {
	res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
	res.end(body);
}

const server = http.createServer((req, res) => {
	let full;
	try {
		const url = new URL(req.url, `http://${host}:${port}/`);
		let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
		if (!rel) rel = 'index.html';
		full = path.resolve(root, rel);
		if (full !== root && !full.startsWith(root + path.sep)) {
			send(res, 403, 'forbidden');
			return;
		}
	} catch (err) {
		send(res, 400, String(err.message || err));
		return;
	}

	fs.stat(full, (statErr, st) => {
		if (statErr) {
			send(res, 404, 'not found');
			return;
		}
		const file = st.isDirectory() ? path.join(full, 'index.html') : full;
		const ext = path.extname(file).toLowerCase();
		res.writeHead(200, {
			'Content-Type': types[ext] || 'application/octet-stream',
			'Cache-Control': 'no-store',
		});
		fs.createReadStream(file)
			.on('error', (err) => {
				if (!res.headersSent) send(res, 500, String(err.message || err));
				else res.destroy(err);
			})
			.pipe(res);
	});
});

server.listen(port, host, () => {
	console.log(`Serving ${root} at http://${host}:${port}/`);
});
