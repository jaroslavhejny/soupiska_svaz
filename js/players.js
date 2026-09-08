"use strict";

window.Soupiska = window.Soupiska || {};

window.Soupiska.players = (() => {
  const REQUEST_TIMEOUT_MS = 10000;
  const RETRY_COUNT = 1;
  const MAX_CONCURRENT_REQUESTS = 4;
  const RETRY_DELAY_MS = 800;
  const lokNumbersInput = document.getElementById("lok-numbers");
  const loadButton = document.getElementById("load-players");
  const loadStatus = document.getElementById("load-status");

  class MemberRequestError extends Error {
    constructor(lokNumber, status, retryAfterMs = 0) {
      super(`LOK ${lokNumber}: ${status ? `HTTP ${status}` : "chyba spojení"}`);
      this.status = status;
      this.retryAfterMs = retryAfterMs;
      this.retryable = status === 429 || status >= 500 || status === null;
    }
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

  function wait(duration) {
    return new Promise((resolve) => window.setTimeout(resolve, duration));
  }

  function getRetryAfterMs(response) {
    const retryAfter = response.headers.get("Retry-After");
    if (!retryAfter) return 0;

    const seconds = Number(retryAfter);
    const duration = Number.isFinite(seconds)
      ? seconds * 1000
      : Date.parse(retryAfter) - Date.now();
    return Math.min(Math.max(duration, 0), 5000);
  }

  async function requestMember(lokNumber) {
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS,
    );

    try {
      const response = await fetch(
        `https://api.chess.cz/api/members/${encodeURIComponent(lokNumber)}/cze`,
        { signal: controller.signal },
      );

      if (!response.ok) {
        throw new MemberRequestError(
          lokNumber,
          response.status,
          getRetryAfterMs(response),
        );
      }

      try {
        return await response.json();
      } catch {
        const error = new MemberRequestError(lokNumber, null);
        error.retryable = false;
        throw error;
      }
    } catch (error) {
      if (error instanceof MemberRequestError) throw error;
      throw new MemberRequestError(lokNumber, null);
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function fetchMember(lokNumber) {
    for (let attempt = 0; attempt <= RETRY_COUNT; attempt += 1) {
      try {
        return await requestMember(lokNumber);
      } catch (error) {
        if (!error.retryable || attempt === RETRY_COUNT) throw error;
        await wait(error.retryAfterMs || RETRY_DELAY_MS);
      }
    }
  }

  async function mapWithConcurrency(values, callback) {
    const results = new Array(values.length);
    let nextIndex = 0;

    async function worker() {
      while (nextIndex < values.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await callback(values[currentIndex]);
      }
    }

    const workerCount = Math.min(MAX_CONCURRENT_REQUESTS, values.length);
    await Promise.all(Array.from({ length: workerCount }, worker));
    return results;
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

  function showFailedRequests(failedResults, loadedCount) {
    const getNumbers = (items) =>
      items.map(({ lokNumber }) => lokNumber).join(", ");
    const rateLimited = failedResults.filter(
      ({ error }) => error.status === 429,
    );
    const notFound = failedResults.filter(({ error }) => error.status === 404);
    const other = failedResults.filter(
      ({ error }) => error.status !== 429 && error.status !== 404,
    );
    const parts = loadedCount > 0 ? [`Načteno ${loadedCount} hráčů`] : [];

    if (rateLimited.length > 0) {
      parts.push(`API dočasně odmítlo LOK: ${getNumbers(rateLimited)}`);
    }
    if (notFound.length > 0) {
      parts.push(`nenalezená LOK: ${getNumbers(notFound)}`);
    }
    if (other.length > 0) {
      parts.push(`nepodařilo se načíst LOK: ${getNumbers(other)}`);
    }

    loadStatus.textContent = `${parts.join("; ")}. Zkuste načtení později znovu.`;
    loadStatus.classList.add("load-status--error");
  }

  async function loadPlayers(lokNumbers) {
    const table = window.Soupiska.table;
    const visibleRows = table.getVisibleRows();
    const configuredNumbers = lokNumbers.slice(0, visibleRows.length);
    let completedCount = 0;

    loadStatus.textContent = `Načítám hráče (0/${configuredNumbers.length})…`;

    const results = await mapWithConcurrency(
      configuredNumbers,
      async (lokNumber) => {
        try {
          if (lokNumber === "-") return { empty: true };
          return { member: await fetchMember(lokNumber) };
        } catch (error) {
          return { error };
        } finally {
          completedCount += 1;
          loadStatus.textContent = `Načítám hráče (${completedCount}/${configuredNumbers.length})…`;
        }
      },
    );

    const failedResults = results
      .map((result, index) => ({
        error: result.error,
        lokNumber: configuredNumbers[index],
      }))
      .filter(({ error }) => error);
    const loadedCount = results.filter((result) => result.member).length;

    // Při úplném výpadku API ponecháme dříve načtenou tabulku beze změny.
    if (failedResults.length > 0 && loadedCount === 0) {
      showFailedRequests(failedResults, loadedCount);
      return;
    }

    results.forEach((result, rowIndex) => {
      if (result.member) {
        table.setRowValues(
          visibleRows[rowIndex],
          mapMemberToRow(result.member),
        );
      } else if (result.empty) {
        table.setRowValues(visibleRows[rowIndex]);
      }
    });
    visibleRows
      .slice(configuredNumbers.length)
      .forEach((row) => table.setRowValues(row));

    if (failedResults.length > 0) {
      showFailedRequests(failedResults, loadedCount);
      return;
    }

    const ignoredCount = Math.max(0, lokNumbers.length - visibleRows.length);
    const emptyCount = results.filter((result) => result.empty).length;
    const statusParts = [`Načteno ${loadedCount} hráčů`];

    if (emptyCount > 0) statusParts.push(`prázdných řádků: ${emptyCount}`);
    if (ignoredCount > 0) {
      statusParts.push(`ignorovaných položek: ${ignoredCount}`);
    }
    loadStatus.textContent = `${statusParts.join(", ")}.`;
  }

  function initialize() {
    loadButton.addEventListener("click", async () => {
      loadStatus.classList.remove("load-status--error");
      window.Soupiska.storage.save();

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
      } catch (error) {
        console.error("Neočekávaná chyba při načítání soupisky.", error);
        loadStatus.textContent =
          "Soupisku se nepodařilo načíst. Zkuste to prosím později znovu.";
        loadStatus.classList.add("load-status--error");
      } finally {
        loadButton.disabled = false;
      }
    });
  }

  return { initialize };
})();
