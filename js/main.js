/* HidroLife — interações e coreografia de scroll */
(() => {
  const WA_NUMBER = "5548999539186";
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const waLink = (msg) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;

  /* ---------- Links de WhatsApp com mensagem pronta ---------- */
  $$("[data-wa]").forEach((a) => { a.href = waLink(a.dataset.wa); });

  /* ---------- Ano no rodapé ---------- */
  $$("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });

  /* ---------- Nav ---------- */
  const nav = $(".nav");
  const waFloat = $(".wa-float");
  const DARK = ".products, .addons-wrap, .quote, .footer, .dive__water";
  const onScroll = () => {
    const y = window.scrollY;
    nav.classList.toggle("is-scrolled", y > 40);
    // Nav fica escura quando passa sobre uma seção escura (inclui a água subindo)
    const under = document.elementsFromPoint(window.innerWidth / 2, nav.offsetHeight / 2)
      .find((el) => !nav.contains(el));
    nav.classList.toggle("is-dark", !!(under && under.closest(DARK)));
    waFloat.classList.toggle("is-on", y > window.innerHeight * 0.6);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Menu mobile ---------- */
  const burger = $(".nav__burger");
  const menu = $("#menu-mobile");
  const setMenu = (open) => {
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    menu.hidden = !open;
    nav.classList.toggle("menu-open", open);
    document.body.style.overflow = open ? "hidden" : "";
  };
  burger.addEventListener("click", () => setMenu(burger.getAttribute("aria-expanded") !== "true"));
  $$("a", menu).forEach((a) => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) setMenu(false); });

  /* ---------- Sem zoom no celular ----------
     Bloqueia pinça (iOS) e toque duplo. O 2º toque rápido continua valendo como clique normal. */
  ["gesturestart", "gesturechange", "gestureend"].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));
  document.addEventListener("touchmove", (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  let lastTouchEnd = 0;
  document.addEventListener("touchend", (e) => {
    const now = Date.now();
    if (now - lastTouchEnd < 350 && e.changedTouches.length === 1) {
      e.preventDefault();
      const el = e.target.closest("a, button, label, summary");
      const field = e.target.closest("input, textarea");
      if (field) field.focus();
      else if (el) el.click();
    }
    lastTouchEnd = now;
  }, { passive: false });

  /* ---------- Logo: volta ao início do site ----------
     (o #topo é o próprio cabeçalho fixo, então o navegador não rolaria sozinho) */
  $$("[data-top]").forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault();
    if (!menu.hidden) setMenu(false);
    carousel.jumpTo(0);
    history.replaceState(null, "", location.pathname + location.search);
  }));

  /* ---------- Carrossel de produtos ----------
     Desktop: a seção fica fixa e o scroll vertical desliza o trilho (modo "pinned", montado mais abaixo com GSAP).
     Celular / movimento reduzido / sem GSAP: o trilho é arrastável com scroll-snap (modo nativo). */
  const products = $(".products");
  const rail = $(".rail");
  const track = $(".rail__track");
  const items = $$(".rail__track > *");
  const slides = $$(".slide");
  const catBtns = $$(".cat-switch__btn");
  const catPill = $(".cat-switch__pill");
  const counter = $("[data-counter]");
  const catLabel = $("[data-catlabel]");
  const bar = $(".progress i");
  const prevBtn = $('[data-step="-1"]');
  const nextBtn = $('[data-step="1"]');
  const CAT_NAMES = { spas: "Spas", banheiras: "Banheiras" };
  const carousel = { pinned: false, tween: null, lenis: null, active: 0, bypass: false, release: null };
  // Rolagem "de passagem" (logo, menu): atravessa a seção dos spas sem a trava do carrossel segurar no meio
  carousel.jumpTo = (target, offset = 0) => {
    carousel.bypass = true;
    if (carousel.release) carousel.release();
    let finished = false;
    const done = () => { if (finished) return; finished = true; carousel.bypass = false; };
    if (carousel.lenis) {
      carousel.lenis.start();
      carousel.lenis.scrollTo(target, { offset, duration: 1.4, force: true, onComplete: done });
      setTimeout(done, 2200);
    } else {
      const y = typeof target === "number" ? target : target.getBoundingClientRect().top + window.scrollY + offset;
      window.scrollTo({ top: y, behavior: reduced ? "auto" : "smooth" });
      setTimeout(done, 1500);
    }
  };

  // Contadores calculados a partir dos cards (adicionar/remover modelo não exige editar números)
  $$("[data-count-cat]").forEach((el) => { el.textContent = slides.filter((sl) => sl.dataset.cat === el.dataset.countCat).length; });
  $$("[data-count-total]").forEach((el) => { el.textContent = String(slides.length).padStart(2, "0"); });

  const movePill = () => {
    const btn = $(".cat-switch__btn.is-active");
    catPill.style.width = `${btn.offsetWidth}px`;
    catPill.style.transform = `translateX(${btn.offsetLeft}px)`;
  };
  const setCat = (cat) => {
    if (products.dataset.cat === cat && catLabel.textContent === CAT_NAMES[cat]) return;
    products.dataset.cat = cat;
    catBtns.forEach((b) => {
      const on = b.dataset.go === cat;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", String(on));
    });
    catLabel.textContent = CAT_NAMES[cat];
    movePill();
  };

  // Item mais perto do centro = ativo; os outros encolhem e escurecem (só no modo fixo)
  const updateCarousel = () => {
    const cx = carousel.pinned ? window.innerWidth / 2 : rail.getBoundingClientRect().left + rail.clientWidth / 2;
    let active = 0, best = Infinity;
    items.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const d = Math.abs(r.left + r.width / 2 - cx);
      if (d < best) { best = d; active = i; }
      if (carousel.pinned) {
        const k = Math.min(d / window.innerWidth, 1);
        if (el.classList.contains("slide")) {
          el.style.transform = `scale(${1 - k * 0.12})`;
          el.style.opacity = String(1 - k * 0.6);
        } else {
          // capítulos somem na proporção em que a borda da tela os corta (nada de texto pela metade)
          const visible = Math.max(0, Math.min(r.right, window.innerWidth) - Math.max(r.left, 0)) / r.width;
          el.style.opacity = String(Math.pow(visible, 3));
        }
      }
    });
    carousel.active = active;
    items.forEach((el, i) => el.classList.toggle("is-active", i === active));
    prevBtn.disabled = active === 0;
    nextBtn.disabled = active === items.length - 1;
    const activeEl = items[active];
    setCat(activeEl.dataset.cat);
    // Contador: o capítulo mostra o primeiro produto que vem depois dele
    const next = items.slice(active).find((el) => el.classList.contains("slide")) || slides[slides.length - 1];
    counter.textContent = String(slides.indexOf(next) + 1).padStart(2, "0");
    const p = carousel.pinned
      ? (carousel.tween ? carousel.tween.progress() : 0)
      : rail.scrollLeft / Math.max(1, rail.scrollWidth - rail.clientWidth);
    bar.style.transform = `scaleX(${p})`;
  };
  rail.addEventListener("scroll", () => { if (!carousel.pinned) updateCarousel(); }, { passive: true });

  // Leva um item do trilho até a posição desejada ("start" = encostado à esquerda, "center" = no meio)
  const goToItem = (el, align = "center") => {
    const pad = parseFloat(getComputedStyle(track).paddingLeft);
    const view = carousel.pinned ? window.innerWidth : rail.clientWidth;
    let x = align === "start" ? el.offsetLeft - pad : el.offsetLeft + el.offsetWidth / 2 - view / 2;
    if (carousel.pinned && carousel.toIndex) {
      carousel.toIndex(items.indexOf(el));
    } else {
      rail.scrollTo({ left: x, behavior: reduced ? "auto" : "smooth" });
      const top = products.getBoundingClientRect().top;
      if (top > window.innerHeight * 0.5 || top < -products.offsetHeight * 0.5) {
        products.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
      }
    }
  };
  const step = (dir) => {
    // no modo fixo usa o destino atual (não onde a animação está), assim cliques rápidos avançam 1 por clique
    const from = carousel.pinned && carousel.getPos ? carousel.getPos() : carousel.active;
    const i = Math.min(Math.max(from + dir, 0), items.length - 1);
    goToItem(items[i], i === 0 ? "start" : "center");
  };
  $$("[data-go]").forEach((el) => el.addEventListener("click", (e) => {
    e.preventDefault();
    goToItem($(`[data-chapter="${el.dataset.go}"]`), "start");
  }));
  $$("[data-step]").forEach((b) => b.addEventListener("click", () => step(+b.dataset.step)));

  // Teclado no trilho: setas passam de item em item
  rail.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    step(e.key === "ArrowRight" ? 1 : -1);
  });

  // Arrastar com o mouse (modo nativo, desktop)
  let drag = null;
  rail.addEventListener("pointerdown", (e) => {
    if (carousel.pinned || e.pointerType !== "mouse" || e.button !== 0) return;
    drag = { x: e.clientX, left: rail.scrollLeft, moved: false };
  });
  window.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 5) { drag.moved = true; rail.classList.add("is-dragging"); }
    if (drag.moved) rail.scrollLeft = drag.left - dx;
  });
  window.addEventListener("pointerup", () => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    rail.classList.remove("is-dragging");
    if (moved) {
      // não deixa o arraste virar clique num botão de orçamento
      rail.addEventListener("click", (ev) => { ev.preventDefault(); ev.stopPropagation(); }, { capture: true, once: true });
      goToItem(items[carousel.active]);
    }
  });

  movePill();
  updateCarousel();
  window.addEventListener("resize", () => { movePill(); updateCarousel(); });
  document.fonts && document.fonts.ready.then(movePill);

  /* ---------- Feedbacks do WhatsApp: carrossel manual (só anda pelas setas ou arrastando) ---------- */
  const shotsEl = $(".shots");
  const shotItems = $$(".shot");
  const shotIndexEl = $("[data-shot-index]");
  const shotPrev = $('[data-shots="-1"]');
  const shotNext = $('[data-shots="1"]');
  $("[data-shot-total]").textContent = shotItems.length;
  const shotPad = () => parseFloat(getComputedStyle(shotsEl).paddingLeft);
  const currentShot = () => {
    const x = shotsEl.scrollLeft;
    let best = 0;
    shotItems.forEach((el, i) => { if (Math.abs(el.offsetLeft - shotPad() - x) < Math.abs(shotItems[best].offsetLeft - shotPad() - x)) best = i; });
    return best;
  };
  const updateShots = () => {
    const max = shotsEl.scrollWidth - shotsEl.clientWidth;
    shotIndexEl.textContent = currentShot() + 1;
    shotPrev.disabled = shotsEl.scrollLeft <= 2;
    shotNext.disabled = shotsEl.scrollLeft >= max - 2;
  };
  const goShot = (i) => {
    const el = shotItems[Math.min(Math.max(i, 0), shotItems.length - 1)];
    shotsEl.scrollTo({ left: el.offsetLeft - shotPad(), behavior: reduced ? "auto" : "smooth" });
  };
  $$("[data-shots]").forEach((b) => b.addEventListener("click", () => goShot(currentShot() + +b.dataset.shots)));
  shotsEl.addEventListener("scroll", updateShots, { passive: true });
  window.addEventListener("resize", updateShots);
  updateShots();

  // Visualizador ampliado
  const lb = $(".lightbox");
  const lbImg = $(".lightbox__img");
  let lbIndex = 0;
  const showLb = (i) => {
    lbIndex = Math.min(Math.max(i, 0), shotItems.length - 1);
    const img = $("img", shotItems[lbIndex]);
    lbImg.src = img.src; lbImg.alt = img.alt;
    $('[data-lb="-1"]').disabled = lbIndex === 0;
    $('[data-lb="1"]').disabled = lbIndex === shotItems.length - 1;
  };
  $$("[data-shot]").forEach((b) => b.addEventListener("click", () => {
    showLb(+b.dataset.shot - 1);
    lb.showModal();
    if (typeof carousel !== "undefined" && carousel.lenis) carousel.lenis.stop();
  }));
  $$("[data-lb]").forEach((b) => b.addEventListener("click", () => showLb(lbIndex + +b.dataset.lb)));
  $(".lightbox__close").addEventListener("click", () => lb.close());
  lb.addEventListener("click", (e) => { if (e.target === lb) lb.close(); });
  lb.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") showLb(lbIndex + 1);
    if (e.key === "ArrowLeft") showLb(lbIndex - 1);
  });
  lb.addEventListener("close", () => {
    goShot(lbIndex);
    if (typeof carousel !== "undefined" && carousel.lenis) carousel.lenis.start();
  });

  /* ---------- Vídeo do topo: garante o play (alguns celulares bloqueiam autoplay até o usuário tocar) ---------- */
  const heroVideo = $(".tub-frame__media");
  if (heroVideo) {
    const tryPlay = () => heroVideo.play().catch(() => {});
    tryPlay();
    ["touchstart", "click", "scroll"].forEach((ev) => window.addEventListener(ev, tryPlay, { once: true, passive: true }));
    // pausa quando sai da tela (economiza bateria/CPU no celular)
    new IntersectionObserver(([e]) => (e.isIntersecting ? tryPlay() : heroVideo.pause())).observe(heroVideo);
  }

  /* ---------- Formulário → WhatsApp ---------- */
  const form = $("#form-orcamento");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let ok = true;
    ["nome", "cidade"].forEach((name) => {
      const input = form.elements[name];
      const field = input.closest(".field");
      const bad = !input.value.trim();
      field.classList.toggle("is-invalid", bad);
      input.setAttribute("aria-invalid", String(bad));
      input.setAttribute("aria-describedby", `e-${name}`);
      if (bad && ok) { input.focus(); ok = false; }
    });
    if (!ok) return;
    const d = new FormData(form);
    let msg = `Olá, HidroLife! Meu nome é ${d.get("nome").trim()}, sou de ${d.get("cidade").trim().replace(/\s*[\/-]?\s*SC$/i, "")}/SC e ${d.get("interesse") === "ajuda para escolher" ? "preciso de ajuda para escolher entre spa e banheira" : `tenho interesse em ${d.get("interesse")}`}.`;
    const extra = (d.get("mensagem") || "").trim();
    if (extra) msg += ` ${extra}`;
    msg += " Pode me enviar um orçamento?";
    window.open(waLink(msg), "_blank", "noopener");
  });
  $$("input", form).forEach((i) => i.addEventListener("input", () => {
    if (i.value.trim()) { i.closest(".field").classList.remove("is-invalid"); i.removeAttribute("aria-invalid"); }
  }));

  /* ---------- Movimento ---------- */
  const dive = $(".dive");
  if (!window.gsap || !window.ScrollTrigger) {
    // CDN falhou: mostra tudo no estado final
    $(".dive__after").style.opacity = 1;
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  // No celular a barra de endereço some/aparece ao rolar; sem isso a seção fixa "pula"
  ScrollTrigger.config({ ignoreMobileResize: true });


  // Números contando
  $$("[data-count]").forEach((el) => {
    const end = +el.dataset.count;
    const fmt = (n) => (el.dataset.sep ? n.toLocaleString("pt-BR") : String(n));
    if (reduced) { el.textContent = fmt(end); return; }
    const o = { v: 0 };
    gsap.to(o, {
      v: end, duration: end > 100 ? 2.2 : 1.4, ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 85%", once: true },
      onUpdate: () => (el.textContent = fmt(Math.round(o.v))),
    });
  });

  /* PRODUTOS — a seção fixa e o scroll vertical vira movimento horizontal (desktop e celular: a pessoa passa por todos os modelos antes de seguir).
     Vale mesmo com "reduzir movimento": o trilho só anda quando a pessoa rola, não há animação automática. */
  gsap.matchMedia().add("all", () => {
    const dist = () => track.scrollWidth - window.innerWidth;
    products.classList.add("is-pinned");
    $(".chapter__hint b").textContent = "Role para explorar";
    rail.scrollLeft = 0;
    carousel.pinned = true;
    carousel.tween = gsap.to(track, {
      x: () => -dist(), ease: "none",
      onUpdate: updateCarousel,
      scrollTrigger: {
        trigger: products, start: "top top", end: () => `+=${dist()}`,
        pin: true, scrub: 0.7, invalidateOnRefresh: true, anticipatePin: 1,
        onRefresh: updateCarousel,
        onToggle: (self) => { if (carousel.toIndex) (self.isActive ? enterPin() : exitPin()); },
      },
    });

    /* Um modelo por gesto: dentro da seção, cada deslizada do dedo (ou giro da roda do mouse)
       avança exatamente 1 item e pausa nele — mesmo um arrasto rápido não passa vários de uma vez.
       Depois do último (ou antes do primeiro), o próximo gesto libera a página. */
    const st = () => carousel.tween.scrollTrigger;
    const yForIndex = (i) => {
      const el = items[i], d = dist();
      let x = i === 0 ? 0 : el.offsetLeft + el.offsetWidth / 2 - window.innerWidth / 2;
      x = Math.min(Math.max(x, 0), d);
      // sempre 1px para dentro da seção: na borda exata o ScrollTrigger considera "fora" e a trava piscava
      return Math.min(Math.max(st().start + (x / d) * (st().end - st().start), st().start + 2), st().end - 2);
    };
    const nearestIndex = () => {
      let best = 0;
      items.forEach((_, i) => { if (Math.abs(yForIndex(i) - window.scrollY) < Math.abs(yForIndex(best) - window.scrollY)) best = i; });
      return best;
    };
    let pos = 0, busy = false, locked = false;
    const scrollToY = (y, dur, done) => {
      if (carousel.lenis) carousel.lenis.scrollTo(y, { duration: dur, force: true, lock: true, onComplete: done });
      else {
        const o = { y: window.scrollY };
        gsap.to(o, { y, duration: dur, ease: "power2.inOut", overwrite: true, onUpdate: () => window.scrollTo(0, o.y), onComplete: done });
      }
    };
    const DUR = reduced ? 0.35 : 0.75;
    const toIndex = (i) => {
      pos = Math.min(Math.max(i, 0), items.length - 1);
      busy = true;
      scrollToY(yForIndex(pos), DUR, () => gsap.delayedCall(0.35, () => { busy = false; }));
    };
    const leave = (dir) => {
      busy = true;
      exitPin();
      const y = dir > 0 ? st().end + window.innerHeight * 0.6 : st().start - window.innerHeight * 0.6;
      scrollToY(Math.max(0, y), 0.9, () => { busy = false; });
    };
    const go = (dir) => {
      if (busy) return;
      const next = pos + dir;
      if (next < 0 || next >= items.length) leave(dir);
      else toIndex(next);
    };
    const intent = ScrollTrigger.observe({
      type: "wheel,touch", wheelSpeed: -1, tolerance: 14, preventDefault: true,
      onUp: () => go(1), onDown: () => go(-1),
    });
    intent.disable();
    function enterPin() {
      if (locked || carousel.bypass) return;
      locked = true;
      if (!busy) pos = nearestIndex();
      intent.enable();
      if (carousel.lenis) carousel.lenis.stop();
    }
    function exitPin() {
      if (!locked) return;
      locked = false;
      intent.disable();
      if (carousel.lenis) carousel.lenis.start();
    }
    // Segura a posição enquanto a seção está travada (corta o "embalo" de um arrasto forte no celular)
    const hold = () => { if (locked && !busy && !carousel.bypass) window.scrollTo(0, yForIndex(pos)); };
    window.addEventListener("scroll", hold, { passive: true });
    carousel.toIndex = toIndex;
    carousel.getPos = () => pos;
    carousel.release = exitPin;
    if (carousel.tween.scrollTrigger.isActive) enterPin();
    updateCarousel();
    // Ao sair do desktop: volta ao trilho arrastável
    return () => {
      products.classList.remove("is-pinned");
      $(".chapter__hint b").textContent = "Arraste para o lado";
      exitPin();
      window.removeEventListener("scroll", hold);
      intent.kill();
      carousel.toIndex = null;
      carousel.getPos = null;
      carousel.release = null;
      carousel.pinned = false;
      carousel.tween = null;
      items.forEach((s) => { s.style.transform = ""; s.style.opacity = ""; });
      updateCarousel();
    };
  });
  /* COMO FUNCIONA — cada etapa "acende" quando chega a vez dela; o cano/linha se enche com o scroll.
     Roda mesmo com "reduzir movimento": é só um destaque ligado à posição da rolagem. */
  const desktopSteps = () => window.matchMedia("(min-width: 1081px)").matches;
  $$(".step").forEach((li, i) => {
    ScrollTrigger.create({
      trigger: li,
      start: () => (desktopSteps() ? `top+=${i * 60} 72%` : "top 72%"),
      onEnter: () => li.classList.add("is-on"),
      onLeaveBack: () => li.classList.remove("is-on"),
      invalidateOnRefresh: true,
    });
  });
  const pipe = $(".steps__pipe path");
  if (pipe) {
    const len = pipe.getTotalLength();
    gsap.set(pipe, { strokeDasharray: len, strokeDashoffset: len });
    gsap.to(pipe, {
      strokeDashoffset: 0, ease: "none",
      scrollTrigger: { trigger: ".steps__wrap", start: "top 75%", end: "bottom 55%", scrub: 0.6 },
    });
  }
  gsap.to(".steps__line i", {
    scaleY: 1, ease: "none",
    scrollTrigger: { trigger: ".steps__list", start: "top 72%", end: "bottom 72%", scrub: 0.4 },
  });

  if (reduced) {
    return;
  }

  // Scroll suave
  if (window.Lenis) {
    const lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    carousel.lenis = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    $$('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length < 2 || a.hasAttribute("data-go") || a.hasAttribute("data-top")) return;
      const target = $(id);
      if (!target) return;
      e.preventDefault();
      carousel.jumpTo(target, -70);
    }));
  }

  /* HERO — parallax leve na foto */
  gsap.to(".tub-frame__media", {
    yPercent: -10, ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
  });

  /* MARCAS — logos entram em sequência */
  gsap.from(".brands__head > *", {
    y: 24, opacity: 0, duration: 0.8, stagger: 0.1, ease: "power3.out",
    scrollTrigger: { trigger: ".brands", start: "top 85%" },
  });
  gsap.from(".brand", {
    y: 40, opacity: 0, scale: 0.94, duration: 0.9, stagger: 0.1, ease: "power3.out",
    scrollTrigger: { trigger: ".brands__list", start: "top 88%" },
  });


  /* MERGULHO — seção fixa: a água sobe e engole a palavra */
  const water = $(".dive__water");
  const waterInner = $(".dive__inner");
  const surface = $(".dive__surface");
  const stage = $(".dive__stage");
  const diveTl = gsap.timeline({
    scrollTrigger: { trigger: dive, start: "top top", end: "bottom bottom", scrub: 0.8, invalidateOnRefresh: true },
  });
  diveTl
    .fromTo(water, { yPercent: 100 }, { yPercent: 0, ease: "power1.inOut", duration: 0.68 })
    .fromTo(waterInner, { yPercent: -100 }, { yPercent: 0, ease: "power1.inOut", duration: 0.68 }, 0)
    .fromTo(surface, { y: () => stage.clientHeight - 69 }, { y: -69, ease: "power1.inOut", duration: 0.68 }, 0)
    .fromTo(".dive__dry .dive__word", { y: 0 }, { y: -30, ease: "none", duration: 0.68 }, 0)
    .fromTo(".dive__wet .dive__word", { y: 0 }, { y: -30, ease: "none", duration: 0.68 }, 0)
    .to([".dive__wet .dive__word", ".dive__wet .dive__kicker"], { y: "-=60", opacity: 0.18, duration: 0.2, ease: "power2.in" }, 0.72)
    .fromTo(".dive__after", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.2, ease: "power2.out" }, 0.78);

  /* Cabeçalhos de seção — label → título → texto */
  $$(".section-head").forEach((head) => {
    gsap.from(head.children, {
      y: 36, opacity: 0, duration: 0.9, stagger: 0.1, ease: "power3.out",
      scrollTrigger: { trigger: head, start: "top 82%" },
    });
  });

  gsap.from(".products__top > *", {
    y: 30, opacity: 0, duration: 0.9, stagger: 0.1, ease: "power3.out",
    scrollTrigger: { trigger: products, start: "top 80%" },
  });

  gsap.from(".addons__title, .addons__list li", {
    x: -40, opacity: 0, duration: 0.8, stagger: 0.1, ease: "power3.out",
    scrollTrigger: { trigger: ".addons", start: "top 85%" },
  });

  /* POR QUE — foto abre de baixo pra cima + lista desliza da direita */
  gsap.fromTo(".why__visual", { clipPath: "inset(100% 0% 0% 0%)" }, {
    clipPath: "inset(0% 0% 0% 0%)", duration: 1.4, ease: "power4.out",
    scrollTrigger: { trigger: ".why", start: "top 75%" },
  });
  gsap.fromTo(".why__visual img", { yPercent: -8 }, {
    yPercent: -16, ease: "none",
    scrollTrigger: { trigger: ".why", start: "top bottom", end: "bottom top", scrub: true },
  });
  gsap.from(".why__copy > .eyebrow, .why__copy > .h2", {
    y: 30, opacity: 0, duration: 0.9, stagger: 0.1, ease: "power3.out",
    scrollTrigger: { trigger: ".why__copy", start: "top 80%" },
  });
  gsap.from(".why__list li", {
    x: 60, opacity: 0, duration: 0.8, stagger: 0.12, ease: "power3.out",
    scrollTrigger: { trigger: ".why__list", start: "top 85%" },
  });

  /* NÚMEROS — escala */
  gsap.from(".stat", {
    scale: 0.9, opacity: 0, duration: 0.8, stagger: 0.08, ease: "back.out(1.4)",
    scrollTrigger: { trigger: ".stats", start: "top 85%" },
  });

  /* COMO FUNCIONA — entrada dos cards (o destaque e a linha ficam no bloco que roda sempre, mais acima) */
  gsap.from(".step", {
    y: 50, opacity: 0, duration: 0.9, stagger: 0.12, ease: "power3.out",
    scrollTrigger: { trigger: ".steps__list", start: "top 82%" },
  });

  /* FEEDBACKS — prints entram em sequência */
  gsap.from(".shot", {
    y: 60, opacity: 0, duration: 0.9, stagger: 0.08, ease: "power3.out",
    scrollTrigger: { trigger: ".shots", start: "top 85%" },
  });

  /* FAQ — perguntas entram pela direita */
  gsap.from(".faq__list details", {
    x: 40, opacity: 0, duration: 0.7, stagger: 0.06, ease: "power3.out",
    scrollTrigger: { trigger: ".faq__list", start: "top 85%" },
  });

  /* ORÇAMENTO — fundo em parallax, título e formulário */
  gsap.to(".quote__bg", {
    yPercent: 8, ease: "none",
    scrollTrigger: { trigger: ".quote", start: "top bottom", end: "bottom top", scrub: true },
  });
  gsap.from(".quote__copy > *", {
    y: 40, opacity: 0, duration: 0.9, stagger: 0.1, ease: "power3.out",
    scrollTrigger: { trigger: ".quote", start: "top 70%" },
  });
  gsap.from(".form", {
    y: 60, opacity: 0, scale: 0.97, duration: 1.1, ease: "power3.out",
    scrollTrigger: { trigger: ".quote", start: "top 65%" },
  });

  // Recalcula depois que fontes e imagens carregam
  const refresh = () => ScrollTrigger.refresh();
  document.fonts && document.fonts.ready.then(refresh);
  window.addEventListener("load", refresh);
})();
