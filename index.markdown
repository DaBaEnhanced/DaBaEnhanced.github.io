---
# Feel free to add content and custom Front Matter to this file.
# To modify the layout, see https://jekyllrb.com/docs/themes/#overriding-theme-defaults

layout: home
image: https://assets.waldtier.com/images/new_banner.jpg
---

<style>
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

{% include vault-hero.html %}

<div class="vault-grid">
  <a class="vault-card" style="--accent: #e3b341;" href="/books">
    <span class="vault-card-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22z"/></svg></span>
    <h3 class="vault-card-title">Books</h3>
    <p class="vault-card-desc">Full-length novels, mostly hard sci-fi. Start with the Consent Engines saga.</p>
  </a>
    <a class="vault-card" style="--accent: #e5484d;" href="/games">
    <span class="vault-card-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7.5 8h9a4.5 4.5 0 0 1 4.3 5.8l-1 3.2a2.2 2.2 0 0 1-4.1.2l-.7-1.5H8.9l-.7 1.5a2.2 2.2 0 0 1-4.1-.2l-1-3.2A4.5 4.5 0 0 1 7.5 8z"/><path d="M7 12v4M5 14h4M16 13h.01M18.5 15.5h.01"/></svg></span>
    <h3 class="vault-card-title">Games</h3>
    <p class="vault-card-desc">Original indie games like Megapop, Vertebra and AFTERGLOW, plus Amiga classics rebuilt from source. All free in your browser.</p>
  </a>
    <a class="vault-card" style="--accent: #f2795c;" href="/short">
    <span class="vault-card-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 4h14v16H5z"/><path d="M8 9h8M8 13h6"/><path d="M8 17h3"/></svg></span>
    <h3 class="vault-card-title">Short Stories</h3>
    <p class="vault-card-desc">Standalone sci-fi tales, from first contact to posthuman futures. Many come with audiobooks.</p>
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
