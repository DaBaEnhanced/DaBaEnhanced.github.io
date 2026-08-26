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
</style>

<article class="game-card" markdown="1">

### Hired Guns
<img src="../assets/images/hg_banner.jpg" alt="Hired Guns screenshot 1" style="object-position: center;" />

This is an "easy" port. The goal is still to be pixel-perfect with the original Amiga version, but in Hired Guns' case, we have access to the ASM source code and many source assets. The game itself was hard-drive-installable, so it has more easily accessible art files, even though they are encoded and compiled.

As I said, the starting point was the source code of the unreleased Amiga CD32 version. One of the game's coders released it to the Amiga community some time ago. I also used footage, memory, and some checks against the Amiga 500 version running in WinUAE.

I mostly used Opus 5, a bit of Codex, and then Grok 4.6. Every model was able to contribute something, but the first two were much better at this job.

<div style="display: flex; gap: 1rem; overflow-x: auto; padding: 0.5rem 0 1rem;">
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

This is an old side-scrolling shoot-'em-up. It was originally an arcade game, but I had and loved the Amiga version as a kid, so it is my next test. It is much harder than Hired Guns because we only have the original IPF and ADF files. Claude has to do a lot of heavy lifting to decode the Amiga disk data and perform the disassembly. It is still a work in progress.

This one is hardcore: the only source material is an original IPF dump of the Amiga disk and an ADF image of the cracked version.

**ADF** is essentially a sector-by-sector, or track-by-track, dump of the logical data as the Amiga operating system would see it.

**IPF** stores the disk closer to the way a real disk drive head would read it, including flux-level and cycle-accurate information, timings, weak bits, and variable densities.

So, why not just start from the uncracked IPF?

Claude extracted the data, correctly identified the copy protection, and started working on cracking Rob Northen's Amiga copy-protection system. It is kind of impressive, even though the protection is decades old and fairly well known, although it has not been used in many years.

Then we started with asset extraction: sprites, backgrounds, sound effects, and music. At first, it tried to find patterns in the data sectors to identify the boundaries between sprite data. These sectors are essentially compiled resources, with no master record or table; the compiled executable accesses the data directly. That approach was, unsurprisingly, not very successful.

Claude then decided to build a partial Amiga emulator in JavaScript so it could execute the game code and capture the sprites from RAM. After some work, it managed to recover at least the sprites from the demo level, although the palette was still incorrect.

It tried to recover the backgrounds in the same way, but that attempt was only partially successful. It did recover the background, but with a lot of unrelated data mixed in. It also failed to realise that the background is dynamic rather than a fixed length; the length of the boss fight depends on the player's skill.

I told Claude to stop transcribing assets from RAM and instead disassemble the code and build a library of all the art assets referenced by it. I pointed out that the entire disassembled code could fit into its context window many times over, and that the emulator should be used only for verification.

And it did. After a couple of days of attempts, along with some waiting for token resets, we now have:

- all art assets and correct palettes for each stage and screen;
- all sound effects; and
- rebuilt music, which the original game generated in code using a sampler.

Claude then asked me to choose a direction:

1. a js port where we decode all the disassembled functions into behaviours and readable code
2. a partial emulator where we run the original bytecodes using the extracted assets.

I obviously chose option 1. That work has just started, beginning with enemy paths and player sprites. I expect it will take a long time to reach a fully working game. Option 2 would have been much easier, but the result would have been too opaque.

And here it is in all its glory (For the cool bits and technical details of the port, read the post-mortem):

<div class="game-actions">
	<a class="game-button" href="assets/saintdragon/engine/full.html"><span class="game-button-icon" aria-hidden="true">&#9654;</span>Play in browser</a>
	<a class="game-button" href="assets/saint.zip"><span class="game-button-icon" aria-hidden="true">&#8681;</span>Download</a>
	<a class="game-button" href="_games/SD_POSTMORTEM.html"><span class="game-button-icon" aria-hidden="true">&#128196;</span>Post-mortem</a>
</div>

</article>