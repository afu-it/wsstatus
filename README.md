# WSstatus – WhatsApp Status Optimizer

**WSstatus** is an open-source, fully offline-capable Progressive Web App that optimizes images and videos for WhatsApp Status. Get better quality, smaller file sizes, and perfectly formatted media that meets WhatsApp's requirements.

🌐 **Live App:** https://afu-it.github.io/wsstatus/

---

## ✨ Features

- **📸 Image Optimization** - Resize and compress images to WhatsApp's optimal dimensions (1080x1920)
- **🎥 Video Optimization** - Process videos with perfect encoding for WhatsApp Status
- **🔒 100% Private** - All processing happens locally in your browser, no uploads
- **⚡ Offline-First** - Works without internet after first load (PWA)
- **📱 Mobile-Optimized** - Beautiful, thumb-friendly interface for on-the-go editing
- **🎨 Modern UI** - Clean, minimalist design with status-themed branding
- **🚀 Fast Processing** - Powered by FFmpeg.wasm for professional-grade optimization

---

## 🎯 Why Use WSstatus?

WhatsApp aggressively compresses media uploaded to Status. This often results in:
- Blurry, pixelated images
- Choppy videos with artifacts
- Incorrect aspect ratios
- Loss of important details

**WSstatus solves this** by pre-optimizing your media with settings that work perfectly with WhatsApp's compression algorithms, giving you significantly better final quality.

---

## 🚀 Quick Start

### Online (Recommended)
Visit **https://afu-it.github.io/wsstatus/** from any modern browser!

### Install as PWA
1. Visit the website on your phone/desktop
2. Click "Install" button (appears automatically on supported browsers)
3. Use WSstatus like a native app, even offline!

### Local Development
```bash
# Clone the repository
git clone https://github.com/afu-it/wsstatus.git
cd wsstatus

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

---

## 🛠️ Tech Stack

- **React 19** - Modern UI library
- **TypeScript** - Type-safe development
- **Vite 6** - Lightning-fast build tool
- **Tailwind CSS 4** - Utility-first styling
- **FFmpeg.wasm** - Client-side media processing
- **PWA** - Installable, offline-capable Progressive Web App

---

## 📋 How It Works

1. **Upload** - Drag & drop or select your image/video
2. **Analyze** - WSstatus checks dimensions, rotation, and encoding
3. **Optimize** - Smart processing with WhatsApp-optimized settings
4. **Share** - Directly share to WhatsApp or download for later

### Optimization Details

**Images:**
- Resizes to 1080x1920 (portrait) or 1920x1080 (landscape)
- Fixes rotation issues automatically
- High-quality JPEG compression
- Removes unnecessary metadata

**Videos:**
- Adjusts resolution to WhatsApp limits
- Optimizes bitrate and codec settings
- Fixes rotation and aspect ratio
- Maximum 90 seconds duration (WhatsApp limit)

---

## 🔒 Privacy & Security

- ✅ **No server uploads** - Everything processes in your browser
- ✅ **No tracking** - Zero analytics or data collection
- ✅ **No accounts** - No sign-up required
- ✅ **Open source** - Fully auditable code
- ✅ **Offline capable** - Works without internet connection

---

## 📱 Browser Support

| Browser | Support |
|---------|---------|
| Chrome (Android/Desktop) | ✅ Full |
| Edge | ✅ Full |
| Safari (iOS/macOS) | ✅ Full |
| Firefox | ⚠️ Limited (no PWA install) |
| Samsung Internet | ✅ Full |

**Minimum Requirements:**
- Modern browser with ES6+ support
- WebAssembly support
- ~50MB available RAM for video processing

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Report bugs** - Open an issue with details and steps to reproduce
2. **Suggest features** - Share your ideas in the issues section
3. **Submit PRs** - Fork, make changes, and submit a pull request
4. **Improve docs** - Help make the README and guides better

### Development Guidelines
- Follow existing code style (use Prettier)
- Test on mobile devices when possible
- Keep changes focused and well-documented
- Ensure offline functionality remains intact

---

## 📄 License

MIT License - Use freely, modify, distribute!

See [LICENSE](LICENSE) for full details.

---

## 🙏 Acknowledgments

- Built with [FFmpeg.wasm](https://ffmpegwasm.netlify.app/)
- Icons from [Heroicons](https://heroicons.com/)
- Inspired by the need for better WhatsApp media quality

---

## ⚠️ Disclaimer

WSstatus is **not affiliated with WhatsApp or Meta**.

All trademarks belong to their respective owners.

This tool optimizes media for better compatibility with WhatsApp's requirements but does not bypass or interfere with WhatsApp's systems.

---

## 🌟 Star This Project!

If WSstatus helped you, please give it a ⭐ on GitHub!

**Made with ❤️ for better WhatsApp Status quality**
