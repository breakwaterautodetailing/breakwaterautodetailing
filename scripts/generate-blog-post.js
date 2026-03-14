import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('ERROR: Missing OPENAI_API_KEY environment variable');
  process.exit(1);
}

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_MODE = process.env.NEWS_MODE === 'true';

// Load topics
const topicsPath = join(__dirname, 'blog-topics.json');
const topics = JSON.parse(readFileSync(topicsPath, 'utf8'));

// Gradient classes to cycle through
const gradClasses = ['grad-1', 'grad-2', 'grad-3', 'grad-4', 'grad-5'];
const usedCount = topics.filter(t => t.used).length;
const gradClass = gradClasses[usedCount % gradClasses.length];

// Fetch top South Florida headlines from NewsAPI
async function fetchSouthFloridaNews() {
  if (!NEWS_API_KEY) {
    throw new Error('NEWS_MODE is enabled but NEWS_API_KEY is not set');
  }
  const query = encodeURIComponent('south florida OR miami OR broward county OR fort lauderdale');
  const url = `https://newsapi.org/v2/everything?q=${query}&language=en&sortBy=publishedAt&pageSize=10&apiKey=${NEWS_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`NewsAPI error ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  if (!data.articles || data.articles.length === 0) {
    throw new Error('No articles returned from NewsAPI');
  }
  return data.articles.map(a => `- ${a.title} (${a.source.name})`).join('\n');
}

// Date helpers
function getDateInfo() {
  const now = new Date();
  const months = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];
  return {
    display: `${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`,
    iso: now.toISOString().split('T')[0],
    year: now.getFullYear()
  };
}

// Call OpenAI and get structured blog post data
async function generatePost(topic, keywords) {
  const prompt = `You are a professional SEO content writer for Breakwater Auto Detailing — a premium mobile car detailing business in South Florida (Broward County, Palm Beach County, Miami-Dade County). Phone: (954) 554-8941. Website: breakwaterautodetailing.com.

Write a complete SEO blog post about: "${topic}"
Primary keywords to naturally include: ${keywords.join(', ')}

Return ONLY valid JSON (no markdown, no code fences) with these exact fields:
{
  "title": "Compelling H1 title, under 60 characters, includes a primary keyword",
  "slug": "url-friendly-slug-lowercase-hyphens-no-special-chars",
  "metaDescription": "Meta description 145-160 characters, includes primary keyword and a call to action",
  "tag": "Exactly one of: Car Care Tips | Detailing Guide | South Florida | Paint Care | Interior Care | Seasonal Tips",
  "excerpt": "2 punchy sentences for the blog card, max 160 characters total",
  "readTime": "estimated read time as a number only, e.g. 5",
  "emoji": "single relevant emoji character",
  "bodyHtml": "Full article body HTML. Use only <h2>, <h3>, <p>, <ul>, <li>, <strong>, <a> tags. 650-850 words. Include specific South Florida references (county names, city names, weather). Naturally include 2-3 internal links using these exact paths: link to ../services.html or ../services.html#basic-wash or ../services.html#express-detail or ../services.html#premium-detail or ../services.html#elite-detail or ../areas.html or ../contact.html — use anchor text that fits naturally in the sentence. End with a <div class=\\"blog-post-cta\\"><h3>Ready for a Professional Detail?</h3><p>...</p><a href=\\"tel:9545548941\\" class=\\"btn btn-primary\\">&#x1F4F1; Call (954) 554-8941</a></div>"
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 2500
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  return JSON.parse(content);
}

// Call OpenAI and get a news-driven blog post based on current South Florida headlines
async function generateNewsPost(headlines) {
  const prompt = `You are a professional SEO content writer for Breakwater Auto Detailing — a premium mobile car detailing business in South Florida (Broward County, Palm Beach County, Miami-Dade County). Phone: (954) 554-8941. Website: breakwaterautodetailing.com.

Here are today's top South Florida news headlines:
${headlines}

Pick the single most relevant headline that a car owner in South Florida would relate to (weather events, traffic, local events, economic news, tourism, real estate, etc.). Write a timely SEO blog post that:
1. References that news story as the hook in the opening paragraph
2. Naturally connects it to car care, vehicle protection, or auto detailing
3. Provides genuine value and practical car care advice
4. Feels timely and locally relevant — not forced

Return ONLY valid JSON (no markdown, no code fences) with these exact fields:
{
  "title": "Newsy + keyword-rich H1 title, under 65 characters",
  "slug": "url-friendly-slug-lowercase-hyphens-no-special-chars",
  "metaDescription": "Meta description 145-160 characters with a call to action",
  "tag": "Exactly one of: Car Care Tips | Detailing Guide | South Florida | Paint Care | Interior Care | Seasonal Tips",
  "excerpt": "2 punchy sentences tying the news to car care, max 160 characters total",
  "readTime": "estimated read time as a number only, e.g. 5",
  "emoji": "single relevant emoji character",
  "newsHook": "The headline or story you chose as the hook (plain text)",
  "bodyHtml": "Full article body HTML. Use only <h2>, <h3>, <p>, <ul>, <li>, <strong> tags. 650-850 words. Reference the news story in the opening, then pivot to car care advice relevant to South Florida. End with a <div class=\\"blog-post-cta\\"><h3>Ready for a Professional Detail?</h3><p>...</p><a href=\\"tel:9545548941\\" class=\\"btn btn-primary\\">&#x1F4F1; Call (954) 554-8941</a></div>"
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 2500
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  return JSON.parse(content);
}

// Generate individual blog post HTML page
function buildPostPage(post, date) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${post.title} | Breakwater Auto Detailing</title>
  <meta name="description" content="${post.metaDescription}">
  <link rel="canonical" href="https://breakwaterautodetailing.com/blog/${post.slug}.html">

  <!-- Open Graph -->
  <meta property="og:title" content="${post.title} | Breakwater Auto Detailing">
  <meta property="og:description" content="${post.metaDescription}">
  <meta property="og:image" content="https://breakwaterautodetailing.com/logo/breakwater-og-image.jpg">
  <meta property="og:url" content="https://breakwaterautodetailing.com/blog/${post.slug}.html">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Breakwater Auto Detailing">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${post.title} | Breakwater Auto Detailing">
  <meta name="twitter:description" content="${post.metaDescription}">
  <meta name="twitter:image" content="https://breakwaterautodetailing.com/logo/breakwater-og-image.jpg">

  <!-- SEO & Mobile -->
  <meta name="robots" content="index, follow">
  <meta name="theme-color" content="#0a1628">

  <!-- Favicon -->
  <link rel="icon" type="image/x-icon" href="../logo/favicon.ico">
  <link rel="icon" type="image/png" sizes="32x32" href="../logo/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="../logo/favicon-16x16.png">
  <link rel="apple-touch-icon" sizes="180x180" href="../logo/apple-touch-icon.png">

  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">

  <!-- Stylesheet -->
  <link rel="stylesheet" href="../css/styles.css">

  <!-- Schema: BlogPosting -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": "${post.title}",
    "description": "${post.metaDescription}",
    "datePublished": "${date.iso}",
    "dateModified": "${date.iso}",
    "author": {
      "@type": "Organization",
      "name": "Breakwater Auto Detailing",
      "url": "https://breakwaterautodetailing.com"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Breakwater Auto Detailing",
      "logo": {
        "@type": "ImageObject",
        "url": "https://breakwaterautodetailing.com/logo/breakwater-logo-header.webp"
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": "https://breakwaterautodetailing.com/blog/${post.slug}.html"
    }
  }
  </script>
</head>
<body>

  <!-- Header -->
  <header class="site-header">
    <div class="header-inner">
      <a href="../index.html" class="site-logo" aria-label="Breakwater Auto Detailing Home">
        <img src="../logo/breakwater-logo-header.webp" alt="Breakwater Auto Detailing logo" width="160" height="65">
      </a>
      <nav class="main-nav" id="main-nav" aria-label="Main navigation">
        <ul>
          <li><a href="../index.html">Home</a></li>
          <li><a href="../services.html">Services</a></li>
          <li><a href="../gallery.html">Gallery</a></li>
          <li><a href="../about.html">About</a></li>
          <li><a href="../areas.html">Service Areas</a></li>
          <li><a href="../blog.html" class="active">Blog</a></li>
          <li><a href="../contact.html">Contact</a></li>
        </ul>
        <div class="nav-cta">
          <a href="tel:9545548941" class="btn btn-primary btn-block">&#x1F4F1; Call (954) 554-8941</a>
        </div>
      </nav>
      <a href="tel:9545548941" class="btn btn-primary btn-sm header-cta">Call Now</a>
      <button class="nav-toggle" aria-label="Toggle navigation menu" aria-expanded="false" aria-controls="main-nav">
        <span></span>
        <span></span>
        <span></span>
      </button>
    </div>
    <div class="nav-overlay" aria-hidden="true"></div>
  </header>

  <main>

    <!-- Article Hero -->
    <section class="page-hero">
      <div class="page-hero-overlay"></div>
      <div class="container page-hero-content">
        <span class="hero-badge">${post.tag}</span>
        <h1>${post.title}</h1>
      </div>
    </section>

    <!-- Article Content -->
    <section class="section">
      <div class="container">
        <div class="blog-post-wrap">

          <a href="../blog.html" class="blog-back-link">&larr; Back to Blog</a>

          <div class="blog-post-meta">
            <span class="blog-tag">${post.tag}</span>
            <span class="blog-date">${date.display}</span>
            <span class="blog-read-time">&#x23F1; ${post.readTime} min read</span>
          </div>

          <div class="blog-post-body">
            ${post.bodyHtml}
          </div>

        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="cta-section">
      <div class="container">
        <h2>Ready to Protect Your Vehicle?</h2>
        <p>Stop reading about it &mdash; let Breakwater take care of your car today. We come to you anywhere in South Florida.</p>
        <div class="cta-buttons">
          <a href="tel:9545548941" class="btn btn-secondary btn-lg">&#x1F4DE; Call Now</a>
          <a href="sms:9545548941" class="btn btn-secondary btn-lg">&#x1F4AC; Text Us</a>
        </div>
        <p class="cta-phone"><a href="tel:9545548941">(954) 554-8941</a></p>
      </div>
    </section>

  </main>

  <!-- Footer -->
  <footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <img src="../logo/breakwater-logo-header.webp" alt="Breakwater Auto Detailing logo" width="160" height="65" loading="lazy">
          <p>Professional mobile auto detailing serving South Florida. We bring the detail shop to your doorstep.</p>
        </div>
        <div class="footer-section">
          <h4>Quick Links</h4>
          <ul>
            <li><a href="../index.html">Home</a></li>
            <li><a href="../services.html">Services &amp; Pricing</a></li>
            <li><a href="../gallery.html">Gallery</a></li>
            <li><a href="../about.html">About Us</a></li>
            <li><a href="../areas.html">Service Areas</a></li>
            <li><a href="../blog.html">Blog</a></li>
            <li><a href="../contact.html">Contact</a></li>
          </ul>
        </div>
        <div class="footer-section">
          <h4>Services</h4>
          <ul>
            <li><a href="../services.html#basic-wash">Basic Wash</a></li>
            <li><a href="../services.html#express-detail">Express Detail</a></li>
            <li><a href="../services.html#premium-detail">Premium Detail</a></li>
            <li><a href="../services.html#elite-detail">Elite Detail</a></li>
          </ul>
        </div>
        <div class="footer-section">
          <h4>Contact</h4>
          <div class="footer-contact-item">
            &#x1F4F1; <a href="tel:9545548941">(954) 554-8941</a>
          </div>
          <div class="footer-contact-item">
            &#x1F4E7; <a href="mailto:info@breakwaterautodetailing.com">info@breakwaterautodetailing.com</a>
          </div>
          <div class="footer-contact-item">
            &#x1F4CD; Serving Broward, Palm Beach &amp; Miami-Dade
          </div>
          <div class="footer-contact-item">
            <a href="https://www.instagram.com/eastcoast.detail" target="_blank" rel="noopener noreferrer">&#x1F4F8; @eastcoast.detail</a>
          </div>
        </div>
      </div>
      <div class="footer-bottom">
        <p>&copy; ${date.year} Breakwater Auto Detailing. All rights reserved. | Serving South Florida with pride.</p>
      </div>
    </div>
  </footer>

  <!-- Sticky Mobile CTA Bar -->
  <div class="mobile-cta-bar">
    <a href="tel:9545548941">&#x1F4DE; Call Now</a>
    <a href="sms:9545548941">&#x1F4AC; Text Us</a>
  </div>

  <script src="../js/script.js"></script>
</body>
</html>`;
}

// Generate blog card HTML to insert into blog.html
function buildBlogCard(post, date, grad) {
  return `
          <!-- Post: ${date.display} -->
          <article class="blog-card animate-on-scroll">
            <div class="blog-card-thumb">
              <div class="blog-card-thumb-bg ${grad}">${post.emoji}</div>
            </div>
            <div class="blog-card-body">
              <div class="blog-card-meta">
                <span class="blog-tag">${post.tag}</span>
                <span class="blog-date">${date.display}</span>
                <span class="blog-read-time">&#x23F1; ${post.readTime} min read</span>
              </div>
              <h3><a href="blog/${post.slug}.html">${post.title}</a></h3>
              <p class="blog-card-excerpt">${post.excerpt}</p>
              <a href="blog/${post.slug}.html" class="btn btn-outline btn-sm">Read Article &rarr;</a>
            </div>
          </article>`;
}

// Prepend new card into blog.html between the markers
function updateBlogIndex(cardHtml) {
  const blogPath = join(rootDir, 'blog.html');
  let html = readFileSync(blogPath, 'utf8');

  const gridOpenTag = '<div class="blog-grid">';
  if (!html.includes(gridOpenTag)) {
    throw new Error('Could not find <div class="blog-grid"> in blog.html');
  }

  html = html.replace(gridOpenTag, `${gridOpenTag}${cardHtml}`);
  writeFileSync(blogPath, html, 'utf8');
}

// Main
async function main() {
  const date = getDateInfo();
  let post;

  if (NEWS_MODE) {
    console.log('NEWS MODE: Fetching South Florida headlines...');
    const headlines = await fetchSouthFloridaNews();
    console.log('Headlines fetched:\n' + headlines);
    console.log('Calling OpenAI API (news mode)...');
    post = await generateNewsPost(headlines);
    console.log(`News hook: "${post.newsHook}"`);
  } else {
    let nextTopic = topics.find(t => !t.used);
    if (!nextTopic) {
      console.log('All topics used — resetting list and cycling from the beginning.');
      topics.forEach(t => { t.used = false; });
      nextTopic = topics[0];
    }
    console.log(`Topic: "${nextTopic.topic}"`);
    console.log(`Keywords: ${nextTopic.keywords.join(', ')}`);
    console.log('Calling OpenAI API...');
    post = await generatePost(nextTopic.topic, nextTopic.keywords);
    // Mark topic as used
    nextTopic.used = true;
    writeFileSync(topicsPath, JSON.stringify(topics, null, 2), 'utf8');
    console.log('Topic marked as used.');
  }

  console.log(`Title: "${post.title}"`);
  console.log(`Slug: ${post.slug}`);

  // Ensure blog/ directory exists
  const blogDir = join(rootDir, 'blog');
  if (!existsSync(blogDir)) {
    mkdirSync(blogDir, { recursive: true });
  }

  // Write individual post page
  const postFilePath = join(blogDir, `${post.slug}.html`);
  writeFileSync(postFilePath, buildPostPage(post, date), 'utf8');
  console.log(`Created: blog/${post.slug}.html`);

  // Prepend card to blog.html
  updateBlogIndex(buildBlogCard(post, date, gradClass));
  console.log('Updated: blog.html');

  console.log('Done!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
