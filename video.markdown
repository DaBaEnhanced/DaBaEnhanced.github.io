---
layout: page
title: "Videos"
---

### ClumsyGiBa's Videos

This is a collection of various videos I've created using a plethora of diffusion models (mostly image models):

<!-- Links to jump to highlighted sections -->
<div style="margin-bottom: 20px;">
  <a href="#highlight003" style="margin-right: 10px;">003 - Beyond Reality</a>
  <a href="#highlight007" style="margin-right: 10px;">007 - From The Universe To The Subatomic</a>
  <a href="#highlight018" style="margin-right: 10px;">018 - Dante's Inferno</a>and <a href="#highlight020" style="margin-right: 10px;">020 - Dante's Paradise</a>
  <a href="#highlight030" style="margin-right: 10px;">030 - The Last Days</a>
  <a href="#highlight055" style="margin-right: 10px;">055 - Genesis</a>
  <a href="#highlight192">192...198 - The 7 deadly sins series</a>
</div>

<ul>
  {% assign sorted_videos = site.videos | sort: "path" | reverse %}
  {% for video in sorted_videos %}
    <li id="highlight{{ video.title | slice: 0, 3 | downcase }}">
    <a href="{{ video.url }}">
      <div style="position: relative; text-align: center; color: white; overflow: hidden; height: 25vh; border: 2px solid black; border-radius: 15px;">
        <!-- Background Image -->
        <img src="{{video.thumbnail}}" alt="A glimpse of the universe" style="width: 100%; height: 100%; object-fit: cover; object-position: center;" />
      
        <!-- Title on Top of the Image -->
        <h1 style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background-color: rgba(0, 0, 0, 0.5); padding: 10px; border-radius: 5px;">
          {{ video.title }} 
        </h1>
      </div>
      </a>
      
    </li>
  {% endfor %}
</ul>
