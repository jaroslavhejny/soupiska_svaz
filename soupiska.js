const playerFieldLabels = [
  "Příjmení a jméno",
  "Datum narození",
  "Titul VT",
  "ELO FIDE",
  "Evidenční číslo FIDE",
  "ELO LOK",
  "Evidenční číslo LOK",
  "Poznámka",
];

const playerRows = [...document.querySelectorAll("#players tr")];
const lokNumbersInput = document.getElementById("lok-numbers");
const loadButton = document.getElementById("load-players");
const loadStatus = document.getElementById("load-status");

function setAccessibleLabels() {
  playerRows.forEach((row) => {
    const playerNumber = row.cells[0].textContent.trim();

    row.querySelectorAll("input").forEach((input, columnIndex) => {
      input.setAttribute(
        "aria-label",
        `${playerFieldLabels[columnIndex]}, hráč ${playerNumber}`,
      );
    });
  });
}

function setRowValues(row, values = []) {
  row.querySelectorAll("input").forEach((input, columnIndex) => {
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
    "",
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
  const invalidValues = values.filter((value) => !/^\d+$/.test(value));

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

  const configuredNumbers = lokNumbers.slice(0, playerRows.length);

  loadStatus.textContent = `Načítám hráče (0/${configuredNumbers.length})…`;
  let completedCount = 0;

  const results = await Promise.all(
    configuredNumbers.map(async (lokNumber) => {
      try {
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
      setRowValues(playerRows[rowIndex], mapMemberToRow(result.member));
    } else {
      failedNumbers.push(configuredNumbers[rowIndex]);
    }
  });

  if (failedNumbers.length > 0) {
    loadStatus.textContent = `Nepodařilo se načíst LOK: ${failedNumbers.join(", ")}.`;
    loadStatus.classList.add("load-status--error");
    return;
  }

  const ignoredCount = Math.max(0, lokNumbers.length - playerRows.length);
  loadStatus.textContent = ignoredCount
    ? `Načteno ${results.length} hráčů. Dalších ${ignoredCount} čísel bylo ignorováno.`
    : `Načteno ${results.length} hráčů.`;
}

setAccessibleLabels();

loadButton.addEventListener("click", async () => {
  loadStatus.classList.remove("load-status--error");

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

document
  .getElementById("print")
  .addEventListener("click", () => window.print());
