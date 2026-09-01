---
layout: page
title: "Poetry"
permalink: /poems
---

<style>
  .poetry-banner {
    border-radius: 10px;
    margin-bottom: 1.5rem;
    overflow: hidden;
  }

  .poetry-banner video {
    display: block;
    height: auto;
    width: 100%;
  }

  .poetry-grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: 1fr;
    list-style: none;
    margin: 2rem 0;
    padding: 0;
  }

  @media (min-width: 600px) {
    .poetry-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (min-width: 900px) {
    .poetry-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  .poetry-tile {
    aspect-ratio: 4 / 3;
    border: 1px solid var(--vault-border, rgba(255, 255, 255, 0.08));
    border-radius: 10px;
    display: block;
    overflow: hidden;
    position: relative;
    text-decoration: none !important;
    transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
  }

  .poetry-tile:hover {
    border-color: #a684e8;
    box-shadow: 0 10px 28px -12px #a684e8;
    transform: translateY(-3px);
  }

  .poetry-tile-media {
    height: 100%;
    left: 0;
    object-fit: cover;
    object-position: center;
    position: absolute;
    top: 0;
    width: 100%;
    z-index: 0;
  }

  .poetry-tile::after {
    background: linear-gradient(180deg, rgba(10, 12, 17, 0) 45%, rgba(10, 12, 17, 0.92) 100%);
    content: "";
    inset: 0;
    position: absolute;
    z-index: 1;
  }

  .poetry-tile-title {
    bottom: 0;
    color: #ffffff;
    font-family: "Space Grotesk", sans-serif;
    font-size: 1rem;
    font-weight: 600;
    left: 0;
    padding: 0.75rem 0.9rem;
    position: absolute;
    right: 0;
    z-index: 2;
  }
</style>

<div class="poetry-banner">
  <video src="{{ site.cdn_url }}/videos/poems_banner.mp4" autoplay loop muted playsinline></video>
</div>

This is a collection of various poems I've written in the past (no AI, except for translating a few of them from their original language).

If you'd prefer an ebook-reader-friendly PDF, I've compiled all of my poems into one file you can find <a href="/books">here</a>.

<div class="poetry-grid">
  {% for poem in site.poetry %}
    <a class="poetry-tile" href="{{ poem.url }}">
      <img class="poetry-tile-media" src="{{ site.cdn_url }}{{ poem.thumbnail_img }}" alt="{{ poem.summary | default: poem.title }}" />
      <span class="poetry-tile-title">{{ poem.title }}</span>
    </a>
  {% endfor %}
</div>
