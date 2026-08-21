'use strict';
// Extract `dc.b/dc.w/dc.l` data tables out of the original 68k sources.
//
// The tables in Tables.s are written as small constant expressions over the map
// geometry symbols (`(1*a-4*w-2)*4`, `55*4`, `xxxx`), so pulling them out
// faithfully just needs an expression evaluator rather than a full assembler.
// This keeps the derived data honest: it is generated from the shipped source,
// never retyped.

const fs = require('fs');

/** Map geometry symbols used by the view tables (Sources/Tables.s). */
const DEFAULT_SYMBOLS = {
	w: 23,      // MAP_WIDTH
	d: 23,      // MAP_DEPTH
	a: 23 * 23, // map floor area
	xxxx: -1,   // "no entry" sentinel
};

/** Evaluate a constant 68k expression: integers, + - * / ( ), and symbols. */
function evalExpr(src, symbols) {
	let i = 0;
	const s = src.replace(/\s+/g, '');

	function peek() { return s[i]; }
	function parsePrimary() {
		if (peek() === '(') { i++; const v = parseAdd(); i++; /* ')' */ return v; }
		if (peek() === '-') { i++; return -parsePrimary(); }
		if (peek() === '+') { i++; return parsePrimary(); }
		if (peek() === '$') { // hex
			i++; let t = '';
			while (i < s.length && /[0-9a-fA-F]/.test(s[i])) t += s[i++];
			return parseInt(t, 16);
		}
		if (peek() === '%') { // binary
			i++; let t = '';
			while (i < s.length && /[01]/.test(s[i])) t += s[i++];
			return parseInt(t, 2);
		}
		let t = '';
		while (i < s.length && /[0-9A-Za-z_.]/.test(s[i])) t += s[i++];
		if (t === '') throw new Error(`cannot parse "${src}" at ${i}`);
		if (/^\d+$/.test(t)) return parseInt(t, 10);
		if (t in symbols) return symbols[t];
		throw new Error(`unknown symbol "${t}" in "${src}"`);
	}
	function parseMul() {
		let v = parsePrimary();
		while (peek() === '*' || peek() === '/') {
			const op = s[i++];
			const r = parsePrimary();
			v = op === '*' ? v * r : Math.trunc(v / r);
		}
		return v;
	}
	function parseAdd() {
		let v = parseMul();
		while (peek() === '+' || peek() === '-') {
			const op = s[i++];
			const r = parseMul();
			v = op === '+' ? v + r : v - r;
		}
		return v;
	}
	return parseAdd();
}

/** Split a dc operand list on commas that are not inside parentheses. */
function splitOperands(line) {
	const out = [];
	let depth = 0, cur = '';
	for (const ch of line) {
		if (ch === '(') depth++;
		else if (ch === ')') depth--;
		if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
		cur += ch;
	}
	if (cur.trim()) out.push(cur);
	return out.map((s) => s.trim()).filter(Boolean);
}

/**
 * Read the data table that starts at `label` and runs until the next label.
 * @returns {{values: number[], width: 1|2|4}}
 */
function extractTable(file, label, symbols = DEFAULT_SYMBOLS) {
	const lines = fs.readFileSync(file, 'latin1').split(/\r?\n/);
	const start = lines.findIndex((l) => new RegExp(`^${label}\\b`).test(l));
	if (start < 0) throw new Error(`label ${label} not found in ${file}`);

	const values = [];
	let width = 0;
	for (let n = start; n < lines.length; n++) {
		let line = lines[n];
		const semi = line.indexOf(';');
		if (semi >= 0) line = line.slice(0, semi);

		if (n > start && /^\S/.test(line) && line.trim()) break; // next label ends the table

		const m = line.match(/\bdc\.([bwl])\s+(.*)$/i);
		if (!m) continue;
		const w = { b: 1, w: 2, l: 4 }[m[1].toLowerCase()];
		if (width && w !== width) break; // a change of element size means a new table
		width = w;
		for (const op of splitOperands(m[2])) {
			if (/^["']/.test(op)) continue; // string literal, not numeric data
			values.push(evalExpr(op, symbols));
		}
	}
	return { values, width };
}

module.exports = { extractTable, evalExpr, splitOperands, DEFAULT_SYMBOLS };
