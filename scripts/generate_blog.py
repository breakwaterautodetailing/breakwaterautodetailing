#!/usr/bin/env python3
"""
Breakwater Auto Detailing — Monthly AI Blog Generator
======================================================
Fetches recent local news from the greater Broward/Miami area,
then uses OpenAI to write a helpful, SEO-optimized blog post
connecting local events/conditions to car detailing value.

Usage:
    python scripts/generate_blog.py

Required environment variables:
    OPENAI_API_KEY   — OpenAI API key (gpt-4o)
    NEWS_API_KEY     — NewsAPI.org API key (free tier works)

Optional:
    DRY_RUN=1        — Generate post content but don't write files
"""

import os
import json
import re
import sys
from datetime import datetime
from pathlib import Path

try:
    import requests
except ImportError:
    sys.exit("Missing dependency: pip install requests openai")

try:
    from openai import OpenAI
except ImportError:
    sys.exit("Missing dependency: pip install openai")


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent
BLOG_DIR = REPO_ROOT / "blog"
POSTS_JSON = BLOG_DIR / "posts.json"
BLOG_INDEX = REPO_ROOT / "blog.html"

GRADIENT_CYCLE = ["grad-1", "grad-2", "grad-3", "grad-4", "grad-5"]

# NewsAPI query targeting Broward / Miami area and vehicle/weather topics
NEWS_QUERY = (
    '(Broward OR Miami OR "Fort Lauderdale" OR "Palm Beach" OR "Hollywood FL" '
    'OR "Coral Springs" OR "Boca Raton" OR "Aventura") AND '
    '(car OR vehicle OR weather OR hurricane OR traffic OR UV OR heat OR flood OR event)'
)


# ---------------------------------------------------------------------------
# Step 1: Fetch local news
# ---------------------------------------------------------------------------

def fetch_local_news(api_key: str) -> str:
    """Return a short digest of recent Broward/Miami-area headlines."""
    url = "https://newsapi.org/v2/everything"
    params = {
        "q": NEWS_QUERY,
        "language": "en",
        "sortBy": "publishedAt",
        "pageSize": 8,
        "apiKey": api_key,
    }
    try:
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        articles = resp.json().get("articles", [])
    except Exception as e:
        print(f"[WARN] NewsAPI request failed: {e}. Proceeding without live news.")
        return "(No live news available — write a general seasonal car care article for South Florida.)"

    if not articles:
        return "(No matching articles found — write a general seasonal car care article for South Florida.)"

    lines = []
    for art in articles[:6]:
        title = art.get("title", "").strip()
        desc = art.get("description", "").strip()
        source = art.get("source", {}).get("name", "")
        if title:
            lines.append(f"- [{source}] {title}: {desc}")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Step 2: Generate blog post via OpenAI
# ---------------------------------------------------------------------------

def generate_post(news_digest: str, month_label: str) -> dict:
    """Call OpenAI to produce structured blog post JSON."""
    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

    system_prompt = (
        "You are a skilled content writer for Breakwater Auto Detailing, "
        "a premium mobile car detailing service in South Florida (Broward County, "
        "Miami-Dade County, Palm Beach County). Your writing is helpful, "
        "informative, and naturally promotes the service without being pushy. "
        "You understand South Florida weather, culture, and car ownership realities."
    )

    user_prompt = f"""Write a monthly blog post for {month_label}.

Recent local news from the greater Broward/Miami area:
{news_digest}

Requirements:
1. Tie at least one news item/topic naturally into the article (weather, events, traffic, season, etc.)
2. Be genuinely helpful to South Florida car owners — practical advice they can act on
3. Cover one or more of these angles depending on what fits the news:
   - UV damage and paint protection in Florida heat
   - Pollen, road salt, construction dust, environmental contaminants
   - Protecting vehicle resale value through regular detailing
   - Hurricane/storm prep for your vehicle
   - Ceramic coating, paint correction, interior protection value
   - Convenience of mobile detailing for busy professionals
   - Seasonal care (rainy season, dry season, summer, winter visitors)
4. Mention Breakwater Auto Detailing naturally as the solution — mobile, comes to you, serves Broward/Miami-Dade/Palm Beach
5. Include a strong but natural CTA at the end (call/text (954) 554-8941)
6. 700–950 words of actual article content
7. SEO-friendly — include natural local keywords (Fort Lauderdale, Broward County, South Florida, Miami, etc.)

Return ONLY valid JSON with these exact keys:
{{
  "title": "Compelling 55–70 character headline",
  "slug": "url-friendly-slug-no-year-suffix",
  "excerpt": "155–170 character meta description / card excerpt",
  "category": "One of: Car Care Tips | Local News | Vehicle Value | Seasonal Guide | Hurricane Prep",
  "read_time": "X min read",
  "icon": "A single relevant emoji",
  "gradient": "One of: grad-1 | grad-2 | grad-3 | grad-4 | grad-5",
  "content_html": "Full article HTML using only: h2, h3, p, ul, ol, li, strong — NO outer wrapper tag"
}}"""

    resp = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.72,
        response_format={"type": "json_object"},
    )

    return json.loads(resp.choices[0].message.content)


# ---------------------------------------------------------------------------
# Step 3: Build individual post HTML file
# ---------------------------------------------------------------------------

POST_HTML_TEMPLATE = """\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} | Breakwater Auto Detailing</title>
  <meta name="description" content="{excerpt}">
  <link rel="canonical" href="https://breakwaterautodetailing.com/blog/{slug}.html">

  <!-- Open Graph -->
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{excerpt}">
  <meta property="og:image" content="../logo/breakwater-og-image.jpg">
  <meta property="og:url" content="https://breakwaterautodetailing.com/blog/{slug}.html">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Breakwater Auto Detailing">
  <meta property="article:published_time" content="{date_iso}">
  <meta property="article:author" content="Breakwater Auto Detailing">
  <meta property="article:section" content="{category}">

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

  <!-- Schema: Article -->
  <script type="application/ld+json">
  {{
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "{title}",
    "description": "{excerpt}",
    "datePublished": "{date_iso}",
    "author": {{
      "@type": "Organization",
      "name": "Breakwater Auto Detailing",
      "url": "https://breakwaterautodetailing.com"
    }},
    "publisher": {{
      "@type": "Organization",
      "name": "Breakwater Auto Detailing",
      "logo": {{
        "@type": "ImageObject",
        "url": "https://breakwaterautodetailing.com/logo/breakwater-logo-header.webp"
      }}
    }},
    "mainEntityOfPage": {{
      "@type": "WebPage",
      "@id": "https://breakwaterautodetailing.com/blog/{slug}.html"
    }}
  }}
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

    <!-- Page Hero -->
    <section class="page-hero">
      <div class="page-hero-overlay"></div>
      <div class="container page-hero-content">
        <span class="hero-badge">{category} &bull; {month_label}</span>
        <h1>{title}</h1>
        <p>{read_time} &bull; By Breakwater Auto Detailing</p>
      </div>
    </section>

    <!-- Article -->
    <section class="section">
      <div class="container">
        <div class="blog-post-wrap">

          <a href="../blog.html" class="blog-back-link">&larr; Back to all articles</a>

          <!-- Post Meta -->
          <div class="blog-post-meta">
            <span class="blog-tag">{category}</span>
            <span class="blog-date">{date_display}</span>
            <span class="blog-read-time">&#x23F1; {read_time}</span>
          </div>

          <!-- Article Body -->
          <div class="blog-post-body">
{content_html}
          </div>

          <!-- Post CTA -->
          <div class="blog-post-cta">
            <h3>Ready to Protect Your Vehicle?</h3>
            <p>Breakwater Auto Detailing comes to you anywhere in Broward County, Miami-Dade County, or Palm Beach County. Call or text for a free, no-pressure quote.</p>
            <div class="section-actions">
              <a href="tel:9545548941" class="btn btn-primary btn-lg">&#x1F4DE; Call (954) 554-8941</a>
              <a href="../services.html" class="btn btn-outline btn-lg">View Services &amp; Pricing</a>
            </div>
          </div>

          <!-- Author Card -->
          <div class="author-card">
            <div class="author-avatar">&#x1F697;</div>
            <div class="author-info">
              <h4>Breakwater Auto Detailing Team</h4>
              <p>Professional mobile detailers serving South Florida. Monthly insights on car care, vehicle protection, and local ownership considerations.</p>
            </div>
          </div>

        </div>
      </div>
    </section>

    <!-- Back to Blog -->
    <section class="section section-alt">
      <div class="container" style="text-align:center;">
        <h2 style="margin-bottom:1rem;">More From the Blog</h2>
        <p style="color:var(--color-gray-500);margin-bottom:1.5rem;">New articles published every month covering South Florida car care, local news, and detailing insights.</p>
        <a href="../blog.html" class="btn btn-primary">&larr; Back to All Articles</a>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="cta-section">
      <div class="container">
        <h2>Get a Free Quote Today</h2>
        <p>Mobile detailing across Broward, Miami-Dade &amp; Palm Beach County. We come to you.</p>
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
            <li><a href="../services.html#add-ons">Ceramic Coating</a></li>
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
        <p>&copy; <span id="current-year">2026</span> Breakwater Auto Detailing. All rights reserved. | Serving South Florida with pride.</p>
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
</html>
"""


def build_post_html(post: dict, date_iso: str, date_display: str, month_label: str) -> str:
    """Render the individual post HTML from the template."""
    # Indent content_html for readability
    content = post["content_html"].strip()
    indented = "\n".join("            " + line if line.strip() else line for line in content.splitlines())

    return POST_HTML_TEMPLATE.format(
        title=post["title"],
        slug=post["slug"],
        excerpt=post["excerpt"],
        category=post["category"],
        read_time=post["read_time"],
        date_iso=date_iso,
        date_display=date_display,
        month_label=month_label,
        content_html=indented,
    )


# ---------------------------------------------------------------------------
# Step 4: Build a blog card HTML snippet for the listing page
# ---------------------------------------------------------------------------

CARD_TEMPLATE = """\
          <article class="blog-card animate-on-scroll">
            <div class="blog-card-thumb">
              <div class="blog-card-thumb-bg {gradient}">{icon}</div>
            </div>
            <div class="blog-card-body">
              <div class="blog-card-meta">
                <span class="blog-tag">{category}</span>
                <span class="blog-date">{date_display}</span>
                <span class="blog-read-time">&#x23F1; {read_time}</span>
              </div>
              <h3><a href="blog/{slug}.html">{title}</a></h3>
              <p class="blog-card-excerpt">{excerpt}</p>
              <a href="blog/{slug}.html" class="btn btn-outline btn-sm">Read Article &rarr;</a>
            </div>
          </article>"""


def render_card(post: dict) -> str:
    return CARD_TEMPLATE.format(**post)


# ---------------------------------------------------------------------------
# Step 5: Regenerate blog.html listing page
# ---------------------------------------------------------------------------

BLOG_START = "    <!-- BLOG_POSTS_START -->"
BLOG_END = "    <!-- BLOG_POSTS_END -->"


def regenerate_blog_index(posts: list) -> None:
    """Replace the post grid section in blog.html with fresh cards."""
    if not BLOG_INDEX.exists():
        print(f"[ERROR] {BLOG_INDEX} not found — cannot regenerate listing.")
        return

    html = BLOG_INDEX.read_text(encoding="utf-8")

    start_idx = html.find(BLOG_START)
    end_idx = html.find(BLOG_END)
    if start_idx == -1 or end_idx == -1:
        print("[WARN] Could not find BLOG_POSTS_START/END markers in blog.html — skipping listing update.")
        return

    # Build the replacement block
    cards = "\n".join(render_card(p) for p in reversed(posts))  # newest first
    new_block = (
        f"{BLOG_START}\n"
        f"    <section class=\"section\">\n"
        f"      <div class=\"container\">\n"
        f"        <div class=\"blog-grid\">\n\n"
        f"{cards}\n\n"
        f"        </div>\n"
        f"      </div>\n"
        f"    </section>\n"
        f"    {BLOG_END}"
    )

    updated = html[: start_idx] + new_block + html[end_idx + len(BLOG_END):]
    BLOG_INDEX.write_text(updated, encoding="utf-8")
    print(f"[OK] Regenerated {BLOG_INDEX}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    dry_run = os.environ.get("DRY_RUN", "").strip() == "1"

    # Validate env vars
    openai_key = os.environ.get("OPENAI_API_KEY", "").strip()
    news_key = os.environ.get("NEWS_API_KEY", "").strip()

    if not openai_key:
        sys.exit("[ERROR] OPENAI_API_KEY environment variable is required.")

    now = datetime.now()
    date_iso = now.strftime("%Y-%m-%d")
    date_display = now.strftime("%B %-d, %Y") if sys.platform != "win32" else now.strftime("%B %d, %Y").replace(" 0", " ")
    month_label = now.strftime("%B %Y")
    year = now.strftime("%Y")
    month = now.strftime("%m")

    print(f"[INFO] Generating blog post for {month_label}...")

    # 1. Fetch news
    print("[INFO] Fetching local news...")
    news_digest = fetch_local_news(news_key) if news_key else "(No NEWS_API_KEY set — writing a general seasonal article.)"
    print(f"[INFO] News digest:\n{news_digest[:400]}...\n")

    # 2. Generate post
    print("[INFO] Calling OpenAI to generate blog post...")
    post = generate_post(news_digest, month_label)
    print(f"[INFO] Generated: '{post['title']}'")

    # Ensure slug has the year-month prefix so it's unique
    slug_base = re.sub(r"[^a-z0-9-]", "", post["slug"].lower().replace(" ", "-"))
    slug = f"{year}-{month}-{slug_base}"
    post["slug"] = slug
    post["date"] = date_iso
    post["date_display"] = date_display
    post["file"] = f"blog/{slug}.html"

    # Pick gradient from cycle based on post count
    posts = json.loads(POSTS_JSON.read_text(encoding="utf-8")) if POSTS_JSON.exists() else []
    post["gradient"] = GRADIENT_CYCLE[len(posts) % len(GRADIENT_CYCLE)]

    if dry_run:
        print("[DRY RUN] Post content:\n")
        print(json.dumps(post, indent=2, ensure_ascii=False))
        return

    # 3. Write individual post HTML
    BLOG_DIR.mkdir(exist_ok=True)
    post_path = BLOG_DIR / f"{slug}.html"
    post_html = build_post_html(post, date_iso, date_display, month_label)
    post_path.write_text(post_html, encoding="utf-8")
    print(f"[OK] Wrote post: {post_path}")

    # 4. Update posts.json
    posts.append({k: v for k, v in post.items() if k != "content_html"})
    POSTS_JSON.write_text(json.dumps(posts, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[OK] Updated {POSTS_JSON} ({len(posts)} total posts)")

    # 5. Regenerate blog.html listing
    regenerate_blog_index(posts)

    print(f"\n[DONE] Blog post published: {post_path.name}")
    print(f"       Title: {post['title']}")
    print(f"       Category: {post['category']}")


if __name__ == "__main__":
    main()
