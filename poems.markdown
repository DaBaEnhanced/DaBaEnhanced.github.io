---
layout: page
title: "Poetry"
permalink: /poems
---

<img src="../assets/images/poetry.jpg" alt="A glimpse of the universe" style="width: 100%; height: 100%; object-fit: cover; object-position: center;" />

This is a collection of various poems I've written in the past (no AI, except for translation of some of them from their original language)

If you prefer reading them in a nice ebook reader friedly PDF I've compiled all of my poems in a nice little PDF you can find <a href="assets/pdf/Poems - Clumsy.GiBa v4.pdf" target="_blank" style="color: #007bff; text-decoration: underline;">here</a>.

<ul style="list-style: none; padding: 0; margin: 0;">
  {% for poem in site.poetry %}
    <li style="margin: 0; padding: 0;">
      <a href="{{ poem.url }}">
        <div style="position: relative; text-align: center; color: white; overflow: hidden; height: 25vh; border: 2px solid black; border-radius: 15px; margin: 0; padding: 0;">
          <!-- Background Image -->
          <img src="{{poem.thumbnail}}" alt="A glimpse of the universe" style="width: 100%; height: 100%; object-fit: cover; object-position: center;" />
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background-color: rgba(0, 0, 0, 0.5); padding: 10px; border-radius: 5px;">
            <h1>{{ poem.title }}</h1>
          </div>
      </div>
      </a>
    </li>
  {% endfor %}
</ul>
