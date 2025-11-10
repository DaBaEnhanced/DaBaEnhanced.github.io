---
layout: page
title: "Short Stories"
permalink: /short
---

### Clumsy.GiBa's Short Stories

This is a collection of various short stories I've written with the help of Claude 3.7

If you prefer reading them in a nice ebook reader friedly PDF I've compiled them in a nice little PDF you can find <a href="assets/pdf/Short Stories - Clumsy.GiBa v3.pdf" target="_blank" style="color: #007bff; text-decoration: underline;">here</a>.

<ul style="list-style: none; padding: 0; margin: 0;">
  {% for short in site.shorts %}
    <li style="margin: 0; padding: 0;">
      <a href="{{ short.url }}">
        <div style="position: relative; text-align: center; color: white; overflow: hidden; height: 25vh; border: 2px solid black; border-radius: 15px; margin: 0; padding: 0;">
          <!-- Background Image -->
          <img src="{{short.thumbnail_img}}" alt="A glimpse of the universe" style="width: 100%; height: 100%; object-fit: cover; object-position: center;" />
          <!-- Title on Top of the Image -->
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background-color: rgba(0, 0, 0, 0.5); padding: 10px; border-radius: 5px;">
            <h1>{{ short.title }}</h1> <p><h5>{{ short.summary | markdownify }}</h5></p>
          </div>
        </div>
      </a>
    </li>
  {% endfor %}
</ul>
