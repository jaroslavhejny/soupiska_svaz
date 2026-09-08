"use strict";

window.Soupiska = window.Soupiska || {};

window.Soupiska.table = (() => {
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
  const rowCountInput = document.getElementById("row-count");
  const baseLineupCountInput = document.getElementById("base-lineup-count");
  let handleChange = () => {};

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

    tableBody.replaceChildren(fragment);
  }

  createPlayerRows(maximumPlayerRows);
  const rows = [...document.querySelectorAll("#players tr")];

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
      handleChange();
    });

    return button;
  }

  function createNoteControls() {
    rows.forEach((row, rowIndex) => {
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
      customNote.addEventListener("input", handleChange);
      group.append(customNote);

      noteCell.replaceChildren(group);
    });
  }

  function setAccessibleLabels() {
    rows.forEach((row) => {
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

  function getBoundedInteger(input, minimum, maximum, fallback) {
    const value = Number.parseInt(input.value, 10);

    return Number.isFinite(value)
      ? Math.min(maximum, Math.max(minimum, value))
      : fallback;
  }

  function applySettings(resetBaseLineup) {
    const rowCount = getBoundedInteger(rowCountInput, 1, rows.length, 20);
    const requestedBaseLineupCount = getBoundedInteger(
      baseLineupCountInput,
      0,
      rows.length,
      8,
    );
    const baseLineupCount = Math.min(requestedBaseLineupCount, rowCount);

    rowCountInput.value = rowCount;
    baseLineupCountInput.max = rowCount;
    baseLineupCountInput.value = baseLineupCount;

    rows.forEach((row, rowIndex) => {
      row.hidden = rowIndex >= rowCount;
      row.classList.remove("base-lineup-end");
    });

    if (baseLineupCount > 0) {
      rows[baseLineupCount - 1].classList.add("base-lineup-end");
    }

    if (resetBaseLineup || baseLineupCount !== requestedBaseLineupCount) {
      rows.forEach((row, rowIndex) => {
        const button = row.querySelector('.note-option[data-note="Z"]');

        setNoteSelected(button, rowIndex < baseLineupCount);
      });
    }
  }

  function getNotesState() {
    return {
      playerNotes: rows.map((row) =>
        [...row.querySelectorAll(".note-option[aria-pressed='true']")].map(
          (button) => button.dataset.note,
        ),
      ),
      playerCustomNotes: rows.map(
        (row) => row.querySelector(".note-custom").value,
      ),
    };
  }

  function restoreNotesState(savedValues) {
    if (Array.isArray(savedValues?.playerNotes)) {
      rows.forEach((row, rowIndex) => {
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

    if (Array.isArray(savedValues?.playerCustomNotes)) {
      rows.forEach((row, rowIndex) => {
        const savedNote = savedValues.playerCustomNotes[rowIndex];

        if (typeof savedNote === "string") {
          row.querySelector(".note-custom").value = savedNote.slice(0, 6);
        }
      });
    }
  }

  function setRowValues(row, values = []) {
    row
      .querySelectorAll("input:not(.note-custom)")
      .forEach((input, columnIndex) => {
        input.value = values[columnIndex] ?? "";
      });
  }

  function initialize(onChange) {
    handleChange = onChange;
    createNoteControls();
    setAccessibleLabels();

    rowCountInput.addEventListener("change", () => {
      applySettings(false);
      handleChange();
    });

    baseLineupCountInput.addEventListener("change", () => {
      applySettings(true);
      handleChange();
    });
  }

  return {
    applySettings,
    getNotesState,
    getVisibleRows: () => rows.filter((row) => !row.hidden),
    initialize,
    restoreNotesState,
    rows,
    setRowValues,
  };
})();
