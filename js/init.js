"use strict";

const scriptDirectory = new URL(".", document.currentScript.src);
const scripts = ["table.js", "storage.js", "players.js", "ui.js"];

const loadScript = (fileName) =>
  new Promise((resolve, reject) => {
    const script = document.createElement("script");

    script.src = new URL(fileName, scriptDirectory).href;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Nepodařilo se načíst ${fileName}.`));
    document.head.append(script);
  });

const initialize = async () => {
  for (const script of scripts) {
    await loadScript(script);
  }

  const { table, storage, players, ui } = window.Soupiska;

  table.initialize(storage.save);

  const savedState = storage.restore();

  table.restoreNotesState(savedState);
  table.applySettings(false);
  storage.initialize();
  players.initialize();
  ui.initialize();
};

initialize().catch((error) => {
  console.error("Soupisku se nepodařilo spustit.", error);
});
