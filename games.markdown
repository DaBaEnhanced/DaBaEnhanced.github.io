---
layout: page
title: "Games"
permalink: /games
---

Here are the games I've been developing lately (well, mostly vibecoding), starting with my original projects (check [**PROJECT MEGAPOP**](#megapop)) and followed by [browser ports of old Amiga games](#browser-ports).

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

	.game-button.itch-button,
	.game-button.itch-button:visited {
		background: #fa5c5c;
		border-color: #e04848;
		color: #ffffff;
	}

	.game-button.itch-button:hover,
	.game-button.itch-button:focus-visible {
		background: #ff7676;
		box-shadow: 0 4px 10px rgba(250, 92, 92, 0.35);
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

	.game-media-row {
		display: grid;
		gap: 1rem;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		margin: 0.5rem 0 1rem;
	}

	.game-media-row .game-slideshow {
		margin: 0;
		max-width: none;
		width: 100%;
	}

	.game-video {
		aspect-ratio: 16 / 9;
	}

	.game-video iframe {
		display: block;
		height: 100%;
		width: 100%;
	}

	@media (max-width: 699px) {
		.game-slideshow {
			width: 100%;
		}

		.game-media-row {
			grid-template-columns: 1fr;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.game-slideshow-track {
			transition: none;
		}
	}
	/* Collapsible game cards: collapsed shows title + banner only */
	.game-card.is-collapsible > h3,
	.game-card.is-collapsible > .game-card-banner {
		cursor: pointer;
	}
	.game-card.is-collapsible > h3 {
		align-items: center;
		display: flex;
		gap: 0.75rem;
		justify-content: space-between;
		user-select: none;
	}
	.game-card.is-collapsible > h3::after {
		color: #e5484d;
		content: "\25BE";
		flex: 0 0 auto;
		font-size: 1.1em;
		transition: transform 250ms ease;
	}
	.game-card.is-collapsible:not(.is-open) > h3::after {
		transform: rotate(-90deg);
	}
	.game-card.is-collapsible > h3:focus-visible {
		outline: 2px solid #e5484d;
		outline-offset: 4px;
	}
	.game-card-body {
		display: grid;
		grid-template-rows: 0fr;
		transition: grid-template-rows 350ms ease;
	}
	.game-card.is-open > .game-card-body {
		grid-template-rows: 1fr;
	}
	.game-card-body > .game-card-inner {
		min-height: 0;
		overflow: hidden;
	}
	.game-card:not(.is-open) > .game-card-banner {
		margin-bottom: 0;
	}
	.game-card.is-collapsible:not(.is-open) > .game-card-banner::after {
		color: rgba(255, 255, 255, 0.55);
		content: "Click to show details";
		display: block;
		font-size: 0.85rem;
		margin-top: 0.4rem;
		text-align: center;
	}
	.games-toggle-all {
		background: none;
		border: 1px solid #e5484d;
		border-radius: 6px;
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 0.9rem;
		margin: 0.5rem 0;
		padding: 0.35rem 0.8rem;
	}
	@media (prefers-reduced-motion: reduce) {
		.game-card-body,
		.game-card.is-collapsible > h3::after {
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

	function initializeCollapsibleGames() {
		const cards = Array.from(document.querySelectorAll("article.game-card"));
		if (!cards.length) {
			return;
		}

		const setOpen = function (card, open) {
			card.classList.toggle("is-open", open);
			card._title.setAttribute("aria-expanded", open ? "true" : "false");
			if (open) {
				card._body.removeAttribute("inert");
			} else {
				card._body.setAttribute("inert", "");
			}
		};

		cards.forEach(function (card, index) {
			const title = card.querySelector(":scope > h3");
			if (!title) {
				return;
			}
			let banner = title.nextElementSibling;
			if (banner && !(banner.tagName === "IMG" || (banner.children.length === 1 && banner.querySelector(":scope > img")))) {
				banner = null;
			}

			const body = document.createElement("div");
			const inner = document.createElement("div");
			body.className = "game-card-body";
			inner.className = "game-card-inner";
			body.id = "game-card-body-" + index;
			body.appendChild(inner);

			let node = (banner || title).nextSibling;
			while (node) {
				const next = node.nextSibling;
				inner.appendChild(node);
				node = next;
			}
			card.appendChild(body);

			card._title = title;
			card._body = body;
			card.classList.add("is-collapsible");
			title.setAttribute("role", "button");
			title.setAttribute("tabindex", "0");
			title.setAttribute("aria-controls", body.id);

			const toggle = function () {
				setOpen(card, !card.classList.contains("is-open"));
			};
			title.addEventListener("click", toggle);
			title.addEventListener("keydown", function (event) {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					toggle();
				}
			});
			if (banner) {
				banner.classList.add("game-card-banner");
				banner.addEventListener("click", toggle);
			}
			setOpen(card, false);
		});

		const openFromHash = function () {
			if (!location.hash) {
				return;
			}
			let target;
			try {
				target = document.querySelector(decodeURIComponent(location.hash));
			} catch (error) {
				return;
			}
			const card = target && target.closest("article.game-card.is-collapsible");
			if (card) {
				setOpen(card, true);
				window.setTimeout(function () {
					card.scrollIntoView({ block: "start" });
				}, 50);
			}
		};
		openFromHash();
		window.addEventListener("hashchange", openFromHash);

		const firstCard = cards[0];
		const toggleAll = document.createElement("button");
		toggleAll.type = "button";
		toggleAll.className = "games-toggle-all";
		toggleAll.textContent = "Expand all games";
		toggleAll.addEventListener("click", function () {
			const collapsible = cards.filter(function (card) { return card.classList.contains("is-collapsible"); });
			const anyClosed = collapsible.some(function (card) { return !card.classList.contains("is-open"); });
			collapsible.forEach(function (card) { setOpen(card, anyClosed); });
			toggleAll.textContent = anyClosed ? "Collapse all games" : "Expand all games";
		});
		firstCard.parentNode.insertBefore(toggleAll, firstCard);
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initializeCollapsibleGames);
	} else {
		initializeCollapsibleGames();
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

MegaPop allows you to guide a semi-autonomous civilization to a dangerous technological future. But what about shaping a planet and making it habitable? That's [**Living Worlds**](#living-worlds)! And if you would rather bend the physics than the planet, try [**The Wrong Laws**](#the-wrong-laws). Or just grow a dragon's spine out of an empire's war machines and burn it all down in [**Vertebra**](#vertebra). And if you would rather race a stolen prototype through 1999 as imagined in 1986, with a girl living in the dashboard, that's [**AFTERGLOW**](#afterglow), my newest game!

<article class="game-card" markdown="1">
### MegaPop
<img src="{{ site.cdn_url }}/images/megapop.jpg" alt="Megapop title" style="object-position: center;" />

My first, original, fully released project!.
**PROJECT MEGAPOP** is a retro-inspired god game where you guide a semi-autonomous civilization from primitive settlements to a dangerous technological future. Shape the land, influence your people, uncover local resources, push research forward, build industry, wage wars, and unleash divine powers as the world evolves around you. Every mountain moved, city founded, resource discovered, and war fought can change the course of history. And by the time your followers reach the nuclear age, they may have become powerful enough to survive without you... or destroy everything you helped them build.
Think Populus meets Mega-lo-Mania!

<div style="text-align: center; margin-top: 20px;">
  <iframe width="100%" style="aspect-ratio: 16 / 9; height: auto;" src="https://www.youtube.com/embed/_21-Gv8oUUs?si=J-7osjqc_UMXRCJF" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
</div>

Here is the full RC1 version. For multiplayer you have to download the zip and launch tools/serve.py (but check DEPLOY.md for details).
<div class="game-actions">
	<a class="game-button itch-button" href="https://waldtier.itch.io/megapop" target="_blank" rel="noopener"><span class="game-button-icon" aria-hidden="true">&#9733;</span>Play on itch.io</a>
	<a class="game-button" href="{{ site.cdn_url }}/games/megapop/index.html"><span class="game-button-icon" aria-hidden="true">&#9654;</span>Play the latest release candidate!</a>
	<a class="game-button" href="{{ site.cdn_url }}/games/megapop/docs/Megapop_Manual.pdf"><span class="game-button-icon" aria-hidden="true">&#9654;</span>Read the manual!</a>
	<a class="game-button" href="{{ site.cdn_url }}/games/megapop.zip"><span class="game-button-icon" aria-hidden="true">&#8681;</span>Download</a>
	<a class="game-button" href="https://github.com/DaBaEnhanced/DaBaEnhanced.github.io/discussions/categories/megapop">Discuss this game</a>
</div>


</article>

<article class="game-card" markdown="1">
### The Mysterious Island: Castaways
<img src="{{ site.cdn_url }}/games/mysteriousisland/the_mysterious_island_castaways.jpg" alt="Megapop title" style="object-position: center;" />

My second, original, fully released project!.
1865\. Five Union prisoners escape by balloon and are flung onto an uncharted island in the South Pacific, with nothing but the clothes on their backs. Lead Cyrus Smith’s castaways from bare survival to a Victorian colony with forges, farms, a telegraph and a home carved into Granite House. Uncover the island’s secrets before the volcano tears it apart. Then build a ship and sail south through five more islands, from fever jungles to the Antarctic ice, against pirates, mutineers and the sea itself.
A hand-crafted colony saga after Jules Verne. Free to explore, hard to survive, impossible to forget.

<div style="text-align: center; margin-top: 20px;">
  <iframe width="100%" style="aspect-ratio: 16 / 9; height: auto;" src="https://www.youtube.com/embed/7cl0i2zevSk?si=6HHUJnkdHE1xz1EO" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
</div>

Here is the full version.

<div class="game-actions">
	<a class="game-button itch-button" href="https://waldtier.itch.io/mysterious-island-castaways" target="_blank" rel="noopener"><span class="game-button-icon" aria-hidden="true">&#9733;</span>Play on itch.io</a>
	<a class="game-button" href="{{ site.cdn_url }}/games/mysteriousisland/index.html"><span class="game-button-icon" aria-hidden="true">&#9654;</span>Play the latest release candidate!</a>
	<a class="game-button" href="{{ site.cdn_url }}/games/mysteriousisland/docs/TheMysteriousIsland_Manual.pdf"><span class="game-button-icon" aria-hidden="true">&#9654;</span>Read the manual!</a>
	<a class="game-button" href="{{ site.cdn_url }}/games/mysteriousisland.zip"><span class="game-button-icon" aria-hidden="true">&#8681;</span>Download</a>
	<a class="game-button" href="https://github.com/DaBaEnhanced/DaBaEnhanced.github.io/discussions/categories/the-mysterious-island-castaways">Discuss this game</a>
</div>


</article>

<article class="game-card" markdown="1">
### Living Worlds
<img src="{{ site.cdn_url }}/images/livingworlds.jpg" alt="Living Worlds title" style="object-position: center;" />

My third, original, fully released project!
**LIVING WORLDS** is an ecosystem god game about small planets and patient life. You can raise mountains and cut saddles, call down the rain, open the crust to the heat beneath, lean on a planet's tilt and nudge its moon. What you cannot do is place a single living thing. Life arrives as a thin crust of mats on a wet shore, and from then on it grows where it can, dies where it can't, spreads, adapts and changes its own world. When the biosphere is ready, your powers recede and the world faces its resilience trial alone: a drought, a dimming star, a waking caldera, the king tides.
Nine Living Worlds, from a gentle young shore to a sunless planet around a black hole, then nine Desperate Worlds: a binary planet, a 2.4 g super-Earth, a moon of a gas giant, a flaring red dwarf, a runaway greenhouse, a planet torn loose from its sun. Water, soil, carbon and nutrients are all conserved, and every failure explains itself.
Think Populous meets SimEarth!

<div style="text-align: center; margin-top: 20px;">
  <iframe width="100%" style="aspect-ratio: 16 / 9; height: auto;" src="https://www.youtube.com/embed/zabLduFUxT8" title="Living Worlds trailer" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
</div>

It runs in the browser on WebGPU: Chrome or Edge on a desktop with a reasonably modern graphics card.

<div class="game-actions">
	<a class="game-button itch-button" href="https://waldtier.itch.io/living-worlds" target="_blank" rel="noopener"><span class="game-button-icon" aria-hidden="true">&#9733;</span>Play on itch.io</a>
	<a class="game-button" href="{{ site.cdn_url }}/games/livingworlds/index.html"><span class="game-button-icon" aria-hidden="true">&#9654;</span>Play in browser</a>
	<a class="game-button" href="{{ site.cdn_url }}/games/livingworlds/docs/LivingWorlds_Manual.pdf"><span class="game-button-icon" aria-hidden="true">&#9654;</span>Read the manual!</a>
	<a class="game-button" href="{{ site.cdn_url }}/games/livingworlds.zip"><span class="game-button-icon" aria-hidden="true">&#8681;</span>Download</a>
	<a class="game-button" href="https://github.com/DaBaEnhanced/DaBaEnhanced.github.io/discussions/categories/living-worlds">Discuss this game</a>
</div>


</article>

<article class="game-card" markdown="1">
### The Wrong Laws
{% assign twl_video = "HjzOfJ2J4G0" %}<!-- paste the YouTube video ID of the trailer between the quotes -->
<img src="{{ site.cdn_url }}/images/thewronglaws.jpg" alt="The Wrong Laws title" style="object-position: center;" />

My fourth, original, game. This is closer to a proof of concept than a complete game and will require extensive additional level design.
**THE WRONG LAWS** is a first-person physics puzzle game set in Hollin, a small town that in 1961 borrowed its physical constants from somewhere else. Now the loan is being recalled, building by building, and you walk the town with a repair kit that bends what is left: a projector that slows light to a crawl, a launcher that carries pocket singularities, a recorder that replays your own echoes, polarising filters, mirrors, and a cutter that carves and prints matter.
Twenty chambers across five wings, from the Glassworks to the Gate: light that falls into gravity wells, a muon that only survives on its own clock, two slits that interfere, locks that open to your shadow. Every puzzle is real physics, deliberately set wrong.
Think Portal meets The Talos Principle, with a physics textbook left out in the rain!

{% if twl_video != "" %}
<div style="text-align: center; margin-top: 20px;">
  <iframe width="100%" style="aspect-ratio: 16 / 9; height: auto;" src="https://www.youtube.com/embed/{{ twl_video }}" title="The Wrong Laws trailer" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
</div>
{% endif %}

It runs in the browser on WebGPU (with a WebGL 2 fallback): Chrome or Edge on a desktop with a reasonably modern graphics card. Mouse and keyboard, or a gamepad.

<div class="game-actions">
	<a class="game-button" href="{{ site.cdn_url }}/games/thewronglaws/index.html"><span class="game-button-icon" aria-hidden="true">&#9654;</span>Play in browser</a>
	<a class="game-button" href="{{ site.cdn_url }}/games/thewronglaws.zip"><span class="game-button-icon" aria-hidden="true">&#8681;</span>Download</a>
	<a class="game-button" href="https://github.com/DaBaEnhanced/DaBaEnhanced.github.io/discussions/categories/the-wrong-laws">Discuss this game</a>
</div>


</article>

<article class="game-card" markdown="1">
### Vertebra
{% assign vtb_video = "QpiFohWyQ80" %}<!-- paste the YouTube video ID of the trailer between the quotes -->
<img src="{{ site.cdn_url }}/images/vertebra.jpg" alt="Vertebra title" style="object-position: center;" />

My fifth original game, and a love letter to Saint Dragon, the Amiga shooter I ported a while ago.
**VERTEBRA** is a side-scrolling shoot 'em up roguelite. You are a flying dragon skull, and your body is your build: every enemy you destroy can become a new vertebra chained behind you. Armour plates, turrets, mirrors that bounce bullets back, bombs, healers, amplifiers, relics torn from the bosses. Block bullets with your spine, curl it into a shield around the skull, whip the tail, shed it as a bomb, and when the Charge is full, unleash a Burst that clears the screen.
Six regions, from the Foundry Coast to a secret sixth one, 30 enemy types, 6 elites and 6 bosses, more than fifty segments with adjacency combos and bone sets, six playable Skulls, ten Heat modifiers, Story / Standard / Arcade difficulty, a Daily Run, an Arcade Gauntlet and a Practice mode. And a CRT filter, of course.

<div class="game-slideshow">
	<a href="{{ site.cdn_url }}/images/VB/1.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/VB/1.jpg" alt="Vertebra screenshot 1" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/images/VB/2.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/VB/2.jpg" alt="Vertebra screenshot 2" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/images/VB/3.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/VB/3.jpg" alt="Vertebra screenshot 3" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/images/VB/4.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/VB/4.jpg" alt="Vertebra screenshot 4" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/images/VB/5.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/VB/5.jpg" alt="Vertebra screenshot 5" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/images/VB/6.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/VB/6.jpg" alt="Vertebra screenshot 6" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/images/VB/7.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/VB/7.jpg" alt="Vertebra screenshot 7" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/images/VB/8.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/VB/8.jpg" alt="Vertebra screenshot 8" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
</div>

{% if vtb_video != "" %}
<div style="text-align: center; margin-top: 20px;">
  <iframe width="100%" style="aspect-ratio: 16 / 9; height: auto;" src="https://www.youtube.com/embed/{{ vtb_video }}" title="Vertebra trailer" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
</div>
{% endif %}

It runs in the browser on WebGPU (with a WebGL 2 fallback): Chrome or Edge recommended. Keyboard or gamepad, and the keys can be remapped.

<div class="game-actions">
	<a class="game-button itch-button" href="https://waldtier.itch.io/vertebra" target="_blank" rel="noopener"><span class="game-button-icon" aria-hidden="true">&#9733;</span>Play on itch.io</a>
	<a class="game-button" href="{{ site.cdn_url }}/games/vertebra/index.html"><span class="game-button-icon" aria-hidden="true">&#9654;</span>Play in browser</a>
	<a class="game-button" href="{{ site.cdn_url }}/games/vertebra.zip"><span class="game-button-icon" aria-hidden="true">&#8681;</span>Download</a>
	<a class="game-button" href="{{ site.cdn_url }}/games/vertebra/docs/Vertebra_Manual.pdf"><span class="game-button-icon" aria-hidden="true">&#9654;</span>Read the manual!</a>
	<a class="game-button" href="#vertebra" data-ost="vertebra"><span class="game-button-icon" aria-hidden="true">&#9835;</span>Listen to the soundtrack</a>
	<a class="game-button" href="{{ site.cdn_url }}/games/vertebra_soundtrack.zip"><span class="game-button-icon" aria-hidden="true">&#8681;</span>Download the soundtrack</a>
</div>

</article>

<article class="game-card" markdown="1">
### AFTERGLOW
{% assign ag_video = "2GyO2QgSwAc" %}<!-- paste the YouTube video ID of the trailer between the quotes -->
<img src="{{ site.cdn_url }}/images/afterglow.jpg" alt="AFTERGLOW title" style="object-position: center;" />

My sixth original game: 1999, as imagined in 1986, by way of Lotus Esprit Turbo Challenge 2, Black Viper and a stack of rented anime tapes.
**AFTERGLOW** is an arcade combat racer with a story. Vic Calloway, a memory dealer with a stolen prototype, plugs a cracked chip into his dashboard and a girl wakes up in the car: LYRA, a mind cut into seven shards and sold across a broken continent. Every shard you bring back gives her a memory and gives the car a new ability. He rebuilt her piece by piece. Then he had to stop her.
Seven chapters and 21 stages on a hand-pixelled pseudo-3D road, with ramps, forks, weather, trains, guns that overheat, mines, oil, smoke and EMP, bikers, interceptors and a gunship, Mama Dolores's garage, six cars, memory reels, comic panels in 80s-OVA style, Arcade, Time Trial, Endless Highway, Night Shift, and split-screen Versus and Convoy for two players. And a CRT filter, of course.

<div class="game-slideshow">
	<a href="{{ site.cdn_url }}/images/AG/1.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/AG/1.jpg" alt="AFTERGLOW screenshot 1" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/images/AG/2.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/AG/2.jpg" alt="AFTERGLOW screenshot 2" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/images/AG/3.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/AG/3.jpg" alt="AFTERGLOW screenshot 3" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/images/AG/4.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/AG/4.jpg" alt="AFTERGLOW screenshot 4" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/images/AG/5.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/AG/5.jpg" alt="AFTERGLOW screenshot 5" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/images/AG/6.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/AG/6.jpg" alt="AFTERGLOW screenshot 6" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/images/AG/7.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/AG/7.jpg" alt="AFTERGLOW screenshot 7" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
	<a href="{{ site.cdn_url }}/images/AG/8.jpg" target="_blank" rel="noopener"><img src="{{ site.cdn_url }}/images/AG/8.jpg" alt="AFTERGLOW screenshot 8" style="flex: 0 0 240px; width: 240px; height: 160px; object-fit: cover; object-position: center;" /></a>
</div>

{% if ag_video != "" %}
<div style="text-align: center; margin-top: 20px;">
  <iframe width="100%" style="aspect-ratio: 16 / 9; height: auto;" src="https://www.youtube.com/embed/{{ ag_video }}" title="AFTERGLOW trailer" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
</div>
{% endif %}

It runs in the browser on WebGPU (with a WebGL 2 fallback): Chrome or Edge recommended. Keyboard or gamepad, and the keys can be remapped. It also plays on phones and tablets, with on-screen touch controls.

<div class="game-actions">
	<a class="game-button itch-button" href="https://waldtier.itch.io/afterglow" target="_blank" rel="noopener"><span class="game-button-icon" aria-hidden="true">&#9733;</span>Play on itch.io</a>
	<a class="game-button" href="{{ site.cdn_url }}/games/afterglow/index.html"><span class="game-button-icon" aria-hidden="true">&#9654;</span>Play in browser</a>
	<a class="game-button" href="{{ site.cdn_url }}/games/afterglow.zip"><span class="game-button-icon" aria-hidden="true">&#8681;</span>Download</a>
	<a class="game-button" href="{{ site.cdn_url }}/games/afterglow/docs/AFTERGLOW_Manual.pdf"><span class="game-button-icon" aria-hidden="true">&#9654;</span>Read the manual!</a>
	<a class="game-button" href="#afterglow" data-ost="afterglow"><span class="game-button-icon" aria-hidden="true">&#9835;</span>Listen to the soundtrack</a>
	<a class="game-button" href="{{ site.cdn_url }}/games/afterglow_soundtrack.zip"><span class="game-button-icon" aria-hidden="true">&#8681;</span>Download the soundtrack</a>
</div>

</article>

<article class="game-card" markdown="1">
### The Moon That Forgot

<img src="{{ site.cdn_url }}/images/moonforgot.jpg" alt="The Moon That Forgot title" style="object-position: center;" />

**The Moon That Forgot** is a work-in-progress retro point-and-click adventure based on my novel of the same name. You wake inside a dying Ark with no clear memory of how long you’ve been asleep, accompanied only by a damaged maintenance robot named M7. Explore, talk, investigate, combine objects, and solve increasingly strange machine-logic puzzles as you uncover what happened to the sleepers, what the Ark has become, and what is still moving beyond its walls.

I am vibecoding the adventure game editor, tools to turn images into pixel art, background matting, de-spilling colors, closing animation loops, and using image gen, video gen and musicgen to generate almost all art assets.

This is really very early, I still don't like some rooms (especially the starting one). It's mostly a proof of concept of what I can do with the asset and pipelines coded.

<div class="game-media-row">
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
<div class="game-video">
	<iframe src="https://www.youtube.com/embed/1yzcNJH0L5U" title="The Moon That Forgot | Chapter 1 Gameplay Trailer | Sci-Fi Point-and-Click Adventure" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
</div>
</div>

Here is a work-in-progress taste of the game's first chapter!

<div class="game-actions">
	<a class="game-button" href="{{ site.cdn_url }}/games/moonforgot/game/index.html?bundle=../bundle.json"><span class="game-button-icon" aria-hidden="true">&#9654;</span>Play the Chapter 1 demo in browser</a>
	<a class="game-button" href="https://github.com/DaBaEnhanced/DaBaEnhanced.github.io/discussions/categories/the-moon-that-forgot">Discuss this game</a>
</div>

</article>



## Browser ports

These are unofficial, fan-made browser reconstructions created as technical and historical projects. Copyrights and trademarks in the original games and their assets belong to their respective rightsholders. No affiliation with or endorsement by those rightsholders is claimed.

Planned addition I'd like to do next are (in no specific order):
- SWIV.
- Banshee. 
- ~~Alien Breed 3D~~ and maybe Alien Breed 3D 2. (done the first)
- Lionheart (this is going to be hard probably given no source and a complex game).
- Legends of Valour.
- Hybris
- Battle Squadron (I really want to disassemble this and find out if there is an actual ending)
- Nitro
- Utopia
- Fightin Spirit?
- Super Hang On or Black Viper
- Lotus Turbo Challenge 2


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
	<a class="game-button" href="_games/HG_POSTMORTEM.html"><span class="game-button-icon" aria-hidden="true">&#128196;</span>Post-mortem</a>
	<a class="game-button" href="https://github.com/DaBaEnhanced/DaBaEnhanced.github.io/discussions/categories/hired-guns">Discuss this game</a>
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
	<a class="game-button" href="_games/SD_POSTMORTEM.html"><span class="game-button-icon" aria-hidden="true">&#128196;</span>Post-mortem</a>
	<a class="game-button" href="https://github.com/DaBaEnhanced/DaBaEnhanced.github.io/discussions/categories/saint-dragon">Discuss this game</a>
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
	<a class="game-button" href="_games/MENACE_POSTMORTEM.html"><span class="game-button-icon" aria-hidden="true">&#128196;</span>Post-mortem</a>
	<a class="game-button" href="https://github.com/DaBaEnhanced/DaBaEnhanced.github.io/discussions/categories/menace">Discuss this game</a>
</div>

</article>


<article class="game-card" markdown="1">
### Breathless

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
	<a class="game-button" href="_games/BREATHLESS_POSTMORTEM.html"><span class="game-button-icon" aria-hidden="true">&#128196;</span>Post-mortem</a>
	<a class="game-button" href="https://github.com/DaBaEnhanced/DaBaEnhanced.github.io/discussions/categories/breathless">Discuss this game</a>
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
	<a class="game-button" href="_games/ALIENBREED3D_POSTMORTEM.html"><span class="game-button-icon" aria-hidden="true">&#128196;</span>Post-mortem</a>
	<a class="game-button" href="https://github.com/DaBaEnhanced/DaBaEnhanced.github.io/discussions/categories/alien-breed-3d">Discuss this game</a>
</div>

</article>

{% include soundtrackPlayer.html %}

## Talk about the games

Share feedback, ask questions, suggest ideas, or vote in a poll in [GitHub Discussions](https://github.com/DaBaEnhanced/DaBaEnhanced.github.io/discussions). A GitHub account is needed to post.

{% if site.giscus.repo_id != empty and site.giscus.category_id != empty %}
### Comments on this page

<script src="https://giscus.app/client.js"
        data-repo="{{ site.giscus.repo }}"
        data-repo-id="{{ site.giscus.repo_id }}"
        data-category="{{ site.giscus.category }}"
        data-category-id="{{ site.giscus.category_id }}"
        data-mapping="pathname"
        data-strict="0"
        data-reactions-enabled="1"
        data-emit-metadata="0"
        data-input-position="bottom"
        data-theme="preferred_color_scheme"
        data-lang="en"
        crossorigin="anonymous"
        async>
</script>
{% endif %}

## The Waldtier Dispatch

New books, game releases and behind-the-scenes notes, about once a month. No spam.

<div class="ml-embedded" data-form="pxunda"></div>
