"use strict";

window.Soupiska = window.Soupiska || {};

window.Soupiska.ui = (() => {
  const supportedStampTypes = new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/svg+xml",
  ]);

  function initializeHelp() {
    const dialog = document.getElementById("help-dialog");

    document.getElementById("open-help").addEventListener("click", () => {
      dialog.showModal();
    });

    document.getElementById("close-help").addEventListener("click", () => {
      dialog.close();
    });

    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        dialog.close();
      }
    });
  }

  function initializeStampUpload() {
    const stampBox = document.getElementById("stamp-club-box");
    const stampTextArea = document.getElementById("stamp-club");
    const imageInput = document.getElementById("stamp-club-image");
    const preview = document.getElementById("stamp-club-preview");
    const removeButton = document.getElementById("remove-stamp-club-image");
    const status = document.getElementById("stamp-club-upload-status");

    imageInput.addEventListener("change", () => {
      const [file] = imageInput.files;

      if (!file) {
        return;
      }

      const hasSupportedExtension = /\.(png|jpe?g|webp|svg)$/i.test(file.name);

      if (!supportedStampTypes.has(file.type) && !hasSupportedExtension) {
        imageInput.value = "";
        status.textContent =
          "Použijte obrázek ve formátu PNG, JPG, WebP nebo SVG.";
        return;
      }

      const reader = new FileReader();

      reader.addEventListener("load", () => {
        preview.src = reader.result;
        preview.hidden = false;
        stampTextArea.hidden = true;
        removeButton.hidden = false;
        stampBox.classList.add("signature--has-image");
        status.textContent = "";
      });

      reader.addEventListener("error", () => {
        status.textContent = "Obrázek se nepodařilo načíst.";
      });

      reader.readAsDataURL(file);
    });

    removeButton.addEventListener("click", () => {
      imageInput.value = "";
      preview.removeAttribute("src");
      preview.hidden = true;
      stampTextArea.hidden = false;
      removeButton.hidden = true;
      stampBox.classList.remove("signature--has-image");
      status.textContent = "";
    });
  }

  function initialize() {
    initializeHelp();
    initializeStampUpload();

    document
      .getElementById("print")
      .addEventListener("click", () => window.print());
  }

  return { initialize };
})();
