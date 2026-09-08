"use strict";

window.Soupiska = window.Soupiska || {};

window.Soupiska.storage = (() => {
  const storageKey = "team-roster:v1";
  const storedFieldIds = [
    "lok-numbers",
    "row-count",
    "base-lineup-count",
    "team",
    "start",
    "competition",
    "season",
    "captain",
    "deputy",
    "venue",
    "stamp-club",
    "stamp-org",
  ];
  const storedFields = storedFieldIds.map((id) => document.getElementById(id));
  const loadStatus = document.getElementById("load-status");

  function showStorageError(message) {
    loadStatus.textContent = message;
    loadStatus.classList.add("load-status--error");
  }

  function save() {
    const values = Object.fromEntries(
      storedFields.map((field) => [field.id, field.value]),
    );
    Object.assign(values, window.Soupiska.table.getNotesState());

    try {
      localStorage.setItem(storageKey, JSON.stringify(values));
    } catch {
      showStorageError("Vyplněné údaje se nepodařilo uložit.");
    }
  }

  function restore() {
    let savedValues;

    try {
      savedValues = JSON.parse(localStorage.getItem(storageKey));
    } catch {
      showStorageError("Uložené údaje se nepodařilo načíst.");
      return null;
    }

    if (!savedValues || typeof savedValues !== "object") {
      return null;
    }

    storedFields.forEach((field) => {
      if (typeof savedValues[field.id] === "string") {
        field.value = savedValues[field.id];
      }
    });

    return savedValues;
  }

  function initialize() {
    storedFields.forEach((field) => {
      field.addEventListener("input", save);
    });
  }

  return { initialize, restore, save };
})();
