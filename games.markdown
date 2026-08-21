---
layout: page
title: "Games"
permalink: /games
---

## My games

Here are games I've been developing lately (well, mostly vibecoding).

Most of them are ports of old Amiga games to HTML/JavaScript. I am trying to test the limits of current LLMs by hacking, decoding, and disassembling old games.

### Hired Guns

This is an "easy" port. The goal is still to be pixel-perfect with the original Amiga version, but in Hired Guns' case, we have access to the ASM source code and many source assets. The game itself was hard-drive-installable, so it has more easily accessible art files, even though they are encoded and compiled.

As I said, the starting point was the source code of the unreleased Amiga CD32 version. One of the game's coders released it to the Amiga community some time ago. I also used footage, memory, and some checks against the Amiga 500 version running in WinUAE.

I mostly used Opus 5, a bit of Codex, and then Grok 4.6. Every model was able to contribute something, but the first two were much better at this job.

There is even a full level editor now, if you want to try it. I have other improvements planned. Stay tuned.

<div style="display: flex; gap: 1rem; overflow-x: auto; padding: 0.5rem 0 1rem;">
	<a href="../assets/images/HG/1.jpg" target="_blank" rel="noopener"><img src="../assets/images/HG/1.jpg" alt="Hired Guns screenshot 1" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="../assets/images/HG/2.jpg" target="_blank" rel="noopener"><img src="../assets/images/HG/2.jpg" alt="Hired Guns screenshot 2" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="../assets/images/HG/3.jpg" target="_blank" rel="noopener"><img src="../assets/images/HG/3.jpg" alt="Hired Guns screenshot 3" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="../assets/images/HG/4.jpg" target="_blank" rel="noopener"><img src="../assets/images/HG/4.jpg" alt="Hired Guns screenshot 4" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="../assets/images/HG/5.png" target="_blank" rel="noopener"><img src="../assets/images/HG/5.png" alt="Hired Guns screenshot 5" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="../assets/images/HG/6.jpg" target="_blank" rel="noopener"><img src="../assets/images/HG/6.jpg" alt="Hired Guns screenshot 6" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
</div>

<a href="assets/HG/index.html">Play it now in your browser</a>
<a href="assets/HG.zip">Download it</a>

### Saint Dragon

This is an old side-scrolling shoot-'em-up. It was originally an arcade game, but I had and loved the Amiga version as a kid, so it is my next test. It is much harder than Hired Guns: we only have the original IPF/ADF files. Claude has to do a lot of heavy lifting to decode the Amiga disk data and perform pure disassembly. It is still a work in progress.