# WAMO – WhatsApp Media Optimizer

**WAMO (WhatsApp Media Optimizer)** is an open-source, fully offline-capable Progressive Web App that pre-processes images and videos so they survive WhatsApp Status compression with significantly better perceived quality.

This project does **not** bypass WhatsApp compression. That fantasy belongs in sci‑fi. Instead, WAMO conditions media *before upload* so WhatsApp’s inevitable recompression produces cleaner, sharper, and more stable results.

---

## One-Line Description

A deterministic, offline-first PWA that optimizes media to look better *after* WhatsApp recompression.

---

## Core Problem

WhatsApp aggressively re-encodes media uploaded to Status. This process:

* Reduces bitrate unpredictably
* Alters resolution and aspect ratio
* Introduces blur, banding, and artifacts
* Sometimes rotates or rescales videos depending on metadata

Naively uploading “high quality” media usually makes things worse.

WAMO exists to counteract this by **pre-conditioning** media so WhatsApp’s compression pipeline works *in our favor*.

---

## Primary Goal

Generate **deterministic, WhatsApp-optimized media** that looks significantly better *after* WhatsApp compression compared to naive uploads.

---

## What WAMO Does

* Analyzes patterns from original vs WhatsApp-compressed media
* Applies a reverse-engineered preprocessing pipeline
* Normalizes resolution, aspect ratio, rotation, and encoding hints
* Produces media designed to be recompressed cleanly by WhatsApp
* Works **entirely offline** in the browser

---

## What WAMO Explicitly Does NOT Do

These are intentionally out of scope:

* Prevent WhatsApp recompression
* Upload media directly to WhatsApp
* Use cloud processing or servers
* Store user media remotely
* Include social features, accounts, or analytics

If you’re looking for any of the above, this is the wrong repo.

---

## Design Principles

* **Offline-first** – No servers, no uploads, no tracking
* **Deterministic output** – Same input always yields the same result
* **Pattern-based optimization** – Based on real WhatsApp compression behavior
* **Minimal perceptual loss** – Optimize for what humans actually see
* **Transparency** – No magic, no black boxes

---

## Current Status

* Core optimization algorithm implemented
* Tested against multiple real-world videos
* Successfully handles most rotation, scaling, and compression edge cases
* Ongoing refinement for rare metadata-induced failures

This project is actively evolving.

---

## Tech Stack

* Progressive Web App (PWA)
* Client-side video and image processing
* No backend, no database
* Open standards only

---

## Why Open Source

WhatsApp compression affects millions of people daily.

This project is open source so:

* Compression behavior can be studied openly
* Improvements can be verified and reproduced
* The algorithm can be audited and refined
* No one has to trust a closed tool with their media

---

## Contributing

Contributions are welcome, especially:

* Compression pattern analysis
* Edge-case media samples
* Algorithm refinements
* Bug reports with metadata

Please keep changes focused and justified. Random tweaks without evidence will be rejected.

---

## Disclaimer

WAMO is **not affiliated with WhatsApp or Meta**.

All trademarks belong to their respective owners.

This tool works *with* WhatsApp’s compression behavior, not against it.

---

## License

MIT License

Use it. Study it. Improve it.
