(function () {
  "use strict";

  var API_URL = "https://api.chess.cz/api/competitions/";
  var DEFAULT_TITLE = document.title;
  var loaderForm = document.querySelector(".loader-form");
  var matchForm = document.querySelector(".match-record");
  var status = document.querySelector(".loader-status");
  var submitButton = loaderForm.querySelector('button[type="submit"]');
  var printButton = document.getElementById("print");
  var matchSelector = document.querySelector(".match-selector");
  var matchSelect = loaderForm.elements.match;
  var competitionFilter = loaderForm.elements["competition-filter"];
  var competitionParent = loaderForm.elements["competition-parent"];
  var competitionSelect = loaderForm.elements["competition-select"];
  var nestedCompetition = document.querySelector(".nested-competition");
  var competitionRegions = [];
  var roundMatches = [];
  var rosterController = null;
  var rosters = { home: [], away: [] };
  var playerSelects = {
    home: Array.from(document.querySelectorAll('[data-team="home"]')),
    away: Array.from(document.querySelectorAll('[data-team="away"]')),
  };

  function firstKnownValue(data, keys) {
    for (var index = 0; index < keys.length; index += 1) {
      var value = data[keys[index]];

      if (value !== undefined && value !== null && value !== "") {
        return value;
      }
    }

    return "";
  }

  function seasonFromRoundDate(roundDate) {
    var parts = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(roundDate);

    if (!parts) {
      return "";
    }

    var month = Number(parts[2]);
    var year = Number(parts[3]);

    if (month >= 7 && month <= 12) {
      return year + "/" + (year + 1);
    }

    if (month >= 1 && month <= 6) {
      return year - 1 + "/" + year;
    }

    return "";
  }

  async function fetchJson(url, signal) {
    var response = await fetch(url, { signal: signal });

    if (!response.ok) {
      throw new Error("API vrátilo chybu " + response.status + ".");
    }

    return response.json();
  }

  function setStatus(message, state) {
    status.textContent = message;

    if (state) {
      status.dataset.state = state;
    } else {
      delete status.dataset.state;
    }
  }

  function filenamePart(value) {
    return String(value || "")
      .replace(/\./g, "")
      .replace(/[\\/:*?"<>|]/g, "-")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function setDocumentTitle(match) {
    document.title = [
      matchForm.elements.competition.value,
      match.homeTeamName,
      match.awayTeamName,
      matchForm.elements.date.value,
    ]
      .map(filenamePart)
      .filter(Boolean)
      .join("-");
  }

  function normalizeSearchText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("cs");
  }

  function competitionSeasonStartYear(date) {
    return date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1;
  }

  function competitionMatchesFilter(competition, query) {
    return normalizeSearchText(competition.compName).includes(query);
  }

  function regionMatchesFilter(region, query) {
    if (!query) {
      return true;
    }

    var regionText = normalizeSearchText(
      region.regionCode + " " + region.regionName,
    );

    return (
      regionText.includes(query) ||
      region.competitions.some(function (competition) {
        return competitionMatchesFilter(competition, query);
      })
    );
  }

  function filteredRegionCompetitions(region, query) {
    if (
      !query ||
      normalizeSearchText(region.regionCode + " " + region.regionName).includes(
        query,
      )
    ) {
      return region.competitions;
    }

    return region.competitions.filter(function (competition) {
      return competitionMatchesFilter(competition, query);
    });
  }

  function renderCompetitionOptions() {
    var selectedCompetition = competitionSelect.value;
    var selectedRegion = competitionRegions.find(function (region) {
      return region.regionId === competitionParent.value;
    });

    competitionSelect.length = 1;

    if (!selectedRegion) {
      competitionSelect.disabled = true;
      nestedCompetition.hidden = true;
      return;
    }

    var query = normalizeSearchText(competitionFilter.value.trim());
    var competitions = filteredRegionCompetitions(selectedRegion, query);

    competitions.forEach(function (competition) {
      var option = document.createElement("option");
      option.value = String(competition.compId);
      option.textContent = competition.compName;
      competitionSelect.appendChild(option);
    });

    if (
      Array.from(competitionSelect.options).some(function (option) {
        return option.value === selectedCompetition;
      })
    ) {
      competitionSelect.value = selectedCompetition;
    } else if (selectedCompetition) {
      loaderForm.elements["competition-id"].value = "";
    }

    competitionSelect.disabled = competitions.length === 0;
    nestedCompetition.hidden = false;
  }

  function renderCompetitionParents() {
    var selectedRegion = competitionParent.value;
    var query = normalizeSearchText(competitionFilter.value.trim());
    var regions = competitionRegions.filter(function (region) {
      return regionMatchesFilter(region, query);
    });

    competitionParent.length = 1;

    regions.forEach(function (region) {
      var option = document.createElement("option");
      option.value = region.regionId;
      option.textContent = region.regionCode + " – " + region.regionName;
      competitionParent.appendChild(option);
    });

    if (
      Array.from(competitionParent.options).some(function (option) {
        return option.value === selectedRegion;
      })
    ) {
      competitionParent.value = selectedRegion;
    } else {
      competitionParent.value = "";

      if (selectedRegion) {
        loaderForm.elements["competition-id"].value = "";
      }
    }

    renderCompetitionOptions();
  }

  async function loadCompetitionChoices() {
    var seasonYear = competitionSeasonStartYear(new Date());
    var controller = new AbortController();
    var timeout = setTimeout(function () {
      controller.abort();
    }, 20000);

    setStatus(
      "Načítám soutěže pro sezonu " +
        seasonYear +
        "/" +
        (seasonYear + 1) +
        "…",
    );

    try {
      var data = await fetchJson(API_URL + seasonYear, controller.signal);

      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("API vrátilo neplatný seznam soutěží.");
      }

      competitionRegions = Object.keys(data)
        .map(function (regionId) {
          var region = data[regionId];

          return {
            regionId: regionId,
            regionCode: region.regionCode || "",
            regionName: region.regionName || "",
            competitions: Array.isArray(region.competitions)
              ? region.competitions.slice().sort(function (first, second) {
                  return (
                    Number(first.compLevel) - Number(second.compLevel) ||
                    first.compName.localeCompare(second.compName, "cs")
                  );
                })
              : [],
          };
        })
        .filter(function (region) {
          return region.competitions.length > 0;
        })
        .sort(function (first, second) {
          if (first.regionId === "98") {
            return -1;
          }

          if (second.regionId === "98") {
            return 1;
          }

          return first.regionName.localeCompare(second.regionName, "cs");
        });

      competitionFilter.disabled = false;
      competitionParent.disabled = false;
      renderCompetitionParents();
      setStatus(
        "Vyberte svaz a soutěž pro sezonu " +
          seasonYear +
          "/" +
          (seasonYear + 1) +
          ".",
      );
    } catch (error) {
      console.error("Seznam soutěží se nepodařilo načíst:", error);
      setStatus(
        error.name === "AbortError"
          ? "Načítání soutěží trvalo příliš dlouho. ID lze zadat ručně."
          : "Seznam soutěží se nepodařilo načíst. ID lze zadat ručně.",
        "error",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  function resetPlayerSelect(select) {
    select.length = 1;
    select.value = "";
    select.disabled = true;
  }

  function resetAllPlayerSelects() {
    rosters.home = [];
    rosters.away = [];

    playerSelects.home.concat(playerSelects.away).forEach(resetPlayerSelect);
  }

  function playerLabel(player) {
    var flags = String(player.playerFlags || "").trim();
    return player.playerName + (flags ? " (" + flags + ")" : "");
  }

  function populatePlayerSelect(select, players, minimumPosition) {
    resetPlayerSelect(select);
    select.dataset.minimumPosition = String(minimumPosition);

    players.forEach(function (player) {
      if (player.rosterPosition <= minimumPosition) {
        return;
      }

      var option = document.createElement("option");
      option.value = String(player.rosterPosition);
      option.textContent = playerLabel(player);
      select.appendChild(option);
    });

    var emptyOption = document.createElement("option");
    emptyOption.value = "-";
    emptyOption.textContent = "-";
    select.appendChild(emptyOption);

    select.disabled = false;
  }

  function setRoster(team, players) {
    rosters[team] = players
      .filter(function (player) {
        return Number.isFinite(Number(player.rosterPosition));
      })
      .map(function (player) {
        return Object.assign({}, player, {
          rosterPosition: Number(player.rosterPosition),
        });
      })
      .sort(function (first, second) {
        return first.rosterPosition - second.rosterPosition;
      });

    playerSelects[team].forEach(resetPlayerSelect);
    populatePlayerSelect(playerSelects[team][0], rosters[team], 0);
  }

  function abortRosterRequest() {
    if (rosterController) {
      rosterController.abort();
      rosterController = null;
    }
  }

  function hideMatchSelector() {
    abortRosterRequest();
    roundMatches = [];
    matchSelect.length = 1;
    matchSelect.value = "";
    matchSelect.disabled = true;
    matchSelector.hidden = true;
  }

  function showRoundMatches(matches) {
    resetAllPlayerSelects();
    document.title = DEFAULT_TITLE;
    roundMatches = matches;
    matchSelect.length = 1;

    matches.forEach(function (match, index) {
      var option = document.createElement("option");
      option.value = String(index);
      option.textContent = match.homeTeamName + " - " + match.awayTeamName;
      matchSelect.appendChild(option);
    });

    matchForm.elements["home-team"].value = "";
    matchForm.elements["away-team"].value = "";
    matchSelect.disabled = false;
    matchSelector.hidden = false;
  }

  async function loadRosters(competitionId, match) {
    abortRosterRequest();
    resetAllPlayerSelects();

    var controller = new AbortController();
    var timedOut = false;
    var timeout = setTimeout(function () {
      timedOut = true;
      controller.abort();
    }, 10000);
    rosterController = controller;
    setStatus("Načítám soupisky obou družstev…");

    try {
      var results = await Promise.all([
        fetchJson(
          API_URL +
            encodeURIComponent(competitionId) +
            "/team/" +
            encodeURIComponent(match.homeTeamId) +
            "/roster",
          controller.signal,
        ),
        fetchJson(
          API_URL +
            encodeURIComponent(competitionId) +
            "/team/" +
            encodeURIComponent(match.awayTeamId) +
            "/roster",
          controller.signal,
        ),
      ]);

      if (controller !== rosterController) {
        return;
      }

      if (!Array.isArray(results[0]) || !Array.isArray(results[1])) {
        throw new Error("API vrátilo neplatnou soupisku.");
      }

      setRoster("home", results[0]);
      setRoster("away", results[1]);
      setStatus(
        "Soupisky načteny: " +
          match.homeTeamName +
          " - " +
          match.awayTeamName +
          ".",
      );
    } catch (error) {
      if (controller !== rosterController) {
        return;
      }

      console.error("Soupisky se nepodařilo načíst:", error);
      setStatus(
        timedOut
          ? "Načítání soupisek trvalo příliš dlouho. Zkuste utkání vybrat znovu."
          : error.message || "Soupisky se nepodařilo načíst.",
        "error",
      );
    } finally {
      clearTimeout(timeout);

      if (controller === rosterController) {
        rosterController = null;
      }
    }
  }

  function fillMatchDetails(competition, round) {
    var competitionName = firstKnownValue(competition, [
      "compName",
      "competitionName",
      "name",
    ]);
    var groupName = firstKnownValue(competition, [
      "groupName",
      "compGroup",
      "group",
    ]);

    if (competitionName) {
      matchForm.elements.competition.value = competitionName;
    }

    if (groupName) {
      matchForm.elements.group.value = groupName;
    }

    matchForm.elements.round.value = round.roundNr;
    matchForm.elements.date.value = round.roundDate;
    matchForm.elements.season.value = seasonFromRoundDate(round.roundDate);
  }

  loaderForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    var competitionIdInput = loaderForm.elements["competition-id"];
    var roundInput = loaderForm.elements.round;
    var competitionId = competitionIdInput.value.trim();
    var roundNumber = Number(roundInput.value);

    competitionIdInput.removeAttribute("aria-invalid");
    roundInput.removeAttribute("aria-invalid");
    hideMatchSelector();

    if (!/^\d+$/.test(competitionId)) {
      competitionIdInput.setAttribute("aria-invalid", "true");
      setStatus("ID soutěže musí být číslo.", "error");
      return;
    }

    if (!Number.isInteger(roundNumber) || roundNumber < 1) {
      roundInput.setAttribute("aria-invalid", "true");
      setStatus("Kolo musí být celé kladné číslo.", "error");
      return;
    }

    var controller = new AbortController();
    var timeout = setTimeout(function () {
      controller.abort();
    }, 10000);

    submitButton.disabled = true;
    setStatus("Načítám soutěž a rozlosování…");

    try {
      var results = await Promise.all([
        fetchJson(
          API_URL + encodeURIComponent(competitionId) + "/details",
          controller.signal,
        ),
        fetchJson(
          API_URL + encodeURIComponent(competitionId) + "/schedule",
          controller.signal,
        ),
      ]);
      var competition = results[0];
      var schedule = results[1];

      if (!Array.isArray(schedule)) {
        throw new Error("API vrátilo neplatné rozlosování.");
      }

      var selectedRound = schedule.find(function (round) {
        return Number(round.roundNr) === roundNumber;
      });

      if (!selectedRound) {
        roundInput.setAttribute("aria-invalid", "true");
        throw new Error("Kolo " + roundNumber + " nebylo v rozlosování nalezeno.");
      }

      if (
        !Array.isArray(selectedRound.roundMatches) ||
        selectedRound.roundMatches.length === 0
      ) {
        throw new Error("Vybrané kolo neobsahuje žádná utkání.");
      }

      fillMatchDetails(competition, selectedRound);
      showRoundMatches(selectedRound.roundMatches);
      setStatus(
        "Načteno: " +
          matchForm.elements.competition.value +
          ", " +
          roundNumber +
          ". kolo. Vyberte utkání.",
      );
    } catch (error) {
      console.error("Údaje utkání se nepodařilo načíst:", error);
      setStatus(
        error.name === "AbortError"
          ? "Načítání trvalo příliš dlouho. Zkuste to znovu."
          : error.message || "Údaje se nepodařilo načíst.",
        "error",
      );
    } finally {
      clearTimeout(timeout);
      submitButton.disabled = false;
    }
  });

  matchSelect.addEventListener("change", function () {
    var selectedMatch = roundMatches[Number(matchSelect.value)];

    if (!selectedMatch || matchSelect.value === "") {
      abortRosterRequest();
      resetAllPlayerSelects();
      matchForm.elements["home-team"].value = "";
      matchForm.elements["away-team"].value = "";
      document.title = DEFAULT_TITLE;
      return;
    }

    matchForm.elements["home-team"].value = selectedMatch.homeTeamName;
    matchForm.elements["away-team"].value = selectedMatch.awayTeamName;
    setDocumentTitle(selectedMatch);
    loadRosters(
      loaderForm.elements["competition-id"].value.trim(),
      selectedMatch,
    );
  });

  playerSelects.home.concat(playerSelects.away).forEach(function (select) {
    select.addEventListener("change", function () {
      var team = select.dataset.team;
      var board = Number(select.dataset.board);
      var selects = playerSelects[team];

      for (var index = board + 1; index < selects.length; index += 1) {
        resetPlayerSelect(selects[index]);
      }

      if (select.value !== "" && board + 1 < selects.length) {
        var minimumPosition =
          select.value === "-"
            ? Number(select.dataset.minimumPosition)
            : Number(select.value);

        populatePlayerSelect(
          selects[board + 1],
          rosters[team],
          minimumPosition,
        );
      }
    });
  });

  window.addEventListener("beforeprint", function () {
    playerSelects.home.concat(playerSelects.away).forEach(function (select) {
      select.options[0].textContent = "";
    });
  });

  window.addEventListener("afterprint", function () {
    playerSelects.home.concat(playerSelects.away).forEach(function (select) {
      select.options[0].textContent = "Vyberte hráče";
    });
  });

  printButton.addEventListener("click", function () {
    window.print();
  });

  competitionFilter.addEventListener("input", renderCompetitionParents);

  competitionParent.addEventListener("change", function () {
    competitionSelect.value = "";
    loaderForm.elements["competition-id"].value = "";
    renderCompetitionOptions();
  });

  competitionSelect.addEventListener("change", function () {
    loaderForm.elements["competition-id"].value = competitionSelect.value;
  });

  loaderForm.elements["competition-id"].addEventListener("input", function () {
    if (this.value !== competitionSelect.value) {
      competitionSelect.value = "";
    }
  });

  resetAllPlayerSelects();
  hideMatchSelector();
  loadCompetitionChoices();
})();
