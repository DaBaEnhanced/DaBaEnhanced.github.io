---
layout: page
title: "Videos"
---

### ClumsyGiBa's Videos

This is a collection of various videos I've created using a plethora of diffusion models (mostly image models):

<ul>
  {% for video in site.videos %}
    <li>
    <a href="{{ video.url }}">
      <div style="position: relative; text-align: center; color: white; overflow: hidden; height: 25vh; border: 2px solid black; border-radius: 15px;">
        <!-- Background Image -->
        <img src="{{video.thumbnail}}" alt="A glimpse of the universe" style="width: 100%; height: 100%; object-fit: cover; object-position: center;" />
      
        <!-- Title on Top of the Image -->
        <h1 style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background-color: rgba(0, 0, 0, 0.5); padding: 10px; border-radius: 5px;">
          {{ video.title }} <p>{{ video.summary | markdownify }}</p>
        </h1>
      </div>
      </a>
      
    </li>
  {% endfor %}
</ul>
