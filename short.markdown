---
layout: page
title: "Short Stories"
permalink: /short
---

<style>
  .shorts-grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: 1fr;
    list-style: none;
    margin: 2rem 0;
    padding: 0;
  }

  @media (min-width: 600px) {
    .shorts-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (min-width: 900px) {
    .shorts-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  .shorts-tile {
    aspect-ratio: 4 / 3;
    border: 1px solid var(--vault-border, rgba(255, 255, 255, 0.08));
    border-radius: 10px;
    display: block;
    overflow: hidden;
    position: relative;
    text-decoration: none !important;
    transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
  }

  .shorts-tile:hover {
    border-color: #f2795c;
    box-shadow: 0 10px 28px -12px #f2795c;
    transform: translateY(-3px);
  }

  .shorts-tile-media {
    height: 100%;
    left: 0;
    object-fit: cover;
    object-position: center;
    position: absolute;
    top: 0;
    width: 100%;
    z-index: 0;
  }

  .shorts-tile::after {
    background: linear-gradient(180deg, rgba(10, 12, 17, 0) 40%, rgba(10, 12, 17, 0.94) 100%);
    content: "";
    inset: 0;
    position: absolute;
    z-index: 1;
  }

  .shorts-tile-copy {
    bottom: 0;
    left: 0;
    padding: 0.75rem 0.9rem;
    position: absolute;
    right: 0;
    z-index: 2;
  }

  .shorts-tile-title {
    color: #ffffff;
    display: block;
    font-family: "Space Grotesk", sans-serif;
    font-size: 1rem;
    font-weight: 600;
  }

  .shorts-tile-summary {
    color: var(--vault-text-muted, #93a0b4);
    display: block;
    font-size: 0.85rem;
    margin-top: 0.15rem;
  }
</style>

This is a collection of various short stories I've written, translated to English with the help of Claude 3.7.

If you'd prefer an ebook-reader-friendly PDF, I've compiled them into one file you can find <a href="/books">here</a>.

<div class="shorts-grid">
  {% for short in site.shorts %}
    <a class="shorts-tile" href="{{ short.url }}">
      <img class="shorts-tile-media" src="{{ site.cdn_url }}{{ short.thumbnail_img }}" alt="{{ short.summary | default: short.title }}" />
      <span class="shorts-tile-copy">
        <span class="shorts-tile-title">{{ short.title }}</span>
        <span class="shorts-tile-summary">{{ short.summary }}</span>
      </span>
    </a>
  {% endfor %}
</div>
