// Knowbooks Media player.
//
// Bandwidth design:
//  - Each card shows a small card image that the browser loads lazily
//    (native <img loading="lazy">).
//  - Nothing downloads on page load. A shared <video> for video appearances
//    and a shared <audio> for audio appearances live in a <dialog> and only
//    get a src when you press play (preload="none" + src set on demand), so
//    you only ever fetch the appearance you actually watch or listen to.
//  - Closing the dialog drops the src, which aborts any in-flight fetch.

(function () {
  "use strict"

  const gallery = document.getElementById("kb-gallery")
  if (!gallery) return

  const dialog = document.getElementById("kb-dialog")
  const video = document.getElementById("kb-player")
  const audio = document.getElementById("kb-audio-el")
  const audioArt = document.getElementById("kb-audio-art")
  const audioWrap = document.getElementById("kb-audio")
  const dialogTitle = document.getElementById("kb-dialog-title")
  const download = document.getElementById("kb-download")
  const sourceLink = document.getElementById("kb-source")
  const sortButton = document.getElementById("kb-sort")
  const countLabel = document.getElementById("kb-count")

  const cards = Array.from(gallery.querySelectorAll(".kb-card"))
  if (countLabel) {
    countLabel.textContent = cards.length + (cards.length === 1 ? " appearance" : " appearances")
  }

  // Newest first by default; chronological is one click away.
  let ascending = false

  function renderSortLabel() {
    if (!sortButton) return
    sortButton.textContent = ascending ? "Oldest first" : "Newest first"
    sortButton.setAttribute("aria-label", "Sort by date: " + sortButton.textContent)
  }

  // Current display order + which card is showing, so arrows can cycle.
  let order = cards.slice()
  let currentIndex = 0

  function sortCards() {
    order = cards.slice().sort((a, b) => {
      const cmp = String(a.dataset.date).localeCompare(String(b.dataset.date))
      return ascending ? cmp : -cmp
    })
    const fragment = document.createDocumentFragment()
    order.forEach((card) => fragment.appendChild(card))
    gallery.appendChild(fragment)
  }

  // Audio appearances get the audio element; everything else gets the video
  // element. `kind` is explicit in the data, with the file extension as a
  // fallback for entries that predate it.
  function isAudio(card) {
    const kind = card.dataset.kind
    if (kind === "video") return false
    if (kind === "audio") return true
    return /\.(m4a|mp3|aac|wav|ogg)$/i.test(card.dataset.src || "")
  }

  function stopVideo() {
    if (!video) return
    video.pause()
    video.removeAttribute("src")
    video.load()
  }

  function stopAudio() {
    if (!audio) return
    audio.pause()
    audio.removeAttribute("src")
    audio.load()
  }

  function loadCard(card) {
    if (!card) return
    currentIndex = order.indexOf(card)
    const src = card.dataset.src || ""
    const url = card.dataset.url || ""

    dialogTitle.textContent = card.dataset.title || ""

    if (isAudio(card)) {
      stopVideo()
      if (video) video.hidden = true
      if (audioWrap) audioWrap.hidden = false
      if (audioArt) {
        audioArt.src = card.dataset.poster || ""
        audioArt.alt = card.dataset.title || ""
      }
      if (audio) {
        if (src) audio.src = src
        else audio.removeAttribute("src")
      }
      const attempt = audio && src && audio.play()
      if (attempt && typeof attempt.catch === "function") attempt.catch(() => {})
    } else {
      stopAudio()
      if (audioWrap) audioWrap.hidden = true
      if (video) {
        video.hidden = false
        video.poster = card.dataset.poster || ""
        if (src) video.src = src
        else video.removeAttribute("src")
      }
      const attempt = video && src && video.play()
      if (attempt && typeof attempt.catch === "function") attempt.catch(() => {})
    }

    if (sourceLink) {
      sourceLink.href = url || "#"
      sourceLink.hidden = !url
    }
    if (download) {
      if (src) {
        download.href = src
        download.setAttribute("download", src)
        download.hidden = false
      } else {
        download.hidden = true
      }
    }
  }

  // Move by delta (+1 next, -1 previous), wrapping around the ends.
  function step(delta) {
    if (!order.length) return
    currentIndex = (currentIndex + delta + order.length) % order.length
    loadCard(order[currentIndex])
  }

  function openPlayer(card) {
    loadCard(card)
    if (!dialog.open) {
      if (typeof dialog.showModal === "function") {
        dialog.showModal()
      } else {
        dialog.setAttribute("open", "")
      }
    }
  }

  // A card with a local recording opens the player; a link-only appearance
  // opens the original in a new tab.
  function activate(card) {
    if (!card.dataset.src && card.dataset.url) {
      window.open(card.dataset.url, "_blank", "noopener")
      return
    }
    openPlayer(card)
  }

  function stopPlayback() {
    stopVideo()
    stopAudio()
  }

  function closePlayer() {
    stopPlayback()
    if (dialog.open) dialog.close()
  }

  gallery.addEventListener("click", (event) => {
    const card = event.target.closest(".kb-card")
    if (card) activate(card)
  })

  const closeButton = document.getElementById("kb-close")
  if (closeButton) closeButton.addEventListener("click", closePlayer)

  // Both the header arrows (desktop) and the large on-media arrows (touch)
  // cycle through appearances.
  const prevButton = document.getElementById("kb-prev")
  const nextButton = document.getElementById("kb-next")
  const prevOverlay = document.getElementById("kb-prev-overlay")
  const nextOverlay = document.getElementById("kb-next-overlay")
  if (prevButton) prevButton.addEventListener("click", () => step(-1))
  if (nextButton) nextButton.addEventListener("click", () => step(1))
  if (prevOverlay) prevOverlay.addEventListener("click", () => step(-1))
  if (nextOverlay) nextOverlay.addEventListener("click", () => step(1))

  // Left/right arrow keys cycle through appearances while the player is open.
  document.addEventListener("keydown", (event) => {
    if (!dialog.open) return
    if (event.key === "ArrowRight") {
      event.preventDefault()
      step(1)
    } else if (event.key === "ArrowLeft") {
      event.preventDefault()
      step(-1)
    }
  })

  // Clicking the dark area around the dialog closes it.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closePlayer()
  })

  // Fires for Esc too, so make sure the network fetch is dropped either way.
  dialog.addEventListener("close", stopPlayback)

  if (sortButton) {
    sortButton.addEventListener("click", () => {
      ascending = !ascending
      renderSortLabel()
      sortCards()
    })
  }

  renderSortLabel()
  sortCards()
})()
