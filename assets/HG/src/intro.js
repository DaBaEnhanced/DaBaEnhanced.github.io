// The intro, played once before the front menu.
//
// Browsers will not start audio without a user gesture, and this has to run
// before anything the player has clicked on. So it starts MUTED and unmutes on
// the first gesture -- which is the same gesture that unlocks the game's audio
// context, so nothing is lost by waiting for it. If autoplay is refused
// outright the intro is skipped rather than left as a black rectangle.
//
// Seen-once is remembered, because sitting through it on every reload while
// developing is intolerable. Hold shift on load, or clear the key, to see it
// again.

const SEEN_KEY = 'hiredguns-intro-seen';

/**
 * @param src   the video URL
 * @param opts  { force } to play even if it has been seen
 * @returns a promise that resolves when the intro is done, skipped or refused
 */
export function playIntro(src, opts = {}) {
	const host = document.getElementById('intro');
	const video = document.getElementById('intro-video');
	if (!host || !video) return Promise.resolve('no player');

	let seen = false;
	try { seen = localStorage.getItem(SEEN_KEY) === '1'; } catch (_) { /* private mode */ }
	if (seen && !opts.force) return Promise.resolve('already seen');

	return new Promise((resolve) => {
		let done = false;
		const finish = (why) => {
			if (done) return;
			done = true;
			try { localStorage.setItem(SEEN_KEY, '1'); } catch (_) { /* private mode */ }
			for (const [t, fn] of listeners) window.removeEventListener(t, fn, true);
			video.pause();
			// Release the buffer; nothing plays this again in the session.
			video.removeAttribute('src');
			video.load();
			host.classList.add('hidden');
			resolve(why);
		};

		// Any gesture unmutes; a second one skips. The first press should not
		// throw away the intro just because it was needed to get sound.
		let unmuted = false;
		const onGesture = (e) => {
			if (e.type === 'keydown' && (e.key === 'F5' || e.key === 'F12')) return;
			e.preventDefault();
			e.stopPropagation();
			if (!unmuted && video.muted) {
				unmuted = true;
				video.muted = false;
				video.volume = 1;
				const skip = document.getElementById('intro-skip');
				if (skip) skip.textContent = 'click or press a key to skip';
				video.play().catch(() => finish('play refused'));
				return;
			}
			finish('skipped');
		};
		const listeners = [
			['pointerdown', onGesture], ['keydown', onGesture],
		];
		for (const [t, fn] of listeners) window.addEventListener(t, fn, true);

		video.addEventListener('ended', () => finish('ended'), { once: true });
		video.addEventListener('error', () => finish('error'), { once: true });

		host.classList.remove('hidden');
		const skip = document.getElementById('intro-skip');
		if (skip) skip.textContent = 'click or press a key for sound';
		video.muted = true;
		video.src = src;
		video.play().catch(() => finish('autoplay refused'));
	});
}

/** Forget that the intro has been seen, so the next load plays it. */
export function resetIntro() {
	try { localStorage.removeItem(SEEN_KEY); } catch (_) { /* private mode */ }
}
