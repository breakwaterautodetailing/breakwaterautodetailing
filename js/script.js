/* ============================================
   Breakwater Auto Detailing - Main JavaScript
   Progressive enhancement — site works without JS
   ============================================ */

(function () {
  'use strict';

  /* --- Mobile Navigation --- */
  const navToggle = document.querySelector('.nav-toggle');
  const mainNav = document.querySelector('.main-nav');
  const navOverlay = document.querySelector('.nav-overlay');
  const navLinks = document.querySelectorAll('.main-nav a');

  function openNav() {
    if (!navToggle || !mainNav) return;
    navToggle.classList.add('active');
    mainNav.classList.add('open');
    if (navOverlay) navOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    navToggle.setAttribute('aria-expanded', 'true');
  }

  function closeNav() {
    if (!navToggle || !mainNav) return;
    navToggle.classList.remove('active');
    mainNav.classList.remove('open');
    if (navOverlay) navOverlay.classList.remove('active');
    document.body.style.overflow = '';
    navToggle.setAttribute('aria-expanded', 'false');
  }

  if (navToggle) {
    navToggle.addEventListener('click', function () {
      if (mainNav.classList.contains('open')) {
        closeNav();
      } else {
        openNav();
      }
    });
  }

  if (navOverlay) {
    navOverlay.addEventListener('click', closeNav);
  }

  navLinks.forEach(function (link) {
    link.addEventListener('click', closeNav);
  });

  // Close nav on Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && mainNav && mainNav.classList.contains('open')) {
      closeNav();
    }
  });

  /* --- FAQ Accordion --- */
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(function (item) {
    const question = item.querySelector('.faq-question');
    if (!question) return;

    question.addEventListener('click', function () {
      const isActive = item.classList.contains('active');

      // Close all other FAQ items
      faqItems.forEach(function (other) {
        other.classList.remove('active');
        var otherBtn = other.querySelector('.faq-question');
        if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
      });

      // Toggle current
      if (!isActive) {
        item.classList.add('active');
        question.setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* --- Smooth Scroll for Anchor Links --- */
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var targetId = this.getAttribute('href');
      if (targetId === '#') return;

      var target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        var headerHeight = document.querySelector('.site-header')
          ? document.querySelector('.site-header').offsetHeight
          : 0;
        var targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerHeight - 20;

        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });

  /* --- Header Background on Scroll --- */
  var header = document.querySelector('.site-header');
  if (header) {
    function updateHeader() {
      if (window.scrollY > 50) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }
    window.addEventListener('scroll', updateHeader, { passive: true });
    updateHeader();
  }

  /* --- Active Nav Link Highlight --- */
  var currentPage = window.location.pathname.split('/').pop() || 'index.html';
  navLinks.forEach(function (link) {
    var href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });

  /* --- Intersection Observer for Fade-In Animations --- */
  if ('IntersectionObserver' in window) {
    var animateElements = document.querySelectorAll('.animate-on-scroll');

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('fade-in-up');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
      }
    );

    animateElements.forEach(function (el) {
      observer.observe(el);
    });
  }

  /* --- Contact Form Handling --- */
  var contactForm = document.querySelector('#contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      // If using Formspree or Netlify Forms, let native form submit work
      // This handler is for basic validation and UX feedback
      var requiredFields = contactForm.querySelectorAll('[required]');
      var isValid = true;

      requiredFields.forEach(function (field) {
        if (!field.value.trim()) {
          isValid = false;
          field.style.borderColor = '#ef4444';
        } else {
          field.style.borderColor = '';
        }
      });

      if (!isValid) {
        e.preventDefault();
        return;
      }

      // Show submitting state
      var submitBtn = contactForm.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.textContent = 'Sending...';
        submitBtn.disabled = true;
      }
    });
  }

  /* --- Lazy Loading Fallback (for browsers without native lazy) --- */
  if (!('loading' in HTMLImageElement.prototype)) {
    // Simple fallback: load all images immediately
    document.querySelectorAll('img[loading="lazy"]').forEach(function (img) {
      if (img.dataset.src) {
        img.src = img.dataset.src;
      }
    });
  }

  /* --- Year in Footer --- */
  var yearEl = document.querySelector('#current-year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

})();
