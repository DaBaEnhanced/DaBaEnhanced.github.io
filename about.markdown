---
layout: page
title: About
permalink: /about/
---

<style>
  .about-lede {
    color: var(--vault-text-muted, #93a0b4);
    font-size: clamp(1.05rem, 2vw, 1.3rem);
    margin: -0.25rem 0 1.5rem;
  }

  .about-banner {
    border-radius: 10px;
    display: block;
    margin: 1.75rem 0;
    overflow: hidden;
  }

  .about-banner img {
    display: block;
    height: auto;
    width: 100%;
  }

  .about-section {
    margin: 2rem 0;
  }

  .about-section h3 {
    margin-bottom: 0.5rem;
  }

  .about-links {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin: 1rem 0 0.5rem;
  }

  .about-link {
    align-items: center;
    background: #24292f;
    border-radius: 6px;
    color: #ffffff !important;
    display: inline-flex;
    font-weight: 600;
    gap: 0.5rem;
    padding: 0.65rem 0.9rem;
    text-decoration: none !important;
    transition: background-color 160ms ease, transform 160ms ease;
  }

  .about-link:hover {
    background: #0969da;
    transform: translateY(-1px);
  }

  .about-link-icon {
    font-size: 1.1em;
    line-height: 1;
  }
</style>

<p class="about-lede">Between the genius and the madness of artificial intelligence.</p>

I work in AI in my day job, but in my free time I like to dabble with various generative tools to create weird stuff and, mostly, test the limits of their "human-likeness" or "inhuman-likeness."

This is my personal space: AI stuff goes out under Clumsy.GiBa, the rest under D. B. Waldtier.

<div class="about-banner">
  <img src="{{ site.cdn_url }}/images/fam.jpg" alt="An astronaut reclining on a moon, watching distant planets" />
</div>

<div class="about-section" markdown="1">

### Writing

Written work is 99% human-made, though translations are mostly done with AI, and some poems were written directly in English. The novels are closer to 50-50: I handle the world-building, plots, and characters, while the LLM of the moment helps with prose and embellishments.

### Video

Videos are 99% AI-made. I use image-generation models, combined with constrained initialization and evolving custom prompts, to create weird, dream-like, trippy experiences. The models range from SD 1.5 to SDXL, mostly fine-tuned checkpoints found on [CivitAI](https://civitai.com/), using the [Deforum](https://deforum.art/) Python code as a starting point. Videos are upscaled to 2K using standard ESRGAN models. Lately I have mostly been using ChatGPT and Grok for images and video.

### Images

The various pictures on this site were generated using [Kolors](https://github.com/Kwai-Kolors/Kolors), ChatGPT, or Grok. A handful were made with Kandinsky. All of them were animated by Grok.

### Audio

I'm also exploring open-source text-to-speech models, with varying degrees of success, to generate audiobook-style material for the short stories.

</div>

<div class="about-banner">
  <img src="{{ site.cdn_url }}/images/fam2.jpg" alt="A bearded figure coding at a desk overlooking snowy mountains at dusk" />
</div>

<div class="about-section" markdown="1">

### Wanna help?

**Follow**

<div class="about-links">
  <a class="about-link" href="https://instagram.com/clumsy.giba?igshid=ZDdkNTZiNTM." target="_blank" rel="noopener"><span class="about-link-icon">&#128247;</span>Instagram</a>
  <a class="about-link" href="https://www.youtube.com/@clumsy_giba" target="_blank" rel="noopener"><span class="about-link-icon">&#9654;&#65039;</span>YouTube</a>
  <a class="about-link" href="https://www.threads.net/@clumsy.giba" target="_blank" rel="noopener"><span class="about-link-icon">&#127925;</span>TikTok</a>
</div>

**Support**

<div class="about-links">
  <a class="about-link" href="https://ko-fi.com/dbwaldtier" target="_blank" rel="noopener"><span class="about-link-icon">&#9749;</span>Ko-fi</a>
</div>

Buy my books on Amazon (*redacted until I publish the new versions*).

Or send ETH to `0x992a2253D98C1d235C6531A0c657634B902B7BBC` if you feel generous.

</div>

Bye!
