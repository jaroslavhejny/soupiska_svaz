const playerInputLabels = [
  "Příjmení a jméno",
  "Datum narození",
  "Titul VT",
  "ELO FIDE",
  "Evidenční číslo FIDE",
  "ELO LOK",
  "Evidenční číslo LOK",
];
const noteDefinitions = [
  { value: "Z", label: "Z", tooltip: "Z – základní sestava" },
  { value: "H", label: "H", tooltip: "H – host" },
  { value: "C", label: "C", tooltip: "C – cizinec" },
  { value: "K", label: "K", tooltip: "K – kapitán" },
  { value: "ZK", label: "ZK", tooltip: "ZK – zástupce kapitána" },
];
const exclusiveNoteOptions = new Set(["K", "ZK"]);
const maximumPlayerRows = 20;

function createPlayerRows(count) {
  const tableBody = document.getElementById("players");
  const fragment = document.createDocumentFragment();

  for (let rowIndex = 0; rowIndex < count; rowIndex += 1) {
    const playerNumber = rowIndex + 1;
    const row = document.createElement("tr");

    row.insertCell().textContent = playerNumber;

    for (let columnIndex = 1; columnIndex <= 8; columnIndex += 1) {
      const cell = row.insertCell();

      if (columnIndex <= playerInputLabels.length) {
        const input = document.createElement("input");

        input.type = "text";
        input.name = `player_${playerNumber}_${columnIndex}`;
        cell.append(input);
      }
    }

    fragment.append(row);
  }

  tableBody.append(fragment);
}

createPlayerRows(maximumPlayerRows);

const playerRows = [...document.querySelectorAll("#players tr")];
const lokNumbersInput = document.getElementById("lok-numbers");
const loadButton = document.getElementById("load-players");
const loadStatus = document.getElementById("load-status");
const helpDialog = document.getElementById("help-dialog");
const openHelpButton = document.getElementById("open-help");
const closeHelpButton = document.getElementById("close-help");
const rowCountInput = document.getElementById("row-count");
const baseLineupCountInput = document.getElementById("base-lineup-count");
const stampBox = document.getElementById("stamp-club-box");
const stampTextArea = document.getElementById("stamp-club");
const stampImageInput = document.getElementById("stamp-club-image");
const stampPreview = document.getElementById("stamp-club-preview");
const removeStampButton = document.getElementById("remove-stamp-club-image");
const stampUploadStatus = document.getElementById("stamp-club-upload-status");

const supportedStampTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

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

function saveFormState() {
  const values = Object.fromEntries(
    storedFields.map((field) => [field.id, field.value]),
  );
  values.playerNotes = playerRows.map((row) =>
    [...row.querySelectorAll(".note-option[aria-pressed='true']")].map(
      (button) => button.dataset.note,
    ),
  );
  values.playerCustomNotes = playerRows.map(
    (row) => row.querySelector(".note-custom").value,
  );

  try {
    localStorage.setItem(storageKey, JSON.stringify(values));
  } catch {
    loadStatus.textContent = "Vyplněné údaje se nepodařilo uložit.";
    loadStatus.classList.add("load-status--error");
  }
}

function restoreFormState() {
  let savedValues;

  try {
    savedValues = JSON.parse(localStorage.getItem(storageKey));
  } catch {
    loadStatus.textContent = "Uložené údaje se nepodařilo načíst.";
    loadStatus.classList.add("load-status--error");
    return;
  }

  if (!savedValues || typeof savedValues !== "object") {
    return;
  }

  storedFields.forEach((field) => {
    if (typeof savedValues[field.id] === "string") {
      field.value = savedValues[field.id];
    }
  });

  if (Array.isArray(savedValues.playerNotes)) {
    playerRows.forEach((row, rowIndex) => {
      const savedNotes = Array.isArray(savedValues.playerNotes[rowIndex])
        ? savedValues.playerNotes[rowIndex]
        : [];

      row.querySelectorAll(".note-option").forEach((button) => {
        setNoteSelected(button, savedNotes.includes(button.dataset.note));
      });
    });

    exclusiveNoteOptions.forEach((note) => {
      let alreadySelected = false;

      document
        .querySelectorAll(`.note-option[data-note="${note}"]`)
        .forEach((button) => {
          const isSelected = button.getAttribute("aria-pressed") === "true";

          setNoteSelected(button, isSelected && !alreadySelected);
          alreadySelected ||= isSelected;
        });
    });
  }

  if (Array.isArray(savedValues.playerCustomNotes)) {
    playerRows.forEach((row, rowIndex) => {
      const savedNote = savedValues.playerCustomNotes[rowIndex];

      if (typeof savedNote === "string") {
        row.querySelector(".note-custom").value = savedNote.slice(0, 6);
      }
    });
  }
}

function setNoteSelected(button, selected) {
  button.setAttribute("aria-pressed", String(selected));
}

function createNoteButton(definition, playerNumber, selected = false) {
  const button = document.createElement("button");

  button.className = "note-option";
  button.type = "button";
  button.dataset.note = definition.value;
  button.textContent = definition.label;
  button.title = definition.tooltip;
  button.setAttribute(
    "aria-label",
    `${definition.tooltip}, hráč ${playerNumber}`,
  );
  setNoteSelected(button, selected);

  button.addEventListener("click", () => {
    const willSelect = button.getAttribute("aria-pressed") !== "true";

    if (willSelect && exclusiveNoteOptions.has(definition.value)) {
      document
        .querySelectorAll(`.note-option[data-note="${definition.value}"]`)
        .forEach((otherButton) => setNoteSelected(otherButton, false));
    }

    setNoteSelected(button, willSelect);
    saveFormState();
  });

  return button;
}

function createNoteControls() {
  playerRows.forEach((row, rowIndex) => {
    const playerNumber = row.cells[0].textContent.trim();
    const noteCell = row.cells[row.cells.length - 1];
    const group = document.createElement("div");

    group.className = "note-options";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", `Poznámka, hráč ${playerNumber}`);

    noteDefinitions.forEach((definition) => {
      group.append(
        createNoteButton(
          definition,
          playerNumber,
          definition.value === "Z" && rowIndex < 8,
        ),
      );
    });

    const customNote = document.createElement("input");

    customNote.className = "note-custom";
    customNote.type = "text";
    customNote.maxLength = 6;
    customNote.placeholder = "Další";
    customNote.title = "Další označení – maximálně 6 znaků";
    customNote.setAttribute(
      "aria-label",
      `Další označení, hráč ${playerNumber}`,
    );
    customNote.addEventListener("input", saveFormState);
    group.append(customNote);

    noteCell.replaceChildren(group);
  });
}

function getBoundedInteger(input, minimum, maximum, fallback) {
  const value = Number.parseInt(input.value, 10);

  return Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

function applyRosterSettings(resetBaseLineup) {
  const rowCount = getBoundedInteger(rowCountInput, 1, playerRows.length, 20);
  const requestedBaseLineupCount = getBoundedInteger(
    baseLineupCountInput,
    0,
    playerRows.length,
    8,
  );
  const baseLineupCount = Math.min(requestedBaseLineupCount, rowCount);

  rowCountInput.value = rowCount;
  baseLineupCountInput.max = rowCount;
  baseLineupCountInput.value = baseLineupCount;

  playerRows.forEach((row, rowIndex) => {
    row.hidden = rowIndex >= rowCount;
    row.classList.remove("base-lineup-end");
  });

  if (baseLineupCount > 0) {
    playerRows[baseLineupCount - 1].classList.add("base-lineup-end");
  }

  if (resetBaseLineup || baseLineupCount !== requestedBaseLineupCount) {
    playerRows.forEach((row, rowIndex) => {
      const button = row.querySelector('.note-option[data-note="Z"]');

      setNoteSelected(button, rowIndex < baseLineupCount);
    });
  }
}

function setAccessibleLabels() {
  playerRows.forEach((row) => {
    const playerNumber = row.cells[0].textContent.trim();

    row
      .querySelectorAll("input:not(.note-custom)")
      .forEach((input, columnIndex) => {
        input.setAttribute(
          "aria-label",
          `${playerInputLabels[columnIndex]}, hráč ${playerNumber}`,
        );
      });
  });
}

function setRowValues(row, values = []) {
  row
    .querySelectorAll("input:not(.note-custom)")
    .forEach((input, columnIndex) => {
      input.value = values[columnIndex] ?? "";
    });
}

function mapMemberToRow(member) {
  return [
    member.fullName?.trim(),
    member.birthYear,
    member.playerClass,
    member.fideStdElo,
    member.fideId,
    member.czeStdElo,
    member.czeId,
  ];
}

async function fetchMember(lokNumber) {
  const response = await fetch(
    `https://api.chess.cz/api/members/${encodeURIComponent(lokNumber)}/cze`,
  );

  if (!response.ok) {
    throw new Error(`LOK ${lokNumber}: HTTP ${response.status}`);
  }

  return response.json();
}

function parseLokNumbers(value) {
  const values = value.split(/[\s,;]+/).filter(Boolean);
  const invalidValues = values.filter(
    (value) => value !== "-" && !/^\d+$/.test(value),
  );

  if (invalidValues.length > 0) {
    throw new Error(`Neplatná čísla LOK: ${invalidValues.join(", ")}.`);
  }

  if (values.length === 0) {
    throw new Error("Zadejte alespoň jedno číslo LOK.");
  }

  return values;
}

async function loadPlayers(lokNumbers) {
  playerRows.forEach((row) => setRowValues(row));

  const visibleRows = playerRows.filter((row) => !row.hidden);
  const configuredNumbers = lokNumbers.slice(0, visibleRows.length);

  loadStatus.textContent = `Načítám hráče (0/${configuredNumbers.length})…`;
  let completedCount = 0;

  const results = await Promise.all(
    configuredNumbers.map(async (lokNumber) => {
      try {
        if (lokNumber === "-") {
          return { empty: true };
        }

        return { member: await fetchMember(lokNumber) };
      } catch (error) {
        return { error };
      } finally {
        completedCount += 1;
        loadStatus.textContent = `Načítám hráče (${completedCount}/${configuredNumbers.length})…`;
      }
    }),
  );

  const failedNumbers = [];

  results.forEach((result, rowIndex) => {
    if (result.member) {
      setRowValues(visibleRows[rowIndex], mapMemberToRow(result.member));
    } else if (result.error) {
      failedNumbers.push(configuredNumbers[rowIndex]);
    }
  });

  if (failedNumbers.length > 0) {
    loadStatus.textContent = `Nepodařilo se načíst LOK: ${failedNumbers.join(", ")}.`;
    loadStatus.classList.add("load-status--error");
    return;
  }

  const ignoredCount = Math.max(0, lokNumbers.length - visibleRows.length);
  const loadedCount = results.filter((result) => result.member).length;
  const emptyCount = results.filter((result) => result.empty).length;
  const statusParts = [`Načteno ${loadedCount} hráčů`];

  if (emptyCount > 0) {
    statusParts.push(`prázdných řádků: ${emptyCount}`);
  }

  if (ignoredCount > 0) {
    statusParts.push(`ignorovaných položek: ${ignoredCount}`);
  }

  loadStatus.textContent = `${statusParts.join(", ")}.`;
}

createNoteControls();
setAccessibleLabels();

loadButton.addEventListener("click", async () => {
  loadStatus.classList.remove("load-status--error");
  saveFormState();

  let lokNumbers;

  try {
    lokNumbers = parseLokNumbers(lokNumbersInput.value);
  } catch (error) {
    loadStatus.textContent = error.message;
    loadStatus.classList.add("load-status--error");
    return;
  }

  loadButton.disabled = true;

  try {
    await loadPlayers(lokNumbers);
  } finally {
    loadButton.disabled = false;
  }
});

restoreFormState();
applyRosterSettings(false);

storedFields.forEach((field) => {
  field.addEventListener("input", saveFormState);
});

rowCountInput.addEventListener("change", () => {
  applyRosterSettings(false);
  saveFormState();
});

baseLineupCountInput.addEventListener("change", () => {
  applyRosterSettings(true);
  saveFormState();
});

openHelpButton.addEventListener("click", () => {
  helpDialog.showModal();
});

closeHelpButton.addEventListener("click", () => {
  helpDialog.close();
});

helpDialog.addEventListener("click", (event) => {
  if (event.target === helpDialog) {
    helpDialog.close();
  }
});

stampImageInput.addEventListener("change", () => {
  const [file] = stampImageInput.files;

  if (!file) {
    return;
  }

  const hasSupportedExtension = /\.(png|jpe?g|webp|svg)$/i.test(file.name);

  if (!supportedStampTypes.has(file.type) && !hasSupportedExtension) {
    stampImageInput.value = "";
    stampUploadStatus.textContent =
      "Použijte obrázek ve formátu PNG, JPG, WebP nebo SVG.";
    return;
  }

  const reader = new FileReader();

  reader.addEventListener("load", () => {
    stampPreview.src = reader.result;
    stampPreview.hidden = false;
    stampTextArea.hidden = true;
    removeStampButton.hidden = false;
    stampBox.classList.add("signature--has-image");
    stampUploadStatus.textContent = "";
  });

  reader.addEventListener("error", () => {
    stampUploadStatus.textContent = "Obrázek se nepodařilo načíst.";
  });

  reader.readAsDataURL(file);
});

removeStampButton.addEventListener("click", () => {
  stampImageInput.value = "";
  stampPreview.removeAttribute("src");
  stampPreview.hidden = true;
  stampTextArea.hidden = false;
  removeStampButton.hidden = true;
  stampBox.classList.remove("signature--has-image");
  stampUploadStatus.textContent = "";
});

document
  .getElementById("print")
  .addEventListener("click", () => window.print());
