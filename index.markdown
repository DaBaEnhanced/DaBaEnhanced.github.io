---
# Feel free to add content and custom Front Matter to this file.
# To modify the layout, see https://jekyllrb.com/docs/themes/#overriding-theme-defaults

layout: home
---

<style>
  .vault-hero {
    background: #05060a;
    border-radius: 12px;
    box-shadow: 0 18px 55px rgba(0, 0, 0, 0.38);
    isolation: isolate;
    overflow: hidden;
    position: relative;
    width: 100%;
  }

  .vault-hero-media {
    inset: 0;
    position: absolute;
  }

  .vault-hero-media video,
  .vault-hero-media img {
    inset: 0;
    display: block;
    height: 100%;
    object-fit: cover;
    object-position: center;
    position: absolute;
    width: 100%;
  }

  .vault-hero-media video {
    z-index: 1;
  }

  .vault-hero::after {
    background:
      radial-gradient(ellipse at center, rgba(3, 8, 15, 0.72) 0%, rgba(3, 8, 15, 0.5) 36%, rgba(3, 8, 15, 0.08) 72%),
      linear-gradient(180deg, rgba(3, 5, 10, 0.12), rgba(3, 5, 10, 0.3));
    content: "";
    inset: 0;
    position: absolute;
    z-index: 1;
  }

  .vault-hero-copy {
    align-items: center;
    color: #f2d38f;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: clamp(18rem, 33.333vw, 24.6rem);
    padding: clamp(1.25rem, 3vw, 2.5rem);
    position: relative;
    text-align: center;
    text-shadow: 0 2px 12px #02060c, 0 0 28px rgba(2, 6, 12, 0.9);
    z-index: 2;
  }

  .vault-hero-title {
    color: #f0c975;
    font-family: "Cinzel", Georgia, serif;
    font-size: clamp(2.15rem, 6.2vw, 4.9rem);
    font-weight: 600;
    letter-spacing: 0.035em;
    line-height: 0.95;
    margin: 0;
    text-shadow:
      0 2px 1px rgba(74, 39, 10, 0.9),
      0 4px 18px #02060c,
      0 0 34px rgba(2, 6, 12, 0.95);
  }

  .vault-hero-categories {
    color: #f6dfa5;
    display: flex;
    flex-wrap: wrap;
    font-family: "Cinzel", Georgia, serif;
    font-size: clamp(0.82rem, 2vw, 1.25rem);
    font-weight: 600;
    gap: 0.4em 0.72em;
    justify-content: center;
    letter-spacing: 0.24em;
    line-height: 1.35;
    margin: clamp(0.55rem, 1.2vw, 0.9rem) 0 0;
  }

  .vault-hero-categories span {
    white-space: nowrap;
  }

  .vault-hero-categories .vault-category-dot {
    color: #ddb768;
    letter-spacing: 0;
  }

  .vault-hero-divider {
    align-items: center;
    display: flex;
    gap: 0.85rem;
    margin: clamp(0.55rem, 1.5vw, 1rem) 0;
    width: min(29rem, 66%);
  }

  .vault-hero-divider::before,
  .vault-hero-divider::after {
    background: linear-gradient(90deg, transparent, #e5c475);
    content: "";
    flex: 1;
    height: 1px;
  }

  .vault-hero-divider::after {
    background: linear-gradient(90deg, #e5c475, transparent);
  }

  .vault-hero-divider svg {
    fill: none;
    flex: 0 0 auto;
    height: 1.45rem;
    stroke: #f0ce7e;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.6;
    transform: rotate(-12deg);
    width: 2rem;
  }

  .vault-hero-tagline {
    color: #f1d99e;
    font-family: "Cormorant Garamond", Georgia, serif;
    font-size: clamp(1.15rem, 2.35vw, 1.65rem);
    font-style: italic;
    font-weight: 600;
    letter-spacing: 0.015em;
    line-height: 1.15;
    margin: 0;
  }

  .vault-kofi,
  .vault-kofi:visited {
    align-items: center;
    background: rgba(4, 10, 18, 0.82);
    border: 1px solid #d2a956;
    box-sizing: border-box;
    box-shadow:
      inset 0 0 0 3px rgba(4, 10, 18, 0.92),
      inset 0 0 0 4px rgba(210, 169, 86, 0.42),
      0 4px 18px rgba(0, 0, 0, 0.35);
    color: #f4d898;
    display: inline-flex;
    font-family: Georgia, "Times New Roman", serif;
    font-size: clamp(1rem, 1.9vw, 1.3rem);
    gap: 0.65rem;
    justify-content: center;
    line-height: 1.2;
    margin-top: clamp(0.75rem, 1.6vw, 1.1rem);
    max-width: 100%;
    min-height: 3.15rem;
    padding: 0.75rem clamp(1rem, 2.5vw, 1.65rem);
    text-decoration: none;
    transition: background 160ms ease, box-shadow 160ms ease, color 160ms ease, transform 160ms ease;
  }

  .vault-kofi:hover,
  .vault-kofi:focus-visible {
    background: rgba(18, 28, 39, 0.96);
    box-shadow:
      inset 0 0 0 3px rgba(4, 10, 18, 0.92),
      inset 0 0 0 4px rgba(245, 211, 139, 0.75),
      0 7px 24px rgba(0, 0, 0, 0.48);
    color: #fff2c8;
    transform: translateY(-2px);
  }

  .vault-kofi:focus-visible {
    outline: 2px solid #fff2c8;
    outline-offset: 3px;
  }

  .vault-kofi-icon {
    align-items: center;
    background: #fff;
    border-radius: 0.3rem;
    box-shadow: none;
    display: inline-flex;
    flex: 0 0 auto;
    height: 1.55rem;
    justify-content: center;
    text-shadow: none;
    width: 2rem;
  }

  .vault-kofi-icon svg {
    height: 1.15rem;
    width: 1.4rem;
  }

  @media (max-width: 520px) {
    .vault-hero-media video,
    .vault-hero-media img {
      object-position: center center;
    }

    .vault-hero-copy {
      min-height: 18rem;
      padding: 0.9rem 0.65rem;
    }

    .vault-hero-title {
      font-size: clamp(1.6rem, 8.4vw, 2.55rem);
      letter-spacing: 0.01em;
      white-space: nowrap;
    }

    .vault-hero-categories {
      font-size: clamp(0.66rem, 2.6vw, 0.76rem);
      gap: 0.2rem 0.38rem;
      letter-spacing: 0.09em;
    }

    .vault-hero-divider {
      gap: 0.6rem;
      margin: 0.4rem 0;
      width: 82%;
    }

    .vault-hero-divider svg {
      height: 1.1rem;
      width: 1.6rem;
    }

    .vault-hero-tagline {
      font-size: clamp(1rem, 4.6vw, 1.2rem);
      max-width: 18rem;
    }

    .vault-kofi,
    .vault-kofi:visited {
      font-size: clamp(0.88rem, 4vw, 1rem);
      gap: 0.5rem;
      margin-top: 0.6rem;
      min-height: 2.7rem;
      padding: 0.6rem 0.75rem;
    }

    .vault-kofi-icon {
      height: 1.35rem;
      width: 1.75rem;
    }

    .vault-kofi-icon svg {
      height: 1rem;
      width: 1.25rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .vault-hero-media video {
      display: none;
    }

    .vault-kofi {
      transition: none;
    }
  }

  .vault-grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: 1fr;
    margin: 2rem 0;
  }

  @media (min-width: 600px) {
    .vault-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (min-width: 900px) {
    .vault-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  .vault-card {
    background: var(--vault-panel, #151923);
    border: 1px solid var(--vault-border, rgba(255, 255, 255, 0.08));
    border-radius: 10px;
    color: var(--vault-text, #e6e9f0);
    display: block;
    padding: 1.25rem;
    position: relative;
    text-decoration: none !important;
    transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
  }

  .vault-card::before {
    background: var(--accent);
    border-radius: 10px 10px 0 0;
    content: "";
    height: 3px;
    left: 0;
    position: absolute;
    right: 0;
    top: 0;
  }

  .vault-card:hover {
    border-color: var(--accent);
    box-shadow: 0 10px 28px -12px var(--accent);
    transform: translateY(-3px);
  }

  .vault-card-icon {
    align-items: center;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: var(--accent);
    display: inline-flex;
    height: 2.7rem;
    justify-content: center;
    transition: background 160ms ease, color 160ms ease;
    width: 2.7rem;
  }

  .vault-card-icon svg {
    fill: none;
    height: 1.45rem;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.8;
    width: 1.45rem;
  }

  .vault-card:hover .vault-card-icon {
    background: var(--accent);
    color: #0b0d12;
  }

  .vault-card-title {
    color: var(--vault-heading, #f5f7fb);
    font-family: "Cinzel", Georgia, serif;
    font-size: 1.15rem;
    font-weight: 600;
    letter-spacing: 0.025em;
    margin: 0.6rem 0 0.35rem;
  }

  .vault-card-desc {
    color: var(--vault-text-muted, #93a0b4);
    font-size: 0.92rem;
    line-height: 1.5;
    margin: 0;
  }
</style>

<section class="vault-hero" aria-labelledby="vault-hero-title">
  <div class="vault-hero-media">
    <img src="{{ site.cdn_url }}/images/new_banner.jpg" alt="" aria-hidden="true" />
    <video
      poster="{{ site.cdn_url }}/images/new_banner.jpg"
      autoplay
      loop
      muted
      playsinline
      preload="metadata"
      aria-hidden="true">
      <source src="{{ site.cdn_url }}/videos/new_banner.mp4" type="video/mp4" />
    </video>
  </div>
  <div class="vault-hero-copy">
    <h1 class="vault-hero-title" id="vault-hero-title">D.B. WALDTIER</h1>
    <p class="vault-hero-categories">
      <span>GAME PORTS</span><span class="vault-category-dot" aria-hidden="true">&bull;</span>
      <span>BOOKS</span><span class="vault-category-dot" aria-hidden="true">&bull;</span>
      <span>WORLDS</span>
    </p>
    <div class="vault-hero-divider" aria-hidden="true">
      <svg viewBox="0 0 32 22"><ellipse cx="16" cy="11" rx="7" ry="7"/><path d="M2 15c4.5 2.4 12.7 1.6 19.4-1.8S31 6.8 30 5.2c-1.1-1.8-6.1-.6-11.4 2"/></svg>
    </div>
    <p class="vault-hero-tagline">Retro games rebuilt. Strange worlds imagined.</p>
    <a class="vault-kofi" href="https://ko-fi.com/dbwaldtier" target="_blank" rel="noopener">
      <span class="vault-kofi-icon" aria-hidden="true">
        <svg viewBox="0 0 28 22"><path fill="#ff5e5b" d="M13.9 19.2C8.4 15.8 5.1 12.8 5.1 8.6c0-2.6 1.9-4.5 4.3-4.5 1.8 0 3.3 1 4.5 2.5 1.2-1.5 2.7-2.5 4.5-2.5 2.4 0 4.3 1.9 4.3 4.5 0 4.2-3.3 7.2-8.8 10.6z"/><path fill="none" stroke="#1d2935" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.5 2.2h20v8.7c0 5.1-3.6 8.3-8.5 8.3h-3c-4.9 0-8.5-3.2-8.5-8.3zM22.5 5h1.2a3.8 3.8 0 0 1 0 7.6h-1.9"/></svg>
      </span>
      <span>Support my work on Ko-fi</span>
    </a>
  </div>
</section>

<div class="vault-grid">
  <a class="vault-card" style="--accent: #e3b341;" href="/books">
    <span class="vault-card-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22z"/></svg></span>
    <h3 class="vault-card-title">Books</h3>
    <p class="vault-card-desc">Full-length novels, mostly hard sci-fi. Start with the Consent Engines saga.</p>
  </a>
    <a class="vault-card" style="--accent: #e5484d;" href="/games">
    <span class="vault-card-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7.5 8h9a4.5 4.5 0 0 1 4.3 5.8l-1 3.2a2.2 2.2 0 0 1-4.1.2l-.7-1.5H8.9l-.7 1.5a2.2 2.2 0 0 1-4.1-.2l-1-3.2A4.5 4.5 0 0 1 7.5 8z"/><path d="M7 12v4M5 14h4M16 13h.01M18.5 15.5h.01"/></svg></span>
    <h3 class="vault-card-title">Games</h3>
    <p class="vault-card-desc">Old Amiga classics rebuilt from disassembled source, playable right in your browser.</p>
  </a>
    <a class="vault-card" style="--accent: #f2795c;" href="/short">
    <span class="vault-card-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 4h14v16H5z"/><path d="M8 9h8M8 13h6"/><path d="M8 17h3"/></svg></span>
    <h3 class="vault-card-title">Short Stories</h3>
    <p class="vault-card-desc">Standalone tales, translated and tightened with a little help from Claude.</p>
  </a>
  <a class="vault-card" style="--accent: #a684e8;" href="/poems">
    <span class="vault-card-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m4 20 4.1-1 10-10a2.1 2.1 0 0 0-3-3l-10 10z"/><path d="m13.8 7.2 3 3"/><path d="M4 20h5"/></svg></span>
    <h3 class="vault-card-title">Poetry</h3>
    <p class="vault-card-desc">Verses written long before the AI got involved.</p>
  </a>
    <a class="vault-card" style="--accent: #3ecf8e;" href="/video">
    <span class="vault-card-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/><path d="M3 9h18"/></svg></span>
    <h3 class="vault-card-title">Videos</h3>
    <p class="vault-card-desc">Trippy AI-generated animations from the early diffusion-model days.</p>
  </a>
  <a class="vault-card" style="--accent: #4c9eff;" href="/physics">
    <span class="vault-card-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="1.5"/><path d="M4.9 7.8c2.2-3.7 9.2-3.1 13.2.4s3.5 7.1 1.3 8.4-6.5-.4-10.5-3.9-6.2-7.6-4-8.9z"/><path d="M19.1 7.8c-2.2-3.7-9.2-3.1-13.2.4s-3.5 7.1-1.3 8.4 6.5-.4 10.5-3.9 6.2-7.6 4-8.9z"/></svg></span>
    <h3 class="vault-card-title">Physics</h3>
    <p class="vault-card-desc">A speculative theory of everything, built as the backbone for upcoming novels.</p>
  </a>
</div>
