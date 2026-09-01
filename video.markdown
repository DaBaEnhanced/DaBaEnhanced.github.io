---
layout: page
title: "Videos"
---

<style>
  .video-jumplist {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 1rem 0 2rem;
  }

  .video-jumplist a {
    background: var(--vault-panel, #151923);
    border: 1px solid var(--vault-border, rgba(255, 255, 255, 0.08));
    border-radius: 999px;
    color: var(--vault-text-muted, #93a0b4);
    font-size: 0.85rem;
    padding: 0.3rem 0.75rem;
    text-decoration: none !important;
    transition: border-color 160ms ease, color 160ms ease;
  }

  .video-jumplist a:hover {
    border-color: #3ecf8e;
    color: #ffffff;
  }

  .videos-grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: 1fr;
    list-style: none;
    margin: 2rem 0;
    padding: 0;
  }

  @media (min-width: 600px) {
    .videos-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (min-width: 900px) {
    .videos-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  .videos-tile {
    aspect-ratio: 4 / 3;
    border: 1px solid var(--vault-border, rgba(255, 255, 255, 0.08));
    border-radius: 10px;
    display: block;
    overflow: hidden;
    position: relative;
    text-decoration: none !important;
    transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
  }

  .videos-tile:hover {
    border-color: #3ecf8e;
    box-shadow: 0 10px 28px -12px #3ecf8e;
    transform: translateY(-3px);
  }

  .videos-tile-media {
    height: 100%;
    left: 0;
    object-fit: cover;
    object-position: center;
    position: absolute;
    top: 0;
    width: 100%;
    z-index: 0;
  }

  .videos-tile::after {
    background: linear-gradient(180deg, rgba(10, 12, 17, 0) 40%, rgba(10, 12, 17, 0.94) 100%);
    content: "";
    inset: 0;
    position: absolute;
    z-index: 1;
  }

  .videos-tile-copy {
    bottom: 0;
    left: 0;
    padding: 0.75rem 0.9rem;
    position: absolute;
    right: 0;
    z-index: 2;
  }

  .videos-tile-title {
    color: #ffffff;
    display: block;
    font-family: "Space Grotesk", sans-serif;
    font-size: 1rem;
    font-weight: 600;
  }

  .videos-tile-summary {
    color: var(--vault-text-muted, #93a0b4);
    display: block;
    font-size: 0.85rem;
    margin-top: 0.15rem;
  }
</style>

### Clumsy.GiBa's Videos

This is a collection of various videos I've created using a plethora of diffusion models (mostly image models).

These were made mostly around 2023, so the animation quality isn't up to the latest models, but they're still trippy.

Some notable ones:

<div class="video-jumplist">
  <a href="#highlight003">003 - Beyond Reality</a>
  <a href="#highlight007">007 - From The Universe To The Subatomic</a>
  <a href="#highlight018">018 - Dante's Inferno</a>
  <a href="#highlight020">020 - Dante's Paradise</a>
  <a href="#highlight030">030 - The Last Days</a>
  <a href="#highlight055">055 - Genesis</a>
  <a href="#highlight089">089 - Easter</a>
  <a href="#highlight093">093 - The Ascent</a>
  <a href="#highlight094">094 - The Descent</a>
  <a href="#highlight108">108 - Tommy In Wonderland</a>
  <a href="#highlight119">119 - Life's Road</a>
  <a href="#highlight130">130 - Our Toys</a>
  <a href="#highlight151">151 - Women Through History</a>
  <a href="#highlight166">166 - Mad Maxine</a>
  <a href="#highlight192">192...198 - The 7 Deadly Sins series</a>
</div>

The list (in descending order):

<div class="videos-grid">
  {% assign sorted_videos = site.videos | sort: "path" | reverse %}
  {% for video in sorted_videos %}
    {% assign short_title = video.title | split: " - " | last %}
    <a class="videos-tile" id="highlight{{ video.title | slice: 0, 3 | downcase }}" href="{{ video.url }}">
      <img class="videos-tile-media" src="{{ site.cdn_url }}{{ video.thumbnail }}" alt="{{ video.summary | default: video.title }}" />
      <span class="videos-tile-copy">
        <span class="videos-tile-title">{{ video.title }}</span>
        {% if video.summary and video.summary != short_title %}<span class="videos-tile-summary">{{ video.summary }}</span>{% endif %}
      </span>
    </a>
  {% endfor %}
</div>
