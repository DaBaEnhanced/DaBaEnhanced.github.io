// Web Audio playback for MiscSFX, ExtraSfx, looping atmos, and OGG music.
// Periods are Amiga Paula values; PAL clock 3546895 Hz.

export const PAULA_CLOCK = 3546895;

export const MISC_SFX = [
	null,
	{ key: 'BlockSlide', period: 452 },
	{ key: 'BlockThud', period: 600 },
	{ key: 'Teleport', period: 683 },
	{ key: 'DoorClosed', period: 568 },
	{ key: 'DoorOpening', period: 428 },
	{ key: 'Hit', period: 569 },
	{ key: 'Button', period: 182 },
	{ key: 'Footstep', period: 720 },
	{ key: 'Bump', period: 428 },
];

// The OTHER sample bank, from Data/GameFast.dat/MoreSFX.s. An item's own
// `sample` field indexes THIS one, not MiscSFX above -- Main.s:1013 loads
// moresfx before indexing by fx_sample. Getting that wrong is why a sniper
// rifle used to fire with a block-sliding noise and every psi amp was silent:
// MiscSFX has no tenth entry to reach.
//
// The periods are the ones written beside each incbin in MoreSFX.s, used when
// an item names none of its own. Slot 6 is a hole in the bank -- the label is
// there with no incbin behind it -- and nothing in the item table asks for it.
export const MORE_SFX = [
	null,
	{ key: 'NewGun1', period: 256 },
	{ key: 'NewGun2', period: 256 },
	{ key: 'GunEmpty', period: 360 },
	{ key: 'GunReload', period: 380 },
	{ key: 'EggHatch', period: 360 },
	null,
	{ key: 'Explosion', period: 539 },
	{ key: 'LaserCrack', period: 179 },
	{ key: 'Arc', period: 334 },
	// MoreSFX writes four periods beside cast: 1020,509,255,128. The first is
	// the default here; every item that names slot 10 supplies one of the other
	// three itself, so this only stands in if one ever does not.
	{ key: 'Cast', period: 1020 },
];

export const EX_SFX = [
	null,
	'Bark', 'Bat', 'Grumble', 'Drip', 'DTS', 'EchoScream', 'FemaleGrunt',
	'Gun', 'Lift', 'MaleGrunt', 'MetalClang', 'Roar', 'Swipe', 'Swish',
	'Voice', 'Thunder', 'Unlock', 'GunEmpty2', 'GunFire1', 'GunFire3',
	'GunFire5_alternate', 'GunFire7_alternate', 'GunFire6', 'GunFire8',
	'NewReload', 'Flamethrower', 'GunFire9', 'BigClang', 'Ricochet',
	'StarWarsBlaster', 'SubMachineGun_Eagles', 'Reload4',
];

// Slots the playback path pins a period on, whatever the item asked for
// (Main.s:1026 onward). Only these two; 1 and 2 take the item's own.
export const MORE_PINNED_PERIOD = { 3: 360, 4: 380 };

export const ATMOS_PLAY = [
	{ period: 360, volume: 63 },
	{ period: 1100, volume: 20 },
	{ period: 360, volume: 63 },
	{ period: 180, volume: 63 },
	{ period: 325, volume: 40 },
	{ period: 369, volume: 40 },
	{ period: 856, volume: 30 },
	{ period: 713, volume: 30 },
];

// Main.s:2205 PLAY_EX_SAMPLE #9,#2,#40,#412 -- the lift motor.
export const LIFT_PERIOD = 412;
export const LIFT_VOLUME = 40;

// The lowpass corner above and below the surface. Wide open is above anything
// a Paula sample carries, so the dry path is untouched.
export const DRY_HZ = 20000;
export const UNDERWATER_HZ = 700;

export function locationMusicKey(musicNum) {
	const n = musicNum | 0;
	if (n < 1 || n > 5) return null;
	return `Static0${n}`;
}

export function playbackRate(period, sampleRate) {
	const p = period | 0;
	const rate = sampleRate || 8000;
	if (p <= 0) return 1;
	return (PAULA_CLOCK / p) / rate;
}

function varyPeriod(period) {
	return Math.max(32, (period | 0) + ((Math.random() * 128) | 0) - 64);
}

// Detune spread used when a sound plays at its own recorded rate and there is
// no Paula period to jitter. The period-based jitter above is +/-64, which on a
// period of 360 is about +/-18%; this is deliberately gentler because it
// applies to samples whose natural pitch is already correct.
const NATURAL_VARY = 0.06;

function varyRate() {
	return 1 + (Math.random() * 2 - 1) * NATURAL_VARY;
}

export class AudioEngine {
	constructor() {
		this.ctx = null;
		this.master = null;
		this.sfxGain = null;
		this.musicGain = null;
		this.raw = new Map();
		this.buffers = new Map();
		this.meta = new Map();
		this.music = new Map();
		this.loopNode = null;
		this.musicEl = null;
		this.currentMusic = '';
		this.unlocked = false;
	}

	async load(sfxManifest, musicManifest, fetchBytes, fetchUrl) {
		for (const s of sfxManifest?.sfx || []) {
			this.meta.set(s.key, s);
			try {
				const bytes = await fetchBytes(s.file);
				this.raw.set(s.key, bytes.buffer.slice(0));
			} catch (_) { /* missing clip is silent */ }
		}
		for (const m of musicManifest?.modules || []) {
			if (m.ogg) this.music.set(m.key, fetchUrl(m.ogg));
		}
	}

	_ensure() {
		if (this.ctx) return this.ctx;
		const Ctx = window.AudioContext || window.webkitAudioContext;
		this.ctx = new Ctx();
		this.master = this.ctx.createGain();
		this.sfxGain = this.ctx.createGain();
		this.musicGain = this.ctx.createGain();
		this.sfxGain.gain.value = 0.85;
		this.musicGain.gain.value = 0.4;
		this.sfxGain.connect(this.master);
		this.musicGain.connect(this.master);
		// ADDITION: the original has no filtering of any kind -- Paula plays a
		// sample at a period and that is the whole of it. This is one lowpass on
		// the master bus, wide open until a head goes under, so nothing is
		// coloured while the party is dry.
		this.underwater = this.ctx.createBiquadFilter();
		this.underwater.type = 'lowpass';
		this.underwater.frequency.value = DRY_HZ;
		this.underwater.Q.value = 0.7;
		this.master.connect(this.underwater);
		this.underwater.connect(this.ctx.destination);
		return this.ctx;
	}

	async unlock() {
		const ctx = this._ensure();
		if (ctx.state === 'suspended') await ctx.resume();
		this.unlocked = ctx.state === 'running';
		if (this.unlocked) await this._decodeAll();
		return this.unlocked;
	}

	async _decodeAll() {
		const ctx = this._ensure();
		for (const [key, raw] of this.raw) {
			if (this.buffers.has(key)) continue;
			try {
				this.buffers.set(key, await ctx.decodeAudioData(raw.slice(0)));
			} catch (_) { /* skip bad clip */ }
		}
	}

	/** Is a clip decoded and ready? Lets callers pick a fallback sample. */
	hasKey(key) {
		return this.buffers.has(key);
	}

	playKey(key, { period = 0, volume = 63, vary = true, loop = false } = {}) {
		if (!this.unlocked) return null;
		const buf = this.buffers.get(key);
		if (!buf) return null;
		const ctx = this._ensure();
		const src = ctx.createBufferSource();
		src.buffer = buf;
		const meta = this.meta.get(key);
		// Play at the sample's own recorded rate unless the caller knows the
		// Paula period the game uses.
		//
		// The 8SVX rate field is not arbitrary: for all 61 effects,
		// PAULA_CLOCK / sampleRate lands within 0.5 of an integer, in the 63 to
		// 1007 range. The rate encodes the period the sound was authored for,
		// so playing the buffer at its own rate reproduces the intended pitch.
		// The previous fallback forced one period on every clip, which ran a
		// third of them at 0.57x-0.84x (the muffled ones) and others as fast as
		// 3.96x.
		// Rate must be computed against the clip's ORIGINAL sample rate, which
		// is meta.sampleRate -- NOT buf.sampleRate. decodeAudioData resamples
		// every clip to the AudioContext's rate (typically 48000) while
		// preserving pitch, so buf.sampleRate is 48000 for all of them.
		// Dividing by that made Footstep (period 720) play at
		// (3546895/720)/48000 = 0.10x speed; every MISC_SFX with an explicit
		// period was an order of magnitude too slow, which is the muffling.
		// Playing the decoded buffer at rate 1 gives the clip's natural pitch.
		const p = period || meta?.period || 0;
		const natural = meta?.sampleRate || buf.sampleRate;
		src.playbackRate.value = p > 0
			? playbackRate(vary ? varyPeriod(p) : p, natural)
			: (vary ? varyRate() : 1);
		// Loop only when the CALLER asks. An 8SVX repeat section is instrument
		// metadata, not an instruction: DoorOpening and Lift both carry one, so
		// honouring it made those one-shots drone forever with nothing to stop
		// them (stopLoop only tracks the atmos node). That constant bed is what
		// made everything else sound muffled and gave gunfire a false echo.
		// playAtmos and playWater pass loop: true explicitly.
		if (loop) {
			src.loop = true;
			if (meta?.loop && buf.sampleRate) {
				src.loopStart = (meta.loop.start || 0) / (meta.sampleRate || buf.sampleRate);
				src.loopEnd = ((meta.loop.start || 0) + (meta.loop.length || 0)) /
					(meta.sampleRate || buf.sampleRate);
			}
		}
		const g = ctx.createGain();
		g.gain.value = Math.max(0, Math.min(1, (volume | 0) / 64));
		src.connect(g);
		g.connect(this.sfxGain);
		src.start();
		return src;
	}

	/**
	 * Muffle everything, or stop muffling.
	 *
	 * Ramped rather than switched: stepping in and out of water flips this on
	 * consecutive frames at a shoreline, and a hard cutoff change clicks. The
	 * time constant is short enough that going under still feels immediate.
	 */
	setUnderwater(on) {
		const want = !!on;
		if (this.submerged === want) return want;
		this.submerged = want;
		if (!this.ctx || !this.underwater) return want;
		const t = this.ctx.currentTime;
		this.underwater.frequency.cancelScheduledValues(t);
		this.underwater.frequency.setTargetAtTime(want ? UNDERWATER_HZ : DRY_HZ, t, 0.06);
		return want;
	}

	playMisc(index, opts = {}) {
		const rec = MISC_SFX[index | 0];
		if (!rec) return null;
		const vary = opts.vary !== false && index !== 3 && index !== 4 && index !== 5;
		return this.playKey(rec.key, { period: opts.period || rec.period, volume: opts.volume ?? 63, vary });
	}

	/**
	 * A sample from the moresfx bank -- guns, casting, the explosion.
	 *
	 * Main.s:1026 overrides the period for some slots regardless of what the
	 * item asked for: 1 and 2 take the item's, but 3 and 4 are pinned to 360
	 * and 380. That is reproduced here rather than in the caller, since it is a
	 * property of the bank.
	 */
	playMore(index, opts = {}) {
		const n = index | 0;
		const rec = MORE_SFX[n];
		if (!rec) return null;
		const pinned = MORE_PINNED_PERIOD[n];
		return this.playKey(rec.key, {
			period: pinned || opts.period || rec.period,
			volume: opts.volume ?? 63,
			vary: opts.vary !== false,
		});
	}

	playEx(index, opts = {}) {
		const key = EX_SFX[index | 0];
		if (!key) return null;
		// No period: ExtraSfx has no period table in the shipped sources
		// (play_sfx exists only as a macro in Macros.i), so each clip plays at
		// its own rate.
		return this.playKey(key, {
			period: opts.period || 0,
			volume: opts.volume ?? 63,
			vary: opts.vary !== false,
		});
	}

	playAtmos(atmosNum) {
		this.stopLoop();
		const n = atmosNum | 0;
		const play = ATMOS_PLAY[n];
		if (!play) return;
		const key = `Atmos0${n}`;
		this.loopNode = this.playKey(key, {
			period: play.period,
			volume: play.volume,
			vary: false,
			loop: true,
		});
	}

	playWater(level = 0) {
		this.stopLoop();
		this.loopNode = this.playKey('UnderWater', {
			period: 284 + ((level & 3) << 5),
			volume: 50,
			vary: false,
			loop: true,
		});
	}

	stopLoop() {
		try { this.loopNode?.stop(); } catch (_) { /* already stopped */ }
		this.loopNode = null;
	}

	/**
	 * The lift motor. Main.s:2205 plays extra sample 9 on channel 2 at volume
	 * 40, period 412, on the rising edge of on_a_lift, and silences that
	 * channel (`move.w #0,aud2lch+vol`) the moment you step off -- so it runs
	 * for as long as the ride does. Lift is one of the few effects whose 8SVX
	 * repeat section is real, which is why this asks for loop explicitly.
	 * It gets its own node so it does not fight the atmos/water loop.
	 */
	startLift() {
		if (this.liftNode) return;
		this.liftNode = this.playKey('Lift', {
			period: LIFT_PERIOD, volume: LIFT_VOLUME, vary: false, loop: true,
		});
	}

	stopLift() {
		try { this.liftNode?.stop(); } catch (_) { /* already stopped */ }
		this.liftNode = null;
	}

	playMusic(key) {
		if (!key || this.currentMusic === key) return;
		this.stopMusic();
		const url = this.music.get(key);
		if (!url) return;
		const el = new Audio(url);
		el.loop = true;
		el.volume = 0.45;
		el.play().catch(() => {});
		this.musicEl = el;
		this.currentMusic = key;
	}

	stopMusic() {
		if (this.musicEl) {
			this.musicEl.pause();
			this.musicEl.src = '';
			this.musicEl = null;
		}
		this.currentMusic = '';
	}

	setMap(locn) {
		const music = locationMusicKey(locn?.musicNum);
		if (music) this.playMusic(music);
		else this.stopMusic();
		this.playAtmos(locn?.atmos | 0);
	}
}

export function createAudio() {
	return new AudioEngine();
}
