# Imagist: A Minimalist Web-Based Image Editor

![Imagist Screenshot](placeholder_screenshot.png) **Imagist** is a lightweight, client-side image editing tool built with HTML, CSS (Tailwind CSS and custom styles), and vanilla JavaScript. It offers a clean, modern, and intuitive interface, inspired by Apple's design aesthetic, allowing users to perform common image manipulation tasks directly in their browser.

**Live Demo:** [Link to your GitHub Pages site once deployed - e.g., `https://YourUsername.github.io/your-repository-name/`]

## Key Features:

* **Upload & Preview:** Easily upload images (JPG, PNG, WEBP) via a file chooser or drag-and-drop. Images are previewed on an HTML5 canvas.
* **Cropping:** Interactive cropping tool powered by Cropper.js, with options for freeform cropping and preset aspect ratios (1:1, 16:9, 4:3, 2:3).
* **Transformations:**
    * Rotate images 90 degrees left or right.
    * Flip images horizontally or vertically.
* **Filters:**
    * Apply common filters: Grayscale, Sepia, Invert.
    * Adjust brightness and contrast with real-time preview sliders.
    * Option to revert to the original filtered state.
* **Resizing:**
    * Resize images by specifying width and height in pixels.
    * Option to lock the aspect ratio to maintain proportions.
* **Format Conversion & Download:**
    * Download the edited image in PNG, JPEG, or WEBP format.
    * Adjustable quality setting for JPEG exports.
* **Theme Toggle:** Switch between light and dark modes for comfortable viewing. The theme preference is saved in local storage.
* **Image Information Display:** View details of the uploaded image, including file name, original dimensions, current dimensions on canvas, and file type.
* **Responsive Design:** The interface is designed to be usable across different screen sizes.
* **Client-Side Processing:** All image manipulations are handled in the user's browser, meaning no server-side processing is required, making it fast and private.
* **Minimalist Aesthetic:** Clean, uncluttered UI with a focus on the image and ease of use, featuring the "Inter" font and a user-selectable accent color (currently Apple Red).
* **Personalized Credit:** Includes a subtle credit line with social media links within the image information panel.

## Technology Stack:

* **HTML5:** For the structure of the web page.
* **CSS3:**
    * **Tailwind CSS:** For utility-first styling and rapid UI development.
    * **Custom CSS:** For theming (light/dark modes using CSS variables), specific component styling, and achieving the desired aesthetic.
* **JavaScript (Vanilla):** For all client-side logic, including:
    * File handling (upload, drag-and-drop).
    * Canvas API for image rendering and manipulation.
    * DOM manipulation for UI updates and interactivity.
    * Integration with Cropper.js library.
* **Cropper.js:** A JavaScript library for advanced image cropping functionality.

## How to Use:

1.  **Clone or Download:**
    * Clone the repository: `git clone https://github.com/YourUsername/your-repository-name.git`
    * Or download the `index.html` file.
2.  **Open in Browser:**
    * Simply open the `index.html` file in a modern web browser.

No installation or build steps are required as all code is self-contained in `index.html`.

## Project Goals:

* To provide a simple, fast, and accessible tool for basic image editing tasks.
* To create a visually appealing and user-friendly interface.
* To demonstrate client-side image processing capabilities using modern web technologies.

This project is ideal for users who need quick edits without the complexity of professional desktop software.

## Future Enhancements (Potential Ideas):

* Undo/Redo functionality.
* More advanced filters (Blur, Sharpen, Vignette).
* Text overlay tool.
* Keyboard shortcuts.
* Zoom and Pan for image preview.

## Author & Credits

A project by **Geetartha Sarma**

* Instagram: [https://www.instagram.com/geetartha.sarma/](https://www.instagram.com/geetartha.sarma/)
* X (Twitter): [https://x.com/geetartha373](https://x.com/geetartha373)
* GitHub: [https://github.com/vladanila/vladanila.github.io](https://github.com/vladanila/vladanila.github.io) ---

Feel free to customize this further! For example, you might want to add a screenshot of the application. You can do this by taking a screenshot, adding it to your GitHub repository (e.g., in an `assets` folder or directly in the root), and then updating the `![Imagist Screenshot](placeholder_screenshot.png)` line with the correct path to your image.
