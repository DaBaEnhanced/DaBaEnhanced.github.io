---
layout: page
title: "Games"
permalink: /games
---

## My games

Here are games I've been developing lately (well, mostly vibecoding).

Most of them are ports of old Amiga games to HTML/JavaScript. I am trying to test the limits of current LLMs by hacking, decoding, and disassembling old games.

<style>
	.game-card {
		background: rgba(255, 255, 255, 0.55);
		border: 1px solid #d8dee4;
		border-radius: 8px;
		margin: 1.5rem 0;
		padding: 1rem;
		transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
	}

	.game-card:hover {
		border-color: #8c959f;
		box-shadow: 0 6px 16px rgba(31, 35, 40, 0.12);
		transform: translateY(-2px);
	}

	.game-card img {
		max-width: 100%;
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

<article class="game-card" markdown="1">

### Hired Guns
<img src="../assets/images/hg_banner.jpg" alt="Hired Guns screenshot 1" style="object-position: center;" />

This is an "easy" port. The goal is still to be pixel-perfect with the original Amiga version, but in Hired Guns' case, we have access to the ASM source code and many source assets. The game itself was hard-drive-installable, so it has more easily accessible art files, even though they are encoded and compiled.

As I said, the starting point was the source code of the unreleased Amiga CD32 version. One of the game's coders released it to the Amiga community some time ago. I also used footage, memory, and some checks against the Amiga 500 version running in WinUAE.

I mostly used Opus 5, a bit of Codex, and then Grok 4.6. Every model was able to contribute something, but the first two were much better at this job.

<div class="game-slideshow">
	<a href="../assets/images/HG/1.jpg" target="_blank" rel="noopener"><img src="../assets/images/HG/1.jpg" alt="Hired Guns screenshot 1" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="../assets/images/HG/2.jpg" target="_blank" rel="noopener"><img src="../assets/images/HG/2.jpg" alt="Hired Guns screenshot 2" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="../assets/images/HG/3.jpg" target="_blank" rel="noopener"><img src="../assets/images/HG/3.jpg" alt="Hired Guns screenshot 3" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="../assets/images/HG/4.jpg" target="_blank" rel="noopener"><img src="../assets/images/HG/4.jpg" alt="Hired Guns screenshot 4" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="../assets/images/HG/5.png" target="_blank" rel="noopener"><img src="../assets/images/HG/5.png" alt="Hired Guns screenshot 5" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="../assets/images/HG/6.jpg" target="_blank" rel="noopener"><img src="../assets/images/HG/6.jpg" alt="Hired Guns screenshot 6" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
</div>

There is even a full level editor now, if you want to try it. I have other improvements planned. Stay tuned.

For the cool bits and technical details of the port, read the post-mortem:

<div class="game-actions">
	<a class="game-button" href="assets/HG/index.html"><span class="game-button-icon" aria-hidden="true">&#9654;</span>Play in browser</a>
	<a class="game-button" href="assets/HG.zip"><span class="game-button-icon" aria-hidden="true">&#8681;</span>Download</a>
	<a class="game-button" href="_games/HG_POSTMORTEM.html"><span class="game-button-icon" aria-hidden="true">&#128196;</span>Post-mortem</a>
</div>

</article>

<article class="game-card" markdown="1">
### Saint Dragon

<img src="../assets/images/sd_banner.jpg" alt="Hired Guns screenshot 1" style="object-position: center;" />

This is an old side-scrolling shoot-'em-up that I loved on the Amiga. It is a much harder port than Hired Guns because the only source material is an original IPF disk image and a cracked ADF image, with no source code or usable assets.

The project involved decoding the disk, disassembling the 68000 executable, and reconstructing the game's sprites, backgrounds, palettes, sound effects, music, enemy behaviour, and stage logic. A partial Amiga emulator helped verify the discoveries, but the final game is a native JavaScript implementation rather than an emulator.

The post-mortem goes into the fascinating technical details of that process.

<div class="game-slideshow">
	<a href="../assets/images/SD/13.jpg" target="_blank" rel="noopener"><img src="../assets/images/SD/13.jpg" alt="Hired Guns screenshot 1" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="../assets/images/SD/8.jpg" target="_blank" rel="noopener"><img src="../assets/images/SD/8.jpg" alt="Hired Guns screenshot 2" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="../assets/images/SD/9.jpg" target="_blank" rel="noopener"><img src="../assets/images/SD/9.jpg" alt="Hired Guns screenshot 3" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="../assets/images/SD/10.jpg" target="_blank" rel="noopener"><img src="../assets/images/SD/10.jpg" alt="Hired Guns screenshot 4" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="../assets/images/SD/11.jpg" target="_blank" rel="noopener"><img src="../assets/images/SD/11.jpg" alt="Hired Guns screenshot 5" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="../assets/images/SD/11.jpg" target="_blank" rel="noopener"><img src="../assets/images/SD/12.jpg" alt="Hired Guns screenshot 6" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
</div>

And here it is in all its glory:

<div class="game-actions">
	<a class="game-button" href="assets/saintdragon/engine/full.html"><span class="game-button-icon" aria-hidden="true">&#9654;</span>Play in browser</a>
	<a class="game-button" href="assets/saint.zip"><span class="game-button-icon" aria-hidden="true">&#8681;</span>Download</a>
	<a class="game-button" href="_games/SD_POSTMORTEM.html"><span class="game-button-icon" aria-hidden="true">&#128196;</span>Post-mortem</a>
</div>

</article>

<article class="game-card" markdown="1">
### MegaPop



<article class="game-card" markdown="1">
### The Moon That Forgot 

<img src="../assets/images/moonforgot.jpg" alt="The Moon That Forgot title" style="object-position: center;" />

**The Moon That Forgot** is a work-in-progress retro point-and-click adventure based on my novel of the same name. You wake inside a dying Ark with no clear memory of how long you’ve been asleep, accompanied only by a damaged maintenance robot named M7. Explore, talk, investigate, combine objects, and solve increasingly strange machine-logic puzzles as you uncover what happened to the sleepers, what the Ark has become, and what is still moving beyond its walls.
Final art style would be different than what the banner above hint at, and more similar to my book cover's artworks.

<div class="game-slideshow">
	<a href="../assets/images/MF/1.jpg" target="_blank" rel="noopener"><img src="../assets/images/MF/1.jpg" alt="Hired Guns screenshot 1" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="../assets/images/MF/2.jpg" target="_blank" rel="noopener"><img src="../assets/images/MF/2.jpg" alt="Hired Guns screenshot 2" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="../assets/images/MF/3.jpg" target="_blank" rel="noopener"><img src="../assets/images/MF/3.jpg" alt="Hired Guns screenshot 3" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="../assets/images/MF/4.jpg" target="_blank" rel="noopener"><img src="../assets/images/MF/4.jpg" alt="Hired Guns screenshot 4" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="../assets/images/MF/5.jpg" target="_blank" rel="noopener"><img src="../assets/images/MF/5.jpg" alt="Hired Guns screenshot 5" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="../assets/images/MF/6.jpg" target="_blank" rel="noopener"><img src="../assets/images/MF/6.jpg" alt="Hired Guns screenshot 6" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="../assets/images/MF/7.jpg" target="_blank" rel="noopener"><img src="../assets/images/MF/7.jpg" alt="Hired Guns screenshot 7" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="../assets/images/MF/8.jpg" target="_blank" rel="noopener"><img src="../assets/images/MF/8.jpg" alt="Hired Guns screenshot 8" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="../assets/images/MF/9.jpg" target="_blank" rel="noopener"><img src="../assets/images/MF/9.jpg" alt="Hired Guns screenshot 9" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="../assets/images/MF/10.jpg" target="_blank" rel="noopener"><img src="../assets/images/MF/10.jpg" alt="Hired Guns screenshot 10" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="../assets/images/MF/11.jpg" target="_blank" rel="noopener"><img src="../assets/images/MF/11.jpg" alt="Hired Guns screenshot 11" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
</div>

</article>

<img src="../assets/images/megapop.jpg" alt="Megapop title" style="object-position: center;" />

My next project won't be a port, but a new game. 
**PROJECT MEGAPOP** is a retro-inspired god game where you guide a semi-autonomous civilization from primitive settlements to a dangerous technological future. Shape the land, influence your people, uncover local resources, push research forward, build industry, wage wars, and unleash divine powers as the world evolves around you. Every mountain moved, city founded, resource discovered, and war fought can change the course of history. And by the time your followers reach the nuclear age, they may have become powerful enough to survive without you... or destroy everything you helped them build.
Think Populus meets Mega-lo-Mania!


</article>