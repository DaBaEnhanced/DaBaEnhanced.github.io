---
layout: page
title: "Games"
permalink: /games
---

Here are the games I've been developing lately (well, mostly vibecoding), starting with my original projects and followed by [browser ports of old Amiga games](#browser-ports).

<style>
	.game-card {
		background: var(--vault-panel, #151923);
		border: 1px solid var(--vault-border, rgba(255, 255, 255, 0.08));
		border-radius: 10px;
		margin: 1.5rem 0;
		padding: 1rem;
		position: relative;
		transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
	}

	.game-card::before {
		background: #e5484d;
		border-radius: 10px 10px 0 0;
		content: "";
		height: 3px;
		left: 0;
		position: absolute;
		right: 0;
		top: 0;
	}

	.game-card:hover {
		border-color: #e5484d;
		box-shadow: 0 10px 28px -12px #e5484d;
		transform: translateY(-3px);
	}

	.game-card img {
		max-width: 100%;
	}

	.games-banner {
		border: 1px solid var(--vault-border, rgba(255, 255, 255, 0.08));
		border-radius: 10px;
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22);
		margin: 1.5rem 0 2rem;
		overflow: hidden;
	}

	.games-banner img {
		display: block;
		height: auto;
		width: 100%;
	}

	.game-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 1.25rem;
	}

	.game-button {
		align-items: center;
		background: #24292f;
		border: 1px solid #24292f;
		border-radius: 6px;
		box-shadow: 0 2px 4px rgba(31, 35, 40, 0.12);
		color: #ffffff;
		display: inline-flex;
		font-weight: 600;
		gap: 0.5rem;
		padding: 0.65rem 0.9rem;
		text-decoration: none;
		transition: background-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
	}

	.game-button:hover,
	.game-button:focus-visible {
		background: #0969da;
		box-shadow: 0 4px 10px rgba(9, 105, 218, 0.28);
		color: #ffffff;
		transform: translateY(-1px);
	}

	.game-button:focus-visible {
		outline: 3px solid rgba(9, 105, 218, 0.35);
		outline-offset: 2px;
	}

	.game-button-icon {
		font-size: 1.1em;
		line-height: 1;
	}

	.game-slideshow {
		background: #24292f;
		border-radius: 6px;
		margin: 0.5rem auto 1rem;
		max-width: 720px;
		overflow: hidden;
		padding: 0;
		position: relative;
		aspect-ratio: 3 / 2;
		width: 50%;
	}

	.game-slideshow a {
		display: block;
		flex: 0 0 100%;
	}

	.game-slideshow-track {
		display: flex;
		height: 100%;
		transition: transform 700ms ease;
		width: 100%;
	}

	.game-slideshow img {
		display: block;
		flex: 0 0 100%;
		height: 100% !important;
		margin: 0 auto;
		object-fit: cover !important;
		width: 100% !important;
	}

	@media (max-width: 699px) {
		.game-slideshow {
			width: 100%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.game-slideshow-track {
			transition: none;
		}
	}
</style>

<script>
	function initializeGameSlideshows() {
		const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

		document.querySelectorAll(".game-slideshow").forEach(function (slideshow) {
			const slides = Array.from(slideshow.querySelectorAll("a"));
			const track = document.createElement("div");
			let currentSlide = 0;
			let timer;

			if (slides.length < 2) {
				return;
			}

			track.className = "game-slideshow-track";
			slides.forEach(function (slide) {
				track.appendChild(slide);
			});
			slideshow.appendChild(track);

			const showSlide = function (slideIndex) {
				currentSlide = slideIndex % slides.length;
				track.style.transform = "translateX(-" + (currentSlide * 100) + "%)";
			};

			const stop = function () {
				window.clearInterval(timer);
			};

			const start = function () {
				stop();
				if (!prefersReducedMotion) {
					timer = window.setInterval(function () {
						showSlide(currentSlide + 1);
					}, 4500);
				}
			};

			showSlide(0);
			slideshow.addEventListener("mouseenter", stop);
			slideshow.addEventListener("mouseleave", start);
			slideshow.addEventListener("focusin", stop);
			slideshow.addEventListener("focusout", start);
			start();
		});
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initializeGameSlideshows);
	} else {
		initializeGameSlideshows();
	}
</script>

<div class="games-banner">
	<img src="{{ site.cdn_url }}/images/games_banner.jpg" alt="D. B. Waldtier — game ports, books, and worlds" />
</div>

## Original games

<article class="game-card" markdown="1">
### The Moon That Forgot

<img src="{{ site.cdn_url }}/images/moonforgot.jpg" alt="The Moon That Forgot title" style="object-position: center;" />

**The Moon That Forgot** is a work-in-progress retro point-and-click adventure based on my novel of the same name. You wake inside a dying Ark with no clear memory of how long you’ve been asleep, accompanied only by a damaged maintenance robot named M7. Explore, talk, investigate, combine objects, and solve increasingly strange machine-logic puzzles as you uncover what happened to the sleepers, what the Ark has become, and what is still moving beyond its walls.
Final art style would be different than what the banner above hint at, and more similar to my book cover's artworks.

I am vibecoding the adventure game editor, tools to turn images into pixel art, background matting, de-spilling colors, closing animation loops, and using image gen, video gen and musicgen to generate almost all art assets.

<div class="game-slideshow">
	<a href="{{ site.cdn_url }}/images/MF/1.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/MF/1.jpg" alt="Hired Guns screenshot 1" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/images/MF/2.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/MF/2.jpg" alt="Hired Guns screenshot 2" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/images/MF/3.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/MF/3.jpg" alt="Hired Guns screenshot 3" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/images/MF/4.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/MF/4.jpg" alt="Hired Guns screenshot 4" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/images/MF/5.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/MF/5.jpg" alt="Hired Guns screenshot 5" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/images/MF/6.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/MF/6.jpg" alt="Hired Guns screenshot 6" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/images/MF/7.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/MF/7.jpg" alt="Hired Guns screenshot 7" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/images/MF/8.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/MF/8.jpg" alt="Hired Guns screenshot 8" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/images/MF/9.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/MF/9.jpg" alt="Hired Guns screenshot 9" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/images/MF/10.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/MF/10.jpg" alt="Hired Guns screenshot 10" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/images/MF/11.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/MF/11.jpg" alt="Hired Guns screenshot 11" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
</div>

Here is a work-in-progress taste of the game's first chapter!

<div class="game-actions">
	<a class="game-button" href="{{ site.cdn_url }}/games/moonforgot/game/index.html?bundle=../bundle.json"><span class="game-button-icon" aria-hidden="true">&#9654;</span>Play the Chapter 1 demo in browser</a>
</div>

</article>

<article class="game-card" markdown="1">
### MegaPop
<img src="{{ site.cdn_url }}/images/megapop.jpg" alt="Megapop title" style="object-position: center;" />

My next project won't be a port, but a new game.
**PROJECT MEGAPOP** is a retro-inspired god game where you guide a semi-autonomous civilization from primitive settlements to a dangerous technological future. Shape the land, influence your people, uncover local resources, push research forward, build industry, wage wars, and unleash divine powers as the world evolves around you. Every mountain moved, city founded, resource discovered, and war fought can change the course of history. And by the time your followers reach the nuclear age, they may have become powerful enough to survive without you... or destroy everything you helped them build.
Think Populus meets Mega-lo-Mania!

</article>

## Browser ports

These are unofficial, fan-made browser reconstructions created as technical and historical projects. Copyrights and trademarks in the original games and their assets belong to their respective rightsholders. No affiliation with or endorsement by those rightsholders is claimed.

Planned addition are (in no specific order):
- SWIV.
- Banshee. 
- ~~Alien Breed 3D~~ and maybe Alien Breed 3D 2. (done the first)
- Lionheart (this is going to be hard probably given no source and a complex game).
- Legends of Valour.
- Hybris
- Battle Squadron (I really want to disassemble this and find out if there is an actual ending)


<article class="game-card" markdown="1">

### Hired Guns
<img src="{{ site.cdn_url }}/images/hg_banner.jpg" alt="Hired Guns screenshot 1" style="object-position: center;" />

This is the "easy" port of the bunch — relatively speaking. The goal is still pixel-perfect fidelity to the original, and for once we have real material to work with: the full ASM codebase and a wealth of original assets. The game was also hard-drive-installable, so its art files are far easier to reach, even if still encoded and compiled.

That codebase comes from the unreleased Amiga CD32 build, shared with the community years ago by one of the game's original programmers. I cross-checked it against gameplay footage, memory, and the Amiga 500 release running in WinUAE.

Opus 5 handled most of the heavy lifting, with Codex and Grok 4.6 pitching in. Every model contributed something, but the first two clearly carried the job.

<div class="game-slideshow">
	<a href="{{ site.cdn_url }}/images/HG/1.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/HG/1.jpg" alt="Hired Guns screenshot 1" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/images/HG/2.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/HG/2.jpg" alt="Hired Guns screenshot 2" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/images/HG/3.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/HG/3.jpg" alt="Hired Guns screenshot 3" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/images/HG/4.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/HG/4.jpg" alt="Hired Guns screenshot 4" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/images/HG/5.png" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/HG/5.png" alt="Hired Guns screenshot 5" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/images/HG/6.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/HG/6.jpg" alt="Hired Guns screenshot 6" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
</div>

There is even a full level editor now, if you want to try it. I have other improvements planned. Stay tuned.

For the cool bits and technical details of the port, read the post-mortem:

<div class="game-actions">
	<a class="game-button" href="{{ site.cdn_url }}/HG/index.html"><span class="game-button-icon" aria-hidden="true">&#9654;</span>Play in browser</a>
	<a class="game-button" href="{{ site.cdn_url }}/HG.zip"><span class="game-button-icon" aria-hidden="true">&#8681;</span>Download</a>
	<a class="game-button" href="_games/HG_POSTMORTEM.html"><span class="game-button-icon" aria-hidden="true">&#128196;</span>Post-mortem</a>
</div>

</article>

<article class="game-card" markdown="1">
### Saint Dragon

<img src="{{ site.cdn_url }}/images/sd_banner.jpg" alt="Hired Guns screenshot 1" style="object-position: center;" />

This is an old side-scrolling shoot-'em-up that I loved on the Amiga. It is a much harder port than Hired Guns because the only source material is an original IPF disk image and a cracked ADF image, with no source code or usable assets.

The project involved decoding the disk, disassembling the 68000 executable, and reconstructing the game's sprites, backgrounds, palettes, sound effects, music, enemy behaviour, and stage logic. A partial Amiga emulator helped verify the discoveries, but the final game is a native JavaScript implementation rather than an emulator.

The post-mortem goes into the fascinating technical details of that process.

<div class="game-slideshow">
	<a href="{{ site.cdn_url }}/images/SD/13.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/SD/13.jpg" alt="Hired Guns screenshot 1" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/images/SD/8.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/SD/8.jpg" alt="Hired Guns screenshot 2" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/images/SD/9.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/SD/9.jpg" alt="Hired Guns screenshot 3" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/images/SD/10.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/SD/10.jpg" alt="Hired Guns screenshot 4" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/images/SD/11.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/SD/11.jpg" alt="Hired Guns screenshot 5" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/images/SD/12.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/SD/12.jpg" alt="Hired Guns screenshot 6" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
</div>

And here it is in all its glory:

<div class="game-actions">
	<a class="game-button" href="{{ site.cdn_url }}/saintdragon/engine/full.html"><span class="game-button-icon" aria-hidden="true">&#9654;</span>Play in browser</a>
	<a class="game-button" href="{{ site.cdn_url }}/saint.zip"><span class="game-button-icon" aria-hidden="true">&#8681;</span>Download</a>
	<a class="game-button" href="_games/SD_POSTMORTEM.html"><span class="game-button-icon" aria-hidden="true">&#128196;</span>Post-mortem</a>
</div>

</article>


<article class="game-card" markdown="1">
### Menace

<img src="{{ site.cdn_url }}/menace/menace.jpg" alt="Hired Guns screenshot 1" style="object-position: center;" />

A complete browser reconstruction of Menace, DMA Design’s 1988 Amiga shoot ’em up, rebuilt directly from the original disk, executable and recovered game data rather than from screenshots or an embedded emulator. The port recreates all six levels, dual-playfield parallax, enemy waves, five weapons, powerups, guardian battles, music, sound effects, intro sequences, attract mode and the original ending flow. Along the way, the project uncovered some wonderfully strange internals, including bytecode-driven enemy choreography, live palette tricks, hardware collision rules and a HAM6 intro screen.

<div class="game-slideshow">
	<a href="{{ site.cdn_url }}/menace/shot1.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/menace/shot1.jpg" alt="menace screenshot 1" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/menace/shot2.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/menace/shot2.jpg" alt="menace screenshot 2" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/menace/shot3.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/menace/shot3.jpg" alt="menace screenshot 3" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/menace/shot4.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/menace/shot4.jpg" alt="menace screenshot 4" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/menace/shot5.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/menace/shot5.jpg" alt="menace screenshot 5" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/menace/shot6.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/menace/shot6.jpg" alt="menace screenshot 6" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
</div>

Here you can play it or read the super-interesting Post-Mortem:

<div class="game-actions">
	<a class="game-button" href="{{ site.cdn_url }}/menace/play.html"><span class="game-button-icon" aria-hidden="true">&#9654;</span>Play in browser</a>
	<a class="game-button" href="{{ site.cdn_url }}/menace/menace.zip"><span class="game-button-icon" aria-hidden="true">&#8681;</span>Download</a>
	<a class="game-button" href="_games/MENACE_POSTMORTEM.html"><span class="game-button-icon" aria-hidden="true">&#128196;</span>Post-mortem</a>
</div>

</article>


<article class="game-card" markdown="1">
### Breatheless

<img src="{{ site.cdn_url }}/breatheless/banner.jpg" alt="Hired Guns screenshot 1" style="object-position: center;" />

A complete browser reconstruction of Breathless, Fields of Vision’s ambitious 1996 Amiga FPS, translated from the surviving original 68020 source into JavaScript and WebGPU. All 20 levels, enemies, weapons, effects, textures, music and game systems are preserved, while the old Amiga-specific plumbing falls away. The result is both a playable port and a fascinating look inside an engine built around a grid raycaster, per-column visibility lists, palette-based lighting, moving floors and ceilings, and a huge amount of clever compromise to make a texture-mapped shooter run on 14 MHz hardware.
The post-mortem goes into more detail about Breathless's pseudo-3d engine and its differences with respect to something like Doom or Wolf3D.
I made some QoL changes most notably in term of player control and higher resolutions support, but you can still play the game in its original 320*200 glory.


<div class="game-slideshow">
	<a href="{{ site.cdn_url }}/breatheless/shot1.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/breatheless/shot1.jpg" alt="breatheless screenshot 1" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/breatheless/shot2.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/breatheless/shot2.jpg" alt="breatheless screenshot 2" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/breatheless/shot3.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/breatheless/shot3.jpg" alt="breatheless screenshot 3" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/breatheless/shot4.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/breatheless/shot4.jpg" alt="breatheless screenshot 4" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/breatheless/shot5.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/breatheless/shot5.jpg" alt="breatheless screenshot 5" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/breatheless/shot6.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/breatheless/shot6.jpg" alt="breatheless screenshot 6" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/breatheless/shot7.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/breatheless/shot7.jpg" alt="breatheless screenshot 7" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
</div>

Here you can play it or read the super-interesting Post-Mortem:

<div class="game-actions">
	<a class="game-button" href="{{ site.cdn_url }}/breatheless/play.html"><span class="game-button-icon" aria-hidden="true">&#9654;</span>Play in browser</a>
	<a class="game-button" href="{{ site.cdn_url }}/breatheless.zip"><span class="game-button-icon" aria-hidden="true">&#8681;</span>Download</a>
	<a class="game-button" href="_games/BREATHLESS_POSTMORTEM.html"><span class="game-button-icon" aria-hidden="true">&#128196;</span>Post-mortem</a>
</div>

</article>

<article class="game-card" markdown="1">
### Alien Breed 3D

<img src="{{ site.cdn_url }}/games/ab3d/ab3d_banner.jpg" alt="Alien Breed 3D banner" style="object-position: center;" />

A complete browser reconstruction of Alien Breed 3D, rebuilt from a messy mix of surviving source snapshots, retail data, WHDLoad media and the shipped executable itself. Rather than simply translating one clean codebase, the project had to piece together what the 1995 game actually did when the surviving sources disagreed. The result restores all 16 levels, weapons, enemies, bosses, doors, lifts, pickups, audio, passwords and ending in native HTML/JavaScript, with no emulator required at runtime. It also preserves the game’s wonderfully unusual renderer, where the Amiga’s Copper is effectively used as a tiny direct-colour framebuffer, while adding optional sharp and enhanced browser display modes alongside the faithful original presentation.

<div class="game-slideshow">
	<a href="{{ site.cdn_url }}/games/ab3d/shot1.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/games/ab3d/shot1.jpg" alt="Alien Breed 3D screenshot 1" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/games/ab3d/shot2.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/games/ab3d/shot2.jpg" alt="Alien Breed 3D screenshot 2" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/games/ab3d/shot3.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/games/ab3d/shot3.jpg" alt="Alien Breed 3D screenshot 3" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/games/ab3d/shot4.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/games/ab3d/shot4.jpg" alt="Alien Breed 3D screenshot 4" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/games/ab3d/shot5.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/games/ab3d/shot5.jpg" alt="Alien Breed 3D screenshot 5" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/games/ab3d/shot6.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/games/ab3d/shot6.jpg" alt="Alien Breed 3D screenshot 6" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/games/ab3d/shot7.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/games/ab3d/shot7.jpg" alt="Alien Breed 3D screenshot 7" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
</div>

And here you can play it or read the post-mortem:

<div class="game-actions">
	<a class="game-button" href="{{ site.cdn_url }}/games/ab3d/play.html"><span class="game-button-icon" aria-hidden="true">&#9654;</span>Play in browser</a>
	<a class="game-button" href="{{ site.cdn_url }}/games/ab3d.zip"><span class="game-button-icon" aria-hidden="true">&#8681;</span>Download</a>
	<a class="game-button" href="_games/ALIENBREED3D_POSTMORTEM.html"><span class="game-button-icon" aria-hidden="true">&#128196;</span>Post-mortem</a>
</div>

</article>
